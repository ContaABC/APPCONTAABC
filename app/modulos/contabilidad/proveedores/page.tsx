"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Truck, ArrowLeft, ArrowRight, Building2, MapPin } from "lucide-react";
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

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export default function ProveedoresPage() {
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState<string>("Empresa Principal");
  const [sucursalActivaNombre, setSucursalActivaNombre] = useState<string>("Sucursal Principal");
  const [usuarioActual, setUsuarioActual] = useState<UsuarioPerfil | null>(null);

  useEffect(() => {
    async function initContexto() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      let empId = "";
      let sucId = "";

      if (typeof window !== "undefined") {
        const storedEmpresaNombre = localStorage.getItem("empresa_activa_nombre");
        const storedSucursalNombre = localStorage.getItem("sucursal_activa_nombre");
        if (storedEmpresaNombre) setEmpresaActivaNombre(storedEmpresaNombre);
        if (storedSucursalNombre) setSucursalActivaNombre(storedSucursalNombre);

        empId =
          localStorage.getItem("empresa_activa") ||
          localStorage.getItem("empresa_id") ||
          getCookieValue("empresa_activa") ||
          "";
        sucId =
          localStorage.getItem("sucursal_activa") ||
          localStorage.getItem("sucursal_id") ||
          getCookieValue("sucursal_activa") ||
          "";
      }

      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: perfil } = await supabase
          .from("usuarios_perfiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (perfil) {
          const perfilTyped = perfil as UsuarioPerfil;
          setUsuarioActual(perfilTyped);
          if (!empId && perfilTyped.empresa_activa) {
            empId = String(perfilTyped.empresa_activa);
          }
          if (!sucId && perfilTyped.sucursal_activa) {
            sucId = String(perfilTyped.sucursal_activa);
          }
        }
      }

      if (empId && !Number.isNaN(Number(empId))) {
        const { data: empData } = await supabase
          .from("empresas")
          .select("razon_social, nombre_comercial, nombre")
          .eq("id", Number(empId))
          .maybeSingle();

        const nombreEmp =
          empData?.razon_social || empData?.nombre_comercial || empData?.nombre || "";
        if (nombreEmp) {
          setEmpresaActivaNombre(nombreEmp);
          if (typeof window !== "undefined") {
            localStorage.setItem("empresa_activa_nombre", nombreEmp);
          }
        }
      }

      if (sucId && !Number.isNaN(Number(sucId))) {
        const { data: sucData } = await supabase
          .from("sucursales")
          .select("nombre, nombre_sucursal")
          .eq("id", Number(sucId))
          .maybeSingle();

        const nombreSuc = sucData?.nombre || sucData?.nombre_sucursal || "";
        if (nombreSuc) {
          setSucursalActivaNombre(nombreSuc);
          if (typeof window !== "undefined") {
            localStorage.setItem("sucursal_activa_nombre", nombreSuc);
          }
        }
      }
    }

    initContexto();
  }, []);

  const opciones: OpcionModulo[] = [
    { name: "Facturas de Proveedores", href: "/facturas/cargar?from=/modulos/contabilidad/proveedores" },
    { name: "Consultar Facturas", href: "/facturas/consultar?from=/modulos/contabilidad/proveedores" },
    { name: "Notas de Proveedores", href: "/facturas/notas_recibidas?from=/modulos/contabilidad/proveedores" },
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
              <Building2 className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="font-bold truncate max-w-[140px]">{empresaActivaNombre}</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span className="truncate max-w-[120px]">{sucursalActivaNombre}</span>
            </div>

            {/* Usuario */}
            {usuarioActual && (
              <div className="bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-amber-600 dark:text-amber-400">
                {usuarioActual.nombres || ""} {usuarioActual.apellidos || ""}
              </div>
            )}
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL DEL MÓDULO */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-2xl text-amber-600">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Proveedores</h1>
              <p className="text-sm text-zinc-500">
                Carga, consulta y gestión de notas de costos y proveedores
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op, idx) => (
              <Link
                key={idx}
                href={op.href}
                className="group p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between cursor-pointer"
              >
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> {op.name}
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}