"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)."
    );
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

    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function obtenerSucursales(empresaId: number | string) {
  try {
    const parsedEmpresaId = Number(empresaId);
    if (!parsedEmpresaId) return { success: true, data: [], error: null };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sucursales")
      .select("id, nombre, codigo_sucursal")
      .eq("empresa_id", parsedEmpresaId)
      .order("id", { ascending: true });

    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function obtenerResumenBalanceYDetalle(
  empresaId: number | string,
  sucursalId?: number | string | null,
  anio?: number | string | null,
  mes?: number | string | null
) {
  try {
    const parsedEmpresaId = Number(empresaId);
    if (!parsedEmpresaId) throw new Error("Debe especificar una empresa válida.");

    const parsedSucursalId = sucursalId ? Number(sucursalId) : null;
    const parsedAnio = anio ? Number(anio) : null;
    const parsedMes = mes ? Number(mes) : null;

    const supabase = getSupabaseAdmin();

    // 1. Invocación de la RPC de resumen general
    const { data: resumenRpc, error: errRpc } = await supabase.rpc(
      "obtener_resumen_balance_niveles",
      {
        p_empresa_id: parsedEmpresaId,
        p_sucursal_id: parsedSucursalId,
        p_anio: parsedAnio,
        p_mes: parsedMes,
      }
    );

    if (errRpc) throw new Error(`RPC Error: ${errRpc.message}`);

    // 2. Consultar acumulados según los filtros
    let qConc = supabase
      .from("saldos_acumulados_conceptos")
      .select("concepto_niif_id, total_debito, total_credito, saldo_final")
      .eq("empresa_id", parsedEmpresaId);

    let qSub = supabase
      .from("saldos_acumulados_subconceptos")
      .select("subconcepto_niif_id, total_debito, total_credito")
      .eq("empresa_id", parsedEmpresaId);

    let qAux = supabase
      .from("saldos_acumulados_auxiliares")
      .select("concepto_auxiliar_id, total_debito, total_credito, saldo_final")
      .eq("empresa_id", parsedEmpresaId);

    if (parsedSucursalId) {
      qConc = qConc.eq("sucursal_id", parsedSucursalId);
      qSub = qSub.eq("sucursal_id", parsedSucursalId);
      qAux = qAux.eq("sucursal_id", parsedSucursalId);
    }
    if (parsedAnio) {
      qConc = qConc.eq("anio", parsedAnio);
      qSub = qSub.eq("anio", parsedAnio);
      qAux = qAux.eq("anio", parsedAnio);
    }
    if (parsedMes) {
      qConc = qConc.eq("mes", parsedMes);
      qSub = qSub.eq("mes", parsedMes);
      qAux = qAux.eq("mes", parsedMes);
    }

    const [resConc, resSub, resAux, resCatConc, resCatSub, resCatAux] = await Promise.all([
      qConc,
      qSub,
      qAux,
      supabase.from("conceptos_niif").select("*"),
      supabase.from("subconceptos_niif").select("*"),
      supabase.from("conceptos_auxiliares").select("*"),
    ]);

    if (resConc.error) throw new Error(`Error en Conceptos: ${resConc.error.message}`);
    if (resSub.error) throw new Error(`Error en Subconceptos: ${resSub.error.message}`);
    if (resAux.error) throw new Error(`Error en Auxiliares: ${resAux.error.message}`);

    // Mapas de catálogos con llaves en minúsculas y sin espacios
    const mapCatConceptos = new Map((resCatConc.data || []).map((c: any) => [String(c.id).toLowerCase().trim(), c]));
    const mapCatSubconceptos = new Map((resCatSub.data || []).map((s: any) => [String(s.id).toLowerCase().trim(), s]));
    const mapCatAuxiliares = new Map((resCatAux.data || []).map((a: any) => [String(a.id).toLowerCase().trim(), a]));

    // ---------------------------------------------------------------------
    // CONSOLIDACIÓN STRICTA DE CONCEPTOS NIIF
    // ---------------------------------------------------------------------
    const mapGroupConc = new Map<string, any>();
    (resConc.data || []).forEach((row: any) => {
      const key = String(row.concepto_niif_id).toLowerCase().trim();
      if (!mapGroupConc.has(key)) {
        mapGroupConc.set(key, {
          concepto_niif_id: key,
          total_debito: 0,
          total_credito: 0,
          saldo_final: 0,
          conceptos_niif: mapCatConceptos.get(key) || null,
        });
      }
      const item = mapGroupConc.get(key);
      item.total_debito += Number(row.total_debito || 0);
      item.total_credito += Number(row.total_credito || 0);
      item.saldo_final += Number(row.saldo_final || 0);
    });

    // ---------------------------------------------------------------------
    // CONSOLIDACIÓN STRICTA DE SUBCONCEPTOS NIIF (UUID)
    // ---------------------------------------------------------------------
    const mapGroupSub = new Map<string, any>();
    (resSub.data || []).forEach((row: any) => {
      const key = String(row.subconcepto_niif_id).toLowerCase().trim();
      if (!mapGroupSub.has(key)) {
        mapGroupSub.set(key, {
          subconcepto_niif_id: key,
          total_debito: 0,
          total_credito: 0,
          subconceptos_niif: mapCatSubconceptos.get(key) || null,
        });
      }
      const item = mapGroupSub.get(key);
      item.total_debito += Number(row.total_debito || 0);
      item.total_credito += Number(row.total_credito || 0);
    });

    // ---------------------------------------------------------------------
    // CONSOLIDACIÓN STRICTA DE CONCEPTOS AUXILIARES
    // ---------------------------------------------------------------------
    const mapGroupAux = new Map<string, any>();
    (resAux.data || []).forEach((row: any) => {
      const key = String(row.concepto_auxiliar_id).toLowerCase().trim();
      if (!mapGroupAux.has(key)) {
        mapGroupAux.set(key, {
          concepto_auxiliar_id: key,
          total_debito: 0,
          total_credito: 0,
          saldo_final: 0,
          conceptos_auxiliares: mapCatAuxiliares.get(key) || null,
        });
      }
      const item = mapGroupAux.get(key);
      item.total_debito += Number(row.total_debito || 0);
      item.total_credito += Number(row.total_credito || 0);
      item.saldo_final += Number(row.saldo_final || 0);
    });

    // Ordenación multidimensional
    const listaConceptos = Array.from(mapGroupConc.values()).sort((a, b) => {
      const elemA = String(a.conceptos_niif?.elemento || "").toLowerCase();
      const elemB = String(b.conceptos_niif?.elemento || "").toLowerCase();
      if (elemA !== elemB) return elemA.localeCompare(elemB);

      const clasifA = String(a.conceptos_niif?.clasificacion_balance || "").toLowerCase();
      const clasifB = String(b.conceptos_niif?.clasificacion_balance || "").toLowerCase();
      if (clasifA !== clasifB) return clasifA.localeCompare(clasifB);

      const codA = String(a.conceptos_niif?.codigo_concepto || a.conceptos_niif?.codigo || "").toLowerCase();
      const codB = String(b.conceptos_niif?.codigo_concepto || b.conceptos_niif?.codigo || "").toLowerCase();
      return codA.localeCompare(codB);
    });

    const listaSubconceptos = Array.from(mapGroupSub.values()).sort((a, b) => {
      const codA = String(a.subconceptos_niif?.codigo_subconcepto || a.subconceptos_niif?.codigo || "").toLowerCase();
      const codB = String(b.subconceptos_niif?.codigo_subconcepto || b.subconceptos_niif?.codigo || "").toLowerCase();
      return codA.localeCompare(codB);
    });

    const listaAuxiliares = Array.from(mapGroupAux.values()).sort((a, b) => {
      const codA = String(a.conceptos_auxiliares?.codigo_auxiliar || "").toLowerCase();
      const codB = String(b.conceptos_auxiliares?.codigo_auxiliar || "").toLowerCase();
      return codA.localeCompare(codB);
    });

    return {
      success: true,
      resumenBalance: resumenRpc || [],
      detalle: {
        conceptos: listaConceptos,
        subconceptos: listaSubconceptos,
        auxiliares: listaAuxiliares,
      },
      error: null,
    };
  } catch (err: any) {
    console.error("Error en obtenerResumenBalanceYDetalle:", err);
    return {
      success: false,
      resumenBalance: [],
      detalle: { conceptos: [], subconceptos: [], auxiliares: [] },
      error: err.message || "Error al consultar saldos.",
    };
  }
}