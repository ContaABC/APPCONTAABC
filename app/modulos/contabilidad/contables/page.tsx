"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3, ArrowLeft, ArrowRight, Building2, MapPin } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

interface OpcionModulo {
  name: string;
  href: string;
}

interface UsuarioPerfil {
  nombres?: string;
  apellidos?: string;
  tipo_usuario?: string;
  [key: string]: unknown;
}

export default function ContabilidadPage() {
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState<string>("Empresa Principal");
  const [sucursalActivaNombre, setSucursalActivaNombre] = useState<string>("Sucursal Principal");
  const [usuarioActual, setUsuarioActual] = useState<UsuarioPerfil | null>(null);

  useEffect(() => {
    async function initContexto() {
      // Leer Empresa y Sucursal desde localStorage
      if (typeof window !== "undefined") {
        const storedEmpresa = localStorage.getItem("empresa_activa_nombre");
        const storedSucursal = localStorage.getItem("sucursal_activa_nombre");
        if (storedEmpresa) setEmpresaActivaNombre(storedEmpresa);
        if (storedSucursal) setSucursalActivaNombre(storedSucursal);
      }

      // Cargar sesión del usuario
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from("usuarios_perfiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (perfil) setUsuarioActual(perfil as UsuarioPerfil);
      }
    }
    initContexto();
  }, []);

  const opciones: OpcionModulo[] = [
    { name: "Documentos Contables", href: "/documentos" },
    { name: "Balance General", href: "/balance_general" },
    { name: "Estado de Resultados", href: "/estado-resultados" },
    { name: "Declaración de Retenciones", href: "/retenciones/declaracion" },
    { name: "Certificados de Retención", href: "/retenciones/Certificados" },
    { name: "Conceptos de Retención", href: "/retenciones/conceptos" },
    { name: "Cierres Contables", href: "/cierres" },
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
              <Building2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="font-bold truncate max-w-[120px]">{empresaActivaNombre}</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span className="truncate max-w-[100px]">{sucursalActivaNombre}</span>
            </div>

            {/* Usuario */}
            {usuarioActual && (
              <div className="bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-blue-600 dark:text-blue-400">
                {usuarioActual.nombres || ""} {usuarioActual.apellidos || ""}
              </div>
            )}
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL DEL MÓDULO */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-blue-600">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Contabilidad</h1>
              <p className="text-sm text-zinc-500">Estructura oficial NIIF, estados financieros, retenciones y cierres</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op, idx) => (
              <Link 
                key={idx} 
                href={op.href} 
                className="group p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 hover:border-blue-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between cursor-pointer"
              >
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {op.name}
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}