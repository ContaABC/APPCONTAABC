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
  ArrowLeft,
  Building2,
  MapPin,
  LucideIcon
} from "lucide-react";

interface UsuarioPerfil {
  nombres?: string;
  apellidos?: string;
  tipo_usuario?: string;
  [key: string]: unknown;
}

interface GrupoModulo {
  nombre: string;
  descripcion: string;
  ruta: string;
  icono: LucideIcon;
  badge: string;
  color: string;
}

// --- MATRIZ DE PERMISOS INTEGRADA ---
const PERMISOS_MODULOS: Record<string, readonly string[]> = {
  "/modulos/contabilidad/configuracion": ["Administrador"],
  "/usuarios": ["Administrador"],
  "/usuarios/asignaciones": ["Administrador"],
  "/modulos/contabilidad/proveedores": ["Administrador", "Contador", "Operador"],
  "/modulos/contabilidad/clientes": ["Administrador", "Contador", "Operador"],
  "/modulos/contabilidad/tesoreria": ["Administrador", "Contador"],
  "/modulos/contabilidad/consultas": ["Administrador", "Contador", "Auditor"],
  "/modulos/contabilidad/contables": ["Administrador", "Contador"],
} as const;

function tieneAcceso(tipoUsuario: string, ruta: string): boolean {
  if (tipoUsuario === "Administrador") return true;
  const rolesPermitidos = PERMISOS_MODULOS[ruta];
  if (!rolesPermitidos) return true;
  return rolesPermitidos.includes(tipoUsuario);
}

export default function ContabilidadHome() {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<UsuarioPerfil | null>(null);
  
  // Estados para la Empresa y Sucursal Activa
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState<string>("Sin Empresa Seleccionada");
  const [sucursalActivaNombre, setSucursalActivaNombre] = useState<string>("Sin Sucursal");

  useEffect(() => {
    async function cargarDatosSesionYContexto() {
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
          setUsuarioActual(perfil as UsuarioPerfil);
        } else {
          setUsuarioActual({ nombres: user.email || "", tipo_usuario: "Operador" });
        }
      }

      // 2. Función helper para leer el localStorage de forma segura
      const sincronizarContextoLocal = () => {
        if (typeof window !== "undefined") {
          const storedEmpresa = localStorage.getItem("empresa_activa_nombre");
          const storedSucursal = localStorage.getItem("sucursal_activa_nombre");
          
          if (storedEmpresa) setEmpresaActivaNombre(storedEmpresa);
          if (storedSucursal) setSucursalActivaNombre(storedSucursal);
        }
      };

      sincronizarContextoLocal();

      // Escuchar cambios en localStorage si se actualizan desde otra vista
      window.addEventListener("storage", sincronizarContextoLocal);
      return () => {
        window.removeEventListener("storage", sincronizarContextoLocal);
      };
    }

    cargarDatosSesionYContexto();
  }, []);

  const grupos: GrupoModulo[] = [
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
      ruta: "/modulos/contabilidad/clientes",
      icono: Users,
      badge: "CXC",
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/50",
    },
    {
      nombre: "Tesorería",
      descripcion: "Control de flujo de caja, egresos, bancos y consignaciones.",
      ruta: "/modulos/contabilidad/tesoreria",
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
  const gruposPermitidos = usuarioActual && usuarioActual.tipo_usuario 
    ? grupos.filter(g => tieneAcceso(usuarioActual.tipo_usuario as string, g.ruta))
    : grupos;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8">
      
      {/* ENCABEZADO SUPERIOR CON BOTÓN DE RETROCESO, EMPRESA Y PERFIL */}
      <header className="max-w-7xl mx-auto mb-8 px-2 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        
        <div className="flex items-center gap-3.5">
          {/* Botón de Atrás hacia el menú principal de módulos */}
          <Link 
            href="/" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-blue-600 bg-zinc-50 dark:bg-zinc-800 hover:bg-blue-50 px-3 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm transition cursor-pointer"
            title="Volver al menú de selección de módulos"
          >
            <ArrowLeft className="w-4 h-4" /> Menú Principal
          </Link>

          <div className="flex items-center gap-3 pl-3 border-l border-zinc-200 dark:border-zinc-800">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight">ContaABC</h1>
                <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">Módulo Contable</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">Sistema ERP Financiero y Contable</p>
            </div>
          </div>
        </div>

        {/* CÁPSULA DE CONTEXTO: EMPRESA, SUCURSAL Y USUARIO */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          
          {/* Empresa y Sucursal Activa */}
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate max-w-[140px]">{empresaActivaNombre}</span>
            </div>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span className="truncate max-w-[110px]">{sucursalActivaNombre}</span>
            </div>
          </div>

          {/* Perfil de Usuario */}
          {usuarioActual && (
            <div className="flex items-center gap-2.5 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
              <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-zinc-800 dark:text-zinc-200 leading-tight">{usuarioActual.nombres || ""} {usuarioActual.apellidos || ""}</p>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{usuarioActual.tipo_usuario}</span>
              </div>
            </div>
          )}

        </div>

      </header>

      {/* CUADRÍCULA PRINCIPAL DE LOS SUBMÓDULOS CONTABLES */}
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