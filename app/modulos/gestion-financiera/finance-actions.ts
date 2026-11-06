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

export async function calcularIndicadoresConConceptosNIIF(empresaId: string, sucursalId: string, anio: string, mes: string) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Obtener todas las configuraciones de fórmulas y sus indicadores asociados
    const { data: formulas, error: formulaError } = await supabase
      .from("indicadores_formulas_detalle")
      .select(`
        *,
        indicadores_financieros (codigo, nombre, categoria)
      `);

    if (formulaError) throw formulaError;
    if (!formulas || formulas.length === 0) {
      return { success: true, indicadores: {}, mensaje: "No hay fórmulas configuradas todavía." };
    }

    // 2. Consultar los movimientos o saldos contables reales filtrados por empresa, sucursal y periodo
    let query = supabase.from("movimientos_contables").select("*");
    if (empresaId !== "todas") {
      query = query.eq("empresa_id", Number(empresaId));
    }
    if (sucursalId !== "todas") {
      query = query.eq("sucursal_id", Number(sucursalId));
    }
    // Opcional: Filtrar por año y mes si tus campos de fecha están disponibles
    // query = query.eq("anio", Number(anio)).eq("mes", Number(mes));

    const { data: movimientos, error: movError } = await query;
    if (movError) throw movError;

    // Función auxiliar para sumar saldos según los IDs de conceptos NIIF seleccionados
    const sumarSaldosPorConceptos = (idsConfiguracion: string) => {
      if (!idsConfiguracion) return 0;
      const idsPermitidos = idsConfiguracion.split(",").map(id => id.trim());

      return movimientos?.reduce((acumulado, mov) => {
        // Verificamos si el movimiento contable pertenece al concepto auxiliar/subconcepto configurado
        // Ajusta el campo 'concepto_auxiliar_id' según el nombre real de tu columna en movimientos contables
        const idMovimiento = String(mov.concepto_auxiliar_id || mov.concepto_niif_id || "");
        
        if (idsPermitidos.includes(idMovimiento)) {
          const debito = Number(mov.debito || 0);
          const credito = Number(mov.credito || 0);
          // Retorna la diferencia neta o débito/crédito según la naturaleza del movimiento
          return acumulado + (debito - credito);
        }
        return acumulado;
      }, 0) || 0;
    };

    // 3. Procesar el cálculo matemático para cada indicador configurado
    const resultados: any = {};

    for (const formula of formulas) {
      const codigoIndicador = formula.indicadores_financieros?.codigo;
      if (!codigoIndicador) continue;

      const valorNumerador = Math.abs(sumarSaldosPorConceptos(formula.numerador_ids));
      const valorDenominador = Math.abs(sumarSaldosPorConceptos(formula.denominador_ids));

      let resultadoFinal = 0;
      if (valorDenominador > 0) {
        if (formula.operacion_tipo === 'DIVISION_PORCENTAJE') {
          resultadoFinal = (valorNumerador / valorDenominador) * 100;
        } else {
          resultadoFinal = valorNumerador / valorDenominador;
        }
      }

      resultados[codigoIndicador] = Number(resultadoFinal.toFixed(2));
    }

    return { success: true, indicadores: resultados };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}