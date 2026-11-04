"use client";

import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  obtenerEmpresas,
  obtenerSucursales,
} from "./movimientos-actions";
import { obtenerBalanceGeneral } from "./balance-actions";
import BotonAnalisisIA from "./BotonAnalisisIA";

export default function BalanceGeneralPage() {
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

  // Estados de datos
  const [loading, setLoading] = useState<boolean>(false);
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [balanceComparativoData, setBalanceComparativoData] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  useEffect(() => {
    if (!empresaId || !anio || !mes) return;
    async function cargarBalances() {
      setLoading(true);

      const resActual = await obtenerBalanceGeneral(
        Number(empresaId),
        sucursalId ? Number(sucursalId) : null,
        Number(anio),
        Number(mes),
        tipoReporte
      );

      if (resActual.success) {
        setBalanceData(resActual.data);
      } else {
        alert("Error al cargar el balance actual: " + resActual.error);
      }

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

        const resComparativo = await obtenerBalanceGeneral(
          Number(empresaId),
          sucursalId ? Number(sucursalId) : null,
          anioComp,
          mesComp,
          tipoReporte
        );

        if (resComparativo.success) {
          setBalanceComparativoData(resComparativo.data);
        }
      } else {
        setBalanceComparativoData([]);
      }

      setLoading(false);
    }
    cargarBalances();
  }, [empresaId, sucursalId, anio, mes, tipoReporte, modoPresentacion]);

  const fmt = (v: number) =>
    `$ ${Number(v || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`;

  // Nombre de la empresa seleccionada para la IA
  const nombreEmpresaSel = useMemo(() => {
    return empresas.find((e) => String(e.id) === String(empresaId))?.razon_social || "Empresa";
  }, [empresas, empresaId]);

  // Estructurar datos jerárquicamente por Elemento -> Clasificación (Corriente/No Corriente) -> Concepto -> Subconcepto
  const balanceAgrupado = useMemo(() => {
    const estructura: { [elemento: string]: { [clasificacion: string]: { [conceptoId: string]: any } } } = {
      Activo: {},
      Pasivo: {},
      Patrimonio: {},
    };

    const mapComparativo: { [key: string]: number } = {};
    balanceComparativoData.forEach((row) => {
      const keySub = row.subconcepto_id ? `sub_${row.subconcepto_id}` : `con_${row.concepto_id}`;
      mapComparativo[keySub] = Number(row.saldo || 0);
    });

    balanceData.forEach((row) => {
      const el = row.elemento;
      if (!estructura[el]) estructura[el] = {};

      const clasif = row.clasificacion_balance?.trim() || "OTROS";
      if (!estructura[el][clasif]) estructura[el][clasif] = {};

      const cId = row.concepto_id;
      if (!estructura[el][clasif][cId]) {
        estructura[el][clasif][cId] = {
          codigo: row.concepto_codigo,
          nombre: row.concepto_nombre,
          subconceptos: [],
          totalConcepto: 0,
          totalConceptoComp: 0,
        };
      }

      const saldoActual = Number(row.saldo || 0);
      const keySub = row.subconcepto_id ? `sub_${row.subconcepto_id}` : `con_${row.concepto_id}`;
      const saldoComp = mapComparativo[keySub] || 0;

      if (row.subconcepto_id) {
        estructura[el][clasif][cId].subconceptos.push({
          id: row.subconcepto_id,
          codigo: row.subconcepto_codigo,
          nombre: row.subconcepto_nombre,
          saldo: saldoActual,
          saldoComp: saldoComp,
          variacion: saldoActual - saldoComp,
        });
      }

      estructura[el][clasif][cId].totalConcepto += saldoActual;
      estructura[el][clasif][cId].totalConceptoComp += saldoComp;
    });

    return estructura;
  }, [balanceData, balanceComparativoData]);

  // Totales y Subtotales por Elemento y Clasificación
  const calculosTotales = useMemo(() => {
    const subtotalesClasif: { [elemento: string]: { [clasif: string]: { actual: number; comparativo: number } } } = {
      Activo: {},
      Pasivo: {},
      Patrimonio: {},
    };

    const totalesElementos: { [elemento: string]: { actual: number; comparativo: number } } = {
      Activo: { actual: 0, comparativo: 0 },
      Pasivo: { actual: 0, comparativo: 0 },
      Patrimonio: { actual: 0, comparativo: 0 },
    };

    Object.keys(balanceAgrupado).forEach((el) => {
      let sumaElemAct = 0;
      let sumaElemComp = 0;

      Object.keys(balanceAgrupado[el]).forEach((clasif) => {
        let sumaClasifAct = 0;
        let sumaClasifComp = 0;

        Object.values(balanceAgrupado[el][clasif]).forEach((con: any) => {
          sumaClasifAct += con.totalConcepto;
          sumaClasifComp += con.totalConceptoComp;
        });

        subtotalesClasif[el][clasif] = { actual: sumaClasifAct, comparativo: sumaClasifComp };
        sumaElemAct += sumaClasifAct;
        sumaElemComp += sumaClasifComp;
      });

      totalesElementos[el] = { actual: sumaElemAct, comparativo: sumaElemComp };
    });

    return { subtotalesClasif, totalesElementos };
  }, [balanceAgrupado]);

  // Prueba Contable: Activos - (Abs(Pasivo) + Abs(Patrimonio)) = 0
  const pruebaCuadre = useMemo(() => {
    const activo = calculosTotales.totalesElementos.Activo.actual;
    const pasivo = Math.abs(calculosTotales.totalesElementos.Pasivo.actual);
    const patrimonio = Math.abs(calculosTotales.totalesElementos.Patrimonio.actual);
    
    const diferencia = activo - (pasivo + patrimonio);
    return {
      diferencia,
      cuadra: Math.abs(diferencia) < 0.01,
    };
  }, [calculosTotales]);

  const handleExportarExcel = () => {
    if (balanceData.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const dataExport: any[] = [];
    Object.entries(balanceAgrupado).forEach(([elemento, clasificaciones]) => {
      dataExport.push({ Elemento: `=== ${elemento.toUpperCase()} ===`, Código: "", Nombre: "", Saldo: "" });
      Object.entries(clasificaciones).forEach(([clasif, conceptos]) => {
        dataExport.push({ Elemento: `--- ${clasif} ---`, Código: "", Nombre: "", Saldo: "" });
        Object.values(conceptos).forEach((con: any) => {
          dataExport.push({ Elemento: elemento, Código: con.codigo, Nombre: con.nombre, Saldo: con.totalConcepto });
          con.subconceptos.forEach((sub: any) => {
            dataExport.push({ Elemento: elemento, Código: `  ${sub.codigo}`, Nombre: `    ${sub.nombre}`, Saldo: sub.saldo });
          });
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Balance General");

    XLSX.writeFile(workbook, `Balance_General_${nombreEmpresaSel}_${anio}_M${mes}.xlsx`);
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
          <h1 className="text-base font-bold text-slate-800">Balance General NIIF</h1>
          <p className="text-[11px] text-slate-500">
            Estado de situación financiera clasificado por Activos, Pasivos y Patrimonio (Corriente y No Corriente).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* BOTÓN DE ANÁLISIS DE IA */}
          <BotonAnalisisIA
            tipoReporte="BALANCE_GENERAL"
            datosReporte={balanceData}
            empresaNombre={nombreEmpresaSel}
            periodo={`${anio} - Mes ${mes}`}
          />

          {/* BOTÓN DE EXPORTACIÓN A EXCEL */}
          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={!isMounted || loading || balanceData.length === 0}
            suppressHydrationWarning
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded shadow-sm transition flex items-center gap-1 text-xs"
          >
            📊 Exportar Balance a Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* FILTROS SUPERIORES CON PROPORCIONES AJUSTADAS */}
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

      {/* TARJETAS RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 border-l-blue-600">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Total Activos</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{fmt(calculosTotales.totalesElementos.Activo.actual)}</span>
          </div>
          <span className="text-xl">🏢</span>
        </div>

        <div className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 border-l-amber-600">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Total Pasivos</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{fmt(calculosTotales.totalesElementos.Pasivo.actual)}</span>
          </div>
          <span className="text-xl">📑</span>
        </div>

        <div className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 border-l-emerald-600">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Total Patrimonio</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{fmt(calculosTotales.totalesElementos.Patrimonio.actual)}</span>
          </div>
          <span className="text-xl">🏛️</span>
        </div>

        <div className={`p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center border-l-4 ${pruebaCuadre.cuadra ? 'border-l-emerald-700 bg-emerald-50/40' : 'border-l-rose-600 bg-rose-50/40'}`}>
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Prueba (Act - Pas - Pat)</span>
            <span className={`font-mono font-bold text-sm ${pruebaCuadre.cuadra ? 'text-emerald-700' : 'text-rose-600'}`}>
              {fmt(pruebaCuadre.diferencia)}
            </span>
          </div>
          <span className="text-xl" title={pruebaCuadre.cuadra ? "Balance Cuadrado" : "Descuadre detectado"}>
            {pruebaCuadre.cuadra ? "✅" : "⚠️"}
          </span>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-semibold">Generando Balance General NIIF...</div>
      ) : balanceData.length === 0 ? (
        <div className="p-12 text-center text-slate-400 italic bg-white border rounded-lg">
          No se encontraron registros contables para los parámetros seleccionados.
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
              {["Activo", "Pasivo", "Patrimonio"].map((elemento) => {
                const clasificaciones = balanceAgrupado[elemento];
                const tieneClasificaciones = Object.keys(clasificaciones).length > 0;

                if (!tieneClasificaciones) return null;

                const totElem = calculosTotales.totalesElementos[elemento];

                return (
                  <React.Fragment key={elemento}>
                    {/* ENCABEZADO PRINCIPAL DE ELEMENTO (ACTIVO, PASIVO, PATRIMONIO) */}
                    <tr className="bg-slate-900 text-white font-bold text-[11px]">
                      <td colSpan={esComparativo ? 2 : 2} className="p-2.5 uppercase tracking-wider">
                        {elemento}
                      </td>
                      <td className="p-2.5 text-right font-mono">{fmt(totElem.actual)}</td>
                      {esComparativo && (
                        <>
                          <td className="p-2.5 text-right font-mono">{fmt(totElem.comparativo)}</td>
                          <td className="p-2.5 text-right font-mono">{fmt(totElem.actual - totElem.comparativo)}</td>
                        </>
                      )}
                    </tr>

                    {/* RECORRER CLASIFICACIONES (Corriente, No Corriente, etc.) */}
                    {Object.entries(clasificaciones).map(([clasif, conceptos]) => {
                      const subClasif = calculosTotales.subtotalesClasif[elemento][clasif];

                      return (
                        <React.Fragment key={clasif}>
                          {/* ENCABEZADO DE CLASIFICACIÓN (CORRIENTE / NO CORRIENTE) */}
                          <tr className="bg-slate-200 text-slate-800 font-bold text-[10px]">
                            <td colSpan={esComparativo ? 2 : 2} className="p-2 pl-4 uppercase tracking-wide text-slate-700">
                              &nbsp;&nbsp;{clasif}
                            </td>
                            <td className="p-2 text-right font-mono">{fmt(subClasif.actual)}</td>
                            {esComparativo && (
                              <>
                                <td className="p-2 text-right font-mono">{fmt(subClasif.comparativo)}</td>
                                <td className="p-2 text-right font-mono">{fmt(subClasif.actual - subClasif.comparativo)}</td>
                              </>
                            )}
                          </tr>

                          {/* CONCEPTOS Y SUBCONCEPTOS */}
                          {Object.entries(conceptos).map(([cId, con]: [string, any]) => (
                            <React.Fragment key={cId}>
                              <tr className="bg-slate-50 font-bold text-slate-800">
                                <td className="p-2 pl-6 font-mono text-blue-700">{con.codigo}</td>
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
                                  <td className="p-1.5 pl-9 font-mono text-slate-500">{sub.codigo}</td>
                                  <td className="p-1.5 pl-6">{sub.nombre}</td>
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