"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Plus, CheckCircle2, Layers } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export default function ConfigurarIndicadoresPage() {
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [conceptosAuxiliares, setConceptosAuxiliares] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Estado del formulario de configuración de fórmula
  const [form, setForm] = useState({
    indicador_id: "",
    nivel_agrupacion: "concepto_auxiliar", // concepto_niif, subconcepto, concepto_auxiliar
    numerador_ids: "",
    denominador_ids: "",
    operacion_tipo: "DIVISION_PORCENTAJE",
  });

  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  useEffect(() => {
    cargarDatosCatalogo();
  }, []);

  const cargarDatosCatalogo = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Cargar indicadores
    const { data: indData } = await supabase.from("indicadores_financieros").select("*");
    if (indData) setIndicadores(indData);

    // 2. Cargar conceptos auxiliares NIIF (ejemplo de tabla NIIF de tu app)
    const { data: auxData } = await supabase.from("conceptos_auxiliares_niif").select("*");
    if (auxData) setConceptosAuxiliares(auxData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje({ texto: "", tipo: "" });

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Faltan variables de entorno.");

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { error } = await supabase.from("indicadores_formulas_detalle").insert([form]);
      if (error) throw error;

      setMensaje({ texto: "¡Fórmula de indicador configurada exitosamente!", tipo: "success" });
      setForm({ indicador_id: "", nivel_agrupacion: "concepto_auxiliar", numerador_ids: "", denominador_ids: "", operacion_tipo: "DIVISION_PORCENTAJE" });
    } catch (error: any) {
      setMensaje({ texto: error.message || "Error al guardar la configuración.", tipo: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <Link href="/modulos/gestion-financiera" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 transition">
          <ArrowLeft className="w-4 h-4" /> Volver a Gestión Financiera
        </Link>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Configuración de Fórmulas NIIF por Indicador</h1>
            <p className="text-sm text-zinc-500">Asocia conceptos, subconceptos o auxiliares al numerador y denominador</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm">
          {mensaje.texto && (
            <div className={`p-3 mb-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              mensaje.tipo === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{mensaje.texto}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 text-sm">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Seleccionar Indicador Financiero</label>
              <select
                required
                value={form.indicador_id}
                onChange={(e) => setForm({...form, indicador_id: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
              >
                <option value="" className="dark:bg-zinc-900">Seleccione un indicador...</option>
                {indicadores.map((ind) => (
                  <option key={ind.id} value={ind.id} className="dark:bg-zinc-900">{ind.nombre} ({ind.categoria})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Nivel de Agrupación NIIF</label>
              <select
                value={form.nivel_agrupacion}
                onChange={(e) => setForm({...form, nivel_agrupacion: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600 font-semibold text-indigo-600"
              >
                <option value="concepto_auxiliar" className="dark:bg-zinc-900">Concepto Auxiliar (Detalle máximo)</option>
                <option value="subconcepto" className="dark:bg-zinc-900">Subconcepto NIIF</option>
                <option value="concepto_niif" className="dark:bg-zinc-900">Concepto General NIIF</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">IDs del Numerador (Separados por coma)</label>
                <input
                  type="text"
                  required
                  value={form.numerador_ids}
                  onChange={(e) => setForm({...form, numerador_ids: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600 font-mono text-xs"
                  placeholder="Ej. 102, 105, 108"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">IDs del Denominador (Separados por coma)</label>
                <input
                  type="text"
                  required
                  value={form.denominador_ids}
                  onChange={(e) => setForm({...form, denominador_ids: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600 font-mono text-xs"
                  placeholder="Ej. 201, 202"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Guardando configuración..." : "Guardar Asociación NIIF"}
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}