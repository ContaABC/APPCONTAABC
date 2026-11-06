"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  TrendingUp, 
  PieChart, 
  BarChart3, 
  Settings,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { calcularIndicadoresDinamicos } from "./finance-actions";

export default function GestionFinancieraPage() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  
  const [empresaId, setEmpresaId] = useState<string>("todas");
  const [sucursalId, setSucursalId] = useState<string>("todas");
  const [anio, setAnio] = useState<string>("2026");
  const [mes, setMes] = useState<string>("10");

  const [loading, setLoading] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [indicadores, setIndicadores] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    async function init() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // 1. Cargar empresas ORDENADAS ALFABÉTICAMENTE
      const { data: empData } = await supabase
        .from("empresas")
        .select("*")
        .order("razon_social", { ascending: true });
      if (empData) setEmpresas(empData);

      ejecutarConsulta("todas", "todas", "2026", "10");
    }
    init();
  }, []);

  const ejecutarConsulta = async (emp: string, suc: string, yr: string, mth: string) => {
    setLoading(true);
    setMensajeError("");

    const res = await calcularIndicadoresDinamicos(emp, suc, yr, mth);
    if (res.success && res.indicadores) {
      setIndicadores(res.indicadores);
    } else {
      setMensajeError(res.error || "No se pudieron calcular los indicadores.");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 transition">
            <ArrowLeft className="w-4 h-4" /> Volver al Menú Principal
          </Link>
          <Link 
            href="/modulos/gestion-financiera/configuracion" 
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 rounded-xl border border-indigo-200 dark:border-indigo-900 transition shadow-sm"
          >
            <Settings className="w-4 h-4" /> Crear y Configurar Indicadores NIIF
          </Link>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-blue-600">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Gestión Financiera y Analítica NIIF</h1>
              <p className="text-sm text-zinc-500">Panel directivo conectado al catálogo dinámico de indicadores</p>
            </div>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950 px-3 py-1.5 rounded-full border border-blue-200">
              <RefreshCw className="w-4 h-4 animate-spin" /> Procesando...
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Empresa</label>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-blue-600"
            >
              <option value="todas" className="dark:bg-zinc-900">Todas (Consolidado Corporativo)</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id} className="dark:bg-zinc-900">{emp.razon_social || emp.nombre_comercial}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Sucursal</label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              disabled={empresaId === "todas"}
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-blue-600 disabled:opacity-50"
            >
              <option value="todas" className="dark:bg-zinc-900">Todas las Sucursales</option>
              {sucursales.map((suc) => (
                <option key={suc.id} value={suc.id} className="dark:bg-zinc-900">{suc.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Periodo (Año / Mes)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                className="w-1/2 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm text-center"
              />
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-1/2 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm"
              >
                {Array.from({length: 12}, (_, i) => (
                  <option key={i+1} value={String(i+1)} className="dark:bg-zinc-900">Mes {i+1}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <button
              onClick={() => ejecutarConsulta(empresaId, sucursalId, anio, mes)}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Calculando..." : "Actualizar Indicadores"}
            </button>
          </div>
        </div>

        {mensajeError && (
          <div className="p-4 rounded-2xl bg-red-50 text-red-600 border border-red-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{mensajeError}</span>
          </div>
        )}

        {/* TARJETAS DINÁMICAS DE INDICADORES */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" /> Indicadores Financieros Configurados
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.keys(indicadores).length === 0 ? (
              <div className="col-span-4 p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 text-sm">
                No hay indicadores configurados todavía. Haz clic en <span className="text-indigo-600 font-semibold">"Crear y Configurar Indicadores NIIF"</span> para agregar el primero.
              </div>
            ) : (
              Object.entries(indicadores).map(([codigo, valor]) => (
                <div key={codigo} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <p className="text-xs text-zinc-500 font-semibold uppercase">{codigo}</p>
                  <h3 className="text-2xl font-black text-blue-600 mt-2">{valor}</h3>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ESTADO VACÍO PARA GRÁFICAS SI NO HAY MOVIMIENTOS */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm text-center space-y-3">
          <BarChart3 className="w-10 h-10 text-zinc-300 mx-auto" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-300">Sin movimientos históricos suficientes para graficar</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">Las gráficas de tendencias se poblarán automáticamente en cuanto registres comprobantes contables y asientos en el sistema.</p>
        </div>

      </div>
    </main>
  );
}