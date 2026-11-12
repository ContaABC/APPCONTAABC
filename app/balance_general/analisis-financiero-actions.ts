"use server";

import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Obtiene los saldos acumulados directamente de la tabla 'saldos_acumulados' 
 * utilizando la columna 'saldo_final' para un periodo y empresa determinados.
 */
export async function obtenerSaldosAcumuladosReporte(
  empresaId?: number | string | null,
  anio?: number | string | null,
  mes?: number | string | null
) {
  try {
    const cookieStore = await cookies();
    const idEmpresa = empresaId || cookieStore.get("empresa_activa")?.value;

    if (!idEmpresa) {
      return { success: false, mensaje: "No se especificó la empresa o no hay sesión activa." };
    }

    // Consulta directa a saldos_acumulados usando saldo_final
    let query = supabaseAdmin
      .from("saldos_acumulados")
      .select(`
        id,
        empresa_id,
        anio,
        mes,
        saldo_inicial,
        debitos,
        creditos,
        saldo_final,
        subconcepto_niif_id,
        subconceptos_niif (
          id,
          codigo,
          nombre,
          elemento,
          concepto_niif_id,
          conceptos_niif (
            id,
            codigo_concepto,
            nombre,
            elemento,
            clasificacion_balance
          )
        )
      `)
      .eq("empresa_id", Number(idEmpresa));

    if (anio) query = query.eq("anio", Number(anio));
    if (mes) query = query.eq("mes", Number(mes));

    const { data, error } = await query;

    if (error) {
      console.error("Error al consultar saldos_acumulados:", error);
      return { success: false, mensaje: error.message };
    }

    return { success: true, datos: data || [] };
  } catch (error: unknown) {
    const mensajeError = error instanceof Error ? error.message : "Error interno del servidor.";
    console.error("Error inesperado en obtenerSaldosAcumuladosReporte:", error);
    return { success: false, mensaje: mensajeError };
  }
}

/**
 * Analiza un reporte financiero individual (Balance General o Estado de Resultados)
 */
export async function analizarReporteFinanciero(
  tipoReporte: "BALANCE_GENERAL" | "ESTADO_RESULTADOS",
  datosReporte: any,
  empresaNombre: string,
  periodo: string
) {
  try {
    let prompt = "";

    if (tipoReporte === "BALANCE_GENERAL") {
      prompt = `
        Actúa como un Director Financiero y Auditor NIIF experto. Analiza el siguiente **BALANCE GENERAL** de la empresa "${empresaNombre}" correspondiente al periodo ${periodo}:

        DATOS DEL BALANCE GENERAL (Activos, Pasivos, Patrimonio basados en saldos finales):
        ${JSON.stringify(datosReporte)}

        Genera un informe gerencial estructurado en Markdown con:
        1. **Estructura Patrimonial y Solvencia**: Evaluación del peso de Activos vs Pasivos.
        2. **Liquidez y capital de trabajo**: Análisis de componentes corrientes y no corrientes.
        3. **Alertas o Recomendaciones Clave**: Observaciones críticas o puntos a vigilar.
      `;
    } else {
      prompt = `
        Actúa como un Director Financiero y Auditor NIIF experto. Analiza el siguiente **ESTADO DE RESULTADOS** de la empresa "${empresaNombre}" correspondiente al periodo ${periodo}:

        DATOS DEL ESTADO DE RESULTADOS (Ingresos, Costos, Gastos):
        ${JSON.stringify(datosReporte)}

        Genera un informe gerencial estructurado en Markdown con:
        1. **Desempeño Operativo y Ventas**: Comportamiento de los ingresos.
        2. **Estructura de Costos y Gastos**: Eficiencia del gasto operativo y márgenes.
        3. **Rentabilidad y Utilidad Neta**: Evaluación del resultado final del periodo.
      `;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
    });

    return { success: true, analisis: response.text };
  } catch (error: unknown) {
    const mensajeError = error instanceof Error ? error.message : "Error al conectar con la IA.";
    console.error("Error al generar análisis:", error);
    return { success: false, error: mensajeError };
  }
}