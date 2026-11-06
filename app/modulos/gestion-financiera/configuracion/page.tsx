"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Plus, CheckCircle2, Trash2, Layers } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export default function ConfigurarIndicadoresPage() {
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [conceptosAuxiliares, setConceptosAuxiliares] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Formulario para crear un nuevo Indicador Personalizado
  const [nuevoInd, setNuevoInd] = useState({
    codigo: "",
    nombre: "",
    categoria: "Rentabilidad",
    descripcion_formula: "",
  });

  // Formulario para asociar la regla de cálculo
  const [formConfig, setFormConfig] = useState({
    indicador_id: "",
    nivel_agrupacion: "concepto_auxiliar",
    numerador_ids: [] as string[],
    operacion_numerador: "SUMA",
    numerador_restando_ids: [] as string[],
    denominador_ids: [] as string[],
    operacion_tipo: "DIVISION_PORCENTAJE",
  });

  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Cargar indicadores creados
    const { data: indData, error: errInd } = await supabase.from("indicadores_financieros").select("*").order("nombre");
    if (indData) setIndicadores(indData);

    // 2. Cargar conceptos auxiliares desde la tabla correcta 'conceptos_auxiliares'
    const { data: auxData, error: errAux } = await supabase
      .from("conceptos_auxiliares")
      .select("id, codigo_auxiliar, nombre")
      .order("codigo_auxiliar");
    
    if (errAux) {
      console.error("Error al cargar conceptos auxiliares:", errAux.message);
    } else if (auxData) {
      setConceptosAuxiliares(auxData);
    }
  };

  const handleCrearIndicador = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.from("indicadores_financieros").insert([nuevoInd]);
    if (!error) {
      setMensaje({ texto: "¡Indicador creado con éxito!", tipo: "success" });
      setNuevoInd({ codigo: "", nombre: "", categoria: "Rentabilidad", descripcion_formula: "" });
      cargarDatos();
    } else {
      setMensaje({ texto: error.message, tipo: "error" });
    }
  };

  const handleGuardarConfiguracion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const payload = {
      indicador_id: Number(formConfig.indicador_id),
      nivel_agrupacion: formConfig.nivel_agrupacion,
      numerador_ids: formConfig.numerador_ids.join(","),
      operacion_numerador: formConfig.operacion_numerador,
      numerador_restando_ids: formConfig.numerador_restando_ids.join(","),
      denominador_ids: formConfig.denominador_ids.join(","),
      operacion_tipo: formConfig.operacion_tipo,
    };

    const { error } = await supabase.from("indicadores_formulas_detalle").insert([payload]);
    if (!error) {
      setMensaje({ texto: "¡Fórmula asociada correctamente al indicador!", tipo: "success" });
    } else {
      setMensaje({ texto: error.message, tipo: "error" });
    }
    setLoading(false);
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
            <h1 className="text-2xl font-bold">Creador y Configurador de Indicadores NIIF</h1>
            <p className="text-sm text-zinc-500">Crea nuevos indicadores gerenciales y define sus reglas matemáticas</p>
          </div>
        </div>

        {mensaje.texto && (
          <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            mensaje.tipo === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{mensaje.texto}</span>
          </div>
        )}

        {/* 1. CREAR NUEVO INDICADOR */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" /> 1. Registrar Nuevo Indicador en el Catálogo
          </h2>
          <form onSubmit={handleCrearIndicador} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Código Único (Ej: PRUEBA_ACIDA)</label>
              <input 
                type="text" 
                required 
                value={nuevoInd.codigo}
                onChange={(e) => setNuevoInd({...nuevoInd, codigo: e.target.value.toUpperCase()})}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                placeholder="EJ_INDICADOR"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Nombre del Indicador</label>
              <input 
                type="text" 
                required 
                value={nuevoInd.nombre}
                onChange={(e) => setNuevoInd({...nuevoInd, nombre: e.target.value})}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                placeholder="Ej. Capital de Trabajo"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Categoría</label>
              <select 
                value={nuevoInd.categoria}
                onChange={(e) => setNuevoInd({...nuevoInd, categoria: e.target.value})}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
              >
                <option value="Rentabilidad" className="dark:bg-zinc-900">Rentabilidad</option>
                <option value="Liquidez" className="dark:bg-zinc-900">Liquidez</option>
                <option value="Endeudamiento" className="dark:bg-zinc-900">Endeudamiento</option>
                <option value="Eficiencia" className="dark:bg-zinc-900">Eficiencia</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Descripción de la Fórmula</label>
              <input 
                type="text" 
                required 
                value={nuevoInd.descripcion_formula}
                onChange={(e) => setNuevoInd({...nuevoInd, descripcion_formula: e.target.value})}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                placeholder="Ej. (Activo - Inventario) / Pasivo"
              />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition">
                Guardar Indicador en el Catálogo
              </button>
            </div>
          </form>
        </div>

        {/* 2. CONFIGURAR REGLA MATEMÁTICA */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" /> 2. Configurar Regla Matemática y Conceptos NIIF
          </h2>
          <form onSubmit={handleGuardarConfiguracion} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Seleccionar Indicador</label>
              <select 
                required
                value={formConfig.indicador_id}
                onChange={(e) => setFormConfig({...formConfig, indicador_id: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
              >
                <option value="" className="dark:bg-zinc-900">Seleccione un indicador del catálogo...</option>
                {indicadores.map((ind) => (
                  <option key={ind.id} value={ind.id} className="dark:bg-zinc-900">{ind.nombre} ({ind.categoria})</option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h3 className="font-bold text-xs uppercase text-zinc-500">Estructura del Numerador (Suma o Resta de Conceptos)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Conceptos a Sumar (+)</label>
                  <select 
  multiple
  className="w-full h-32 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs"
  value={formConfig.numerador_ids}
  onChange={(e) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    setFormConfig({...formConfig, numerador_ids: values});
  }}
>
  {conceptosAuxiliares.map((c) => (
    <option key={c.id} value={c.id} className="dark:bg-zinc-900">
      {c.codigo_auxiliar} - {c.nombre}
    </option>
  ))}
</select>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Mantén presionado Ctrl / Cmd para seleccionar varios.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Conceptos a Restar (-) [Ej: Inventarios para Prueba Ácida]</label>
                  <select 
                    multiple
                    className="w-full h-32 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs"
                    value={formConfig.numerador_restando_ids}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setFormConfig({...formConfig, numerador_restando_ids: values});
                    }}
                  >
                    {conceptosAuxiliares.map((c) => (
                      <option key={c.id} value={c.id} className="dark:bg-zinc-900">{c.codigo} - {c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h3 className="font-bold text-xs uppercase text-zinc-500">Estructura del Denominador y Tipo de Operación</h3>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Conceptos del Denominador (Divisor)</label>
                <select 
                  multiple
                  className="w-full h-32 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs"
                  value={formConfig.denominador_ids}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setFormConfig({...formConfig, denominador_ids: values});
                  }}
                >
                  {conceptosAuxiliares.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-zinc-900">{c.codigo} - {c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Tipo de Resultado Final</label>
                <select 
                  value={formConfig.operacion_tipo}
                  onChange={(e) => setFormConfig({...formConfig, operacion_tipo: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                >
                  <option value="DIVISION_PORCENTAJE" className="dark:bg-zinc-900">Porcentaje (× 100) [Ej. Margen Neto, Endeudamiento]</option>
                  <option value="DIVISION_RAZON" className="dark:bg-zinc-900">Razón / Índice [Ej. Razón Corriente, Prueba Ácida]</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Configuración del Indicador"}
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}