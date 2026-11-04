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

/**
 * Obtener listado completo de empresas ordenadas alfabéticamente por razon_social
 */
export async function obtenerEmpresas() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("empresas")
      .select("*")
      .order("razon_social", { ascending: true });

    if (error) throw new Error(error.message);

    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    console.error("Error consultando empresas:", err);
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Obtener sucursales filtradas por empresa_id y ordenadas por codigo_sucursal
 */
export async function obtenerSucursales(empresaId: number | string) {
  try {
    const supabase = getSupabaseAdmin();
    const empId = Number(empresaId);
    if (!empId) return { success: true, data: [], error: null };

    const { data, error } = await supabase
      .from("sucursales")
      .select("*")
      .eq("empresa_id", empId)
      .order("codigo_sucursal", { ascending: true });

    if (error) throw new Error(error.message);

    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    console.error("Error consultando sucursales:", err);
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Obtener notas a facturas emitidas por empresa y sucursal
 */
export async function obtenerNotasEmitidas(
  empresaId: number | string,
  sucursalId?: number | string
) {
  try {
    const supabase = getSupabaseAdmin();
    const empId = empresaId ? +empresaId : 0;
    if (!empId) return { success: true, data: [], error: null };

    let query = supabase
      .from("notas_facturas_emitidas")
      .select(`
        *,
        facturas_emitidas (
          id,
          numero_factura,
          total_factura,
          saldo_pendiente,
          estado_factura,
          cliente_id,
          cliente_nit,
          cliente_nombre
        )
      `)
      .eq("empresa_id", empId)
      .order("fecha_emision", { ascending: false });

    if (sucursalId && sucursalId !== "") {
      query = query.eq("sucursal_id", +sucursalId);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    console.error("Error consultando notas emitidas:", err);
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Obtener el detalle del asiento contable generado para una nota, ordenado por débitos y luego créditos
 */
export async function obtenerAsientoPorNota(notaId: string) {
  try {
    const supabase = getSupabaseAdmin();

    const { data: transaccion, error: errTrans } = await supabase
      .from("transacciones")
      .select("*")
      .eq("referencia_origen_id", notaId)
      .maybeSingle();

    if (errTrans) throw new Error(errTrans.message);
    if (!transaccion) {
      return { success: false, data: null, error: "No se encontró el registro contable de la nota." };
    }

    const { data: detallesRaw, error: errDetalles } = await supabase
      .from("detalle_transacciones")
      .select("id, transaccion_id, concepto_auxiliar_id, tercero_id, cuenta_financiera_id, debito, credito")
      .eq("transaccion_id", transaccion.id);

    if (errDetalles) throw new Error(errDetalles.message);

    const detalles = detallesRaw || [];

    const auxiliarIds = Array.from(
      new Set(detalles.map((d: any) => d.concepto_auxiliar_id).filter(Boolean))
    );

    let conceptosMap: { [key: number]: { codigo: string; nombre: string } } = {};
    if (auxiliarIds.length > 0) {
      const { data: conceptosData } = await supabase
        .from("conceptos_auxiliares")
        .select("id, codigo, nombre")
        .in("id", auxiliarIds);

      if (conceptosData) {
        conceptosData.forEach((c: any) => {
          conceptosMap[c.id] = { codigo: c.codigo, nombre: c.nombre };
        });
      }
    }

    // Mapear y ordenar correctamente sin errores de tipado
    const detallesConConceptos = detalles
      .map((d: any) => ({
        ...d,
        conceptos_auxiliares: d.concepto_auxiliar_id ? conceptosMap[d.concepto_auxiliar_id] || null : null,
      }))
      .sort((a: any, b: any) => {
        const debA = Number(a.debito || 0);
        const debB = Number(b.debito || 0);
        const credA = Number(a.credito || 0);
        const credB = Number(b.credito || 0);

        // Si A tiene débito y B no, A va primero (-1)
        if (debA > 0 && debB === 0) return -1;
        if (debA === 0 && debB > 0) return 1;

        // Si ambos tienen débito, ordenar de mayor a menor débito
        if (debA > 0 && debB > 0) return debB - debA;

        // Si ambos tienen crédito, ordenar de mayor a menor crédito
        return credB - credA;
      });

    return {
      success: true,
      data: {
        transaccion,
        detalles: detallesConConceptos,
      },
      error: null,
    };
  } catch (err: any) {
    return { success: false, data: null, error: err.message };
  }
}