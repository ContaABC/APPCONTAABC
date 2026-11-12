"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  obtenerEmpresas,
  obtenerSucursales,
  obtenerNotasEmitidas,
  obtenerAsientoPorNota,
} from "./consultar-actions";

export default function ConsultarNotasEmitidasPage() {
  const [isMounted, setIsMounted] = useState(false);

  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState<string>("");
  const [tipoNotaFiltro, setTipoNotaFiltro] = useState<string>("TODOS");
  const [mostrarSubtotales, setMostrarSubtotales] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [notaAsientoSeleccionada, setNotaAsientoSeleccionada] = useState<any | null>(null);
  const [asiento, setAsiento] = useState<any | null>(null);
  const [loadingAsiento, setLoadingAsiento] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    // Leer cookie inicial de empresa activa si existe en el navegador
    const match = document.cookie.match(new RegExp('(^| )empresa_activa=([^;]+)'));
    if (match) {
      setEmpresaId(match[2]);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    async function cargarEmpresasAction() {
      const res = await obtenerEmpresas();
      if (res.success && res.data.length > 0) {
        setEmpresas(res.data);
        // Si no había cookie activa, seleccionamos la primera por defecto
        if (!empresaId) {
          setEmpresaId(String(res.data[0].id));
        }
      }
    }
    cargarEmpresasAction();
  }, [isMounted]);

  useEffect(() => {
    if (!empresaId || !isMounted) return;
    async function cargarSucursalesAction() {
      setSucursalId("");
      const res = await obtenerSucursales(empresaId);
      if (res.success) {
        setSucursales(res.data);
      }
    }
    cargarSucursalesAction();
  }, [empresaId, isMounted]);

  useEffect(() => {
    if (empresaId && isMounted) {
      cargarNotas();
    }
  }, [empresaId, sucursalId, isMounted]);

  // Manejar cambio de empresa sincronizando Cookie y LocalStorage
  const handleCambioEmpresa = (nuevoEmpresaId: string) => {
    setEmpresaId(nuevoEmpresaId);
    setSucursalId("");
    if (nuevoEmpresaId) {
      localStorage.setItem("empresa_activa", nuevoEmpresaId);
      document.cookie = `empresa_activa=${nuevoEmpresaId}; path=/; max-age=86400; SameSite=Lax`;
    }
  };

  async function cargarNotas() {
    if (!empresaId) return;
    setLoading(true);
    setErrorMsg(null);
    const res = await obtenerNotasEmitidas(empresaId, sucursalId);
    if (res.success) {
      setNotas(res.data);
    } else {
      setErrorMsg(res.error);
    }
    setLoading(false);
  }

  async function abrirAsiento(nota: any) {
    setNotaAsientoSeleccionada(nota);
    setLoadingAsiento(true);
    setAsiento(null);

    const res = await obtenerAsientoPorNota(nota.id);
    if (res.success && res.data) {
      setAsiento(res.data);
    } else {
      alert(res.error || "No se pudo cargar el asiento contable.");
    }
    setLoadingAsiento(false);
  }

  const esNotaAnulada = (nota: any) => {
    const estadoNota = String(nota.estado || nota.estado_nota || "").toUpperCase();
    const textoNota = `${nota.concepto || ""} ${nota.motivo || ""} ${nota.observaciones || ""} ${nota.descripcion || ""} ${nota.tipo_operacion || ""}`.toUpperCase();

    return (
      estadoNota.includes("ANUL") ||
      textoNota.includes("ANULA") ||
      nota.es_anulacion === true
    );
  };

  const esFacturaAnulada = (nota: any) => {
    const fe = nota.facturas_emitidas || {};
    const estadoFactura = String(fe.estado || fe.estado_factura || "").toUpperCase();
    const textoFactura = `${fe.concepto || ""} ${fe.observaciones || ""}`.toUpperCase();

    return (
      estadoFactura.includes("ANUL") ||
      textoFactura.includes("ANULA") ||
      fe.es_anulacion === true
    );
  };

  const notasFiltradas = useMemo(() => {
    return notas.filter((n) => {
      const tipo = (n.tipo_nota || "").toUpperCase();
      if (tipoNotaFiltro !== "TODOS" && tipo !== tipoNotaFiltro) {
        return false;
      }

      const term = busqueda.toLowerCase().trim();
      if (!term) return true;

      const fe = n.facturas_emitidas || {};
      const numFactura = fe.numero_factura || "";
      const nombreCliente = fe.cliente_nombre || "";
      const nitCliente = fe.cliente_nit || "";

      return (
        n.numero_nota?.toLowerCase().includes(term) ||
        nombreCliente.toLowerCase().includes(term) ||
        nitCliente.toLowerCase().includes(term) ||
        numFactura.toLowerCase().includes(term) ||
        n.cude?.toLowerCase().includes(term)
      );
    });
  }, [notas, busqueda, tipoNotaFiltro]);

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

    notasFiltradas.forEach((n) => {
      const fe = n.facturas_emitidas || {};
      const nombreCliente = fe.cliente_nombre || "Cliente General / Sin Nombre";
      const nitCliente = fe.cliente_nit || "";
      const clave = `${nombreCliente}_${nitCliente}`;

      if (!grupos[clave]) {
        grupos[clave] = {
          cliente: nombreCliente,
          nit: nitCliente,
          items: [],
          subtotalBase: 0,
          subtotalIva: 0,
          subtotalTotal: 0,
        };
      }

      const base = Number(n.subtotal || 0);
      const iva = Number(n.impuestos || 0);
      const total = Number(n.total_nota || 0);

      grupos[clave].items.push(n);
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
  }, [notasFiltradas]);

  const exportarAExcel = () => {
    const filasExcel: any[] = [];

    gruposPorCliente.forEach((grupo) => {
      grupo.items.forEach((n) => {
        const fechaSolo = n.fecha_emision ? String(n.fecha_emision).split("T")[0] : "";
        const facturaAnulada = esFacturaAnulada(n);
        const facturaTexto = n.facturas_emitidas?.numero_factura 
          ? `FE-N° ${n.facturas_emitidas.numero_factura} ${facturaAnulada ? "(ANULADA)" : ""}` 
          : "-";

        filasExcel.push({
          Cliente: grupo.cliente,
          NIT: grupo.nit,
          "Tipo Nota": n.tipo_nota,
          "N° Nota": n.numero_nota,
          "Factura Afectada": facturaTexto,
          Fecha_nota: fechaSolo,
          Subtotal: Number(n.subtotal || 0),
          Impuestos: Number(n.impuestos || 0),
          "Total Nota": Number(n.total_nota || 0),
        });
      });

      if (mostrarSubtotales) {
        filasExcel.push({
          Cliente: `SUBTOTAL (${grupo.cliente})`,
          NIT: grupo.nit,
          "Tipo Nota": "",
          "N° Nota": "",
          "Factura Afectada": "",
          Fecha_nota: "",
          Subtotal: grupo.subtotalBase,
          Impuestos: grupo.subtotalIva,
          "Total Nota": grupo.subtotalTotal,
        });
        filasExcel.push({});
      }
    });

    filasExcel.push({
      Cliente: "TOTAL GENERAL",
      NIT: "",
      "Tipo Nota": "",
      "N° Nota": "",
      "Factura Afectada": "",
      Fecha_nota: "",
      Subtotal: totalesGenerales.base,
      Impuestos: totalesGenerales.iva,
      "Total Nota": totalesGenerales.total,
    });

    const hoja = XLSX.utils.json_to_sheet(filasExcel);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Notas Emitidas");
    XLSX.writeFile(
      libro,
      `Reporte_Notas_Emitidas_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  if (!isMounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-12 text-slate-400">
        Cargando consulta de notas emitidas...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Notas a Facturas Emitidas
          </h1>
          <p className="text-sm text-slate-500">
            Consulta de Notas Crédito y Débito aplicadas sobre la facturación de venta emitida.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Link
            href="/notas-emitidas/nueva"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition shadow-sm flex items-center gap-1.5"
          >
            ➕ Crear Nueva Nota
          </Link>

          <button
            onClick={exportarAExcel}
            disabled={notasFiltradas.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition shadow-sm flex items-center gap-1.5"
          >
            📊 Exportar a Excel
          </button>

          <button
            onClick={cargarNotas}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-md transition"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Empresa
          </label>
          <select
            value={empresaId}
            onChange={(e) => handleCambioEmpresa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial} ({emp.numero_identificacion || ""})
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
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.nombre_sucursal || suc.nombre} {suc.codigo_sucursal ? `(${suc.codigo_sucursal})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-4 bg-white p-3 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2 w-full flex-1">
          <span className="text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Buscar por Cliente, NIT, N° Nota o Factura Afectada..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full text-sm outline-none bg-transparent text-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Tipo Nota:</span>
            <select
              value={tipoNotaFiltro}
              onChange={(e) => setTipoNotaFiltro(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todas las Notas</option>
              <option value="CREDITO">Nota Crédito (NC)</option>
              <option value="DEBITO">Nota Débito (ND)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 transition">
            <input
              type="checkbox"
              checked={mostrarSubtotales}
              onChange={(e) => setMostrarSubtotales(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
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

      {/* Tabla */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Cargando notas emitidas...</div>
        ) : gruposPorCliente.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No se encontraron notas emitidas registradas para la selección actual.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">N° Nota</th>
                  <th className="p-3">Factura Afectada</th>
                  <th className="p-3">Fecha_nota</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-right">Impuestos</th>
                  <th className="p-3 text-right">Total Nota</th>
                  <th className="p-3 text-center">XML</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gruposPorCliente.map((grupo) => (
                  <React.Fragment key={`${grupo.cliente}_${grupo.nit}`}>
                    <tr className="bg-slate-100/80 border-t border-b border-slate-200">
                      <td colSpan={9} className="p-2.5 px-3 font-bold text-slate-800 text-xs">
                        👤 {grupo.cliente}{" "}
                        {grupo.nit && (
                          <span className="text-slate-500 font-normal ml-2">
                            (NIT / Cédula: {grupo.nit})
                          </span>
                        )}
                      </td>
                    </tr>

                    {grupo.items.map((n) => {
                      const fechaSolo = n.fecha_emision ? String(n.fecha_emision).split("T")[0] : "-";
                      const notaAnulada = esNotaAnulada(n);
                      const facturaAnulada = esFacturaAnulada(n);

                      return (
                        <tr key={n.id} className={`hover:bg-slate-50/80 transition ${notaAnulada ? "bg-red-50/20" : ""}`}>
                          <td className="p-3 font-semibold">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${
                                n.tipo_nota === "CREDITO"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {n.tipo_nota}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                            <span>{n.numero_nota}</span>
                            {notaAnulada && (
                              <span className="px-1.5 py-0.5 bg-red-600 text-white font-black text-[9px] rounded tracking-wide uppercase shadow-sm animate-pulse">
                                ANULADA
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-medium text-slate-700">
                            <div className="flex items-center gap-2 flex-wrap">
                              {n.facturas_emitidas?.numero_factura ? (
                                <span>FE-N° {n.facturas_emitidas.numero_factura}</span>
                              ) : (
                                <span className="text-slate-400 italic">No especificada</span>
                              )}
                              {facturaAnulada && (
                                <span className="px-1.5 py-0.5 bg-red-600 text-white font-black text-[9px] rounded tracking-wide uppercase shadow-sm">
                                  ANULADA
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">{fechaSolo}</td>
                          <td className="p-3 text-right font-mono">
                            ${Number(n.subtotal || 0).toLocaleString("es-CO")}
                          </td>
                          <td className="p-3 text-right font-mono">
                            ${Number(n.impuestos || 0).toLocaleString("es-CO")}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            ${Number(n.total_nota || 0).toLocaleString("es-CO")}
                          </td>
                          <td className="p-3 text-center">
                            {n.xml_firmado_url ? (
                              <a
                                href={n.xml_firmado_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-semibold"
                              >
                                📥 XML
                              </a>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => abrirAsiento(n)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded text-xs transition border border-blue-200 flex items-center gap-1 mx-auto"
                              title="Ver Asiento Contable"
                            >
                              📖 Asiento
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {mostrarSubtotales && (
                      <tr className="bg-blue-50/40 font-semibold text-slate-800 border-b-2 border-blue-100">
                        <td colSpan={4} className="p-2.5 text-right font-bold text-blue-900">
                          Subtotal {grupo.cliente}:
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          ${grupo.subtotalBase.toLocaleString("es-CO")}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          ${grupo.subtotalIva.toLocaleString("es-CO")}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-blue-900">
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
                  <td colSpan={4} className="p-3 text-right uppercase tracking-wider">
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

      {/* Modal Asiento */}
      {notaAsientoSeleccionada && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Asiento Contable — Nota {notaAsientoSeleccionada.tipo_nota} N° {notaAsientoSeleccionada.numero_nota}
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: {notaAsientoSeleccionada.facturas_emitidas?.cliente_nombre || "N/A"}
                </p>
              </div>
              <button
                onClick={() => setNotaAsientoSeleccionada(null)}
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
                    <strong className="text-blue-600 text-sm">
                      {asiento.transaccion.numero_documento || asiento.transaccion.id}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Fecha Contable:</span>
                    <strong className="text-slate-700">
                      {asiento.transaccion.fecha_emision ? String(asiento.transaccion.fecha_emision).split("T")[0] : asiento.transaccion.created_at}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Glosa / Concepto:</span>
                    <span className="text-slate-700 italic">{asiento.transaccion.glosa_concepto || asiento.transaccion.descripcion || "Sin descripción"}</span>
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
                            {d.conceptos_auxiliares?.codigo || `#${d.concepto_auxiliar_id}`}
                          </span>
                          <span className="font-medium text-slate-800">
                            {d.conceptos_auxiliares?.nombre || "Concepto Auxiliar"}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono border-r">
                          {d.debito > 0 ? `$${Number(d.debito).toLocaleString("es-CO")}` : "-"}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {d.credito > 0 ? `$${Number(d.credito).toLocaleString("es-CO")}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold text-slate-800">
                    <tr>
                      <td className="p-2 text-right border-r uppercase text-[10px] tracking-wider">
                        Totales:
                      </td>
                      <td className="p-2 text-right font-mono border-r text-blue-700">
                        $
                        {asiento.detalles
                          .reduce((sum: number, d: any) => sum + Number(d.debito || 0), 0)
                          .toLocaleString("es-CO")}
                      </td>
                      <td className="p-2 text-right font-mono text-blue-700">
                        $
                        {asiento.detalles
                          .reduce((sum: number, d: any) => sum + Number(d.credito || 0), 0)
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
                onClick={() => setNotaAsientoSeleccionada(null)}
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