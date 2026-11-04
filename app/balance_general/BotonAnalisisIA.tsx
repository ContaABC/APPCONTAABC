"use client";

import React, { useState } from "react";
import { analizarReporteFinanciero } from "./analisis-financiero-actions"; // Ajusta tu ruta de importación si es necesario

interface BotonAnalisisIAProps {
  tipoReporte: "BALANCE_GENERAL" | "ESTADO_RESULTADOS";
  datosReporte: any[];
  empresaNombre?: string; // Opcional por si llega a venir undefined
  periodo?: string;       // Opcional por si llega a venir undefined
}

export default function BotonAnalisisIA({
  tipoReporte,
  datosReporte,
  empresaNombre,
  periodo,
}: BotonAnalisisIAProps) {
  const [loading, setLoading] = useState(false);
  const [analisis, setAnalisis] = useState<string | null>(null);

  const handleAnalizar = async () => {
    if (!datosReporte || datosReporte.length === 0) {
      alert("No hay información cargada en el reporte para analizar.");
      return;
    }

    setLoading(true);
    setAnalisis(null);

    // Aseguramos valores string por defecto con (??) para evitar el error de TypeScript
    const empresaSegura = empresaNombre ?? "Empresa";
    const periodoSeguro = periodo ?? "Periodo Actual";

    const res = await analizarReporteFinanciero(
      tipoReporte,
      datosReporte,
      empresaSegura,
      periodoSeguro
    );

    if (res.success) {
      // Forzamos que si el texto viene indefinido, se guarde como cadena vacía o null
      setAnalisis(res.analisis ?? null);
    } else {
      alert("No se pudo generar el análisis: " + (res.error ?? "Error desconocido"));
    }
    setLoading(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleAnalizar}
        disabled={loading || !datosReporte || datosReporte.length === 0}
        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded shadow-sm transition flex items-center gap-1.5 text-xs"
      >
        {loading ? "⌛ Analizando..." : "🤖 Analizar con IA"}
      </button>

      {/* MODAL DE RESULTADOS */}
      {analisis && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-indigo-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h3 className="font-bold text-sm">
                  Diagnóstico Financiero - {tipoReporte === "BALANCE_GENERAL" ? "Balance General" : "Estado de Resultados"}
                </h3>
              </div>
              <button
                onClick={() => setAnalisis(null)}
                className="text-indigo-200 hover:text-white font-bold text-sm px-2"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto text-xs text-slate-700 leading-relaxed whitespace-pre-line space-y-2">
              {analisis}
            </div>

            <div className="p-3 bg-slate-50 border-t text-right">
              <button
                onClick={() => setAnalisis(null)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded text-xs"
              >
                Cerrar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}