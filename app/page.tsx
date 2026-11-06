"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { 
  Settings, 
  Users, 
  Truck, 
  DollarSign, 
  BarChart3, 
  Search, 
  ShieldCheck, 
  ArrowRight,
  LogOut,
  UserCheck,
  Building,
  TrendingUp,
  Layers,
  FileText
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<any>(null);
  const [totalEmpresas, setTotalEmpresas] = useState(0);
  const [totalUsuarios, setTotalUsuarios] = useState(0);

  useEffect(() => {
    async function cargarDatosDashboard() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // 1. Obtener usuario autenticado y su perfil
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from("usuarios_perfiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (perfil) {
          setUsuarioActual(perfil);
        } else {
          setUsuarioActual({ nombres: user.email, tipo_usuario: "Usuario" });
        }
      }

      // 2. Contadores rápidos para métricas del dashboard
      const { count: countEmpresas } = await supabase.from("empresas").select("*", { count: 'exact', head: true });
      if (countEmpresas !== null) setTotalEmpresas(countEmpresas);

      const { count: countUsuarios } = await supabase.from("usuarios_perfiles").select("*", { count: 'exact', head: true });
      if (countUsuarios !== null) setTotalUsuarios(countUsuarios);
    }
    cargarDatosDashboard();
  }, []);

  const handleLogout = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    }
  };

  const grupos = [
    {
      nombre: "Configuración",
      descripcion: "Empresas, terceros, sucursales y parámetros generales NIIF.",
      ruta: "/modulos/configuracion",
      icono: Settings,
      badge: "Maestros",
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900/50",
    },
    {
      nombre: "Proveedores",
      descripcion: "Carga, causación, consulta y notas de facturas de proveedores.",
      ruta: "/modulos/proveedores",
      icono: Truck,
      badge: "CXP",
      color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-900/50",
    },
    {
      nombre: "Clientes",
      descripcion: "Facturación comercial, recibos de caja, ítems y notas crédito.",
      ruta: "/modulos/clientes",
      icono: Users,
      badge: "CXC",
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/50",
    },
    {
      nombre: "Tesorería",
      descripcion: "Control de flujo de caja, egresos, bancos y consignaciones.",
      ruta: "/modulos/tesoreria",
      icono: DollarSign,
      badge: "Fondos",
      color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-100 dark:border-purple-900/50",
    },
    {
      nombre: "Consultas",
      descripcion: "Verificación de saldos, auxiliares, movimientos y reportes.",
      ruta: "/modulos/consultas",
      icono: Search,
      badge: "Reportes",
      color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 border-cyan-100 dark:border-cyan-900/50",
    },
    {
      nombre: "Contabilidad",
      descripcion: "Balance general, estado de resultados, NIIF y cierres.",
      ruta: "/modulos/contabilidad",
      icono: BarChart3,
      badge: "Financiero",
      color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900/50",
    },
    // En app/page.tsx, dentro del arreglo `grupos`:
{
  nombre: "Gestión Financiera",
  descripcion: "Indicadores de rentabilidad, liquidez, endeudamiento y gráficas NIIF.",
  ruta: "/modulos/gestion-financiera",
  icono: TrendingUp, // Asegúrate de importar TrendingUp de 'lucide-react'
  badge: "Gerencial",
  color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-100 dark:border-rose-900/50",
}
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      
      {/* Encabezado Ejecutivo Profesional */}
      <header className="max-w-7xl mx-auto mb-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-8 py-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-md">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">ContaABC</h1>
              <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">NIIF / ABC</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Sistema Integrado de Gestión Contable y Financiera</p>
          </div>
        </div>

        {/* Métricas rápidas e información de sesión */}
        <div className="flex items-center gap-4 flex-wrap w-full md:w-auto justify-between md:justify-end">
          
          <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800/60 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
            <Building className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold">{totalEmpresas} Empresas Activas</span>
          </div>

          {usuarioActual && (
            <div className="flex items-center gap-2.5 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <div className="text-xs">
                <p className="font-bold text-zinc-800 dark:text-zinc-200">{usuarioActual.nombres} {usuarioActual.apellidos}</p>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{usuarioActual.tipo_usuario}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 rounded-2xl border border-red-200 dark:border-red-900/50 transition shadow-sm"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </header>

      {/* Cuadrícula Principal de los 6 Módulos */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {grupos.map((grupo, index) => {
          const IconComponent = grupo.icono;
          return (
            <Link 
              key={index}
              href={grupo.ruta}
              className="group bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-7 shadow-sm hover:shadow-xl hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-3.5 rounded-2xl border ${grupo.color} shadow-sm`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full">
                    {grupo.badge}
                  </span>
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors flex items-center justify-between">
                  {grupo.nombre}
                  <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-1.5 transition-all" />
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {grupo.descripcion}
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center justify-between">
                <span>Acceder al módulo</span>
                <span className="w-2 h-2 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></span>
              </div>
            </Link>
          );
        })}
      </div>

    </main>
  );
}