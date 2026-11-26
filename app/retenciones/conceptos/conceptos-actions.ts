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

async function resolverEmpresaId(
  empresaId?: number | string | null
): Promise<number> {
  if (
    empresaId !== undefined &&
    empresaId !== null &&
    String(empresaId).trim() !== "" &&
    String(empresaId).trim() !== "0"
  ) {
    const parsed = Number(empresaId);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  const parsedCookie = Number(idCookie || 0);
  return Number.isNaN(parsedCookie) ? 0 : parsedCookie;
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
export async function obtenerConceptosRetencion(
  empresaId: number | string | null | undefined,
  anio: number
) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    const parsedAnio = Number(anio);

    if (!parsedEmpresaId || Number.isNaN(parsedAnio)) {
      return {
        success: true,
        data: [] as ConceptoRetencionRow[],
        error: null,
      };
    }

    const { data, error } = await supabase
      .from("conceptos_retencion")
      .select(`
        *,
        concepto_auxiliar:concepto_auxiliar_id (id, codigo_auxiliar, nombre),
        concepto_auxiliar_activo:concepto_auxiliar_activo_id (id, codigo_auxiliar, nombre)
      `)
      .eq("empresa_id", parsedEmpresaId)
      .eq("anio", parsedAnio)
      .order("tipo_retencion", { ascending: true });

    if (error) throw error;
    return {
      success: true,
      data: (data || []) as ConceptoRetencionRow[],
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: [] as ConceptoRetencionRow[],
      error: errorMsg,
    };
  }
}

// 2. Guardar o actualizar un concepto para un año específico
export async function guardarConceptoRetencion(
  formData: GuardarConceptoPayload
) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(formData.empresa_id);

    if (!parsedEmpresaId) {
      return {
        success: false,
        error: "No se pudo determinar la empresa activa.",
      };
    }

    if (!formData.concepto || !formData.concepto.trim()) {
      return {
        success: false,
        error: "Debe ingresar el nombre o descripción del concepto.",
      };
    }

    const parsedAnio = Number(formData.anio);
    if (!parsedAnio || Number.isNaN(parsedAnio)) {
      return {
        success: false,
        error: "Debe especificar un año válido.",
      };
    }

    const payload = {
      empresa_id: parsedEmpresaId,
      anio: parsedAnio,
      tipo_retencion: formData.tipo_retencion,
      concepto: formData.concepto.trim(),
      base_minima: Number(formData.base_minima || 0),
      tarifa: Number(formData.tarifa || 0),
      concepto_auxiliar_id: formData.concepto_auxiliar_id
        ? Number(formData.concepto_auxiliar_id)
        : null,
      concepto_auxiliar_activo_id: formData.concepto_auxiliar_activo_id
        ? Number(formData.concepto_auxiliar_activo_id)
        : null,
      codigo_municipio: formData.codigo_municipio?.trim() || null,
      activo: Boolean(formData.activo),
    };

    let res;
    if (formData.id) {
      res = await supabase
        .from("conceptos_retencion")
        .update(payload)
        .eq("id", Number(formData.id))
        .eq("empresa_id", parsedEmpresaId);
    } else {
      res = await supabase.from("conceptos_retencion").insert([payload]);
    }

    if (res.error) throw res.error;
    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

// 3. Obtener auxiliares filtrados por elemento ('Pasivo' o 'Activo')
export async function obtenerAuxiliaresPorElemento(
  empresaId: number | string | null | undefined,
  elemento: "Pasivo" | "Activo"
) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return {
        success: true,
        data: [] as ConceptoAuxiliarInfo[],
        error: null,
      };
    }

    const { data, error } = await supabase
      .from("conceptos_auxiliares")
      .select("id, codigo_auxiliar, nombre, elemento")
      .eq("empresa_id", parsedEmpresaId)
      .eq("elemento", elemento)
      .order("codigo_auxiliar", { ascending: true });

    if (error) throw error;
    return {
      success: true,
      data: (data || []) as ConceptoAuxiliarInfo[],
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: [] as ConceptoAuxiliarInfo[],
      error: errorMsg,
    };
  }
}

// 4. Clonar conceptos de un año anterior al nuevo año
export async function clonarConceptosAnioAnterior(
  empresaId: number | string | null | undefined,
  anioOrigen: number,
  anioDestino: number
) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    const parsedOrigen = Number(anioOrigen);
    const parsedDestino = Number(anioDestino);

    if (!parsedEmpresaId) {
      return {
        success: false,
        error: "No se pudo determinar la empresa activa.",
      };
    }

    if (
      !parsedOrigen ||
      !parsedDestino ||
      Number.isNaN(parsedOrigen) ||
      Number.isNaN(parsedDestino)
    ) {
      return {
        success: false,
        error: "Los años de origen y destino deben ser válidos.",
      };
    }

    const { data: existentes } = await supabase
      .from("conceptos_retencion")
      .select("id")
      .eq("empresa_id", parsedEmpresaId)
      .eq("anio", parsedDestino);

    if (existentes && existentes.length > 0) {
      return {
        success: false,
        error: `Ya existen conceptos creados para el año ${parsedDestino}. No se puede realizar la clonación automática.`,
      };
    }

    const { data: origen, error: errOrigen } = await supabase
      .from("conceptos_retencion")
      .select(
        "tipo_retencion, concepto, base_minima, tarifa, concepto_auxiliar_id, concepto_auxiliar_activo_id, codigo_municipio, activo"
      )
      .eq("empresa_id", parsedEmpresaId)
      .eq("anio", parsedOrigen);

    if (errOrigen) throw errOrigen;
    if (!origen || origen.length === 0) {
      return {
        success: false,
        error: `No se encontraron conceptos en el año ${parsedOrigen} para clonar.`,
      };
    }

    const nuevosConceptos = origen.map((item) => ({
      empresa_id: parsedEmpresaId,
      anio: parsedDestino,
      tipo_retencion: item.tipo_retencion,
      concepto: item.concepto,
      base_minima: Number(item.base_minima || 0),
      tarifa: Number(item.tarifa || 0),
      concepto_auxiliar_id: item.concepto_auxiliar_id
        ? Number(item.concepto_auxiliar_id)
        : null,
      concepto_auxiliar_activo_id: item.concepto_auxiliar_activo_id
        ? Number(item.concepto_auxiliar_activo_id)
        : null,
      codigo_municipio: item.codigo_municipio || null,
      activo: Boolean(item.activo),
    }));

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
// 5. Copiar conceptos desde la empresa activa (origen) hacia otra empresa asignada (destino), sin cuentas auxiliares
export async function copiarConceptosRetencion(params: {
  empresaOrigenId?: number | string | null;
  empresaDestinoId: number | string;
  anioOrigen: number;
  anioDestino: number;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedOrigenEmpresa = await resolverEmpresaId(
      params.empresaOrigenId
    );
    const parsedDestinoEmpresa = Number(params.empresaDestinoId);
    const parsedAnioOrigen = Number(params.anioOrigen);
    const parsedAnioDestino = Number(params.anioDestino);

    if (
      !parsedOrigenEmpresa ||
      Number.isNaN(parsedOrigenEmpresa) ||
      !parsedDestinoEmpresa ||
      Number.isNaN(parsedDestinoEmpresa)
    ) {
      return {
        success: false,
        error:
          "Debe especificar una empresa de origen (activa) y una empresa de destino válidas.",
      };
    }

    if (parsedOrigenEmpresa === parsedDestinoEmpresa) {
      return {
        success: false,
        error:
          "La empresa de destino debe ser distinta de la empresa activa de origen.",
      };
    }

    if (
      !parsedAnioOrigen ||
      !parsedAnioDestino ||
      Number.isNaN(parsedAnioOrigen) ||
      Number.isNaN(parsedAnioDestino)
    ) {
      return {
        success: false,
        error: "Debe especificar años de origen y destino válidos.",
      };
    }

    const { data: origen, error: errOrigen } = await supabase
      .from("conceptos_retencion")
      .select(
        "tipo_retencion, concepto, base_minima, tarifa, codigo_municipio, activo"
      )
      .eq("empresa_id", parsedOrigenEmpresa)
      .eq("anio", parsedAnioOrigen);

    if (errOrigen) throw errOrigen;

    if (!origen || origen.length === 0) {
      return {
        success: false,
        error: `No se encontraron conceptos en la empresa activa para el año ${parsedAnioOrigen}.`,
      };
    }

    const { data: existentesDestino, error: errExist } = await supabase
      .from("conceptos_retencion")
      .select("tipo_retencion, concepto, codigo_municipio")
      .eq("empresa_id", parsedDestinoEmpresa)
      .eq("anio", parsedAnioDestino);

    if (errExist) throw errExist;

    const clavesExistentes = new Set(
      (existentesDestino || []).map(
        (row) =>
          `${row.tipo_retencion}||${String(row.concepto || "")
            .trim()
            .toLowerCase()}||${String(row.codigo_municipio || "").trim()}`
      )
    );

    const aInsertar = origen
      .filter((item) => {
        const clave = `${item.tipo_retencion}||${String(item.concepto || "")
          .trim()
          .toLowerCase()}||${String(item.codigo_municipio || "").trim()}`;
        return !clavesExistentes.has(clave);
      })
      .map((item) => ({
        empresa_id: parsedDestinoEmpresa,
        anio: parsedAnioDestino,
        tipo_retencion: item.tipo_retencion,
        concepto: item.concepto,
        base_minima: Number(item.base_minima || 0),
        tarifa: Number(item.tarifa || 0),
        concepto_auxiliar_id: null,
        concepto_auxiliar_activo_id: null,
        codigo_municipio: item.codigo_municipio || null,
        activo: Boolean(item.activo),
      }));

    if (aInsertar.length === 0) {
      return {
        success: false,
        error: `Todos los conceptos del año ${parsedAnioOrigen} ya existen en la empresa destino para el año ${parsedAnioDestino}.`,
      };
    }

    const { error: errInsert } = await supabase
      .from("conceptos_retencion")
      .insert(aInsertar);

    if (errInsert) throw errInsert;

    return {
      success: true,
      copiados: aInsertar.length,
      omitidos: origen.length - aInsertar.length,
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}