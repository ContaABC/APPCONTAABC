"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan credenciales de superusuario para Supabase.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function calcularIndicadoresDinamicos(empresaId: string, sucursalId: string, anio: string, mes: string) {
  try {
    const supabase = getSupabaseAdmin();
    const numAnio = Number(anio);
    const numMes = Number(mes);

    // 1. Consultar fórmulas parametrizadas filtradas por empresa (y sucursal si aplica)
    let formulaQuery = supabase
      .from("indicadores_formulas_detalle")
      .select(`
        *,
        indicadores_financieros (codigo, nombre, categoria)
      `);

    if (empresaId !== "todas") {
      formulaQuery = formulaQuery.eq("empresa_id", Number(empresaId));
    }
    if (sucursalId !== "todas") {
      formulaQuery = formulaQuery.eq("sucursal_id", Number(sucursalId));
    }

    const { data: formulas, error: formulaError } = await formulaQuery;
    if (formulaError) throw formulaError;
    if (!formulas || formulas.length === 0) {
      return { success: true, indicadores: {}, mensaje: "No hay fórmulas configuradas para esta selección." };
    }

    // 2. Verificar si el periodo actual está cerrado en la tabla 'cierres'
    let queryCierre = supabase
      .from("cierres")
      .select("*")
      .eq("anio", numAnio) // O evaluando fechas / mes según tu estructura
      .eq("estado", "CERRADO");

    if (empresaId !== "todas") queryCierre = queryCierre.eq("empresa_id", Number(empresaId));
    if (sucursalId !== "todas") queryCierre = queryCierre.eq("sucursal_id", Number(sucursalId));

    const { data: cierreData } = await queryCierre;
    // Evaluamos si existe un registro de cierre que cubra el mes consultado
    const mesCerrado = cierreData && cierreData.length > 0;

    // 3. Función para obtener el saldo acumulado real según el nivel de agrupación
    const obtenerSaldoConcepto = async (idsString: string, nivelAgrupacion: string) => {
      if (!idsString) return 0;
      const ids = idsString.split(",").map(id => id.trim());

      // Determinar la tabla y la columna ID correcta según el nivel NIIF
      let nombreTabla = "saldos_acumulados_auxiliares";
      let campoId = "concepto_auxiliar_id";

      if (nivelAgrupacion === "concepto_niif") {
        nombreTabla = "saldos_acumulados_conceptos";
        campoId = "concepto_niif_id";
      } else if (nivelAgrupacion === "subconcepto") {
        nombreTabla = "saldos_acumulados_subconceptos";
        campoId = "subconcepto_niif_id"; // UUID en subconceptos según tu esquema
      }

      let saldoTotal = 0;

      for (const rawId of ids) {
        // Soporte para UUID (subconceptos) o Bigint (conceptos y auxiliares)
        const idElem = nivelAgrupacion === "subconcepto" ? rawId : Number(rawId);

        let saldoQ = supabase
          .from(nombreTabla)
          .select("*")
          .eq(campoId, idElem)
          .eq("anio", numAnio);

        if (empresaId !== "todas") saldoQ = saldoQ.eq("empresa_id", Number(empresaId));
        if (sucursalId !== "todas") saldoQ = saldoQ.eq("sucursal_id", Number(sucursalId));

        const { data: saldosReg, error: saldoErr } = await saldoQ;
        if (saldoErr || !saldosReg || saldosReg.length === 0) continue;

        if (mesCerrado) {
          // Si está cerrado, tomamos directamente el saldo_final del mes consultado
          const registroMes = saldosReg.find((s: any) => Number(s.mes) === numMes);
          if (registroMes) {
            saldoTotal += Number(registroMes.saldo_final || 0);
          }
        } else {
          // Si no está cerrado: Saldo del último mes cerrado + débitos y créditos del mes actual
          const mesAnterior = numMes > 1 ? numMes - 1 : 0;
          const registroBase = saldosReg.find((s: any) => Number(s.mes) === mesAnterior);
          const saldoBase = registroBase ? Number(registroBase.saldo_final || 0) : 0;

          const registroMesActual = saldosReg.find((s: any) => Number(s.mes) === numMes);
          const totalDebito = registroMesActual ? Number(registroMesActual.total_debito || 0) : 0;
          const totalCredito = registroMesActual ? Number(registroMesActual.total_credito || 0) : 0;

          // Saldo acumulado operativo
          saldoTotal += saldoBase + (totalDebito - totalCredito);
        }
      }

      return saldoTotal;
    };

    const resultados: { [key: string]: number } = {};

    for (const formula of formulas) {
      const codigo = formula.indicadores_financieros?.codigo;
      if (!codigo) continue;

      const nivel = formula.nivel_agrupacion; // 'concepto_niif', 'subconcepto', 'concepto_auxiliar'

      const sumaNum = Math.abs(await obtenerSaldoConcepto(formula.numerador_ids, nivel));
      const restaNum = Math.abs(await obtenerSaldoConcepto(formula.numerador_restando_ids, nivel));
      const valorNumerador = Math.max(0, sumaNum - restaNum);

      const valorDenominador = Math.abs(await obtenerSaldoConcepto(formula.denominador_ids, nivel));

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