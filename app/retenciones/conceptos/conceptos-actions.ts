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

// 1. Obtener conceptos filtrados por empresa y año
export async function obtenerConceptosRetencion(empresaId: number | string, anio: number) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("conceptos_retencion")
      .select(`
        *,
        concepto_auxiliar:concepto_auxiliar_id (id, codigo_auxiliar, nombre),
        concepto_auxiliar_activo:concepto_auxiliar_activo_id (id, codigo_auxiliar, nombre)
      `)
      .eq("empresa_id", Number(empresaId))
      .eq("anio", Number(anio))
      .order("tipo_retencion", { ascending: true });

    if (error) throw error;
    return { success: true, data, error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

// 2. Guardar o actualizar un concepto para un año específico
export async function guardarConceptoRetencion(formData: {
  id?: number;
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
}) {
  try {
    const supabase = getSupabaseAdmin();

    const payload = {
      empresa_id: formData.empresa_id,
      anio: Number(formData.anio),
      tipo_retencion: formData.tipo_retencion,
      concepto: formData.concepto,
      base_minima: formData.base_minima,
      tarifa: formData.tarifa,
      concepto_auxiliar_id: formData.concepto_auxiliar_id ? Number(formData.concepto_auxiliar_id) : null,
      concepto_auxiliar_activo_id: formData.concepto_auxiliar_activo_id ? Number(formData.concepto_auxiliar_activo_id) : null,
      codigo_municipio: formData.codigo_municipio || null,
      activo: formData.activo
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
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3. Obtener auxiliares filtrados por elemento ('Pasivo' o 'Activo')
export async function obtenerAuxiliaresPorElemento(empresaId: number | string, elemento: "Pasivo" | "Activo") {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("conceptos_auxiliares")
      .select("id, codigo_auxiliar, nombre, elemento")
      .eq("empresa_id", Number(empresaId))
      .eq("elemento", elemento)
      .order("codigo_auxiliar", { ascending: true });

    if (error) throw error;
    return { success: true, data, error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

// 4. Copiar conceptos de un año anterior al nuevo año
export async function clonarConceptosAnioAnterior(empresaId: number | string, anioOrigen: number, anioDestino: number) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = Number(empresaId);

    // Verificar si el año destino ya tiene conceptos para no duplicar por error
    const { data: existentes } = await supabase
      .from("conceptos_retencion")
      .select("id")
      .eq("empresa_id", parsedEmpresaId)
      .eq("anio", anioDestino);

    if (existentes && existentes.length > 0) {
      return { success: false, error: `Ya existen conceptos creados para el año ${anioDestino}. No se puede realizar la clonación automática.` };
    }

    // Consultar conceptos del año origen
    const { data: origen, error: errOrigen } = await supabase
      .from("conceptos_retencion")
      .select("*")
      .eq("empresa_id", parsedEmpresaId)
      .eq("anio", anioOrigen);

    if (errOrigen) throw errOrigen;
    if (!origen || origen.length === 0) {
      return { success: false, error: `No se encontraron conceptos en el año ${anioOrigen} para clonar.` };
    }

    // Preparar nuevos registros cambiando únicamente el año
    const nuevosConceptos = origen.map((item: any) => {
      const { id, created_at, ...resto } = item;
      return {
        ...resto,
        anio: anioDestino
      };
    });

    const { error: errInsert } = await supabase
      .from("conceptos_retencion")
      .insert(nuevosConceptos);

    if (errInsert) throw errInsert;

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}