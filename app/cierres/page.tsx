"use client";

import React, { useState, useEffect } from "react";
import {
  obtenerEmpresasParaCierre,
  obtenerSucursalesPorEmpresa,
  obtenerClasesDocumentoEmpresa,
  actualizarEstadoClaseDocumento,
  actualizarEstadoTodasClasesDocumento,
  obtenerUltimoCierrePeriodo,
  ejecutarCierreServer,
  procesarCierreAnualServer,
  obtenerPeriodosAperturas,
  habilitarPeriodoAperturaServer,
  bloquearPeriodoAperturaServer,
  desbloquearPeriodoAperturaServer,
  obtenerCuentasAuxiliaresPorElemento,
} from "./actions";

const MODULOS_DISPONIBLES = [
  "CONTABILIDAD",
  "NOMINA",
  "ACTIVOS FIJOS",
  "INVENTARIOS",
  "CARTERA",
  "TESORERIA",
];

export default function ModuloCierresPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState<"mensual" | "anual" | "aperturas">("mensual");

  const [empresas, setEmpresas] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<any>("");
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [sucursalId, setSucursalId] = useState<any>("");
  
  // Mensual
  const [moduloSeleccionado, setModuloSeleccionado] = useState<string>("CONTABILIDAD");
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(new Date().getFullYear());
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(new Date().getMonth() + 1);
  const [incluirCierreDocumentos, setIncluirCierreDocumentos] = useState<boolean>(false);
  const [clasesDocumento, setClasesDocumento] = useState<any[]>([]);

  // Anual
  const [anioAnualSeleccionado, setAnioAnualSeleccionado] = useState<number>(new Date().getFullYear());
  const [cuentaUtilidadId, setCuentaUtilidadId] = useState<string>("");
  const [claseDocumentoId, setClaseDocumentoId] = useState<string>("");
  const [cuentasPatrimonio, setCuentasPatrimonio] = useState<any[]>([]);
  const [datosSimulacionAnual, setDatosSimulacionAnual] = useState<any[] | null>(null);

  // Aperturas
  const [periodosApertura, setPeriodosApertura] = useState<any[]>([]);
  const [siguientePeriodoApertura, setSiguientePeriodoApertura] = useState<{ anio: number; mes: number }>({
    anio: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
  });

  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cargar empresas al iniciar
  useEffect(() => {
    if (!isMounted) return;
    async function init() {
      const res = await obtenerEmpresasParaCierre();
      if (res.success && res.data && res.data.length > 0) {
        setEmpresas(res.data);
        setEmpresaId(res.data[0].id);
      }
    }
    init();
  }, [isMounted]);

  // Cada vez que cambia la empresa: recargar sucursales, clases, cuentas y resetear simulaciones
  useEffect(() => {
    if (!empresaId || !isMounted) return;
    async function cargarDatosEmpresa() {
      setSucursalId("");
      setDatosSimulacionAnual(null);
      setErrorMsg(null);
      setSuccessMsg(null);

      const [resSuc, resDoc, resPatrimonio] = await Promise.all([
        obtenerSucursalesPorEmpresa(Number(empresaId)),
        obtenerClasesDocumentoEmpresa(Number(empresaId)),
        obtenerCuentasAuxiliaresPorElemento(Number(empresaId), "Patrimonio"),
      ]);

      if (resSuc.success) setSucursales(resSuc.data ?? []);
      if (resDoc.success) setClasesDocumento(resDoc.data ?? []);
      if (resPatrimonio.success) setCuentasPatrimonio(resPatrimonio.data ?? []);

      const empresaObj = empresas.find((e) => Number(e.id) === Number(empresaId));
      if (empresaObj && empresaObj.fecha_inicio_operaciones) {
        const anioOp = Number(empresaObj.fecha_inicio_operaciones.substring(0, 4));
        setAnioAnualSeleccionado(anioOp);
      }
    }
    cargarDatosEmpresa();
  }, [empresaId, isMounted]);

  // Cada vez que cambia la sucursal (o empresa): limpiar simulaciones previas
  useEffect(() => {
    if (!isMounted) return;
    setDatosSimulacionAnual(null);
  }, [sucursalId, isMounted]);

  // Calcular período exacto para cierre mensual
  useEffect(() => {
    if (!empresaId || !isMounted) return;
    async function calcularPeriodoExacto() {
      const empresaObj = empresas.find((e) => Number(e.id) === Number(empresaId));
      const resUltimo = await obtenerUltimoCierrePeriodo(Number(empresaId), Number(sucursalId), moduloSeleccionado);

      let anioCalculado = new Date().getFullYear();
      let mesCalculado = new Date().getMonth() + 1;

      if (resUltimo.success && resUltimo.data && resUltimo.data.periodo_hasta) {
        const partes = resUltimo.data.periodo_hasta.split("-");
        let anio = Number(partes[0]);
        let mes = Number(partes[1]);

        mes += 1;
        if (mes > 12) {
          mes = 1;
          anio += 1;
        }
        anioCalculado = anio;
        mesCalculado = mes;
      } else if (empresaObj && empresaObj.fecha_inicio_operaciones) {
        const partes = empresaObj.fecha_inicio_operaciones.split("-");
        anioCalculado = Number(partes[0]);
        mesCalculado = Number(partes[1]);
      }

      setAnioSeleccionado(anioCalculado);
      setMesSeleccionado(mesCalculado);
    }
    calcularPeriodoExacto();
  }, [empresaId, sucursalId, moduloSeleccionado, empresas, isMounted]);

  // Cargar aperturas cuando se selecciona la pestaña correspondiente
  useEffect(() => {
    if (!empresaId || pestanaActiva !== "aperturas" || !isMounted) return;
    async function cargarAperturas() {
      const res = await obtenerPeriodosAperturas(Number(empresaId), Number(sucursalId) || 0);
      if (res.success) {
        const lista = res.data || [];
        setPeriodosApertura(lista);
        
        if (lista.length > 0) {
          const ultimo = lista[0]; 
          let nMes = ultimo.mes + 1;
          let nAnio = ultimo.anio;
          if (nMes > 12) {
            nMes = 1;
            nAnio += 1;
          }
          setSiguientePeriodoApertura({ anio: nAnio, mes: nMes });
        }
      }
    }
    cargarAperturas();
  }, [empresaId, sucursalId, pestanaActiva, isMounted]);

  const handleHabilitarNuevoPeriodo = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setGuardando(true);

    try {
      const res = await habilitarPeriodoAperturaServer({
        empresaId: Number(empresaId),
        sucursalId: Number(sucursalId) || 0,
        anio: siguientePeriodoApertura.anio,
        mes: siguientePeriodoApertura.mes,
      });

      if (!res || res.success === false) {
        throw new Error(res?.error || "Error al habilitar el período.");
      }

      setSuccessMsg(res.mensaje ?? "Período habilitado con éxito.");

      let nuevoMes = siguientePeriodoApertura.mes + 1;
      let nuevoAnio = siguientePeriodoApertura.anio;
      if (nuevoMes > 12) {
        nuevoMes = 1;
        nuevoAnio += 1;
      }
      setSiguientePeriodoApertura({ anio: nuevoAnio, mes: nuevoMes });
      
      const resAperturas = await obtenerPeriodosAperturas(Number(empresaId), Number(sucursalId) || 0);
      if (resAperturas.success) {
        setPeriodosApertura(resAperturas.data || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleBloquearPeriodo = async (periodoDesde: string) => {
    if (!confirm("¿Estás seguro de bloquear/cerrar este período de apertura? Se impedirá la creación de documentos en él.")) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await bloquearPeriodoAperturaServer({
      empresaId: Number(empresaId),
      sucursalId: Number(sucursalId) || 0,
      periodoDesde,
    });

    if (res.success) {
      setSuccessMsg(res.mensaje ?? "Período bloqueado con éxito.");
      const resAperturas = await obtenerPeriodosAperturas(Number(empresaId), Number(sucursalId) || 0);
      if (resAperturas.success) setPeriodosApertura(resAperturas.data || []);
    } else {
      setErrorMsg(res.error);
    }
  };

  const handleDesbloquearPeriodo = async (periodoDesde: string) => {
    if (!confirm("¿Estás seguro de desbloquear este período de apertura? Se habilitará nuevamente para la creación de documentos.")) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await desbloquearPeriodoAperturaServer({
      empresaId: Number(empresaId),
      sucursalId: Number(sucursalId) || 0,
      periodoDesde,
    });

    if (res.success) {
      setSuccessMsg(res.mensaje ?? "Período desbloqueado con éxito.");
      const resAperturas = await obtenerPeriodosAperturas(Number(empresaId), Number(sucursalId) || 0);
      if (resAperturas.success) setPeriodosApertura(resAperturas.data || []);
    } else {
      setErrorMsg(res.error);
    }
  };

  const handleSimularCierreAnual = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setGuardando(true);
    setDatosSimulacionAnual(null);

    try {
      const res = await procesarCierreAnualServer({
        empresaId: Number(empresaId),
        sucursalId: Number(sucursalId) || 0,
        anio: Number(anioAnualSeleccionado),
        cuentaPatrimonioId: cuentaUtilidadId ? Number(cuentaUtilidadId) : undefined,
        claseDocumentoId: claseDocumentoId ? Number(claseDocumentoId) : undefined,
        soloSimular: true,
      });

      if (!res || res.success === false) {
        throw new Error(res?.error || "Error al simular el cierre anual.");
      }

      setSuccessMsg(res.mensaje ?? null);
      setDatosSimulacionAnual(res.detalles || []);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Ocurrió un error desconocido.");
    } finally {
      setGuardando(false);
    }
  };

  const handleGrabarCierreAnual = async () => {
    if (!confirm("¿Está seguro de grabar el comprobante de Cierre Anual (Mes 13)? Esta acción cerrará fiscalmente el año.")) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setGuardando(true);

    try {
      const res = await procesarCierreAnualServer({
        empresaId: Number(empresaId),
        sucursalId: Number(sucursalId) || 0,
        anio: Number(anioAnualSeleccionado),
        cuentaPatrimonioId: Number(cuentaUtilidadId),
        claseDocumentoId: Number(claseDocumentoId),
        soloSimular: false,
      });

      if (!res || res.success === false) {
        throw new Error(res?.error || "Error al grabar el cierre anual.");
      }

      setSuccessMsg(res.mensaje ?? null);
      setDatosSimulacionAnual(null);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Ocurrió un error desconocido.");
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleEstadoClase = async (claseId: number, estadoActual: string) => {
    const nuevoEstado = estadoActual === "Inactiva" ? "Activa" : "Inactiva";
    const res = await actualizarEstadoClaseDocumento(claseId, nuevoEstado);
    if (res.success) {
      setClasesDocumento((prev) => prev.map((c) => (c.id === claseId ? { ...c, estado: nuevoEstado } : c)));
    } else {
      alert("Error al actualizar la clase de documento: " + res.error);
    }
  };

  const handleCambiarEstadoTodasClases = async (nuevoEstado: "Activa" | "Inactiva") => {
    if (!empresaId) return;
    const res = await actualizarEstadoTodasClasesDocumento(Number(empresaId), nuevoEstado);
    if (res.success) {
      setClasesDocumento((prev) => prev.map((c) => ({ ...c, estado: nuevoEstado })));
    } else {
      alert("Error al actualizar todas las clases: " + res.error);
    }
  };

  const handleEjecutarCierreMensual = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setGuardando(true);

    try {
      const anio = Number(anioSeleccionado);
      const mes = Number(mesSeleccionado);
      const periodoDesde = `${anio}-${String(mes).padStart(2, "0")}-01`;
      const ultimoDia = new Date(anio, mes, 0).getDate();
      const periodoHasta = `${anio}-${String(mes).padStart(2, "0")}-${ultimoDia}`;

      const res = await ejecutarCierreServer({
        empresaId: Number(empresaId),
        sucursalId: Number(sucursalId) || 0,
        modulo: moduloSeleccionado,
        subtipoProceso: "CIERRE_MENSUAL",
        periodoDesde,
        periodoHasta,
      });

      if (!res || res.success === false) {
        throw new Error(res?.error || "Error desconocido al procesar el cierre.");
      }

      setSuccessMsg(res.mensaje ?? `¡Cierre del módulo ${moduloSeleccionado} ejecutado con éxito para ${mes}/${anio}!`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!isMounted) return <div className="p-4 text-center text-xs text-slate-400">Cargando módulo de cierres...</div>;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 text-xs">
      <div className="border-b pb-2">
        <h1 className="text-base font-bold text-slate-800">Módulo de Cierres Contables y Aperturas</h1>
        <p className="text-[11px] text-slate-500">Gestión de periodos mensuales, cierre anual (mes 13) y control de apertura de documentos.</p>
      </div>

      {errorMsg && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded font-medium">⚠ {errorMsg}</div>}
      {successMsg && <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded font-medium">✔ {successMsg}</div>}

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
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Sucursal</label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Todas las Sucursales (Consolidado / 001 por defecto) --</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.nombre} ({suc.codigo_sucursal})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => { setPestanaActiva("mensual"); setErrorMsg(null); setSuccessMsg(null); }}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition ${pestanaActiva === "mensual" ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          📅 Cierre Mensual
        </button>
        <button
          type="button"
          onClick={() => { setPestanaActiva("anual"); setErrorMsg(null); setSuccessMsg(null); }}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition ${pestanaActiva === "anual" ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          📊 Cierre Anual (Mes 13)
        </button>
        <button
          type="button"
          onClick={() => { setPestanaActiva("aperturas"); setErrorMsg(null); setSuccessMsg(null); }}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition ${pestanaActiva === "aperturas" ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          🔓 Control de Aperturas
        </button>
      </div>

      {pestanaActiva === "mensual" && (
        <form onSubmit={handleEjecutarCierreMensual} className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Módulo a Cerrar</label>
            <select
              value={moduloSeleccionado}
              onChange={(e) => setModuloSeleccionado(e.target.value)}
              className="w-full md:w-1/3 bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
            >
              {MODULOS_DISPONIBLES.map((mod) => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-800 uppercase tracking-wider border-b pb-1 text-[11px]">
              Período de Cierre Siguiente (Automático)
            </h2>

            <div className="flex items-center gap-3">
              <div>
                <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Año</label>
                <input
                  type="number"
                  value={anioSeleccionado}
                  disabled
                  className="w-24 bg-slate-100 border border-slate-300 rounded px-2 py-1 text-slate-700 font-mono text-center cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Mes</label>
                <input
                  type="text"
                  value={new Date(0, mesSeleccionado - 1).toLocaleString('es', { month: 'long' }).toUpperCase()}
                  disabled
                  className="w-36 bg-slate-100 border border-slate-300 rounded px-2 py-1 text-slate-700 font-semibold text-center cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t mt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="checkDoc"
                  checked={incluirCierreDocumentos}
                  onChange={(e) => setIncluirCierreDocumentos(e.target.checked)}
                  className="cursor-pointer accent-blue-600"
                />
                <label htmlFor="checkDoc" className="font-semibold text-slate-700 cursor-pointer">
                  Gestionar / bloquear clases de documentos en este cierre
                </label>
              </div>

              <button
                type="submit"
                disabled={guardando}
                className={`px-5 py-2 font-bold rounded shadow transition text-xs text-white ${moduloSeleccionado === "CONTABILIDAD" ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"} disabled:opacity-50`}
              >
                {guardando ? "Procesando cierre..." : moduloSeleccionado === "CONTABILIDAD" ? "🔒 Ejecutar Cierre Contable y Actualizar Saldos" : `🔒 Cerrar Período (${moduloSeleccionado})`}
              </button>
            </div>
          </div>
        </form>
      )}

      {pestanaActiva === "anual" && (
        <div className="space-y-4">
          <form onSubmit={handleSimularCierreAnual} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <div className="border-b pb-2">
              <h2 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Cierre Anual (Cancelación de Cuentas de Resultados - Mes 13)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Valida los 12 meses previos cerrados, selecciona la cuenta de patrimonio y la clase de documento para previsualizar el comprobante.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 uppercase mb-1 text-[11px]">Año Fiscal a Cerrar</label>
                <input
                  type="number"
                  value={anioAnualSeleccionado}
                  onChange={(e) => { setAnioAnualSeleccionado(Number(e.target.value)); setDatosSimulacionAnual(null); }}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-slate-800 font-mono text-xs outline-none bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 uppercase mb-1 text-[11px]">Cuenta Auxiliar (Patrimonio - Utilidad)</label>
                <select
                  value={cuentaUtilidadId}
                  onChange={(e) => setCuentaUtilidadId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-slate-800 font-medium text-xs outline-none bg-white"
                  required
                >
                  <option value="">-- Seleccione Cuenta de Patrimonio --</option>
                  {cuentasPatrimonio.map((cta) => (
                    <option key={cta.id} value={cta.id}>
                      {cta.codigo_auxiliar} - {cta.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 uppercase mb-1 text-[11px]">Clase de Documento (Cierre Anual)</label>
                <select
                  value={claseDocumentoId}
                  onChange={(e) => setClaseDocumentoId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-slate-800 font-medium text-xs outline-none bg-white"
                  required
                >
                  <option value="">-- Seleccione Clase de Documento --</option>
                  {clasesDocumento.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.codigo_clase} - {doc.nombre_clase}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded shadow transition text-xs flex items-center gap-1.5"
              >
                {guardando ? "Calculando..." : "🔍 1. Simular / Verificar Proceso"}
              </button>
            </div>
          </form>

          {datosSimulacionAnual && (
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
              <div className="border-b pb-2 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Previsualización de Saldos para Cancelación (Año {anioAnualSeleccionado})
                </h3>
                <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[10px]">
                  ✔ Verificación Exitosa
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-slate-600 border-collapse">
                  <thead className="bg-slate-100 border-b text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Elemento / Tipo</th>
                      <th className="p-2">Código Auxiliar</th>
                      <th className="p-2">Nombre del Concepto</th>
                      <th className="p-2 text-right">Saldo Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {datosSimulacionAnual.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                          No se encontraron registros de saldos acumulados auxiliares para el año {anioAnualSeleccionado}.
                        </td>
                      </tr>
                    ) : (
                      datosSimulacionAnual.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-800">{item.tipo}</td>
                          <td className="p-2 font-mono">{item.cuenta}</td>
                          <td className="p-2">{item.nombre}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-800">
                            ${Number(item.saldo || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 flex justify-between items-center border-t">
                <p className="text-[11px] text-slate-500 italic">
                  * Verifique que los valores correspondan al cierre fiscal antes de ejecutar la grabación definitiva.
                </p>
                <button
                  type="button"
                  onClick={handleGrabarCierreAnual}
                  disabled={guardando}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded shadow transition text-xs flex items-center gap-1.5"
                >
                  {guardando ? "Grabando..." : "💾 2. Grabar Comprobante de Cierre (Mes 13)"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {pestanaActiva === "aperturas" && (
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b pb-3 gap-3">
            <div>
              <h2 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Control de Apertura de Periodos (Comprobantes y Documentos)
              </h2>
              <p className="text-[11px] text-slate-500">
                Permite habilitar nuevos períodos o visualizar el estado de control para la elaboración de documentos.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 self-end lg:self-auto">
              <span className="font-semibold text-slate-600 text-[11px]">Siguiente Período:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-300 font-bold text-slate-800 text-xs">
                {siguientePeriodoApertura.anio}-{String(siguientePeriodoApertura.mes).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={handleHabilitarNuevoPeriodo}
                disabled={guardando}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] shadow disabled:opacity-50 transition flex items-center gap-1"
              >
                {guardando ? "Habilitando..." : "🔓 Abrir / Habilitar"}
              </button>
            </div>
          </div>

          {periodosApertura.length === 0 ? (
            <div className="p-4 text-center text-slate-400 italic">No hay periodos registrados o falta configurar la fecha de inicio de operaciones.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-slate-600 border-collapse">
                <thead className="bg-slate-100 border-b text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3 w-1/3">Período (Año - Mes)</th>
                    <th className="p-3 text-center w-1/4">Estado de Operación</th>
                    <th className="p-3 text-center w-5/12">Detalle / Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {periodosApertura.map((p) => (
                    <tr key={p.periodo} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {p.anio}-{String(p.mes).padStart(2, "0")} ({new Date(p.anio, p.mes - 1).toLocaleString('es', { month: 'long' }).toUpperCase()})
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded font-semibold text-[10px] ${p.estado === "Cerrado" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {p.estado}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {p.esCierreContable ? (
                          <span className="text-rose-600 font-semibold inline-flex items-center gap-1 justify-center">
                            🔒 Bloqueado por Cierre Contable
                          </span>
                        ) : p.estado === "Cerrado" ? (
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-rose-600 font-semibold">🔒 Bloqueado / Cerrado</span>
                            <button
                              type="button"
                              onClick={() => handleDesbloquearPeriodo(`${p.periodo}-01`)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] shadow transition inline-flex items-center gap-1"
                            >
                              🔓 Desbloquear
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-emerald-600 font-semibold">✔ Habilitado para Documentos</span>
                            <button
                              type="button"
                              onClick={() => handleBloquearPeriodo(`${p.periodo}-01`)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[10px] shadow transition inline-flex items-center gap-1"
                            >
                              🔒 Bloquear
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {pestanaActiva === "mensual" && incluirCierreDocumentos && (
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-1">
            <h2 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Control de Clases de Documento
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleCambiarEstadoTodasClases("Activa")}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[10px] shadow"
              >
                ✔ Activar Todas
              </button>
              <button
                type="button"
                onClick={() => handleCambiarEstadoTodasClases("Inactiva")}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-[10px] shadow"
              >
                🔒 Inactivar Todas
              </button>
            </div>
          </div>

          {clasesDocumento.length === 0 ? (
            <div className="p-4 text-center text-slate-400 italic">No hay clases de documento registradas para esta empresa.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-slate-600 border-collapse">
                <thead className="bg-slate-100 border-b text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Código</th>
                    <th className="p-2">Nombre Clase</th>
                    <th className="p-2 text-center">Estado Actual</th>
                    <th className="p-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {clasesDocumento.map((clase) => (
                    <tr key={clase.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold">{clase.codigo_clase}</td>
                      <td className="p-2 font-semibold text-slate-800">{clase.nombre_clase}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${clase.estado === "Inactiva" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {clase.estado || "Activa"}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleEstadoClase(clase.id, clase.estado || "Activa")}
                          className={`px-3 py-1 rounded font-semibold text-[10px] shadow transition ${clase.estado === "Inactiva" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}`}
                        >
                          {clase.estado === "Inactiva" ? "✔ Habilitar" : "🔒 Bloquear Uso"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}