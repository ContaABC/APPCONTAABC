"use client";

import React, { useState, useEffect } from "react";
import {
  obtenerEmpresas,
  obtenerSucursales,
  obtenerResumenBalanceYDetalle,
} from "./saldos-actions";

export default function ConsultasSaldosPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);

  // Filtros
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [anio, setAnio] = useState<string>("2026");
  const [mes, setMes] = useState<string>("");

  // Datos
  const [loading, setLoading] = useState<boolean>(false);
  const [resumen, setResumen] = useState<any[]>([]);
  const [detalle, setDetalle] = useState<{ conceptos: any[]; subconceptos: any[]; auxiliares: any[] }>({
    conceptos: [],
    subconceptos: [],
    auxiliares: [],
  });

  // Estados desplegables
  const [expandedConceptos, setExpandedConceptos] = useState<{ [id: string]: boolean }>({});
  const [expandedSubconceptos, setExpandedSubconceptos] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    async function init() {
      const res = await obtenerEmpresas();
      if (res.success && res.data && res.data.length > 0) {
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
    async function cargarDatos() {
      setLoading(true);
      const res = await obtenerResumenBalanceYDetalle(
        Number(empresaId),
        sucursalId ? Number(sucursalId) : null,
        anio ? Number(anio) : null,
        mes ? Number(mes) : null
      );

      if (res.success) {
        setResumen(res.resumenBalance || []);
        setDetalle(res.detalle || { conceptos: [], subconceptos: [], auxiliares: [] });
      } else {
        alert("Error cargando saldos: " + res.error);
        setResumen([]);
        setDetalle({ conceptos: [], subconceptos: [], auxiliares: [] });
      }
      setLoading(false);
    }
    cargarDatos();
  }, [empresaId, sucursalId, anio, mes, isMounted]);

  const toggleConcepto = (id: string) =>
    setExpandedConceptos((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSubconcepto = (id: string) =>
    setExpandedSubconceptos((prev) => ({ ...prev, [id]: !prev[id] }));

  const fmt = (v: number) => `$ ${Number(v || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`;

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

  if (!isMounted) {
    return <div className="p-4 text-center text-xs text-slate-400">Cargando módulo de saldos...</div>;
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4 text-xs font-sans">
      <div className="border-b pb-2">
        <h1 className="text-base font-bold text-slate-800">
          Consulta y Verificación de Saldos Acumulados
        </h1>
        <p className="text-[11px] text-slate-500">
          Verificación del cuadre (Débitos vs Créditos) en Conceptos, Subconceptos y Auxiliares.
        </p>
      </div>

      {/* CONTROLES / FILTROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div>
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

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Sucursal</label>
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

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Año</label>
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none text-center"
          >
            <option value="">-- Todos --</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Mes</label>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            <option value="">-- Acumulado Año --</option>
            {mesesAnio.map((m) => (
              <option key={m.num} value={m.num}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-center text-slate-400">Consultando información de saldos...</div>
      ) : (
        <>
          {/* TARJETAS RESUMEN GLOBAL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {resumen.map((r, idx) => (
              <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm space-y-1">
                <h3 className="font-bold text-slate-700 border-b pb-1 uppercase text-[11px]">{r.nivel}</h3>
                <div className="flex justify-between text-[11px]">
                  <span>Total Débito:</span>
                  <span className="font-mono font-bold text-slate-800">{fmt(r.suma_debito)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Total Crédito:</span>
                  <span className="font-mono font-bold text-slate-800">{fmt(r.suma_credito)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-[11px]">
                  <span>Diferencia:</span>
                  <span className={`font-mono ${r.cuadrado ? "text-emerald-600" : "text-rose-600"}`}>
                    {fmt(r.diferencia)} {r.cuadrado ? "✔ Cuadrado" : "⚠ Descuadre"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* TABLA JERÁRQUICA CONSOLIDADA Y EXPANDIBLE */}
          <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[11px]">
                <tr>
                  <th className="p-2">Estructura / Cuenta</th>
                  <th className="p-2 text-right">Débito</th>
                  <th className="p-2 text-right">Crédito</th>
                  <th className="p-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                {detalle.conceptos.map((conc, idx) => {
                  const concId = String(conc.concepto_niif_id || `conc-idx-${idx}`);
                  const isExpandedConc = !!expandedConceptos[concId];
                  const subconceptosHijos = detalle.subconceptos.filter(
                    (s) => String(s.subconceptos_niif?.concepto_niif_id) === concId
                  );
                  const difConc = Number(conc.total_debito || 0) - Number(conc.total_credito || 0);

                  return (
                    <React.Fragment key={`conc-frag-${concId}`}>
                      {/* FILA CONCEPTO PADRE */}
                      <tr
                        className="bg-slate-50 font-bold hover:bg-slate-100 cursor-pointer"
                        onClick={() => toggleConcepto(concId)}
                      >
                        <td className="p-2 flex items-center gap-2">
                          <span>{isExpandedConc ? "📂" : "📁"}</span>
                          <span>
                            [{conc.conceptos_niif?.codigo || conc.conceptos_niif?.codigo_concepto || "N/A"}] {conc.conceptos_niif?.nombre || "Concepto"}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono">{fmt(conc.total_debito)}</td>
                        <td className="p-2 text-right font-mono">{fmt(conc.total_credito)}</td>
                        <td className="p-2 text-right font-mono text-blue-700">{fmt(difConc)}</td>
                      </tr>

                      {/* SUBCONCEPTOS HIJOS */}
                      {isExpandedConc &&
                        subconceptosHijos.map((sub, subIdx) => {
                          const subId = String(sub.subconcepto_niif_id || `sub-idx-${subIdx}`).toLowerCase().trim();
                          const isExpandedSub = !!expandedSubconceptos[subId];

                          const auxiliaresHijos = detalle.auxiliares.filter(
                            (a) => String(a.conceptos_auxiliares?.subconcepto_niif_id || "").toLowerCase().trim() === subId
                          );
                          const difSub = Number(sub.total_debito || 0) - Number(sub.total_credito || 0);
                          const tieneAuxiliares = auxiliaresHijos.length > 0;

                          return (
                            <React.Fragment key={`sub-frag-${subId}`}>
                              {/* FILA SUBCONCEPTO */}
                              <tr
                                className={`bg-white hover:bg-slate-50 font-semibold ${tieneAuxiliares ? "cursor-pointer" : "cursor-default opacity-85"}`}
                                onClick={() => tieneAuxiliares && toggleSubconcepto(subId)}
                              >
                                <td className="p-2 pl-6 flex items-center gap-2">
                                  <span>{tieneAuxiliares ? (isExpandedSub ? "📖" : "📘") : "📄"}</span>
                                  <span>
                                    [{sub.subconceptos_niif?.codigo || sub.subconceptos_niif?.codigo_subconcepto || "N/A"}] {sub.subconceptos_niif?.nombre || "Subconcepto"}
                                  </span>
                                  {!tieneAuxiliares && (
                                    <span className="text-[9px] text-slate-400 font-normal italic">(Sin auxiliares registrados)</span>
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono">{fmt(sub.total_debito)}</td>
                                <td className="p-2 text-right font-mono">{fmt(sub.total_credito)}</td>
                                <td className="p-2 text-right font-mono text-slate-700">{fmt(difSub)}</td>
                              </tr>

                              {/* AUXILIARES CONSOLIDADOS */}
                              {isExpandedSub &&
                                auxiliaresHijos.map((aux, auxIdx) => {
                                  const auxId = String(aux.concepto_auxiliar_id || `aux-idx-${auxIdx}`);
                                  const difAux = Number(aux.total_debito || 0) - Number(aux.total_credito || 0);
                                  return (
                                    <tr key={`aux-row-${auxId}`} className="bg-slate-50/50 hover:bg-slate-100/60 text-slate-600">
                                      <td className="p-2 pl-12">
                                        🔹 [{aux.conceptos_auxiliares?.codigo_auxiliar || "N/A"}] {aux.conceptos_auxiliares?.nombre}
                                      </td>
                                      <td className="p-2 text-right font-mono">{fmt(aux.total_debito)}</td>
                                      <td className="p-2 text-right font-mono">{fmt(aux.total_credito)}</td>
                                      <td className="p-2 text-right font-mono">{fmt(difAux)}</td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}