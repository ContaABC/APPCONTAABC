"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { obtenerBalanceGeneral } from "./balance-actions";
import BotonAnalisisIA from "./BotonAnalisisIA";

type Empresa = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
};

type Sucursal = SucursalPermitida & {
  nombre_sucursal?: string;
  codigo_sucursal?: string;
};

interface BalanceRow {
  elemento: string;
  concepto_id: number | string;
  concepto_codigo: string;
  concepto_nombre: string;
  clasificacion_balance?: string;
  subconcepto_id?: number | string | null;
  subconcepto_codigo?: string;
  subconcepto_nombre?: string;
  saldo?: number;
}

interface SubconceptoBalance {
  id: number | string;
  codigo?: string;
  nombre?: string;
  saldo: number;
  saldoComp: number;
  variacion: number;
}

interface ConceptoBalance {
  codigo: string;
  nombre: string;
  subconceptos: SubconceptoBalance[];
  totalConcepto: number;
  totalConceptoComp: number;
}

interface FilaExportacionBalance {
  Elemento: string;
  Código: string;
  Nombre: string;
  Saldo: number | string;
  Saldo_Comparativo?: number | string;
  Variacion?: number | string;
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

function obtenerNombreSucursal(suc: Sucursal): string {
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

export default function BalanceGeneralPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);

  // Filtros
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [anio, setAnio] = useState<string>("2026");
  const [mes, setMes] = useState<string>("12");
  const [tipoReporte, setTipoReporte] = useState<"ACUMULADO" | "MES">(
    "ACUMULADO"
  );
  const [modoPresentacion, setModoPresentacion] = useState<
    "NORMAL" | "COMPARATIVO_MES" | "COMPARATIVO_ANIO"
  >("NORMAL");

  // Estados de datos
  const [loading, setLoading] = useState<boolean>(false);
  const [balanceData, setBalanceData] = useState<BalanceRow[]>([]);
  const [balanceComparativoData, setBalanceComparativoData] = useState<
    BalanceRow[]
  >([]);

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
        // Continuar con actualización directa
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

  // Cargar empresas y contexto activo al iniciar
  useEffect(() => {
    if (!isMounted || inicializadoRef.current) return;
    inicializadoRef.current = true;
    let cancelado = false;

    async function initContexto() {
      try {
        const uid = await resolverUsuarioId();
        const permitidas = await getEmpresasPermitidas(uid);
        if (cancelado) return;

        const listaEmpresas: Empresa[] = Array.isArray(permitidas)
          ? (permitidas as Empresa[])
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

          const sucPermitidas = await getSucursalesPermitidas(
            empresaIdAUsar,
            uid
          );
          if (cancelado) return;

          const listaSuc: Sucursal[] = Array.isArray(sucPermitidas)
            ? (sucPermitidas as Sucursal[])
            : [];
          setSucursales(listaSuc);

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

          let idSucFinal = "";
          if (
            candidataSuc &&
            listaSuc.some((s) => String(s.id) === String(candidataSuc))
          ) {
            idSucFinal = String(candidataSuc);
          }

          if (typeof window !== "undefined") {
            localStorage.setItem("empresa_activa", empresaIdAUsar);
            localStorage.setItem("empresa_id", empresaIdAUsar);
            localStorage.setItem(
              "empresa_activa_nombre",
              obtenerNombreEmpresa(empElegida)
            );
            if (idSucFinal) {
              const sucElegida = listaSuc.find(
                (s) => String(s.id) === idSucFinal
              );
              localStorage.setItem("sucursal_activa", idSucFinal);
              localStorage.setItem("sucursal_id", idSucFinal);
              if (sucElegida) {
                localStorage.setItem(
                  "sucursal_activa_nombre",
                  obtenerNombreSucursal(sucElegida)
                );
              }
            }
          }
          document.cookie = `empresa_activa=${encodeURIComponent(
            empresaIdAUsar
          )}; path=/; max-age=86400; SameSite=Lax`;
          if (idSucFinal) {
            document.cookie = `sucursal_activa=${encodeURIComponent(
              idSucFinal
            )}; path=/; max-age=86400; SameSite=Lax`;
          }

          setEmpresaId(empresaIdAUsar);
          setSucursalId(idSucFinal);
        }
      } catch (err) {
        console.error("Error inicializando contexto de balance general:", err);
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

    await persistirContextoEnPerfil(nuevoId || null, null);

    if (nuevoId) {
      const uid = await resolverUsuarioId();
      const sucPermitidas = await getSucursalesPermitidas(nuevoId, uid);
      setSucursales(
        Array.isArray(sucPermitidas) ? (sucPermitidas as Sucursal[]) : []
      );
    }
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

  const claveConsulta = `${empresaId}|${sucursalId}|${anio}|${mes}|${tipoReporte}|${modoPresentacion}`;

  useEffect(() => {
    if (!isMounted || !empresaId || !anio || !mes) return;

    let cancelado = false;
    const timer = setTimeout(async () => {
      if (cancelado) return;
      setLoading(true);

      try {
        const resActual = await obtenerBalanceGeneral(
          Number(empresaId),
          sucursalId ? Number(sucursalId) : null,
          Number(anio),
          Number(mes),
          tipoReporte
        );

        if (cancelado) return;

        if (resActual.success) {
          setBalanceData((resActual.data || []) as BalanceRow[]);
        } else {
          alert("Error al cargar el balance actual: " + resActual.error);
        }

        if (modoPresentacion !== "NORMAL") {
          let anioComp = Number(anio);
          let mesComp = Number(mes);

          if (modoPresentacion === "COMPARATIVO_MES") {
            mesComp -= 1;
            if (mesComp < 1) {
              mesComp = 12;
              anioComp -= 1;
            }
          } else if (modoPresentacion === "COMPARATIVO_ANIO") {
            anioComp -= 1;
          }

          const resComparativo = await obtenerBalanceGeneral(
            Number(empresaId),
            sucursalId ? Number(sucursalId) : null,
            anioComp,
            mesComp,
            tipoReporte
          );

          if (!cancelado && resComparativo.success) {
            setBalanceComparativoData(
              (resComparativo.data || []) as BalanceRow[]
            );
          }
        } else {
          setBalanceComparativoData([]);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }, 80);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [
    isMounted,
    claveConsulta,
    empresaId,
    sucursalId,
    anio,
    mes,
    tipoReporte,
    modoPresentacion,
  ]);

  const fmt = (v: number) =>
    `$ ${Number(v || 0).toLocaleString("es-CO", {
      minimumFractionDigits: 2,
    })}`;

  const nombreEmpresaSel = useMemo(() => {
    const emp = empresas.find((e) => String(e.id) === String(empresaId));
    return emp ? obtenerNombreEmpresa(emp) : "Empresa";
  }, [empresas, empresaId]);

  const balanceAgrupado = useMemo(() => {
    const estructura: Record<
      string,
      Record<string, Record<string, ConceptoBalance>>
    > = {
      Activo: {},
      Pasivo: {},
      Patrimonio: {},
    };

    const mapComparativo: Record<string, number> = {};
    balanceComparativoData.forEach((row) => {
      const keySub = row.subconcepto_id
        ? `sub_${row.subconcepto_id}`
        : `con_${row.concepto_id}`;
      mapComparativo[keySub] = Number(row.saldo || 0);
    });

    balanceData.forEach((row) => {
      const el = row.elemento;
      if (!estructura[el]) estructura[el] = {};

      const clasif = row.clasificacion_balance?.trim() || "OTROS";
      if (!estructura[el][clasif]) estructura[el][clasif] = {};

      const cId = String(row.concepto_id);
      if (!estructura[el][clasif][cId]) {
        estructura[el][clasif][cId] = {
          codigo: row.concepto_codigo,
          nombre: row.concepto_nombre,
          subconceptos: [],
          totalConcepto: 0,
          totalConceptoComp: 0,
        };
      }

      const saldoActual = Number(row.saldo || 0);
      const keySub = row.subconcepto_id
        ? `sub_${row.subconcepto_id}`
        : `con_${row.concepto_id}`;
      const saldoComp = mapComparativo[keySub] || 0;

      if (row.subconcepto_id) {
        estructura[el][clasif][cId].subconceptos.push({
          id: row.subconcepto_id,
          codigo: row.subconcepto_codigo,
          nombre: row.subconcepto_nombre,
          saldo: saldoActual,
          saldoComp,
          variacion: saldoActual - saldoComp,
        });
      }

      estructura[el][clasif][cId].totalConcepto += saldoActual;
      estructura[el][clasif][cId].totalConceptoComp += saldoComp;
    });

    return estructura;
  }, [balanceData, balanceComparativoData]);

  const calculosTotales = useMemo(() => {
    const subtotalesClasif: Record<
      string,
      Record<string, { actual: number; comparativo: number }>
    > = {
      Activo: {},
      Pasivo: {},
      Patrimonio: {},
    };

    const totalesElementos: Record<
      string,
      { actual: number; comparativo: number }
    > = {
      Activo: { actual: 0, comparativo: 0 },
      Pasivo: { actual: 0, comparativo: 0 },
      Patrimonio: { actual: 0, comparativo: 0 },
    };

    Object.keys(balanceAgrupado).forEach((el) => {
      let sumaElemAct = 0;
      let sumaElemComp = 0;

      Object.keys(balanceAgrupado[el]).forEach((clasif) => {
        let sumaClasifAct = 0;
        let sumaClasifComp = 0;

        Object.values(balanceAgrupado[el][clasif]).forEach((con) => {
          sumaClasifAct += con.totalConcepto;
          sumaClasifComp += con.totalConceptoComp;
        });

        subtotalesClasif[el][clasif] = {
          actual: sumaClasifAct,
          comparativo: sumaClasifComp,
        };
        sumaElemAct += sumaClasifAct;
        sumaElemComp += sumaClasifComp;
      });

      totalesElementos[el] = { actual: sumaElemAct, comparativo: sumaElemComp };
    });

    return { subtotalesClasif, totalesElementos };
  }, [balanceAgrupado]);

  const pruebaCuadre = useMemo(() => {
    const activo = calculosTotales.totalesElementos.Activo.actual;
    const pasivo = Math.abs(calculosTotales.totalesElementos.Pasivo.actual);
    const patrimonio = Math.abs(
      calculosTotales.totalesElementos.Patrimonio.actual
    );

    const activoComp = calculosTotales.totalesElementos.Activo.comparativo;
    const pasivoComp = Math.abs(
      calculosTotales.totalesElementos.Pasivo.comparativo
    );
    const patrimonioComp = Math.abs(
      calculosTotales.totalesElementos.Patrimonio.comparativo
    );

    const diferencia = activo - (pasivo + patrimonio);
    const diferenciaComp = activoComp - (pasivoComp + patrimonioComp);

    return {
      diferencia,
      diferenciaComp,
      variacion: diferencia - diferenciaComp,
      cuadra: Math.abs(diferencia) < 0.01,
    };
  }, [calculosTotales]);

  const handleExportarExcel = () => {
    if (balanceData.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const dataExport: FilaExportacionBalance[] = [];
    Object.entries(balanceAgrupado).forEach(([elemento, clasificaciones]) => {
      dataExport.push({
        Elemento: `=== ${elemento.toUpperCase()} ===`,
        Código: "",
        Nombre: "",
        Saldo: "",
      });
      Object.entries(clasificaciones).forEach(([clasif, conceptos]) => {
        dataExport.push({
          Elemento: `--- ${clasif} ---`,
          Código: "",
          Nombre: "",
          Saldo: "",
        });
        Object.values(conceptos).forEach((con) => {
          dataExport.push({
            Elemento: elemento,
            Código: con.codigo,
            Nombre: con.nombre,
            Saldo: con.totalConcepto,
            ...(modoPresentacion !== "NORMAL"
              ? {
                  Saldo_Comparativo: con.totalConceptoComp,
                  Variacion: con.totalConcepto - con.totalConceptoComp,
                }
              : {}),
          });
          con.subconceptos.forEach((sub) => {
            dataExport.push({
              Elemento: elemento,
              Código: `  ${sub.codigo || ""}`,
              Nombre: `    ${sub.nombre || ""}`,
              Saldo: sub.saldo,
              ...(modoPresentacion !== "NORMAL"
                ? {
                    Saldo_Comparativo: sub.saldoComp,
                    Variacion: sub.variacion,
                  }
                : {}),
            });
          });
        });
      });
    });

    dataExport.push({
      Elemento: "PRUEBA CONTABLE",
      Código: "",
      Nombre: "Diferencia (Activo - Pasivo - Patrimonio)",
      Saldo: pruebaCuadre.diferencia,
      ...(modoPresentacion !== "NORMAL"
        ? {
            Saldo_Comparativo: pruebaCuadre.diferenciaComp,
            Variacion: pruebaCuadre.variacion,
          }
        : {}),
    });

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Balance General");

    XLSX.writeFile(
      workbook,
      `Balance_General_${nombreEmpresaSel}_${anio}_M${mes}.xlsx`
    );
  };

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

  const esComparativo = modoPresentacion !== "NORMAL";

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 text-xs font-sans">
      {/* HEADER Y ACCIONES */}
      <div className="border-b pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
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
              Balance General NIIF
            </h1>
            <p className="text-[11px] text-slate-500">
              Estado de situación financiera clasificado por Activos, Pasivos y
              Patrimonio (Corriente y No Corriente).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <BotonAnalisisIA
            tipoReporte="BALANCE_GENERAL"
            datosReporte={balanceData}
            empresaNombre={nombreEmpresaSel}
            periodo={`${anio} - Mes ${mes}`}
          />

          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={!isMounted || loading || balanceData.length === 0}
            suppressHydrationWarning
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded shadow-sm transition flex items-center gap-1 text-xs cursor-pointer"
          >
            📊 Exportar Balance a Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* FILTROS SUPERIORES CON PROPORCIONES AJUSTADAS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200 items-end">
        <div className="lg:col-span-3">
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

        <div className="lg:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Sucursal
          </label>
          <select
            value={sucursalId}
            onChange={(e) => handleCambioSucursal(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="">-- Consolidado --</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {obtenerNombreSucursal(suc)}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Año
          </label>
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-slate-800 font-medium outline-none text-center"
          >
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>

        <div className="lg:col-span-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Corte Mes
          </label>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-slate-800 font-medium outline-none text-center"
          >
            {mesesAnio.map((m) => (
              <option key={m.num} value={m.num}>
                {m.num < 10 ? `0${m.num}` : m.num}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Tipo de Saldo
          </label>
          <select
            value={tipoReporte}
            onChange={(e) =>
              setTipoReporte(e.target.value as "ACUMULADO" | "MES")
            }
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            <option value="ACUMULADO">Acumulado</option>
            <option value="MES">Solo el Mes</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Presentación
          </label>
          <select
            value={modoPresentacion}
            onChange={(e) =>
              setModoPresentacion(
                e.target.value as
                  | "NORMAL"
                  | "COMPARATIVO_MES"
                  | "COMPARATIVO_ANIO"
              )
            }
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="NORMAL">Normal</option>
            <option value="COMPARATIVO_MES">Comparativo (Mes Ant.)</option>
            <option value="COMPARATIVO_ANIO">Comparativo (Mes Año Ant.)</option>
          </select>
        </div>
      </div>

      {/* TARJETAS RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 border-l-blue-600">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">
              Total Activos
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {fmt(calculosTotales.totalesElementos.Activo.actual)}
            </span>
          </div>
          <span className="text-xl">🏢</span>
        </div>

        <div className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 border-l-amber-600">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">
              Total Pasivos
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {fmt(calculosTotales.totalesElementos.Pasivo.actual)}
            </span>
          </div>
          <span className="text-xl">📑</span>
        </div>

        <div className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 border-l-emerald-600">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">
              Total Patrimonio
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {fmt(calculosTotales.totalesElementos.Patrimonio.actual)}
            </span>
          </div>
          <span className="text-xl">🏛️</span>
        </div>

        <div
          className={`p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 ${
            pruebaCuadre.cuadra
              ? "border-l-emerald-700 bg-emerald-50/40"
              : "border-l-rose-600 bg-rose-50/40"
          }`}
        >
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">
              Prueba (Act - Pas - Pat)
            </span>
            <span
              className={`font-mono font-bold text-sm ${
                pruebaCuadre.cuadra ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {fmt(pruebaCuadre.diferencia)}
            </span>
          </div>
          <span
            className="text-xl"
            title={
              pruebaCuadre.cuadra
                ? "Balance Cuadrado"
                : "Descuadre detectado"
            }
          >
            {pruebaCuadre.cuadra ? "✅" : "⚠️"}
          </span>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-semibold">
          Generando Balance General NIIF...
        </div>
      ) : balanceData.length === 0 ? (
        <div className="p-12 text-center text-slate-400 italic bg-white border rounded-lg">
          No se encontraron registros contables para los parámetros
          seleccionados.
        </div>
      ) : (
        <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
              <tr>
                <th className="p-2.5 w-28">Código</th>
                <th className="p-2.5 min-w-[260px]">Concepto / Subconcepto</th>
                <th className="p-2.5 text-right w-48">Saldo Actual</th>
                {esComparativo && (
                  <>
                    <th className="p-2.5 text-right w-48">
                      {modoPresentacion === "COMPARATIVO_MES"
                        ? "Periodo Ant. (Mes)"
                        : "Periodo Ant. (Año)"}
                    </th>
                    <th className="p-2.5 text-right w-44">Variación</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y text-[10px]">
              {["Activo", "Pasivo", "Patrimonio"].map((elemento) => {
                const clasificaciones = balanceAgrupado[elemento];
                const tieneClasificaciones =
                  Object.keys(clasificaciones).length > 0;

                if (!tieneClasificaciones) return null;

                const totElem = calculosTotales.totalesElementos[elemento];

                return (
                  <React.Fragment key={elemento}>
                    {/* ENCABEZADO PRINCIPAL DE ELEMENTO */}
                    <tr className="bg-slate-900 text-white font-bold text-[11px]">
                      <td colSpan={2} className="p-2.5 uppercase tracking-wider">
                        {elemento}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {fmt(totElem.actual)}
                      </td>
                      {esComparativo && (
                        <>
                          <td className="p-2.5 text-right font-mono">
                            {fmt(totElem.comparativo)}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            {fmt(totElem.actual - totElem.comparativo)}
                          </td>
                        </>
                      )}
                    </tr>

                    {/* RECORRER CLASIFICACIONES */}
                    {Object.entries(clasificaciones).map(
                      ([clasif, conceptos]) => {
                        const subClasif =
                          calculosTotales.subtotalesClasif[elemento][clasif];

                        return (
                          <React.Fragment key={clasif}>
                            <tr className="bg-slate-200 text-slate-800 font-bold text-[10px]">
                              <td
                                colSpan={2}
                                className="p-2 pl-4 uppercase tracking-wide text-slate-700"
                              >
                                &nbsp;&nbsp;{clasif}
                              </td>
                              <td className="p-2 text-right font-mono">
                                {fmt(subClasif.actual)}
                              </td>
                              {esComparativo && (
                                <>
                                  <td className="p-2 text-right font-mono">
                                    {fmt(subClasif.comparativo)}
                                  </td>
                                  <td className="p-2 text-right font-mono">
                                    {fmt(
                                      subClasif.actual - subClasif.comparativo
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>

                            {Object.entries(conceptos).map(([cId, con]) => (
                              <React.Fragment key={cId}>
                                <tr className="bg-slate-50 font-bold text-slate-800">
                                  <td className="p-2 pl-6 font-mono text-blue-700">
                                    {con.codigo}
                                  </td>
                                  <td className="p-2">{con.nombre}</td>
                                  <td className="p-2 text-right font-mono">
                                    {fmt(con.totalConcepto)}
                                  </td>
                                  {esComparativo && (
                                    <>
                                      <td className="p-2 text-right font-mono text-slate-600">
                                        {fmt(con.totalConceptoComp)}
                                      </td>
                                      <td className="p-2 text-right font-mono text-slate-700">
                                        {fmt(
                                          con.totalConcepto -
                                            con.totalConceptoComp
                                        )}
                                      </td>
                                    </>
                                  )}
                                </tr>

                                {con.subconceptos.map((sub) => (
                                  <tr
                                    key={sub.id}
                                    className="hover:bg-slate-50/80 text-slate-600"
                                  >
                                    <td className="p-1.5 pl-9 font-mono text-slate-500">
                                      {sub.codigo}
                                    </td>
                                    <td className="p-1.5 pl-6">{sub.nombre}</td>
                                    <td className="p-1.5 text-right font-mono text-slate-800">
                                      {fmt(sub.saldo)}
                                    </td>
                                    {esComparativo && (
                                      <>
                                        <td className="p-1.5 text-right font-mono text-slate-500">
                                          {fmt(sub.saldoComp)}
                                        </td>
                                        <td className="p-1.5 text-right font-mono text-slate-700">
                                          {fmt(sub.variacion)}
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </React.Fragment>
                        );
                      }
                    )}
                  </React.Fragment>
                );
              })}

              {/* PRUEBA CONTABLE FINAL */}
              <tr
                className={`font-bold text-[11px] border-t-2 border-slate-300 ${
                  pruebaCuadre.cuadra
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                <td colSpan={2} className="p-2.5 uppercase tracking-wide">
                  PRUEBA CONTABLE (ACTIVO - PASIVO - PATRIMONIO){" "}
                  {pruebaCuadre.cuadra ? "— CUADRADO ✓" : "— DESCUADRADO ⚠️"}
                </td>
                <td className="p-2.5 text-right font-mono">
                  {fmt(pruebaCuadre.diferencia)}
                </td>
                {esComparativo && (
                  <>
                    <td className="p-2.5 text-right font-mono">
                      {fmt(pruebaCuadre.diferenciaComp)}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {fmt(pruebaCuadre.variacion)}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}