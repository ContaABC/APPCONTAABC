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
    const mensajeError = err instanceof Error ? err.message : "Error desconocido al obtener empresas.";
    return { success: false, data: [], error: mensajeError };
  }
}

export async function obtenerSucursales(empresaId?: number | string | null) {
  try {
    const cookieStore = await cookies();
    const idEmpresa = empresaId || cookieStore.get("empresa_activa")?.value;

    if (!idEmpresa) {
      return { success: true, data: [], error: null };
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sucursales")
      .select("id, nombre, codigo_sucursal")
      .eq("empresa_id", Number(idEmpresa))
      .order("nombre", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const mensajeError = err instanceof Error ? err.message : "Error desconocido al obtener sucursales.";
    return { success: false, data: [], error: mensajeError };
  }
}