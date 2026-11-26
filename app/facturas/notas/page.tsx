"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import NotaEmitidaXmlUploader from "../../../components/nota-emitida-xml-uploader";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
  setEmpresaActivaUsuario,
  setSucursalActivaUsuario,
  type Empresa,
  type Sucursal,
} from "@/app/actions/accionesEmpresas";

interface NotaEmitida {
  id: string;
  tipo_nota: "CREDITO" | "DEBITO";
  numero_nota: string;
  cude: string | null;
  fecha_emision: string;
  fecha_contable: string;
  subtotal: number;
  impuestos: number;
  monto_total: number;
  motivo: string | null;
  facturas_emitidas?: {
    numero_factura: string;
  } | null;
}

type EmpresaExtendida = Empresa & {
  nombre?: string;
  nombre_comercial?: string;
  nit?: string;
  nit_identificacion?: string;
};

type SucursalExtendida = Sucursal & {
  codigo_sucursal?: string;
};

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

function clearCookieValue(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function obtenerNombreEmpresa(emp: Empresa): string {
  const e = emp as EmpresaExtendida;
  return String(e.razon_social || e.nombre_comercial || e.nombre || "Empresa");
}

function obtenerEtiquetaEmpresa(emp: Empresa): string {
  const e = emp as EmpresaExtendida;
  const nombre = obtenerNombreEmpresa(emp);
  const nit = e.nit_identificacion || e.nit || "";
  return nit ? `${nombre} (${nit})` : nombre;
}

function obtenerNombreSucursal(suc: Sucursal): string {
  const s = suc as SucursalExtendida;
  const base = String(s.nombre || `Sucursal ${s.id}`);
  return s.codigo_sucursal ? `${base} (${s.codigo_sucursal})` : base;
}

function obtenerUsuarioIdDesdeLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  for (const clave of ["usuario_id", "user_id", "uid"]) {
    const val = localStorage.getItem(clave);
    if (val && val.trim()) return val.trim();
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.includes("auth-token") || k.includes("supabase")) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const idEncontrado =
          parsed?.user?.id ||
          parsed?.currentSession?.user?.id ||
          parsed?.session?.user?.id ||
          null;
        if (idEncontrado && typeof idEncontrado === "string") {
          return idEncontrado;
        }
      } catch {
        // Ignorar
      }
    }
  }
  return null;
}

export default function NotasEmitidasPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const primeraCargaRef = useRef<boolean>(true);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  const [notas, setNotas] = useState<NotaEmitida[]>([]);
  const [loadingNotas, setLoadingNotas] = useState<boolean>(false);

  const cargarNotas = useCallback(async (empTarget: string, sucTarget: string) => {
    if (!empTarget) {
      setNotas([]);
      return;
    }

    setLoadingNotas(true);
    try {
      let query = supabase
        .from("notas_emitidas")
        .select(
          `
          id,
          tipo_nota,
          numero_nota,
          cude,
          fecha_emision,
          fecha_contable,
          subtotal,
          impuestos,
          monto_total,
          motivo,
          facturas_emitidas (
            numero_factura
          )
        `
        )
        .eq("empresa_id", Number(empTarget))
        .order("fecha_contable", { ascending: false });

      if (sucTarget) {
        query = query.eq("sucursal_id", Number(sucTarget));
      }

      const { data, error } = await query;
      if (!error && data) {
        setNotas(data as unknown as NotaEmitida[]);
      } else {
        setNotas([]);
      }
    } finally {
      setLoadingNotas(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !primeraCargaRef.current) return;
    primeraCargaRef.current = false;

    async function initContexto() {
      setLoadingEmpresas(true);
      try {
        let uid: string | null = null;
        try {
          const { data } = await supabase.auth.getUser();
          if (data?.user?.id) uid = data.user.id;
        } catch {
          // Ignorar
        }
        if (!uid) {
          uid = obtenerUsuarioIdDesdeLocalStorage();
        }
        usuarioIdRef.current = uid;

        const permitidas = await getEmpresasPermitidas(uid);
        const listaEmp: Empresa[] = Array.isArray(permitidas) ? permitidas : [];
        if (listaEmp.length === 0) {
          setEmpresas([]);
          setEmpresaId("");
          setSucursales([]);
          setSucursalId("");
          return;
        }

        const ordenadas = [...listaEmp].sort((a, b) =>
          obtenerNombreEmpresa(a).localeCompare(obtenerNombreEmpresa(b), "es", {
            sensitivity: "base",
          })
        );
        setEmpresas(ordenadas);

        let empBD: string | null = null;
        try {
          const valBD = await getEmpresaActivaUsuario(uid);
          if (valBD !== null && valBD !== undefined && String(valBD).trim() !== "") {
            empBD = String(valBD).trim();
          }
        } catch {
          // Ignorar
        }

        const empLocal =
          typeof window !== "undefined"
            ? localStorage.getItem("empresa_activa") ||
              localStorage.getItem("empresa_id")
            : null;
        const empCookie = getCookieValue("empresa_activa");

        const candidata = empBD || empLocal || empCookie;
        const empElegida = candidata
          ? ordenadas.find((e) => String(e.id) === String(candidata)) ||
            ordenadas[0]
          : ordenadas[0];

        const idEmpFinal = String(empElegida.id);
        setEmpresaId(idEmpFinal);

        if (typeof window !== "undefined") {
          localStorage.setItem("empresa_activa", idEmpFinal);
          localStorage.setItem("empresa_id", idEmpFinal);
          localStorage.setItem(
            "empresa_activa_nombre",
            obtenerNombreEmpresa(empElegida)
          );
        }
        setCookieValue("empresa_activa", idEmpFinal);

        const resSuc = await getSucursalesPermitidas(idEmpFinal, uid);
        const listaSuc: Sucursal[] = Array.isArray(resSuc) ? resSuc : [];
        setSucursales(listaSuc);

        let idSucFinal = "";
        if (listaSuc.length > 0) {
          let sucBD: string | null = null;
          try {
            const valSuc = await getSucursalActivaUsuario(uid);
            if (valSuc !== null && valSuc !== undefined && String(valSuc).trim() !== "") {
              sucBD = String(valSuc).trim();
            }
          } catch {
            // Ignorar
          }

          const sucLocal =
            typeof window !== "undefined"
              ? localStorage.getItem("sucursal_activa") ||
                localStorage.getItem("sucursal_id")
              : null;
          const sucCookie = getCookieValue("sucursal_activa");
          const candidataSuc = sucBD || sucLocal || sucCookie;

          const sucElegida = candidataSuc
            ? listaSuc.find((s) => String(s.id) === String(candidataSuc))
            : undefined;

          if (sucElegida) {
            idSucFinal = String(sucElegida.id);
            setSucursalId(idSucFinal);
            if (typeof window !== "undefined") {
              localStorage.setItem("sucursal_activa", idSucFinal);
              localStorage.setItem("sucursal_id", idSucFinal);
              localStorage.setItem("sucursal_activa_nombre", sucElegida.nombre);
            }
            setCookieValue("sucursal_activa", idSucFinal);
          }
        }

        await cargarNotas(idEmpFinal, idSucFinal);
      } finally {
        setLoadingEmpresas(false);
      }
    }

    initContexto();
  }, [isMounted, cargarNotas]);

  const handleCambioEmpresa = async (nuevaEmp: string) => {
    setEmpresaId(nuevaEmp);
    setSucursalId("");
    setSucursales([]);
    setNotas([]);

    if (typeof window !== "undefined") {
      if (nuevaEmp) {
        const empSel = empresas.find((e) => String(e.id) === String(nuevaEmp));
        localStorage.setItem("empresa_activa", nuevaEmp);
        localStorage.setItem("empresa_id", nuevaEmp);
        if (empSel) {
          localStorage.setItem(
            "empresa_activa_nombre",
            obtenerNombreEmpresa(empSel)
          );
        }
        setCookieValue("empresa_activa", nuevaEmp);
      } else {
        localStorage.removeItem("empresa_activa");
        localStorage.removeItem("empresa_id");
        localStorage.removeItem("empresa_activa_nombre");
        clearCookieValue("empresa_activa");
      }

      localStorage.removeItem("sucursal_activa");
      localStorage.removeItem("sucursal_id");
      localStorage.removeItem("sucursal_activa_nombre");
      clearCookieValue("sucursal_activa");
    }

    if (!nuevaEmp) return;

    setEmpresaActivaUsuario(nuevaEmp, usuarioIdRef.current, null).catch(() => {});

    const resSuc = await getSucursalesPermitidas(nuevaEmp, usuarioIdRef.current);
    const listaSuc: Sucursal[] = Array.isArray(resSuc) ? resSuc : [];
    setSucursales(listaSuc);

    await cargarNotas(nuevaEmp, "");
  };

  const handleCambioSucursal = async (nuevaSuc: string) => {
    setSucursalId(nuevaSuc);

    if (typeof window !== "undefined") {
      if (nuevaSuc) {
        const sucSel = sucursales.find((s) => String(s.id) === String(nuevaSuc));
        localStorage.setItem("sucursal_activa", nuevaSuc);
        localStorage.setItem("sucursal_id", nuevaSuc);
        if (sucSel?.nombre) {
          localStorage.setItem("sucursal_activa_nombre", sucSel.nombre);
        }
        setCookieValue("sucursal_activa", nuevaSuc);
      } else {
        localStorage.removeItem("sucursal_activa");
        localStorage.removeItem("sucursal_id");
        localStorage.removeItem("sucursal_activa_nombre");
        clearCookieValue("sucursal_activa");
      }
    }

    setSucursalActivaUsuario(nuevaSuc || null, usuarioIdRef.current).catch(() => {});
    await cargarNotas(empresaId, nuevaSuc);
  };

  if (!isMounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded"></div>
              <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer border border-slate-200 shrink-0 flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Atrás</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Notas Crédito y Débito Emitidas (Ventas)
            </h1>
            <p className="text-sm text-slate-500">
              Registro y causación contable de notas de ajuste UBL 2.1 sobre facturas de venta.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Empresa Activa
          </label>
          <select
            value={empresaId}
            onChange={(e) => handleCambioEmpresa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {loadingEmpresas ? (
              <option value="">-- Cargando empresas --</option>
            ) : (
              empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {obtenerEtiquetaEmpresa(emp)}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Sucursal
          </label>
          <select
            value={sucursalId}
            disabled={!empresaId}
            onChange={(e) => handleCambioSucursal(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {obtenerNombreSucursal(suc)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <NotaEmitidaXmlUploader
            selectedCompanyId={empresaId}
            selectedBranchId={sucursalId}
            onNotaProcesada={() => cargarNotas(empresaId, sucursalId)}
          />
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-bold text-slate-800">
              Notas Emitidas Registradas ({notas.length})
            </h2>
            <button
              type="button"
              onClick={() => cargarNotas(empresaId, sucursalId)}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium cursor-pointer"
            >
              🔄 Recargar
            </button>
          </div>

          {loadingNotas ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              Cargando notas emitidas...
            </div>
          ) : notas.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No hay notas emitidas registradas para la selección actual.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="p-3">Tipo</th>
                    <th className="p-3">N° Nota</th>
                    <th className="p-3">Factura Venta Ref.</th>
                    <th className="p-3">F. Emisión</th>
                    <th className="p-3">F. Contable</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {notas.map((nota) => (
                    <tr
                      key={nota.id}
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${
                            nota.tipo_nota === "CREDITO"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {nota.tipo_nota}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-900">
                        {nota.numero_nota}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {nota.facturas_emitidas?.numero_factura || "—"}
                      </td>
                      <td className="p-3 text-slate-600">
                        {nota.fecha_emision}
                      </td>
                      <td className="p-3 font-mono text-indigo-900 font-medium">
                        {nota.fecha_contable || nota.fecha_emision}
                      </td>
                      <td
                        className="p-3 text-right font-mono font-bold text-slate-900"
                        suppressHydrationWarning
                      >
                        ${Number(nota.monto_total).toLocaleString("es-CO")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}