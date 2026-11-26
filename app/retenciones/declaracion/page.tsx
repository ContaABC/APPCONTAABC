"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  setEmpresaActivaUsuario,
  type Empresa as EmpresaPermitida,
} from "@/app/actions/accionesEmpresas";
import {
  obtenerSucursales,
  obtenerClasesDocumento,
  obtenerConceptosAuxiliares,
  obtenerMovimientosRetencionesPorPeriodo,
  registrarAsientoCierreRetenciones,
  SucursalRow,
  ClaseDocumentoRow,
  ConceptoAuxiliarRow,
  RetencionMovimientoRow,
  DetalleAgrupadoItem,
} from "./actions-declaracion";
import { validarPeriodoContable } from "@/lib/accounting-validations";

type EmpresaRow = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
  nit?: string;
};

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function obtenerNombreEmpresa(emp: EmpresaRow): string {
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

export default function DeclaracionRetencionesPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [clasesDocumento, setClasesDocumento] = useState<ClaseDocumentoRow[]>(
    []
  );
  const [conceptosAuxiliares, setConceptosAuxiliares] = useState<
    ConceptoAuxiliarRow[]
  >([]);

  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [claseDocumentoId, setClaseDocumentoId] = useState<string>("");
  const [conceptoAuxiliarCreditoId, setConceptoAuxiliarCreditoId] =
    useState<string>("");

  // Parámetros de la Declaración
  const [tipoRetencion, setTipoRetencion] = useState<string>("RENTA"); // RENTA, IVA, ICA
  const [periodoDesde, setPeriodoDesde] = useState<string>("");
  const [periodoHasta, setPeriodoHasta] = useState<string>("");
  const [fechaContable, setFechaContable] = useState<string>("");
  const [aproximarAlMil, setAproximarAlMil] = useState<boolean>(true);

  // Estados para Control de Periodo Contable
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  // Datos y Resultados
  const [movimientos, setMovimientos] = useState<RetencionMovimientoRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [procesandoCierre, setProcesandoCierre] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  // Inicializar fecha contable con el día de hoy al montar
  useEffect(() => {
    const hoyStr = new Date().toISOString().split("T")[0];
    setFechaContable(hoyStr);
  }, []);

  // Función de validación de periodo en tiempo real
  const verificarPeriodo = useCallback(
    async (fecha: string) => {
      if (!empresaId || !sucursalId || !fecha) {
        setErrorPeriodo(null);
        return;
      }

      setValidandoPeriodo(true);
      setErrorPeriodo(null);

      const res = await validarPeriodoContable(empresaId, sucursalId, fecha);
      if (!res.valido) {
        setErrorPeriodo(
          res.mensaje || "Periodo no habilitado para transacciones."
        );
      }

      setValidandoPeriodo(false);
    },
    [empresaId, sucursalId]
  );

  // Validar automáticamente al cambiar empresa o sucursal si ya hay fecha contable
  useEffect(() => {
    if (empresaId && sucursalId && fechaContable) {
      verificarPeriodo(fechaContable);
    }
  }, [empresaId, sucursalId, fechaContable, verificarPeriodo]);

  // 1. Cargar solo Empresas asignadas y seleccionar la empresa activa
  useEffect(() => {
    if (!isMounted || inicializadoRef.current) return;
    inicializadoRef.current = true;
    let cancelado = false;

    async function cargarEmpresas() {
      try {
        const uid = await resolverUsuarioId();
        const permitidas = await getEmpresasPermitidas(uid);
        if (cancelado) return;

        const listaEmpresas: EmpresaRow[] = Array.isArray(permitidas)
          ? (permitidas as EmpresaRow[])
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
          "Error cargando empresas asignadas en declaración de retenciones:",
          err
        );
      }
    }

    cargarEmpresas();
    return () => {
      cancelado = true;
    };
  }, [isMounted, resolverUsuarioId]);

  const handleCambioEmpresa = async (nuevoId: string) => {
    setEmpresaId(nuevoId);

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

  // 2. Cargar dependencias al cambiar Empresa (con SUC-001 por defecto)
  useEffect(() => {
    if (!empresaId) return;
    setSucursalId("");
    setClaseDocumentoId("");
    setConceptoAuxiliarCreditoId("");
    setMovimientos([]);

    async function cargarDatosEmpresa() {
      const [resSuc, resDoc, resAux] = await Promise.all([
        obtenerSucursales(empresaId),
        obtenerClasesDocumento(empresaId),
        obtenerConceptosAuxiliares(empresaId),
      ]);

      if (resSuc.success && resSuc.data) {
        setSucursales(resSuc.data);
        const sucursalDefault = resSuc.data.find(
          (s: SucursalRow) => s.codigo_sucursal === "SUC-001"
        );
        if (sucursalDefault) {
          setSucursalId(String(sucursalDefault.id));
        } else if (resSuc.data.length > 0) {
          setSucursalId(String(resSuc.data[0].id));
        }
      }

      if (resDoc.success && resDoc.data) {
        setClasesDocumento(resDoc.data);
        if (resDoc.data.length > 0)
          setClaseDocumentoId(String(resDoc.data[0].id));
      }

      if (resAux.success && resAux.data) {
        setConceptosAuxiliares(resAux.data);
        if (resAux.data.length > 0)
          setConceptoAuxiliarCreditoId(String(resAux.data[0].id));
      }
    }
    cargarDatosEmpresa();
  }, [empresaId]);

  // Limpiar resultados al cambiar filtros
  useEffect(() => {
    setMovimientos([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [sucursalId, tipoRetencion, periodoDesde, periodoHasta]);

  // 3. Consultar Movimientos
  async function consultarRetenciones() {
    if (!empresaId || !periodoDesde || !periodoHasta) {
      setErrorMsg(
        "Debe seleccionar la empresa y definir el rango de periodos (Desde - Hasta)."
      );
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await obtenerMovimientosRetencionesPorPeriodo({
      empresaId,
      sucursalId,
      tipoRetencion,
      periodoDesde,
      periodoHasta,
    });

    if (res.success) {
      setMovimientos(res.data || []);
    } else {
      setErrorMsg(
        res.error || "Error al consultar los movimientos de retención."
      );
    }
    setLoading(false);
  }

  const aplicarAproximacionMil = useCallback(
    (valor: number) => {
      if (!aproximarAlMil) return valor;
      return Math.round(valor / 1000) * 1000;
    },
    [aproximarAlMil]
  );

  // 4. Agrupar datos por Concepto de Retención y capturar ajustes dinámicos
  interface GrupoConceptoItem {
    concepto: string;
    conceptoAuxiliarId: number | string | null;
    ajusteDebitoId: number | string | null;
    ajusteCreditoId: number | string | null;
    tarifaDisplay: string;
    baseTotal: number;
    valorRetencionTotal: number;
  }

  const datosAgrupadosPorConcepto = useMemo(() => {
    const agrupado: { [key: string]: GrupoConceptoItem } = {};

    movimientos.forEach((m) => {
      const nombreConcepto =
        m.conceptos_retencion?.concepto ||
        (m.concepto as string) ||
        "CONCEPTO GENERAL";
      const conceptoAuxId = m.conceptos_retencion?.concepto_auxiliar_id || null;
      const ajusteDebitoId =
        m.conceptos_retencion?.concepto_auxiliar_ajuste_debito_id || null;
      const ajusteCreditoId =
        m.conceptos_retencion?.concepto_auxiliar_ajuste_credito_id || null;
      const porcentajeRaw = Number(
        m.conceptos_retencion?.tarifa || m.porcentaje || 0
      );

      let tarifaFormatted = "";
      if (tipoRetencion === "ICA") {
        const porMil = porcentajeRaw * 1000;
        tarifaFormatted = `${
          porMil % 1 === 0 ? porMil.toFixed(0) : porMil.toFixed(2)
        } x 1.000`;
      } else {
        const porciento = porcentajeRaw * 100;
        tarifaFormatted = `${
          porciento % 1 === 0 ? porciento.toFixed(0) : porciento.toFixed(2)
        }%`;
      }

      const clave = `${nombreConcepto}_${porcentajeRaw}_${conceptoAuxId || 0}`;

      if (!agrupado[clave]) {
        agrupado[clave] = {
          concepto: nombreConcepto,
          conceptoAuxiliarId: conceptoAuxId,
          ajusteDebitoId: ajusteDebitoId,
          ajusteCreditoId: ajusteCreditoId,
          tarifaDisplay: tarifaFormatted,
          baseTotal: 0,
          valorRetencionTotal: 0,
        };
      }
      agrupado[clave].baseTotal += Number(m.base_gravable || 0);
      agrupado[clave].valorRetencionTotal += Number(m.valor_retencion || 0);
    });

    return Object.values(agrupado).sort((a, b) =>
      a.concepto.localeCompare(b.concepto)
    );
  }, [movimientos, tipoRetencion]);

  // 5. Totales
  const totalesDeclaracion = useMemo(() => {
    let totalBase = 0;
    let totalRetencion = 0;

    datosAgrupadosPorConcepto.forEach((item) => {
      totalBase += item.baseTotal;
      totalRetencion += item.valorRetencionTotal;
    });

    const totalRetencionAproximado = aplicarAproximacionMil(totalRetencion);

    return {
      base: totalBase,
      retencionReal: totalRetencion,
      retencionAproximada: totalRetencionAproximado,
    };
  }, [datosAgrupadosPorConcepto, aplicarAproximacionMil]);

  // 6. Generar Asiento
  async function handleGenerarAsientoCierre() {
    if (errorPeriodo) {
      setErrorMsg(
        "No se puede generar el asiento porque el periodo contable no es válido o está cerrado."
      );
      return;
    }
    if (datosAgrupadosPorConcepto.length === 0) {
      setErrorMsg("No hay datos agrupados para generar el asiento de cierre.");
      return;
    }
    if (!claseDocumentoId) {
      setErrorMsg(
        "Debe seleccionar una clase de documento para el comprobante contable."
      );
      return;
    }
    if (!conceptoAuxiliarCreditoId) {
      setErrorMsg(
        "Debe seleccionar el concepto auxiliar de crédito (contrapartida)."
      );
      return;
    }

    setProcesandoCierre(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const detallesParaAccion: DetalleAgrupadoItem[] =
      datosAgrupadosPorConcepto.map((item) => ({
        conceptoAuxiliarId: item.conceptoAuxiliarId || "",
        concepto: item.concepto,
        valorRetencionTotal: aplicarAproximacionMil(item.valorRetencionTotal),
        ajusteDebitoId: item.ajusteDebitoId,
        ajusteCreditoId: item.ajusteCreditoId,
      }));

    const totalesParaAccion = {
      base: totalesDeclaracion.base,
      retencionReal: aproximarAlMil
        ? totalesDeclaracion.retencionAproximada
        : totalesDeclaracion.retencionReal,
      retencionAproximada: totalesDeclaracion.retencionAproximada,
    };

    const res = await registrarAsientoCierreRetenciones({
      empresaId,
      sucursalId,
      claseDocumentoId,
      conceptoAuxiliarCreditoId,
      tipoRetencion,
      periodoDesde,
      periodoHasta,
      fechaContable,
      totales: totalesParaAccion,
      detallesAgrupados: detallesParaAccion,
    });

    if (res.success && res.data) {
      setSuccessMsg(
        `¡Asiento contable de cierre generado con éxito! N° Documento: ${res.data.numeroDocumento}`
      );
    } else {
      setErrorMsg(
        res.error || "Error al registrar el asiento contable de cierre."
      );
    }
    setProcesandoCierre(false);
  }

  if (!isMounted) return null;

  return (
    <div className="p-3 max-w-[98%] mx-auto space-y-3 text-xs">
      <div className="border-b border-slate-200 pb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] transition border border-slate-200 cursor-pointer shrink-0"
        >
          ← Atrás
        </button>
        <h1 className="text-sm font-bold text-slate-800">
          Declaración Consolidada de Retenciones
        </h1>
      </div>

      {/* Filtros Principales */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
            Empresa
          </label>
          <select
            value={empresaId}
            onChange={(e) => handleCambioEmpresa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {obtenerNombreEmpresa(emp)} {emp.nit ? `(${emp.nit})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
            Sucursal{" "}
            {tipoRetencion === "ICA" && (
              <span className="text-amber-600">(Requerido ICA)</span>
            )}
          </label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.codigo_sucursal} {suc.nombre}{" "}
                {suc.ciudad ? `(${suc.ciudad})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
            Tipo de Retención
          </label>
          <select
            value={tipoRetencion}
            onChange={(e) => setTipoRetencion(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-700"
          >
            <option value="RENTA">RENTA (Mensual)</option>
            <option value="IVA">IVA (Bimestral / Cuatrimestral)</option>
            <option value="ICA">ICA (Municipal / Bimestral)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
              Desde
            </label>
            <input
              type="date"
              value={periodoDesde}
              onChange={(e) => setPeriodoDesde(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={periodoHasta}
              onChange={(e) => setPeriodoHasta(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={consultarRetenciones}
            disabled={loading}
            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow-2xs transition text-xs cursor-pointer"
          >
            {loading ? "Consultando..." : "🔍 Cargar Datos"}
          </button>
        </div>
      </div>

      {/* Selectores del Comprobante Contable y Fecha Contable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 text-[11px]">
        <div>
          <label className="block text-[9px] font-bold text-indigo-800 uppercase mb-1">
            Clase de Documento Contable
          </label>
          <select
            value={claseDocumentoId}
            onChange={(e) => setClaseDocumentoId(e.target.value)}
            className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">-- Seleccione Clase de Documento --</option>
            {clasesDocumento.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.codigo_clase} {doc.nombre_clase}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-indigo-800 uppercase mb-1">
            Cuenta Auxiliar Crédito (Principal)
          </label>
          <select
            value={conceptoAuxiliarCreditoId}
            onChange={(e) => setConceptoAuxiliarCreditoId(e.target.value)}
            className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">-- Seleccione Cuenta Crédito --</option>
            {conceptosAuxiliares.map((aux) => (
              <option key={aux.id} value={aux.id}>
                {aux.codigo_auxiliar} {aux.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-indigo-800 uppercase mb-1">
            Fecha Contable de Cierre *
          </label>
          <input
            type="date"
            value={fechaContable}
            onChange={(e) => {
              setFechaContable(e.target.value);
              if (errorPeriodo) setErrorPeriodo(null);
            }}
            onBlur={() => verificarPeriodo(fechaContable)}
            required
            className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {validandoPeriodo && (
            <p className="text-[9px] text-indigo-600 mt-0.5 animate-pulse">
              Verificando periodo...
            </p>
          )}
          {errorPeriodo && (
            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1 rounded mt-0.5">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>
      </div>

      {/* Checkbox de Aproximación */}
      <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={aproximarAlMil}
            onChange={(e) => setAproximarAlMil(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
          />
          <span>
            Aproximar valores al <strong>mil más cercano</strong> (Estándar
            DIAN)
          </span>
        </label>
        <span className="text-[10px] text-slate-400 italic">
          Aplica para declaración y cierre
        </span>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* Tabla Desglosada */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        {datosAgrupadosPorConcepto.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            Selecciona los parámetros y haz clic en &quot;Cargar Datos&quot; para
            ver el desglose por conceptos de retención.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                <tr>
                  <th className="p-2.5">Concepto de Retención</th>
                  <th className="p-2.5 text-center">Tarifa</th>
                  <th className="p-2.5 text-right">Base Gravable Acumulada</th>
                  <th className="p-2.5 text-right">Retención Real (Exacta)</th>
                  <th className="p-2.5 text-right text-indigo-700">
                    Retención Aproximada (Mil)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datosAgrupadosPorConcepto.map((item, idx) => {
                  const retAprox = aplicarAproximacionMil(
                    item.valorRetencionTotal
                  );
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-semibold text-slate-900">
                        {item.concepto}
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        {item.tarifaDisplay}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        ${item.baseTotal.toLocaleString("es-CO")}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-600">
                        ${item.valorRetencionTotal.toLocaleString("es-CO")}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-indigo-700">
                        ${retAprox.toLocaleString("es-CO")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-bold text-xs sticky bottom-0 z-10">
                <tr>
                  <td colSpan={2} className="p-3 uppercase tracking-wider">
                    Total Consolidado:
                  </td>
                  <td className="p-3 text-right font-mono text-slate-200">
                    ${totalesDeclaracion.base.toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-300">
                    ${totalesDeclaracion.retencionReal.toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-400 text-sm font-extrabold">
                    $
                    {totalesDeclaracion.retencionAproximada.toLocaleString(
                      "es-CO"
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Botón de Cierre Contable */}
      {datosAgrupadosPorConcepto.length > 0 && (
        <div className="flex items-center justify-end gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="text-right text-[11px] text-slate-500">
            Se contabilizará el asiento aplicando los débitos, el crédito
            principal y las cuentas de ajuste dinámicas.
          </div>
          <button
            type="button"
            onClick={handleGenerarAsientoCierre}
            disabled={procesandoCierre || Boolean(errorPeriodo)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded shadow transition flex items-center gap-2 cursor-pointer"
          >
            {procesandoCierre
              ? "Generando Asiento..."
              : "⚖️ Generar Asiento Contable de Cierre"}
          </button>
        </div>
      )}
    </div>
  );
}