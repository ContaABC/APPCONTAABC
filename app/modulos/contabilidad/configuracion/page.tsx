"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Settings, ArrowLeft, ArrowRight, Building2, MapPin } from "lucide-react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface OpcionModulo {
  name: string;
  href: string;
  isSecurity?: boolean;
}

interface UsuarioPerfil {
  nombres?: string;
  apellidos?: string;
  tipo_usuario?: string;
  empresa_activa?: string | number | null;
  sucursal_activa?: string | number | null;
  [key: string]: unknown;
}

interface SucursalRow {
  id: number;
  empresa_id: number;
  codigo_sucursal: string;
  nombre: string;
  estado?: string | null;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function setCookieValue(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=86400; SameSite=Lax`;
}

export default function ConfiguracionPage() {
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState<string>("Empresa Principal");
  const [sucursalActivaNombre, setSucursalActivaNombre] = useState<string>("Sucursal Principal");
  const [usuarioActual, setUsuarioActual] = useState<UsuarioPerfil | null>(null);

  const sincronizarContextoAlVolver = useCallback(async () => {
    if (typeof window === "undefined") return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase: SupabaseClient | null =
      supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

    let userId: string | null = null;
    let perfilData: UsuarioPerfil | null = null;

    if (supabase) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          const { data: perfil } = await supabase
            .from("usuarios_perfiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (perfil) {
            perfilData = perfil as UsuarioPerfil;
            setUsuarioActual(perfilData);
          }
        }
      } catch (err) {
        console.error("Error al consultar perfil en Configuración:", err);
      }
    }

    // 1. Resolver empresa_activa desde localStorage, cookies o usuarios_perfiles
    const empresaLocal =
      localStorage.getItem("empresa_activa") || localStorage.getItem("empresa_id");
    const empresaCookie = getCookieValue("empresa_activa");
    const empresaPerfil =
      perfilData?.empresa_activa != null ? String(perfilData.empresa_activa) : null;

    const empresaIdActual = String(empresaLocal || empresaCookie || empresaPerfil || "").trim();

    if (!supabase || !empresaIdActual) {
      const storedEmpresaNombre = localStorage.getItem("empresa_activa_nombre");
      const storedSucursalNombre = localStorage.getItem("sucursal_activa_nombre");
      if (storedEmpresaNombre) setEmpresaActivaNombre(storedEmpresaNombre);
      if (storedSucursalNombre) setSucursalActivaNombre(storedSucursalNombre);
      return;
    }

    try {
      // 2. Consultar datos de la empresa en public.empresas
      const { data: empresaRow } = await supabase
        .from("empresas")
        .select("id, razon_social, nombre_comercial")
        .eq("id", Number(empresaIdActual))
        .maybeSingle();

      const nombreEmpresaResuelto =
        (empresaRow?.razon_social || empresaRow?.nombre_comercial || "").trim() ||
        localStorage.getItem("empresa_activa_nombre") ||
        "Empresa Principal";

      // 3. Consultar sucursales de esa empresa en public.sucursales
      let { data: sucursalesEmpresa } = await supabase
        .from("sucursales")
        .select("id, empresa_id, codigo_sucursal, nombre, estado")
        .eq("empresa_id", Number(empresaIdActual))
        .eq("estado", "Activa")
        .order("id", { ascending: true });

      if (!sucursalesEmpresa || sucursalesEmpresa.length === 0) {
        const { data: todasSucursalesEmpresa } = await supabase
          .from("sucursales")
          .select("id, empresa_id, codigo_sucursal, nombre, estado")
          .eq("empresa_id", Number(empresaIdActual))
          .order("id", { ascending: true });

        sucursalesEmpresa = todasSucursalesEmpresa || [];
      }

      const listaSucursales = (sucursalesEmpresa || []) as SucursalRow[];

      // 4. Resolver sucursal_activa desde localStorage, cookies o usuarios_perfiles
      const sucursalCandidata = String(
        localStorage.getItem("sucursal_activa") ||
          localStorage.getItem("sucursal_id") ||
          getCookieValue("sucursal_activa") ||
          (perfilData?.sucursal_activa != null ? String(perfilData.sucursal_activa) : "") ||
          ""
      ).trim();

      let sucursalElegida: SucursalRow | null = null;
      if (sucursalCandidata) {
        sucursalElegida =
          listaSucursales.find((s) => String(s.id) === sucursalCandidata) || null;
      }

      // Si no hay sucursal candidata o no pertenece a empresa_id, asignar la primera de la empresa
      if (!sucursalElegida && listaSucursales.length > 0) {
        sucursalElegida = listaSucursales[0];
      }

      const sucursalIdFinal = sucursalElegida ? String(sucursalElegida.id) : "";
      const nombreSucursalFinal = sucursalElegida
        ? sucursalElegida.nombre.trim()
        : "Sin sucursal";

      // 5. Actualizar localStorage, cookies y usuarios_perfiles
      localStorage.setItem("empresa_activa", empresaIdActual);
      localStorage.setItem("empresa_id", empresaIdActual);
      localStorage.setItem("empresa_activa_nombre", nombreEmpresaResuelto);
      setCookieValue("empresa_activa", empresaIdActual);

      if (sucursalIdFinal) {
        localStorage.setItem("sucursal_activa", sucursalIdFinal);
        localStorage.setItem("sucursal_id", sucursalIdFinal);
        localStorage.setItem("sucursal_activa_nombre", nombreSucursalFinal);
        setCookieValue("sucursal_activa", sucursalIdFinal);
      } else {
        localStorage.removeItem("sucursal_activa");
        localStorage.removeItem("sucursal_id");
        localStorage.setItem("sucursal_activa_nombre", nombreSucursalFinal);
      }

      setEmpresaActivaNombre(nombreEmpresaResuelto);
      setSucursalActivaNombre(nombreSucursalFinal);

      if (userId) {
        const updatePayload: Record<string, unknown> = {};
        if (String(perfilData?.empresa_activa ?? "") !== empresaIdActual) {
          updatePayload.empresa_activa = Number(empresaIdActual);
        }
        if (
          sucursalIdFinal &&
          String(perfilData?.sucursal_activa ?? "") !== sucursalIdFinal
        ) {
          updatePayload.sucursal_activa = Number(sucursalIdFinal);
        }
        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from("usuarios_perfiles")
            .update(updatePayload)
            .eq("id", userId);
        }
      }
    } catch (err) {
      console.error("Error al sincronizar empresa y sucursal en Configuración:", err);
    }
  }, []);

  useEffect(() => {
    sincronizarContextoAlVolver();

    const handleFocus = () => {
      sincronizarContextoAlVolver();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sincronizarContextoAlVolver();
      }
    };

    const handlePageShow = () => {
      sincronizarContextoAlVolver();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sincronizarContextoAlVolver]);

  // Se eliminó la opción de "Empresas" para que los usuarios no puedan crearlas libremente
  const opciones: OpcionModulo[] = [
    { name: "Terceros", href: "/terceros" },
    { name: "Clases de Documentos", href: "/configuracion/clases-documento" },
    { name: "Resoluciones", href: "/configuracion/resoluciones" },
    { name: "Sucursales", href: "/Sucursales" },
    { name: "Conceptos NIIF", href: "/ConceptosNiif" },
    { name: "Subconceptos NIIF", href: "/subconceptos_niif" },
    { name: "Actividades ABC", href: "/actividades_abc" },
    { name: "Actividades Auxiliares", href: "/actividades_auxiliares" },
    { name: "Conceptos Auxiliares", href: "/conceptos_auxiliares" },
    { name: "Enlace Clases y Conceptos", href: "/clase_documento_conceptos" },
    { name: "Gestión de Usuarios", href: "/usuarios", isSecurity: true },
    { name: "Asignación de Transacciones a Usuarios", href: "/usuarios/permisos", isSecurity: true },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* BARRA SUPERIOR CONTEXTUAL (Empresa, Sucursal y Usuario) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
          <Link 
            href="/modulos/contabilidad" 
            className="inline-flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-300 hover:text-blue-600 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Menú Contable
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Empresa y Sucursal */}
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
              <span className="font-bold truncate max-w-[140px]">{empresaActivaNombre}</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span className="truncate max-w-[140px]">{sucursalActivaNombre}</span>
            </div>

            {/* Usuario */}
            {usuarioActual && (
              <div className="bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-indigo-600 dark:text-indigo-400">
                {usuarioActual.nombres || ""} {usuarioActual.apellidos || ""}
              </div>
            )}
          </div>
        </div>
        
        {/* CONTENEDOR PRINCIPAL DEL MÓDULO */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600">
              <Settings className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Configuración</h1>
              <p className="text-sm text-zinc-500">Parámetros generales, catálogos maestros y control de accesos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op, idx) => (
              <Link 
                key={idx} 
                href={op.href} 
                className={`group p-4 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                  op.isSecurity 
                    ? "border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30" 
                    : "border-zinc-200/70 dark:border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${op.isSecurity ? "bg-blue-600" : "bg-indigo-500"}`}></span> 
                  {op.name}
                </span>
                <ArrowRight className={`w-4 h-4 transition-all ${op.isSecurity ? "text-blue-500 group-hover:translate-x-1" : "text-zinc-400 group-hover:text-indigo-600 group-hover:translate-x-1"}`} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}