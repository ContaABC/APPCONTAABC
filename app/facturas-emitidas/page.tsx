"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
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
  type Empresa,
  type Sucursal,
} from "@/app/actions/accionesEmpresas";
import {
  obtenerFacturasEmitidas,
  obtenerDetalleFacturaEmitida,
  obtenerAsientoPorFactura,
} from "./actions";

type EmpresaExtendida = Empresa & {
  nombre?: string;
  nombre_comercial?: string;
  nit?: string;
  nit_identificacion?: string;
  numero_identificacion?: string;
};

type SucursalExtendida = Sucursal & {
  codigo?: string;
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
  const nit = e.nit_identificacion || e.nit || e.numero_identificacion || "";
  return nit ? `${nombre} (${nit})` : nombre;
}

function obtenerNombreSucursal(suc: Sucursal): string {
  const s = suc as SucursalExtendida;
  const base = String(s.nombre || `Sucursal ${s.id}`);
  const cod = s.codigo || s.codigo_sucursal || "";
  return cod ? `${base} (${cod})` : base;
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

export default function ConsultarFacturasEmitidasPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const primeraCargaRef = useRef<boolean>(true);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true);

  // Selectores de Empresa y Sucursal
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  // Estado de Facturas y Filtros
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState<string>("");
  const [estadoPago, setEstadoPago] = useState<string>("todos");
  const [mostrarSubtotales, setMostrarSubtotales] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal para ver Asiento Contable
  const [facturaAsientoSeleccionada, setFacturaAsientoSeleccionada] = useState<any | null>(null);
  const [asiento, setAsiento] = useState<any | null>(null);
  const [loadingAsiento, setLoadingAsiento] = useState<boolean>(false);
  const [errorAsiento, setErrorAsiento] = useState<string | null>(null);

  // Modal para ver Detalle de Ítems
  const [facturaItemsSeleccionada, setFacturaItemsSeleccionada] = useState<any | null>(null);
  const [itemsFactura, setItemsFactura] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);
  const [errorItems, setErrorItems] = useState<string | null>(null);

  const cargarFacturas = useCallback(
    async (empTarget?: string, sucTarget?: string) => {
      const empId = empTarget ?? empresaId;
      const sucId = sucTarget ?? sucursalId;
      if (!empId) {
        setFacturas([]);
        return;
      }
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await obtenerFacturasEmitidas(empId, sucId || null);
        if (res.success) {
          setFacturas(res.data || []);
        } else {
          setErrorMsg(res.error);
          setFacturas([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [empresaId, sucursalId]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Cargar Empresas permitidas y contexto activo al montar
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

        await cargarFacturas(idEmpFinal, idSucFinal);
      } finally {
        setLoadingEmpresas(false);
      }
    }

    initContexto();
  }, [isMounted, cargarFacturas]);

  const handleCambioEmpresa = async (nuevaEmp: string) => {
    setEmpresaId(nuevaEmp);
    setSucursalId("");
    setSucursales([]);
    setFacturas([]);
    setErrorMsg(null);

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

    await cargarFacturas(nuevaEmp, "");
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
    await cargarFacturas(empresaId, nuevaSuc);
  };

  // Abrir Modal de Asiento Contable
  async function abrirAsiento(factura: any) {
    setFacturaAsientoSeleccionada(factura);
    setLoadingAsiento(true);
    setAsiento(null);
    setErrorAsiento(null);

    const res = await obtenerAsientoPorFactura(factura.id);
    if (res.success && res.data) {
      setAsiento(res.data);
    } else {
      setErrorAsiento(res.error || "No se pudo cargar el asiento contable.");
    }
    setLoadingAsiento(false);
  }

  // Abrir Modal de Detalle de Ítems
  async function abrirItems(factura: any) {
    setFacturaItemsSeleccionada(factura);
    setLoadingItems(true);
    setItemsFactura([]);
    setErrorItems(null);

    const res = await obtenerDetalleFacturaEmitida(factura.id);
    if (res.success) {
      setItemsFactura(res.data);
    } else {
      setErrorItems(res.error || "No se pudo cargar el detalle de los ítems.");
    }
    setLoadingItems(false);
  }

  // Filtrado (Búsqueda + Estado Pago)
  const facturasFiltradas = useMemo(() => {
    return facturas.filter((f) => {
      const estadoF = (f.estado_pago || "pendiente").toLowerCase();
      if (estadoPago !== "todos" && estadoF !== estadoPago.toLowerCase()) {
        return false;
      }

      const term = busqueda.toLowerCase().trim();
      if (!term) return true;

      return (
        f.numero_factura?.toLowerCase().includes(term) ||
        f.cliente_nombre?.toLowerCase().includes(term) ||
        f.cliente_nit?.includes(term) ||
        f.cufe?.toLowerCase().includes(term)
      );
    });
  }, [facturas, busqueda, estadoPago]);

  // Agrupar, Ordenar por Cliente y Subtotalizar
  const { gruposPorCliente, totalesGenerales } = useMemo(() => {
    const grupos: {
      [key: string]: {
        cliente: string;
        nit: string;
        items: any[];
        subtotalBase: number;
        subtotalIva: number;
        subtotalTotal: number;
      };
    } = {};

    let totalBaseGen = 0;
    let totalIvaGen = 0;
    let totalTotalGen = 0;

    facturasFiltradas.forEach((f) => {
      const clave = f.cliente_nombre || f.cliente_nit || "Sin Cliente";
      if (!grupos[clave]) {
        grupos[clave] = {
          cliente: clave,
          nit: f.cliente_nit || "",
          items: [],
          subtotalBase: 0,
          subtotalIva: 0,
          subtotalTotal: 0,
        };
      }

      const base = Number(f.subtotal || 0);
      const iva = Number(f.impuestos || 0);
      const total = Number(f.total_factura || 0);

      grupos[clave].items.push(f);
      grupos[clave].subtotalBase += base;
      grupos[clave].subtotalIva += iva;
      grupos[clave].subtotalTotal += total;

      totalBaseGen += base;
      totalIvaGen += iva;
      totalTotalGen += total;
    });

    const gruposOrdenados = Object.values(grupos).sort((a, b) =>
      a.cliente.localeCompare(b.cliente)
    );

    return {
      gruposPorCliente: gruposOrdenados,
      totalesGenerales: {
        base: totalBaseGen,
        iva: totalIvaGen,
        total: totalTotalGen,
      },
    };
  }, [facturasFiltradas]);

  // Exportación a Excel (.xlsx)
  const exportarAExcel = () => {
    const filasExcel: any[] = [];

    gruposPorCliente.forEach((grupo) => {
      grupo.items.forEach((f) => {
        filasExcel.push({
          Cliente: grupo.cliente,
          NIT: grupo.nit,
          "N° Factura": f.numero_factura,
          "Fecha Emisión": f.fecha_emision,
          CUFE: f.cufe,
          "URL PDF": f.pdf_url || "Sin PDF",
          "Estado Pago": (f.estado_pago || "pendiente").toUpperCase(),
          Subtotal: Number(f.subtotal || 0),
          IVA: Number(f.impuestos || 0),
          "Total Factura": Number(f.total_factura || 0),
        });
      });

      if (mostrarSubtotales) {
        filasExcel.push({
          Cliente: `SUBTOTAL (${grupo.cliente})`,
          NIT: "",
          "N° Factura": "",
          "Fecha Emisión": "",
          CUFE: "",
          "URL PDF": "",
          "Estado Pago": "",
          Subtotal: grupo.subtotalBase,
          IVA: grupo.subtotalIva,
          "Total Factura": grupo.subtotalTotal,
        });

        filasExcel.push({});
      }
    });

    filasExcel.push({
      Cliente: "TOTAL GENERAL",
      NIT: "",
      "N° Factura": "",
      "Fecha Emisión": "",
      CUFE: "",
      "URL PDF": "",
      "Estado Pago": "",
      Subtotal: totalesGenerales.base,
      IVA: totalesGenerales.iva,
      "Total Factura": totalesGenerales.total,
    });

    const hoja = XLSX.utils.json_to_sheet(filasExcel);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Facturas Emitidas");
    XLSX.writeFile(
      libro,
      `Reporte_Facturas_Emitidas_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  if (!isMounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-24 bg-slate-100 rounded-xl animate-pulse"></div>
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
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
            <h1 className="text-2xl font-bold text-slate-800">Facturas Emitidas</h1>
            <p className="text-sm text-slate-500">
              Consulta de facturas de venta emitidas, detalle de artículos, PDF del comprobante y auditoría contable.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Link
            href="/items/movimientos"
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-md transition"
          >
            📈 Mov. Acumulados Ítems
          </Link>
          <button
            type="button"
            onClick={exportarAExcel}
            disabled={facturasFiltradas.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            📊 Exportar a Excel
          </button>
          <button
            type="button"
            onClick={() => cargarFacturas(empresaId, sucursalId)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-md transition cursor-pointer"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Selectores Contextuales: Empresa y Sucursal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Empresa
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

      {/* Búsqueda, Filtro de Estado de Pago y Checkbox Subtotales */}
      <div className="flex flex-col lg:flex-row items-center gap-4 bg-white p-3 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2 w-full flex-1">
          <span className="text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Buscar por Cliente, NIT, N° Factura o CUFE..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full text-sm outline-none bg-transparent text-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Estado:</span>
            <select
              value={estadoPago}
              onChange={(e) => setEstadoPago(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-700 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todos">Todos los Estados</option>
              <option value="pendiente">Pendiente / Por Cobrar</option>
              <option value="pagada">Pagada</option>
              <option value="parcial">Abono Parcial</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 transition">
            <input
              type="checkbox"
              checked={mostrarSubtotales}
              onChange={(e) => setMostrarSubtotales(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <span>Mostrar Subtotales</span>
          </label>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      {/* Tabla de Facturas Emitidas */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Cargando facturas emitidas...</div>
        ) : gruposPorCliente.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No se encontraron facturas emitidas registradas para la selección actual.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">N° Factura</th>
                  <th className="p-3">Emisión</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-right">IVA</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-center">Estado Cobro</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gruposPorCliente.map((grupo) => (
                  <React.Fragment key={grupo.cliente}>
                    <tr className="bg-slate-100/80 border-t border-b border-slate-200">
                      <td colSpan={7} className="p-2.5 px-3 font-bold text-slate-800 text-xs">
                        👤 {grupo.cliente}{" "}
                        {grupo.nit && (
                          <span className="text-slate-500 font-normal ml-2">
                            (NIT / Cédula: {grupo.nit})
                          </span>
                        )}
                      </td>
                    </tr>

                    {grupo.items.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 pl-6 font-semibold text-slate-900">
                          {f.numero_factura}
                        </td>
                        <td className="p-3 whitespace-nowrap">{f.fecha_emision}</td>
                        <td className="p-3 text-right font-mono">
                          ${f.subtotal?.toLocaleString("es-CO")}
                        </td>
                        <td className="p-3 text-right font-mono">
                          ${f.impuestos?.toLocaleString("es-CO")}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          ${f.total_factura?.toLocaleString("es-CO")}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-1 text-[10px] font-semibold rounded-full border ${
                              (f.estado_pago || "pendiente").toLowerCase() === "pagada"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : (f.estado_pago || "pendiente").toLowerCase() === "parcial"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {(f.estado_pago || "Pendiente").toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {f.pdf_url ? (
                              <a
                                href={f.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded text-xs transition border border-red-200 flex items-center gap-1"
                                title="Ver comprobante en PDF"
                              >
                                📄 PDF
                              </a>
                            ) : (
                              <span
                                className="px-2.5 py-1 bg-slate-50 text-slate-400 font-normal rounded text-xs border border-slate-200 cursor-not-allowed"
                                title="Sin PDF adjunto"
                              >
                                📄 Sin PDF
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => abrirItems(f)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-xs transition border border-slate-300 flex items-center gap-1 cursor-pointer"
                              title="Ver detalle de ítems"
                            >
                              📦 Ítems
                            </button>

                            <button
                              type="button"
                              onClick={() => abrirAsiento(f)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded text-xs transition border border-indigo-200 flex items-center gap-1 cursor-pointer"
                              title="Ver asiento contable"
                            >
                              📖 Asiento
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {mostrarSubtotales && (
                      <tr className="bg-indigo-50/40 font-semibold text-slate-800 border-b-2 border-indigo-100">
                        <td colSpan={2} className="p-2.5 text-right font-bold text-indigo-900">
                          Subtotal {grupo.cliente}:
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          ${grupo.subtotalBase.toLocaleString("es-CO")}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          ${grupo.subtotalIva.toLocaleString("es-CO")}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-indigo-900">
                          ${grupo.subtotalTotal.toLocaleString("es-CO")}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>

              <tfoot className="bg-slate-900 text-white font-bold text-xs">
                <tr>
                  <td colSpan={2} className="p-3 text-right uppercase tracking-wider">
                    Total General:
                  </td>
                  <td className="p-3 text-right font-mono text-slate-200">
                    ${totalesGenerales.base.toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-200">
                    ${totalesGenerales.iva.toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-400 text-sm font-extrabold">
                    ${totalesGenerales.total.toLocaleString("es-CO")}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 📦 Modal de Detalle de Ítems */}
      {facturaItemsSeleccionada && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border rounded-xl shadow-2xl max-w-3xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Detalle de Ítems — Factura N° {facturaItemsSeleccionada.numero_factura}
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: {facturaItemsSeleccionada.cliente_nombre} (NIT/Cédula: {facturaItemsSeleccionada.cliente_nit})
                </p>
                {facturaItemsSeleccionada.cufe && (
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-xl mt-1">
                    CUFE: {facturaItemsSeleccionada.cufe}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFacturaItemsSeleccionada(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingItems ? (
              <div className="py-12 text-center text-slate-500 text-sm">Cargando productos / servicios...</div>
            ) : errorItems ? (
              <div className="py-8 text-center text-rose-600 text-sm">{errorItems}</div>
            ) : itemsFactura.length > 0 ? (
              <div className="overflow-x-auto space-y-3">
                <table className="w-full text-left text-xs border-collapse border">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="p-2 border-r">Cód. Ref</th>
                      <th className="p-2 border-r">Ítem / Descripción</th>
                      <th className="p-2 text-center border-r w-16">Cant.</th>
                      <th className="p-2 text-right border-r w-24">V. Unitario</th>
                      <th className="p-2 text-right border-r w-24">Subtotal</th>
                      <th className="p-2 text-right border-r w-20">IVA (%)</th>
                      <th className="p-2 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b">
                    {itemsFactura.map((it: any) => (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-slate-500 border-r">
                          {it.codigo_ref || "-"}
                        </td>
                        <td className="p-2 font-medium text-slate-800 border-r">
                          {it.nombre_item || "Producto / Servicio"}
                        </td>
                        <td className="p-2 text-center border-r font-mono">
                          {it.cantidad}
                        </td>
                        <td className="p-2 text-right font-mono border-r">
                          ${Number(it.valor_unitario || 0).toLocaleString("es-CO")}
                        </td>
                        <td className="p-2 text-right font-mono border-r">
                          ${Number(it.subtotal || 0).toLocaleString("es-CO")}
                        </td>
                        <td className="p-2 text-right font-mono border-r text-slate-500">
                          {it.porcentaje_iva ? `${it.porcentaje_iva}%` : "0%"}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          ${Number(it.total || 0).toLocaleString("es-CO")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold text-slate-800">
                    <tr>
                      <td colSpan={4} className="p-2 text-right border-r uppercase text-[10px] tracking-wider">
                        Totales del Comprobante:
                      </td>
                      <td className="p-2 text-right font-mono border-r text-slate-900">
                        $
                        {itemsFactura
                          .reduce((sum: number, it: any) => sum + Number(it.subtotal || 0), 0)
                          .toLocaleString("es-CO")}
                      </td>
                      <td className="p-2 text-right font-mono border-r text-slate-500">
                        $
                        {itemsFactura
                          .reduce((sum: number, it: any) => sum + Number(it.valor_iva || 0), 0)
                          .toLocaleString("es-CO")}
                      </td>
                      <td className="p-2 text-right font-mono text-emerald-700">
                        $
                        {itemsFactura
                          .reduce((sum: number, it: any) => sum + Number(it.total || 0), 0)
                          .toLocaleString("es-CO")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">
                No se encontraron ítems / productos registrados para esta factura.
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <div>
                {facturaItemsSeleccionada.pdf_url && (
                  <a
                    href={facturaItemsSeleccionada.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 transition flex items-center gap-1"
                  >
                    📄 Abrir Documento PDF
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFacturaItemsSeleccionada(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📖 Modal de Asiento Contable */}
      {facturaAsientoSeleccionada && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Asiento Contable — Factura N° {facturaAsientoSeleccionada.numero_factura}
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: {facturaAsientoSeleccionada.cliente_nombre} (NIT/Cédula: {facturaAsientoSeleccionada.cliente_nit})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFacturaAsientoSeleccionada(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingAsiento ? (
              <div className="py-12 text-center text-slate-500 text-sm">Cargando partida doble...</div>
            ) : errorAsiento ? (
              <div className="py-8 text-center text-rose-600 text-sm">{errorAsiento}</div>
            ) : asiento ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border text-xs">
                  <div>
                    <span className="text-slate-400 block">N° Documento Interno:</span>
                    <strong className="text-indigo-600 text-sm">
                      {asiento.transaccion.numero_documento}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Fecha Contable:</span>
                    <strong className="text-slate-700">{asiento.transaccion.fecha_emision}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Glosa / Concepto:</span>
                    <span className="text-slate-700 italic">{asiento.transaccion.glosa_concepto}</span>
                  </div>
                </div>

                <table className="w-full text-left text-xs border-collapse border">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="p-2 border-r">Concepto / Cuenta Auxiliar</th>
                      <th className="p-2 text-right border-r w-28">Débito</th>
                      <th className="p-2 text-right w-28">Crédito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b">
                    {asiento.detalles.map((d: any) => (
                      <tr key={d.id}>
                        <td className="p-2 border-r">
                          <span className="font-mono text-slate-500 mr-2">
                            {d.conceptos_auxiliares?.codigo_auxiliar || `#${d.concepto_auxiliar_id}`}
                          </span>
                          <span className="font-medium text-slate-800">
                            {d.conceptos_auxiliares?.nombre || "Concepto Auxiliar"}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono border-r">
                          {d.debito > 0 ? `$${d.debito.toLocaleString("es-CO")}` : "-"}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {d.credito > 0 ? `$${d.credito.toLocaleString("es-CO")}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold text-slate-800">
                    <tr>
                      <td className="p-2 text-right border-r uppercase text-[10px] tracking-wider">
                        Totales:
                      </td>
                      <td className="p-2 text-right font-mono border-r text-indigo-700">
                        $
                        {asiento.detalles
                          .reduce((sum: number, d: any) => sum + (d.debito || 0), 0)
                          .toLocaleString("es-CO")}
                      </td>
                      <td className="p-2 text-right font-mono text-indigo-700">
                        $
                        {asiento.detalles
                          .reduce((sum: number, d: any) => sum + (d.credito || 0), 0)
                          .toLocaleString("es-CO")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">
                No se encontró un asiento contable generado.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setFacturaAsientoSeleccionada(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}