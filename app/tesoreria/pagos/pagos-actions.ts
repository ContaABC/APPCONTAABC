"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 1. Obtener datos auxiliares
export async function obtenerDatosAuxiliaresPago(empresaId: number | string) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = Number(empresaId);
    
    const [clasesRes, cuentasRes, retencionesRes, conceptosAuxRes] = await Promise.all([
      supabase.from("clases_documento").select("id, nombre_clase").eq("empresa_id", parsedEmpresaId).order("nombre_clase"),
      supabase.from("cuentas_financieras").select("id, nombre_cuenta, numero_cuenta, concepto_auxiliar_id").eq("empresa_id", parsedEmpresaId),
      supabase.from("conceptos_retencion")
        .select("id, tipo_retencion, concepto, tarifa, base_minima, empresa_id")
        .or(`empresa_id.eq.${parsedEmpresaId},empresa_id.is.null`)
        .eq("activo", true)
        .order("concepto"),
      supabase.from("conceptos_auxiliares").select("id, codigo_auxiliar, nombre, tipo_entidad").eq("empresa_id", parsedEmpresaId).order("codigo_auxiliar")
    ]);

    const retencionesMapeadas = (retencionesRes.data || []).map((r: any) => ({
      id: r.id,
      tipo_retencion: r.tipo_retencion,
      nombre: r.concepto,
      porcentaje: r.tarifa,
      base_minima: Number(r.base_minima || 0),
    }));

    const conceptosUnicos = Array.from(
      new Map((conceptosAuxRes.data || []).map((item: any) => [item.id, item])).values()
    );

    return {
      success: true,
      clasesDocumento: clasesRes.data || [],
      cuentasFinancieras: cuentasRes.data || [],
      conceptosRetencion: retencionesMapeadas,
      conceptosAuxiliares: conceptosUnicos,
      error: null,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 1.1 Obtener conceptos auxiliares filtrados según la forma de pago seleccionada
export async function obtenerConceptosAuxiliaresPorFormaPago(
  empresaId: number | string,
  formaPago: string
) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = Number(empresaId);
    const forma = (formaPago || "").trim().toLowerCase();

    let tipoEntidadFiltro = "";
    if (forma === "efectivo") {
      tipoEntidadFiltro = "Cuentas_Caja";
    } else if (forma === "transferencia / consignación" || forma === "cheque" || forma === "transferencia") {
      tipoEntidadFiltro = "Cuentas_Bancarias";
    }

    let query = supabase
      .from("conceptos_auxiliares")
      .select("id, codigo_auxiliar, nombre, tipo_entidad")
      .eq("empresa_id", parsedEmpresaId);

    if (tipoEntidadFiltro) {
      query = query.eq("tipo_entidad", tipoEntidadFiltro);
    }

    const { data, error } = await query.order("codigo_auxiliar");

    if (error) throw error;

    const conceptosUnicos = Array.from(
      new Map((data || []).map((item: any) => [item.id, item])).values()
    );

    return { success: true, conceptosAuxiliares: conceptosUnicos, error: null };
  } catch (err: any) {
    return { success: false, conceptosAuxiliares: [], error: err.message };
  }
}

// 2. Obtener proveedores con saldo pendiente
export async function obtenerProveedoresConSaldo(empresaId: number | string, sucursalId?: number | string) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = Number(empresaId);
    
    let query = supabase
      .from("facturas_recibidas")
      .select("tercero_id, tercero_nit, tercero_nombre")
      .eq("empresa_id", parsedEmpresaId)
      .gt("saldo_pendiente", 0);

    if (sucursalId && sucursalId !== "" && String(sucursalId) !== "0") {
      query = query.eq("sucursal_id", Number(sucursalId));
    }

    const { data, error } = await query;

    if (error) throw error;

    const map = new Map();
    (data || []).forEach((item: any) => {
      if (item.tercero_id) {
        map.set(item.tercero_id, {
          id: item.tercero_id,
          razon_social: item.tercero_nombre,
          numero_identificacion: item.tercero_nit,
        });
      }
    });

    const proveedoresUnicos = Array.from(map.values()).sort((a: any, b: any) =>
      String(a.razon_social || "").localeCompare(String(b.razon_social || ""))
    );

    return { success: true, data: proveedoresUnicos, error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

// 3. Obtener facturas pendientes y sus notas asociadas de un proveedor específico
export async function obtenerFacturasPendientes(empresaId: number | string, sucursalId?: number | string, terceroId?: number | string) {
  try {
    const supabase = getSupabaseAdmin();
    
    if (!terceroId) {
      return { success: true, data: [], error: null };
    }

    const parsedEmpresaId = Number(empresaId);
    const parsedTerceroId = Number(terceroId);

    let query = supabase
      .from("facturas_recibidas")
      .select(`
        id,
        numero_factura,
        tercero_id,
        tercero_nit,
        tercero_nombre,
        sucursal_id,
        subtotal,
        impuestos,
        total_factura,
        saldo_pendiente,
        fecha_vencimiento,
        notas_facturas_recibidas (
          id,
          tipo_nota,
          numero_nota,
          monto_total,
          motivo
        )
      `)
      .eq("empresa_id", parsedEmpresaId)
      .eq("tercero_id", parsedTerceroId)
      .gt("saldo_pendiente", 0);

    if (sucursalId && sucursalId !== "" && String(sucursalId) !== "0") {
      query = query.eq("sucursal_id", Number(sucursalId));
    }

    const { data, error } = await query.order("fecha_vencimiento", { ascending: true });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    const facturasMapeadas = (data || []).map((f: any) => ({
      ...f,
      tercero: {
        id: f.tercero_id,
        razon_social: f.tercero_nombre,
        numero_identificacion: f.tercero_nit,
      },
      notas: f.notas_facturas_recibidas || []
    }));

    return { success: true, data: facturasMapeadas, error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

// 4. Ejecutar el RPC de pago unificado en Supabase
export async function ejecutarPagoFacturas(payload: {
  empresa_id: number;
  sucursal_id: number;
  clase_documento_id: number;
  fecha_contable: string;
  glosa_concepto: string;
  cuenta_financiera_id: number | null;
  forma_pago: string;
  concepto_auxiliar_id: number | null;
  pagos_json: any[];
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("procesar_pago_facturas_proveedor", {
      p_empresa_id: payload.empresa_id,
      p_sucursal_id: payload.sucursal_id,
      p_clase_documento_id: payload.clase_documento_id,
      p_fecha_contable: payload.fecha_contable,
      p_glosa_concepto: payload.glosa_concepto,
      p_cuenta_financiera_id: payload.cuenta_financiera_id,
      p_forma_pago: payload.forma_pago,
      p_concepto_auxiliar_id: payload.concepto_auxiliar_id ? Number(payload.concepto_auxiliar_id) : null,
      p_pagos_json: payload.pagos_json,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.success) {
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}