"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function calcularIndicadoresDinamicos(empresaId: string, sucursalId: string, anio: string, mes: string) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Obtener fórmulas y su indicador asociado
    const { data: formulas, error: formulaError } = await supabase
      .from("indicadores_formulas_detalle")
      .select(`
        *,
        indicadores_financieros (codigo, nombre, categoria)
      `);

    if (formulaError) throw formulaError;
    if (!formulas || formulas.length === 0) {
      return { success: true, indicadores: {}, mensaje: "No hay fórmulas configuradas en el sistema." };
    }

    // 2. Obtener movimientos contables
    let query = supabase.from("movimientos_contables").select("*");
    if (empresaId !== "todas") query = query.eq("empresa_id", Number(empresaId));
    if (sucursalId !== "todas") query = query.eq("sucursal_id", Number(sucursalId));

    const { data: movimientos, error: movError } = await query;
    if (movError) throw movError;

    // Función para sumar saldos según IDs de conceptos auxiliares
    const sumarConceptos = (idsString: string) => {
      if (!idsString) return 0;
      const ids = idsString.split(",").map(id => id.trim());
      return movimientos?.reduce((acc, mov) => {
        const movId = String(mov.concepto_auxiliar_id || mov.concepto_niif_id || "");
        if (ids.includes(movId)) {
          return acc + (Number(mov.debito || 0) - Number(mov.credito || 0));
        }
        return acc;
      }, 0) || 0;
    };

    const resultados: { [key: string]: number } = {};

    for (const formula of formulas) {
      const codigo = formula.indicadores_financieros?.codigo;
      if (!codigo) continue;

      // Calcular Numerador con soporte para suma y resta (ej. Activo - Inventarios)
      const sumaNum = Math.abs(sumarConceptos(formula.numerador_ids));
      const restaNum = Math.abs(sumarConceptos(formula.numerador_restando_ids));
      const valorNumerador = Math.max(0, sumaNum - restaNum);

      const valorDenominador = Math.abs(sumarConceptos(formula.denominador_ids));

      let resultadoFinal = 0;
      if (valorDenominador > 0) {
        if (formula.operacion_tipo === 'DIVISION_PORCENTAJE') {
          resultadoFinal = (valorNumerador / valorDenominador) * 100;
        } else {
          resultadoFinal = valorNumerador / valorDenominador;
        }
      }

      resultados[codigo] = Number(resultadoFinal.toFixed(2));
    }

    return { success: true, indicadores: resultados };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}