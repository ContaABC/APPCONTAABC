"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  obtenerEmpresas,
  obtenerSucursales,
  obtenerFacturasRecibidas,
  obtenerAsientoPorFactura,
} from "./actions-facturas";

interface Empresa {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
  nit?: string;
  numero_identificacion?: string;
}

interface Sucursal {
  id: number | string;
  nombre: string;
  codigo?: string;
}

interface FacturaItem {
  id: string | number;
  numero_factura?: string;
  tercero_nit?: string;
  tercero_nombre?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  subtotal?: number;
  impuestos?: number;
  valor_retencion_renta?: number;
  retencion_renta?: number;
  valor_retencion_iva?: number;
  retencion_iva?: number;
  valor_retencion_ica?: number;
  retencion_ica?: number;
  total_factura?: number;
  saldo_pendiente?: number;
  estado_pago?: string;
  estado_dian?: string;
  cufe_cude?: string;
}

interface GrupoProveedor {
  proveedor: string;
  nit: string;
  items: FacturaItem[];
  subtotalBase: number;
  subtotalIva: number;
  subtotalRenta: number;
  subtotalIvaRet: number;
  subtotalIca: number;
  subtotalTotal: number;
}

interface ConceptoAuxiliar {
  codigo_auxiliar?: string;
  nombre?: string;
}

interface AsientoDetalle {
  id: number | string;
  concepto_auxiliar_id: number | string;
  debito: number;
  credito: number;
  conceptos_auxiliares?: ConceptoAuxiliar[] | ConceptoAuxiliar | null;
}

interface AsientoData {
  transaccion: {
    numero_documento: string;
    fecha_emision: string;
    fecha_contable?: string;
    fecha?: string;
    glosa_concepto: string;
  };
  detalles: AsientoDetalle[];
}

export default function ConsultarFacturasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  const [facturas, setFacturas] = useState<FacturaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState<string>("");
  const [estadoPago, setEstadoPago] = useState<string>("todos");
  const [mostrarSubtotales, setMostrarSubtotales] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Control de acordeón
  const [proveedoresExpandidos, setProveedoresExpandidos] = useState<{ [key: string]: boolean }>({});

  // Modal para ver Asiento
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaItem | null>(null);
  const [asiento, setAsiento] = useState<AsientoData | null>(null);
  const [loadingAsiento, setLoadingAsiento] = useState<boolean>(false);

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

  // 3. Cargar Facturas de Empresa/Sucursal
  const cargarFacturas = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setErrorMsg(null);
    const res = await obtenerFacturasRecibidas(empresaId, sucursalId);
    if (res.success && res.data) {
      setFacturas(res.data);
      const initialExpanded: { [key: string]: boolean } = {};
      res.data.forEach((f: FacturaItem) => {
        const clave = f.tercero_nombre || f.tercero_nit || "Sin Proveedor";
        initialExpanded[clave] = true;
      });
      setProveedoresExpandidos(initialExpanded);
    } else {
      setErrorMsg(res.error || "Error al cargar facturas.");
    }
    setLoading(false);
  }, [empresaId, sucursalId]);

  useEffect(() => {
    setFacturas([]);
    setBusqueda("");
  }, [empresaId, sucursalId]);

  async function abrirAsiento(factura: FacturaItem) {
    setFacturaSeleccionada(factura);
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

  // 4. Filtrado
  const facturasFiltradas = useMemo(() => {
    if (facturas.length === 0) return [];

    return facturas.filter((f) => {
      const estadoF = (f.estado_pago || "pendiente").toLowerCase();
      
      if (estadoPago !== "todos") {
        if (estadoPago === "pendiente" && !estadoF.includes("pendiente")) return false;
        if (estadoPago === "parcial" && !estadoF.includes("parcial")) return false;
        if (estadoPago === "pagado" && estadoF !== "pagado" && estadoF !== "pagada") return false;
      }

      const term = busqueda.toLowerCase().trim();
      if (!term) return true;

      return (
        f.numero_factura?.toLowerCase().includes(term) ||
        f.tercero_nombre?.toLowerCase().includes(term) ||
        f.tercero_nit?.includes(term) ||
        f.cufe_cude?.toLowerCase().includes(term)
      );
    });
  }, [facturas, busqueda, estadoPago]);

  // 5. Agrupar, Ordenar por Proveedor y Subtotalizar
  const { gruposPorProveedor, totalesGenerales } = useMemo(() => {
    const grupos: { [key: string]: GrupoProveedor } = {};

    let totalBaseGen = 0;
    let totalIvaGen = 0;
    let totalRentaGen = 0;
    let totalIvaRetGen = 0;
    let totalIcaGen = 0;
    let totalTotalGen = 0;

    facturasFiltradas.forEach((f) => {
      const clave = f.tercero_nombre || f.tercero_nit || "Sin Proveedor";
      if (!grupos[clave]) {
        grupos[clave] = {
          proveedor: clave,
          nit: f.tercero_nit || "",
          items: [],
          subtotalBase: 0,
          subtotalIva: 0,
          subtotalRenta: 0,
          subtotalIvaRet: 0,
          subtotalIca: 0,
          subtotalTotal: 0,
        };
      }

      const base = Number(f.subtotal || 0);
      const iva = Number(f.impuestos || 0);
      const renta = Number(f.valor_retencion_renta || f.retencion_renta || 0);
      const ivaRet = Number(f.valor_retencion_iva || f.retencion_iva || 0);
      const ica = Number(f.valor_retencion_ica || f.retencion_ica || 0);
      const total = Number(f.total_factura || 0);

      grupos[clave].items.push(f);
      grupos[clave].subtotalBase += base;
      grupos[clave].subtotalIva += iva;
      grupos[clave].subtotalRenta += renta;
      grupos[clave].subtotalIvaRet += ivaRet;
      grupos[clave].subtotalIca += ica;
      grupos[clave].subtotalTotal += total;

      totalBaseGen += base;
      totalIvaGen += iva;
      totalRentaGen += renta;
      totalIvaRetGen += ivaRet;
      totalIcaGen += ica;
      totalTotalGen += total;
    });

    const gruposOrdenados = Object.values(grupos).sort((a, b) =>
      a.proveedor.localeCompare(b.proveedor)
    );

    return {
      gruposPorProveedor: gruposOrdenados,
      totalesGenerales: {
        base: totalBaseGen,
        iva: totalIvaGen,
        renta: totalRentaGen,
        ivaRet: totalIvaRetGen,
        ica: totalIcaGen,
        total: totalTotalGen,
      },
    };
  }, [facturasFiltradas]);

  const toggleProveedor = (proveedor: string) => {
    setProveedoresExpandidos((prev) => ({
      ...prev,
      [proveedor]: !prev[proveedor],
    }));
  };

  const expandirTodo = (estado: boolean) => {
    const nuevoEstado: { [key: string]: boolean } = {};
    gruposPorProveedor.forEach((g) => {
      nuevoEstado[g.proveedor] = estado;
    });
    setProveedoresExpandidos(nuevoEstado);
  };

  // 6. Exportación a Excel
  const exportarAExcel = () => {
    const filasExcel: any[] = [];

    gruposPorProveedor.forEach((grupo) => {
      grupo.items.forEach((f) => {
        filasExcel.push({
          Proveedor: grupo.proveedor,
          NIT: grupo.nit,
          "N° Factura": f.numero_factura,
          "Fecha Emisión": f.fecha_emision,
          "Estado Pago": (f.estado_pago || "pendiente").toUpperCase(),
          Subtotal: Number(f.subtotal || 0),
          IVA: Number(f.impuestos || 0),
          "Ret. Renta": Number(f.valor_retencion_renta || f.retencion_renta || 0),
          "Ret. IVA": Number(f.valor_retencion_iva || f.retencion_iva || 0),
          "Ret. ICA": Number(f.valor_retencion_ica || f.retencion_ica || 0),
          "Total Factura": Number(f.total_factura || 0),
        });
      });

      if (mostrarSubtotales) {
        filasExcel.push({
          Proveedor: `SUBTOTAL (${grupo.proveedor})`,
          NIT: "",
          "N° Factura": "",
          "Fecha Emisión": "",
          "Estado Pago": "",
          Subtotal: grupo.subtotalBase,
          IVA: grupo.subtotalIva,
          "Ret. Renta": grupo.subtotalRenta,
          "Ret. IVA": grupo.subtotalIvaRet,
          "Ret. ICA": grupo.subtotalIca,
          "Total Factura": grupo.subtotalTotal,
        });
        filasExcel.push({});
      }
    });

    filasExcel.push({
      Proveedor: "TOTAL GENERAL",
      NIT: "",
      "N° Factura": "",
      "Fecha Emisión": "",
      "Estado Pago": "",
      Subtotal: totalesGenerales.base,
      IVA: totalesGenerales.iva,
      "Ret. Renta": totalesGenerales.renta,
      "Ret. IVA": totalesGenerales.ivaRet,
      "Ret. ICA": totalesGenerales.ica,
      "Total Factura": totalesGenerales.total,
    });

    const hoja = XLSX.utils.json_to_sheet(filasExcel);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Facturas");
    XLSX.writeFile(
      libro,
      `Reporte_Facturas_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="p-2 max-w-[99%] mx-auto space-y-1.5 text-[11px]">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 border-b border-slate-200 pb-1">
        <div>
          <h1 className="text-xs font-bold text-slate-800 tracking-tight">Facturas Recibidas — Vista de Tarjetas Plegables</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {facturas.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => expandirTodo(true)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium rounded cursor-pointer"
              >
                📂 Expandir Todo
              </button>
              <button
                type="button"
                onClick={() => expandirTodo(false)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium rounded cursor-pointer"
              >
                📁 Contraer Todo
              </button>
            </>
          )}
          {facturas.length === 0 ? (
            <button
              type="button"
              onClick={cargarFacturas}
              disabled={loading}
              className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-medium rounded shadow-2xs transition cursor-pointer"
            >
              {loading ? "Cargando..." : "📥 Cargar Facturas"}
            </button>
          ) : (
            <button
              type="button"
              onClick={exportarAExcel}
              disabled={facturasFiltradas.length === 0}
              className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium rounded shadow-2xs transition flex items-center gap-1 cursor-pointer"
            >
              📊 Exportar Excel
            </button>
          )}
          <button
            type="button"
            onClick={cargarFacturas}
            disabled={loading}
            className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[10px] font-medium rounded transition cursor-pointer"
          >
            🔄 Recargar
          </button>
        </div>
      </div>

      {/* Selectores Contextuales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded border border-slate-200">
        <div className="flex items-center gap-2">
          <label className="text-[9px] font-bold text-slate-500 uppercase whitespace-nowrap">Empresa:</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500 h-6"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial || emp.nombre} ({emp.nit || emp.numero_identificacion || ""})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[9px] font-bold text-slate-500 uppercase whitespace-nowrap">Sucursal:</label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500 h-6"
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

      {/* Búsqueda, Filtro y Subtotales */}
      <div className="flex flex-col lg:flex-row items-center gap-2 bg-white p-1 rounded border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 w-full flex-1 px-1">
          <span className="text-slate-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Buscar por Proveedor, NIT, N° Factura..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full text-[11px] outline-none bg-transparent text-slate-700 h-5"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto border-t lg:border-t-0 pt-1 lg:pt-0 border-slate-100">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Estado:</span>
            <select
              value={estadoPago}
              onChange={(e) => setEstadoPago(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-700 font-medium outline-none h-6"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente por Pagar</option>
              <option value="parcial">Pagadas Parcial</option>
              <option value="pagado">Pagadas</option>
            </select>
          </div>

          <label className="flex items-center gap-1 text-[10px] font-medium text-slate-700 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200 transition h-6">
            <input
              type="checkbox"
              checked={mostrarSubtotales}
              onChange={(e) => setMostrarSubtotales(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-3 w-3"
            />
            <span>Subtotales</span>
          </label>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-[10px]">
          {errorMsg}
        </div>
      )}

      {/* Contenedor de Tarjetas / Acordeones por Proveedor */}
      <div className="space-y-1.5 max-h-[73vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-[11px]">Cargando facturas...</div>
        ) : facturas.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-[11px] space-y-1">
            <p>Haz clic en el botón de carga para listar las facturas.</p>
            <button
              type="button"
              onClick={cargarFacturas}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded text-[10px] cursor-pointer"
            >
              Cargar Facturas Ahora
            </button>
          </div>
        ) : gruposPorProveedor.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-[11px]">
            No se encontraron facturas con los filtros aplicados.
          </div>
        ) : (
          gruposPorProveedor.map((grupo) => {
            const isExpanded = !!proveedoresExpandidos[grupo.proveedor];

            return (
              <div key={grupo.proveedor} className="border border-slate-200 rounded bg-white shadow-2xs overflow-hidden">
                {/* Cabecera Tarjeta / Acordeón */}
                <div
                  onClick={() => toggleProveedor(grupo.proveedor)}
                  className="bg-slate-100 hover:bg-slate-100/80 px-2.5 py-1.5 flex items-center justify-between cursor-pointer select-none transition border-b border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold text-[10px]">{isExpanded ? "▼" : "▶"}</span>
                    <span className="font-bold text-slate-900 text-[11px]">
                      🏢 {grupo.proveedor}
                    </span>
                    {grupo.nit && (
                      <span className="text-slate-500 text-[10px]">({grupo.nit})</span>
                    )}
                    <span className="ml-1 px-1.5 py-0.1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[9px] font-semibold">
                      {grupo.items.length} {grupo.items.length === 1 ? "factura" : "facturas"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[10px]">
                    <span className="text-slate-500">Subtotal: <strong className="text-slate-800">${grupo.subtotalBase.toLocaleString("es-CO")}</strong></span>
                    <span className="text-slate-500">Total: <strong className="text-emerald-700 font-bold">${grupo.subtotalTotal.toLocaleString("es-CO")}</strong></span>
                  </div>
                </div>

                {/* Contenido / Tabla interna colapsable */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] text-slate-700 border-collapse whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                        <tr>
                          <th className="py-1 px-3">N° Factura</th>
                          <th className="py-1 px-3">Emisión</th>
                          <th className="py-1 px-3 text-right">Subtotal</th>
                          <th className="py-1 px-3 text-right">IVA</th>
                          <th className="py-1 px-3 text-right">Ret. Renta</th>
                          <th className="py-1 px-3 text-right">Ret. IVA</th>
                          <th className="py-1 px-3 text-right">Ret. ICA</th>
                          <th className="py-1 px-3 text-right">Total</th>
                          <th className="py-1 px-3 text-center">Estado</th>
                          <th className="py-1 px-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {grupo.items.map((f) => {
                          const rentaVal = Number(f.valor_retencion_renta || f.retencion_renta || 0);
                          const ivaRetVal = Number(f.valor_retencion_iva || f.retencion_iva || 0);
                          const icaVal = Number(f.valor_retencion_ica || f.retencion_ica || 0);

                          return (
                            <tr key={f.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-1 px-3 font-mono font-semibold text-slate-800">{f.numero_factura}</td>
                              <td className="py-1 px-3 font-mono text-slate-500">{f.fecha_emision}</td>
                              <td className="py-1 px-3 text-right font-mono text-slate-700">${Number(f.subtotal || 0).toLocaleString("es-CO")}</td>
                              <td className="py-1 px-3 text-right font-mono text-slate-700">${Number(f.impuestos || 0).toLocaleString("es-CO")}</td>
                              <td className={`py-1 px-3 text-right font-mono ${rentaVal > 0 ? "text-slate-700" : "text-slate-300"}`}>
                                ${rentaVal.toLocaleString("es-CO")}
                              </td>
                              <td className={`py-1 px-3 text-right font-mono ${ivaRetVal > 0 ? "text-slate-700" : "text-slate-300"}`}>
                                ${ivaRetVal.toLocaleString("es-CO")}
                              </td>
                              <td className={`py-1 px-3 text-right font-mono ${icaVal > 0 ? "text-slate-700" : "text-slate-300"}`}>
                                ${icaVal.toLocaleString("es-CO")}
                              </td>
                              <td className="py-1 px-3 text-right font-mono font-medium text-slate-900">${Number(f.total_factura || 0).toLocaleString("es-CO")}</td>
                              <td className="py-1 px-3 text-center">
                                <span
                                  className={`px-1.5 py-0.2 text-[8px] font-semibold rounded border ${
                                    (f.estado_pago || "").toLowerCase().includes("pagado") || (f.estado_pago || "").toLowerCase() === "pagada"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : (f.estado_pago || "").toLowerCase().includes("parcial")
                                      ? "bg-sky-50 text-sky-700 border-sky-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {(f.estado_pago || "Pendiente").toUpperCase()}
                                </span>
                              </td>
                              <td className="py-1 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => abrirAsiento(f)}
                                  className="px-1.5 py-0.2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-[9px] transition border border-slate-300 cursor-pointer"
                                >
                                  📖 Asiento
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
            );
          })
        )}
      </div>

      {/* Barra Inferior Fija Ultra Compacta */}
      {gruposPorProveedor.length > 0 && (
        <div className="bg-slate-900 text-white px-3 py-1.5 rounded flex flex-wrap items-center justify-between gap-2 shadow-md">
          <span className="uppercase tracking-wider text-[9px] font-bold text-slate-400">Total General:</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
            <span>Base: <strong className="text-slate-200">${totalesGenerales.base.toLocaleString("es-CO")}</strong></span>
            <span>IVA: <strong className="text-slate-200">${totalesGenerales.iva.toLocaleString("es-CO")}</strong></span>
            <span>Renta: <strong className="text-slate-300">${totalesGenerales.renta.toLocaleString("es-CO")}</strong></span>
            <span>Ret.IVA: <strong className="text-slate-300">${totalesGenerales.ivaRet.toLocaleString("es-CO")}</strong></span>
            <span>ICA: <strong className="text-slate-300">${totalesGenerales.ica.toLocaleString("es-CO")}</strong></span>
            <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              Total: <strong className="text-emerald-400 text-xs">${totalesGenerales.total.toLocaleString("es-CO")}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Modal de Asiento Contable */}
      {facturaSeleccionada && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 z-50">
          <div className="bg-white border border-slate-200 rounded shadow-xl max-w-md w-full p-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between border-b pb-1">
              <div>
                <h3 className="font-bold text-slate-800 text-xs">
                  Asiento Contable — Factura N° {facturaSeleccionada.numero_factura}
                </h3>
                <p className="text-[9px] text-slate-500">
                  Proveedor: {facturaSeleccionada.tercero_nombre} (NIT: {facturaSeleccionada.tercero_nit})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFacturaSeleccionada(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingAsiento ? (
              <div className="py-6 text-center text-slate-500 text-[10px]">Cargando partida doble...</div>
            ) : asiento ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded border border-slate-200 text-[10px]">
                  <div>
                    <span className="text-slate-400 block text-[8px]">Documento Interno:</span>
                    <strong className="text-indigo-600">{asiento.transaccion.numero_documento}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[8px]">Fecha Contable:</span>
                    <strong className="text-slate-700">{asiento.transaccion.fecha_contable || asiento.transaccion.fecha_emision}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[8px]">Glosa / Concepto:</span>
                    <span className="text-slate-700 italic">{asiento.transaccion.glosa_concepto}</span>
                  </div>
                </div>

                <table className="w-full text-left text-[10px] border-collapse border border-slate-200">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-1 border-r border-slate-200">Cuenta Auxiliar</th>
                      <th className="p-1 text-right border-r border-slate-200 w-20">Débito</th>
                      <th className="p-1 text-right w-20">Crédito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {asiento.detalles.map((d) => {
                      const conceptoAux = Array.isArray(d.conceptos_auxiliares)
                        ? d.conceptos_auxiliares[0]
                        : d.conceptos_auxiliares;

                      return (
                        <tr key={d.id}>
                          <td className="p-1 border-r border-slate-200">
                            <span className="font-mono text-slate-500 mr-1">
                              {conceptoAux?.codigo_auxiliar || `#${d.concepto_auxiliar_id}`}
                            </span>
                            <span className="font-medium text-slate-800">
                              {conceptoAux?.nombre || "Concepto Auxiliar"}
                            </span>
                          </td>
                          <td className="p-1 text-right font-mono border-r border-slate-200">{d.debito > 0 ? `$${d.debito.toLocaleString("es-CO")}` : "-"}</td>
                          <td className="p-1 text-right font-mono">{d.credito > 0 ? `$${d.credito.toLocaleString("es-CO")}` : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-4 text-center text-slate-400 text-[10px]">No se encontró asiento contable.</div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setFacturaSeleccionada(null)}
                className="px-2 py-1 bg-slate-800 text-white rounded text-[10px] font-medium hover:bg-slate-700 cursor-pointer"
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