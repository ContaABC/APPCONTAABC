"use server";

import { cookies } from "next/headers";
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

async function resolverEmpresaId(empresaId?: number | string | null): Promise<number> {
  if (empresaId && String(empresaId) !== "0" && String(empresaId) !== "") {
    return Number(empresaId);
  }
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
}

export interface ConceptoAuxiliarInfo {
  id: number;
  codigo_auxiliar?: string;
  nombre?: string;
  elemento?: string;
}

export interface ConceptoRetencionRow {
  id: number;
  empresa_id: number;
  anio: number;
  tipo_retencion: "RENTA" | "IVA" | "ICA";
  concepto: string;
  base_minima: number;
  tarifa: number;
  concepto_auxiliar_id: number | null;
  concepto_auxiliar_activo_id: number | null;
  codigo_municipio?: string | null;
  activo: boolean;
  concepto_auxiliar?: ConceptoAuxiliarInfo | null;
  concepto_auxiliar_activo?: ConceptoAuxiliarInfo | null;
}

export interface GuardarConceptoPayload {
  id?: number;
  empresa_id?: number | string | null;
  anio: number;
  tipo_retencion: "RENTA" | "IVA" | "ICA";
  concepto: string;
  base_minima: number;
  tarifa: number;
  concepto_auxiliar_id: number | null;
  concepto_auxiliar_activo_id: number | null;
  codigo_municipio?: string | null;
  activo: boolean;
}

// 1. Obtener conceptos filtrados por empresa y año
export async function obtenerConceptosRetencion(empresaId: number | string | null | undefined, anio: number) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return { success: true, data: [] as ConceptoRetencionRow[], error: null };
    }

    const { data, error } = await supabase
      .from("conceptos_retencion")
      .select(`
        *,
        concepto_auxiliar:concepto_auxiliar_id (id, codigo_auxiliar, nombre),
        concepto_auxiliar_activo:concepto_auxiliar_activo_id (id, codigo_auxiliar, nombre)
      `)
      .eq("empresa_id", parsedEmpresaId)
      .eq("anio", Number(anio))
      .order("tipo_retencion", { ascending: true });

    if (error) throw error;
    return { success: true, data: (data || []) as ConceptoRetencionRow[], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, data: [] as ConceptoRetencionRow[], error: errorMsg };
  }
}

// 2. Guardar o actualizar un concepto para un año específico
export async function guardarConceptoRetencion(formData: GuardarConceptoPayload) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(formData.empresa_id);

    if (!parsedEmpresaId) {
      return { success: false, error: "No se pudo determinar la empresa activa." };
    }

    const payload = {
      empresa_id: parsedEmpresaId,
      anio: Number(formData.anio),
      tipo_retencion: formData.tipo_retencion,
      concepto: formData.concepto,
      base_minima: Number(formData.base_minima || 0),
      tarifa: Number(formData.tarifa || 0),
      concepto_auxiliar_id: formData.concepto_auxiliar_id ? Number(formData.concepto_auxiliar_id) : null,
      concepto_auxiliar_activo_id: formData.concepto_auxiliar_activo_id ? Number(formData.concepto_auxiliar_activo_id) : null,
      codigo_municipio: formData.codigo_municipio || null,
      activo: Boolean(formData.activo)
    };

    let res;
    if (formData.id) {
      res = await supabase
        .from("conceptos_retencion")
        .update(payload)
        .eq("id", formData.id);
    } else {
      res = await supabase
        .from("conceptos_retencion")
        .insert([payload]);
    }

    if (res.error) throw res.error;
    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

// 3. Obtener auxiliares filtrados por elemento ('Pasivo' o 'Activo')
export async function obtenerAuxiliaresPorElemento(empresaId: number | string | null | undefined, elemento: "Pasivo" | "Activo") {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return { success: true, data: [] as ConceptoAuxiliarInfo[], error: null };
    }

    const { data, error } = await supabase
      .from("conceptos_auxiliares")
      .select("id, codigo_auxiliar, nombre, elemento")
      .eq("empresa_id", parsedEmpresaId)
      .eq("elemento", elemento)
      .order("codigo_auxiliar", { ascending: true });

    if (error) throw error;
    return { success: true, data: (data || []) as ConceptoAuxiliarInfo[], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, data: [] as ConceptoAuxiliarInfo[], error: errorMsg };
  }
}

// 4. Clonar conceptos de un año anterior al nuevo año
export async function clonarConceptosAnioAnterior(empresaId: number | string | null | undefined, anioOrigen: number, anioDestino: number) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return { success: false, error: "No se pudo determinar la empresa activa." };
    }

    // Verificar si el año destino ya tiene conceptos para no duplicar por error
    const { data: existentes } = await supabase
      .from("conceptos_retencion")
      .select("id")
      .eq("empresa_id", parsedEmpresaId)
      .eq("anio", Number(anioDestino));

    if (existentes && existentes.length > 0) {
      return { success: false, error: `Ya existen conceptos creados para el año ${anioDestino}. No se puede realizar la clonación automática.` };
    }

    // Consultar conceptos del año origen
    const { data: origen, error: errOrigen } = await supabase
      .from("conceptos_retencion")
      .select("*")
      .eq("empresa_id", parsedEmpresaId)
      .eq("anio", Number(anioOrigen));

    if (errOrigen) throw errOrigen;
    if (!origen || origen.length === 0) {
      return { success: false, error: `No se encontraron conceptos en el año ${anioOrigen} para clonar.` };
    }

    interface ConceptoRaw {
      id?: number;
      created_at?: string;
      [key: string]: unknown;
    }

    // Preparar nuevos registros cambiando únicamente el año
    const nuevosConceptos = (origen as ConceptoRaw[]).map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, ...resto } = item;
      return {
        ...resto,
        empresa_id: parsedEmpresaId,
        anio: Number(anioDestino)
      };
    });

    const { error: errInsert } = await supabase
      .from("conceptos_retencion")
      .insert(nuevosConceptos);

    if (errInsert) throw errInsert;

    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}