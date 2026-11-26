"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, ArrowLeft, ArrowRight, Building2, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
  type Empresa as EmpresaPermitida,
  type Sucursal as SucursalPermitida,
} from "@/app/actions/accionesEmpresas";

interface OpcionModulo {
  name: string;
  href: string;
}

interface UsuarioPerfil {
  id?: string;
  nombres?: string;
  apellidos?: string;
  tipo_usuario?: string;
  [key: string]: unknown;
}

type EmpresaItem = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
};

type SucursalItem = SucursalPermitida & {
  nombre_sucursal?: string;
};

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function obtenerNombreEmpresa(emp: EmpresaItem): string {
  return String(
    emp.razon_social || emp.nombre_comercial || emp.nombre || "Empresa"
  );
}

function obtenerNombreSucursal(suc: SucursalItem): string {
  return String(suc.nombre || suc.nombre_sucursal || `Sucursal ${suc.id}`);
}

export default function ConsultasPage() {
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState<string>(
    "Empresa Principal"
  );
  const [sucursalActivaNombre, setSucursalActivaNombre] = useState<string>(
    "Sucursal Principal"
  );
  const [usuarioActual, setUsuarioActual] = useState<UsuarioPerfil | null>(
    null
  );

  const cargarContexto = useCallback(async () => {
    if (typeof window !== "undefined") {
      const storedEmpresa =
        localStorage.getItem("empresa_activa_nombre") ||
        getCookieValue("empresa_activa_nombre");
      const storedSucursal =
        localStorage.getItem("sucursal_activa_nombre") ||
        getCookieValue("sucursal_activa_nombre");
      if (storedEmpresa) setEmpresaActivaNombre(storedEmpresa);
      if (storedSucursal) setSucursalActivaNombre(storedSucursal);
    }

    try {
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
          setUsuarioActual(perfil as UsuarioPerfil);
        }

        const permitidas = await getEmpresasPermitidas(user.id);
        const listaEmpresas: EmpresaItem[] = Array.isArray(permitidas)
          ? (permitidas as EmpresaItem[])
          : [];

        let empIdActiva: string | null = null;
        try {
          const valEmp = await getEmpresaActivaUsuario(user.id);
          if (valEmp !== null && valEmp !== undefined && String(valEmp).trim() !== "") {
            empIdActiva = String(valEmp).trim();
          }
        } catch {
          // Ignorar
        }

        if (!empIdActiva && typeof window !== "undefined") {
          empIdActiva =
            getCookieValue("empresa_activa") ||
            localStorage.getItem("empresa_activa") ||
            localStorage.getItem("empresa_id");
        }

        if (listaEmpresas.length > 0) {
          const empSel =
            listaEmpresas.find((e) => String(e.id) === String(empIdActiva)) ||
            listaEmpresas[0];
          const nombreEmp = obtenerNombreEmpresa(empSel);
          setEmpresaActivaNombre(nombreEmp);

          if (typeof window !== "undefined") {
            localStorage.setItem("empresa_activa", String(empSel.id));
            localStorage.setItem("empresa_activa_nombre", nombreEmp);
          }

          const sucPermitidas = await getSucursalesPermitidas(
            String(empSel.id),
            user.id
          );
          const listaSuc: SucursalItem[] = Array.isArray(sucPermitidas)
            ? (sucPermitidas as SucursalItem[])
            : [];

          if (listaSuc.length > 0) {
            let sucIdActiva: string | null = null;
            try {
              const valSuc = await getSucursalActivaUsuario(user.id);
              if (valSuc !== null && valSuc !== undefined && String(valSuc).trim() !== "") {
                sucIdActiva = String(valSuc).trim();
              }
            } catch {
              // Ignorar
            }

            if (!sucIdActiva && typeof window !== "undefined") {
              sucIdActiva =
                getCookieValue("sucursal_activa") ||
                localStorage.getItem("sucursal_activa") ||
                localStorage.getItem("sucursal_id");
            }

            const sucSel =
              listaSuc.find((s) => String(s.id) === String(sucIdActiva)) ||
              listaSuc[0];
            const nombreSuc = obtenerNombreSucursal(sucSel);
            setSucursalActivaNombre(nombreSuc);

            if (typeof window !== "undefined") {
              localStorage.setItem("sucursal_activa", String(sucSel.id));
              localStorage.setItem("sucursal_activa_nombre", nombreSuc);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error cargando contexto de consultas:", err);
    }
  }, []);

  useEffect(() => {
    cargarContexto();
  }, [cargarContexto]);

  const opciones: OpcionModulo[] = [
    { name: "Consulta y Verificación de Saldos", href: "/consultas" },
    { name: "Consulta de Movimientos", href: "/consultas/movimientos" },
    { name: "Reportes Contables", href: "/consultas/reportes" },
    { name: "Consulta de Items Facturados", href: "/items/movimientos" },
    { name: "Consulta de Conceptos NIIF", href: "/consultas/conceptos_niif" },
    { name: "Consulta Movimientos Retención", href: "/retenciones/consultas" },
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
              <Building2 className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
              <span className="font-bold truncate max-w-[140px]">
                {empresaActivaNombre}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span className="truncate max-w-[120px]">
                {sucursalActivaNombre}
              </span>
            </div>

            {/* Usuario */}
            {usuarioActual && (
              <div className="bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-cyan-600 dark:text-cyan-400">
                {usuarioActual.nombres || ""} {usuarioActual.apellidos || ""}
              </div>
            )}
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL DEL MÓDULO */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/50 rounded-2xl text-cyan-600">
              <Search className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Consultas</h1>
              <p className="text-sm text-zinc-500">
                Verificación de saldos, movimientos y reportes detallados
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op, idx) => (
              <Link
                key={idx}
                href={op.href}
                className="group p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 hover:border-cyan-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between cursor-pointer"
              >
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>{" "}
                  {op.name}
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-cyan-600 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}