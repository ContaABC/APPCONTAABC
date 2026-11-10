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
  UserCheck,
  Building,
  TrendingUp,
  Layers,
  FileText
} from "lucide-react";

// --- MATRIZ DE PERMISOS INTEGRADA ---
const PERMISOS_MODULOS: Record<string, string[]> = {
  "/modulos/contabilidad/configuracion": ["Administrador"],
  "/usuarios": ["Administrador"],
  "/usuarios/asignaciones": ["Administrador"],
  "/modulos/contabilidad/proveedores": ["Administrador", "Contador", "Operador"],
  "/modulos/clientes": ["Administrador", "Contador", "Operador"],
  "/modulos/tesoreria": ["Administrador", "Contador"],
  "/modulos/contabilidad/consultas": ["Administrador", "Contador", "Auditor"],
  "/modulos/contabilidad/contables": ["Administrador", "Contador"],
};

function tieneAcceso(tipoUsuario: string, ruta: string): boolean {
  if (tipoUsuario === "Administrador") return true;
  const rolesPermitidos = PERMISOS_MODULOS[ruta];
  if (!rolesPermitidos) return true;
  return rolesPermitidos.includes(tipoUsuario);
}

export default function ContabilidadHome() {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<any>(null);

  useEffect(() => {
    async function cargarDatosUsuario() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Obtener usuario autenticado y su perfil
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
          setUsuarioActual({ nombres: user.email, tipo_usuario: "Operador" });
        }
      }
    }
    cargarDatosUsuario();
  }, []);

  const grupos = [
    {
      nombre: "Configuración",
      descripcion: "Empresas, terceros, sucursales y parámetros generales NIIF.",
      ruta: "/modulos/contabilidad/configuracion",
      icono: Settings,
      badge: "Maestros",
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900/50",
    },
    {
      nombre: "Proveedores",
      descripcion: "Carga, causación, consulta y notas de facturas de proveedores.",
      ruta: "/modulos/contabilidad/proveedores",
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
      ruta: "/modulos/contabilidad/consultas",
      icono: Search,
      badge: "Reportes",
      color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 border-cyan-100 dark:border-cyan-900/50",
    },
    {
      nombre: "Contables",
      descripcion: "Balance general, estado de resultados, NIIF y cierres.",
      ruta: "/modulos/contabilidad/contables",
      icono: BarChart3,
      badge: "Financiero",
      color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900/50",
    },
  ];

  // Filtrar los submódulos de acuerdo al rol del usuario autenticado
  const gruposPermitidos = usuarioActual 
    ? grupos.filter(g => tieneAcceso(usuarioActual.tipo_usuario, g.ruta))
    : grupos;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8">
      
      {/* Encabezado sin marco recargado */}
      <header className="max-w-7xl mx-auto mb-6 px-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">ContaABC</h1>
              <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">Módulo Contable</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Sistema ERP Financiero y Contable</p>
          </div>
        </div>

        {/* Información resumida de sesión del usuario */}
        {usuarioActual && (
          <div className="flex items-center gap-2.5 bg-white dark:bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <div className="text-xs">
              <p className="font-bold text-zinc-800 dark:text-zinc-200">{usuarioActual.nombres} {usuarioActual.apellidos}</p>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{usuarioActual.tipo_usuario}</span>
            </div>
          </div>
        )}
      </header>

      {/* Cuadrícula Principal de los Submódulos Contables Filtrados por Rol */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {gruposPermitidos.map((grupo, index) => {
          const IconComponent = grupo.icono;
          return (
            <Link 
              key={index}
              href={grupo.ruta}
              className="group bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:shadow-xl hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl border ${grupo.color} shadow-sm`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full">
                    {grupo.badge}
                  </span>
                </div>
                <h2 className="text-lg font-bold mb-1.5 group-hover:text-blue-600 transition-colors flex items-center justify-between">
                  {grupo.nombre}
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-1.5 transition-all" />
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {grupo.descripcion}
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center justify-between">
                <span>Acceder al submódulo</span>
                <span className="w-2 h-2 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></span>
              </div>
            </Link>
          );
        })}
      </div>

    </main>
  );
}