"use client";

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { obtenerEmpresas, obtenerReporteNiiF } from "./actions";

export default function ReportesNiiFPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<any>("");
  const [tipoReporte, setTipoReporte] = useState<"conceptos_niif" | "subconceptos_niif" | "conceptos_auxiliares" | "consolidado_niif">("consolidado_niif");
  
  const [datosReporte, setDatosReporte] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    async function init() {
      try {
        const res = await obtenerEmpresas();
        if (res && res.success && res.data && res.data.length > 0) {
          setEmpresas(res.data);
          setEmpresaId(res.data[0].id);
        } else {
          setErrorMsg(res?.error || "No se encontraron empresas registradas.");
        }
      } catch (err: any) {
        setErrorMsg("Error de conexión al cargar empresas: " + err.message);
      }
    }
    init();
  }, [isMounted]);

  useEffect(() => {
    if (!empresaId || !isMounted) return;
    async function cargarReporte() {
      setLoading(true);
      setErrorMsg(null);
      const res = await obtenerReporteNiiF(Number(empresaId), tipoReporte);
      if (res && res.success) {
        setDatosReporte(res.data || []);
      } else {
        setErrorMsg(res?.error || "Error al obtener el reporte NIIF.");
        setDatosReporte([]);
      }
      setLoading(false);
    }
    cargarReporte();
  }, [empresaId, tipoReporte, isMounted]);

  const handleExportarExcel = () => {
    if (datosReporte.length === 0) return;
    
    let datosExport: any[] = [];

    if (tipoReporte === "consolidado_niif") {
      datosReporte.forEach((niif) => {
        if (niif.subconceptos_niif && niif.subconceptos_niif.length > 0) {
          niif.subconceptos_niif.forEach((sub: any) => {
            if (sub.conceptos_auxiliares && sub.conceptos_auxiliares.length > 0) {
              sub.conceptos_auxiliares.forEach((aux: any) => {
                datosExport.push({
                  "Cod. Concepto NIIF": niif.codigo_concepto,
                  "Nombre Concepto NIIF": niif.nombre,
                  "Cod. Subconcepto": sub.codigo,
                  "Nombre Subconcepto": sub.nombre,
                  "Cod. Auxiliar": aux.codigo_auxiliar,
                  "Nombre Auxiliar": aux.nombre,
                  "Tipo Entidad": aux.tipo_entidad,
                  "Estado Auxiliar": aux.estado
                });
              });
            } else {
              datosExport.push({
                "Cod. Concepto NIIF": niif.codigo_concepto,
                "Nombre Concepto NIIF": niif.nombre,
                "Cod. Subconcepto": sub.codigo,
                "Nombre Subconcepto": sub.nombre,
                "Cod. Auxiliar": "Sin auxiliar",
                "Nombre Auxiliar": "",
                "Tipo Entidad": "",
                "Estado Auxiliar": ""
              });
            }
          });
        } else {
          datosExport.push({
            "Cod. Concepto NIIF": niif.codigo_concepto,
            "Nombre Concepto NIIF": niif.nombre,
            "Cod. Subconcepto": "Sin subconcepto",
            "Nombre Subconcepto": "",
            "Cod. Auxiliar": "",
            "Nombre Auxiliar": "",
            "Tipo Entidad": "",
            "Estado Auxiliar": ""
          });
        }
      });
    } else {
      datosExport = datosReporte.map((item, idx) => {
        if (tipoReporte === "conceptos_niif") {
          return { "N°": idx + 1, "Código": item.codigo_concepto, "Nombre Concepto": item.nombre, "Elemento": item.elemento, "Clasificación": item.clasificacion_balance };
        } else if (tipoReporte === "subconceptos_niif") {
          return { "N°": idx + 1, "Código Subc.": item.codigo, "Nombre Subc.": item.nombre, "Concepto NIIF": item.conceptos_niif ? `${item.conceptos_niif.codigo_concepto} - ${item.conceptos_niif.nombre}` : "" };
        } else {
          return { "N°": idx + 1, "Código Aux.": item.codigo_auxiliar, "Nombre Aux.": item.nombre, "Tipo": item.tipo_entidad, "Subconcepto": item.subconceptos_niif ? `${item.subconceptos_niif.codigo} - ${item.subconceptos_niif.nombre}` : "" };
        }
      });
    }

    const ws = XLSX.utils.json_to_sheet(datosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipoReporte);
    XLSX.writeFile(wb, `reporte_${tipoReporte}.xlsx`);
  };

  if (!isMounted) return <div className="p-4 text-center text-slate-400 text-xs">Cargando reporte NIIF...</div>;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-3 text-xs">
      <div className="border-b pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-800">Reportes y Consulta NIIF</h1>
          <p className="text-[11px] text-slate-500">Visualiza la estructura jerárquica o detallada de la contabilidad.</p>
        </div>
        <button
          type="button"
          onClick={handleExportarExcel}
          disabled={datosReporte.length === 0 || loading}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded shadow text-xs transition flex items-center gap-1"
        >
          📊 Exportar a Excel
        </button>
      </div>

      {errorMsg && (
        <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-md font-medium">
          ⚠ {errorMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial} (NIT: {emp.nit_identificacion}{emp.dv ? `-${emp.dv}` : ""})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Tipo de Reporte NIIF</label>
          <select
            value={tipoReporte}
            onChange={(e) => setTipoReporte(e.target.value as any)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="consolidado_niif">🔗 Consolidado (Concepto NIIF ➔ Subconcepto ➔ Auxiliar)</option>
            <option value="conceptos_auxiliares">3. Cuentas / Conceptos Auxiliares (Detalle)</option>
            <option value="subconceptos_niif">2. Subconceptos NIIF</option>
            <option value="conceptos_niif">1. Conceptos NIIF (Principales)</option>
          </select>
        </div>
      </div>

      {/* Tabla / Consolidado */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Cargando reporte...</div>
        ) : datosReporte.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">No se encontraron registros.</div>
        ) : tipoReporte === "consolidado_niif" ? (
          <div className="space-y-4">
            {datosReporte.map((niif, idx) => (
              <div key={niif.id || idx} className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
                {/* Cabecera del Concepto NIIF (Nivel 1) */}
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-xs">
                      {niif.codigo_concepto}
                    </span>
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                      📁 {niif.nombre}
                    </span>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                    {niif.elemento || "NIIF"} {niif.clasificacion_balance ? `| ${niif.clasificacion_balance}` : ""}
                  </span>
                </div>

                {/* Subconceptos (Nivel 2) */}
                <div className="p-3 bg-slate-50/50 space-y-3">
                  {(!niif.subconceptos_niif || niif.subconceptos_niif.length === 0) ? (
                    <div className="text-[11px] text-slate-400 italic pl-4">Sin subconceptos asociados.</div>
                  ) : (
                    niif.subconceptos_niif.map((sub: any) => (
                      <div key={sub.id} className="bg-white border border-slate-200 rounded-md p-2.5 shadow-xs space-y-2 ml-2 md:ml-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                              {sub.codigo}
                            </span>
                            <span className="font-semibold text-slate-700 text-xs">
                              📂 {sub.nombre}
                            </span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${sub.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                            {sub.activo ? "Activo" : "Inactivo"}
                          </span>
                        </div>

                        {/* Cuentas Auxiliares (Nivel 3) */}
                        {(!sub.conceptos_auxiliares || sub.conceptos_auxiliares.length === 0) ? (
                          <div className="text-[10px] text-slate-400 italic pl-4 py-1">Sin cuentas auxiliares registradas.</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-2 pt-1">
                            {sub.conceptos_auxiliares.map((aux: any) => (
                              <div key={aux.id} className="bg-slate-50 hover:bg-slate-100/80 transition border border-slate-200 rounded p-2 flex items-center justify-between gap-2">
                                <div className="truncate">
                                  <div className="font-mono font-bold text-slate-900 text-[11px]">
                                    {aux.codigo_auxiliar}
                                  </div>
                                  <div className="text-slate-600 text-[10px] truncate" title={aux.nombre}>
                                    {aux.nombre}
                                  </div>
                                </div>
                                <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded font-medium whitespace-nowrap">
                                  {aux.tipo_entidad || "Auxiliar"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-left text-slate-600 border-collapse">
            <thead className="bg-slate-100 border-b text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                {tipoReporte === "conceptos_niif" && <><th className="p-2">Código</th><th className="p-2">Nombre</th><th className="p-2">Elemento</th><th className="p-2">Clasificación</th></>}
                {tipoReporte === "subconceptos_niif" && <><th className="p-2">Código Subc.</th><th className="p-2">Nombre Subc.</th><th className="p-2">Concepto NIIF Padre</th><th className="p-2">Elemento</th></>}
                {tipoReporte === "conceptos_auxiliares" && <><th className="p-2">Código Aux.</th><th className="p-2">Nombre Aux.</th><th className="p-2">Tipo Entidad</th><th className="p-2">Subconcepto NIIF</th></>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {datosReporte.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50">
                  {tipoReporte === "conceptos_niif" && <><td className="p-2 font-mono font-bold">{item.codigo_concepto}</td><td className="p-2">{item.nombre}</td><td className="p-2">{item.elemento}</td><td className="p-2">{item.clasificacion_balance}</td></>}
                  {tipoReporte === "subconceptos_niif" && <><td className="p-2 font-mono font-bold">{item.codigo}</td><td className="p-2">{item.nombre}</td><td className="p-2">{item.conceptos_niif?.codigo_concepto} - {item.conceptos_niif?.nombre}</td><td className="p-2">{item.elemento}</td></>}
                  {tipoReporte === "conceptos_auxiliares" && <><td className="p-2 font-mono font-bold">{item.codigo_auxiliar}</td><td className="p-2">{item.nombre}</td><td className="p-2 text-blue-700 font-semibold">{item.tipo_entidad}</td><td className="p-2">{item.subconceptos_niif?.codigo} - {item.subconceptos_niif?.nombre}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}