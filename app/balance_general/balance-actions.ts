"use server";

import { cookies } from "next/headers";
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
  empresaId?: number | string | null,
  sucursalId?: number | string | null,
  anio?: number | string | null,
  mes?: number | string | null,
  tipoReporte: "ACUMULADO" | "MES" = "ACUMULADO"
) {
  try {
    const cookieStore = await cookies();
    const idEmpresa = empresaId || cookieStore.get("empresa_activa")?.value;

    if (!idEmpresa) {
      return { success: false, data: [], error: "No se especificó la empresa o no hay sesión activa." };
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("obtener_balance_general", {
      p_empresa_id: Number(idEmpresa),
      p_sucursal_id: sucursalId ? Number(sucursalId) : null,
      p_anio: Number(anio),
      p_mes: Number(mes),
      p_tipo_reporte: tipoReporte,
    });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const mensajeError = err instanceof Error ? err.message : "Error desconocido al generar el balance general.";
    return { success: false, data: [], error: mensajeError };
  }
}