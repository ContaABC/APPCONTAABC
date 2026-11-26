"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  setEmpresaActivaUsuario,
  type Empresa as EmpresaPermitida,
} from "@/app/actions/accionesEmpresas";
import {
  obtenerSucursalesSaldo,
  obtenerTercerosSaldo,
  consultarSaldosRetenciones,
  type SucursalSaldoRow,
  type TerceroSaldoRow,
  type RetencionMovimientoSaldoRow,
  type SaldoConceptoVigenciaRow,
} from "./saldos-retenciones-actions";
import { Search, RotateCcw, Download } from "lucide-react";

type Empresa = EmpresaPermitida & {
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

function obtenerNombreEmpresa(emp: Empresa): string {
  return String(
    emp.razon_social || emp.nombre_comercial || emp.nombre || "Empresa"
  );
}

function obtenerNombreTercero(ter: TerceroSaldoRow): string {
  const nombre =
    ter.razon_social || ter.nombre_comercial || ter.nombre || `Tercero #${ter.id}`;
  const doc = ter.identificacion || ter.nit || ter.numero_documento || "";
  return doc ? `${nombre} (${doc})` : String(nombre);
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

function obtenerRangoAnio(anio: number): { desde: string; hasta: string } {
  return {
    desde: `${anio}-01-01`,
    hasta: `${anio}-12-31`,
  };
}

export default function SaldosRetencionesVigenciaPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const anioActual = new Date().getFullYear();
  const rangoInicial = useMemo(() => obtenerRangoAnio(anioActual), [anioActual]);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");

  const [sucursales, setSucursales] = useState<SucursalSaldoRow[]>([]);
  const [sucursalId, setSucursalId] = useState<string>("");

  const [terceros, setTerceros] = useState<TerceroSaldoRow[]>([]);
  const [terceroId, setTerceroId] = useState<string>("TODOS");

  const [vigenciaAnio, setVigenciaAnio] = useState<string>(String(anioActual));
  const [fechaDesde, setFechaDesde] = useState<string>(rangoInicial.desde);
  const [fechaHasta, setFechaHasta] = useState<string>(rangoInicial.hasta);

  const [tipoRetencion, setTipoRetencion] = useState<string>("TODOS");
  const [tipoOperacion, setTipoOperacion] = useState<string>("TODOS");

  const [aproximarAlMil, setAproximarAlMil] = useState<boolean>(false);
  const [verMovimientosDetalle, setVerMovimientosDetalle] =
    useState<boolean>(false);
  const [claveConceptoSeleccionado, setClaveConceptoSeleccionado] = useState<
    string | null
  >(null);

  const [movimientos, setMovimientos] = useState<RetencionMovimientoSaldoRow[]>(
    []
  );
  const [consultado, setConsultado] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(false);
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
          "Error inicializando saldos de retenciones por vigencia:",
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
    setSucursalId("");
    setTerceroId("TODOS");
    setClaveConceptoSeleccionado(null);
    setMovimientos([]);
    setConsultado(false);
    setErrorMsg(null);

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

  useEffect(() => {
    if (!isMounted || !empresaId) return;
    async function cargarCatalogos() {
      const [resSuc, resTer] = await Promise.all([
        obtenerSucursalesSaldo(empresaId),
        obtenerTercerosSaldo(empresaId),
      ]);
      if (resSuc.success) setSucursales(resSuc.data || []);
      if (resTer.success) setTerceros(resTer.data || []);
    }
    cargarCatalogos();
  }, [isMounted, empresaId]);

  const mapaTerceros = useMemo(() => {
    const map = new Map<string, TerceroSaldoRow>();
    for (const t of terceros) {
      map.set(String(t.id), t);
    }
    return map;
  }, [terceros]);

  const handleCambioVigenciaAnio = (val: string) => {
    setVigenciaAnio(val);
    if (val !== "PERSONALIZADO") {
      const anioNum = Number(val);
      if (!Number.isNaN(anioNum)) {
        const rango = obtenerRangoAnio(anioNum);
        setFechaDesde(rango.desde);
        setFechaHasta(rango.hasta);
      }
    }
  };

  const ejecutarConsulta = useCallback(async () => {
    if (!empresaId) {
      setErrorMsg("Debe seleccionar una empresa activa.");
      return;
    }
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setErrorMsg("La fecha inicial no puede ser mayor que la fecha final.");
      return;
    }

    setCargando(true);
    setConsultado(true);
    setClaveConceptoSeleccionado(null);
    setErrorMsg(null);

    const res = await consultarSaldosRetenciones({
      empresaId,
      sucursalId: sucursalId || null,
      terceroId,
      tipoRetencion,
      tipoOperacion,
      fechaDesde,
      fechaHasta,
    });

    setCargando(false);

    if (!res.success) {
      setMovimientos([]);
      setErrorMsg(res.error || "Error al consultar los movimientos.");
      return;
    }

    setMovimientos(res.movimientos || []);
  }, [
    empresaId,
    sucursalId,
    terceroId,
    tipoRetencion,
    tipoOperacion,
    fechaDesde,
    fechaHasta,
  ]);

  useEffect(() => {
    if (!isMounted || !empresaId) return;
    ejecutarConsulta();
  }, [isMounted, empresaId, ejecutarConsulta]);

  const getClaveConceptoMovimiento = useCallback(
    (m: RetencionMovimientoSaldoRow): string => {
      const anioMov = m.fecha_contable ? m.fecha_contable.slice(0, 4) : "";
      const vigenciaLabel = m.conceptos_retencion?.anio
        ? String(m.conceptos_retencion.anio)
        : anioMov;
      const conceptoNombre =
        m.conceptos_retencion?.concepto ||
        (m.conceptos_retencion_id
          ? `Concepto ID #${m.conceptos_retencion_id}`
          : "Sin concepto parametrizado");
      const pct = Number(m.porcentaje ?? m.conceptos_retencion?.tarifa ?? 0);
      return `${m.conceptos_retencion_id ?? "SIN"}||${m.tipo_retencion}||${m.tipo_operacion}||${vigenciaLabel}||${pct}||${conceptoNombre}`;
    },
    []
  );

  const saldosAgrupados = useMemo<SaldoConceptoVigenciaRow[]>(() => {
    const mapa = new Map<string, SaldoConceptoVigenciaRow>();

    for (const m of movimientos) {
      const clave = getClaveConceptoMovimiento(m);
      const anioMov = m.fecha_contable ? m.fecha_contable.slice(0, 4) : "";
      const vigenciaLabel = m.conceptos_retencion?.anio
        ? String(m.conceptos_retencion.anio)
        : anioMov;
      const conceptoNombre =
        m.conceptos_retencion?.concepto ||
        (m.conceptos_retencion_id
          ? `Concepto ID #${m.conceptos_retencion_id}`
          : "Sin concepto parametrizado");
      const pct = Number(m.porcentaje ?? m.conceptos_retencion?.tarifa ?? 0);

      const actual = mapa.get(clave);
      if (!actual) {
        mapa.set(clave, {
          clave,
          conceptos_retencion_id: m.conceptos_retencion_id,
          concepto: conceptoNombre,
          tipo_retencion: m.tipo_retencion,
          tipo_operacion: m.tipo_operacion,
          vigencia: vigenciaLabel,
          porcentaje: pct,
          cantidad_movimientos: 1,
          base_gravable_total: Number(m.base_gravable || 0),
          valor_retencion_total: Number(m.valor_retencion || 0),
        });
      } else {
        actual.cantidad_movimientos += 1;
        actual.base_gravable_total += Number(m.base_gravable || 0);
        actual.valor_retencion_total += Number(m.valor_retencion || 0);
      }
    }

    return Array.from(mapa.values()).sort((a, b) => {
      if (a.vigencia !== b.vigencia) return b.vigencia.localeCompare(a.vigencia);
      return a.concepto.localeCompare(b.concepto);
    });
  }, [movimientos, getClaveConceptoMovimiento]);

  const movimientosDetalleVisibles = useMemo(() => {
    if (claveConceptoSeleccionado) {
      return movimientos.filter(
        (m) => getClaveConceptoMovimiento(m) === claveConceptoSeleccionado
      );
    }
    if (verMovimientosDetalle) {
      return movimientos;
    }
    return [];
  }, [
    movimientos,
    claveConceptoSeleccionado,
    verMovimientosDetalle,
    getClaveConceptoMovimiento,
  ]);

  const conceptoSeleccionadoObj = useMemo(() => {
    if (!claveConceptoSeleccionado) return null;
    return (
      saldosAgrupados.find((s) => s.clave === claveConceptoSeleccionado) || null
    );
  }, [saldosAgrupados, claveConceptoSeleccionado]);

  const fmt = (v: number) => `$ ${Number(v || 0).toLocaleString("es-CO")}`;

  const formatearTarifa = (pct: number, tipo: string) => {
    const num = Number(pct || 0);
    if (tipo === "ICA") {
      const porMil = num * 1000;
      return `${porMil.toFixed(2).replace(/\.?0+$/, "")} x mil`;
    }
    const porCiento = num * 100;
    return `${porCiento.toFixed(2).replace(/\.?0+$/, "")}%`;
  };

  const valorRetencionAplicado = useCallback(
    (val: number) => {
      if (!aproximarAlMil) return Number(val || 0);
      return Math.round(Number(val || 0) / 1000) * 1000;
    },
    [aproximarAlMil]
  );

  const totales = useMemo(() => {
    let base = 0;
    let retencionMostrada = 0;

    for (const fila of saldosAgrupados) {
      base += fila.base_gravable_total;
      retencionMostrada += valorRetencionAplicado(fila.valor_retencion_total);
    }

    return { base, retencionMostrada };
  }, [saldosAgrupados, valorRetencionAplicado]);

  const handleLimpiarFiltros = () => {
    const rango = obtenerRangoAnio(anioActual);
    setSucursalId("");
    setTerceroId("TODOS");
    setVigenciaAnio(String(anioActual));
    setFechaDesde(rango.desde);
    setFechaHasta(rango.hasta);
    setTipoRetencion("TODOS");
    setTipoOperacion("TODOS");
    setClaveConceptoSeleccionado(null);
  };

  const handleExportarExcel = () => {
    if (saldosAgrupados.length === 0 && movimientos.length === 0) {
      alert("No hay información para exportar a Excel.");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Hoja 1: Conceptos Acumulados
    const filasHoja1 = saldosAgrupados.map((fila) => ({
      Vigencia: fila.vigencia,
      Impuesto: fila.tipo_retencion,
      Operacion:
        fila.tipo_operacion === "PRACTICADA_A_PROVEEDOR"
          ? "Practicada a Proveedor"
          : "Efectuada por Cliente",
      Concepto: fila.concepto,
      Tarifa: formatearTarifa(fila.porcentaje, fila.tipo_retencion),
      Movimientos: fila.cantidad_movimientos,
      "Base Gravable": fila.base_gravable_total,
      "Saldo Retencion": valorRetencionAplicado(fila.valor_retencion_total),
    }));

    filasHoja1.push({
      Vigencia: "",
      Impuesto: "",
      Operacion: "",
      Concepto: "TOTAL GENERAL",
      Tarifa: "",
      Movimientos: movimientos.length,
      "Base Gravable": totales.base,
      "Saldo Retencion": totales.retencionMostrada,
    });

    const ws1 = XLSX.utils.json_to_sheet(filasHoja1);
    XLSX.utils.book_append_sheet(wb, ws1, "Conceptos_Acumulados");

    // Hoja 2: Movimiento de los conceptos
    const filasHoja2 = movimientos.map((mov) => {
      const ter = mapaTerceros.get(String(mov.tercero_id));
      const pct = Number(mov.porcentaje ?? mov.conceptos_retencion?.tarifa ?? 0);
      return {
        Fecha: mov.fecha_contable,
        "Documento Origen": mov.documento_origen,
        Tercero: ter ? obtenerNombreTercero(ter) : `Tercero #${mov.tercero_id}`,
        Impuesto: mov.tipo_retencion,
        Operacion:
          mov.tipo_operacion === "PRACTICADA_A_PROVEEDOR"
            ? "Practicada a Proveedor"
            : "Efectuada por Cliente",
        Concepto:
          mov.conceptos_retencion?.concepto ||
          "Sin concepto parametrizado",
        Tarifa: formatearTarifa(pct, mov.tipo_retencion),
        "Base Gravable": Number(mov.base_gravable || 0),
        "Valor Retencion": valorRetencionAplicado(mov.valor_retencion),
      };
    });

    const ws2 = XLSX.utils.json_to_sheet(filasHoja2);
    XLSX.utils.book_append_sheet(wb, ws2, "Movimiento_Conceptos");

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Saldos_Retenciones_${fechaArchivo}.xlsx`);
  };

  if (!isMounted) return null;

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-4 text-xs font-sans">
      {/* Encabezado */}
      <div className="border-b pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition border border-slate-200 cursor-pointer shrink-0"
          >
            ← Atrás
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              Saldos de Retenciones por Concepto y Vigencia
            </h1>
            <p className="text-xs text-slate-500">
              Consulta acumulada por concepto, vigencia, tercero y periodo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={saldosAgrupados.length === 0 && movimientos.length === 0}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleLimpiarFiltros}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Limpiar
          </button>
        </div>
      </div>

      {/* Filtros compactos en 2 filas */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
        {/* Fila 1: Empresa, Sucursal, Año y Tipo de Retención */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Empresa Activa
            </label>
            <select
              value={empresaId}
              onChange={(e) => handleCambioEmpresa(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold text-xs outline-none"
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {obtenerNombreEmpresa(emp)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Sucursal
            </label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold text-xs outline-none"
            >
              <option value="">Todas</option>
              {sucursales.map((suc) => (
                <option key={suc.id} value={suc.id}>
                  {suc.codigo_sucursal ? `${suc.codigo_sucursal} - ` : ""}
                  {suc.nombre || suc.ciudad || `Sucursal #${suc.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Año
            </label>
            <select
              value={vigenciaAnio}
              onChange={(e) => handleCambioVigenciaAnio(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-bold text-xs outline-none"
            >
              {[2024, 2025, 2026, 2027, 2028].map((anio) => (
                <option key={anio} value={String(anio)}>
                  {anio}
                </option>
              ))}
              <option value="PERSONALIZADO">Personalizado</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Tipo de Retención
            </label>
            <select
              value={tipoRetencion}
              onChange={(e) => setTipoRetencion(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold text-xs outline-none"
            >
              <option value="TODOS">Todos</option>
              <option value="RENTA">Renta</option>
              <option value="IVA">IVA</option>
              <option value="ICA">ICA</option>
            </select>
          </div>
        </div>

        {/* Fila 2: Tercero, Tipo de Operación, Desde, Hasta y Consultar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Tercero
            </label>
            <select
              value={terceroId}
              onChange={(e) => setTerceroId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold text-xs outline-none"
            >
              <option value="TODOS">Todos</option>
              {terceros.map((ter) => (
                <option key={ter.id} value={String(ter.id)}>
                  {obtenerNombreTercero(ter)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Tipo de Operación
            </label>
            <select
              value={tipoOperacion}
              onChange={(e) => setTipoOperacion(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold text-xs outline-none"
            >
              <option value="TODOS">Todos</option>
              <option value="PRACTICADA_A_PROVEEDOR">
                Practicada a Proveedor
              </option>
              <option value="EFECTUADA_POR_CLIENTE">
                Efectuada por Cliente
              </option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setVigenciaAnio("PERSONALIZADO");
                setFechaDesde(e.target.value);
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 font-mono text-xs outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-[10px]">
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setVigenciaAnio("PERSONALIZADO");
                setFechaHasta(e.target.value);
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 font-mono text-xs outline-none"
            />
          </div>

          <div className="md:col-span-1">
            <button
              type="button"
              onClick={ejecutarConsulta}
              disabled={cargando || !empresaId}
              className="w-full px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer shadow-2xs transition"
              title="Consultar"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{cargando ? "..." : "Ir"}</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Tabla consolidada por concepto y vigencia con checkboxes en el título */}
      <div className="bg-white border rounded-xl shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-100 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <span className="font-bold text-slate-700 uppercase text-xs">
            Saldos Consolidados por Concepto y Vigencia
          </span>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aproximarAlMil}
                onChange={(e) => setAproximarAlMil(e.target.checked)}
                className="rounded text-indigo-600 h-3.5 w-3.5"
              />
              <span>Aproximar retención al mil</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={verMovimientosDetalle}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setVerMovimientosDetalle(checked);
                  if (!checked) {
                    setClaveConceptoSeleccionado(null);
                  }
                }}
                className="rounded text-indigo-600 h-3.5 w-3.5"
              />
              <span>Ver movimientos detalle</span>
            </label>
          </div>
        </div>

        {cargando ? (
          <div className="p-10 text-center text-slate-500 font-semibold">
            Consultando saldos de retenciones...
          </div>
        ) : !consultado || saldosAgrupados.length === 0 ? (
          <div className="p-10 text-center text-slate-500 italic">
            No se encontraron saldos de retenciones para los filtros
            seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b uppercase">
                <tr>
                  <th className="p-3">Vigencia</th>
                  <th className="p-3">Impuesto</th>
                  <th className="p-3">Operación</th>
                  <th className="p-3">Concepto de Retención</th>
                  <th className="p-3 text-center">Tarifa</th>
                  <th className="p-3 text-center">Movs.</th>
                  <th className="p-3 text-right">Base Gravable</th>
                  <th className="p-3 text-right">Saldo Retención</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {saldosAgrupados.map((fila) => {
                  const seleccionada = claveConceptoSeleccionado === fila.clave;
                  return (
                    <tr
                      key={fila.clave}
                      onClick={() =>
                        setClaveConceptoSeleccionado((prev) =>
                          prev === fila.clave ? null : fila.clave
                        )
                      }
                      className={`cursor-pointer transition ${
                        seleccionada
                          ? "bg-indigo-50/80 ring-1 ring-inset ring-indigo-300"
                          : "hover:bg-slate-50"
                      }`}
                      title="Haz clic para ver los movimientos de este concepto"
                    >
                      <td className="p-3 font-mono font-semibold text-slate-800">
                        {fila.vigencia}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            fila.tipo_retencion === "RENTA"
                              ? "bg-blue-100 text-blue-800"
                              : fila.tipo_retencion === "IVA"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {fila.tipo_retencion}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] font-semibold text-slate-600">
                        {fila.tipo_operacion === "PRACTICADA_A_PROVEEDOR"
                          ? "Practicada a Proveedor"
                          : "Efectuada por Cliente"}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        {fila.concepto}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-700">
                        {formatearTarifa(fila.porcentaje, fila.tipo_retencion)}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {fila.cantidad_movimientos}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-800">
                        {fmt(fila.base_gravable_total)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-700">
                        {fmt(valorRetencionAplicado(fila.valor_retencion_total))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-bold text-xs">
                <tr>
                  <td colSpan={6} className="p-3 uppercase">
                    Total General
                  </td>
                  <td className="p-3 text-right font-mono">
                    {fmt(totales.base)}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-400">
                    {fmt(totales.retencionMostrada)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Detalle de movimientos al seleccionar un concepto o activar "Ver movimientos detalle" */}
      {movimientosDetalleVisibles.length > 0 && (
        <div className="bg-white border rounded-xl shadow-2xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-100 border-b flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700 uppercase">
              {conceptoSeleccionadoObj
                ? `Movimientos del concepto: ${conceptoSeleccionadoObj.concepto} (${movimientosDetalleVisibles.length})`
                : `Detalle de Movimientos (${movimientosDetalleVisibles.length})`}
            </span>
            {claveConceptoSeleccionado && (
              <button
                type="button"
                onClick={() => setClaveConceptoSeleccionado(null)}
                className="text-indigo-600 hover:underline font-semibold cursor-pointer"
              >
                Quitar selección de concepto
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b uppercase sticky top-0">
                <tr>
                  <th className="p-2.5">Fecha</th>
                  <th className="p-2.5">Documento Origen</th>
                  <th className="p-2.5">Tercero</th>
                  <th className="p-2.5">Impuesto</th>
                  <th className="p-2.5">Concepto</th>
                  <th className="p-2.5 text-right">Base</th>
                  <th className="p-2.5 text-center">Tarifa</th>
                  <th className="p-2.5 text-right">Valor Retención</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movimientosDetalleVisibles.map((mov) => {
                  const ter = mapaTerceros.get(String(mov.tercero_id));
                  const pct = Number(
                    mov.porcentaje ?? mov.conceptos_retencion?.tarifa ?? 0
                  );
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-slate-700">
                        {mov.fecha_contable}
                      </td>
                      <td className="p-2.5 font-mono font-semibold text-slate-900">
                        {mov.documento_origen}
                      </td>
                      <td className="p-2.5 text-slate-800">
                        {ter
                          ? obtenerNombreTercero(ter)
                          : `Tercero #${mov.tercero_id}`}
                      </td>
                      <td className="p-2.5 font-bold text-slate-700">
                        {mov.tipo_retencion}
                      </td>
                      <td className="p-2.5 text-slate-800">
                        {mov.conceptos_retencion?.concepto ||
                          "Sin concepto parametrizado"}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {fmt(mov.base_gravable)}
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        {formatearTarifa(pct, mov.tipo_retencion)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-indigo-700">
                        {fmt(valorRetencionAplicado(mov.valor_retencion))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}