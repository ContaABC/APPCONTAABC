"use client";

import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  obtenerEmpresas,
  obtenerSucursales,
  consultarMovimientosTransacciones,
  obtenerComprobanteTransaccion,
} from "./movimientos-actions";

export default function ConsultaMovimientosPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);

  // Filtros
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [anio, setAnio] = useState<string>("2026");
  const [mes, setMes] = useState<string>("");
  const [busqueda, setBusqueda] = useState<string>("");

  // Estados de datos
  const [loading, setLoading] = useState<boolean>(false);
  const [movimientos, setMovimientos] = useState<any[]>([]);

  // Estado para Modal de Comprobante Contable
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [loadingComprobante, setLoadingComprobante] = useState<boolean>(false);
  const [comprobanteLineas, setComprobanteLineas] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    async function init() {
      const res = await obtenerEmpresas();
      if (res.success && res.data.length > 0) {
        setEmpresas(res.data);
        setEmpresaId(String(res.data[0].id));
      }
    }
    init();
  }, [isMounted]);

  useEffect(() => {
    if (!empresaId || !isMounted) return;
    async function cargarSuc() {
      setSucursalId("");
      const res = await obtenerSucursales(Number(empresaId));
      if (res.success) {
        setSucursales(res.data || []);
      }
    }
    cargarSuc();
  }, [empresaId, isMounted]);

  useEffect(() => {
    if (!empresaId || !isMounted) return;
    async function cargarMovimientos() {
      setLoading(true);
      const res = await consultarMovimientosTransacciones(
        Number(empresaId),
        sucursalId ? Number(sucursalId) : null,
        anio ? Number(anio) : null,
        mes ? Number(mes) : null
      );

      if (res.success) {
        setMovimientos(res.data || []);
      } else {
        alert("Error al cargar los movimientos: " + res.error);
        setMovimientos([]);
      }
      setLoading(false);
    }
    cargarMovimientos();
  }, [empresaId, sucursalId, anio, mes, isMounted]);

  // Abrir Modal y Cargar Comprobante
  const handleVerComprobante = async (transaccionId: number) => {
    setLoadingComprobante(true);
    setModalOpen(true);
    const res = await obtenerComprobanteTransaccion(transaccionId);
    if (res.success) {
      setComprobanteLineas(res.data || []);
    } else {
      alert("Error al consultar el comprobante: " + res.error);
      setModalOpen(false);
    }
    setLoadingComprobante(false);
  };

  // Filtrado dinámico (+: AND | coma: OR)
  const movimientosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return movimientos;

    const esAnd = busqueda.includes("+");
    const esOr = !esAnd && busqueda.includes(",");

    let terminos: string[] = [];

    if (esAnd) {
      terminos = busqueda
        .split("+")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    } else if (esOr) {
      terminos = busqueda
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    } else {
      terminos = [busqueda.trim().toLowerCase()];
    }

    if (terminos.length === 0) return movimientos;

    return movimientos.filter((m) => {
      const textoRegistro = [
        m.fecha_contable,
        m.numero_documento,
        m.clase_documento,
        m.tercero_id,
        m.tercero_nit,
        m.tercero_nombre,
        m.concepto_auxiliar_codigo,
        m.concepto_auxiliar_nombre,
        m.glosa_concepto,
        m.numero_titulo_valor,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");

      if (esAnd) {
        return terminos.every((term) => textoRegistro.includes(term));
      } else {
        return terminos.some((term) => textoRegistro.includes(term));
      }
    });
  }, [movimientos, busqueda]);

  // Totales generales
  const totales = useMemo(() => {
    return movimientosFiltrados.reduce(
      (acc, item) => ({
        debito: acc.debito + Number(item.debito || 0),
        credito: acc.credito + Number(item.credito || 0),
      }),
      { debito: 0, credito: 0 }
    );
  }, [movimientosFiltrados]);

  // Totales del Comprobante (Modal)
  const totalesComprobante = useMemo(() => {
    return comprobanteLineas.reduce(
      (acc, item) => ({
        debito: acc.debito + Number(item.debito || 0),
        credito: acc.credito + Number(item.credito || 0),
      }),
      { debito: 0, credito: 0 }
    );
  }, [comprobanteLineas]);

  const fmt = (v: number) =>
    `$ ${Number(v || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`;

  // Exportar a Excel
  const handleExportarExcel = () => {
    if (movimientosFiltrados.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const dataExport = movimientosFiltrados.map((m, idx) => ({
      "#": idx + 1,
      "Fecha Contable": m.fecha_contable,
      "Documento": m.numero_documento,
      "Clase Documento": m.clase_documento,
      "N° Cheque / Título": m.numero_titulo_valor || "—",
      "NIT Tercero": m.tercero_nit || "",
      "Tercero (Razón Social)": m.tercero_nombre || "",
      "Cód. Auxiliar": m.concepto_auxiliar_codigo,
      "Cuenta Auxiliar": m.concepto_auxiliar_nombre,
      "Débito": Number(m.debito || 0),
      "Crédito": Number(m.credito || 0),
      "Glosa / Concepto": m.glosa_concepto,
    }));

    dataExport.push({
      "#": 0,
      "Fecha Contable": "TOTALES",
      "Documento": "",
      "Clase Documento": "",
      "N° Cheque / Título": "",
      "NIT Tercero": "",
      "Tercero (Razón Social)": "",
      "Cód. Auxiliar": "",
      "Cuenta Auxiliar": "",
      "Débito": totales.debito,
      "Crédito": totales.credito,
      "Glosa / Concepto": "",
    });

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos Contables");

    const nombreEmpresa =
      empresas.find((e) => String(e.id) === String(empresaId))?.razon_social ||
      "Empresa";
    const fechaDescarga = new Date().toISOString().split("T")[0];
    XLSX.writeFile(
      workbook,
      `Movimientos_${nombreEmpresa}_${fechaDescarga}.xlsx`
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

  const primerRegistro = comprobanteLineas[0] || {};

  if (!isMounted) {
    return <div className="p-4 text-center text-xs text-slate-400">Cargando módulo de movimientos...</div>;
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 text-xs font-sans">
      <div className="border-b pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="text-base font-bold text-slate-800">
            Consulta Detallada de Movimientos
          </h1>
          <p className="text-[11px] text-slate-500">
            Listado de partidas contables por empresa, sucursal, período y títulos valores.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportarExcel}
          disabled={loading || movimientosFiltrados.length === 0}
          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded shadow-sm transition flex items-center gap-1 text-xs"
        >
          📊 Exportar a Excel (.xlsx)
        </button>
      </div>

      {/* CONTROLES / FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Empresa
          </label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Sucursal
          </label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="">-- Todas las Sucursales --</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.nombre} {suc.codigo_sucursal ? `(${suc.codigo_sucursal})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Año
          </label>
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-slate-800 font-medium outline-none text-center"
          >
            <option value="">Todos</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Mes
          </label>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-800 font-medium outline-none"
          >
            <option value="">Acum. Año</option>
            {mesesAnio.map((m) => (
              <option key={m.num} value={m.num}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Buscar / Filtrar (+: AND | coma: OR)
          </label>
          <input
            type="text"
            placeholder="Ej: NIT + 1001  ó  Cheque N°"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
          />
        </div>
      </div>

      {/* TARJETAS RESUMEN DE TOTALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-2.5 bg-white border rounded-lg shadow-sm flex justify-between items-center">
          <span className="text-slate-500 font-semibold uppercase text-[10px]">
            Total Débitos
          </span>
          <span className="font-mono font-bold text-slate-900 text-sm">
            {fmt(totales.debito)}
          </span>
        </div>
        <div className="p-2.5 bg-white border rounded-lg shadow-sm flex justify-between items-center">
          <span className="text-slate-500 font-semibold uppercase text-[10px]">
            Total Créditos
          </span>
          <span className="font-mono font-bold text-slate-900 text-sm">
            {fmt(totales.credito)}
          </span>
        </div>
      </div>

      {/* TABLA DE DETALLE DE MOVIMIENTOS */}
      {loading ? (
        <div className="p-8 text-center text-slate-400">
          Consultando movimientos contables...
        </div>
      ) : movimientosFiltrados.length === 0 ? (
        <div className="p-8 text-center text-slate-400 italic bg-white border rounded-lg">
          No se encontraron movimientos registrados para los filtros seleccionados.
        </div>
      ) : (
        <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
              <tr>
                <th className="p-2 text-center w-8">#</th>
                <th className="p-2 text-center w-10">Ver</th>
                <th className="p-2 w-20">Fecha</th>
                <th className="p-2 w-24">Documento</th>
                <th className="p-2 w-20 text-[9px]">Clase Doc.</th>
                <th className="p-2 w-24 text-[9px]">N° Cheque</th>
                <th className="p-2 min-w-[200px]">Tercero (NIT - Razón Social)</th>
                <th className="p-2 min-w-[150px]">Cuenta Auxiliar</th>
                <th className="p-2 text-right w-24">Débito</th>
                <th className="p-2 text-right w-24">Crédito</th>
                <th className="p-2 max-w-[150px]">Glosa / Concepto</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[10px]">
              {movimientosFiltrados.map((m, idx) => (
                <tr key={m.detalle_id || idx} className="hover:bg-slate-50">
                  <td className="p-2 text-center text-slate-400 font-bold">
                    {idx + 1}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleVerComprobante(m.transaccion_id)}
                      title="Ver Comprobante Contable Completo"
                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                    >
                      👁️
                    </button>
                  </td>
                  <td className="p-2 font-mono whitespace-nowrap">
                    {m.fecha_contable}
                  </td>
                  <td className="p-2 font-bold text-slate-900 whitespace-nowrap">
                    {m.numero_documento}
                  </td>
                  <td className="p-2 whitespace-nowrap text-[9px] text-slate-600">
                    {m.clase_documento}
                  </td>
                  <td className="p-2 font-mono font-bold text-indigo-700 whitespace-nowrap">
                    {m.numero_titulo_valor || "—"}
                  </td>
                  <td className="p-2 font-medium text-slate-800">
                    {m.tercero_nit && (
                      <span className="font-mono text-slate-600 mr-1.5">
                        [{m.tercero_nit}]
                      </span>
                    )}
                    {m.tercero_nombre}
                  </td>
                  <td className="p-2 font-medium">
                    <span className="font-mono text-blue-700">
                      [{m.concepto_auxiliar_codigo}]
                    </span>{" "}
                    {m.concepto_auxiliar_nombre}
                  </td>
                  <td className="p-2 text-right font-mono text-slate-900 whitespace-nowrap">
                    {fmt(m.debito)}
                  </td>
                  <td className="p-2 text-right font-mono text-slate-900 whitespace-nowrap">
                    {fmt(m.credito)}
                  </td>
                  <td
                    className="p-2 text-slate-500 max-w-[150px] truncate"
                    title={m.glosa_concepto}
                  >
                    {m.glosa_concepto || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL / COMPROBANTE CONTABLE COMPLETO */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
            {/* Header Modal */}
            <div className="p-3 border-b bg-slate-800 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span>📄 Comprobante Contable:</span>
                  <span className="text-emerald-400 font-mono">
                    {primerRegistro.numero_documento || "N/A"}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-300">
                  {primerRegistro.clase_documento} | Fecha: {primerRegistro.fecha_contable}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-base font-bold px-2 py-0.5 rounded"
              >
                ✕
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {loadingComprobante ? (
                <div className="p-8 text-center text-slate-400 font-semibold">
                  Cargando detalle del comprobante...
                </div>
              ) : (
                <>
                  {/* Encabezado Glosa */}
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <span className="font-bold text-slate-600 uppercase text-[10px] block mb-0.5">
                      Glosa / Concepto General:
                    </span>
                    <p className="text-slate-800 font-medium">
                      {primerRegistro.glosa_concepto || "Sin descripción registrada."}
                    </p>
                  </div>

                  {/* Tabla de Asiento Contable */}
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
                        <tr>
                          <th className="p-2 w-8 text-center">#</th>
                          <th className="p-2">Cuenta Auxiliar</th>
                          <th className="p-2">N° Cheque</th>
                          <th className="p-2">Tercero</th>
                          <th className="p-2 text-right">Débito</th>
                          <th className="p-2 text-right">Crédito</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-[10px]">
                        {comprobanteLineas.map((linea, lIdx) => (
                          <tr key={linea.detalle_id || lIdx} className="hover:bg-slate-50">
                            <td className="p-2 text-center text-slate-400 font-bold">
                              {lIdx + 1}
                            </td>
                            <td className="p-2 font-medium">
                              <span className="font-mono text-blue-700">
                                [{linea.concepto_auxiliar_codigo}]
                              </span>{" "}
                              {linea.concepto_auxiliar_nombre}
                            </td>
                            <td className="p-2 font-mono font-bold text-indigo-700">
                              {linea.numero_titulo_valor || "—"}
                            </td>
                            <td className="p-2 text-slate-800 font-medium">
                              {linea.tercero_nit && (
                                <span className="font-mono text-slate-600 mr-1.5">
                                  [{linea.tercero_nit}]
                                </span>
                              )}
                              {linea.tercero_nombre}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-900 font-semibold">
                              {fmt(linea.debito)}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-900 font-semibold">
                              {fmt(linea.credito)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Footer Totales Partida Doble */}
                      <tfoot className="bg-slate-100 font-bold border-t text-[11px]">
                        <tr>
                          <td colSpan={4} className="p-2 text-right text-slate-600 uppercase">
                            Totales Comprobante:
                          </td>
                          <td className="p-2 text-right font-mono text-slate-900">
                            {fmt(totalesComprobante.debito)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-900">
                            {fmt(totalesComprobante.credito)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Verificación de Cuadre de Partida Doble */}
                  <div className="flex justify-end items-center gap-2 pt-1 text-[11px]">
                    <span className="font-semibold text-slate-500">Estado Partida Doble:</span>
                    {Math.abs(totalesComprobante.debito - totalesComprobante.credito) < 0.01 ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                        ✔ Comprobante Cuadrado
                      </span>
                    ) : (
                      <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-bold">
                        ⚠ Descuadrado (Dif: {fmt(totalesComprobante.debito - totalesComprobante.credito)})
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-2.5 border-t bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded text-xs transition"
              >
                Cerrar Comprobante
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}