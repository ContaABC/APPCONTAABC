"use client";

import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  obtenerEmpresas,
  obtenerSucursales,
  obtenerFacturasEmitidas,
  obtenerDetalleFacturaEmitida,
  obtenerAsientoPorFactura,
} from "./actions";

export default function ConsultarFacturasEmitidasPage() {
  // Selectores de Empresa y Sucursal
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  // Estado de Facturas y Filtros
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState<string>("");
  const [estadoPago, setEstadoPago] = useState<string>("todos");
  const [mostrarSubtotales, setMostrarSubtotales] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
 // const [pdfUrlGenerada, setPdfUrlGenerada] = useState<string | null>(null);

  // Modal para ver Asiento Contable
  const [facturaAsientoSeleccionada, setFacturaAsientoSeleccionada] = useState<any | null>(null);
  const [asiento, setAsiento] = useState<any | null>(null);
  const [loadingAsiento, setLoadingAsiento] = useState<boolean>(false);

  // Modal para ver Detalle de Ítems
  const [facturaItemsSeleccionada, setFacturaItemsSeleccionada] = useState<any | null>(null);
  const [itemsFactura, setItemsFactura] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);

  // 1. Cargar Empresas al montar
  useEffect(() => {
    async function cargarEmpresas() {
      const res = await obtenerEmpresas();
      if (res.success && res.data.length > 0) {
        setEmpresas(res.data);
        setEmpresaId(String(res.data[0].id));
      }
    }
    cargarEmpresas();
  }, []);

  // 2. Cargar Sucursales cuando cambia Empresa
  useEffect(() => {
    if (!empresaId) return;
    async function cargarSucursales() {
      setSucursalId("");
      const res = await obtenerSucursales(empresaId);
      if (res.success) {
        setSucursales(res.data);
      }
    }
    cargarSucursales();
  }, [empresaId]);

  // 3. Cargar Facturas Emitidas de Empresa/Sucursal
  useEffect(() => {
    if (empresaId) {
      cargarFacturas();
    }
  }, [empresaId, sucursalId]);

  async function cargarFacturas() {
    if (!empresaId) return;
    setLoading(true);
    setErrorMsg(null);
    const res = await obtenerFacturasEmitidas(empresaId, sucursalId);
    if (res.success) {
      setFacturas(res.data);
    } else {
      setErrorMsg(res.error);
    }
    setLoading(false);
  }

  // Abrir Modal de Asiento Contable
  async function abrirAsiento(factura: any) {
    setFacturaAsientoSeleccionada(factura);
    setLoadingAsiento(true);
    setAsiento(null);

    const res = await obtenerAsientoPorFactura(factura.id);
    if (res.success && res.data) {
      setAsiento(res.data);
    } else {
      alert(res.error || "No se pudo cargar el asiento contable.");
    }
    setLoadingAsiento(false);
  }

  // Abrir Modal de Detalle de Ítems
  async function abrirItems(factura: any) {
    setFacturaItemsSeleccionada(factura);
    setLoadingItems(true);
    setItemsFactura([]);

    const res = await obtenerDetalleFacturaEmitida(factura.id);
    if (res.success) {
      setItemsFactura(res.data);
    } else {
      alert(res.error || "No se pudo cargar el detalle de los ítems.");
    }
    setLoadingItems(false);
  }

  // 4. Filtrado (Búsqueda + Estado Pago)
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

  // 5. Agrupar, Ordenar por Cliente y Subtotalizar
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

  // 6. Exportación a Excel
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Facturas Emitidas</h1>
          <p className="text-sm text-slate-500">
            Consulta de facturas de venta emitidas, detalle de artículos, PDF del comprobante y auditoría contable.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={exportarAExcel}
            disabled={facturasFiltradas.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition shadow-sm flex items-center gap-2"
          >
            📊 Exportar a Excel
          </button>
          <button
            onClick={cargarFacturas}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-md transition"
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
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial || emp.nombre} ({emp.nit || emp.numero_identificacion || ""})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Sucursal
          </label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.nombre} {suc.codigo ? `(${suc.codigo})` : ""}
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
                              onClick={() => abrirItems(f)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-xs transition border border-slate-300 flex items-center gap-1"
                              title="Ver detalle de ítems"
                            >
                              📦 Ítems
                            </button>

                            <button
                              onClick={() => abrirAsiento(f)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded text-xs transition border border-indigo-200 flex items-center gap-1"
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
                onClick={() => setFacturaItemsSeleccionada(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {loadingItems ? (
              <div className="py-12 text-center text-slate-500 text-sm">Cargando productos / servicios...</div>
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
                onClick={() => setFacturaItemsSeleccionada(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-700"
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
                onClick={() => setFacturaAsientoSeleccionada(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {loadingAsiento ? (
              <div className="py-12 text-center text-slate-500 text-sm">Cargando partida doble...</div>
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
                onClick={() => setFacturaAsientoSeleccionada(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-700"
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