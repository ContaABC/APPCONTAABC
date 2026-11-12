"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  TrendingUp, 
  PieChart, 
  Settings,
  RefreshCw,
  AlertCircle,
  Scale,
  FileText,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { calcularIndicadoresDinamicos } from "./finance-actions";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface Empresa {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  [key: string]: unknown;
}

interface Sucursal {
  id: number | string;
  nombre: string;
  [key: string]: unknown;
}

interface IndicadorDato {
  valor: number;
  varAbs?: number;
  varPorc?: number;
}

export default function GestionFinancieraPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [anio, setAnio] = useState<string>("2026");
  const [mes, setMes] = useState<string>("10");
  const [compararAnioAnterior, setCompararAnioAnterior] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [mensajeError, setMensajeError] = useState<string>("");
  
  const [indicadores, setIndicadores] = useState<Record<string, IndicadorDato | number>>({});
  const [balance, setBalance] = useState<Record<string, IndicadorDato | number>>({});
  const [resultadosOp, setResultadosOp] = useState<Record<string, IndicadorDato | number>>({});
  const [modoComparativoActivo, setModoComparativoActivo] = useState<boolean>(false);
  
  const [historico, setHistorico] = useState<Record<string, any>[]>([]);
  const [historicoBalance, setHistoricoBalance] = useState<Record<string, any>[]>([]);
  const [historicoResultados, setHistoricoResultados] = useState<Record<string, any>[]>([]);
  
  const [consultado, setConsultado] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    async function init() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: empData } = await supabase.from("empresas").select("*").order("razon_social");
      if (empData && empData.length > 0) setEmpresas(empData as Empresa[]);
    }
    init();
  }, []);

  useEffect(() => {
    if (!empresaId) {
      setSucursales([]);
      setSucursalId("");
      return;
    }
    async function cargarSucursalesEmpresa() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data } = await supabase.from("sucursales").select("*").eq("empresa_id", Number(empresaId));
      if (data && data.length > 0) {
        setSucursales(data as Sucursal[]);
        setSucursalId(String(data[0].id));
      } else {
        setSucursales([]);
        setSucursalId("");
      }
    }
    cargarSucursalesEmpresa();
  }, [empresaId]);

  const ejecutarConsulta = async () => {
    if (!empresaId || !sucursalId) {
      setMensajeError("Debe seleccionar una Empresa y una Sucursal.");
      return;
    }

    setLoading(true);
    setMensajeError("");

    const res = await calcularIndicadoresDinamicos(empresaId, sucursalId, anio, mes, compararAnioAnterior);
    if (res.success) {
      setIndicadores(res.indicadores || {});
      setBalance(res.balance || {});
      setResultadosOp(res.resultadosOp || {});
      setModoComparativoActivo(res.modoComparativo || false);
      setHistorico(res.historico || []);
      setHistoricoBalance(res.historicoBalance || []);
      setHistoricoResultados(res.historicoResultados || []);
      setConsultado(true);
    } else {
      setMensajeError(res.error || "No se pudieron calcular los datos.");
    }
    setLoading(false);
  };

  const fmt = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "0";
    return val.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  if (!isMounted) return null;

  const clavesIndicadores = Object.keys(indicadores);
  const coloresGrafico = ["#06b6d4", "#2563eb", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6"];

  // Helpers seguros para evitar errores de objetos "undefined"
  const getValorSeguro = (item: IndicadorDato | number | undefined): number => {
    if (item === undefined || item === null) return 0;
    return typeof item === 'object' ? item.valor : item;
  };

  const getVarPorcSeguro = (item: IndicadorDato | number | undefined): number => {
    if (item === undefined || item === null || typeof item !== 'object') return 0;
    return item.varPorc ?? 0;
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* BARRA SUPERIOR COMPACTA CON ENLACE DIRECTO AL MENÚ DE MÓDULOS MAYORES */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-xl shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Link 
              href="/" 
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-blue-600 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition"
              title="Volver al menú de módulos"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Menú Módulos
            </Link>
            <h1 className="text-sm font-bold flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-800">
              <TrendingUp className="w-4 h-4 text-blue-600" /> Gestión Financiera y Analítica NIIF
            </h1>
          </div>
          <Link 
            href="/modulos/gestion-financiera/configuracion" 
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 rounded-lg border border-indigo-200 transition"
          >
            <Settings className="w-3.5 h-3.5" /> Configurar Indicadores
          </Link>
        </div>

        {/* FILTROS OPTIMIZADOS: EMPRESA Y SUCURSAL AMPLIOS, AÑO Y MES MÍNIMOS */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end text-xs">
          
          <div className="lg:col-span-3">
            <label className="block font-semibold text-zinc-400 mb-0.5">Empresa *</label>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-bold text-indigo-600 text-xs cursor-pointer"
            >
              <option value="" className="dark:bg-zinc-900">Seleccione empresa...</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id} className="dark:bg-zinc-900">{emp.razon_social || emp.nombre_comercial}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="block font-semibold text-zinc-400 mb-0.5">Sucursal *</label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              disabled={!empresaId}
              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs disabled:opacity-50 font-semibold cursor-pointer"
            >
              <option value="" className="dark:bg-zinc-900">Seleccione sucursal...</option>
              {sucursales.map((suc) => (
                <option key={suc.id} value={suc.id} className="dark:bg-zinc-900">{suc.nombre}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-1">
            <label className="block font-semibold text-zinc-400 mb-0.5">Año</label>
            <input
              type="text"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              className="w-full px-1.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-center text-xs font-medium"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="block font-semibold text-zinc-400 mb-0.5">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-full px-1.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs cursor-pointer"
            >
              {Array.from({length: 12}, (_, i) => (
                <option key={i+1} value={String(i+1)} className="dark:bg-zinc-900">{i+1}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center h-[34px] px-1">
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-zinc-600 dark:text-zinc-300 font-medium text-[11px] leading-tight">
              <input
                type="checkbox"
                checked={compararAnioAnterior}
                onChange={(e) => setCompararAnioAnterior(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 flex-shrink-0 cursor-pointer"
              />
              <span>Comparar ant. ({Number(anio) - 1})</span>
            </label>
          </div>

          <div className="lg:col-span-2">
            <button
              onClick={ejecutarConsulta}
              disabled={loading || !empresaId || !sucursalId}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1 text-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Calculando..." : "Actualizar"}
            </button>
          </div>

        </div>

        {mensajeError && (
          <div className="p-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{mensajeError}</span>
          </div>
        )}

        {!consultado ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 text-xs">
            Seleccione Empresa y Sucursal para visualizar el panel directivo financiero.
          </div>
        ) : (
          /* ESTRUCTURA A 2 COLUMNAS PERFECTAS */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* COLUMNA IZQUIERDA: INDICADORES FINANCIEROS Y SU GRÁFICA */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                  <PieChart className="w-4 h-4" /> Indicadores Financieros (Mes Seleccionado)
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.entries(indicadores).map(([codigo, datos], idx) => {
                    const colorLinea = coloresGrafico[idx % coloresGrafico.length];
                    const val = getValorSeguro(datos);
                    const varPorc = getVarPorcSeguro(datos);

                    return (
                      <div key={codigo} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 shadow-sm space-y-1">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">{codigo}</p>
                        <div className="flex justify-between items-baseline">
                          {modoComparativoActivo && (
                            <span className={`text-[10px] font-bold flex items-center ${varPorc >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {varPorc >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {varPorc > 0 ? `+${varPorc}%` : `${varPorc}%`}
                            </span>
                          )}
                          <h3 className="text-base font-black text-right ml-auto" style={{ color: colorLinea }}>
                            {fmt(val)}
                          </h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GRÁFICA DE INDICADORES */}
              {historico.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tendencia Anual - Indicadores</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historico}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="mes" tick={{fontSize: 10}} />
                        <YAxis tick={{fontSize: 10}} />
                        <Tooltip />
                        <Legend wrapperStyle={{fontSize: '10px'}} />
                        {clavesIndicadores.map((key, idx) => (
                          <Line key={key} type="monotone" dataKey={key} stroke={coloresGrafico[idx % coloresGrafico.length]} strokeWidth={2} dot={{r: 2}} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: BALANCE GENERAL (ARRIBA) Y ESTADO DE RESULTADOS (ABAJO) */}
            <div className="space-y-4">
              
              {/* 1. BALANCE GENERAL */}
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                  <Scale className="w-4 h-4" /> Balance General (Activo, Pasivo, Patrimonio)
                </h2>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* ACTIVO */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 shadow-sm space-y-1">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Activo</p>
                    {modoComparativoActivo && (
                      <div className={`text-[10px] font-bold flex items-center justify-end ${getVarPorcSeguro(balance.ACTIVO) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {getVarPorcSeguro(balance.ACTIVO) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {getVarPorcSeguro(balance.ACTIVO) > 0 ? `+${getVarPorcSeguro(balance.ACTIVO)}%` : `${getVarPorcSeguro(balance.ACTIVO)}%`}
                      </div>
                    )}
                    <h3 className="text-sm font-black text-[#4f46e5] text-right">{fmt(getValorSeguro(balance.ACTIVO))}</h3>
                  </div>

                  {/* PASIVO */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 shadow-sm space-y-1">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Pasivo</p>
                    {modoComparativoActivo && (
                      <div className={`text-[10px] font-bold flex items-center justify-end ${getVarPorcSeguro(balance.PASIVO) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {getVarPorcSeguro(balance.PASIVO) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {getVarPorcSeguro(balance.PASIVO) > 0 ? `+${getVarPorcSeguro(balance.PASIVO)}%` : `${getVarPorcSeguro(balance.PASIVO)}%`}
                      </div>
                    )}
                    <h3 className="text-sm font-black text-[#f43f5e] text-right">{fmt(getValorSeguro(balance.PASIVO))}</h3>
                  </div>

                  {/* PATRIMONIO */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 shadow-sm space-y-1">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase" title="Incluye Utilidad del Periodo">Patrimonio (+Util)</p>
                    {modoComparativoActivo && (
                      <div className={`text-[10px] font-bold flex items-center justify-end ${getVarPorcSeguro(balance.PATRIMONIO) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {getVarPorcSeguro(balance.PATRIMONIO) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {getVarPorcSeguro(balance.PATRIMONIO) > 0 ? `+${getVarPorcSeguro(balance.PATRIMONIO)}%` : `${getVarPorcSeguro(balance.PATRIMONIO)}%`}
                      </div>
                    )}
                    <h3 className="text-sm font-black text-[#10b981] text-right">{fmt(getValorSeguro(balance.PATRIMONIO))}</h3>
                  </div>
                </div>
              </div>

              {/* GRÁFICA DE BALANCE */}
              {historicoBalance.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Evolución Anual - Balance General</h3>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={historicoBalance}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="mes" tick={{fontSize: 10}} />
                        <YAxis tick={{fontSize: 10}} />
                        <Tooltip />
                        <Legend wrapperStyle={{fontSize: '10px'}} />
                        <Bar dataKey="ACTIVO" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="PASIVO" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="PATRIMONIO" fill="#10b981" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 2. ESTADO DE RESULTADOS */}
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Estado de Resultados (Ingresos, Gastos, Costos, Utilidad)
                </h2>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* INGRESOS */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 shadow-sm space-y-1">
                    <p className="text-[9px] text-zinc-400 font-bold uppercase">Ingresos</p>
                    {modoComparativoActivo && (
                      <div className={`text-[9px] font-bold flex items-center justify-end ${getVarPorcSeguro(resultadosOp.INGRESOS) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {getVarPorcSeguro(resultadosOp.INGRESOS) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {getVarPorcSeguro(resultadosOp.INGRESOS) > 0 ? `+${getVarPorcSeguro(resultadosOp.INGRESOS)}%` : `${getVarPorcSeguro(resultadosOp.INGRESOS)}%`}
                      </div>
                    )}
                    <h3 className="text-sm font-black text-emerald-600 text-right">{fmt(getValorSeguro(resultadosOp.INGRESOS))}</h3>
                  </div>

                  {/* COSTOS */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 shadow-sm space-y-1">
                    <p className="text-[9px] text-zinc-400 font-bold uppercase">Costos</p>
                    {modoComparativoActivo && (
                      <div className={`text-[9px] font-bold flex items-center justify-end ${getVarPorcSeguro(resultadosOp.COSTOS) <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {getVarPorcSeguro(resultadosOp.COSTOS) <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {getVarPorcSeguro(resultadosOp.COSTOS) > 0 ? `+${getVarPorcSeguro(resultadosOp.COSTOS)}%` : `${getVarPorcSeguro(resultadosOp.COSTOS)}%`}
                      </div>
                    )}
                    <h3 className="text-sm font-black text-amber-600 text-right">{fmt(getValorSeguro(resultadosOp.COSTOS))}</h3>
                  </div>

                  {/* GASTOS */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 shadow-sm space-y-1">
                    <p className="text-[9px] text-zinc-400 font-bold uppercase">Gastos</p>
                    {modoComparativoActivo && (
                      <div className={`text-[9px] font-bold flex items-center justify-end ${getVarPorcSeguro(resultadosOp.GASTOS) <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {getVarPorcSeguro(resultadosOp.GASTOS) <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {getVarPorcSeguro(resultadosOp.GASTOS) > 0 ? `+${getVarPorcSeguro(resultadosOp.GASTOS)}%` : `${getVarPorcSeguro(resultadosOp.GASTOS)}%`}
                      </div>
                    )}
                    <h3 className="text-sm font-black text-rose-600 text-right">{fmt(getValorSeguro(resultadosOp.GASTOS))}</h3>
                  </div>

                  {/* UTILIDAD */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 shadow-sm space-y-1">
                    <p className="text-[9px] text-zinc-400 font-bold uppercase">Utilidad</p>
                    {modoComparativoActivo && (
                      <div className={`text-[9px] font-bold flex items-center justify-end ${getVarPorcSeguro(resultadosOp.UTILIDAD) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {getVarPorcSeguro(resultadosOp.UTILIDAD) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {getVarPorcSeguro(resultadosOp.UTILIDAD) > 0 ? `+${getVarPorcSeguro(resultadosOp.UTILIDAD)}%` : `${getVarPorcSeguro(resultadosOp.UTILIDAD)}%`}
                      </div>
                    )}
                    <h3 className="text-sm font-black text-blue-600 text-right">{fmt(getValorSeguro(resultadosOp.UTILIDAD))}</h3>
                  </div>
                </div>

                {/* GRÁFICA DE RESULTADOS & UTILIDAD */}
                {historicoResultados.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tendencia Anual - Resultados y Utilidad</h3>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historicoResultados}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="mes" tick={{fontSize: 10}} />
                          <YAxis tick={{fontSize: 10}} />
                          <Tooltip />
                          <Legend wrapperStyle={{fontSize: '10px'}} />
                          <Line type="monotone" dataKey="INGRESOS" stroke="#10b981" strokeWidth={2} dot={{r: 2}} />
                          <Line type="monotone" dataKey="COSTOS" stroke="#f59e0b" strokeWidth={2} dot={{r: 2}} />
                          <Line type="monotone" dataKey="GASTOS" stroke="#ef4444" strokeWidth={2} dot={{r: 2}} />
                          <Line type="monotone" dataKey="UTILIDAD" stroke="#2563eb" strokeWidth={3} dot={{r: 3}} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}