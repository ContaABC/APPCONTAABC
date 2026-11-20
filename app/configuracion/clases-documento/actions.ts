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

export async function guardarClaseDocumentoServer(payload: {
  id?: string | number;
  empresaId?: string | number;
  codigo_clase: string;
  nombre_clase: string;
  descripcion?: string;
  activo?: boolean;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const empIdNum = await resolverEmpresaId(payload.empresaId);

    if (!empIdNum) {
      return { success: false, error: "Empresa no especificada." };
    }

    if (!payload.codigo_clase?.trim() || !payload.nombre_clase?.trim()) {
      return { success: false, error: "El código y el nombre de la clase son obligatorios." };
    }

    const registro: Record<string, any> = {
      empresa_id: empIdNum,
      codigo_clase: payload.codigo_clase.trim(),
      nombre_clase: payload.nombre_clase.trim(),
      descripcion: payload.descripcion?.trim() || null,
      activo: payload.activo !== undefined ? Boolean(payload.activo) : true,
    };

    if (payload.id) {
      const { data, error } = await supabase
        .from("clases_documento")
        .update(registro)
        .eq("id", payload.id)
        .eq("empresa_id", empIdNum)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, mensaje: "Clase de documento actualizada correctamente." };
    } else {
      const { data, error } = await supabase
        .from("clases_documento")
        .insert([registro])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, mensaje: "Clase de documento creada correctamente." };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Error al guardar la clase de documento." };
  }
}

export async function eliminarClaseDocumentoServer(id: string | number, empresaId?: string | number) {
  try {
    const supabase = getSupabaseAdmin();
    const empIdNum = await resolverEmpresaId(empresaId);

    let query = supabase.from("clases_documento").delete().eq("id", id);
    if (empIdNum) {
      query = query.eq("empresa_id", empIdNum);
    }

    const { error } = await query;
    if (error) throw error;

    return { success: true, mensaje: "Clase de documento eliminada correctamente." };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al eliminar la clase de documento." };
  }
}