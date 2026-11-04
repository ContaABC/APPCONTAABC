"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
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
 * Obtiene el listado de facturas recibidas (incluye fecha_emision)
 */
export async function obtenerFacturasRecibidas(empresaId: number | string, sucursalId?: number | string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const parsedEmpresaId = Number(empresaId);

    if (!parsedEmpresaId) {
      return { success: false, data: [], error: "Debe seleccionar una empresa válida." };
    }

    let query = supabaseAdmin
      .from("facturas_recibidas")
      .select(`
        id,
        numero_factura,
        tercero_nit,
        tercero_nombre,
        fecha_emision,
        fecha_vencimiento,
        subtotal,
        impuestos,
        total_factura,
        saldo_pendiente,
        estado_pago,
        estado_dian,
        cufe_cude
      `)
      .eq("empresa_id", parsedEmpresaId);

    if (sucursalId && Number(sucursalId) > 0) {
      query = query.eq("sucursal_id", Number(sucursalId));
    }

    const { data, error } = await query.order("fecha_emision", { ascending: false });

    if (error) throw new Error(error.message);

    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message || "Error al obtener las facturas." };
  }
}

/**
 * Obtiene la transacción y el detalle del asiento contable
 * (Ordenado visualmente: primero Débitos, luego Créditos)
 */
export async function obtenerAsientoPorFactura(facturaId: string | number) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const uuidFactura = String(facturaId).trim();

    // 1. Buscar la transacción en transacciones
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
      .eq("modulo_origen", "FACTURAS_RECIBIDAS")
      .eq("referencia_origen_id", uuidFactura)
      .maybeSingle();

    if (errorTx) throw new Error(errorTx.message);

    if (!transaccion) {
      return { 
        success: false, 
        data: null, 
        error: `No se encontró un asiento contable en 'transacciones' asociado a la factura ID ${uuidFactura}.` 
      };
    }

    // 2. Traer el detalle ordenando estrictamente: Débitos primero, Créditos después
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
      .order("debito", { ascending: false }) // <--- Ordena para poner los débitos arriba
      .order("id", { ascending: true });      // <--- Mantiene el orden secundario por ID

    if (errorDetalles) throw new Error(errorDetalles.message);

    return {
      success: true,
      data: {
        transaccion: {
          ...transaccion,
          fecha_contable: transaccion.fecha_contable || transaccion.fecha_emision,
          fecha: transaccion.fecha_contable || transaccion.fecha_emision
        },
        detalles: detalles || [],
      },
      error: null,
    };
  } catch (err: any) {
    return { success: false, data: null, error: err.message || "Error al consultar el asiento." };
  }
}