"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  setEmpresaActivaUsuario,
  type Empresa as EmpresaPermitida,
} from "@/app/actions/accionesEmpresas";
import {
  obtenerCertificadosRetencion,
  type EmpresaInfo,
  type SucursalInfo,
  type CertificadoItem,
  type DiferenciaItem,
} from "./certificados-actions";
import { FileText, Printer, AlertTriangle, RotateCcw } from "lucide-react";

type Empresa = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
  nit?: string;
};

interface SucursalOption {
  id: number | string;
  nombre?: string;
  codigo_sucursal?: string;
  ciudad?: string;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function obtenerNombreEmpresa(emp: Empresa): string {
  return String(
    emp.razon_social || emp.nombre_comercial || emp.nombre || "Empresa"
  );
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

function obtenerRangoAnioActual(): { inicio: string; fin: string } {
  const anio = new Date().getFullYear();
  return {
    inicio: `${anio}-01-01`,
    fin: `${anio}-12-31`,
  };
}

export default function CertificadosRetencionPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const rangoDefecto = useMemo(() => obtenerRangoAnioActual(), []);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");

  const [sucursales, setSucursales] = useState<SucursalOption[]>([]);
  const [sucursalId, setSucursalId] = useState<string>("0");

  const [tipoRetencion, setTipoRetencion] = useState<"RENTA" | "IVA" | "ICA">(
    "RENTA"
  );
  const [fechaInicio, setFechaInicio] = useState<string>(rangoDefecto.inicio);
  const [fechaFin, setFechaFin] = useState<string>(rangoDefecto.fin);

  const [cargando, setCargando] = useState<boolean>(false);
  const [consultado, setConsultado] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [empresaInfo, setEmpresaInfo] = useState<EmpresaInfo | null>(null);
  const [sucursalInfo, setSucursalInfo] = useState<SucursalInfo | null>(null);
  const [certificados, setCertificados] = useState<CertificadoItem[]>([]);
  const [diferencias, setDiferencias] = useState<DiferenciaItem[]>([]);

  const [filtroTerceroId, setFiltroTerceroId] = useState<string>("TODOS");

  const resolverUsuarioId = useCallback(async (): Promise<string | null> => {
    if (usuarioIdRef.current) return usuarioIdRef.current;
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        usuarioIdRef.current = data.user.id;
        return data.user.id;
      }
    } catch {
      // Ignorar
    }
    const localUid = obtenerUsuarioIdDesdeLocalStorage();
    if (localUid) {
      usuarioIdRef.current = localUid;
    }
    return localUid;
  }, []);

  const persistirEmpresaActiva = useCallback(
    async (empVal: string) => {
      if (!empVal) return;
      const uid = await resolverUsuarioId();
      const empNormalizado = Number.isNaN(Number(empVal))
        ? empVal
        : Number(empVal);

      try {
        await setEmpresaActivaUsuario(empVal, uid, null);
      } catch {
        // Continuar
      }

      if (uid) {
        await supabase
          .from("usuarios_perfiles")
          .update({ empresa_activa: empNormalizado })
          .eq("id", uid);
      }
    },
    [resolverUsuarioId]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cargar solo empresas asignadas y seleccionar/persistir empresa activa
  useEffect(() => {
    if (!isMounted || inicializadoRef.current) return;
    inicializadoRef.current = true;
    let cancelado = false;

    async function init() {
      try {
        const uid = await resolverUsuarioId();
        const permitidas = await getEmpresasPermitidas(uid);
        if (cancelado) return;

        const listaEmpresas: Empresa[] = Array.isArray(permitidas)
          ? (permitidas as Empresa[])
          : [];
        setEmpresas(listaEmpresas);

        if (listaEmpresas.length > 0) {
          let empBD: string | null = null;
          try {
            const valBD = await getEmpresaActivaUsuario(uid);
            if (
              valBD !== null &&
              valBD !== undefined &&
              String(valBD).trim() !== ""
            ) {
              empBD = String(valBD).trim();
            }
          } catch {
            // Ignorar
          }

          const empCookie = getCookieValue("empresa_activa");
          const empLocal =
            typeof window !== "undefined"
              ? localStorage.getItem("empresa_activa") ||
                localStorage.getItem("empresa_id")
              : null;

          const candidata = empBD || empCookie || empLocal;
          let empresaIdAUsar = String(listaEmpresas[0].id);

          if (
            candidata &&
            listaEmpresas.some((e) => String(e.id) === String(candidata))
          ) {
            empresaIdAUsar = String(candidata);
          }

          const empElegida =
            listaEmpresas.find((e) => String(e.id) === empresaIdAUsar) ||
            listaEmpresas[0];

          if (typeof window !== "undefined") {
            localStorage.setItem("empresa_activa", empresaIdAUsar);
            localStorage.setItem("empresa_id", empresaIdAUsar);
            localStorage.setItem(
              "empresa_activa_nombre",
              obtenerNombreEmpresa(empElegida)
            );
          }
          document.cookie = `empresa_activa=${encodeURIComponent(
            empresaIdAUsar
          )}; path=/; max-age=86400; SameSite=Lax`;

          setEmpresaId(empresaIdAUsar);
        }
      } catch (err) {
        console.error(
          "Error inicializando certificados de retención:",
          err
        );
      }
    }

    init();
    return () => {
      cancelado = true;
    };
  }, [isMounted, resolverUsuarioId]);

  const handleCambioEmpresa = async (nuevoId: string) => {
    setEmpresaId(nuevoId);
    setSucursalId("0");
    setCertificados([]);
    setDiferencias([]);
    setConsultado(false);
    setErrorMsg(null);
    setFiltroTerceroId("TODOS");

    if (typeof window !== "undefined" && nuevoId) {
      const empSel = empresas.find((e) => String(e.id) === String(nuevoId));
      localStorage.setItem("empresa_activa", nuevoId);
      localStorage.setItem("empresa_id", nuevoId);
      if (empSel) {
        localStorage.setItem(
          "empresa_activa_nombre",
          obtenerNombreEmpresa(empSel)
        );
      }
      document.cookie = `empresa_activa=${encodeURIComponent(
        nuevoId
      )}; path=/; max-age=86400; SameSite=Lax`;
    }

    await persistirEmpresaActiva(nuevoId);
  };

  // Cargar sucursales de la empresa activa
  useEffect(() => {
    if (!isMounted || !empresaId) return;
    let cancelado = false;

    async function cargarSucursales() {
      const { data, error } = await supabase
        .from("sucursales")
        .select("id, nombre, codigo_sucursal, ciudad")
        .eq("empresa_id", Number(empresaId))
        .order("codigo_sucursal", { ascending: true });

      if (cancelado) return;
      if (!error && Array.isArray(data)) {
        setSucursales(data as SucursalOption[]);
      } else {
        setSucursales([]);
      }
    }

    cargarSucursales();
    return () => {
      cancelado = true;
    };
  }, [isMounted, empresaId]);

  const handleGenerar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setDiferencias([]);
    setCertificados([]);
    setFiltroTerceroId("TODOS");

    if (!empresaId) {
      setErrorMsg("Debe seleccionar una empresa activa.");
      return;
    }
    if (!fechaInicio || !fechaFin) {
      setErrorMsg("Debe seleccionar la fecha inicial y la fecha final.");
      return;
    }
    if (fechaInicio > fechaFin) {
      setErrorMsg("La fecha inicial no puede ser mayor que la fecha final.");
      return;
    }

    setCargando(true);
    setConsultado(true);

    const res = await obtenerCertificadosRetencion(
      empresaId,
      sucursalId,
      tipoRetencion,
      fechaInicio,
      fechaFin
    );

    setCargando(false);

    setEmpresaInfo(res.empresa || null);
    setSucursalInfo(res.sucursal || null);
    setDiferencias(res.diferencias || []);

    if (!res.success) {
      setErrorMsg(res.error || "No se pudieron generar los certificados.");
      return;
    }

    setCertificados(res.certificados || []);
  };

  const handleLimpiar = () => {
    const rango = obtenerRangoAnioActual();
    setSucursalId("0");
    setTipoRetencion("RENTA");
    setFechaInicio(rango.inicio);
    setFechaFin(rango.fin);
    setCertificados([]);
    setDiferencias([]);
    setConsultado(false);
    setErrorMsg(null);
    setFiltroTerceroId("TODOS");
  };

  const certificadosVisibles = useMemo(() => {
    if (filtroTerceroId === "TODOS") return certificados;
    return certificados.filter(
      (c) => String(c.tercero.id) === String(filtroTerceroId)
    );
  }, [certificados, filtroTerceroId]);

  const fmt = (v: number) => `$ ${Number(v || 0).toLocaleString("es-CO")}`;

  const formatearTarifa = (tarifa: number, tipo: string) => {
    const num = Number(tarifa || 0);
    if (tipo === "ICA") {
      const porMil = num * 1000;
      return `${porMil.toFixed(2).replace(/\.?0+$/, "")} x mil`;
    }
    const porCiento = num * 100;
    return `${porCiento.toFixed(2).replace(/\.?0+$/, "")}%`;
  };

  if (!isMounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-sm font-sans">
      {/* Encabezado */}
      <div className="border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition border border-slate-200 cursor-pointer shrink-0"
          >
            ← Atrás
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Certificados de Retención
            </h1>
            <p className="text-sm text-slate-500">
              Generación y validación contable de certificados por tercero y
              concepto.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {certificadosVisibles.length > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-2xs transition"
            >
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
          )}
          <button
            type="button"
            onClick={handleLimpiar}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer border border-slate-200 transition"
          >
            <RotateCcw className="w-4 h-4" /> Limpiar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <form
        onSubmit={handleGenerar}
        className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 print:hidden"
      >
        <div className="md:col-span-4">
          <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
            Empresa Activa
          </label>
          <select
            value={empresaId}
            onChange={(e) => handleCambioEmpresa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold text-sm outline-none"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {obtenerNombreEmpresa(emp)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
            Sucursal
          </label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold text-xs outline-none"
          >
            <option value="0">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={String(suc.id)}>
                {suc.codigo_sucursal ? `${suc.codigo_sucursal} - ` : ""}
                {suc.nombre || suc.ciudad || `Sucursal #${suc.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
            Impuesto
          </label>
          <select
            value={tipoRetencion}
            onChange={(e) =>
              setTipoRetencion(e.target.value as "RENTA" | "IVA" | "ICA")
            }
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-xs outline-none"
          >
            <option value="RENTA">Renta</option>
            <option value="IVA">IVA</option>
            <option value="ICA">ICA</option>
          </select>
        </div>

        <div className="md:col-span-3 grid grid-cols-2 gap-2">
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Desde
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              required
              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-slate-900 font-mono text-xs outline-none"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Hasta
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              required
              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-slate-900 font-mono text-xs outline-none"
            />
          </div>
        </div>

        <div className="md:col-span-12 flex justify-end">
          <button
            type="submit"
            disabled={cargando || !empresaId}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-2xs transition"
          >
            <FileText className="w-4 h-4" />
            {cargando ? "Validando y generando..." : "Generar Certificados"}
          </button>
        </div>
      </form>

      {/* Mensaje de error o bloqueo por diferencias */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-start gap-3 print:hidden">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabla de diferencias contables si existen */}
      {diferencias.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl shadow-2xs overflow-hidden print:hidden">
          <div className="px-4 py-3 bg-red-100/70 border-b border-red-200 font-bold text-red-900 uppercase text-xs">
            Diferencias Detectadas entre Auxiliar de Retenciones y Contabilidad
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b uppercase">
                <tr>
                  <th className="p-3">NIT</th>
                  <th className="p-3">Tercero</th>
                  <th className="p-3 text-right">Auxiliar Retenciones</th>
                  <th className="p-3 text-right">Contabilidad</th>
                  <th className="p-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {diferencias.map((dif) => (
                  <tr key={String(dif.tercero_id)} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-700">{dif.nit}</td>
                    <td className="p-3 font-semibold text-slate-900">
                      {dif.nombre}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(dif.auxiliar)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(dif.contabilidad)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-red-700">
                      {fmt(dif.diferencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filtro por tercero cuando hay certificados generados */}
      {certificados.length > 0 && (
        <div className="bg-white border rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
          <div className="text-xs font-bold text-slate-700">
            Certificados disponibles: {certificadosVisibles.length} de{" "}
            {certificados.length}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-600 shrink-0">
              Filtrar tercero:
            </label>
            <select
              value={filtroTerceroId}
              onChange={(e) => setFiltroTerceroId(e.target.value)}
              className="w-full sm:w-80 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="TODOS">Todos los terceros</option>
              {certificados.map((c) => (
                <option key={String(c.tercero.id)} value={String(c.tercero.id)}>
                  {c.tercero.nombre}{" "}
                  {c.tercero.nit ? `(${c.tercero.nit}${c.tercero.dv || ""})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Listado de certificados */}
      {cargando ? (
        <div className="p-12 text-center bg-white border rounded-xl text-slate-500 font-semibold">
          Validando movimientos y generando certificados de {tipoRetencion}...
        </div>
      ) : certificadosVisibles.length === 0 ? (
        consultado && diferencias.length === 0 && !errorMsg ? (
          <div className="p-12 text-center bg-white border rounded-xl text-slate-500 italic">
            No se encontraron movimientos de retención ({tipoRetencion})
            practicados a proveedores entre {fechaInicio} y {fechaFin}.
          </div>
        ) : null
      ) : (
        <div className="space-y-6">
          {certificadosVisibles.map((cert) => (
            <div
              key={String(cert.tercero.id)}
              className="bg-white border border-slate-300 rounded-xl p-6 space-y-5 shadow-2xs break-inside-avoid"
            >
              {/* Encabezado del certificado */}
              <div className="border-b pb-4 flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase text-indigo-700">
                    Certificado de Retención en la Fuente — {tipoRetencion}
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {empresaInfo?.razon_social || "Empresa"}
                  </h2>
                  <p className="text-xs text-slate-600 font-mono">
                    NIT: {empresaInfo?.nit_identificacion || ""}
                    {empresaInfo?.dv ? `-${empresaInfo.dv}` : ""}
                  </p>
                  <p className="text-xs text-slate-600">
                    Dirección: {empresaInfo?.direccion || "No registrada"}
                    {empresaInfo?.ciudad ? ` · ${empresaInfo.ciudad}` : ""}
                    {empresaInfo?.telefono
                      ? ` · Tel: ${empresaInfo.telefono}`
                      : ""}
                  </p>
                  {sucursalInfo?.nombre && (
                    <p className="text-xs text-slate-500">
                      Sucursal: {sucursalInfo.nombre}
                    </p>
                  )}
                </div>

                <div className="md:text-right space-y-1 text-xs">
                  <div className="font-bold text-slate-700 uppercase">
                    Periodo Certificado
                  </div>
                  <div className="font-mono text-slate-900 font-semibold">
                    {fechaInicio} al {fechaFin}
                  </div>
                </div>
              </div>

              {/* Datos del tercero retenido */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Tercero / Proveedor
                  </span>
                  <span className="font-bold text-slate-900">
                    {cert.tercero.nombre}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Identificación (NIT / CC)
                  </span>
                  <span className="font-mono font-semibold text-slate-800">
                    {cert.tercero.nit || "N/A"}
                    {cert.tercero.dv || ""}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Ciudad / Dirección
                  </span>
                  <span className="text-slate-700">
                    {cert.tercero.ciudad || "N/A"}
                    {cert.tercero.direccion ? ` · ${cert.tercero.direccion}` : ""}
                  </span>
                </div>
              </div>

              {/* Detalle por concepto */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b uppercase">
                    <tr>
                      <th className="p-3">Concepto de Retención</th>
                      <th className="p-3 text-center">Tarifa</th>
                      <th className="p-3 text-right">Base Gravable</th>
                      <th className="p-3 text-right">Valor Retenido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cert.detalles.map((det, i) => (
                      <tr key={`${det.concepto}_${i}`}>
                        <td className="p-3 font-semibold text-slate-900">
                          {det.concepto}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-700">
                          {formatearTarifa(det.tarifa, tipoRetencion)}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-800">
                          {fmt(det.base)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-700">
                          {fmt(det.retenido)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-bold text-xs">
                    <tr>
                      <td colSpan={2} className="p-3 uppercase">
                        Totales del Tercero
                      </td>
                      <td className="p-3 text-right font-mono">
                        {fmt(cert.total_base)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-400">
                        {fmt(cert.total_retenido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}