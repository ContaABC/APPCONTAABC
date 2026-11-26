"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  setEmpresaActivaUsuario,
  type Empresa as EmpresaPermitida,
} from "@/app/actions/accionesEmpresas";
import { obtenerReporteNiiF } from "./actions";

type EmpresaNiiFItem = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
  nit_identificacion?: string | number;
  dv?: string | number | null;
};

type TipoReporteNiiF =
  | "conceptos_niif"
  | "subconceptos_niif"
  | "conceptos_auxiliares"
  | "consolidado_niif";

interface ConceptoAuxiliarNiiF {
  id: string | number;
  codigo_auxiliar?: string;
  nombre?: string;
  tipo_entidad?: string;
  estado?: string;
}

interface SubconceptoNiiF {
  id: string | number;
  codigo?: string;
  nombre?: string;
  activo?: boolean;
  elemento?: string;
  conceptos_niif?: {
    codigo_concepto?: string;
    nombre?: string;
  } | null;
  conceptos_auxiliares?: ConceptoAuxiliarNiiF[];
}

interface ReporteNiiFRow {
  id?: string | number;
  codigo_concepto?: string;
  codigo?: string;
  codigo_auxiliar?: string;
  nombre?: string;
  elemento?: string;
  clasificacion_balance?: string;
  tipo_entidad?: string;
  conceptos_niif?: {
    codigo_concepto?: string;
    nombre?: string;
  } | null;
  subconceptos_niif?: SubconceptoNiiF[] & {
    codigo?: string;
    nombre?: string;
    conceptos_niif?: {
      codigo_concepto?: string;
      nombre?: string;
    } | null;
  };
  [key: string]: unknown;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function obtenerNombreEmpresa(emp: EmpresaNiiFItem): string {
  const base = String(
    emp.razon_social || emp.nombre_comercial || emp.nombre || "Empresa"
  );
  if (emp.nit_identificacion) {
    return `${base} (NIT: ${emp.nit_identificacion}${
      emp.dv ? `-${emp.dv}` : ""
    })`;
  }
  return base;
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

export default function ReportesNiiFPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const [isMounted, setIsMounted] = useState(false);
  const [empresas, setEmpresas] = useState<EmpresaNiiFItem[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [tipoReporte, setTipoReporte] =
    useState<TipoReporteNiiF>("consolidado_niif");

  const [datosReporte, setDatosReporte] = useState<ReporteNiiFRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const persistirEmpresaEnPerfil = useCallback(
    async (empVal: string | null) => {
      const uid = await resolverUsuarioId();
      if (!uid) return;

      const empNormalizado =
        empVal && empVal.trim() !== ""
          ? Number.isNaN(Number(empVal))
            ? empVal
            : Number(empVal)
          : null;

      try {
        if (empVal && empVal.trim() !== "") {
          await setEmpresaActivaUsuario(empVal, uid, null);
        }
      } catch {
        // Continuar con actualización directa
      }

      await supabase
        .from("usuarios_perfiles")
        .update({ empresa_activa: empNormalizado })
        .eq("id", uid);
    },
    [resolverUsuarioId]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || inicializadoRef.current) return;
    inicializadoRef.current = true;
    let cancelado = false;

    async function init() {
      try {
        const uid = await resolverUsuarioId();
        const permitidas = await getEmpresasPermitidas(uid);
        if (cancelado) return;

        const listaEmpresas: EmpresaNiiFItem[] = Array.isArray(permitidas)
          ? (permitidas as EmpresaNiiFItem[])
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
              String(
                empElegida.razon_social ||
                  empElegida.nombre_comercial ||
                  empElegida.nombre ||
                  "Empresa"
              )
            );
          }
          document.cookie = `empresa_activa=${encodeURIComponent(
            empresaIdAUsar
          )}; path=/; max-age=86400; SameSite=Lax`;
        } else {
          setErrorMsg("No se encontraron empresas permitidas para el usuario.");
        }
      } catch (err: unknown) {
        const mensaje =
          err instanceof Error ? err.message : "Error desconocido.";
        setErrorMsg("Error de conexión al cargar empresas: " + mensaje);
      }
    }

    init();
    return () => {
      cancelado = true;
    };
  }, [isMounted, resolverUsuarioId]);

  useEffect(() => {
    if (!empresaId || !isMounted) return;
    let cancelado = false;

    async function cargarReporte() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await obtenerReporteNiiF(Number(empresaId), tipoReporte);
        if (cancelado) return;
        if (res && res.success) {
          setDatosReporte((res.data || []) as ReporteNiiFRow[]);
        } else {
          setErrorMsg(res?.error || "Error al obtener el reporte NIIF.");
          setDatosReporte([]);
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    }

    cargarReporte();
    return () => {
      cancelado = true;
    };
  }, [empresaId, tipoReporte, isMounted]);

  const handleCambioEmpresa = async (nuevoId: string) => {
    setEmpresaId(nuevoId);
    setErrorMsg(null);

    if (typeof window !== "undefined") {
      if (nuevoId) {
        const empSel = empresas.find((e) => String(e.id) === nuevoId);
        localStorage.setItem("empresa_activa", nuevoId);
        localStorage.setItem("empresa_id", nuevoId);
        if (empSel) {
          localStorage.setItem(
            "empresa_activa_nombre",
            String(
              empSel.razon_social ||
                empSel.nombre_comercial ||
                empSel.nombre ||
                "Empresa"
            )
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
    }

    await persistirEmpresaEnPerfil(nuevoId || null);
  };

  const handleExportarExcel = () => {
    if (datosReporte.length === 0) return;

    let datosExport: unknown[] = [];

    if (tipoReporte === "consolidado_niif") {
      const filasConsolidado: Record<string, string | number>[] = [];

      datosReporte.forEach((niif) => {
        const subs = Array.isArray(niif.subconceptos_niif)
          ? niif.subconceptos_niif
          : [];
        if (subs.length > 0) {
          subs.forEach((sub) => {
            const auxs = Array.isArray(sub.conceptos_auxiliares)
              ? sub.conceptos_auxiliares
              : [];
            if (auxs.length > 0) {
              auxs.forEach((aux) => {
                filasConsolidado.push({
                  "Cod. Concepto NIIF": niif.codigo_concepto || "",
                  "Nombre Concepto NIIF": niif.nombre || "",
                  "Cod. Subconcepto": sub.codigo || "",
                  "Nombre Subconcepto": sub.nombre || "",
                  "Cod. Auxiliar": aux.codigo_auxiliar || "",
                  "Nombre Auxiliar": aux.nombre || "",
                  "Tipo Entidad": aux.tipo_entidad || "",
                  "Estado Auxiliar": aux.estado || "",
                });
              });
            } else {
              filasConsolidado.push({
                "Cod. Concepto NIIF": niif.codigo_concepto || "",
                "Nombre Concepto NIIF": niif.nombre || "",
                "Cod. Subconcepto": sub.codigo || "",
                "Nombre Subconcepto": sub.nombre || "",
                "Cod. Auxiliar": "Sin auxiliar",
                "Nombre Auxiliar": "",
                "Tipo Entidad": "",
                "Estado Auxiliar": "",
              });
            }
          });
        } else {
          filasConsolidado.push({
            "Cod. Concepto NIIF": niif.codigo_concepto || "",
            "Nombre Concepto NIIF": niif.nombre || "",
            "Cod. Subconcepto": "Sin subconcepto",
            "Nombre Subconcepto": "",
            "Cod. Auxiliar": "",
            "Nombre Auxiliar": "",
            "Tipo Entidad": "",
            "Estado Auxiliar": "",
          });
        }
      });

      datosExport = filasConsolidado;
    } else if (tipoReporte === "conceptos_niif") {
      datosExport = datosReporte.map((item, idx) => ({
        "N°": idx + 1,
        Código: item.codigo_concepto || "",
        "Nombre Concepto": item.nombre || "",
        Elemento: item.elemento || "",
        Clasificación: item.clasificacion_balance || "",
      }));
    } else if (tipoReporte === "subconceptos_niif") {
      datosExport = datosReporte.map((item, idx) => {
        const padre = item.conceptos_niif as
          | { codigo_concepto?: string; nombre?: string }
          | null
          | undefined;
        return {
          "N°": idx + 1,
          "Código Subc.": item.codigo || "",
          "Nombre Subc.": item.nombre || "",
          "Concepto NIIF": padre
            ? `${padre.codigo_concepto || ""} - ${padre.nombre || ""}`
            : "",
        };
      });
    } else {
      datosExport = datosReporte.map((item, idx) => {
        const subPadre = item.subconceptos_niif as
          | { codigo?: string; nombre?: string }
          | null
          | undefined;
        return {
          "N°": idx + 1,
          "Código Aux.": item.codigo_auxiliar || "",
          "Nombre Aux.": item.nombre || "",
          Tipo: item.tipo_entidad || "",
          Subconcepto: subPadre
            ? `${subPadre.codigo || ""} - ${subPadre.nombre || ""}`
            : "",
        };
      });
    }

    const ws = XLSX.utils.json_to_sheet(datosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipoReporte);
    XLSX.writeFile(wb, `reporte_${tipoReporte}.xlsx`);
  };

  if (!isMounted) {
    return (
      <div className="p-4 text-center text-slate-400 text-xs">
        Cargando reporte NIIF...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-3 text-xs">
      <div className="border-b pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition border border-slate-200 cursor-pointer shrink-0"
          >
            ← Atrás
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-800">
              Reportes y Consulta NIIF
            </h1>
            <p className="text-[11px] text-slate-500">
              Visualiza la estructura jerárquica o detallada de la
              contabilidad.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportarExcel}
          disabled={datosReporte.length === 0 || loading}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded shadow text-xs transition flex items-center gap-1 cursor-pointer"
        >
          📊 Exportar a Excel
        </button>
      </div>

      {errorMsg && (
        <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-md font-medium">
          ⚠ {errorMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">
            Empresa
          </label>
          <select
            value={empresaId}
            onChange={(e) => handleCambioEmpresa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {obtenerNombreEmpresa(emp)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">
            Tipo de Reporte NIIF
          </label>
          <select
            value={tipoReporte}
            onChange={(e) => setTipoReporte(e.target.value as TipoReporteNiiF)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="consolidado_niif">
              🔗 Consolidado (Concepto NIIF ➔ Subconcepto ➔ Auxiliar)
            </option>
            <option value="conceptos_auxiliares">
              3. Cuentas / Conceptos Auxiliares (Detalle)
            </option>
            <option value="subconceptos_niif">2. Subconceptos NIIF</option>
            <option value="conceptos_niif">
              1. Conceptos NIIF (Principales)
            </option>
          </select>
        </div>
      </div>

      {/* Tabla / Consolidado */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Cargando reporte...
          </div>
        ) : datosReporte.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            No se encontraron registros.
          </div>
        ) : tipoReporte === "consolidado_niif" ? (
          <div className="space-y-4">
            {datosReporte.map((niif, idx) => {
              const subs = Array.isArray(niif.subconceptos_niif)
                ? niif.subconceptos_niif
                : [];
              return (
                <div
                  key={niif.id || idx}
                  className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden"
                >
                  {/* Cabecera del Concepto NIIF (Nivel 1) */}
                  <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-xs">
                        {niif.codigo_concepto}
                      </span>
                      <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                        📁 {niif.nombre}
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                      {niif.elemento || "NIIF"}{" "}
                      {niif.clasificacion_balance
                        ? `| ${niif.clasificacion_balance}`
                        : ""}
                    </span>
                  </div>

                  {/* Subconceptos (Nivel 2) */}
                  <div className="p-3 bg-slate-50/50 space-y-3">
                    {subs.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic pl-4">
                        Sin subconceptos asociados.
                      </div>
                    ) : (
                      subs.map((sub) => {
                        const auxs = Array.isArray(sub.conceptos_auxiliares)
                          ? sub.conceptos_auxiliares
                          : [];
                        return (
                          <div
                            key={sub.id}
                            className="bg-white border border-slate-200 rounded-md p-2.5 shadow-xs space-y-2 ml-2 md:ml-4"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                                  {sub.codigo}
                                </span>
                                <span className="font-semibold text-slate-700 text-xs">
                                  📂 {sub.nombre}
                                </span>
                              </div>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                  sub.activo
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {sub.activo ? "Activo" : "Inactivo"}
                              </span>
                            </div>

                            {/* Cuentas Auxiliares (Nivel 3) */}
                            {auxs.length === 0 ? (
                              <div className="text-[10px] text-slate-400 italic pl-4 py-1">
                                Sin cuentas auxiliares registradas.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-2 pt-1">
                                {auxs.map((aux) => (
                                  <div
                                    key={aux.id}
                                    className="bg-slate-50 hover:bg-slate-100/80 transition border border-slate-200 rounded p-2 flex items-center justify-between gap-2"
                                  >
                                    <div className="truncate">
                                      <div className="font-mono font-bold text-slate-900 text-[11px]">
                                        {aux.codigo_auxiliar}
                                      </div>
                                      <div
                                        className="text-slate-600 text-[10px] truncate"
                                        title={aux.nombre || ""}
                                      >
                                        {aux.nombre}
                                      </div>
                                    </div>
                                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded font-medium whitespace-nowrap">
                                      {aux.tipo_entidad || "Auxiliar"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table className="w-full text-left text-slate-600 border-collapse">
            <thead className="bg-slate-100 border-b text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                {tipoReporte === "conceptos_niif" && (
                  <>
                    <th className="p-2">Código</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Elemento</th>
                    <th className="p-2">Clasificación</th>
                  </>
                )}
                {tipoReporte === "subconceptos_niif" && (
                  <>
                    <th className="p-2">Código Subc.</th>
                    <th className="p-2">Nombre Subc.</th>
                    <th className="p-2">Concepto NIIF Padre</th>
                    <th className="p-2">Elemento</th>
                  </>
                )}
                {tipoReporte === "conceptos_auxiliares" && (
                  <>
                    <th className="p-2">Código Aux.</th>
                    <th className="p-2">Nombre Aux.</th>
                    <th className="p-2">Tipo Entidad</th>
                    <th className="p-2">Subconcepto NIIF</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {datosReporte.map((item, idx) => {
                const padre = item.conceptos_niif as
                  | { codigo_concepto?: string; nombre?: string }
                  | null
                  | undefined;
                const subPadre = item.subconceptos_niif as
                  | { codigo?: string; nombre?: string }
                  | null
                  | undefined;
                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    {tipoReporte === "conceptos_niif" && (
                      <>
                        <td className="p-2 font-mono font-bold">
                          {item.codigo_concepto}
                        </td>
                        <td className="p-2">{item.nombre}</td>
                        <td className="p-2">{item.elemento}</td>
                        <td className="p-2">{item.clasificacion_balance}</td>
                      </>
                    )}
                    {tipoReporte === "subconceptos_niif" && (
                      <>
                        <td className="p-2 font-mono font-bold">
                          {item.codigo}
                        </td>
                        <td className="p-2">{item.nombre}</td>
                        <td className="p-2">
                          {padre
                            ? `${padre.codigo_concepto || ""} - ${
                                padre.nombre || ""
                              }`
                            : ""}
                        </td>
                        <td className="p-2">{item.elemento}</td>
                      </>
                    )}
                    {tipoReporte === "conceptos_auxiliares" && (
                      <>
                        <td className="p-2 font-mono font-bold">
                          {item.codigo_auxiliar}
                        </td>
                        <td className="p-2">{item.nombre}</td>
                        <td className="p-2 text-blue-700 font-semibold">
                          {item.tipo_entidad}
                        </td>
                        <td className="p-2">
                          {subPadre
                            ? `${subPadre.codigo || ""} - ${
                                subPadre.nombre || ""
                              }`
                            : ""}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}