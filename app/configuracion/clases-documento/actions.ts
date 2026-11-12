"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function resolverEmpresaId(empresaId?: number | string | null): Promise<number> {
  if (empresaId) return Number(empresaId);
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
}

export async function obtenerEmpresasAsignacion() {
  try {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, razon_social, nombre_comercial, nit_identificacion, dv")
      .order("razon_social", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al obtener empresas.";
    return { success: false, error: mensaje, data: [] };
  }
}

export async function obtenerCatalogosPorEmpresa(empresaId?: number | string | null) {
  try {
    const idEmpresa = await resolverEmpresaId(empresaId);
    if (!idEmpresa) return { success: false, error: "No se encontró empresa activa.", clases: [], conceptos: [] };

    const [resClases, resConceptos] = await Promise.all([
      supabase
        .from("clases_documento")
        .select("*")
        .eq("empresa_id", idEmpresa)
        .order("nombre_clase", { ascending: true }),
      supabase
        .from("conceptos_auxiliares")
        .select("id, codigo_auxiliar, nombre, elemento")
        .eq("empresa_id", idEmpresa)
        .order("codigo_auxiliar", { ascending: true })
    ]);

    if (resClases.error) throw resClases.error;
    if (resConceptos.error) throw resConceptos.error;

    return {
      success: true,
      clases: resClases.data || [],
      conceptos: resConceptos.data || []
    };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al cargar catálogos.";
    return { success: false, error: mensaje, clases: [], conceptos: [] };
  }
}

export async function obtenerParametrizacionClase(claseDocumentoId: number) {
  try {
    const { data, error } = await supabase
      .from("clase_documento_conceptos")
      .select("*")
      .eq("clase_documento_id", claseDocumentoId)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data: data || null };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al obtener parametrización.";
    return { success: false, error: mensaje, data: null };
  }
}

export async function guardarParametrizacionClase(payload: {
  empresaId: number;
  claseDocumentoId: number;
  conceptoDebitoId: number;
  conceptoCreditoId: number;
  conceptoIvaId?: number | null;
}) {
  try {
    if (!payload.empresaId || !payload.claseDocumentoId || !payload.conceptoDebitoId || !payload.conceptoCreditoId) {
      throw new Error("Faltan campos obligatorios para guardar la parametrización.");
    }

    if (payload.conceptoDebitoId === payload.conceptoCreditoId) {
      throw new Error("El concepto Débito y el concepto Crédito não pueden ser el mismo.");
    }

    const { error } = await supabase
      .from("clase_documento_conceptos")
      .upsert({
        empresa_id: payload.empresaId,
        clase_documento_id: payload.claseDocumentoId,
        concepto_auxiliar_debito: payload.conceptoDebitoId,
        concepto_auxiliar_credito: payload.conceptoCreditoId,
        concepto_auxiliar_iva_id: payload.conceptoIvaId || null,
      }, { onConflict: "clase_documento_id" });

    if (error) throw error;

    return { success: true, mensaje: "¡Parametrización contable guardada correctamente!" };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al guardar en el servidor.";
    return { success: false, error: mensaje };
  }
}