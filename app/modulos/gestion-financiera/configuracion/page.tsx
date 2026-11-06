"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Plus, CheckCircle2, Layers } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export default function ConfigurarIndicadoresPage() {
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [indicadorSeleccionado, setIndicadorSeleccionado] = useState<any>(null);
  
  // Listas para los tres niveles NIIF
  const [listaConceptos, setListaConceptos] = useState<any[]>([]);
  const [listaSubconceptos, setListaSubconceptos] = useState<any[]>([]);
  const [listaAuxiliares, setListaAuxiliares] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  const [nuevoInd, setNuevoInd] = useState({
    codigo: "",
    nombre: "",
    categoria: "Rentabilidad",
    descripcion_formula: "",
  });

  const [formConfig, setFormConfig] = useState({
    indicador_id: "",
    nivel_agrupacion: "concepto_auxiliar", // 'concepto_niif', 'subconcepto', 'concepto_auxiliar'
    numerador_ids: [] as string[],
    operacion_numerador: "SUMA",
    numerador_restando_ids: [] as string[],
    denominador_ids: [] as string[],
    operacion_tipo: "DIVISION_PORCENTAJE",
  });

  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  useEffect(() => {
    cargarCatalogosNIIF();
  }, []);

  const cargarCatalogosNIIF = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Indicadores
    const { data: indData } = await supabase.from("indicadores_financieros").select("*").order("nombre");
    if (indData) setIndicadores(indData);

    // 2. Conceptos NIIF
    const { data: concData } = await supabase.from("conceptos_niif").select("*").order("codigo_concepto");
    if (concData) setListaConceptos(concData);

    // 3. Subconceptos NIIF
    const { data: subData } = await supabase.from("subconceptos_niif").select("*").order("codigo");
    if (subData) setListaSubconceptos(subData);

    // 4. Conceptos Auxiliares
    const { data: auxData } = await supabase.from("conceptos_auxiliares").select("*").order("codigo_auxiliar");
    if (auxData) setListaAuxiliares(auxData);
  };

  const handleSeleccionarIndicador = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setFormConfig({...formConfig, indicador_id: id});
    const encontrado = indicadores.find(ind => String(ind.id) === id);
    setIndicadorSeleccionado(encontrado || null);
  };

  const handleCrearIndicador = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.from("indicadores_financieros").insert([nuevoInd]);
    if (!error) {
      setMensaje({ texto: "¡Indicador creado con éxito!", tipo: "success" });
      setNuevoInd({ codigo: "", nombre: "", categoria: "Rentabilidad", descripcion_formula: "" });
      cargarCatalogosNIIF();
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

  // Selector dinámico según el nivel elegido por el usuario
  const obtenerListaSegunNivel = () => {
    if (formConfig.nivel_agrupacion === "concepto_niif") {
      return listaConceptos.map(c => ({ id: c.id, codigo: c.codigo_concepto, nombre: c.nombre }));
    } else if (formConfig.nivel_agrupacion === "subconcepto") {
      return listaSubconceptos.map(s => ({ id: s.id, codigo: s.codigo, nombre: s.nombre }));
    } else {
      return listaAuxiliares.map(a => ({ id: a.id, codigo: a.codigo_auxiliar, nombre: a.nombre }));
    }
  };

  const elementosDisponibles = obtenerListaSegunNivel();

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
            <p className="text-sm text-zinc-500">Configura reglas por Concepto, Subconcepto o Auxiliar con guía teórica</p>
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
            <Layers className="w-5 h-5 text-indigo-600" /> 2. Configurar Regla Matemática y Jerarquía NIIF
          </h2>
          <form onSubmit={handleGuardarConfiguracion} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Seleccionar Indicador</label>
              <select 
                required
                value={formConfig.indicador_id}
                onChange={handleSeleccionarIndicador}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
              >
                <option value="" className="dark:bg-zinc-900">Seleccione un indicador del catálogo...</option>
                {indicadores.map((ind) => (
                  <option key={ind.id} value={ind.id} className="dark:bg-zinc-900">{ind.nombre} ({ind.categoria})</option>
                ))}
              </select>

              {/* Tarjeta de apoyo con la fórmula teórica oficial */}
              {indicadorSeleccionado && (
                <div className="mt-3 p-3.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-start gap-3">
                  <div className="p-1.5 bg-blue-600 text-white rounded-xl mt-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-blue-900 dark:text-blue-200">Fórmula Teórica Oficial:</p>
                    <p className="font-mono text-blue-700 dark:text-blue-300 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-900">
                      {indicadorSeleccionado.descripcion_formula || "Sin fórmula detallada registrada en el catálogo."}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Categoría: <span className="font-semibold">{indicadorSeleccionado.categoria}</span> | Mapea los elementos correspondientes abajo.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Nivel de Agrupación NIIF</label>
              <select 
                value={formConfig.nivel_agrupacion}
                onChange={(e) => setFormConfig({...formConfig, nivel_agrupacion: e.target.value, numerador_ids: [], numerador_restando_ids: [], denominador_ids: []})}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-semibold text-indigo-600"
              >
                <option value="concepto_niif" className="dark:bg-zinc-900">1. Concepto General NIIF (Abarca todo)</option>
                <option value="subconcepto" className="dark:bg-zinc-900">2. Subconcepto NIIF (Nivel intermedio)</option>
                <option value="concepto_auxiliar" className="dark:bg-zinc-900">3. Concepto Auxiliar (Detalle máximo)</option>
              </select>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h3 className="font-bold text-xs uppercase text-zinc-500">Estructura del Numerador</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Elementos a Sumar (+)</label>
                  <select 
                    multiple
                    className="w-full h-36 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs"
                    value={formConfig.numerador_ids}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setFormConfig({...formConfig, numerador_ids: values});
                    }}
                  >
                    {elementosDisponibles.map((el) => (
                      <option key={el.id} value={el.id} className="dark:bg-zinc-900">
                        {el.codigo} - {el.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Usa Ctrl / Cmd para seleccionar varios.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Elementos a Restar (-) [Ej: Inventarios]</label>
                  <select 
                    multiple
                    className="w-full h-36 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs"
                    value={formConfig.numerador_restando_ids}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setFormConfig({...formConfig, numerador_restando_ids: values});
                    }}
                  >
                    {elementosDisponibles.map((el) => (
                      <option key={el.id} value={el.id} className="dark:bg-zinc-900">
                        {el.codigo} - {el.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h3 className="font-bold text-xs uppercase text-zinc-500">Estructura del Denominador y Tipo de Operación</h3>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Elementos del Denominador (Divisor)</label>
                <select 
                  multiple
                  className="w-full h-36 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs"
                  value={formConfig.denominador_ids}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setFormConfig({...formConfig, denominador_ids: values});
                  }}
                >
                  {elementosDisponibles.map((el) => (
                    <option key={el.id} value={el.id} className="dark:bg-zinc-900">
                      {el.codigo} - {el.nombre}
                    </option>
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