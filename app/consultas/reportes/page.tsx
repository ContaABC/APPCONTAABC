"use client";

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { obtenerEmpresas, obtenerSucursales } from "@/app/consultas/movimientos/movimientos-actions";
import { obtenerBalanceDePrueba, obtenerLibroMayorPorNivel, obtenerCatalogosPorNivel, obtenerLibroDiario } from "./reportes-actions";

export default function ReportesContablesPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  const [tipoReporte, setTipoReporte] = useState<"BALANCE" | "MAYOR" | "DIARIO">("BALANCE");
  const [nivelBalance, setNivelBalance] = useState<"CONCEPTOS" | "SUBCONCEPTOS" | "AUXILIARES">("AUXILIARES");

  // Niveles para el Libro Mayor: 1=Conceptos, 2=Subconceptos, 3=Auxiliares
  const [nivelMayor, setNivelMayor] = useState<1 | 2 | 3>(3);
  const [listaCatalogoMayor, setListaCatalogoMayor] = useState<any[]>([]);
  const [itemCatalogoId, setItemCatalogoId] = useState<string>("");

  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [fechaInicio, setFechaInicio] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [fechaFin, setFechaFin] = useState<string>(new Date().toISOString().split("T")[0]);

  const [loading, setLoading] = useState<boolean>(false);
  const [datosReporte, setDatosReporte] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function init() {
      const res = await obtenerEmpresas();
      if (res.success && res.data && res.data.length > 0) {
        setEmpresas(res.data);
        const primerEmpresaId = String(res.data[0].id);
        setEmpresaId(primerEmpresaId);

        const sucRes = await obtenerSucursales(Number(primerEmpresaId));
        if (sucRes.success && sucRes.data && (sucRes.data as any[]).length > 0) {
          setSucursales(sucRes.data);
          setSucursalId(String((sucRes.data as any[])[0].id));
        }
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!empresaId) return;
    async function cargarSucursalesEmpresa() {
      const sucRes = await obtenerSucursales(Number(empresaId));
      if (sucRes.success) {
        setSucursales(sucRes.data || []);
        if (sucRes.data && (sucRes.data as any[]).length > 0) {
          setSucursalId(String((sucRes.data as any[])[0].id));
        } else {
          setSucursalId("");
        }
      }
    }
    cargarSucursalesEmpresa();
  }, [empresaId]);

  // Cargar catálogo dinámico para el Libro Mayor ordenado por código
  useEffect(() => {
    if (!empresaId || tipoReporte !== "MAYOR") return;
    async function cargarCatalogoMayor() {
      setListaCatalogoMayor([]);
      setItemCatalogoId("");
      const res = await obtenerCatalogosPorNivel(Number(empresaId), nivelMayor);
      if (res.success && res.data) {
        const catalogoOrdenado = [...res.data].sort((a, b) => {
          const codA = String(a.codigo || "");
          const codB = String(b.codigo || "");
          return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
        });

        setListaCatalogoMayor(catalogoOrdenado);
        if (catalogoOrdenado.length > 0) {
          setItemCatalogoId(String(catalogoOrdenado[0].id));
        }
      }
    }
    cargarCatalogoMayor();
  }, [empresaId, nivelMayor, tipoReporte]);

  const consultarReporte = async () => {
    if (!empresaId) return;
    setLoading(true);

    if (tipoReporte === "BALANCE") {
      const res = await obtenerBalanceDePrueba(
        Number(empresaId),
        sucursalId ? Number(sucursalId) : null,
        Number(anio),
        Number(mes),
        nivelBalance
      );
      if (res.success) {
        setDatosReporte(res.data || []);
      } else {
        alert("Error al cargar balance: " + res.error);
        setDatosReporte([]);
      }
    } else if (tipoReporte === "MAYOR") {
      if (!itemCatalogoId || itemCatalogoId === "NaN" || itemCatalogoId === "undefined") {
        setLoading(false);
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
        setDatosReporte(res.data || []);
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
        setDatosReporte(res.data || []);
      } else {
        alert("Error al cargar libro diario: " + res.error);
        setDatosReporte([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (empresaId) {
      if (tipoReporte === "MAYOR" && (!itemCatalogoId || itemCatalogoId === "NaN")) {
        return;
      }
      consultarReporte();
    }
  }, [empresaId, sucursalId, tipoReporte, nivelBalance, nivelMayor, anio, mes, itemCatalogoId, fechaInicio, fechaFin]);

  const fmt = (v: number) => `$ ${Math.round(Number(v || 0)).toLocaleString("es-CO")}`;

  // Exportar a Excel real (.xlsx) usando la librería xlsx
  const exportarExcel = () => {
    if (datosReporte.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    let excelData: any[] = [];
    let nombreHoja = "Reporte";

    if (tipoReporte === "BALANCE") {
      nombreHoja = "Balance de Prueba";
      excelData = datosReporte.map((row: any) => {
        const nombreObj = row.concepto || row.subconcepto || row.concepto_auxiliar;
        return {
          "Código": nombreObj?.codigo || nombreObj?.codigo_auxiliar || "N/A",
          "Nombre / Descripción": nombreObj?.nombre || "Sin Descripción",
          "Saldo Anterior": Number(row.saldo_anterior || 0),
          "Total Débito": Number(row.total_debito || 0),
          "Total Crédito": Number(row.total_credito || 0),
          "Saldo Final": Number(row.saldo_final || 0),
        };
      });
    } else if (tipoReporte === "MAYOR") {
      nombreHoja = "Libro Mayor";
      excelData = datosReporte.map((mov: any) => ({
        "Fecha": mov.fecha_contable || mov.transaccion?.fecha_contable || "",
        "Comprobante": mov.transaccion?.numero_documento || "",
        "Tercero": mov.tercero?.razon_social || mov.tercero?.nombre_comercial || "Sin Tercero",
        "Glosa / Detalle": mov.transaccion?.glosa_concepto || "",
        "Débito": Number(mov.debito || 0),
        "Crédito": Number(mov.credito || 0),
      }));
    } else if (tipoReporte === "DIARIO") {
      nombreHoja = "Libro Diario";
      excelData = datosReporte.map((item: any) => {
        const tx = item.transaccion || {};
        return {
          "Fecha": tx.fecha_contable || item.fecha_contable || "",
          "Clase Doc": tx.clase_documento_id || "",
          "Consecutivo": tx.numero_documento || "",
          "Tercero": item.tercero?.razon_social || item.tercero?.nombre_comercial || "Sin Tercero",
          "Cuenta Auxiliar": `${item.concepto_auxiliar?.codigo_auxiliar || ""} - ${item.concepto_auxiliar?.nombre || ""}`,
          "Glosa": tx.glosa_concepto || "",
          "Débito": Number(item.debito || 0),
          "Crédito": Number(item.credito || 0),
        };
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja);

    XLSX.writeFile(workbook, `Reporte_${tipoReporte}_${anio}_${mes}.xlsx`);
  };

  const totalSaldoAnterior = datosReporte.reduce((acc, row) => acc + Number(row.saldo_anterior || 0), 0);
  const totalDebito = datosReporte.reduce((acc, row) => acc + Number(row.total_debito || 0), 0);
  const totalCredito = datosReporte.reduce((acc, row) => acc + Number(row.total_credito || 0), 0);
  const totalSaldoFinal = datosReporte.reduce((acc, row) => acc + Number(row.saldo_final || 0), 0);

  const totalMayorDebito = datosReporte.reduce((acc, mov) => acc + Number(mov.debito || 0), 0);
  const totalMayorCredito = datosReporte.reduce((acc, mov) => acc + Number(mov.credito || 0), 0);

  const totalDiarioDebito = datosReporte.reduce((acc, item) => acc + Number(item.debito || 0), 0);
  const totalDiarioCredito = datosReporte.reduce((acc, item) => acc + Number(item.credito || 0), 0);

  if (!isMounted) return null;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 text-xs font-sans">
      <div className="border-b pb-2 flex justify-between items-center">
        <div>
          <h1 className="text-base font-bold text-slate-800">Reportes Contables: Balance, Mayor y Diario</h1>
          <p className="text-[11px] text-slate-500">Consulta y exporta saldos y transacciones contables detalladas.</p>
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex gap-1 bg-slate-200 p-1 rounded">
            <button
              type="button"
              onClick={() => setTipoReporte("BALANCE")}
              className={`px-3 py-1 font-bold rounded text-[11px] transition ${
                tipoReporte === "BALANCE" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300"
              }`}
            >
              📊 Balance
            </button>
            <button
              type="button"
              onClick={() => setTipoReporte("MAYOR")}
              className={`px-3 py-1 font-bold rounded text-[11px] transition ${
                tipoReporte === "MAYOR" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300"
              }`}
            >
              📖 Mayor
            </button>
            <button
              type="button"
              onClick={() => setTipoReporte("DIARIO")}
              className={`px-3 py-1 font-bold rounded text-[11px] transition ${
                tipoReporte === "DIARIO" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300"
              }`}
            >
              📑 Diario
            </button>
          </div>

          <button
            type="button"
            onClick={exportarExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded shadow-sm text-[11px] flex items-center gap-1 transition"
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>

      {/* FILTROS EN UNA SOLA LÍNEA HORIZONTAL */}
      <div className="flex flex-wrap md:flex-nowrap gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 items-end">
        
        {/* Empresa */}
        <div className="w-full md:w-[22%]">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Empresa *</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            {empresas.map((emp: any) => (
              <option key={emp.id} value={emp.id}>{emp.razon_social || emp.nombre_comercial}</option>
            ))}
          </select>
        </div>

        {/* Sucursal */}
        <div className="w-full md:w-[20%]">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Sucursal</label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc: any) => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>

        {tipoReporte === "BALANCE" ? (
          <>
            <div className="w-full md:w-[18%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Nivel de Balance</label>
              <select
                value={nivelBalance}
                onChange={(e) => setNivelBalance(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
              >
                <option value="CONCEPTOS">Conceptos NIIF</option>
                <option value="SUBCONCEPTOS">Subconceptos NIIF</option>
                <option value="AUXILIARES">Auxiliares</option>
              </select>
            </div>

            <div className="w-full md:w-[20%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Año</label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none font-mono"
              />
            </div>

            <div className="w-full md:w-[20%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Mes</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                  <option key={m} value={m}>Mes {m}</option>
                ))}
              </select>
            </div>
          </>
        ) : tipoReporte === "MAYOR" ? (
          <>
            <div className="w-full md:w-[15%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Nivel Mayor</label>
              <select
                value={nivelMayor}
                onChange={(e) => setNivelMayor(Number(e.target.value) as any)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
              >
                <option value={1}>1 - Conceptos</option>
                <option value={2}>2 - Subconceptos</option>
                <option value={3}>3 - Auxiliares</option>
              </select>
            </div>

            <div className="w-full md:w-[28%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Cuenta / Auxiliar</label>
              <select
                value={itemCatalogoId}
                onChange={(e) => setItemCatalogoId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
              >
                {listaCatalogoMayor.map((item: any) => (
                  <option key={item.id} value={item.id}>[{item.codigo}] {item.nombre}</option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-[17%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">F. Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-800 outline-none text-[11px]"
              />
            </div>

            <div className="w-full md:w-[17%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">F. Fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-800 outline-none text-[11px]"
              />
            </div>
          </>
        ) : (
          <>
            <div className="w-full md:w-[28%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Año</label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none font-mono"
              />
            </div>

            <div className="w-full md:w-[28%]">
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Mes</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                  <option key={m} value={m}>Mes {m}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-slate-700 uppercase text-[11px]">
          {tipoReporte === "BALANCE" ? `Balance de Prueba - Nivel: ${nivelBalance}` : tipoReporte === "MAYOR" ? `Libro Mayor - Nivel ${nivelMayor}` : `Libro Diario - Año ${anio} / Mes ${mes}`}
        </h2>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Calculando saldos y consultando registros...</div>
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
                    {datosReporte.map((row: any, index: number) => {
                      const nombreObj = row.concepto || row.subconcepto || row.concepto_auxiliar;
                      const codigo = nombreObj?.codigo || nombreObj?.codigo_auxiliar || "N/A";
                      const nombre = nombreObj?.nombre || "Sin Descripción";

                      return (
                        <tr key={`${row.id || index}-${codigo}`} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{codigo}</td>
                          <td className="p-2 text-slate-700">{nombre}</td>
                          <td className="p-2 text-right font-mono text-slate-800">{fmt(row.saldo_anterior)}</td>
                          <td className="p-2 text-right font-mono text-slate-800">{fmt(row.total_debito)}</td>
                          <td className="p-2 text-right font-mono text-slate-800">{fmt(row.total_credito)}</td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-700">{fmt(row.saldo_final)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="p-2 uppercase" colSpan={2}>TOTALES GENERALES</td>
                      <td className="p-2 text-right font-mono">{fmt(totalSaldoAnterior)}</td>
                      <td className="p-2 text-right font-mono">{fmt(totalDebito)}</td>
                      <td className="p-2 text-right font-mono">{fmt(totalCredito)}</td>
                      <td className="p-2 text-right font-mono text-emerald-800">{fmt(totalSaldoFinal)}</td>
                    </tr>
                  </>
                ) : tipoReporte === "MAYOR" ? (
                  <>
                    {datosReporte.map((mov: any, index: number) => {
                      const fechaMov = mov.fecha_contable || mov.transaccion?.fecha_contable || "";
                      const terceroNombre = mov.tercero?.razon_social || mov.tercero?.nombre_comercial || "Sin Tercero";
                      return (
                        <tr key={`${mov.id || index}`} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-slate-600">{fechaMov}</td>
                          <td className="p-2 font-bold text-slate-900">{mov.transaccion?.numero_documento}</td>
                          <td className="p-2 text-slate-700">{terceroNombre}</td>
                          <td className="p-2 text-slate-600">{mov.transaccion?.glosa_concepto}</td>
                          <td className="p-2 text-right font-mono text-slate-800 w-36">{fmt(mov.debito)}</td>
                          <td className="p-2 text-right font-mono text-slate-800 w-36">{fmt(mov.credito)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="p-2 uppercase" colSpan={4}>TOTALES MOVIMIENTOS</td>
                      <td className="p-2 text-right font-mono w-36">{fmt(totalMayorDebito)}</td>
                      <td className="p-2 text-right font-mono w-36">{fmt(totalMayorCredito)}</td>
                    </tr>
                  </>
                ) : (
                  <>
                    {datosReporte.map((item: any, index: number) => {
                      const tx = item.transaccion || {};
                      const fechaTx = tx.fecha_contable || item.fecha_contable || "";
                      const claseDocId = tx.clase_documento_id || "";
                      const terceroNombre = item.tercero?.razon_social || item.tercero?.nombre_comercial || "Sin Tercero";
                      return (
                        <tr key={`${item.id || index}`} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-slate-600">{fechaTx}</td>
                          <td className="p-2 text-center font-semibold text-indigo-700">{claseDocId}</td>
                          <td className="p-2 font-bold text-slate-900">{tx.numero_documento}</td>
                          <td className="p-2 text-slate-700">{terceroNombre}</td>
                          <td className="p-2 text-slate-800">[{item.concepto_auxiliar?.codigo_auxiliar}] {item.concepto_auxiliar?.nombre}</td>
                          <td className="p-2 text-slate-600">{tx.glosa_concepto}</td>
                          <td className="p-2 text-right font-mono text-slate-800 w-36">{fmt(item.debito)}</td>
                          <td className="p-2 text-right font-mono text-slate-800 w-36">{fmt(item.credito)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="p-2 uppercase" colSpan={6}>TOTALES LIBRO DIARIO</td>
                      <td className="p-2 text-right font-mono w-36">{fmt(totalDiarioDebito)}</td>
                      <td className="p-2 text-right font-mono w-36">{fmt(totalDiarioCredito)}</td>
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