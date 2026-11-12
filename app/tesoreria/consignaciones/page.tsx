"use client";

import React, { useState, useEffect, useMemo, ChangeEvent, FormEvent } from "react";
import { obtenerEmpresas, obtenerSucursales } from "@/app/consultas/movimientos/movimientos-actions";
import { obtenerDatosBaseConsignacion, ejecutarConsignacionBancaria, ChequeEnCaja } from "./consignaciones-actions";
import { validarPeriodoContable } from "@/lib/accounting-validations";

interface Empresa {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
}

interface Sucursal {
  id: number | string;
  nombre?: string;
}

interface CuentaFinanciera {
  id: number | string;
  nombre_cuenta?: string;
  numero_cuenta?: string;
}

interface ConceptoAuxiliar {
  id: number | string;
  codigo_auxiliar?: string;
  nombre?: string;
}

interface ClaseDocumento {
  id: number | string;
  nombre_clase?: string;
}

export default function ConsignacionesPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  // Listas base
  const [cuentasBancos, setCuentasBancos] = useState<CuentaFinanciera[]>([]);
  const [conceptosAuxiliares, setConceptosAuxiliares] = useState<ConceptoAuxiliar[]>([]);
  const [clasesDoc, setClasesDoc] = useState<ClaseDocumento[]>([]);
  const [chequesEnCaja, setChequesEnCaja] = useState<ChequeEnCaja[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Formulario
  const [tipoConsignacion, setTipoConsignacion] = useState<"EFECTIVO" | "CHEQUES">("EFECTIVO");
  const [cuentaBancoId, setCuentaBancoId] = useState<string>("");
  const [claseDocId, setClaseDocId] = useState<string>("");
  const [conceptoAuxiliarId, setConceptoAuxiliarId] = useState<string>("");
  const [valorEfectivo, setValorEfectivo] = useState<number>(0);
  const [chequesSeleccionados, setChequesSeleccionados] = useState<{ [key: number]: boolean }>({});
  const [fechaContable, setFechaContable] = useState<string>("");
  const [glosa, setGlosa] = useState<string>("Consignación bancaria de tesorería");
  const [procesando, setProcesando] = useState<boolean>(false);

  // Estados para Control de Periodo Contable
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    setFechaContable(new Date().toISOString().split("T")[0]);
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

  // Validar automáticamente al cambiar empresa, sucursal
  useEffect(() => {
    if (empresaId && sucursalId && fechaContable) {
      verificarPeriodo(fechaContable);
    }
  }, [empresaId, sucursalId, fechaContable]);

  // Carga inicial de empresas y sincronización con cookie corporativa empresa_activa
  useEffect(() => {
    async function init() {
      const res = await obtenerEmpresas();
      if (res.success && res.data && res.data.length > 0) {
        const listaEmpresas: Empresa[] = res.data;
        setEmpresas(listaEmpresas);

        // Leer cookie corporativa empresa_activa o localStorage
        const match = document.cookie.match(new RegExp('(^| )empresa_activa=([^;]+)'));
        let empresaIdAUsar = String(listaEmpresas[0].id);

        if (match && listaEmpresas.some((e) => String(e.id) === match[2])) {
          empresaIdAUsar = match[2];
        } else {
          const idGuardado = localStorage.getItem('empresa_id');
          if (idGuardado && listaEmpresas.some((e) => String(e.id) === idGuardado)) {
            empresaIdAUsar = idGuardado;
          }
        }

        setEmpresaId(empresaIdAUsar);
        localStorage.setItem('empresa_id', empresaIdAUsar);
        document.cookie = `empresa_activa=${empresaIdAUsar}; path=/; max-age=86400; SameSite=Lax`;

        const sucRes = await obtenerSucursales(Number(empresaIdAUsar));
        if (sucRes.success && sucRes.data && sucRes.data.length > 0) {
          const listaSucursales: Sucursal[] = sucRes.data;
          setSucursales(listaSucursales);
          setSucursalId(String(listaSucursales[0].id));
        }
      }
    }
    init();
  }, []);

  // Cargar sucursales al cambiar de empresa
  useEffect(() => {
    if (!empresaId) return;
    async function cargarSucursalesEmpresa() {
      const sucRes = await obtenerSucursales(Number(empresaId));
      if (sucRes.success) {
        const listaSuc: Sucursal[] = sucRes.data || [];
        setSucursales(listaSuc);
        if (listaSuc.length > 0) {
          setSucursalId(String(listaSuc[0].id));
        } else {
          setSucursalId("");
        }
      }
    }
    cargarSucursalesEmpresa();
  }, [empresaId]);

  // Cargar cuentas, conceptos, clases y cheques de la empresa y sucursal activa
  useEffect(() => {
    if (!empresaId || !sucursalId) {
      setCuentasBancos([]);
      setConceptosAuxiliares([]);
      setClasesDoc([]);
      setChequesEnCaja([]);
      return;
    }

    async function cargarDatos() {
      setLoading(true);
      const parsedEmpresaId = Number(empresaId);
      const parsedSucursalId = Number(sucursalId);

      const baseRes = await obtenerDatosBaseConsignacion(parsedEmpresaId, parsedSucursalId);

      if (baseRes.success) {
        setCuentasBancos(baseRes.cuentasBancos || []);
        setConceptosAuxiliares(baseRes.conceptosAuxiliares || []);
        setClasesDoc(baseRes.clasesDocumento || []);
        setChequesEnCaja(baseRes.chequesEnCaja || []);

        if (baseRes.cuentasBancos && baseRes.cuentasBancos.length > 0) {
          setCuentaBancoId(String(baseRes.cuentasBancos[0].id));
        } else {
          setCuentaBancoId("");
        }

        if (baseRes.clasesDocumento && baseRes.clasesDocumento.length > 0) {
          setClaseDocId(String(baseRes.clasesDocumento[0].id));
        } else {
          setClaseDocId("");
        }

        if (baseRes.conceptosAuxiliares && baseRes.conceptosAuxiliares.length > 0) {
          setConceptoAuxiliarId(String(baseRes.conceptosAuxiliares[0].id));
        } else {
          setConceptoAuxiliarId("");
        }
      }
      setChequesSeleccionados({});
      setLoading(false);
    }
    cargarDatos();
  }, [empresaId, sucursalId]);

  const handleToggleCheque = (id: number) => {
    setChequesSeleccionados((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalValorConsignacion = useMemo(() => {
    if (tipoConsignacion === "EFECTIVO") {
      return Number(valorEfectivo || 0);
    } else {
      return Object.keys(chequesSeleccionados)
        .filter((id) => chequesSeleccionados[Number(id)])
        .reduce((acc, id) => {
          const chq = chequesEnCaja.find((c) => c.id === Number(id));
          return acc + Number(chq?.monto || 0);
        }, 0);
    }
  }, [tipoConsignacion, valorEfectivo, chequesSeleccionados, chequesEnCaja]);

  const fmt = (v: number) => `$ ${Math.round(Number(v || 0)).toLocaleString("es-CO")}`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (errorPeriodo) {
      alert("No se puede ejecutar la consignación porque el periodo contable no es válido o está cerrado.");
      return;
    }

    if (!empresaId || !sucursalId) {
      alert("La Empresa y la Sucursal son obligatorias.");
      return;
    }
    if (!cuentaBancoId) {
      alert("Seleccione la cuenta bancaria de destino.");
      return;
    }
    if (!claseDocId) {
      alert("Seleccione la clase de documento.");
      return;
    }
    if (!conceptoAuxiliarId) {
      alert("Seleccione el concepto auxiliar contable (contrapartida crédito).");
      return;
    }
    if (tipoConsignacion === "EFECTIVO" && valorEfectivo <= 0) {
      alert("Ingrese un valor de efectivo válido.");
      return;
    }

    const chequesIdsList = Object.keys(chequesSeleccionados)
      .filter((id) => chequesSeleccionados[Number(id)])
      .map((id) => Number(id));

    if (tipoConsignacion === "CHEQUES" && chequesIdsList.length === 0) {
      alert("Seleccione al menos un cheque de la lista.");
      return;
    }

    setProcesando(true);

    const res = await ejecutarConsignacionBancaria({
      empresa_id: Number(empresaId),
      sucursal_id: Number(sucursalId),
      clase_documento_id: Number(claseDocId),
      cuenta_financiera_id: Number(cuentaBancoId),
      fecha_contable: fechaContable,
      tipo_consignacion: tipoConsignacion,
      concepto_auxiliar_id: Number(conceptoAuxiliarId),
      valor_efectivo: tipoConsignacion === "EFECTIVO" ? Number(valorEfectivo) : 0,
      cheques_ids: tipoConsignacion === "CHEQUES" ? chequesIdsList : [],
      glosa,
    });

    if (res && res.success) {
      alert(`¡Consignación procesada con éxito! Comprobante N°: ${res.numero_documento}`);
      window.location.reload();
    } else {
      alert("Error al procesar la consignación: " + (res?.error || "Error desconocido"));
    }
    setProcesando(false);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 text-xs font-sans">
      <div className="border-b pb-2 flex justify-between items-center">
        <div>
          <h1 className="text-base font-bold text-slate-800">Módulo de Consignaciones Bancarias</h1>
          <p className="text-[11px] text-slate-500">Registro de depósitos de efectivo (Caja) y cheques en custodia (En Caja).</p>
        </div>

        {/* SELECTOR TIPO DE CONSIGNACIÓN */}
        <div className="flex gap-1 bg-slate-200 p-1 rounded">
          <button
            type="button"
            onClick={() => setTipoConsignacion("EFECTIVO")}
            className={`px-3 py-1 font-bold rounded text-[11px] transition cursor-pointer ${
              tipoConsignacion === "EFECTIVO" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300"
            }`}
          >
            💵 Consignar Efectivo
          </button>
          <button
            type="button"
            onClick={() => setTipoConsignacion("CHEQUES")}
            className={`px-3 py-1 font-bold rounded text-[11px] transition cursor-pointer ${
              tipoConsignacion === "CHEQUES" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300"
            }`}
          >
            📜 Consignar Cheques
          </button>
        </div>
      </div>

      {/* FILTROS / CONTROLES GENERALES */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Empresa *</label>
          <select
            value={empresaId}
            onChange={(e) => {
              const nuevoId = e.target.value;
              setEmpresaId(nuevoId);
              if (nuevoId) {
                localStorage.setItem("empresa_id", nuevoId);
                document.cookie = `empresa_activa=${nuevoId}; path=/; max-age=86400; SameSite=Lax`;
              }
            }}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate cursor-pointer"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.razon_social || emp.nombre_comercial}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Sucursal *</label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none cursor-pointer"
          >
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Clase de Documento</label>
          <select
            value={claseDocId}
            onChange={(e) => setClaseDocId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none cursor-pointer"
          >
            {clasesDoc.map((cd) => (
              <option key={cd.id} value={cd.id}>{cd.nombre_clase}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Cuenta Bancaria Destino</label>
          <select
            value={cuentaBancoId}
            onChange={(e) => setCuentaBancoId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate cursor-pointer"
          >
            {cuentasBancos.map((cta) => (
              <option key={cta.id} value={cta.id}>{cta.nombre_cuenta} ({cta.numero_cuenta})</option>
            ))}
          </select>
        </div>

        {/* Fecha Contable con Validación en Tiempo Real */}
        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Fecha Contable *</label>
          <input
            type="date"
            value={fechaContable}
            onChange={(e) => {
              setFechaContable(e.target.value);
              if (errorPeriodo) setErrorPeriodo(null);
            }}
            onBlur={() => verificarPeriodo(fechaContable)}
            required
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
          />
          {validandoPeriodo && (
            <p className="text-[9px] text-blue-600 mt-0.5 animate-pulse">Verificando periodo...</p>
          )}
          {errorPeriodo && (
            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1 rounded mt-0.5">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>

        {/* CONCEPTO AUXILIAR CONTABLE */}
        <div className="md:col-span-6">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Concepto Auxiliar Contable (Contrapartida Crédito)
          </label>
          <select
            value={conceptoAuxiliarId}
            onChange={(e) => setConceptoAuxiliarId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate cursor-pointer"
          >
            {conceptosAuxiliares.map((ca) => (
              <option key={ca.id} value={ca.id}>[{ca.codigo_auxiliar}] {ca.nombre}</option>
            ))}
          </select>
        </div>

        {tipoConsignacion === "EFECTIVO" && (
          <div className="md:col-span-6">
            <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Valor en Efectivo a Consignar</label>
            <input
              type="number"
              placeholder="Ej: 1500000"
              value={valorEfectivo || ""}
              onChange={(e) => setValorEfectivo(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-800 outline-none"
            />
          </div>
        )}
      </div>

      {/* BARRA DE GLOSA Y EJECUCIÓN */}
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-1/2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Glosa / Concepto General</label>
          <input
            type="text"
            value={glosa}
            onChange={(e) => setGlosa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-slate-500 uppercase text-[10px] block font-bold">Total Consignación:</span>
            <span className="font-mono font-bold text-emerald-700 text-base">{fmt(totalValorConsignacion)}</span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isMounted || procesando || totalValorConsignacion <= 0 || !empresaId || !sucursalId || Boolean(errorPeriodo)}
            suppressHydrationWarning
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded shadow transition text-xs cursor-pointer"
          >
            {procesando ? "Procesando..." : "💾 Ejecutar Consignación"}
          </button>
        </div>
      </div>

      {/* TABLA DE CHEQUES EN CAJA */}
      {tipoConsignacion === "CHEQUES" && (
        <div className="space-y-2">
          <h2 className="font-bold text-slate-700 uppercase text-[11px]">Cheques Disponibles en Caja (Estado: En_Caja)</h2>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Cargando títulos valores...</div>
          ) : chequesEnCaja.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic bg-white border rounded-lg">
              No hay cheques disponibles en caja para la empresa y sucursal seleccionada.
            </div>
          ) : (
            <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
                  <tr>
                    <th className="p-2 text-center w-10">Sel.</th>
                    <th className="p-2">N° Cheque</th>
                    <th className="p-2">Banco Emisor</th>
                    <th className="p-2">Girador</th>
                    <th className="p-2 text-center">F. Expedición</th>
                    <th className="p-2 text-center">F. Cobro Posfechado</th>
                    <th className="p-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[10px]">
                  {chequesEnCaja.map((chq) => {
                    const sel = !!chequesSeleccionados[chq.id];
                    const bancoNombre = chq.banco_girador?.nombre_banco || "N/A";
                    const giradorNombre = chq.tercero_girador?.razon_social || "N/A";

                    return (
                      <tr key={chq.id} className={sel ? "bg-indigo-50/40" : "hover:bg-slate-50"}>
                        <td className="p-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => handleToggleCheque(chq.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-2 font-bold text-slate-900 align-middle">{chq.numero_titulo}</td>
                        <td className="p-2 text-slate-700 align-middle">{bancoNombre}</td>
                        <td className="p-2 text-slate-700 align-middle">{giradorNombre}</td>
                        <td className="p-2 text-center text-slate-600 align-middle">{chq.fecha_expedicion}</td>
                        <td className="p-2 text-center text-slate-600 align-middle">{chq.fecha_cobro_posfechado}</td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700 align-middle">{fmt(chq.monto)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}