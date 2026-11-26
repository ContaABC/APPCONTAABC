"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
  setEmpresaActivaUsuario,
  setSucursalActivaUsuario,
  type Empresa as EmpresaPermitida,
  type Sucursal as SucursalPermitida,
} from "@/app/actions/accionesEmpresas";
import { obtenerResumenBalanceYDetalle } from "./actions";

type EmpresaItem = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
};

type SucursalItem = SucursalPermitida & {
  nombre_sucursal?: string;
  codigo_sucursal?: string;
};

interface ResumenNivel {
  nivel: string;
  suma_debito: number;
  suma_credito: number;
  diferencia: number;
  cuadrado: boolean;
}

interface CatalogoInfo {
  id?: string | number;
  codigo?: string;
  codigo_concepto?: string;
  codigo_subconcepto?: string;
  codigo_auxiliar?: string;
  nombre?: string;
  concepto_niif_id?: string | number;
  subconcepto_niif_id?: string | number;
}

interface DetalleConcepto {
  concepto_niif_id: string;
  total_debito: number;
  total_credito: number;
  saldo_final?: number;
  conceptos_niif: CatalogoInfo | null;
}

interface DetalleSubconcepto {
  subconcepto_niif_id: string;
  total_debito: number;
  total_credito: number;
  saldo_final?: number;
  subconceptos_niif: CatalogoInfo | null;
}

interface DetalleAuxiliar {
  concepto_auxiliar_id: string;
  total_debito: number;
  total_credito: number;
  saldo_final?: number;
  conceptos_auxiliares: CatalogoInfo | null;
}

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

export default function ConsultasSaldosPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [sucursales, setSucursales] = useState<SucursalItem[]>([]);

  // Filtros
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [anio, setAnio] = useState<string>("2026");
  const [mes, setMes] = useState<string>("");

  // Datos
  const [loading, setLoading] = useState<boolean>(false);
  const [resumen, setResumen] = useState<ResumenNivel[]>([]);
  const [detalle, setDetalle] = useState<{
    conceptos: DetalleConcepto[];
    subconceptos: DetalleSubconcepto[];
    auxiliares: DetalleAuxiliar[];
  }>({
    conceptos: [],
    subconceptos: [],
    auxiliares: [],
  });

  // Estados desplegables
  const [expandedConceptos, setExpandedConceptos] = useState<{
    [id: string]: boolean;
  }>({});
  const [expandedSubconceptos, setExpandedSubconceptos] = useState<{
    [id: string]: boolean;
  }>({});

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

  const persistirContextoEnPerfil = useCallback(
    async (empVal: string | null, sucVal: string | null) => {
      const uid = await resolverUsuarioId();
      if (!uid) return;

      const empNormalizado =
        empVal && empVal.trim() !== ""
          ? Number.isNaN(Number(empVal))
            ? empVal
            : Number(empVal)
          : null;

      const sucNormalizado =
        sucVal && sucVal.trim() !== ""
          ? Number.isNaN(Number(sucVal))
            ? sucVal
            : Number(sucVal)
          : null;

      try {
        if (empVal && empVal.trim() !== "") {
          await setEmpresaActivaUsuario(empVal, uid, sucVal || null);
        }
        if (sucVal !== undefined) {
          await setSucursalActivaUsuario(sucVal || null, uid);
        }
      } catch {
        // Continuar con actualización directa si la action falla
      }

      const payload: {
        empresa_activa?: string | number | null;
        sucursal_activa?: string | number | null;
      } = {};
      if (empVal !== undefined) payload.empresa_activa = empNormalizado;
      if (sucVal !== undefined) payload.sucursal_activa = sucNormalizado;

      if (Object.keys(payload).length > 0) {
        await supabase
          .from("usuarios_perfiles")
          .update(payload)
          .eq("id", uid);
      }
    },
    [resolverUsuarioId]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Inicializar Empresas y Sucursales permitidas
  useEffect(() => {
    if (!isMounted || inicializadoRef.current) return;
    inicializadoRef.current = true;
    let cancelado = false;

    async function initContexto() {
      try {
        const uid = await resolverUsuarioId();
        const permitidas = await getEmpresasPermitidas(uid);
        if (cancelado) return;

        const listaEmpresas: EmpresaItem[] = Array.isArray(permitidas)
          ? (permitidas as EmpresaItem[])
          : [];

        if (listaEmpresas.length > 0) {
          setEmpresas(listaEmpresas);

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

          let empresaIdAUsar = String(listaEmpresas[0].id);
          const candidataEmp = empBD || empCookie || empLocal;
          if (
            candidataEmp &&
            listaEmpresas.some((e) => String(e.id) === String(candidataEmp))
          ) {
            empresaIdAUsar = String(candidataEmp);
          }

          const empElegida =
            listaEmpresas.find((e) => String(e.id) === empresaIdAUsar) ||
            listaEmpresas[0];

          setEmpresaId(empresaIdAUsar);
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

          const sucPermitidas = await getSucursalesPermitidas(
            empresaIdAUsar,
            uid
          );
          if (cancelado) return;

          const listaSuc: SucursalItem[] = Array.isArray(sucPermitidas)
            ? (sucPermitidas as SucursalItem[])
            : [];
          setSucursales(listaSuc);

          if (listaSuc.length > 0) {
            let sucBD: string | null = null;
            try {
              const valSuc = await getSucursalActivaUsuario(uid);
              if (
                valSuc !== null &&
                valSuc !== undefined &&
                String(valSuc).trim() !== ""
              ) {
                sucBD = String(valSuc).trim();
              }
            } catch {
              // Ignorar
            }

            const sucCookie = getCookieValue("sucursal_activa");
            const sucLocal =
              typeof window !== "undefined"
                ? localStorage.getItem("sucursal_activa") ||
                  localStorage.getItem("sucursal_id")
                : null;
            const candidataSuc = sucBD || sucCookie || sucLocal;

            if (candidataSuc) {
              const sucElegida = listaSuc.find(
                (s) => String(s.id) === String(candidataSuc)
              );
              if (sucElegida) {
                const idSucFinal = String(sucElegida.id);
                setSucursalId(idSucFinal);
                if (typeof window !== "undefined") {
                  localStorage.setItem("sucursal_activa", idSucFinal);
                  localStorage.setItem("sucursal_id", idSucFinal);
                  localStorage.setItem(
                    "sucursal_activa_nombre",
                    obtenerNombreSucursal(sucElegida)
                  );
                }
                document.cookie = `sucursal_activa=${encodeURIComponent(
                  idSucFinal
                )}; path=/; max-age=86400; SameSite=Lax`;
              }
            }
          }
        }
      } catch (err) {
        console.error("Error inicializando contexto de saldos:", err);
      }
    }

    initContexto();
    return () => {
      cancelado = true;
    };
  }, [isMounted, resolverUsuarioId]);

  const handleCambioEmpresa = async (nuevoId: string) => {
    setEmpresaId(nuevoId);
    setSucursalId("");
    setSucursales([]);

    if (typeof window !== "undefined") {
      if (nuevoId) {
        const empSel = empresas.find((e) => String(e.id) === nuevoId);
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
      } else {
        localStorage.removeItem("empresa_activa");
        localStorage.removeItem("empresa_id");
        localStorage.removeItem("empresa_activa_nombre");
        document.cookie = "empresa_activa=; path=/; max-age=0; SameSite=Lax";
      }
      localStorage.removeItem("sucursal_activa");
      localStorage.removeItem("sucursal_id");
      localStorage.removeItem("sucursal_activa_nombre");
      document.cookie = "sucursal_activa=; path=/; max-age=0; SameSite=Lax";
    }

    if (!nuevoId) {
      await persistirContextoEnPerfil(null, null);
      return;
    }

    const uid = await resolverUsuarioId();
    const sucPermitidas = await getSucursalesPermitidas(nuevoId, uid);
    const listaSuc: SucursalItem[] = Array.isArray(sucPermitidas)
      ? (sucPermitidas as SucursalItem[])
      : [];
    setSucursales(listaSuc);
    await persistirContextoEnPerfil(nuevoId, null);
  };

  const handleCambioSucursal = async (nuevoSucId: string) => {
    setSucursalId(nuevoSucId);
    if (typeof window !== "undefined") {
      if (nuevoSucId) {
        const sucSel = sucursales.find((s) => String(s.id) === nuevoSucId);
        localStorage.setItem("sucursal_activa", nuevoSucId);
        localStorage.setItem("sucursal_id", nuevoSucId);
        if (sucSel) {
          localStorage.setItem(
            "sucursal_activa_nombre",
            obtenerNombreSucursal(sucSel)
          );
        }
        document.cookie = `sucursal_activa=${encodeURIComponent(
          nuevoSucId
        )}; path=/; max-age=86400; SameSite=Lax`;
      } else {
        localStorage.removeItem("sucursal_activa");
        localStorage.removeItem("sucursal_id");
        localStorage.removeItem("sucursal_activa_nombre");
        document.cookie = "sucursal_activa=; path=/; max-age=0; SameSite=Lax";
      }
    }

    await persistirContextoEnPerfil(empresaId || null, nuevoSucId || null);
  };

  useEffect(() => {
    if (!empresaId || !isMounted) return;
    async function cargarDatos() {
      setLoading(true);
      const res = await obtenerResumenBalanceYDetalle(
        Number(empresaId),
        sucursalId ? Number(sucursalId) : null,
        anio ? Number(anio) : null,
        mes ? Number(mes) : null
      );

      if (res.success) {
        setResumen((res.resumenBalance || []) as ResumenNivel[]);
        setDetalle(
          (res.detalle as {
            conceptos: DetalleConcepto[];
            subconceptos: DetalleSubconcepto[];
            auxiliares: DetalleAuxiliar[];
          }) || { conceptos: [], subconceptos: [], auxiliares: [] }
        );
      } else {
        alert("Error cargando saldos: " + res.error);
        setResumen([]);
        setDetalle({ conceptos: [], subconceptos: [], auxiliares: [] });
      }
      setLoading(false);
    }
    cargarDatos();
  }, [empresaId, sucursalId, anio, mes, isMounted]);

  const toggleConcepto = (id: string) =>
    setExpandedConceptos((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSubconcepto = (id: string) =>
    setExpandedSubconceptos((prev) => ({ ...prev, [id]: !prev[id] }));

  const fmt = (v: number) =>
    `$ ${Number(v || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`;

  const mesesAnio = [
    { num: 1, nombre: "Enero" },
    { num: 2, nombre: "Febrero" },
    { num: 3, nombre: "Marzo" },
    { num: 4, nombre: "Abril" },
    { num: 5, nombre: "Mayo" },
    { num: 6, nombre: "Junio" },
    { num: 7, nombre: "Julio" },
    { num: 8, nombre: "Agosto" },
    { num: 9, nombre: "Septiembre" },
    { num: 10, nombre: "Octubre" },
    { num: 11, nombre: "Noviembre" },
    { num: 12, nombre: "Diciembre" },
  ];

  if (!isMounted) {
    return (
      <div className="p-4 text-center text-xs text-slate-400">
        Cargando módulo de saldos...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4 text-xs font-sans">
      <div className="border-b pb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition border border-slate-200 cursor-pointer shrink-0"
        >
          ← Atrás
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-800">
            Consulta y Verificación de Saldos Acumulados
          </h1>
          <p className="text-[11px] text-slate-500">
            Verificación del cuadre (Débitos vs Créditos) en Conceptos,
            Subconceptos y Auxiliares.
          </p>
        </div>
      </div>

      {/* CONTROLES / FILTROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Empresa
          </label>
          <select
            value={empresaId}
            onChange={(e) => handleCambioEmpresa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {obtenerNombreEmpresa(emp)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Sucursal
          </label>
          <select
            value={sucursalId}
            onChange={(e) => handleCambioSucursal(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="">-- Todas las Sucursales --</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {obtenerNombreSucursal(suc)}{" "}
                {suc.codigo_sucursal ? `(${suc.codigo_sucursal})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Año
          </label>
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none text-center"
          >
            <option value="">-- Todos --</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Mes
          </label>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            <option value="">-- Acumulado Año --</option>
            {mesesAnio.map((m) => (
              <option key={m.num} value={m.num}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-center text-slate-400">
          Consultando información de saldos...
        </div>
      ) : (
        <>
          {/* TARJETAS RESUMEN GLOBAL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {resumen.map((r, idx) => (
              <div
                key={idx}
                className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm space-y-1"
              >
                <h3 className="font-bold text-slate-700 border-b pb-1 uppercase text-[11px]">
                  {r.nivel}
                </h3>
                <div className="flex justify-between text-[11px]">
                  <span>Total Débito:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {fmt(r.suma_debito)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Total Crédito:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {fmt(r.suma_credito)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-[11px]">
                  <span>Diferencia:</span>
                  <span
                    className={`font-mono ${
                      r.cuadrado ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {fmt(r.diferencia)}{" "}
                    {r.cuadrado ? "✔ Cuadrado" : "⚠ Descuadre"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* TABLA JERÁRQUICA CONSOLIDADA Y EXPANDIBLE */}
          <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[11px]">
                <tr>
                  <th className="p-2">Estructura / Cuenta</th>
                  <th className="p-2 text-right">Débito</th>
                  <th className="p-2 text-right">Crédito</th>
                  <th className="p-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                {detalle.conceptos.map((conc, idx) => {
                  const concId = String(
                    conc.concepto_niif_id || `conc-idx-${idx}`
                  );
                  const isExpandedConc = !!expandedConceptos[concId];
                  const subconceptosHijos = detalle.subconceptos.filter(
                    (s) =>
                      String(s.subconceptos_niif?.concepto_niif_id) === concId
                  );
                  const difConc =
                    Number(conc.total_debito || 0) -
                    Number(conc.total_credito || 0);

                  return (
                    <React.Fragment key={`conc-frag-${concId}`}>
                      {/* FILA CONCEPTO PADRE */}
                      <tr
                        className="bg-slate-50 font-bold hover:bg-slate-100 cursor-pointer"
                        onClick={() => toggleConcepto(concId)}
                      >
                        <td className="p-2 flex items-center gap-2">
                          <span>{isExpandedConc ? "📂" : "📁"}</span>
                          <span>
                            [
                            {conc.conceptos_niif?.codigo ||
                              conc.conceptos_niif?.codigo_concepto ||
                              "N/A"}
                            ] {conc.conceptos_niif?.nombre || "Concepto"}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono">
                          {fmt(conc.total_debito)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {fmt(conc.total_credito)}
                        </td>
                        <td className="p-2 text-right font-mono text-blue-700">
                          {fmt(difConc)}
                        </td>
                      </tr>

                      {/* SUBCONCEPTOS HIJOS */}
                      {isExpandedConc &&
                        subconceptosHijos.map((sub, subIdx) => {
                          const subId = String(
                            sub.subconcepto_niif_id || `sub-idx-${subIdx}`
                          )
                            .toLowerCase()
                            .trim();
                          const isExpandedSub = !!expandedSubconceptos[subId];

                          const auxiliaresHijos = detalle.auxiliares.filter(
                            (a) =>
                              String(
                                a.conceptos_auxiliares?.subconcepto_niif_id ||
                                  ""
                              )
                                .toLowerCase()
                                .trim() === subId
                          );
                          const difSub =
                            Number(sub.total_debito || 0) -
                            Number(sub.total_credito || 0);
                          const tieneAuxiliares = auxiliaresHijos.length > 0;

                          return (
                            <React.Fragment key={`sub-frag-${subId}`}>
                              {/* FILA SUBCONCEPTO */}
                              <tr
                                className={`bg-white hover:bg-slate-50 font-semibold ${
                                  tieneAuxiliares
                                    ? "cursor-pointer"
                                    : "cursor-default opacity-85"
                                }`}
                                onClick={() =>
                                  tieneAuxiliares && toggleSubconcepto(subId)
                                }
                              >
                                <td className="p-2 pl-6 flex items-center gap-2">
                                  <span>
                                    {tieneAuxiliares
                                      ? isExpandedSub
                                        ? "📖"
                                        : "📘"
                                      : "📄"}
                                  </span>
                                  <span>
                                    [
                                    {sub.subconceptos_niif?.codigo ||
                                      sub.subconceptos_niif
                                        ?.codigo_subconcepto ||
                                      "N/A"}
                                    ]{" "}
                                    {sub.subconceptos_niif?.nombre ||
                                      "Subconcepto"}
                                  </span>
                                  {!tieneAuxiliares && (
                                    <span className="text-[9px] text-slate-400 font-normal italic">
                                      (Sin auxiliares registrados)
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono">
                                  {fmt(sub.total_debito)}
                                </td>
                                <td className="p-2 text-right font-mono">
                                  {fmt(sub.total_credito)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-700">
                                  {fmt(difSub)}
                                </td>
                              </tr>

                              {/* AUXILIARES CONSOLIDADOS */}
                              {isExpandedSub &&
                                auxiliaresHijos.map((aux, auxIdx) => {
                                  const auxId = String(
                                    aux.concepto_auxiliar_id ||
                                      `aux-idx-${auxIdx}`
                                  );
                                  const difAux =
                                    Number(aux.total_debito || 0) -
                                    Number(aux.total_credito || 0);
                                  return (
                                    <tr
                                      key={`aux-row-${auxId}`}
                                      className="bg-slate-50/50 hover:bg-slate-100/60 text-slate-600"
                                    >
                                      <td className="p-2 pl-12">
                                        🔹 [
                                        {aux.conceptos_auxiliares
                                          ?.codigo_auxiliar || "N/A"}
                                        ] {aux.conceptos_auxiliares?.nombre}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        {fmt(aux.total_debito)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        {fmt(aux.total_credito)}
                                      </td>
                                      <td className="p-2 text-right font-mono">
                                        {fmt(difAux)}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}