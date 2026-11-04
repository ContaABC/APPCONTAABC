"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Obtener Empresas
 */
export async function obtenerEmpresas() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .select("*")
      .order("razon_social", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Obtener Sucursales por empresa_id
 */
export async function obtenerSucursales(empresaId: number | string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const parsedEmpresaId = Number(empresaId);
    if (!parsedEmpresaId) return { success: true, data: [], error: null };

    const { data, error } = await supabaseAdmin
      .from("sucursales")
      .select("*")
      .eq("empresa_id", parsedEmpresaId)
      .order("codigo_sucursal", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Obtiene las facturas EMITIDAS calculando el estado_pago a partir de total_factura, total_abonos y saldo_pendiente
 */
export async function obtenerFacturasEmitidas(
  empresaId: number | string,
  sucursalId?: number | string
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const parsedEmpresaId = Number(empresaId);

    if (!parsedEmpresaId) {
      return {
        success: false,
        data: [],
        error: "Debe seleccionar una empresa válida.",
      };
    }

    let query = supabaseAdmin
      .from("facturas_emitidas")
      .select(`
        id,
        numero_factura,
        prefijo,
        cliente_id,
        cliente_nit,
        cliente_nombre,
        fecha_emision,
        fecha_vencimiento,
        subtotal,
        iva,
        otros_impuestos,
        retenciones,
        total_factura,
        total_abonos,
        saldo_pendiente,
        estado_cobro,
        estado_dian,
        cufe        
      `)
      .eq("empresa_id", parsedEmpresaId);

    if (sucursalId && Number(sucursalId) > 0) {
      query = query.eq("sucursal_id", Number(sucursalId));
    }

    const { data, error } = await query.order("fecha_emision", {
      ascending: false,
    });

    if (error) throw new Error(error.message);

    const dataNormalizada = (data || []).map((f) => {
      const valorIva = Number(f.iva || 0);
      const valorOtros = Number(f.otros_impuestos || 0);
      const totalFactura = Number(f.total_factura || 0);
      const totalAbonos = Number(f.total_abonos || 0);
      const saldoPendiente = Number(f.saldo_pendiente ?? (totalFactura - totalAbonos));

      // Determinación dinámica de estado_pago
      let estadoPago = "PENDIENTE";
      if (saldoPendiente <= 0 && totalFactura > 0) {
        estadoPago = "PAGADA";
      } else if (totalAbonos > 0 && saldoPendiente < totalFactura) {
        estadoPago = "PARCIAL";
      }

      return {
        ...f,
        cliente_nombre: f.cliente_nombre || "Cliente Sin Nombre",
        cliente_nit: f.cliente_nit || "",
        impuestos: valorIva + valorOtros,
        total_abonos: totalAbonos,
        saldo_pendiente: saldoPendiente,
        estado_pago: estadoPago,
        cufe: f.cufe || f.cufe || null,
      };
    });

    return { success: true, data: dataNormalizada, error: null };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      error: err.message || "Error al obtener las facturas emitidas.",
    };
  }
}

/**
 * Obtiene el detalle de productos / servicios de una factura emitida
 */
export async function obtenerDetalleFacturaEmitida(facturaId: string | number) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const uuidFactura = String(facturaId).trim();

    const { data, error } = await supabaseAdmin
      .from("detalle_facturas_emitidas")
      .select(`
        id,
        factura_id,
        item_id,
        codigo_ref,
        nombre_item,
        cantidad,
        valor_unitario,
        subtotal,
        porcentaje_iva,
        valor_iva,
        total
      `)
      .eq("factura_id", uuidFactura)
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);

    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      error: err.message || "Error al consultar el detalle de la factura.",
    };
  }
}

/**
 * Obtiene la transacción y el detalle del asiento contable para FACTURAS_EMITIDAS
 */
export async function obtenerAsientoPorFactura(facturaId: string | number) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const uuidFactura = String(facturaId).trim();

    const { data: transaccion, error: errorTx } = await supabaseAdmin
      .from("transacciones")
      .select(`
        id,
        numero_documento,
        fecha_emision,
        fecha_contable,
        glosa_concepto,
        estado,
        clases_documento (
          codigo_clase,
          nombre_clase
        )
      `)
      .eq("modulo_origen", "FACTURAS_EMITIDAS")
      .eq("referencia_origen_id", uuidFactura)
      .maybeSingle();

    if (errorTx) throw new Error(errorTx.message);

    if (!transaccion) {
      return {
        success: false,
        data: null,
        error: `No se encontró un asiento contable en 'transacciones' asociado a la factura emitida ID ${uuidFactura}.`,
      };
    }

    const { data: detalles, error: errorDetalles } = await supabaseAdmin
      .from("detalle_transacciones")
      .select(`
        id,
        concepto_auxiliar_id,
        debito,
        credito,
        conceptos_auxiliares (
          codigo_auxiliar,
          nombre
        )
      `)
      .eq("transaccion_id", transaccion.id)
      .order("debito", { ascending: false })
      .order("id", { ascending: true });

    if (errorDetalles) throw new Error(errorDetalles.message);

    return {
      success: true,
      data: {
        transaccion: {
          ...transaccion,
          fecha_contable: transaccion.fecha_contable || transaccion.fecha_emision,
          fecha: transaccion.fecha_contable || transaccion.fecha_emision,
        },
        detalles: detalles || [],
      },
      error: null,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err.message || "Error al consultar el asiento contable.",
    };
  }
}