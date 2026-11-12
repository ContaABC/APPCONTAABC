"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolverEmpresaId(empresaId?: number | string | null): Promise<number> {
  if (empresaId) return Number(empresaId);
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
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
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al obtener empresas.";
    return { success: false, data: [], error: mensaje };
  }
}

export async function obtenerSucursales(empresaId?: number | string | null) {
  try {
    const idEmpresa = await resolverEmpresaId(empresaId);
    if (!idEmpresa) return { success: true, data: [], error: null };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sucursales")
      .select("id, nombre, codigo_sucursal")
      .eq("empresa_id", idEmpresa)
      .order("nombre", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al obtener sucursales.";
    return { success: false, data: [], error: mensaje };
  }
}

/**
 * Obtiene el Estado de Resultados NIIF ejecutando la función RPC de Supabase.
 */
export async function obtenerEstadoResultados(
  empresaId?: number | string | null,
  sucursalId?: number | string | null,
  anio?: number | string | null,
  mes?: number | string | null,
  tipoReporte?: "ACUMULADO" | "MES"
) {
  const supabase = getSupabaseAdmin();
  const idEmpresa = await resolverEmpresaId(empresaId);
  const parsedSucursalId = sucursalId ? Number(sucursalId) : null;
  const parsedAnio = anio ? Number(anio) : new Date().getFullYear();
  const parsedMes = mes ? Number(mes) : new Date().getMonth() + 1;
  const parsedTipoReporte = tipoReporte || "ACUMULADO";

  try {
    if (!idEmpresa) throw new Error("Debe especificar o tener activa una empresa válida.");

    const { data, error } = await supabase.rpc("obtener_estado_resultados", {
      p_empresa_id: idEmpresa,
      p_sucursal_id: parsedSucursalId,
      p_anio: parsedAnio,
      p_mes: parsedMes,
      p_tipo_reporte: parsedTipoReporte,
    });

    if (error) {
      console.error("Error en RPC obtener_estado_resultados:", error.message);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al obtener el estado de resultados.";
    console.error("Error inesperado en obtenerEstadoResultados:", mensaje);
    return { success: false, error: mensaje, data: [] };
  }
}