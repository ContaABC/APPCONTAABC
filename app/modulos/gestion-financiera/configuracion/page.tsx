"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, CheckCircle2, Layers, Filter } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export default function ConfigurarFormulasIndicadorPage() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<string>("");
  
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [indicadorSeleccionado, setIndicadorSeleccionado] = useState<any>(null);
  
  // Listas maestras filtradas por empresa
  const [listaConceptos, setListaConceptos] = useState<any[]>([]);
  const [listaSubconceptos, setListaSubconceptos] = useState<any[]>([]);
  const [listaAuxiliares, setListaAuxiliares] = useState<any[]>([]);

  // Filtros por Elemento (Activo, Pasivo, Patrimonio, Ingresos, Gastos, Costos) para cada sección
  const [filtroElementoNum, setFiltroElementoNum] = useState<string>("TODOS");
  const [filtroElementoRest, setFiltroElementoRest] = useState<string>("TODOS");
  const [filtroElementoDen, setFiltroElementoDen] = useState<string>("TODOS");

  const [loading, setLoading] = useState(false);

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
    cargarEmpresasEIndicadores();
  }, []);

  // Cargar empresas y catálogo de indicadores al iniciar
  const cargarEmpresasEIndicadores = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: empData } = await supabase.from("empresas").select("*").order("razon_social");
    if (empData && empData.length > 0) {
      setEmpresas(empData);
      setEmpresaSeleccionada(String(empData[0].id));
    }

    const { data: indData } = await supabase.from("indicadores_financieros").select("*").order("nombre");
    if (indData) setIndicadores(indData);
  };

  // Recargar catálogos NIIF cada vez que cambie la empresa seleccionada
  useEffect(() => {
    if (!empresaSeleccionada) return;
    cargarCatalogosNIIFEmpresa(empresaSeleccionada);
  }, [empresaSeleccionada]);

  const cargarCatalogosNIIFEmpresa = async (empId: string) => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    // 1. Conceptos NIIF de la empresa
    const { data: concData } = await supabase.from("conceptos_niif").select("*").eq("empresa_id", empId).order("codigo_concepto");
    if (concData) setListaConceptos(concData);

    // 2. Subconceptos NIIF (filtrados por empresa, ya que tu esquema incluye empresa_id)
    const { data: subData } = await supabase.from("subconceptos_niif").select("*").eq("empresa_id", empId).order("codigo");
    if (subData) setListaSubconceptos(subData);

    // 3. Conceptos Auxiliares de la empresa
    const { data: auxData } = await supabase.from("conceptos_auxiliares").select("*").eq("empresa_id", empId).order("codigo_auxiliar");
    if (auxData) setListaAuxiliares(auxData);
  };

  const handleSeleccionarIndicador = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setFormConfig({...formConfig, indicador_id: id});
    const encontrado = indicadores.find(ind => String(ind.id) === id);
    setIndicadorSeleccionado(encontrado || null);
  };

  const handleGuardarConfiguracion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaSeleccionada) {
      setMensaje({ texto: "Seleccione una empresa primero.", tipo: "error" });
      return;
    }

    setLoading(true);
    setMensaje({ texto: "", tipo: "" });
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const payload = {
      empresa_id: Number(empresaSeleccionada),
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
      setMensaje({ texto: "¡Fórmula asociada correctamente para esta empresa!", tipo: "success" });
    } else {
      setMensaje({ texto: error.message, tipo: "error" });
    }
    setLoading(false);
  };

  // Obtener elementos según el nivel elegido
  const obtenerElementosBase = () => {
    if (formConfig.nivel_agrupacion === "concepto_niif") {
      return listaConceptos.map(c => ({ id: c.id, codigo: c.codigo_concepto, nombre: c.nombre, elemento: c.elemento || "GENERAL" }));
    } else if (formConfig.nivel_agrupacion === "subconcepto") {
      return listaSubconceptos.map(s => ({ id: s.id, codigo: s.codigo, nombre: s.nombre, elemento: s.elemento || "GENERAL" }));
    } else {
      return listaAuxiliares.map(a => ({ id: a.id, codigo: a.codigo_auxiliar, nombre: a.nombre, elemento: a.elemento || "GENERAL" }));
    }
  };

  const elementosBase = obtenerElementosBase();

  // Filtradores por elemento para cada sección de la fórmula
  const filtrarPorElemento = (filtro: string) => {
    if (filtro === "TODOS") return elementosBase;
    return elementosBase.filter(el => el.elemento?.toUpperCase() === filtro.toUpperCase());
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <Link href="/modulos/gestion-financiera" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 transition">
          <ArrowLeft className="w-4 h-4" /> Volver a Gestión Financiera
        </Link>

        {/* Encabezado */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600">
              <Settings className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Parametrización de Fórmulas NIIF</h1>
              <p className="text-sm text-zinc-500">Configuración avanzada por empresa y filtrado por elemento contable</p>
            </div>
          </div>

          {/* Selector Global de Empresa para esta pantalla */}
          <div className="w-full md:w-72">
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Empresa en Configuración</label>
            <select
              value={empresaSeleccionada}
              onChange={(e) => setEmpresaSeleccionada(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-bold text-indigo-600 focus:outline-none"
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id} className="dark:bg-zinc-900">
                  {emp.razon_social || emp.nombre_comercial}
                </option>
              ))}
            </select>
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

        {/* FORMULARIO DE PARAMETRIZACIÓN */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" /> Editor de Reglas Matemáticas por Indicador
          </h2>

          <form onSubmit={handleGuardarConfiguracion} className="space-y-6 text-sm">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Seleccionar Indicador Financiero</label>
                <select 
                  required
                  value={formConfig.indicador_id}
                  onChange={handleSeleccionarIndicador}
                  className="w-full px-3 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-medium"
                >
                  <option value="" className="dark:bg-zinc-900">Seleccione un indicador...</option>
                  {indicadores.map((ind) => (
                    <option key={ind.id} value={ind.id} className="dark:bg-zinc-900">{ind.nombre} ({ind.categoria})</option>
                  ))}
                </select>

                {/* Tarjeta con fórmula teórica */}
                {indicadorSeleccionado && (
                  <div className="mt-3 p-3.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl space-y-1">
                    <p className="font-bold text-xs text-blue-900 dark:text-blue-200">Fórmula Teórica Oficial:</p>
                    <p className="font-mono text-xs text-blue-700 dark:text-blue-300 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-blue-100">
                      {indicadorSeleccionado.descripcion_formula || "Sin fórmula detallada."}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Nivel de Agrupación NIIF</label>
                <select 
                  value={formConfig.nivel_agrupacion}
                  onChange={(e) => setFormConfig({...formConfig, nivel_agrupacion: e.target.value, numerador_ids: [], numerador_restando_ids: [], denominador_ids: []})}
                  className="w-full px-3 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-semibold text-indigo-600"
                >
                  <option value="concepto_niif" className="dark:bg-zinc-900">1. Concepto General NIIF</option>
                  <option value="subconcepto" className="dark:bg-zinc-900">2. Subconcepto NIIF (Recomendado)</option>
                  <option value="concepto_auxiliar" className="dark:bg-zinc-900">3. Concepto Auxiliar (Detalle máximo)</option>
                </select>
                <p className="text-[11px] text-zinc-400 mt-2">
                  Selecciona el nivel jerárquico contable que deseas asociar a la fórmula de este indicador.
                </p>
              </div>
            </div>

            {/* MARCO 1: NUMERADOR A SUMAR CON FILTRO POR ELEMENTO */}
            <div className="p-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <h3 className="font-bold text-xs uppercase text-zinc-700 dark:text-zinc-300">Elementos del Numerador a Sumar (+)</h3>
                
                {/* Filtro por Elemento Contable */}
                <div className="flex items-center gap-2 text-xs">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-zinc-400">Filtrar Elemento:</span>
                  <select
                    value={filtroElementoNum}
                    onChange={(e) => setFiltroElementoNum(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent font-semibold text-indigo-600"
                  >
                    <option value="TODOS" className="dark:bg-zinc-900">Todos</option>
                    <option value="Activo" className="dark:bg-zinc-900">Activo</option>
                    <option value="Pasivo" className="dark:bg-zinc-900">Pasivo</option>
                    <option value="Patrimonio" className="dark:bg-zinc-900">Patrimonio</option>
                    <option value="Ingresos" className="dark:bg-zinc-900">Ingresos</option>
                    <option value="Gastos" className="dark:bg-zinc-900">Gastos</option>
                    <option value="Costos" className="dark:bg-zinc-900">Costos</option>
                  </select>
                </div>
              </div>

              <select 
                multiple
                className="w-full h-40 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-mono"
                value={formConfig.numerador_ids}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setFormConfig({...formConfig, numerador_ids: values});
                }}
              >
                {filtrarPorElemento(filtroElementoNum).map((el) => (
                  <option key={el.id} value={el.id} className="dark:bg-zinc-900 py-1">
                    [{el.elemento}] {el.codigo} - {el.nombre}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-zinc-400 block">Mantén presionado Ctrl / Cmd para marcar múltiples opciones.</span>
            </div>

            {/* MARCO 2: NUMERADOR A RESTAR CON FILTRO POR ELEMENTO */}
            <div className="p-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <h3 className="font-bold text-xs uppercase text-zinc-700 dark:text-zinc-300">Elementos del Numerador a Restar (-) [Ej: Inventarios para Prueba Ácida]</h3>
                
                <div className="flex items-center gap-2 text-xs">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-zinc-400">Filtrar Elemento:</span>
                  <select
                    value={filtroElementoRest}
                    onChange={(e) => setFiltroElementoRest(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent font-semibold text-indigo-600"
                  >
                    <option value="TODOS" className="dark:bg-zinc-900">Todos</option>
                    <option value="Activo" className="dark:bg-zinc-900">Activo</option>
                    <option value="Pasivo" className="dark:bg-zinc-900">Pasivo</option>
                    <option value="Patrimonio" className="dark:bg-zinc-900">Patrimonio</option>
                    <option value="Ingresos" className="dark:bg-zinc-900">Ingresos</option>
                    <option value="Gastos" className="dark:bg-zinc-900">Gastos</option>
                    <option value="Costos" className="dark:bg-zinc-900">Costos</option>
                  </select>
                </div>
              </div>

              <select 
                multiple
                className="w-full h-36 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-mono"
                value={formConfig.numerador_restando_ids}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setFormConfig({...formConfig, numerador_restando_ids: values});
                }}
              >
                {filtrarPorElemento(filtroElementoRest).map((el) => (
                  <option key={el.id} value={el.id} className="dark:bg-zinc-900 py-1">
                    [{el.elemento}] {el.codigo} - {el.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* MARCO 3: DENOMINADOR CON FILTRO POR ELEMENTO */}
            <div className="p-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <h3 className="font-bold text-xs uppercase text-zinc-700 dark:text-zinc-300">Elementos del Denominador (Divisor)</h3>
                
                <div className="flex items-center gap-2 text-xs">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-zinc-400">Filtrar Elemento:</span>
                  <select
                    value={filtroElementoDen}
                    onChange={(e) => setFiltroElementoDen(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent font-semibold text-indigo-600"
                  >
                    <option value="TODOS" className="dark:bg-zinc-900">Todos</option>
                    <option value="Activo" className="dark:bg-zinc-900">Activo</option>
                    <option value="Pasivo" className="dark:bg-zinc-900">Pasivo</option>
                    <option value="Patrimonio" className="dark:bg-zinc-900">Patrimonio</option>
                    <option value="Ingresos" className="dark:bg-zinc-900">Ingresos</option>
                    <option value="Gastos" className="dark:bg-zinc-900">Gastos</option>
                    <option value="Costos" className="dark:bg-zinc-900">Costos</option>
                  </select>
                </div>
              </div>

              <select 
                multiple
                className="w-full h-36 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-mono"
                value={formConfig.denominador_ids}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setFormConfig({...formConfig, denominador_ids: values});
                }}
              >
                {filtrarPorElemento(filtroElementoDen).map((el) => (
                  <option key={el.id} value={el.id} className="dark:bg-zinc-900 py-1">
                    [{el.elemento}] {el.codigo} - {el.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Tipo de Resultado Final</label>
              <select 
                value={formConfig.operacion_tipo}
                onChange={(e) => setFormConfig({...formConfig, operacion_tipo: e.target.value})}
                className="w-full px-3 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-medium"
              >
                <option value="DIVISION_PORCENTAJE" className="dark:bg-zinc-900">Porcentaje (× 100) [Ej. Margen Neto, Endeudamiento]</option>
                <option value="DIVISION_RAZON" className="dark:bg-zinc-900">Razón / Índice [Ej. Razón Corriente, Prueba Ácida]</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition shadow-sm disabled:opacity-50 text-sm"
            >
              {loading ? "Guardando Parametrización..." : "Guardar Regla de Indicador NIIF"}
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}