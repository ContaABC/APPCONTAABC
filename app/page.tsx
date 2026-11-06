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
  UserCheck
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<any>(null);

  useEffect(() => {
    async function obtenerUsuarioLogueado() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Consultar su perfil en la tabla usuarios_perfiles
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
    }
    obtenerUsuarioLogueado();
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
      descripcion: "Empresas, terceros, sucursales y parámetros generales.",
      ruta: "/modulos/configuracion",
      icono: Settings,
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900/50",
    },
    {
      nombre: "Proveedores",
      descripcion: "Carga, consulta y notas de facturas de proveedores.",
      ruta: "/modulos/proveedores",
      icono: Truck,
      color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-900/50",
    },
    {
      nombre: "Clientes",
      descripcion: "Facturación a clientes, recibos de caja, ítems y notas.",
      ruta: "/modulos/clientes",
      icono: Users,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/50",
    },
    {
      nombre: "Tesorería",
      descripcion: "Control de flujo de caja, egresos y consignaciones.",
      ruta: "/modulos/tesoreria",
      icono: DollarSign,
      color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-100 dark:border-purple-900/50",
    },
    {
      nombre: "Consultas",
      descripcion: "Verificación de saldos, movimientos y reportes detallados.",
      ruta: "/modulos/consultas",
      icono: Search,
      color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 border-cyan-100 dark:border-cyan-900/50",
    },
    {
      nombre: "Contabilidad",
      descripcion: "Balance general, estado de resultados, retenciones y cierres.",
      ruta: "/modulos/contabilidad",
      icono: BarChart3,
      color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900/50",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      
      {/* Encabezado Principal con Nombre del Usuario Logueado */}
      <header className="max-w-6xl mx-auto mb-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-8 py-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">ContaABC</h1>
            <p className="text-xs text-zinc-500">Sistema de Gestión Contable NIIF</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {usuarioActual && (
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <div className="text-xs">
                <p className="font-bold text-zinc-800 dark:text-zinc-200">{usuarioActual.nombres} {usuarioActual.apellidos}</p>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{usuarioActual.tipo_usuario}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">En Línea</span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 rounded-xl border border-red-200 dark:border-red-900/50 transition shadow-sm"
            >
              <LogOut className="w-4 h-4" /> Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Cuadrícula de 6 Grupos */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {grupos.map((grupo, index) => {
          const IconComponent = grupo.icono;
          return (
            <Link 
              key={index}
              href={grupo.ruta}
              className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:shadow-xl hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl border ${grupo.color}`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors">{grupo.nombre}</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {grupo.descripcion}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <span>Explorar opciones</span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}