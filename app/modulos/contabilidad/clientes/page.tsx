"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, ArrowRight, Building2, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
  type Empresa,
  type Sucursal,
} from "@/app/actions/accionesEmpresas";

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

function obtenerNombreSucursal(sucursal: Sucursal): string {
  const raw = sucursal as Sucursal & { nombre_sucursal?: string };
  return String(raw.nombre || raw.nombre_sucursal || "Sucursal Activa");
}

export default function ClientesPage() {
  const router = useRouter();
  const [empresaActivaNombre, setEmpresaActivaNombre] =
    useState<string>("Empresa Principal");
  const [sucursalActivaNombre, setSucursalActivaNombre] =
    useState<string>("Sucursal Principal");
  const [usuarioActual, setUsuarioActual] = useState<UsuarioPerfil | null>(
    null
  );

  useEffect(() => {
    let cancelado = false;

    async function initContexto() {
      if (typeof window !== "undefined") {
        const storedEmpresa = localStorage.getItem("empresa_activa_nombre");
        const storedSucursal = localStorage.getItem("sucursal_activa_nombre");
        if (storedEmpresa) setEmpresaActivaNombre(storedEmpresa);
        if (storedSucursal) setSucursalActivaNombre(storedSucursal);
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelado) return;

        const [perfilRes, empresasRes, empActivaBD, sucActivaBD] =
          await Promise.all([
            supabase
              .from("usuarios_perfiles")
              .select("*")
              .eq("id", user.id)
              .single(),
            getEmpresasPermitidas(user.id),
            getEmpresaActivaUsuario(user.id),
            getSucursalActivaUsuario(user.id),
          ]);

        if (cancelado) return;

        if (perfilRes.data) {
          setUsuarioActual(perfilRes.data as UsuarioPerfil);
        }

        const listaEmpresas: Empresa[] = Array.isArray(empresasRes)
          ? empresasRes
          : [];
        const idEmpCandidata =
          empActivaBD !== null &&
          empActivaBD !== undefined &&
          String(empActivaBD).trim() !== ""
            ? String(empActivaBD).trim()
            : getCookieValue("empresa_activa") ||
              (typeof window !== "undefined"
                ? localStorage.getItem("empresa_activa")
                : null);

        const empresaSel: Empresa | undefined = idEmpCandidata
          ? listaEmpresas.find((e) => String(e.id) === idEmpCandidata) ||
            listaEmpresas[0]
          : listaEmpresas[0];

        if (empresaSel) {
          const nombreEmp = String(empresaSel.razon_social || "Empresa Activa");
          setEmpresaActivaNombre(nombreEmp);
          if (typeof window !== "undefined") {
            localStorage.setItem("empresa_activa", String(empresaSel.id));
            localStorage.setItem("empresa_activa_nombre", nombreEmp);
          }

          const sucursalesRes = await getSucursalesPermitidas(
            String(empresaSel.id),
            user.id
          );
          if (cancelado) return;

          const listaSuc: Sucursal[] = Array.isArray(sucursalesRes)
            ? sucursalesRes
            : [];
          const idSucCandidata =
            sucActivaBD !== null &&
            sucActivaBD !== undefined &&
            String(sucActivaBD).trim() !== ""
              ? String(sucActivaBD).trim()
              : getCookieValue("sucursal_activa") ||
                (typeof window !== "undefined"
                  ? localStorage.getItem("sucursal_activa")
                  : null);

          const sucursalSel: Sucursal | undefined = idSucCandidata
            ? listaSuc.find((s) => String(s.id) === idSucCandidata) ||
              listaSuc[0]
            : listaSuc[0];

          if (sucursalSel) {
            const nombreSuc = obtenerNombreSucursal(sucursalSel);
            setSucursalActivaNombre(nombreSuc);
            if (typeof window !== "undefined") {
              localStorage.setItem("sucursal_activa", String(sucursalSel.id));
              localStorage.setItem("sucursal_activa_nombre", nombreSuc);
            }
          }
        }
      } catch {
        // Mantener valores actuales si falla la consulta de contexto
      }
    }

    initContexto();
    return () => {
      cancelado = true;
    };
  }, []);

  const opciones: OpcionModulo[] = [
    { name: "Facturas para Clientes", href: "/facturas/emitir" },
    { name: "Consulta Facturas Clientes", href: "/facturas-emitidas" },
    { name: "Items de Facturación", href: "/items" },
    { name: "Notas para Clientes Manuales", href: "/notas-emitidas/nueva" },
    { name: "Notas para Clientes XML", href: "/facturas/notas" },
    { name: "Consulta de Notas Clientes", href: "/notas-emitidas" },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* BARRA SUPERIOR CONTEXTUAL (Botón Atrás, Empresa, Sucursal y Usuario) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer border border-slate-200 shrink-0 flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Atrás</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Empresa y Sucursal */}
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
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
              <div className="bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-emerald-600 dark:text-emerald-400">
                {usuarioActual.nombres || ""} {usuarioActual.apellidos || ""}
              </div>
            )}
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL DEL MÓDULO */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl text-emerald-600">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Clientes</h1>
              <p className="text-sm text-zinc-500">
                Facturación, ítems, recibos y notas operacionales
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op, idx) => (
              <Link
                key={idx}
                href={op.href}
                className="group p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between cursor-pointer"
              >
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{" "}
                  {op.name}
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}