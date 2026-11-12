"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  obtenerEmpresas,
  obtenerSucursales,
  obtenerClasesDocumento,
  obtenerConceptosAuxiliares,
  obtenerMovimientosRetencionesPorPeriodo,
  registrarAsientoCierreRetenciones,
  EmpresaRow,
  SucursalRow,
  ClaseDocumentoRow,
  ConceptoAuxiliarRow,
  RetencionMovimientoRow,
  DetalleAgrupadoItem
} from "./actions-declaracion";
import { validarPeriodoContable } from "@/lib/accounting-validations";

export default function DeclaracionRetencionesPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [clasesDocumento, setClasesDocumento] = useState<ClaseDocumentoRow[]>([]);
  const [conceptosAuxiliares, setConceptosAuxiliares] = useState<ConceptoAuxiliarRow[]>([]);

  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [claseDocumentoId, setClaseDocumentoId] = useState<string>("");
  const [conceptoAuxiliarCreditoId, setConceptoAuxiliarCreditoId] = useState<string>("");

  // Parámetros de la Declaración
  const [tipoRetencion, setTipoRetencion] = useState<string>("RENTA"); // RENTA, IVA, ICA
  const [periodoDesde, setPeriodoDesde] = useState<string>("");
  const [periodoHasta, setPeriodoHasta] = useState<string>("");
  const [fechaContable, setFechaContable] = useState<string>("");
  const [aproximarAlMil, setAproximarAlMil] = useState<boolean>(true);

  // Estados para Control de Periodo Contable
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  // Datos y Resultados
  const [movimientos, setMovimientos] = useState<RetencionMovimientoRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [procesandoCierre, setProcesandoCierre] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Inicializar fecha contable con el día de hoy al montar
  useEffect(() => {
    const hoyStr = new Date().toISOString().split("T")[0];
    setFechaContable(hoyStr);
  }, []);

  // Función de validación de periodo en tiempo real
  const verificarPeriodo = async (fecha: string) => {
    if (!empresaId || !sucursalId || !fecha) {
      setErrorPeriodo(null);
      return;
    }

    setValidandoPeriodo(true);
    setErrorPeriodo(null);

    const res = await validarPeriodoContable(empresaId, sucursalId, fecha);
    if (!res.valido) {
      setErrorPeriodo(res.mensaje || "Periodo no habilitado para transacciones.");
    }

    setValidandoPeriodo(false);
  };

  // Validar automáticamente al cambiar empresa o sucursal si ya hay fecha contable
  useEffect(() => {
    if (empresaId && sucursalId && fechaContable) {
      verificarPeriodo(fechaContable);
    }
  }, [empresaId, sucursalId]);

  // 1. Cargar Empresas al montar y leer cookie corporativa empresa_activa
  useEffect(() => {
    async function cargarEmpresas() {
      const res = await obtenerEmpresas();
      if (res.success && res.data && res.data.length > 0) {
        setEmpresas(res.data);
        
        const match = document.cookie.match(new RegExp('(^| )empresa_activa=([^;]+)'));
        if (match && res.data.some((e: EmpresaRow) => String(e.id) === match[2])) {
          setEmpresaId(match[2]);
        } else {
          setEmpresaId(String(res.data[0].id));
        }
      }
    }
    cargarEmpresas();
  }, []);

  // 2. Cargar dependencias al cambiar Empresa (con SUC-001 por defecto)
  useEffect(() => {
    if (!empresaId) return;
    setSucursalId("");
    setClaseDocumentoId("");
    setConceptoAuxiliarCreditoId("");
    setMovimientos([]);

    async function cargarDatosEmpresa() {
      const [resSuc, resDoc, resAux] = await Promise.all([
        obtenerSucursales(empresaId),
        obtenerClasesDocumento(empresaId),
        obtenerConceptosAuxiliares(empresaId),
      ]);

      if (resSuc.success && resSuc.data) {
        setSucursales(resSuc.data);
        const sucursalDefault = resSuc.data.find(
          (s: SucursalRow) => s.codigo_sucursal === "SUC-001"
        );
        if (sucursalDefault) {
          setSucursalId(String(sucursalDefault.id));
        } else if (resSuc.data.length > 0) {
          setSucursalId(String(resSuc.data[0].id));
        }
      }

      if (resDoc.success && resDoc.data) {
        setClasesDocumento(resDoc.data);
        if (resDoc.data.length > 0) setClaseDocumentoId(String(resDoc.data[0].id));
      }

      if (resAux.success && resAux.data) {
        setConceptosAuxiliares(resAux.data);
        if (resAux.data.length > 0) setConceptoAuxiliarCreditoId(String(resAux.data[0].id));
      }
    }
    cargarDatosEmpresa();

    // Actualizar cookie y localStorage al cambiar empresa
    localStorage.setItem("empresa_activa", empresaId);
    document.cookie = `empresa_activa=${empresaId}; path=/; max-age=86400; SameSite=Lax`;
  }, [empresaId]);

  // Limpiar resultados al cambiar filtros
  useEffect(() => {
    setMovimientos([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [sucursalId, tipoRetencion, periodoDesde, periodoHasta]);

  // 3. Consultar Movimientos
  async function consultarRetenciones() {
    if (!empresaId || !periodoDesde || !periodoHasta) {
      setErrorMsg("Debe seleccionar la empresa y definir el rango de periodos (Desde - Hasta).");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await obtenerMovimientosRetencionesPorPeriodo({
      empresaId,
      sucursalId,
      tipoRetencion,
      periodoDesde,
      periodoHasta,
    });

    if (res.success) {
      setMovimientos(res.data || []);
    } else {
      setErrorMsg(res.error || "Error al consultar los movimientos de retención.");
    }
    setLoading(false);
  }

  const aplicarAproximacionMil = (valor: number) => {
    if (!aproximarAlMil) return valor;
    return Math.round(valor / 1000) * 1000;
  };

  // 4. Agrupar datos por Concepto de Retención y capturar ajustes dinámicos
  interface GrupoConceptoItem {
    concepto: string;
    conceptoAuxiliarId: number | string | null;
    ajusteDebitoId: number | string | null;
    ajusteCreditoId: number | string | null;
    tarifaDisplay: string;
    baseTotal: number;
    valorRetencionTotal: number;
  }

  const datosAgrupadosPorConcepto = useMemo(() => {
    const agrupado: { [key: string]: GrupoConceptoItem } = {};

    movimientos.forEach((m) => {
      const nombreConcepto = m.conceptos_retencion?.concepto || (m.concepto as string) || "CONCEPTO GENERAL";
      const conceptoAuxId = m.conceptos_retencion?.concepto_auxiliar_id || null;
      const ajusteDebitoId = m.conceptos_retencion?.concepto_auxiliar_ajuste_debito_id || null;
      const ajusteCreditoId = m.conceptos_retencion?.concepto_auxiliar_ajuste_credito_id || null;
      const porcentajeRaw = Number(m.conceptos_retencion?.tarifa || m.porcentaje || 0);

      let tarifaFormatted = "";
      if (tipoRetencion === "ICA") {
        const porMil = porcentajeRaw * 1000;
        tarifaFormatted = `${porMil % 1 === 0 ? porMil.toFixed(0) : porMil.toFixed(2)} x 1.000`;
      } else {
        const porciento = porcentajeRaw * 100;
        tarifaFormatted = `${porciento % 1 === 0 ? porciento.toFixed(0) : porciento.toFixed(2)}%`;
      }

      const clave = `${nombreConcepto}_${porcentajeRaw}_${conceptoAuxId || 0}`;

      if (!agrupado[clave]) {
        agrupado[clave] = {
          concepto: nombreConcepto,
          conceptoAuxiliarId: conceptoAuxId,
          ajusteDebitoId: ajusteDebitoId,
          ajusteCreditoId: ajusteCreditoId,
          tarifaDisplay: tarifaFormatted,
          baseTotal: 0,
          valorRetencionTotal: 0,
        };
      }
      agrupado[clave].baseTotal += Number(m.base_gravable || 0);
      agrupado[clave].valorRetencionTotal += Number(m.valor_retencion || 0);
    });

    return Object.values(agrupado).sort((a, b) => a.concepto.localeCompare(b.concepto));
  }, [movimientos, tipoRetencion]);

  // 5. Totales
  const totalesDeclaracion = useMemo(() => {
    let totalBase = 0;
    let totalRetencion = 0;

    datosAgrupadosPorConcepto.forEach((item) => {
      totalBase += item.baseTotal;
      totalRetencion += item.valorRetencionTotal;
    });

    const totalRetencionAproximado = aplicarAproximacionMil(totalRetencion);

    return {
      base: totalBase,
      retencionReal: totalRetencion,
      retencionAproximada: totalRetencionAproximado,
    };
  }, [datosAgrupadosPorConcepto, aproximarAlMil]);

  // 6. Generar Asiento
  async function handleGenerarAsientoCierre() {
    if (errorPeriodo) {
      setErrorMsg("No se puede generar el asiento porque el periodo contable no es válido o está cerrado.");
      return;
    }
    if (datosAgrupadosPorConcepto.length === 0) {
      setErrorMsg("No hay datos agrupados para generar el asiento de cierre.");
      return;
    }
    if (!claseDocumentoId) {
      setErrorMsg("Debe seleccionar una clase de documento para el comprobante contable.");
      return;
    }
    if (!conceptoAuxiliarCreditoId) {
      setErrorMsg("Debe seleccionar el concepto auxiliar de crédito (contrapartida).");
      return;
    }

    setProcesandoCierre(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const detallesParaAccion: DetalleAgrupadoItem[] = datosAgrupadosPorConcepto.map((item) => ({
      conceptoAuxiliarId: item.conceptoAuxiliarId || "",
      concepto: item.concepto,
      valorRetencionTotal: item.valorRetencionTotal,
      ajusteDebitoId: item.ajusteDebitoId,
      ajusteCreditoId: item.ajusteCreditoId,
    }));

    const res = await registrarAsientoCierreRetenciones({
      empresaId,
      sucursalId,
      claseDocumentoId,
      conceptoAuxiliarCreditoId,
      tipoRetencion,
      periodoDesde,
      periodoHasta,
      fechaContable,
      totales: totalesDeclaracion,
      detallesAgrupados: detallesParaAccion,
    });

    if (res.success && res.data) {
      setSuccessMsg(`¡Asiento contable de cierre generado con éxito! N° Documento: ${res.data.numeroDocumento}`);
    } else {
      setErrorMsg(res.error || "Error al registrar el asiento contable de cierre.");
    }
    setProcesandoCierre(false);
  }

  if (!isMounted) return null;

  return (
    <div className="p-3 max-w-[98%] mx-auto space-y-3 text-xs">
      <div className="border-b border-slate-200 pb-2">
        <h1 className="text-sm font-bold text-slate-800">Declaración Consolidada de Retenciones</h1>
      </div>

      {/* Filtros Principales */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial} ({emp.nit})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
            Sucursal {tipoRetencion === 'ICA' && <span className="text-amber-600">(Requerido ICA)</span>}
          </label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.codigo_sucursal} {suc.nombre} {suc.ciudad ? `(${suc.ciudad})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tipo de Retención</label>
          <select
            value={tipoRetencion}
            onChange={(e) => setTipoRetencion(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-700"
          >
            <option value="RENTA">RENTA (Mensual)</option>
            <option value="IVA">IVA (Bimestral / Cuatrimestral)</option>
            <option value="ICA">ICA (Municipal / Bimestral)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Desde</label>
            <input
              type="date"
              value={periodoDesde}
              onChange={(e) => setPeriodoDesde(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Hasta</label>
            <input
              type="date"
              value={periodoHasta}
              onChange={(e) => setPeriodoHasta(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={consultarRetenciones}
            disabled={loading}
            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow-2xs transition text-xs cursor-pointer"
          >
            {loading ? "Consultando..." : "🔍 Cargar Datos"}
          </button>
        </div>
      </div>

      {/* Selectores del Comprobante Contable y Fecha Contable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 text-[11px]">
        <div>
          <label className="block text-[9px] font-bold text-indigo-800 uppercase mb-1">Clase de Documento Contable</label>
          <select
            value={claseDocumentoId}
            onChange={(e) => setClaseDocumentoId(e.target.value)}
            className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">-- Seleccione Clase de Documento --</option>
            {clasesDocumento.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.codigo_clase} {doc.nombre_clase}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-indigo-800 uppercase mb-1">Cuenta Auxiliar Crédito (Principal)</label>
          <select
            value={conceptoAuxiliarCreditoId}
            onChange={(e) => setConceptoAuxiliarCreditoId(e.target.value)}
            className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">-- Seleccione Cuenta Crédito --</option>
            {conceptosAuxiliares.map((aux) => (
              <option key={aux.id} value={aux.id}>
                {aux.codigo_auxiliar} {aux.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-indigo-800 uppercase mb-1">Fecha Contable de Cierre *</label>
          <input
            type="date"
            value={fechaContable}
            onChange={(e) => {
              setFechaContable(e.target.value);
              if (errorPeriodo) setErrorPeriodo(null);
            }}
            onBlur={() => verificarPeriodo(fechaContable)}
            required
            className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {validandoPeriodo && (
            <p className="text-[9px] text-indigo-600 mt-0.5 animate-pulse">Verificando periodo...</p>
          )}
          {errorPeriodo && (
            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1 rounded mt-0.5">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>
      </div>

      {/* Checkbox de Aproximación */}
      <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={aproximarAlMil}
            onChange={(e) => setAproximarAlMil(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
          />
          <span>Aproximar valores al <strong>mil más cercano</strong> (Estándar DIAN)</span>
        </label>
        <span className="text-[10px] text-slate-400 italic">Aplica para declaración y cierre</span>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* Tabla Desglosada */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        {datosAgrupadosPorConcepto.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            Selecciona los parámetros y haz clic en "Cargar Datos" para ver el desglose por conceptos de retención.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                <tr>
                  <th className="p-2.5">Concepto de Retención</th>
                  <th className="p-2.5 text-center">Tarifa</th>
                  <th className="p-2.5 text-right">Base Gravable Acumulada</th>
                  <th className="p-2.5 text-right">Retención Real (Exacta)</th>
                  <th className="p-2.5 text-right text-indigo-700">Retención Aproximada (Mil)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datosAgrupadosPorConcepto.map((item, idx) => {
                  const retAprox = aplicarAproximacionMil(item.valorRetencionTotal);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-semibold text-slate-900">{item.concepto}</td>
                      <td className="p-2.5 text-center font-mono">{item.tarifaDisplay}</td>
                      <td className="p-2.5 text-right font-mono">${item.baseTotal.toLocaleString("es-CO")}</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">${item.valorRetencionTotal.toLocaleString("es-CO")}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-indigo-700">${retAprox.toLocaleString("es-CO")}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-bold text-xs sticky bottom-0 z-10">
                <tr>
                  <td colSpan={2} className="p-3 uppercase tracking-wider">Total Consolidado:</td>
                  <td className="p-3 text-right font-mono text-slate-200">${totalesDeclaracion.base.toLocaleString("es-CO")}</td>
                  <td className="p-3 text-right font-mono text-slate-300">${totalesDeclaracion.retencionReal.toLocaleString("es-CO")}</td>
                  <td className="p-3 text-right font-mono text-emerald-400 text-sm font-extrabold">
                    ${totalesDeclaracion.retencionAproximada.toLocaleString("es-CO")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Botón de Cierre Contable */}
      {datosAgrupadosPorConcepto.length > 0 && (
        <div className="flex items-center justify-end gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="text-right text-[11px] text-slate-500">
            Se contabilizará el asiento aplicando los débitos, el crédito principal y las cuentas de ajuste dinámicas.
          </div>
          <button
            type="button"
            onClick={handleGenerarAsientoCierre}
            disabled={procesandoCierre || Boolean(errorPeriodo)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded shadow transition flex items-center gap-2 cursor-pointer"
          >
            {procesandoCierre ? "Generando Asiento..." : "⚖️ Generar Asiento Contable de Cierre"}
          </button>
        </div>
      )}
    </div>
  );
}