"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  TrendingUp, 
  PieChart, 
  Settings,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { calcularIndicadoresDinamicos } from "./finance-actions";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function GestionFinancieraPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [anio, setAnio] = useState<string>("2026");
  const [mes, setMes] = useState<string>("10");

  const [loading, setLoading] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [indicadores, setIndicadores] = useState<{ [key: string]: number }>({});
  const [historico, setHistorico] = useState<any[]>([]);
  const [consultado, setConsultado] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    async function init() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: empData } = await supabase.from("empresas").select("*").order("razon_social");
      if (empData && empData.length > 0) setEmpresas(empData);
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
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data } = await supabase.from("sucursales").select("*").eq("empresa_id", Number(empresaId));
      if (data && data.length > 0) {
        setSucursales(data);
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

    const res = await calcularIndicadoresDinamicos(empresaId, sucursalId, anio, mes);
    if (res.success) {
      setIndicadores(res.indicadores || {});
      setHistorico(res.historico || []);
      setConsultado(true);
    } else {
      setMensajeError(res.error || "No se pudieron calcular los indicadores.");
    }
    setLoading(false);
  };

  if (!isMounted) return null;

  const clavesIndicadores = Object.keys(indicadores);
  const coloresGrafico = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* BARRA SUPERIOR COMPACTA */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-xl shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-zinc-400 hover:text-blue-600 transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-sm font-bold flex items-center gap-1.5">
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

        {/* FILTROS EN UNA FILA */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-5 gap-2.5 items-end text-xs">
          <div>
            <label className="block font-semibold text-zinc-400 mb-0.5">Empresa *</label>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent font-bold text-indigo-600 text-xs"
            >
              <option value="" className="dark:bg-zinc-900">Seleccione empresa...</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id} className="dark:bg-zinc-900">{emp.razon_social || emp.nombre_comercial}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-zinc-400 mb-0.5">Sucursal *</label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              disabled={!empresaId}
              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs disabled:opacity-50 font-semibold"
            >
              <option value="" className="dark:bg-zinc-900">Seleccione sucursal...</option>
              {sucursales.map((suc) => (
                <option key={suc.id} value={suc.id} className="dark:bg-zinc-900">{suc.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-zinc-400 mb-0.5">Año</label>
            <input
              type="text"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-center text-xs font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-400 mb-0.5">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs"
            >
              {Array.from({length: 12}, (_, i) => (
                <option key={i+1} value={String(i+1)} className="dark:bg-zinc-900">Mes {i+1}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={ejecutarConsulta}
              disabled={loading || !empresaId || !sucursalId}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Calculando..." : "Actualizar Indicadores"}
            </button>
          </div>
        </div>

        {mensajeError && (
          <div className="p-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{mensajeError}</span>
          </div>
        )}

        {/* CONTENEDOR DE TARJETAS */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-blue-600" /> Tarjetas de Indicadores (Mes Seleccionado)
          </h2>

          {!consultado ? (
            <div className="p-6 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 text-xs">
              Seleccione Empresa y Sucursal para visualizar los resultados.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(indicadores).map(([codigo, valor]) => (
                <div key={codigo} className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">{codigo}</p>
                  <h3 className="text-lg font-black text-blue-600 mt-1">{valor}</h3>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECCIÓN DE GRÁFICOS RECHARTS */}
        {consultado && historico.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            
            {/* GRÁFICO DE LÍNEAS */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tendencia Anual (Mes 1 al 12)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historico}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="mes" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip />
                    <Legend wrapperStyle={{fontSize: '11px'}} />
                    {clavesIndicadores.map((key, idx) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={coloresGrafico[idx % coloresGrafico.length]} strokeWidth={2} dot={{r: 3}} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRÁFICO DE BARRAS */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Comportamiento Mensual del Año</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historico}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="mes" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip />
                    <Legend wrapperStyle={{fontSize: '11px'}} />
                    {clavesIndicadores.map((key, idx) => (
                      <Bar key={key} dataKey={key} fill={coloresGrafico[idx % coloresGrafico.length]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}