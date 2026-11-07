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
    const numAnio = Number(anio);
    const numMes = Number(mes);

    // 1. Consultar fórmulas parametrizadas incluyendo la categoría del indicador
    const { data: formulas, error: formulaError } = await supabase
      .from("indicadores_formulas_detalle")
      .select(`
        *,
        indicadores_financieros (codigo, nombre, categoria)
      `)
      .eq("empresa_id", Number(empresaId))
      .eq("sucursal_id", Number(sucursalId));

    if (formulaError) throw formulaError;
    if (!formulas || formulas.length === 0) {
      return { success: true, indicadores: {}, balance: {}, resultadosOp: {}, historico: [], historicoBalance: [], historicoResultados: [] };
    }

    // 2. Recopilar IDs únicos
    const idsConceptosSet = new Set<string>();
    let usaConceptosNiif = false;
    let usaSubconceptos = false;

    for (const f of formulas) {
      const nivel = f.nivel_agrupacion || "concepto_auxiliar";
      if (nivel === "concepto_niif") usaConceptosNiif = true;
      else if (nivel === "subconcepto") usaSubconceptos = true;

      [
        f.numerador_ids, 
        f.numerador_restando_ids, 
        f.denominador_ids, 
        f.denominador_restando_ids
      ].forEach((idsStr: string | null) => {
        if (idsStr) {
          idsStr.split(",").forEach((id: string) => {
            if (id.trim()) idsConceptosSet.add(id.trim());
          });
        }
      });
    }

    const idsArray = Array.from(idsConceptosSet);
    if (idsArray.length === 0) {
      return { success: true, indicadores: {}, balance: {}, resultadosOp: {}, historico: [], historicoBalance: [], historicoResultados: [] };
    }

    let nombreTabla = "saldos_acumulados_auxiliares";
    let campoId = "concepto_auxiliar_id";
    if (usaConceptosNiif) {
      nombreTabla = "saldos_acumulados_conceptos";
      campoId = "concepto_niif_id";
    } else if (usaSubconceptos) {
      nombreTabla = "saldos_acumulados_subconceptos";
      campoId = "subconcepto_niif_id";
    }

    const formattedIds = usaSubconceptos ? idsArray : idsArray.map(Number);

    // 3. CONSULTA MAESTRA masiva en memoria
    const { data: todosLosRegistros, error: saldoErr } = await (supabase
      .from(nombreTabla)
      .select("*") as any)
      .in(campoId, formattedIds)
      .eq("empresa_id", Number(empresaId))
      .eq("sucursal_id", Number(sucursalId))
      .eq("anio", numAnio);

    if (saldoErr || !todosLosRegistros) {
      return { success: true, indicadores: {}, balance: {}, resultadosOp: {}, historico: [], historicoBalance: [], historicoResultados: [] };
    }

    const mapaSaldos = new Map<string, number>();
    for (const reg of (todosLosRegistros as any[])) {
      const m = Number(reg.mes);
      const idVal = String(reg[campoId]);
      mapaSaldos.set(`${m}-${idVal}`, Number(reg.saldo_final || 0));
    }

    // A. Función para EVALUAR INDICADORES (Siempre usa valores absolutos en positivo para evitar desajustes en ratios)
    const calcularSaldosAbsolutos = (idsString: string | null, m: number): number => {
      if (!idsString || idsString.trim() === "") return 0;
      const ids = idsString.split(",").map((id: string) => id.trim()).filter(Boolean);
      let suma = 0;
      for (const id of ids) {
        suma += Math.abs(mapaSaldos.get(`${m}-${id}`) || 0);
      }
      return suma;
    };

    const evaluarFormulaIndicador = (formula: any, m: number) => {
      const sumaNum = calcularSaldosAbsolutos(formula.numerador_ids, m);
      const restaNum = calcularSaldosAbsolutos(formula.numerador_restando_ids, m);
      const valorNumerador = Math.max(0, sumaNum - restaNum);

      const sumaDen = calcularSaldosAbsolutos(formula.denominador_ids, m);
      const restaDen = calcularSaldosAbsolutos(formula.denominador_restando_ids, m);
      const valorDenominador = Math.max(0, sumaDen - restaDen);

      let resultadoFinal = 0;
      if (valorDenominador > 0) {
        resultadoFinal = formula.operacion_tipo === 'DIVISION_PORCENTAJE' 
          ? (valorNumerador / valorDenominador) * 100 
          : valorNumerador / valorDenominador;
      } else {
        resultadoFinal = valorNumerador;
      }
      return Number(resultadoFinal.toFixed(2));
    };

    // B. Función para BALANCE Y RESULTADOS (Respeta el signo contable real, ej. costos negativos)
    const calcularSaldosContables = (idsString: string | null, m: number): number => {
      if (!idsString || idsString.trim() === "") return 0;
      const ids = idsString.split(",").map((id: string) => id.trim()).filter(Boolean);
      let suma = 0;
      for (const id of ids) {
        suma += mapaSaldos.get(`${m}-${id}`) || 0;
      }
      return suma;
    };

    const evaluarFormulaContable = (formula: any, m: number, forzarAbs: boolean = false) => {
      const sumaNum = calcularSaldosContables(formula.numerador_ids, m);
      const restaNum = calcularSaldosContables(formula.numerador_restando_ids, m);
      const valorNumerador = sumaNum - restaNum;

      const sumaDen = calcularSaldosContables(formula.denominador_ids, m);
      const restaDen = calcularSaldosContables(formula.denominador_restando_ids, m);
      const valorDenominador = Math.max(0, sumaDen - restaDen);

      let resultadoFinal = 0;
      if (valorDenominador > 0) {
        resultadoFinal = formula.operacion_tipo === 'DIVISION_PORCENTAJE' 
          ? (valorNumerador / valorDenominador) * 100 
          : valorNumerador / valorDenominador;
      } else {
        resultadoFinal = valorNumerador;
      }
      return Number((forzarAbs ? Math.abs(resultadoFinal) : resultadoFinal).toFixed(2));
    };

    const indicadoresActuales: { [key: string]: number } = {};
    const balanceActualVal: { [key: string]: number } = { ACTIVO: 0, PASIVO: 0, PATRIMONIO: 0 };
    const resultadosRawVal: { [key: string]: number } = { INGRESOS: 0, COSTOS: 0, GASTOS: 0 };

    for (const formula of formulas) {
      const codigo = formula.indicadores_financieros?.codigo?.toUpperCase();
      const categoria = formula.indicadores_financieros?.categoria;
      if (!codigo) continue;

      if (["ACTIVO", "PASIVO", "PATRIMONIO"].includes(codigo)) {
        balanceActualVal[codigo] = evaluarFormulaContable(formula, numMes, true);
      } else if (["INGRESOS", "GASTOS"].includes(codigo)) {
        resultadosRawVal[codigo] = Math.abs(evaluarFormulaContable(formula, numMes, false));
      } else if (codigo === "COSTOS") {
        resultadosRawVal[codigo] = evaluarFormulaContable(formula, numMes, false); // Mantiene el negativo (-326.757)
      } else {
        // Para los indicadores financieros comunes (Prueba Ácida, ROE, etc.), usamos la lógica limpia absoluta
        indicadoresActuales[codigo] = evaluarFormulaIndicador(formula, numMes);
      }
    }

    const ingresosVal = resultadosRawVal.INGRESOS || 0; 
    const costosVal = resultadosRawVal.COSTOS || 0;     // Negativo (-326.757)
    const gastosVal = resultadosRawVal.GASTOS || 0;     
    
    // Utilidad exacta: Ingresos - Costos (negativos) - Gastos = 1.455.993
    const utilidadVal = Number((ingresosVal - costosVal - gastosVal).toFixed(2));
    
    const resultadosActual = { 
      INGRESOS: ingresosVal, 
      COSTOS: costosVal, 
      GASTOS: gastosVal, 
      UTILIDAD: utilidadVal 
    };

    // Patrimonio sumándole la utilidad de 1.455.993 -> 16.455.993
    const patrimonioCuadrado = Number(((balanceActualVal.PATRIMONIO || 0) + utilidadVal).toFixed(2));
    const balanceActual = {
      ...balanceActualVal,
      PATRIMONIO: patrimonioCuadrado
    };

    // Histórico de los 12 meses (separado también)
    const historico = [];
    const historicoBalance = [];
    const historicoResultados = [];

    for (let m = 1; m <= 12; m++) {
      const resMes: { [key: string]: number } = {};
      const balMesVal: { [key: string]: number } = { ACTIVO: 0, PASIVO: 0, PATRIMONIO: 0 };
      const resOpRaw: { [key: string]: number } = { INGRESOS: 0, COSTOS: 0, GASTOS: 0 };

      for (const formula of formulas) {
        const codigo = formula.indicadores_financieros?.codigo?.toUpperCase();
        const categoria = formula.indicadores_financieros?.categoria;
        if (!codigo) continue;

        if (["ACTIVO", "PASIVO", "PATRIMONIO"].includes(codigo)) {
          balMesVal[codigo] = evaluarFormulaContable(formula, m, true);
        } else if (["INGRESOS", "GASTOS"].includes(codigo)) {
          resOpRaw[codigo] = Math.abs(evaluarFormulaContable(formula, m, false));
        } else if (codigo === "COSTOS") {
          resOpRaw[codigo] = evaluarFormulaContable(formula, m, false);
        } else {
          resMes[codigo] = evaluarFormulaIndicador(formula, m);
        }
      }

      const ingM = resOpRaw.INGRESOS || 0;
      const cosM = resOpRaw.COSTOS || 0;
      const gasM = resOpRaw.GASTOS || 0;
      const utilM = Number((ingM - cosM - gasM).toFixed(2));
      const patM = Number(((balMesVal.PATRIMONIO || 0) + utilM).toFixed(2));

      historico.push({ mes: `M ${m}`, ...resMes });
      historicoBalance.push({ mes: `M ${m}`, ...balMesVal, PATRIMONIO: patM });
      
      historicoResultados.push({
        mes: `M ${m}`,
        INGRESOS: ingM,
        COSTOS: cosM,
        GASTOS: gasM,
        UTILIDAD: utilM
      });
    }

    return { 
      success: true, 
      indicadores: indicadoresActuales, 
      balance: balanceActual, 
      resultadosOp: resultadosActual, 
      historico, 
      historicoBalance, 
      historicoResultados 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}