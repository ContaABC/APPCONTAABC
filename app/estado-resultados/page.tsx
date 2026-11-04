"use client";

import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  obtenerEmpresas,
  obtenerSucursales,
} from "./movimientos-actions";
import { obtenerEstadoResultados } from "./estado-resultados-actions";
import BotonAnalisisIA from "../balance_general/BotonAnalisisIA";

export default function EstadoResultadosPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);

  // Filtros
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [anio, setAnio] = useState<string>("2026");
  const [mes, setMes] = useState<string>("12");
  const [tipoReporte, setTipoReporte] = useState<"ACUMULADO" | "MES">("ACUMULADO");
  const [modoPresentacion, setModoPresentacion] = useState<"NORMAL" | "COMPARATIVO_MES" | "COMPARATIVO_ANIO">("NORMAL");

  // Estados de datos (Actual y Comparativo)
  const [loading, setLoading] = useState<boolean>(false);
  const [resultadosData, setResultadosData] = useState<any[]>([]);
  const [resultadosComparativoData, setResultadosComparativoData] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cargar empresas al iniciar
  useEffect(() => {
    async function init() {
      const res = await obtenerEmpresas();
      if (res.success && res.data.length > 0) {
        setEmpresas(res.data);
        setEmpresaId(String(res.data[0].id));
      }
    }
    init();
  }, []);

  // Cargar sucursales cuando cambia la empresa
  useEffect(() => {
    if (!empresaId) return;
    async function cargarSuc() {
      setSucursalId("");
      const res = await obtenerSucursales(Number(empresaId));
      if (res.success) {
        setSucursales(res.data);
      }
    }
    cargarSuc();
  }, [empresaId]);

  // Cargar Estado de Resultados (Actual y Comparativo si aplica)
  useEffect(() => {
    if (!empresaId || !anio || !mes) return;
    async function cargarResultados() {
      setLoading(true);

      // 1. Cargar Periodo Actual
      const resActual = await obtenerEstadoResultados(
        Number(empresaId),
        sucursalId ? Number(sucursalId) : null,
        Number(anio),
        Number(mes),
        tipoReporte
      );

      if (resActual.success) {
        setResultadosData(resActual.data);
      } else {
        alert("Error al cargar el estado de resultados actual: " + resActual.error);
      }

      // 2. Si está en modo comparativo, calcular el periodo de referencia
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

        const resComparativo = await obtenerEstadoResultados(
          Number(empresaId),
          sucursalId ? Number(sucursalId) : null,
          anioComp,
          mesComp,
          tipoReporte
        );

        if (resComparativo.success) {
          setResultadosComparativoData(resComparativo.data);
        }
      } else {
        setResultadosComparativoData([]);
      }

      setLoading(false);
    }
    cargarResultados();
  }, [empresaId, sucursalId, anio, mes, tipoReporte, modoPresentacion]);

  const fmt = (v: number) =>
    `$ ${Number(v || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`;

  // Nombre de la empresa seleccionada para la IA
  const nombreEmpresaSel = useMemo(() => {
    return empresas.find((e) => String(e.id) === String(empresaId))?.razon_social || "Empresa";
  }, [empresas, empresaId]);

  // Estructurar datos Actuales y Comparativos
  const resultadosAgrupados = useMemo(() => {
    const elementosOrden = ["Ingresos", "Costos", "Gastos"];
    const estructura: { [elemento: string]: { [conceptoId: string]: any } } = {};

    elementosOrden.forEach((el) => {
      estructura[el] = {};
    });

    const mapComparativo: { [key: string]: number } = {};
    resultadosComparativoData.forEach((row) => {
      const keySub = row.subconcepto_id ? `sub_${row.subconcepto_id}` : `con_${row.concepto_id}`;
      mapComparativo[keySub] = Number(row.saldo || 0);
    });

    resultadosData.forEach((row) => {
      const el = row.elemento;
      if (!estructura[el]) estructura[el] = {};

      const cId = row.concepto_id;
      if (!estructura[el][cId]) {
        estructura[el][cId] = {
          codigo: row.concepto_codigo,
          nombre: row.concepto_nombre,
          clasificacion: row.clasificacion_balance,
          subconceptos: [],
          totalConcepto: 0,
          totalConceptoComp: 0,
        };
      }

      const saldoActual = Number(row.saldo || 0);
      const keySub = row.subconcepto_id ? `sub_${row.subconcepto_id}` : `con_${row.concepto_id}`;
      const saldoComp = mapComparativo[keySub] || 0;

      if (row.subconcepto_id) {
        estructura[el][cId].subconceptos.push({
          id: row.subconcepto_id,
          codigo: row.subconcepto_codigo,
          nombre: row.subconcepto_nombre,
          saldo: saldoActual,
          saldoComp: saldoComp,
          variacion: saldoActual - saldoComp,
        });
      }

      estructura[el][cId].totalConcepto += saldoActual;
      estructura[el][cId].totalConceptoComp += saldoComp;
    });

    return estructura;
  }, [resultadosData, resultadosComparativoData]);

  // Totales generales por Elemento (Actual y Comparativo)
  const totalesElementos = useMemo(() => {
    const totales: { [key: string]: { actual: number; comparativo: number } } = {
      Ingresos: { actual: 0, comparativo: 0 },
      Costos: { actual: 0, comparativo: 0 },
      Gastos: { actual: 0, comparativo: 0 },
    };

    Object.keys(resultadosAgrupados).forEach((el) => {
      let sumaAct = 0;
      let sumaComp = 0;
      Object.values(resultadosAgrupados[el]).forEach((con: any) => {
        sumaAct += con.totalConcepto;
        sumaComp += con.totalConceptoComp;
      });
      totales[el] = { actual: sumaAct, comparativo: sumaComp };
    });
    return totales;
  }, [resultadosAgrupados]);

  // Cálculo de Utilidad Neta del Periodo: Ingresos - (Costos + Gastos)
  const utilidadPeriodo = useMemo(() => {
    const ingresos = totalesElementos.Ingresos.actual;
    const costos = totalesElementos.Costos.actual;
    const gastos = totalesElementos.Gastos.actual;
    
    const ingresosComp = totalesElementos.Ingresos.comparativo;
    const costosComp = totalesElementos.Costos.comparativo;
    const gastosComp = totalesElementos.Gastos.comparativo;

    const actual = ingresos - (costos + gastos);
    const comparativo = ingresosComp - (costosComp + gastosComp);

    return {
      actual,
      comparativo,
      variacion: actual - comparativo,
    };
  }, [totalesElementos]);

  // Exportar a Excel
  const handleExportarExcel = () => {
    if (resultadosData.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const dataExport: any[] = [];
    Object.entries(resultadosAgrupados).forEach(([elemento, conceptos]) => {
      dataExport.push({ Elemento: `=== ${elemento.toUpperCase()} ===`, Código: "", Nombre: "", Saldo: "" });
      Object.values(conceptos).forEach((con: any) => {
        dataExport.push({ Elemento: elemento, Código: con.codigo, Nombre: con.nombre, Saldo: con.totalConcepto });
        con.subconceptos.forEach((sub: any) => {
          dataExport.push({ Elemento: elemento, Código: `  ${sub.codigo}`, Nombre: `    ${sub.nombre}`, Saldo: sub.saldo });
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estado de Resultados");

    XLSX.writeFile(workbook, `Estado_Resultados_${nombreEmpresaSel}_${anio}_M${mes}.xlsx`);
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
        <div>
          <h1 className="text-base font-bold text-slate-800">Estado de Resultados NIIF</h1>
          <p className="text-[11px] text-slate-500">
            Estado de rendimiento financiero clasificado por Ingresos, Costos y Gastos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* BOTÓN DE ANÁLISIS DE IA */}
          <BotonAnalisisIA
            tipoReporte="ESTADO_RESULTADOS"
            datosReporte={resultadosData}
            empresaNombre={nombreEmpresaSel}
            periodo={`${anio} - Mes ${mes}`}
          />

          {/* BOTÓN DE EXPORTACIÓN A EXCEL */}
          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={!isMounted || loading || resultadosData.length === 0}
            suppressHydrationWarning
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded shadow-sm transition flex items-center gap-1 text-xs"
          >
            📊 Exportar Resultados a Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* CONTROLES / FILTROS CON TAMAÑOS AJUSTADOS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200 items-end">
        <div className="lg:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Empresa</label>
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

        <div className="lg:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Sucursal</label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="">-- Consolidado --</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Año</label>
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
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Corte Mes</label>
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
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Tipo de Saldo</label>
          <select
            value={tipoReporte}
            onChange={(e) => setTipoReporte(e.target.value as "ACUMULADO" | "MES")}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            <option value="ACUMULADO">Acumulado</option>
            <option value="MES">Solo el Mes</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Presentación</label>
          <select
            value={modoPresentacion}
            onChange={(e) => setModoPresentacion(e.target.value as "NORMAL" | "COMPARATIVO_MES" | "COMPARATIVO_ANIO")}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="NORMAL">Normal</option>
            <option value="COMPARATIVO_MES">Comparativo (Mes Ant.)</option>
            <option value="COMPARATIVO_ANIO">Comparativo (Mes Año Ant.)</option>
          </select>
        </div>
      </div>
      
      {/* TARJETAS RESUMEN DE RESULTADOS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 border-l-emerald-600">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Total Ingresos</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{fmt(totalesElementos.Ingresos.actual)}</span>
          </div>
          <span className="text-xl">📈</span>
        </div>

        <div className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 border-l-amber-600">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Total Costos</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{fmt(totalesElementos.Costos.actual)}</span>
          </div>
          <span className="text-xl">📦</span>
        </div>

        <div className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 border-l-rose-600">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Total Gastos</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{fmt(totalesElementos.Gastos.actual)}</span>
          </div>
          <span className="text-xl">🏷️</span>
        </div>

        <div className={`p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 ${utilidadPeriodo.actual >= 0 ? 'border-l-blue-600 bg-blue-50/40' : 'border-l-rose-700 bg-rose-50/40'}`}>
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Utilidad / Pérdida Neta</span>
            <span className={`font-mono font-bold text-sm ${utilidadPeriodo.actual >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
              {fmt(utilidadPeriodo.actual)}
            </span>
          </div>
          <span className="text-xl">💼</span>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE ESTADO DE RESULTADOS */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-semibold">Generando Estado de Resultados NIIF...</div>
      ) : resultadosData.length === 0 ? (
        <div className="p-12 text-center text-slate-400 italic bg-white border rounded-lg">
          No se encontraron registros de resultados para los parámetros seleccionados.
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
                      {modoPresentacion === "COMPARATIVO_MES" ? "Periodo Ant. (Mes)" : "Periodo Ant. (Año)"}
                    </th>
                    <th className="p-2.5 text-right w-44">Variación</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y text-[10px]">
              {["Ingresos", "Costos", "Gastos"].map((elemento) => {
                const conceptos = resultadosAgrupados[elemento];
                const tieneConceptos = Object.keys(conceptos).length > 0;

                if (!tieneConceptos) return null;

                const totEl = totalesElementos[elemento];

                return (
                  <React.Fragment key={elemento}>
                    {/* ENCABEZADO DE ELEMENTO */}
                    <tr className="bg-slate-800 text-white font-bold text-[11px]">
                      <td colSpan={esComparativo ? 2 : 2} className="p-2.5 uppercase tracking-wider">
                        {elemento}
                      </td>
                      <td className="p-2.5 text-right font-mono">{fmt(totEl.actual)}</td>
                      {esComparativo && (
                        <>
                          <td className="p-2.5 text-right font-mono">{fmt(totEl.comparativo)}</td>
                          <td className="p-2.5 text-right font-mono">{fmt(totEl.actual - totEl.comparativo)}</td>
                        </>
                      )}
                    </tr>

                    {/* CONCEPTOS Y SUBCONCEPTOS */}
                    {Object.entries(conceptos).map(([cId, con]: [string, any]) => (
                      <React.Fragment key={cId}>
                        <tr className="bg-slate-50 font-bold text-slate-800">
                          <td className="p-2 font-mono text-blue-700">{con.codigo}</td>
                          <td className="p-2">{con.nombre}</td>
                          <td className="p-2 text-right font-mono">{fmt(con.totalConcepto)}</td>
                          {esComparativo && (
                            <>
                              <td className="p-2 text-right font-mono text-slate-600">{fmt(con.totalConceptoComp)}</td>
                              <td className="p-2 text-right font-mono text-slate-700">{fmt(con.totalConcepto - con.totalConceptoComp)}</td>
                            </>
                          )}
                        </tr>

                        {con.subconceptos.map((sub: any) => (
                          <tr key={sub.id} className="hover:bg-slate-50/80 text-slate-600">
                            <td className="p-1.5 pl-5 font-mono text-slate-500">{sub.codigo}</td>
                            <td className="p-1.5 pl-4">{sub.nombre}</td>
                            <td className="p-1.5 text-right font-mono text-slate-800">{fmt(sub.saldo)}</td>
                            {esComparativo && (
                              <>
                                <td className="p-1.5 text-right font-mono text-slate-500">{fmt(sub.saldoComp)}</td>
                                <td className="p-1.5 text-right font-mono text-slate-700">{fmt(sub.variacion)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}