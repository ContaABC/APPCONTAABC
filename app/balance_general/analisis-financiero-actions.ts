"use server";

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

        DATOS DEL BALANCE GENERAL (Activos, Pasivos, Patrimonio):
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
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    return { success: true, analisis: response.text };
  } catch (error: any) {
    console.error("Error al generar análisis:", error);
    return { success: false, error: error.message || "Error al conectar con la IA." };
  }
}