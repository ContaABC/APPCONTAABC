"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan variables de entorno de Supabase.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function obtenerBalanceGeneral(
  empresaId: number,
  sucursalId: number | null,
  anio: number,
  mes: number,
  tipoReporte: "ACUMULADO" | "MES"
) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("obtener_balance_general", {
      p_empresa_id: Number(empresaId),
      p_sucursal_id: sucursalId ? Number(sucursalId) : null,
      p_anio: Number(anio),
      p_mes: Number(mes),
      p_tipo_reporte: tipoReporte,
    });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}