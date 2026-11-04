"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function obtenerEmpresas() {
  try {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, razon_social, nombre_comercial, nit_identificacion, dv")
      .order("razon_social", { ascending: true });

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function obtenerReporteNiiF(
  empresaId: number, 
  tipoReporte: "conceptos_niif" | "subconceptos_niif" | "conceptos_auxiliares" | "consolidado_niif"
) {
  try {
    if (tipoReporte === "conceptos_niif") {
      const { data, error } = await supabase
        .from("conceptos_niif")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("codigo_concepto", { ascending: true });

      if (error) throw error;
      return { success: true, data };
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
        .eq("empresa_id", empresaId)
        .order("codigo", { ascending: true });

      if (error) throw error;
      return { success: true, data };
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
        .eq("empresa_id", empresaId)
        .order("codigo_auxiliar", { ascending: true });

      if (error) throw error;
      return { success: true, data };
    }

    if (tipoReporte === "consolidado_niif") {
      // Consulta desde el padre (Conceptos NIIF) hacia abajo (Subconceptos -> Auxiliares)
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
        .eq("empresa_id", empresaId)
        .order("codigo_concepto", { ascending: true });

      if (error) throw error;
      return { success: true, data };
    }

    return { success: false, error: "Tipo de reporte no válido" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}