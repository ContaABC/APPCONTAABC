"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function calcularIndicadoresDinamicos(
  empresaId: string, 
  sucursalId: string, 
  anio: string, 
  mes: string,
  compararAnioAnterior: boolean = false
) {
  try {
    const supabase = getSupabaseAdmin();
    const numAnio = Number(anio);
    const numMes = Number(mes);
    const numAnioAnterior = numAnio - 1;

    // 1. Consultar fórmulas parametrizadas
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

    // 3. CONSULTAS A SUPABASE (Año actual y opcionalmente año anterior)
    const aniosAConsultar = [numAnio];
    if (compararAnioAnterior) {
      aniosAConsultar.push(numAnioAnterior);
    }

    const { data: todosLosRegistros, error: saldoErr } = await (supabase
      .from(nombreTabla)
      .select("*") as any)
      .in(campoId, formattedIds)
      .eq("empresa_id", Number(empresaId))
      .eq("sucursal_id", Number(sucursalId))
      .in("anio", aniosAConsultar);

    if (saldoErr || !todosLosRegistros) {
      return { success: true, indicadores: {}, balance: {}, resultadosOp: {}, historico: [], historicoBalance: [], historicoResultados: [] };
    }

    // Mapear saldos por clave compuesta: "anio-mes-id"
    const mapaSaldos = new Map<string, number>();
    for (const reg of (todosLosRegistros as any[])) {
      const a = Number(reg.anio);
      const m = Number(reg.mes);
      const idVal = String(reg[campoId]);
      mapaSaldos.set(`${a}-${m}-${idVal}`, Number(reg.saldo_final || 0));
    }

    // Funciones de evaluación para Indicadores (Absolutos) y Contables (Con signo real)
    const calcularSaldosAbsolutos = (idsString: string | null, a: number, m: number): number => {
      if (!idsString || idsString.trim() === "") return 0;
      const ids = idsString.split(",").map((id: string) => id.trim()).filter(Boolean);
      let suma = 0;
      for (const id of ids) {
        suma += Math.abs(mapaSaldos.get(`${a}-${m}-${id}`) || 0);
      }
      return suma;
    };

    const evaluarFormulaIndicador = (formula: any, a: number, m: number) => {
      const sumaNum = calcularSaldosAbsolutos(formula.numerador_ids, a, m);
      const restaNum = calcularSaldosAbsolutos(formula.numerador_restando_ids, a, m);
      const valorNumerador = Math.max(0, sumaNum - restaNum);

      const sumaDen = calcularSaldosAbsolutos(formula.denominador_ids, a, m);
      const restaDen = calcularSaldosAbsolutos(formula.denominador_restando_ids, a, m);
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

    const calcularSaldosContables = (idsString: string | null, a: number, m: number): number => {
      if (!idsString || idsString.trim() === "") return 0;
      const ids = idsString.split(",").map((id: string) => id.trim()).filter(Boolean);
      let suma = 0;
      for (const id of ids) {
        suma += mapaSaldos.get(`${a}-${m}-${id}`) || 0;
      }
      return suma;
    };

    const evaluarFormulaContable = (formula: any, a: number, m: number, forzarAbs: boolean = false) => {
      const sumaNum = calcularSaldosContables(formula.numerador_ids, a, m);
      const restaNum = calcularSaldosContables(formula.numerador_restando_ids, a, m);
      const valorNumerador = sumaNum - restaNum;

      const sumaDen = calcularSaldosContables(formula.denominador_ids, a, m);
      const restaDen = calcularSaldosContables(formula.denominador_restando_ids, a, m);
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

    // Función auxiliar para calcular valores de un año específico
    const procesarPeriodo = (anioEval: number, mesEval: number) => {
      const inds: { [key: string]: number } = {};
      const balVal: { [key: string]: number } = { ACTIVO: 0, PASIVO: 0, PATRIMONIO: 0 };
      const resVal: { [key: string]: number } = { INGRESOS: 0, COSTOS: 0, GASTOS: 0 };

      for (const formula of formulas) {
        const codigo = formula.indicadores_financieros?.codigo?.toUpperCase();
        const categoria = formula.indicadores_financieros?.categoria;
        if (!codigo) continue;

        if (["ACTIVO", "PASIVO", "PATRIMONIO"].includes(codigo)) {
          balVal[codigo] = evaluarFormulaContable(formula, anioEval, mesEval, true);
        } else if (["INGRESOS", "GASTOS"].includes(codigo)) {
          resVal[codigo] = Math.abs(evaluarFormulaContable(formula, anioEval, mesEval, false));
        } else if (codigo === "COSTOS") {
          resVal[codigo] = evaluarFormulaContable(formula, anioEval, mesEval, false);
        } else {
          inds[codigo] = evaluarFormulaIndicador(formula, anioEval, mesEval);
        }
      }

      const ing = resVal.INGRESOS || 0;
      const cos = resVal.COSTOS || 0;
      const gas = resVal.GASTOS || 0;
      const utilidad = Number((ing - cos - gas).toFixed(2));
      const patrimonioFinal = Number(((balVal.PATRIMONIO || 0) + utilidad).toFixed(2));

      return {
        indicadores: inds,
        balance: { ...balVal, PATRIMONIO: patrimonioFinal },
        resultados: { INGRESOS: ing, COSTOS: cos, GASTOS: gas, UTILIDAD: utilidad }
      };
    };

    // Procesar mes actual (Año seleccionado)
    const actual = procesarPeriodo(numAnio, numMes);
    
    // Procesar mes anterior (Año anterior opcional)
    let anterior = null;
    if (compararAnioAnterior) {
      anterior = procesarPeriodo(numAnioAnterior, numMes);
    }

    // Calcular variaciones si aplica
    const calcularVariacion = (valActual: number, valAnt: number | undefined) => {
      if (valAnt === undefined || valAnt === 0) return { varAbs: 0, varPorc: 0 };
      const varAbs = Number((valActual - valAnt).toFixed(2));
      const varPorc = Number(((varAbs / Math.abs(valAnt)) * 100).toFixed(2));
      return { varAbs, varPorc };
    };

    const indicadoresConVariacion: { [key: string]: any } = {};
    for (const [key, val] of Object.entries(actual.indicadores)) {
      const antVal = anterior?.indicadores[key];
      indicadoresConVariacion[key] = {
        valor: val,
        ...calcularVariacion(val, antVal)
      };
    }

    const balanceConVariacion: { [key: string]: any } = {};
    for (const [key, val] of Object.entries(actual.balance)) {
      const antVal = (anterior?.balance as any)?.[key];
      balanceConVariacion[key] = {
        valor: val,
        ...calcularVariacion(val, antVal)
      };
    }

    const resultadosConVariacion: { [key: string]: any } = {};
    for (const [key, val] of Object.entries(actual.resultados)) {
      const antVal = (anterior?.resultados as any)?.[key];
      resultadosConVariacion[key] = {
        valor: val,
        ...calcularVariacion(val, antVal)
      };
    }

    // Histórico de los 12 meses (Año actual)
    const historico = [];
    const historicoBalance = [];
    const historicoResultados = [];

    for (let m = 1; m <= 12; m++) {
      const p = procesarPeriodo(numAnio, m);
      historico.push({ mes: `M ${m}`, ...p.indicadores });
      historicoBalance.push({ mes: `M ${m}`, ...p.balance });
      historicoResultados.push({ mes: `M ${m}`, ...p.resultados });
    }

    return { 
      success: true, 
      modoComparativo: compararAnioAnterior,
      indicadores: indicadoresConVariacion, 
      balance: balanceConVariacion, 
      resultadosOp: resultadosConVariacion, 
      historico, 
      historicoBalance, 
      historicoResultados 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}