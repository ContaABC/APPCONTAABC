"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan las variables de entorno de Supabase.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function resolverEmpresaId(empresaId?: number | string | null): Promise<number> {
  if (empresaId) return Number(empresaId);
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
}

export async function obtenerClasesDocumentoServer(empresaId?: string | number) {
  try {
    const supabase = getSupabaseAdmin();
    const empIdNum = await resolverEmpresaId(empresaId);

    if (!empIdNum) {
      return { success: false, data: [], error: "Empresa no especificada." };
    }

    const { data, error } = await supabase
      .from("clases_documento")
      .select("*")
      .eq("empresa_id", empIdNum)
      .order("codigo_clase", { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message || "Error al obtener clases de documento." };
  }
}