"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DollarSign,
  ArrowLeft,
  ArrowRight,
  Building2,
  MapPin,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
  type Empresa,
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

type EmpresaConNombre = Empresa & {
  nombre?: string;
  nombre_comercial?: string;
};

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export default function TesoreriaPage() {
  const [empresaActivaNombre, setEmpresaActivaNombre] =
    useState<string>("Empresa Principal");
  const [sucursalActivaNombre, setSucursalActivaNombre] = useState<string>(
    "Todas las sucursales"
  );
  const [usuarioActual, setUsuarioActual] = useState<UsuarioPerfil | null>(
    null
  );

  useEffect(() => {
    let cancelado = false;

    async function initContexto() {
      let uid: string | null = null;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          uid = user.id;
          const { data: perfil } = await supabase
            .from("usuarios_perfiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (!cancelado && perfil) {
            setUsuarioActual(perfil as UsuarioPerfil);
          }
        }
      } catch {
        // Ignorar errores de sesión
      }

      if (cancelado) return;

      const storedEmpresaNombre =
        typeof window !== "undefined"
          ? localStorage.getItem("empresa_activa_nombre")
          : null;
      const storedSucursalNombre =
        typeof window !== "undefined"
          ? localStorage.getItem("sucursal_activa_nombre")
          : null;

      if (storedEmpresaNombre) {
        setEmpresaActivaNombre(storedEmpresaNombre);
      }
      if (storedSucursalNombre) {
        setSucursalActivaNombre(storedSucursalNombre);
      }

      const empIdCandidata =
        getCookieValue("empresa_activa") ||
        (typeof window !== "undefined"
          ? localStorage.getItem("empresa_activa") ||
            localStorage.getItem("empresa_id")
          : null) ||
        (await getEmpresaActivaUsuario(uid));

      const empresasPermitidas = await getEmpresasPermitidas(uid);
      if (cancelado) return;

      if (Array.isArray(empresasPermitidas) && empresasPermitidas.length > 0) {
        const listaEmp = empresasPermitidas as EmpresaConNombre[];
        const empEncontrada = empIdCandidata
          ? listaEmp.find((e) => String(e.id) === String(empIdCandidata)) ||
            listaEmp[0]
          : listaEmp[0];

        const nombreEmp =
          empEncontrada.razon_social ||
          empEncontrada.nombre_comercial ||
          empEncontrada.nombre ||
          "Empresa Principal";

        if (!storedEmpresaNombre) {
          setEmpresaActivaNombre(nombreEmp);
        }

        const sucIdCandidata =
          getCookieValue("sucursal_activa") ||
          (typeof window !== "undefined"
            ? localStorage.getItem("sucursal_activa") ||
              localStorage.getItem("sucursal_id")
            : null) ||
          (await getSucursalActivaUsuario(uid));

        if (sucIdCandidata) {
          const sucursalesPermitidas = await getSucursalesPermitidas(
            String(empEncontrada.id),
            uid
          );
          if (cancelado) return;

          if (Array.isArray(sucursalesPermitidas)) {
            const sucEncontrada = sucursalesPermitidas.find(
              (s) => String(s.id) === String(sucIdCandidata)
            );
            if (sucEncontrada && !storedSucursalNombre) {
              setSucursalActivaNombre(sucEncontrada.nombre);
            }
          }
        }
      }
    }

    initContexto();
    return () => {
      cancelado = true;
    };
  }, []);

  const opciones: OpcionModulo[] = [
    { name: "Egresos", href: "/tesoreria/pagos" },
    { name: "Recibos de Caja Clientes", href: "/cobros/nuevo" },
    { name: "Consignaciones", href: "/tesoreria/consignaciones" },
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
              <Building2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
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
              <div className="bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-purple-600 dark:text-purple-400">
                {usuarioActual.nombres || ""} {usuarioActual.apellidos || ""}
              </div>
            )}
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL DEL MÓDULO */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/50 rounded-2xl text-purple-600">
              <DollarSign className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Tesorería</h1>
              <p className="text-sm text-zinc-500">
                Control de flujo de caja, pagos y consignaciones bancarias
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op) => (
              <Link
                key={op.href}
                href={op.href}
                className="group p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 hover:border-purple-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between cursor-pointer"
              >
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>{" "}
                  {op.name}
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}