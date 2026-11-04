"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function obtenerEmpresas() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("empresas")
      .select("id, razon_social, nombre_comercial")
      .order("razon_social", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function obtenerSucursales(empresaId: number) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sucursales")
      .select("id, nombre, codigo_sucursal")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Obtiene el Estado de Resultados NIIF ejecutando la función RPC de Supabase.
 */
export async function obtenerEstadoResultados(
  empresaId: number,
  sucursalId: number | null,
  anio: number,
  mes: number,
  tipoReporte: "ACUMULADO" | "MES"
) {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc("obtener_estado_resultados", {
      p_empresa_id: empresaId,
      p_sucursal_id: sucursalId,
      p_anio: anio,
      p_mes: mes,
      p_tipo_reporte: tipoReporte,
    });

    if (error) {
      console.error("Error en RPC obtener_estado_resultados:", error.message);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error("Error inesperado en obtenerEstadoResultados:", err);
    return { success: false, error: err.message || "Error desconocido", data: [] };
  }
}