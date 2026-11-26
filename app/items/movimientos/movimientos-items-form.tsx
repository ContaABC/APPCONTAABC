"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
  setEmpresaActivaUsuario,
  setSucursalActivaUsuario,
} from "@/app/actions/accionesEmpresas";
import {
  obtenerCatalogoItemsFiltro,
  consultarMovimientosAcumuladosItems,
  ItemFiltro,
  AcumuladoItem,
} from "./actions";

export interface Empresa {
  id: number | string;
  razon_social: string;
}

export interface Sucursal {
  id: number | string;
  empresa_id: number | string;
  nombre_sucursal?: string;
  codigo_sucursal?: string;
  nombre?: string;
}

interface ResumenAcumulado {
  total_items: number;
  total_movimientos: number;
  cantidad_total: number;
  subtotal_total: number;
  iva_total: number;
  total_general: number;
  movimientos_verificados_ok: number;
  movimientos_con_diferencia: number;
}

interface MovimientosItemsFormProps {
  empresasIniciales: Empresa[];
  empresaActivaCookie?: string;
  sucursalesIniciales?: Sucursal[];
  sucursalActivaInicial?: string;
  itemsCatalogoIniciales?: ItemFiltro[];
}

const RESUMEN_VACIO: ResumenAcumulado = {
  total_items: 0,
  total_movimientos: 0,
  cantidad_total: 0,
  subtotal_total: 0,
  iva_total: 0,
  total_general: 0,
  movimientos_verificados_ok: 0,
  movimientos_con_diferencia: 0,
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
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=86400; SameSite=Lax`;
}

function clearCookieValue(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
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

export default function MovimientosItemsForm({
  empresasIniciales,
  empresaActivaCookie,
  sucursalesIniciales = [],
  sucursalActivaInicial = "",
  itemsCatalogoIniciales = [],
}: MovimientosItemsFormProps) {
  const [isMounted, setIsMounted] = useState(false);
  const usuarioIdRef = useRef<string | null>(null);
  const primeraCargaRef = useRef<boolean>(true);

  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(
    !empresasIniciales || empresasIniciales.length === 0
  );
  const [loadingConsulta, setLoadingConsulta] = useState<boolean>(false);
  const [consultado, setConsultado] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [empresas, setEmpresas] = useState<Empresa[]>(empresasIniciales || []);
  const [empresaId, setEmpresaId] = useState<string>(empresaActivaCookie || "");
  const [sucursales, setSucursales] = useState<Sucursal[]>(sucursalesIniciales);
  const [sucursalId, setSucursalId] = useState<string>(
    sucursalActivaInicial || ""
  );

  const [catalogoItems, setCatalogoItems] = useState<ItemFiltro[]>(
    itemsCatalogoIniciales
  );
  const [itemId, setItemId] = useState<string>("");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [soloConDiferencias, setSoloConDiferencias] = useState<boolean>(false);

  const [acumulados, setAcumulados] = useState<AcumuladoItem[]>([]);
  const [resumen, setResumen] = useState<ResumenAcumulado>(RESUMEN_VACIO);
  const [itemSeleccionadoDetalle, setItemSeleccionadoDetalle] =
    useState<AcumuladoItem | null>(null);

  const ejecutarConsulta = useCallback(
    async (
      empTarget: string,
      sucTarget: string,
      itmTarget: string,
      desdeTarget: string,
      hastaTarget: string
    ) => {
      if (!empTarget) {
        setAcumulados([]);
        setResumen(RESUMEN_VACIO);
        setItemSeleccionadoDetalle(null);
        setConsultado(true);
        return;
      }

      setLoadingConsulta(true);
      setErrorMsg(null);
      setConsultado(true);
      try {
        const res = await consultarMovimientosAcumuladosItems({
          empresaId: empTarget,
          sucursalId: sucTarget || null,
          itemId: itmTarget || null,
          fechaDesde: desdeTarget || null,
          fechaHasta: hastaTarget || null,
        });

        if (res.success) {
          setAcumulados(res.data || []);
          setResumen(res.resumen || RESUMEN_VACIO);
          setItemSeleccionadoDetalle((prev) =>
            prev
              ? (res.data || []).find(
                  (d) => d.clave_agrupacion === prev.clave_agrupacion
                ) || null
              : null
          );
        } else {
          setErrorMsg(
            res.error || "No se pudieron consultar los movimientos."
          );
          setAcumulados([]);
          setResumen(RESUMEN_VACIO);
        }
      } finally {
        setLoadingConsulta(false);
      }
    },
    []
  );

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

        let listaEmp: Empresa[] = Array.isArray(empresasIniciales)
          ? [...empresasIniciales]
          : [];
        if (listaEmp.length === 0) {
          const permitidas = await getEmpresasPermitidas(uid);
          listaEmp = Array.isArray(permitidas) ? permitidas : [];
        }

        if (listaEmp.length === 0) {
          setEmpresas([]);
          setEmpresaId("");
          setSucursales([]);
          setSucursalId("");
          setCatalogoItems([]);
          return;
        }

        const ordenadas = [...listaEmp].sort((a, b) =>
          (a.razon_social || "").localeCompare(b.razon_social || "", "es", {
            sensitivity: "base",
          })
        );
        setEmpresas(ordenadas);

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

        const empLocal =
          typeof window !== "undefined"
            ? localStorage.getItem("empresa_activa") ||
              localStorage.getItem("empresa_id")
            : null;
        const empCookie = getCookieValue("empresa_activa");

        const candidata =
          empBD || empresaActivaCookie || empLocal || empCookie;
        const empElegida = candidata
          ? ordenadas.find((e) => String(e.id) === String(candidata)) ||
            ordenadas[0]
          : ordenadas[0];

        const idEmpFinal = String(empElegida.id);
        setEmpresaId(idEmpFinal);

        if (typeof window !== "undefined") {
          localStorage.setItem("empresa_activa", idEmpFinal);
          localStorage.setItem("empresa_id", idEmpFinal);
          if (empElegida.razon_social) {
            localStorage.setItem(
              "empresa_activa_nombre",
              empElegida.razon_social
            );
          }
        }
        setCookieValue("empresa_activa", idEmpFinal);

        if (
          empresaActivaCookie &&
          idEmpFinal === String(empresaActivaCookie) &&
          sucursalesIniciales.length > 0 &&
          itemsCatalogoIniciales.length > 0
        ) {
          return;
        }

        const resSuc = await getSucursalesPermitidas(idEmpFinal, uid);
        const listaSuc: Sucursal[] = Array.isArray(resSuc) ? resSuc : [];
        setSucursales(listaSuc);

        let idSucFinal = "";
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

          const sucLocal =
            typeof window !== "undefined"
              ? localStorage.getItem("sucursal_activa") ||
                localStorage.getItem("sucursal_id")
              : null;
          const sucCookie = getCookieValue("sucursal_activa");
          const candidataSuc = sucBD || sucLocal || sucCookie;

          const sucElegida = candidataSuc
            ? listaSuc.find((s) => String(s.id) === String(candidataSuc)) ||
              listaSuc[0]
            : listaSuc[0];

          idSucFinal = String(sucElegida.id);
          setSucursalId(idSucFinal);
          if (typeof window !== "undefined") {
            localStorage.setItem("sucursal_activa", idSucFinal);
            localStorage.setItem("sucursal_id", idSucFinal);
          }
          setCookieValue("sucursal_activa", idSucFinal);
        }

        const catRes = await obtenerCatalogoItemsFiltro(
          idEmpFinal,
          idSucFinal || null
        );
        if (catRes.success) setCatalogoItems(catRes.data || []);
      } finally {
        setLoadingEmpresas(false);
      }
    }

    initContexto();
  }, [
    isMounted,
    empresasIniciales,
    empresaActivaCookie,
    sucursalesIniciales,
    itemsCatalogoIniciales,
  ]);

  const handleCambioEmpresa = async (nuevaEmp: string) => {
    setErrorMsg(null);
    setEmpresaId(nuevaEmp);
    setSucursalId("");
    setSucursales([]);
    setCatalogoItems([]);
    setItemId("");
    setItemSeleccionadoDetalle(null);
    setAcumulados([]);
    setResumen(RESUMEN_VACIO);
    setConsultado(false);

    if (typeof window !== "undefined") {
      if (nuevaEmp) {
        const empSel = empresas.find((e) => String(e.id) === String(nuevaEmp));
        localStorage.setItem("empresa_activa", nuevaEmp);
        localStorage.setItem("empresa_id", nuevaEmp);
        if (empSel?.razon_social) {
          localStorage.setItem("empresa_activa_nombre", empSel.razon_social);
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

    setEmpresaActivaUsuario(nuevaEmp, usuarioIdRef.current, null).catch(
      () => {}
    );

    const resSuc = await getSucursalesPermitidas(
      nuevaEmp,
      usuarioIdRef.current
    );
    const listaSuc: Sucursal[] = Array.isArray(resSuc) ? resSuc : [];
    setSucursales(listaSuc);

    let idSucNueva = "";
    if (listaSuc.length > 0) {
      idSucNueva = String(listaSuc[0].id);
      setSucursalId(idSucNueva);
      if (typeof window !== "undefined") {
        localStorage.setItem("sucursal_activa", idSucNueva);
        localStorage.setItem("sucursal_id", idSucNueva);
        const nomSuc = listaSuc[0].nombre_sucursal || listaSuc[0].nombre || "";
        if (nomSuc) {
          localStorage.setItem("sucursal_activa_nombre", nomSuc);
        }
      }
      setCookieValue("sucursal_activa", idSucNueva);
      setSucursalActivaUsuario(idSucNueva, usuarioIdRef.current).catch(
        () => {}
      );
    }

    const catRes = await obtenerCatalogoItemsFiltro(
      nuevaEmp,
      idSucNueva || null
    );
    if (catRes.success) setCatalogoItems(catRes.data || []);
  };

  const handleCambioSucursal = async (nuevaSuc: string) => {
    setErrorMsg(null);
    setSucursalId(nuevaSuc);
    setItemId("");
    setItemSeleccionadoDetalle(null);

    if (typeof window !== "undefined") {
      if (nuevaSuc) {
        const sucSel = sucursales.find(
          (s) => String(s.id) === String(nuevaSuc)
        );
        localStorage.setItem("sucursal_activa", nuevaSuc);
        localStorage.setItem("sucursal_id", nuevaSuc);
        const nomSuc = sucSel?.nombre_sucursal || sucSel?.nombre || "";
        if (nomSuc) {
          localStorage.setItem("sucursal_activa_nombre", nomSuc);
        }
        setCookieValue("sucursal_activa", nuevaSuc);
      } else {
        localStorage.removeItem("sucursal_activa");
        localStorage.removeItem("sucursal_id");
        localStorage.removeItem("sucursal_activa_nombre");
        clearCookieValue("sucursal_activa");
      }
    }

    setSucursalActivaUsuario(nuevaSuc || null, usuarioIdRef.current).catch(
      () => {}
    );

    const catRes = await obtenerCatalogoItemsFiltro(
      empresaId,
      nuevaSuc || null
    );
    if (catRes.success) setCatalogoItems(catRes.data || []);
  };

  const handleCambioItem = async (nuevoItemId: string) => {
    setItemId(nuevoItemId);
    setItemSeleccionadoDetalle(null);

    if (!empresaId) return;

    await ejecutarConsulta(
      empresaId,
      sucursalId,
      nuevoItemId,
      fechaDesde,
      fechaHasta
    );
  };

  const filasVisibles = soloConDiferencias
    ? acumulados.filter((a) => !a.verificado_ok)
    : acumulados;

  const handleExportarExcel = () => {
    if (!filasVisibles.length) return;

    const empObj = empresas.find((e) => String(e.id) === String(empresaId));
    const sucObj = sucursales.find((s) => String(s.id) === String(sucursalId));
    const nombreEmpresa = empObj?.razon_social || empresaId || "Empresa";
    const nombreSucursal = sucursalId
      ? sucObj?.nombre_sucursal || sucObj?.nombre || `Sucursal ${sucursalId}`
      : "Todas las sucursales";

    const wb = XLSX.utils.book_new();

    // Hoja 1: Acumulado por Ítem
    const encabezadoAcumulado: (string | number)[][] = [
      ["MOVIMIENTOS ACUMULADOS POR ÍTEMS Y VERIFICACIÓN"],
      ["Empresa:", nombreEmpresa],
      ["Sucursal:", nombreSucursal],
      ["Periodo:", `${fechaDesde || "Inicio"} a ${fechaHasta || "Actual"}`],
      [],
      [
        "Código",
        "Ítem",
        "Movimientos",
        "Cantidad Total",
        "Subtotal",
        "IVA",
        "Total",
        "Estado Verificación",
        "Detalle Verificación",
      ],
    ];

    const filasAcumulado = filasVisibles.map((f) => [
      f.codigo_ref,
      f.nombre_item,
      Number(f.num_movimientos || 0),
      Number(f.cantidad_total || 0),
      Number(f.subtotal_total || 0),
      Number(f.iva_total || 0),
      Number(f.total_general || 0),
      f.verificado_ok ? "VERIFICADO OK" : "CON DIFERENCIA",
      f.detalle_verificacion,
    ]);

    const wsAcumulado = XLSX.utils.aoa_to_sheet([
      ...encabezadoAcumulado,
      ...filasAcumulado,
    ]);
    wsAcumulado["!cols"] = [
      { wch: 15 },
      { wch: 36 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 20 },
      { wch: 36 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAcumulado, "Acumulado por Ítem");

    // Hoja 2: Detalle de Movimientos
    const origenDetalle = itemSeleccionadoDetalle
      ? [itemSeleccionadoDetalle]
      : filasVisibles;

    const movimientosExportar = origenDetalle.flatMap((grupo) =>
      soloConDiferencias
        ? grupo.movimientos.filter((m) => !m.verificado)
        : grupo.movimientos
    );

    const encabezadoDetalle: (string | number)[][] = [
      ["DETALLE DE MOVIMIENTOS Y DIAGNÓSTICO DE CUADRE"],
      ["Empresa:", nombreEmpresa],
      ["Sucursal:", nombreSucursal],
      [
        "Alcance:",
        itemSeleccionadoDetalle
          ? `Ítem: ${itemSeleccionadoDetalle.nombre_item}`
          : "Todos los ítems consultados",
      ],
      [],
      [
        "Fecha",
        "Factura",
        "Código Ref.",
        "Ítem",
        "Cantidad",
        "Valor Unitario",
        "Subtotal",
        "% IVA",
        "Valor IVA",
        "Total",
        "Verificación",
        "Diagnóstico",
      ],
    ];

    const filasDetalle = movimientosExportar.map((m) => [
      m.fecha_movimiento,
      m.numero_factura,
      m.codigo_ref,
      m.nombre_item,
      Number(m.cantidad || 0),
      Number(m.valor_unitario || 0),
      Number(m.subtotal || 0),
      Number(m.porcentaje_iva || 0),
      Number(m.valor_iva || 0),
      Number(m.total || 0),
      m.verificado ? "OK" : "DIFERENCIA",
      m.observacion_verificacion,
    ]);

    const wsDetalle = XLSX.utils.aoa_to_sheet([
      ...encabezadoDetalle,
      ...filasDetalle,
    ]);
    wsDetalle["!cols"] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 15 },
      { wch: 34 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 42 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle Movimientos");

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `movimientos_items_${fechaArchivo}.xlsx`);
  };

  if (!isMounted) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-slate-100 rounded-xl"></div>
        <div className="h-48 bg-slate-100 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* FILTROS EN SOLO 2 LÍNEAS */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        {/* Línea 1: Empresa y Sucursal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Empresa *
            </label>
            <select
              value={empresaId}
              onChange={(e) => handleCambioEmpresa(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              {loadingEmpresas ? (
                <option value="">-- Cargando empresas --</option>
              ) : (
                <>
                  <option value="">-- Seleccione Empresa --</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.razon_social}
                    </option>
                  ))}
                </>
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
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">
                {empresaId
                  ? "-- Todas las sucursales --"
                  : "-- Primero seleccione Empresa --"}
              </option>
              {sucursales.map((suc) => (
                <option key={suc.id} value={suc.id}>
                  {suc.nombre_sucursal || suc.nombre || `Sucursal ${suc.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Línea 2: Ítem, Periodo Desde, Periodo Hasta y Verificación unificada */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-5">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Ítem
            </label>
            <select
              value={itemId}
              disabled={!empresaId}
              onChange={(e) => handleCambioItem(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">-- Todos los ítems --</option>
              {catalogoItems.map((itm) => (
                <option key={itm.id} value={itm.id}>
                  {itm.codigo ? `[${itm.codigo}] ` : ""}
                  {itm.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Periodo Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Periodo Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="lg:col-span-3 flex flex-col justify-end">
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
              <input
                type="checkbox"
                checked={soloConDiferencias}
                onChange={(e) => setSoloConDiferencias(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-blue-600 focus:ring-blue-500 shrink-0"
              />
              <span className="truncate">Solo diferencias</span>
              {consultado && (
                <span className="ml-auto flex items-center gap-1 shrink-0">
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {resumen.movimientos_verificados_ok} OK
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${
                      resumen.movimientos_con_diferencia > 0
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    {resumen.movimientos_con_diferencia} Dif.
                  </span>
                </span>
              )}
            </label>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* TABLA DE ACUMULADOS POR ÍTEM */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50/70 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Acumulado por Ítem
            </h2>
            <p className="text-xs text-slate-500">
              Haga clic en un ítem para inspeccionar y verificar cada
              movimiento individual.
            </p>
          </div>

          {consultado && filasVisibles.length > 0 && (
            <button
              type="button"
              onClick={handleExportarExcel}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer flex items-center gap-1.5"
            >
              <span>📊</span>
              <span>Exportar Excel (.xlsx)</span>
            </button>
          )}
        </div>

        {!consultado ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Cambie el selector de <strong>Ítem</strong> para consultar los
            movimientos acumulados.
          </div>
        ) : loadingConsulta ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Consultando movimientos y verificando cálculos...
          </div>
        ) : filasVisibles.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No se encontraron movimientos para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Ítem</th>
                  <th className="p-3 text-center">Movs.</th>
                  <th className="p-3 text-right">Cant. Total</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-right">IVA</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-center">Verificación</th>
                  <th className="p-3 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filasVisibles.map((fila) => {
                  const estaSeleccionado =
                    itemSeleccionadoDetalle?.clave_agrupacion ===
                    fila.clave_agrupacion;

                  return (
                    <tr
                      key={fila.clave_agrupacion}
                      onClick={() =>
                        setItemSeleccionadoDetalle(
                          estaSeleccionado ? null : fila
                        )
                      }
                      className={`transition cursor-pointer ${
                        estaSeleccionado
                          ? "bg-blue-50/70"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="p-3 font-semibold text-slate-900">
                        {fila.codigo_ref}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {fila.nombre_item}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {fila.num_movimientos}
                      </td>
                      <td className="p-3 text-right font-mono font-medium">
                        {fila.cantidad_total.toLocaleString("es-CO", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 text-right font-mono">
                        $
                        {fila.subtotal_total.toLocaleString("es-CO", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 text-right font-mono">
                        $
                        {fila.iva_total.toLocaleString("es-CO", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        $
                        {fila.total_general.toLocaleString("es-CO", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          title={fila.detalle_verificacion}
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                            fila.verificado_ok
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {fila.verificado_ok
                            ? "VERIFICADO OK"
                            : `${fila.movimientos_con_diferencia} DIFERENCIA`}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemSeleccionadoDetalle(
                              estaSeleccionado ? null : fila
                            );
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
                        >
                          {estaSeleccionado ? "Ocultar" : "Ver movs."}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PANEL DE VERIFICACIÓN DETALLADA DE MOVIMIENTOS DEL ÍTEM SELECCIONADO */}
      {itemSeleccionadoDetalle && (
        <div className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b bg-blue-50/60 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Verificación de Movimientos:{" "}
                {itemSeleccionadoDetalle.nombre_item}{" "}
                <span className="text-xs font-normal text-slate-500">
                  ({itemSeleccionadoDetalle.codigo_ref})
                </span>
              </h3>
              <p className="text-xs text-slate-600">
                {itemSeleccionadoDetalle.detalle_verificacion}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setItemSeleccionadoDetalle(null)}
              className="text-slate-500 hover:text-slate-800 text-sm font-bold px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Factura</th>
                  <th className="p-3 text-right">Cant.</th>
                  <th className="p-3 text-right">V. Unitario</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-center">% IVA</th>
                  <th className="p-3 text-right">V. IVA</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3">Diagnóstico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemSeleccionadoDetalle.movimientos.map((m) => (
                  <tr
                    key={m.id}
                    className={
                      m.verificado ? "hover:bg-slate-50" : "bg-rose-50/40"
                    }
                  >
                    <td className="p-3 font-mono">{m.fecha_movimiento}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      {m.numero_factura}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {m.cantidad.toLocaleString("es-CO", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 text-right font-mono">
                      $
                      {m.valor_unitario.toLocaleString("es-CO", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 text-right font-mono">
                      $
                      {m.subtotal.toLocaleString("es-CO", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 text-center">{m.porcentaje_iva}%</td>
                    <td className="p-3 text-right font-mono">
                      $
                      {m.valor_iva.toLocaleString("es-CO", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      $
                      {m.total.toLocaleString("es-CO", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          m.verificado
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {m.observacion_verificacion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}