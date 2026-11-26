"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan variables de entorno para Supabase.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TransaccionSistema {
  id: number;
  ruta_acceso: string;
  modulo: string;
  layout: string;
  es_modulo_padre: boolean;
  created_at?: string;
}

export interface GuardarTransaccionPayload {
  id?: number;
  ruta_acceso: string;
  modulo: string;
  layout: string;
  es_modulo_padre: boolean;
}

function normalizarRuta(ruta: string): string {
  const limpia = ruta.trim().replace(/\s+/g, "");
  if (!limpia) return "";
  const conSlash = limpia.startsWith("/") ? limpia : `/${limpia}`;
  return conSlash.length > 1 ? conSlash.replace(/\/+$/, "") : conSlash;
}

function normalizarModulo(modulo: string): string {
  return modulo.trim().toUpperCase();
}

export async function obtenerTransaccionesSistema(): Promise<{
  success: boolean;
  data: TransaccionSistema[];
  error: string | null;
}> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("transacciones_sistema")
      .select("id, ruta_acceso, modulo, layout, es_modulo_padre, created_at")
      .order("modulo", { ascending: true })
      .order("ruta_acceso", { ascending: true });

    if (error) throw error;
    return {
      success: true,
      data: (data || []) as TransaccionSistema[],
      error: null,
    };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error al obtener transacciones del sistema.";
    return { success: false, data: [], error: mensaje };
  }
}

export async function guardarTransaccionSistema(
  payload: GuardarTransaccionPayload
): Promise<{
  success: boolean;
  data?: TransaccionSistema;
  error: string | null;
}> {
  try {
    const rutaNormalizada = normalizarRuta(payload.ruta_acceso);
    const moduloNormalizado = normalizarModulo(payload.modulo);
    const layoutNormalizado = payload.layout.trim();

    if (!rutaNormalizada) {
      return {
        success: false,
        error: "La ruta de acceso es obligatoria.",
      };
    }
    if (!moduloNormalizado) {
      return {
        success: false,
        error: "El módulo es obligatorio.",
      };
    }
    if (!layoutNormalizado) {
      return {
        success: false,
        error: "El layout es obligatorio.",
      };
    }

    const supabase = getSupabaseAdmin();

    // Validar duplicado en ruta_acceso (restricción unique)
    let dupQuery = supabase
      .from("transacciones_sistema")
      .select("id, ruta_acceso, modulo")
      .eq("ruta_acceso", rutaNormalizada);

    if (payload.id) {
      dupQuery = dupQuery.neq("id", payload.id);
    }

    const { data: existente, error: errDup } = await dupQuery.maybeSingle();
    if (errDup) throw errDup;

    if (existente) {
      return {
        success: false,
        error: `Ya existe una transacción registrada con la ruta "${rutaNormalizada}" (Módulo: ${existente.modulo}).`,
      };
    }

    const registro = {
      ruta_acceso: rutaNormalizada,
      modulo: moduloNormalizado,
      layout: layoutNormalizado,
      es_modulo_padre: Boolean(payload.es_modulo_padre),
    };

    if (payload.id) {
      const { data, error } = await supabase
        .from("transacciones_sistema")
        .update(registro)
        .eq("id", payload.id)
        .select("id, ruta_acceso, modulo, layout, es_modulo_padre, created_at")
        .single();

      if (error) throw error;
      return {
        success: true,
        data: data as TransaccionSistema,
        error: null,
      };
    }

    const { data, error } = await supabase
      .from("transacciones_sistema")
      .insert(registro)
      .select("id, ruta_acceso, modulo, layout, es_modulo_padre, created_at")
      .single();

    if (error) throw error;
    return {
      success: true,
      data: data as TransaccionSistema,
      error: null,
    };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error al guardar la transacción del sistema.";
    return { success: false, error: mensaje };
  }
}

export async function eliminarTransaccionSistema(id: number): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    if (!id) {
      return { success: false, error: "ID de transacción no válido." };
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("transacciones_sistema")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error al eliminar la transacción del sistema.";
    return { success: false, error: mensaje };
  }
}