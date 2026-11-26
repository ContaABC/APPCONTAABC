"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
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
import {
  obtenerBalanceDePrueba,
  obtenerLibroMayorPorNivel,
  obtenerCatalogosPorNivel,
  obtenerLibroDiario,
} from "./actions";

type EmpresaItem = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
};

type SucursalItem = SucursalPermitida & {
  nombre_sucursal?: string;
  codigo_sucursal?: string;
};

interface CatalogoMayorItem {
  id: string | number;
  codigo?: string;
  nombre?: string;
}

interface ReporteFilaItem {
  id?: string | number;
  saldo_anterior?: number;
  total_debito?: number;
  total_credito?: number;
  saldo_final?: number;
  debito?: number | string;
  credito?: number | string;
  fecha_contable?: string;
  concepto?: { codigo?: string; nombre?: string };
  subconcepto?: { codigo?: string; nombre?: string };
  concepto_auxiliar?: { codigo_auxiliar?: string; nombre?: string };
  transaccion?: {
    fecha_contable?: string;
    clase_documento_id?: number | string;
    numero_documento?: string;
    glosa_concepto?: string;
  } | null;
  tercero?: {
    razon_social?: string;
    nombre_comercial?: string;
  } | null;
  [key: string]: unknown;
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

export default function ReportesContablesPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [sucursales, setSucursales] = useState<SucursalItem[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  const [tipoReporte, setTipoReporte] = useState<
    "BALANCE" | "MAYOR" | "DIARIO"
  >("BALANCE");
  const [nivelBalance, setNivelBalance] = useState<
    "CONCEPTOS" | "SUBCONCEPTOS" | "AUXILIARES"
  >("AUXILIARES");

  // Niveles para el Libro Mayor: 1=Conceptos, 2=Subconceptos, 3=Auxiliares
  const [nivelMayor, setNivelMayor] = useState<1 | 2 | 3>(3);
  const [listaCatalogoMayor, setListaCatalogoMayor] = useState<
    CatalogoMayorItem[]
  >([]);
  const [itemCatalogoId, setItemCatalogoId] = useState<string>("");

  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [fechaInicio, setFechaInicio] = useState<string>(
    `${new Date().getFullYear()}-01-01`
  );
  const [fechaFin, setFechaFin] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [consultado, setConsultado] = useState<boolean>(false);
  const [datosReporte, setDatosReporte] = useState<ReporteFilaItem[]>([]);

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
        console.error("Error inicializando contexto de reportes:", err);
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
    setConsultado(false);
    setDatosReporte([]);

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
    setConsultado(false);
    setDatosReporte([]);

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

  // Cargar catálogo dinámico para el Libro Mayor ordenado por código
  useEffect(() => {
    if (!empresaId || tipoReporte !== "MAYOR") return;
    let cancelado = false;

    async function cargarCatalogoMayor() {
      setListaCatalogoMayor([]);
      setItemCatalogoId("");
      const res = await obtenerCatalogosPorNivel(
        Number(empresaId),
        nivelMayor
      );
      if (cancelado) return;
      if (res.success && res.data) {
        const catalogoOrdenado = [...(res.data as CatalogoMayorItem[])].sort(
          (a, b) => {
            const codA = String(a.codigo || "");
            const codB = String(b.codigo || "");
            return codA.localeCompare(codB, undefined, {
              numeric: true,
              sensitivity: "base",
            });
          }
        );

        setListaCatalogoMayor(catalogoOrdenado);
        if (catalogoOrdenado.length > 0) {
          setItemCatalogoId(String(catalogoOrdenado[0].id));
        }
      }
    }
    cargarCatalogoMayor();
    return () => {
      cancelado = true;
    };
  }, [empresaId, nivelMayor, tipoReporte]);

  const consultarReporte = async () => {
    if (!empresaId) return;
    setLoading(true);
    setConsultado(true);

    try {
      if (tipoReporte === "BALANCE") {
        const res = await obtenerBalanceDePrueba(
          Number(empresaId),
          sucursalId ? Number(sucursalId) : null,
          Number(anio),
          Number(mes),
          nivelBalance
        );
        if (res.success) {
          setDatosReporte((res.data || []) as ReporteFilaItem[]);
        } else {
          alert("Error al cargar balance: " + res.error);
          setDatosReporte([]);
        }
      } else if (tipoReporte === "MAYOR") {
        if (
          !itemCatalogoId ||
          itemCatalogoId === "NaN" ||
          itemCatalogoId === "undefined"
        ) {
          setDatosReporte([]);
          return;
        }

        const res = await obtenerLibroMayorPorNivel(
          Number(empresaId),
          sucursalId ? Number(sucursalId) : null,
          nivelMayor,
          itemCatalogoId,
          fechaInicio,
          fechaFin
        );

        if (res.success) {
          setDatosReporte((res.data || []) as ReporteFilaItem[]);
        } else {
          alert("Error al cargar libro mayor: " + res.error);
          setDatosReporte([]);
        }
      } else if (tipoReporte === "DIARIO") {
        const res = await obtenerLibroDiario(
          Number(empresaId),
          sucursalId ? Number(sucursalId) : null,
          Number(anio),
          Number(mes)
        );
        if (res.success) {
          setDatosReporte((res.data || []) as ReporteFilaItem[]);
        } else {
          alert("Error al cargar libro diario: " + res.error);
          setDatosReporte([]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v: number | string | undefined) =>
    `$ ${Math.round(Number(v || 0)).toLocaleString("es-CO")}`;

  // Exportar a Excel real (.xlsx) usando la librería xlsx
  const exportarExcel = () => {
    if (datosReporte.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    let excelData: Record<string, string | number>[] = [];
    let nombreHoja = "Reporte";

    if (tipoReporte === "BALANCE") {
      nombreHoja = "Balance de Prueba";
      excelData = datosReporte.map((row) => {
        const nombreObj =
          row.concepto || row.subconcepto || row.concepto_auxiliar;
        return {
          Código:
            (nombreObj as { codigo?: string; codigo_auxiliar?: string })
              ?.codigo ||
            (nombreObj as { codigo?: string; codigo_auxiliar?: string })
              ?.codigo_auxiliar ||
            "N/A",
          "Nombre / Descripción": nombreObj?.nombre || "Sin Descripción",
          "Saldo Anterior": Number(row.saldo_anterior || 0),
          "Total Débito": Number(row.total_debito || 0),
          "Total Crédito": Number(row.total_credito || 0),
          "Saldo Final": Number(row.saldo_final || 0),
        };
      });
    } else if (tipoReporte === "MAYOR") {
      nombreHoja = "Libro Mayor";
      excelData = datosReporte.map((mov) => ({
        Fecha: mov.fecha_contable || mov.transaccion?.fecha_contable || "",
        Comprobante: mov.transaccion?.numero_documento || "",
        Tercero:
          mov.tercero?.razon_social ||
          mov.tercero?.nombre_comercial ||
          "Sin Tercero",
        "Glosa / Detalle": mov.transaccion?.glosa_concepto || "",
        Débito: Number(mov.debito || 0),
        Crédito: Number(mov.credito || 0),
      }));
    } else if (tipoReporte === "DIARIO") {
      nombreHoja = "Libro Diario";
      excelData = datosReporte.map((item) => {
        const tx = item.transaccion || {};
        return {
          Fecha: tx.fecha_contable || item.fecha_contable || "",
          "Clase Doc": tx.clase_documento_id || "",
          Consecutivo: tx.numero_documento || "",
          Tercero:
            item.tercero?.razon_social ||
            item.tercero?.nombre_comercial ||
            "Sin Tercero",
          "Cuenta Auxiliar": `${
            item.concepto_auxiliar?.codigo_auxiliar || ""
          } - ${item.concepto_auxiliar?.nombre || ""}`,
          Glosa: tx.glosa_concepto || "",
          Débito: Number(item.debito || 0),
          Crédito: Number(item.credito || 0),
        };
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja);

    XLSX.writeFile(workbook, `Reporte_${tipoReporte}_${anio}_${mes}.xlsx`);
  };

  const totalSaldoAnterior = datosReporte.reduce(
    (acc, row) => acc + Number(row.saldo_anterior || 0),
    0
  );
  const totalDebito = datosReporte.reduce(
    (acc, row) => acc + Number(row.total_debito || 0),
    0
  );
  const totalCredito = datosReporte.reduce(
    (acc, row) => acc + Number(row.total_credito || 0),
    0
  );
  const totalSaldoFinal = datosReporte.reduce(
    (acc, row) => acc + Number(row.saldo_final || 0),
    0
  );

  const totalMayorDebito = datosReporte.reduce(
    (acc, mov) => acc + Number(mov.debito || 0),
    0
  );
  const totalMayorCredito = datosReporte.reduce(
    (acc, mov) => acc + Number(mov.credito || 0),
    0
  );

  const totalDiarioDebito = datosReporte.reduce(
    (acc, item) => acc + Number(item.debito || 0),
    0
  );
  const totalDiarioCredito = datosReporte.reduce(
    (acc, item) => acc + Number(item.credito || 0),
    0
  );

  if (!isMounted) return null;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 text-xs font-sans">
      <div className="border-b pb-2 flex flex-wrap justify-between items-center gap-2">
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
              Reportes Contables: Balance, Mayor y Diario
            </h1>
            <p className="text-[11px] text-slate-500">
              Consulta y exporta saldos y transacciones contables detalladas.
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 bg-slate-200 p-1 rounded">
            <button
              type="button"
              onClick={() => {
                setTipoReporte("BALANCE");
                setConsultado(false);
                setDatosReporte([]);
              }}
              className={`px-3 py-1 font-bold rounded text-[11px] transition cursor-pointer ${
                tipoReporte === "BALANCE"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-300"
              }`}
            >
              📊 Balance
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoReporte("MAYOR");
                setConsultado(false);
                setDatosReporte([]);
              }}
              className={`px-3 py-1 font-bold rounded text-[11px] transition cursor-pointer ${
                tipoReporte === "MAYOR"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-300"
              }`}
            >
              📖 Mayor
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoReporte("DIARIO");
                setConsultado(false);
                setDatosReporte([]);
              }}
              className={`px-3 py-1 font-bold rounded text-[11px] transition cursor-pointer ${
                tipoReporte === "DIARIO"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-300"
              }`}
            >
              📑 Diario
            </button>
          </div>

          <button
            type="button"
            onClick={consultarReporte}
            disabled={loading || !empresaId}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-3.5 py-1.5 rounded shadow-sm text-[11px] flex items-center gap-1 transition cursor-pointer"
          >
            {loading ? "Consultando..." : "🔍 Consultar Reporte"}
          </button>

          <button
            type="button"
            onClick={exportarExcel}
            disabled={loading || datosReporte.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded shadow-sm text-[11px] flex items-center gap-1 transition cursor-pointer"
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>

      {/* FILTROS EN UNA SOLA LÍNEA HORIZONTAL */}
      <div className="flex flex-wrap md:flex-nowrap gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 items-end">
        {/* Empresa */}
        <div className="w-full md:w-[22%]">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Empresa *
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

        {/* Sucursal */}
        <div className="w-full md:w-[20%]">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Sucursal
          </label>
          <select
            value={sucursalId}
            onChange={(e) => handleCambioSucursal(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {obtenerNombreSucursal(suc)}
              </option>
            ))}
          </select>
        </div>

        {tipoReporte === "BALANCE" ? (
          <>
            <div className="w-full md:w-[18%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
                Nivel de Balance
              </label>
              <select
                value={nivelBalance}
                onChange={(e) => {
                  setNivelBalance(
                    e.target.value as
                      | "CONCEPTOS"
                      | "SUBCONCEPTOS"
                      | "AUXILIARES"
                  );
                  setConsultado(false);
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
              >
                <option value="CONCEPTOS">Conceptos NIIF</option>
                <option value="SUBCONCEPTOS">Subconceptos NIIF</option>
                <option value="AUXILIARES">Auxiliares</option>
              </select>
            </div>

            <div className="w-full md:w-[20%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
                Año
              </label>
              <input
                type="number"
                value={anio}
                onChange={(e) => {
                  setAnio(Number(e.target.value));
                  setConsultado(false);
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none font-mono"
              />
            </div>

            <div className="w-full md:w-[20%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
                Mes
              </label>
              <select
                value={mes}
                onChange={(e) => {
                  setMes(Number(e.target.value));
                  setConsultado(false);
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    Mes {m}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : tipoReporte === "MAYOR" ? (
          <>
            <div className="w-full md:w-[15%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
                Nivel Mayor
              </label>
              <select
                value={nivelMayor}
                onChange={(e) => {
                  setNivelMayor(Number(e.target.value) as 1 | 2 | 3);
                  setConsultado(false);
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
              >
                <option value={1}>1 - Conceptos</option>
                <option value={2}>2 - Subconceptos</option>
                <option value={3}>3 - Auxiliares</option>
              </select>
            </div>

            <div className="w-full md:w-[28%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
                Cuenta / Auxiliar
              </label>
              <select
                value={itemCatalogoId}
                onChange={(e) => {
                  setItemCatalogoId(e.target.value);
                  setConsultado(false);
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
              >
                {listaCatalogoMayor.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.codigo}] {item.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-[17%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
                F. Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setConsultado(false);
                }}
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-800 outline-none text-[11px]"
              />
            </div>

            <div className="w-full md:w-[17%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
                F. Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  setFechaFin(e.target.value);
                  setConsultado(false);
                }}
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-800 outline-none text-[11px]"
              />
            </div>
          </>
        ) : (
          <>
            <div className="w-full md:w-[28%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
                Año
              </label>
              <input
                type="number"
                value={anio}
                onChange={(e) => {
                  setAnio(Number(e.target.value));
                  setConsultado(false);
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none font-mono"
              />
            </div>

            <div className="w-full md:w-[28%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
                Mes
              </label>
              <select
                value={mes}
                onChange={(e) => {
                  setMes(Number(e.target.value));
                  setConsultado(false);
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    Mes {m}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-slate-700 uppercase text-[11px]">
          {tipoReporte === "BALANCE"
            ? `Balance de Prueba - Nivel: ${nivelBalance}`
            : tipoReporte === "MAYOR"
            ? `Libro Mayor - Nivel ${nivelMayor}`
            : `Libro Diario - Año ${anio} / Mes ${mes}`}
        </h2>

        {loading ? (
          <div className="p-8 text-center text-slate-400">
            Calculando saldos y consultando registros...
          </div>
        ) : !consultado ? (
          <div className="p-8 text-center text-slate-500 italic bg-white border rounded-lg">
            Seleccione los filtros del reporte y presione{" "}
            <span className="font-semibold text-slate-700 not-italic">
              “Consultar Reporte”
            </span>
            .
          </div>
        ) : datosReporte.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic bg-white border rounded-lg">
            No se encontraron registros para los filtros seleccionados.
          </div>
        ) : (
          <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
                {tipoReporte === "BALANCE" ? (
                  <tr>
                    <th className="p-2">Código / Referencia</th>
                    <th className="p-2">Nombre / Descripción</th>
                    <th className="p-2 text-right">Saldo Anterior</th>
                    <th className="p-2 text-right">Total Débito</th>
                    <th className="p-2 text-right">Total Crédito</th>
                    <th className="p-2 text-right">Saldo Final</th>
                  </tr>
                ) : tipoReporte === "MAYOR" ? (
                  <tr>
                    <th className="p-2 text-center">Fecha</th>
                    <th className="p-2">Comprobante</th>
                    <th className="p-2">Tercero</th>
                    <th className="p-2">Glosa / Detalle</th>
                    <th className="p-2 text-right w-36">Débito</th>
                    <th className="p-2 text-right w-36">Crédito</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="p-2 text-center">Fecha</th>
                    <th className="p-2 text-center">Clase Doc</th>
                    <th className="p-2">Consecutivo</th>
                    <th className="p-2">Tercero</th>
                    <th className="p-2">Cuenta Auxiliar</th>
                    <th className="p-2">Glosa</th>
                    <th className="p-2 text-right w-36">Débito</th>
                    <th className="p-2 text-right w-36">Crédito</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y text-[10px]">
                {tipoReporte === "BALANCE" ? (
                  <>
                    {datosReporte.map((row, index) => {
                      const nombreObj =
                        row.concepto ||
                        row.subconcepto ||
                        row.concepto_auxiliar;
                      const codigo =
                        (nombreObj as { codigo?: string; codigo_auxiliar?: string })
                          ?.codigo ||
                        (nombreObj as { codigo?: string; codigo_auxiliar?: string })
                          ?.codigo_auxiliar ||
                        "N/A";
                      const nombre = nombreObj?.nombre || "Sin Descripción";

                      return (
                        <tr
                          key={`${row.id || index}-${codigo}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="p-2 font-bold text-slate-900">
                            {codigo}
                          </td>
                          <td className="p-2 text-slate-700">{nombre}</td>
                          <td className="p-2 text-right font-mono text-slate-800">
                            {fmt(row.saldo_anterior)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-800">
                            {fmt(row.total_debito)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-800">
                            {fmt(row.total_credito)}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-700">
                            {fmt(row.saldo_final)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="p-2 uppercase" colSpan={2}>
                        TOTALES GENERALES
                      </td>
                      <td className="p-2 text-right font-mono">
                        {fmt(totalSaldoAnterior)}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {fmt(totalDebito)}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {fmt(totalCredito)}
                      </td>
                      <td className="p-2 text-right font-mono text-emerald-800">
                        {fmt(totalSaldoFinal)}
                      </td>
                    </tr>
                  </>
                ) : tipoReporte === "MAYOR" ? (
                  <>
                    {datosReporte.map((mov, index) => {
                      const fechaMov =
                        mov.fecha_contable ||
                        mov.transaccion?.fecha_contable ||
                        "";
                      const terceroNombre =
                        mov.tercero?.razon_social ||
                        mov.tercero?.nombre_comercial ||
                        "Sin Tercero";
                      return (
                        <tr
                          key={`${mov.id || index}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="p-2 text-center text-slate-600">
                            {fechaMov}
                          </td>
                          <td className="p-2 font-bold text-slate-900">
                            {mov.transaccion?.numero_documento}
                          </td>
                          <td className="p-2 text-slate-700">
                            {terceroNombre}
                          </td>
                          <td className="p-2 text-slate-600">
                            {mov.transaccion?.glosa_concepto}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-800 w-36">
                            {fmt(mov.debito)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-800 w-36">
                            {fmt(mov.credito)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="p-2 uppercase" colSpan={4}>
                        TOTALES MOVIMIENTOS
                      </td>
                      <td className="p-2 text-right font-mono w-36">
                        {fmt(totalMayorDebito)}
                      </td>
                      <td className="p-2 text-right font-mono w-36">
                        {fmt(totalMayorCredito)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <>
                    {datosReporte.map((item, index) => {
                      const tx = item.transaccion || {};
                      const fechaTx =
                        tx.fecha_contable || item.fecha_contable || "";
                      const claseDocId = tx.clase_documento_id || "";
                      const terceroNombre =
                        item.tercero?.razon_social ||
                        item.tercero?.nombre_comercial ||
                        "Sin Tercero";
                      return (
                        <tr
                          key={`${item.id || index}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="p-2 text-center text-slate-600">
                            {fechaTx}
                          </td>
                          <td className="p-2 text-center font-semibold text-indigo-700">
                            {claseDocId}
                          </td>
                          <td className="p-2 font-bold text-slate-900">
                            {tx.numero_documento}
                          </td>
                          <td className="p-2 text-slate-700">
                            {terceroNombre}
                          </td>
                          <td className="p-2 text-slate-800">
                            [{item.concepto_auxiliar?.codigo_auxiliar}]{" "}
                            {item.concepto_auxiliar?.nombre}
                          </td>
                          <td className="p-2 text-slate-600">
                            {tx.glosa_concepto}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-800 w-36">
                            {fmt(item.debito)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-800 w-36">
                            {fmt(item.credito)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="p-2 uppercase" colSpan={6}>
                        TOTALES LIBRO DIARIO
                      </td>
                      <td className="p-2 text-right font-mono w-36">
                        {fmt(totalDiarioDebito)}
                      </td>
                      <td className="p-2 text-right font-mono w-36">
                        {fmt(totalDiarioCredito)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}