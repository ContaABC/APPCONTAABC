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
    const rawEmpresa =
      empresaId !== undefined &&
      empresaId !== null &&
      String(empresaId).trim() !== ""
        ? empresaId
        : cookieStore.get("empresa_activa")?.value;

    const parsedEmpresaId = rawEmpresa ? Number(rawEmpresa) : 0;

    if (!parsedEmpresaId || Number.isNaN(parsedEmpresaId)) {
      return {
        success: false,
        data: [],
        error: "No se especificó la empresa o no hay sesión activa.",
      };
    }

    const parsedSucursalId =
      sucursalId !== undefined &&
      sucursalId !== null &&
      String(sucursalId).trim() !== "" &&
      !Number.isNaN(Number(sucursalId))
        ? Number(sucursalId)
        : null;

    const anioNum = anio ? Number(anio) : new Date().getFullYear();
    const mesNum = mes ? Number(mes) : new Date().getMonth() + 1;
    const parsedAnio = Number.isNaN(anioNum) ? new Date().getFullYear() : anioNum;
    const parsedMes = Number.isNaN(mesNum) ? new Date().getMonth() + 1 : mesNum;
    const parsedTipoReporte: "ACUMULADO" | "MES" =
      tipoReporte === "MES" ? "MES" : "ACUMULADO";

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("obtener_balance_general", {
      p_empresa_id: parsedEmpresaId,
      p_sucursal_id: parsedSucursalId,
      p_anio: parsedAnio,
      p_mes: parsedMes,
      p_tipo_reporte: parsedTipoReporte,
    });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const mensajeError =
      err instanceof Error
        ? err.message
        : "Error desconocido al generar el balance general.";
    return { success: false, data: [], error: mensajeError };
  }
}