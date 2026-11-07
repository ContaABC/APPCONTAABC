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
      return { success: true, indicadores: {}, historico: [], mensaje: "No hay fórmulas parametrizadas." };
    }

    // 2. Recopilar IDs únicos de numerador y denominador (suma y resta)
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
      return { success: true, indicadores: {}, historico: [] };
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

    // 3. CONSULTA MAESTRA masiva para todo el año
    const { data: todosLosRegistros, error: saldoErr } = await (supabase
      .from(nombreTabla)
      .select("*") as any)
      .in(campoId, formattedIds)
      .eq("empresa_id", Number(empresaId))
      .eq("sucursal_id", Number(sucursalId))
      .eq("anio", numAnio);

    if (saldoErr || !todosLosRegistros) {
      return { success: true, indicadores: {}, historico: [] };
    }

    // Organizar en mapa en memoria RAM
    const mapaSaldos = new Map<string, number>();
    for (const reg of (todosLosRegistros as any[])) {
      const m = Number(reg.mes);
      const idVal = String(reg[campoId]);
      mapaSaldos.set(`${m}-${idVal}`, Number(reg.saldo_final || 0));
    }

    const calcularSaldosMemoria = (idsString: string | null, m: number): number => {
      if (!idsString || idsString.trim() === "") return 0;
      const ids = idsString.split(",").map((id: string) => id.trim()).filter(Boolean);
      let suma = 0;
      for (const id of ids) {
        suma += mapaSaldos.get(`${m}-${id}`) || 0;
      }
      return suma;
    };

    // 4. Calcular el mes actual seleccionado
    const indicadoresActuales: { [key: string]: number } = {};
    for (const formula of formulas) {
      const codigo = formula.indicadores_financieros?.codigo;
      if (!codigo) continue;

      const sumaNum = Math.abs(calcularSaldosMemoria(formula.numerador_ids, numMes));
      const restaNum = Math.abs(calcularSaldosMemoria(formula.numerador_restando_ids, numMes));
      const valorNumerador = Math.max(0, sumaNum - restaNum);

      const sumaDen = Math.abs(calcularSaldosMemoria(formula.denominador_ids, numMes));
      const restaDen = Math.abs(calcularSaldosMemoria(formula.denominador_restando_ids, numMes));
      const valorDenominador = Math.max(0, sumaDen - restaDen);

      let resultadoFinal = 0;
      if (valorDenominador > 0) {
        resultadoFinal = formula.operacion_tipo === 'DIVISION_PORCENTAJE' 
          ? (valorNumerador / valorDenominador) * 100 
          : valorNumerador / valorDenominador;
      }
      indicadoresActuales[codigo] = Number(resultadoFinal.toFixed(2));
    }

    // 5. Histórico de los 12 meses en memoria para las gráficas
    const historico = [];
    for (let m = 1; m <= 12; m++) {
      const resMes: { [key: string]: number } = {};
      for (const formula of formulas) {
        const codigo = formula.indicadores_financieros?.codigo;
        if (!codigo) continue;

        const sumaNum = Math.abs(calcularSaldosMemoria(formula.numerador_ids, m));
        const restaNum = Math.abs(calcularSaldosMemoria(formula.numerador_restando_ids, m));
        const valorNumerador = Math.max(0, sumaNum - restaNum);

        const sumaDen = Math.abs(calcularSaldosMemoria(formula.denominador_ids, m));
        const restaDen = Math.abs(calcularSaldosMemoria(formula.denominador_restando_ids, m));
        const valorDenominador = Math.max(0, sumaDen - restaDen);

        let resultadoFinal = 0;
        if (valorDenominador > 0) {
          resultadoFinal = formula.operacion_tipo === 'DIVISION_PORCENTAJE' 
            ? (valorNumerador / valorDenominador) * 100 
            : valorNumerador / valorDenominador;
        }
        resMes[codigo] = Number(resultadoFinal.toFixed(2));
      }

      historico.push({
        mes: `M ${m}`,
        ...resMes
      });
    }

    return { success: true, indicadores: indicadoresActuales, historico };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}