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

export async function obtenerEmpresas() {
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

export async function obtenerReporteNiiF(
  empresaId?: number | string | null, 
  tipoReporte?: "conceptos_niif" | "subconceptos_niif" | "conceptos_auxiliares" | "consolidado_niif"
) {
  try {
    const idEmpresa = await resolverEmpresaId(empresaId);
    if (!idEmpresa) {
      return { success: false, error: "No se ha especificado o detectado una empresa activa.", data: [] };
    }

    if (!tipoReporte) {
      return { success: false, error: "Debe especificar el tipo de reporte NIIF a consultar.", data: [] };
    }

    if (tipoReporte === "conceptos_niif") {
      const { data, error } = await supabase
        .from("conceptos_niif")
        .select("*")
        .eq("empresa_id", idEmpresa)
        .order("codigo_concepto", { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } 
    
    if (tipoReporte === "subconceptos_niif") {
      const { data, error } = await supabase
        .from("subconceptos_niif")
        .select(`
          *,
          conceptos_niif (
            codigo_concepto,
            nombre
          )
        `)
        .eq("empresa_id", idEmpresa)
        .order("codigo", { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } 
    
    if (tipoReporte === "conceptos_auxiliares") {
      const { data, error } = await supabase
        .from("conceptos_auxiliares")
        .select(`
          *,
          subconceptos_niif (
            codigo,
            nombre,
            conceptos_niif (
              codigo_concepto,
              nombre
            )
          )
        `)
        .eq("empresa_id", idEmpresa)
        .order("codigo_auxiliar", { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    }

    if (tipoReporte === "consolidado_niif") {
      const { data, error } = await supabase
        .from("conceptos_niif")
        .select(`
          id,
          codigo_concepto,
          nombre,
          elemento,
          clasificacion_balance,
          subconceptos_niif (
            id,
            codigo,
            nombre,
            activo,
            conceptos_auxiliares (
              id,
              codigo_auxiliar,
              nombre,
              tipo_entidad,
              estado
            )
          )
        `)
        .eq("empresa_id", idEmpresa)
        .order("codigo_concepto", { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    }

    return { success: false, error: "Tipo de reporte no válido", data: [] };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al procesar el reporte NIIF.";
    return { success: false, error: mensaje, data: [] };
  }
}