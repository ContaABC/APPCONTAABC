"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, CheckCircle2, Layers, Plus } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export default function ConfigurarFormulasIndicadorPage() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<string>("");
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>("");
  
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [indicadorSeleccionado, setIndicadorSeleccionado] = useState<any>(null);
  
  const [listaConceptos, setListaConceptos] = useState<any[]>([]);
  const [listaSubconceptos, setListaSubconceptos] = useState<any[]>([]);
  const [listaAuxiliares, setListaAuxiliares] = useState<any[]>([]);

  // Estados opcionales para mostrar/ocultar secciones de resta
  const [mostrarRestandoNum, setMostrarRestandoNum] = useState(false);
  const [mostrarRestandoDen, setMostrarRestandoDen] = useState(false);

  const [nuevoInd, setNuevoInd] = useState({
    codigo: "",
    nombre: "",
    categoria: "Rentabilidad",
    descripcion_formula: "",
  });

  // Filtros
  const [filtroElementoNum, setFiltroElementoNum] = useState<string>("TODOS");
  const [filtroClasifNum, setFiltroClasifNum] = useState<string>("TODOS");
  const [filtroElementoNumRest, setFiltroElementoNumRest] = useState<string>("TODOS");
  const [filtroClasifNumRest, setFiltroClasifNumRest] = useState<string>("TODOS");

  const [filtroElementoDen, setFiltroElementoDen] = useState<string>("TODOS");
  const [filtroClasifDen, setFiltroClasifDen] = useState<string>("TODOS");
  const [filtroElementoDenRest, setFiltroElementoDenRest] = useState<string>("TODOS");
  const [filtroClasifDenRest, setFiltroClasifDenRest] = useState<string>("TODOS");

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  const [formConfig, setFormConfig] = useState({
    indicador_id: "",
    nivel_agrupacion: "concepto_niif",
    numerador_ids: [] as string[],
    operacion_numerador: "SUMA",
    numerador_restando_ids: [] as string[],
    denominador_ids: [] as string[],
    denominador_restando_ids: [] as string[],
    operacion_tipo: "DIVISION_RAZON",
  });

  useEffect(() => {
    cargarEmpresasEIndicadores();
  }, []);

  const cargarEmpresasEIndicadores = async () => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data: empData } = await supabase.from("empresas").select("*").order("razon_social");
    if (empData && empData.length > 0) {
      setEmpresas(empData);
      setEmpresaSeleccionada(String(empData[0].id));
    }

    const { data: indData } = await supabase.from("indicadores_financieros").select("*").order("nombre");
    if (indData) setIndicadores(indData);
  };

  useEffect(() => {
    if (!empresaSeleccionada) return;
    cargarSucursalesYCatalogos(empresaSeleccionada);
  }, [empresaSeleccionada]);

  const cargarSucursalesYCatalogos = async (empId: string) => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data: sucData } = await supabase.from("sucursales").select("*").eq("empresa_id", Number(empId));
    if (sucData && sucData.length > 0) {
      setSucursales(sucData);
      setSucursalSeleccionada(String(sucData[0].id));
    } else {
      setSucursales([]);
      setSucursalSeleccionada("");
    }

    const { data: concData } = await supabase.from("conceptos_niif").select("*").eq("empresa_id", empId).order("codigo_concepto");
    if (concData) setListaConceptos(concData);

    const { data: subData } = await supabase.from("subconceptos_niif").select("*").eq("empresa_id", empId).order("codigo");
    if (subData) setListaSubconceptos(subData);

    const { data: auxData } = await supabase.from("conceptos_auxiliares").select("*").eq("empresa_id", empId).order("codigo_auxiliar");
    if (auxData) setListaAuxiliares(auxData);
  };

  const handleSeleccionarIndicador = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setFormConfig(prev => ({ ...prev, indicador_id: id }));
    const encontrado = indicadores.find(i => String(i.id) === id);
    setIndicadorSeleccionado(encontrado || null);

    if (!id || !empresaSeleccionada || !sucursalSeleccionada) return;

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    const { data } = await supabase
      .from("indicadores_formulas_detalle")
      .select("*")
      .eq("indicador_id", Number(id))
      .eq("empresa_id", Number(empresaSeleccionada))
      .eq("sucursal_id", Number(sucursalSeleccionada));

    if (data && data.length > 0) {
      const param = data[0];
      const nivelGuardado = param.nivel_agrupacion || "concepto_niif";

      setFormConfig({
        indicador_id: id,
        nivel_agrupacion: nivelGuardado,
        numerador_ids: param.numerador_ids ? param.numerador_ids.split(",").map((s: string) => s.trim()) : [],
        operacion_numerador: param.operacion_numerador || "SUMA",
        numerador_restando_ids: param.numerador_restando_ids ? param.numerador_restando_ids.split(",").map((s: string) => s.trim()) : [],
        denominador_ids: param.denominador_ids ? param.denominador_ids.split(",").map((s: string) => s.trim()) : [],
        denominador_restando_ids: param.denominador_restando_ids ? param.denominador_restando_ids.split(",").map((s: string) => s.trim()) : [],
        operacion_tipo: param.operacion_tipo || "DIVISION_RAZON",
      });

      if (param.numerador_restando_ids && param.numerador_restando_ids.trim() !== "") setMostrarRestandoNum(true);
      if (param.denominador_restando_ids && param.denominador_restando_ids.trim() !== "") setMostrarRestandoDen(true);

      setMensaje({ texto: "¡Parametrización cargada con éxito!", tipo: "success" });
    } else {
      setFormConfig(prev => ({
        ...prev,
        numerador_ids: [],
        numerador_restando_ids: [],
        denominador_ids: [],
        denominador_restando_ids: []
      }));
      setMensaje({ texto: "", tipo: "" });
    }
  };

  const handleCrearIndicador = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    const { error } = await supabase.from("indicadores_financieros").insert([nuevoInd]);
    if (!error) {
      setMensaje({ texto: "¡Indicador creado con éxito!", tipo: "success" });
      setNuevoInd({ codigo: "", nombre: "", categoria: "Rentabilidad", descripcion_formula: "" });
      const { data: indData } = await supabase.from("indicadores_financieros").select("*").order("nombre");
      if (indData) setIndicadores(indData);
    } else {
      setMensaje({ texto: error.message, tipo: "error" });
    }
  };

  const handleGuardarConfiguracion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaSeleccionada || !sucursalSeleccionada) {
      setMensaje({ texto: "Debe seleccionar Empresa y Sucursal obligatoriamente.", tipo: "error" });
      return;
    }

    setLoading(true);
    setMensaje({ texto: "", tipo: "" });
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const payload = {
      empresa_id: Number(empresaSeleccionada),
      sucursal_id: Number(sucursalSeleccionada),
      indicador_id: Number(formConfig.indicador_id),
      nivel_agrupacion: formConfig.nivel_agrupacion,
      numerador_ids: formConfig.numerador_ids.join(","),
      operacion_numerador: formConfig.operacion_numerador,
      numerador_restando_ids: mostrarRestandoNum ? formConfig.numerador_restando_ids.join(",") : "",
      denominador_ids: formConfig.denominador_ids.join(","),
      denominador_restando_ids: mostrarRestandoDen ? formConfig.denominador_restando_ids.join(",") : "",
      operacion_tipo: formConfig.operacion_tipo,
    };

    const { error } = await supabase
      .from("indicadores_formulas_detalle")
      .upsert([payload], { onConflict: 'indicador_id,empresa_id,sucursal_id' });

    if (!error) {
      setMensaje({ texto: "¡Parametrización guardada correctamente!", tipo: "success" });
    } else {
      setMensaje({ texto: error.message, tipo: "error" });
    }
    setLoading(false);
  };

  const obtenerElementosBase = () => {
    if (formConfig.nivel_agrupacion === "concepto_niif") {
      return listaConceptos.map(c => ({ id: c.id, codigo: c.codigo_concepto, nombre: c.nombre, elemento: c.elemento || "GENERAL", clasificacion: c.clasificacion_balance || "N/A" }));
    } else if (formConfig.nivel_agrupacion === "subconcepto") {
      return listaSubconceptos.map(s => ({ id: s.id, codigo: s.codigo, nombre: s.nombre, elemento: s.elemento || "GENERAL", clasificacion: s.clasificacion_balance || "N/A" }));
    } else {
      return listaAuxiliares.map(a => ({ id: a.id, codigo: a.codigo_auxiliar, nombre: a.nombre, elemento: a.elemento || "GENERAL", clasificacion: a.clasificacion_balance || "N/A" }));
    }
  };

  const elementosBase = obtenerElementosBase();

  const filtrarElementos = (elemento: string, clasificacion: string) => {
    return elementosBase.filter(el => {
      const matchElem = elemento === "TODOS" || el.elemento?.toUpperCase() === elemento.toUpperCase();
      const matchClasif = clasificacion === "TODOS" || el.clasificacion?.toUpperCase() === clasificacion.toUpperCase();
      return matchElem && matchClasif;
    });
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* ENCABEZADO */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Link href="/modulos/gestion-financiera" className="text-zinc-400 hover:text-blue-600 transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-sm font-bold flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-indigo-600" /> Parametrización de Indicadores NIIF
            </h1>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={empresaSeleccionada}
              onChange={(e) => setEmpresaSeleccionada(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-bold text-indigo-600"
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id} className="dark:bg-zinc-900">{emp.razon_social || emp.nombre_comercial}</option>
              ))}
            </select>

            <select
              value={sucursalSeleccionada}
              onChange={(e) => setSucursalSeleccionada(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-medium"
            >
              {sucursales.map((suc) => (
                <option key={suc.id} value={suc.id} className="dark:bg-zinc-900">{suc.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {mensaje.texto && (
          <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
            mensaje.tipo === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{mensaje.texto}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* NUEVO INDICADOR */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm space-y-3 lg:col-span-1">
            <h2 className="text-xs font-bold flex items-center gap-1.5 text-indigo-600 uppercase">
              <Plus className="w-3.5 h-3.5" /> Registrar Nuevo Indicador
            </h2>
            <form onSubmit={handleCrearIndicador} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">Código Único</label>
                <input 
                  type="text" 
                  required 
                  value={nuevoInd.codigo}
                  onChange={(e) => setNuevoInd({...nuevoInd, codigo: e.target.value.toUpperCase()})}
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
                  placeholder="MARGEN_NETO"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">Nombre</label>
                <input 
                  type="text" 
                  required 
                  value={nuevoInd.nombre}
                  onChange={(e) => setNuevoInd({...nuevoInd, nombre: e.target.value})}
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
                  placeholder="Ej. Margen Neto"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">Categoría</label>
                <select 
                  value={nuevoInd.categoria}
                  onChange={(e) => setNuevoInd({...nuevoInd, categoria: e.target.value})}
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
                >
                  <option value="Rentabilidad" className="dark:bg-zinc-900">Rentabilidad</option>
                  <option value="Liquidez" className="dark:bg-zinc-900">Liquidez</option>
                  <option value="Endeudamiento" className="dark:bg-zinc-900">Endeudamiento</option>
                  <option value="Eficiencia" className="dark:bg-zinc-900">Eficiencia</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">Fórmula Teórica</label>
                <input 
                  type="text" 
                  required 
                  value={nuevoInd.descripcion_formula}
                  onChange={(e) => setNuevoInd({...nuevoInd, descripcion_formula: e.target.value})}
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
                  placeholder="Ej. (A - B) / (C - D)"
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition">
                Guardar Indicador
              </button>
            </form>
          </div>

          {/* EDITOR DE REGLAS */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm space-y-3 lg:col-span-2">
            <h2 className="text-xs font-bold flex items-center gap-1.5 text-indigo-600 uppercase">
              <Layers className="w-3.5 h-3.5" /> Editor de Reglas Matemáticas
            </h2>

            <form onSubmit={handleGuardarConfiguracion} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">Seleccionar Indicador</label>
                  <select 
                    required
                    value={formConfig.indicador_id}
                    onChange={handleSeleccionarIndicador}
                    className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-medium"
                  >
                    <option value="" className="dark:bg-zinc-900">Seleccione indicador...</option>
                    {indicadores.map((ind) => (
                      <option key={ind.id} value={ind.id} className="dark:bg-zinc-900">{ind.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">Nivel de Agrupación NIIF</label>
                  <select 
                    value={formConfig.nivel_agrupacion}
                    onChange={(e) => setFormConfig({...formConfig, nivel_agrupacion: e.target.value, numerador_ids: [], numerador_restando_ids: [], denominador_ids: [], denominador_restando_ids: []})}
                    className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-bold text-indigo-600"
                  >
                    <option value="concepto_niif" className="dark:bg-zinc-900">1. Concepto General NIIF</option>
                    <option value="subconcepto" className="dark:bg-zinc-900">2. Subconcepto NIIF</option>
                    <option value="concepto_auxiliar" className="dark:bg-zinc-900">3. Concepto Auxiliar (Detalle)</option>
                  </select>
                </div>
              </div>

              {indicadorSeleccionado && (
                <div className="p-2 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 rounded-lg text-[11px]">
                  <span className="font-bold text-blue-900 dark:text-blue-200">Fórmula: </span>
                  <span className="font-mono text-blue-700 dark:text-blue-300">{indicadorSeleccionado.descripcion_formula}</span>
                </div>
              )}

              {/* NUMERADOR SUMA (+) */}
              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[10px] uppercase text-zinc-700 dark:text-zinc-300">Numerador (+)</span>
                  <div className="flex gap-1.5 text-[10px]">
                    <select
                      value={filtroElementoNum}
                      onChange={(e) => setFiltroElementoNum(e.target.value)}
                      className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-indigo-600 font-semibold"
                    >
                      <option value="TODOS">Elemento: Todos</option>
                      <option value="Activo">Activo</option>
                      <option value="Pasivo">Pasivo</option>
                      <option value="Patrimonio">Patrimonio</option>
                      <option value="Ingresos">Ingresos</option>
                      <option value="Gastos">Gastos</option>
                      <option value="Costos">Costos</option>
                    </select>
                    <select
                      value={filtroClasifNum}
                      onChange={(e) => setFiltroClasifNum(e.target.value)}
                      className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-indigo-600 font-semibold"
                    >
                      <option value="TODOS">Clasif: Todas</option>
                      <option value="Corriente">Corriente</option>
                      <option value="No Corriente">No Corriente</option>
                    </select>
                  </div>
                </div>

                <select 
                  multiple
                  className="w-full h-20 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-mono text-[11px]"
                  value={formConfig.numerador_ids}
                  onChange={(e) => setFormConfig({...formConfig, numerador_ids: Array.from(e.target.selectedOptions, o => o.value)})}
                >
                  {filtrarElementos(filtroElementoNum, filtroClasifNum).map((el) => (
                    <option key={el.id} value={el.id} className="dark:bg-zinc-900 py-0.5">
                      [{el.elemento} | {el.clasificacion}] {el.codigo} - {el.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* NUMERADOR RESTANDO (-) */}
              <div>
                {!mostrarRestandoNum ? (
                  <button
                    type="button"
                    onClick={() => setMostrarRestandoNum(true)}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    + Agregar elementos a restar (-) en el numerador (Opcional)
                  </button>
                ) : (
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[10px] uppercase text-zinc-700 dark:text-zinc-300">Numerador Restando (-)</span>
                      <button
                        type="button"
                        onClick={() => { setMostrarRestandoNum(false); setFormConfig(prev => ({...prev, numerador_restando_ids: []})); }}
                        className="text-[10px] text-red-500 hover:underline font-semibold"
                      >
                        Ocultar / Quitar
                      </button>
                    </div>

                    <select 
                      multiple
                      className="w-full h-20 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-mono text-[11px]"
                      value={formConfig.numerador_restando_ids}
                      onChange={(e) => setFormConfig({...formConfig, numerador_restando_ids: Array.from(e.target.selectedOptions, o => o.value)})}
                    >
                      {filtrarElementos(filtroElementoNumRest, filtroClasifNumRest).map((el) => (
                        <option key={el.id} value={el.id} className="dark:bg-zinc-900 py-0.5">
                          [{el.elemento} | {el.clasificacion}] {el.codigo} - {el.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* DENOMINADOR SUMA (+) */}
              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[10px] uppercase text-zinc-700 dark:text-zinc-300">Denominador (+)</span>
                  <div className="flex gap-1.5 text-[10px]">
                    <select
                      value={filtroElementoDen}
                      onChange={(e) => setFiltroElementoDen(e.target.value)}
                      className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-indigo-600 font-semibold"
                    >
                      <option value="TODOS">Elemento: Todos</option>
                      <option value="Activo">Activo</option>
                      <option value="Pasivo">Pasivo</option>
                      <option value="Patrimonio">Patrimonio</option>
                      <option value="Ingresos">Ingresos</option>
                      <option value="Gastos">Gastos</option>
                      <option value="Costos">Costos</option>
                    </select>
                    <select
                      value={filtroClasifDen}
                      onChange={(e) => setFiltroClasifDen(e.target.value)}
                      className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-indigo-600 font-semibold"
                    >
                      <option value="TODOS">Clasif: Todas</option>
                      <option value="Corriente">Corriente</option>
                      <option value="No Corriente">No Corriente</option>
                    </select>
                  </div>
                </div>

                <select 
                  multiple
                  className="w-full h-20 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-mono text-[11px]"
                  value={formConfig.denominador_ids}
                  onChange={(e) => setFormConfig({...formConfig, denominador_ids: Array.from(e.target.selectedOptions, o => o.value)})}
                >
                  {filtrarElementos(filtroElementoDen, filtroClasifDen).map((el) => (
                    <option key={el.id} value={el.id} className="dark:bg-zinc-900 py-0.5">
                      [{el.elemento} | {el.clasificacion}] {el.codigo} - {el.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* DENOMINADOR RESTANDO (-) */}
              <div>
                {!mostrarRestandoDen ? (
                  <button
                    type="button"
                    onClick={() => setMostrarRestandoDen(true)}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    + Agregar elementos a restar (-) en el denominador (Opcional)
                  </button>
                ) : (
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[10px] uppercase text-zinc-700 dark:text-zinc-300">Denominador Restando (-)</span>
                      <button
                        type="button"
                        onClick={() => { setMostrarRestandoDen(false); setFormConfig(prev => ({...prev, denominador_restando_ids: []})); }}
                        className="text-[10px] text-red-500 hover:underline font-semibold"
                      >
                        Ocultar / Quitar
                      </button>
                    </div>

                    <select 
                      multiple
                      className="w-full h-20 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-mono text-[11px]"
                      value={formConfig.denominador_restando_ids}
                      onChange={(e) => setFormConfig({...formConfig, denominador_restando_ids: Array.from(e.target.selectedOptions, o => o.value)})}
                    >
                      {filtrarElementos(filtroElementoDenRest, filtroClasifDenRest).map((el) => (
                        <option key={el.id} value={el.id} className="dark:bg-zinc-900 py-0.5">
                          [{el.elemento} | {el.clasificacion}] {el.codigo} - {el.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">Tipo de Resultado</label>
                <select 
                  value={formConfig.operacion_tipo}
                  onChange={(e) => setFormConfig({...formConfig, operacion_tipo: e.target.value})}
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-medium"
                >
                  <option value="DIVISION_RAZON" className="dark:bg-zinc-900">Razón / Índice (Ej. 2.5)</option>
                  <option value="DIVISION_PORCENTAJE" className="dark:bg-zinc-900">Porcentaje (Ej. 45.2%)</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition shadow-sm disabled:opacity-50 text-xs"
              >
                {loading ? "Guardando..." : "Guardar o Actualizar Parametrización"}
              </button>
            </form>
          </div>

        </div>

      </div>
    </main>
  );
}