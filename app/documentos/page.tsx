"use client";

import React, { useState, useEffect, useRef } from "react";
import { obtenerEmpresas, obtenerSucursales } from "@/app/consultas/movimientos/movimientos-actions";
import { obtenerClasesDocumentosPorTipo, obtenerAuxiliaresParaDocumentos, obtenerTerceros, obtenerTitulosValoresPorCuenta, guardarDocumentoContable } from "./documentos-actions";
import { validarPeriodoContable } from "@/lib/accounting-validations";

interface DetalleFila {
  concepto_auxiliar_id: string;
  busquedaAuxiliar: string;
  showAuxDropdown: boolean;
  tercero_id: string;
  cuenta_financiera_id: string;
  titulo_valor_id: string;
  titulosDisponibles: any[];
  debito: string;
  credito: string;
}

export default function DocumentosContablesPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [clasesDocs, setClasesDocs] = useState<any[]>([]);
  const [auxiliares, setAuxiliares] = useState<any[]>([]);
  const [terceros, setTerceros] = useState<any[]>([]);

  // Tipo de Operación: false = Contable, true = Bancario
  const [esBancario, setEsBancario] = useState<boolean>(false);

  // Encabezado
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [claseDocumentoId, setClaseDocumentoId] = useState<string>("");
  const [fechaEmision, setFechaEmision] = useState<string>(new Date().toISOString().split("T")[0]);
  const [fechaContable, setFechaContable] = useState<string>(new Date().toISOString().split("T")[0]);
  const [glosaConcepto, setGlosaConcepto] = useState<string>("");

  // Estados para Control de Periodo Contable
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  // Detalle dinámico
  const [detalles, setDetalles] = useState<DetalleFila[]>([
    { concepto_auxiliar_id: "", busquedaAuxiliar: "", showAuxDropdown: false, tercero_id: "", cuenta_financiera_id: "", titulo_valor_id: "", titulosDisponibles: [], debito: "", credito: "" },
    { concepto_auxiliar_id: "", busquedaAuxiliar: "", showAuxDropdown: false, tercero_id: "", cuenta_financiera_id: "", titulo_valor_id: "", titulosDisponibles: [], debito: "", credito: "" }
  ]);

  const [loading, setLoading] = useState<boolean>(false);
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

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

  useEffect(() => {
    if (empresaId && sucursalId && fechaContable && isMounted) {
      verificarPeriodo(fechaContable);
    }
  }, [empresaId, sucursalId, isMounted]);

  useEffect(() => {
    setIsMounted(true);
    async function init() {
      const resEmp = await obtenerEmpresas();
      if (resEmp.success && resEmp.data && resEmp.data.length > 0) {
        setEmpresas(resEmp.data);
        setEmpresaId(String(resEmp.data[0].id));
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    function handleClickOutside(event: MouseEvent) {
      setDetalles(prev => prev.map((fila, idx) => {
        const ref = dropdownRefs.current[idx];
        if (ref && !ref.contains(event.target as Node)) {
          return { ...fila, showAuxDropdown: false };
        }
        return fila;
      }));
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMounted]);

  useEffect(() => {
    if (!empresaId || !isMounted) return;
    
    async function cargarDatosEmpresa() {
      const parsedEmpresaId = Number(empresaId);
      
      const sucRes = await obtenerSucursales(parsedEmpresaId);
      if (sucRes.success) {
        setSucursales(sucRes.data || []);
        if (sucRes.data && (sucRes.data as any[]).length > 0) {
          setSucursalId(String((sucRes.data as any[])[0].id));
        } else {
          setSucursalId("");
        }
      }

      const claseRes = await obtenerClasesDocumentosPorTipo(parsedEmpresaId, esBancario);
      if (claseRes.success && claseRes.data) {
        setClasesDocs(claseRes.data);
        if (claseRes.data.length > 0) {
          setClaseDocumentoId(String(claseRes.data[0].id));
        } else {
          setClaseDocumentoId("");
        }
      } else {
        setClasesDocs([]);
        setClaseDocumentoId("");
      }

      const auxRes = await obtenerAuxiliaresParaDocumentos(parsedEmpresaId, esBancario);
      if (auxRes.success) setAuxiliares(auxRes.data || []);

      const terRes = await obtenerTerceros(parsedEmpresaId);
      if (terRes.success) setTerceros(terRes.data || []);
    }

    cargarDatosEmpresa();
  }, [empresaId, esBancario, isMounted]);

  const agregarFila = () => {
    setDetalles([...detalles, { 
      concepto_auxiliar_id: "", 
      busquedaAuxiliar: "", 
      showAuxDropdown: false, 
      tercero_id: "", 
      cuenta_financiera_id: "", 
      titulo_valor_id: "", 
      titulosDisponibles: [],
      debito: "", 
      credito: "" 
    }]);
  };

  const eliminarFila = (index: number) => {
    if (detalles.length === 1) return;
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const actualizarFila = (index: number, campo: string, valor: any) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index] = { ...nuevosDetalles[index], [campo]: valor };
    
    if (campo === "debito" && Number(valor) > 0) {
      nuevosDetalles[index].credito = "";
    } else if (campo === "credito" && Number(valor) > 0) {
      nuevosDetalles[index].debito = "";
    }

    setDetalles(nuevosDetalles);
  };

  const seleccionarAuxiliar = async (index: number, aux: any) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index].concepto_auxiliar_id = String(aux.id);
    nuevosDetalles[index].busquedaAuxiliar = `[${aux.codigo}] ${aux.nombre}`;
    nuevosDetalles[index].showAuxDropdown = false;

    if (aux.tipo_entidad === "Cuentas_Bancarias") {
      const bancoId = aux.id;
      nuevosDetalles[index].cuenta_financiera_id = String(bancoId);
      nuevosDetalles[index].titulo_valor_id = "";

      const resTv = await obtenerTitulosValoresPorCuenta(empresaId, bancoId);
      if (resTv.success) {
        nuevosDetalles[index].titulosDisponibles = resTv.data || [];
      }
    } else {
      nuevosDetalles[index].cuenta_financiera_id = "";
      nuevosDetalles[index].titulo_valor_id = "";
      nuevosDetalles[index].titulosDisponibles = [];
    }

    setDetalles(nuevosDetalles);
  };

  const seleccionarTituloValor = (index: number, tvId: string) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index].titulo_valor_id = tvId;

    if (!tvId) {
      nuevosDetalles[index].tercero_id = "";
      nuevosDetalles[index].debito = "";
      nuevosDetalles[index].credito = "";
      setDetalles(nuevosDetalles);
      return;
    }

    const fila = nuevosDetalles[index];
    const tvSeleccionado = fila.titulosDisponibles.find((t: any) => String(t.id) === tvId);
    
    if (tvSeleccionado) {
      if (tvSeleccionado.tercero_girador_id) {
        nuevosDetalles[index].tercero_id = String(tvSeleccionado.tercero_girador_id);
      }

      const montoVal = String(tvSeleccionado.monto || 0);
      nuevosDetalles[index].debito = "";
      nuevosDetalles[index].credito = montoVal;
    }

    setDetalles(nuevosDetalles);
  };

  const handleFocusDebito = (index: number) => {
    const fila = detalles[index];
    if (fila.titulo_valor_id) return;

    if ((!fila.credito || Number(fila.credito) === 0) && (!fila.debito || Number(fila.debito) === 0)) {
      const currentDebitos = detalles.reduce((acc, d, i) => i === index ? acc : acc + Number(d.debito || 0), 0);
      const currentCreditos = detalles.reduce((acc, d, i) => i === index ? acc : acc + Number(d.credito || 0), 0);
      const faltante = currentCreditos - currentDebitos;

      if (faltante > 0) {
        const nuevosDetalles = [...detalles];
        nuevosDetalles[index].debito = String(faltante);
        setDetalles(nuevosDetalles);
      }
    }
  };

  const totalDebitos = detalles.reduce((acc, d) => acc + Number(d.debito || 0), 0);
  const totalCreditos = detalles.reduce((acc, d) => acc + Number(d.credito || 0), 0);
  const diferencia = totalDebitos - totalCreditos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (errorPeriodo) {
      alert("No se puede guardar el comprobante porque el periodo contable no es válido.");
      return;
    }

    if (!empresaId || !sucursalId || !claseDocumentoId) {
      alert("Seleccione la empresa, sucursal y la clase de documento.");
      return;
    }

    if (Math.abs(diferencia) > 0.01) {
      alert(`El comprobante está descuadrado. Diferencia: $ ${diferencia.toLocaleString("es-CO")}`);
      return;
    }

    setLoading(true);
    const res = await guardarDocumentoContable({
      empresa_id: Number(empresaId),
      sucursal_id: Number(sucursalId),
      clase_documento_id: Number(claseDocumentoId),
      fecha_emision: fechaEmision,
      fecha_contable: fechaContable,
      glosa_concepto: glosaConcepto,
      es_bancario: esBancario,
      detalles: detalles.map(d => ({
        concepto_auxiliar_id: Number(d.concepto_auxiliar_id),
        tercero_id: d.tercero_id ? Number(d.tercero_id) : null,
        cuenta_financiera_id: d.cuenta_financiera_id ? Number(d.cuenta_financiera_id) : null,
        titulo_valor_id: d.titulo_valor_id ? Number(d.titulo_valor_id) : null,
        debito: Number(d.debito || 0),
        credito: Number(d.credito || 0)
      }))
    });

    setLoading(false);

    if (res.success) {
      alert(res.message);
      setGlosaConcepto("");
      setDetalles([
        { concepto_auxiliar_id: "", busquedaAuxiliar: "", showAuxDropdown: false, tercero_id: "", cuenta_financiera_id: "", titulo_valor_id: "", titulosDisponibles: [], debito: "", credito: "" },
        { concepto_auxiliar_id: "", busquedaAuxiliar: "", showAuxDropdown: false, tercero_id: "", cuenta_financiera_id: "", titulo_valor_id: "", titulosDisponibles: [], debito: "", credito: "" }
      ]);
    } else {
      alert("Error al guardar: " + res.error);
    }
  };

  if (!isMounted) {
    return <div className="p-4 text-center text-xs text-slate-400">Cargando módulo de documentos...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-7xl mx-auto space-y-4 text-xs font-sans">
      {/* SELECTOR PRINCIPAL */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-800">Elaboración de Documentos</h1>
          <p className="text-[11px] text-slate-500">Seleccione el tipo de operación para alternar entre notas contables y movimientos bancarios.</p>
        </div>
        <div className="flex bg-slate-200 p-1 rounded-lg border border-slate-300 gap-1">
          <button
            type="button"
            onClick={() => setEsBancario(false)}
            className={`px-4 py-2 font-bold rounded transition text-xs ${!esBancario ? "bg-indigo-600 text-white shadow" : "text-slate-700 hover:text-slate-900 bg-white"}`}
          >
            📄 Documento Contable
          </button>
          <button
            type="button"
            onClick={() => setEsBancario(true)}
            className={`px-4 py-2 font-bold rounded transition text-xs ${esBancario ? "bg-indigo-600 text-white shadow" : "text-slate-700 hover:text-slate-900 bg-white"}`}
          >
            🏦 Documento Bancario / Tesorería
          </button>
        </div>
      </div>

      <div className="border-b pb-2 flex justify-between items-center">
        <span className="font-bold text-slate-700 uppercase">
          Modo Activo: <span className="text-indigo-600">{esBancario ? "Documentos Bancarios (Afecta Caja/Bancos)" : "Documentos Contables Generales"}</span>
        </span>

        <button
          type="submit"
          disabled={loading || Math.abs(diferencia) > 0.01 || Boolean(errorPeriodo)}
          className={`px-4 py-2 font-bold rounded text-white shadow transition ${
            Math.abs(diferencia) <= 0.01 && !loading && !errorPeriodo ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400 cursor-not-allowed"
          }`}
        >
          {loading ? "Guardando..." : "💾 Guardar Comprobante"}
        </button>
      </div>

      {/* ENCABEZADO */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 items-end">
        <div className="md:col-span-4">
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

        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Sucursal *</label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            {sucursales.map((suc: any) => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Clase Documento *</label>
          <select
            value={claseDocumentoId}
            onChange={(e) => setClaseDocumentoId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            {clasesDocs.length > 0 ? (
              clasesDocs.map((cls: any) => (
                <option key={cls.id} value={cls.id}>[{cls.codigo_clase}] {cls.nombre_clase}</option>
              ))
            ) : (
              <option value="">No hay clases para este tipo</option>
            )}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">F. Emisión</label>
          <input
            type="date"
            value={fechaEmision}
            onChange={(e) => setFechaEmision(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-slate-800 outline-none text-[10px]"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">F. Contable</label>
          <input
            type="date"
            value={fechaContable}
            onChange={(e) => {
              const nuevaFecha = e.target.value;
              setFechaContable(nuevaFecha);
              if (errorPeriodo) setErrorPeriodo(null);
            }}
            onBlur={() => verificarPeriodo(fechaContable)}
            className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-slate-800 outline-none text-[10px]"
          />
          {validandoPeriodo && (
            <p className="text-[9px] text-blue-500 mt-0.5 animate-pulse">Verificando periodo...</p>
          )}
          {errorPeriodo && (
            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1 rounded mt-0.5">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>

        <div className="md:col-span-12 mt-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Descripción / Glosa General *</label>
          <input
            type="text"
            value={glosaConcepto}
            onChange={(e) => setGlosaConcepto(e.target.value)}
            placeholder="Ingrese el concepto o motivo general del documento..."
            required
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
          />
        </div>
      </div>

      {/* DETALLE DINÁMICO */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-slate-700 uppercase text-[11px]">Movimientos Contables y Operativos (Detalle)</h2>
          <button
            type="button"
            onClick={agregarFila}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded shadow-sm text-[11px] flex items-center gap-1 transition"
          >
            ➕ Adicionar Fila (+)
          </button>
        </div>

        <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
              <tr>
                <th className="p-2 w-8 text-center">#</th>
                <th className="p-2 w-1/4">Cuenta Auxiliar NIIF *</th>
                {esBancario && (
                  <th className="p-2 w-1/5">Título Valor (Cheque/Otros)</th>
                )}
                <th className="p-2 w-1/5">Tercero</th>
                <th className="p-2 text-right w-28">Débito</th>
                <th className="p-2 text-right w-28">Crédito</th>
                <th className="p-2 w-8 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[10px]">
              {detalles.map((fila, index) => {
                const auxiliaresFiltrados = auxiliares.filter(aux => 
                  aux.codigo.toLowerCase().includes(fila.busquedaAuxiliar.toLowerCase()) ||
                  aux.nombre.toLowerCase().includes(fila.busquedaAuxiliar.toLowerCase())
                );

                const esCuentaBancaria = fila.cuenta_financiera_id !== "";

                return (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="p-2 text-center font-mono text-slate-500">{index + 1}</td>
                    
                    {/* AUTOCOMPLETE AUXILIAR */}
                    <td className="p-2 relative overflow-visible" ref={(el) => { dropdownRefs.current[index] = el; }}>
                      <input
                        type="text"
                        value={fila.busquedaAuxiliar}
                        onChange={(e) => {
                          const val = e.target.value;
                          const nuevos = [...detalles];
                          nuevos[index].busquedaAuxiliar = val;
                          nuevos[index].showAuxDropdown = true;
                          if (!val) {
                            nuevos[index].concepto_auxiliar_id = "";
                            nuevos[index].cuenta_financiera_id = "";
                            nuevos[index].titulosDisponibles = [];
                            nuevos[index].titulo_valor_id = "";
                          }
                          setDetalles(nuevos);
                        }}
                        onFocus={() => {
                          const nuevos = [...detalles];
                          nuevos[index].showAuxDropdown = true;
                          setDetalles(nuevos);
                        }}
                        placeholder="Escriba código o nombre..."
                        required
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
                      />

                      {fila.showAuxDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-2xl max-h-56 overflow-y-auto z-[9999]">
                          {auxiliaresFiltrados.length > 0 ? (
                            auxiliaresFiltrados.map((aux: any) => (
                              <div
                                key={aux.id}
                                onClick={() => seleccionarAuxiliar(index, aux)}
                                className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 border-b border-slate-100 last:border-none text-xs"
                              >
                                <span className="font-bold text-indigo-700">[{aux.codigo}]</span> {aux.nombre} <span className="text-[9px] text-slate-400">({aux.tipo_entidad})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-3 text-slate-400 text-center text-xs">No se encontraron cuentas</div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* TÍTULO VALOR */}
                    {esBancario && (
                      <td className="p-2">
                        <select
                          value={fila.titulo_valor_id}
                          onChange={(e) => seleccionarTituloValor(index, e.target.value)}
                          disabled={!esCuentaBancaria}
                          className={`w-full border rounded px-2 py-1 font-medium outline-none truncate ${
                            !esCuentaBancaria ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "bg-white border-slate-300 text-slate-800"
                          }`}
                        >
                          <option value="">{esCuentaBancaria ? "Seleccione Cheque..." : "Seleccione banco primero"}</option>
                          {fila.titulosDisponibles.map((tv: any) => (
                            <option key={tv.id} value={tv.id}>[{tv.tipo_titulo}] #{tv.numero_titulo} (${Number(tv.monto || 0).toLocaleString("es-CO")})</option>
                          ))}
                        </select>
                      </td>
                    )}

                    {/* TERCERO */}
                    <td className="p-2">
                      <select
                        value={fila.tercero_id}
                        onChange={(e) => actualizarFila(index, "tercero_id", e.target.value)}
                        disabled={!!fila.titulo_valor_id}
                        className={`w-full border rounded px-2 py-1 font-medium outline-none truncate ${
                          fila.titulo_valor_id ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "bg-white border-slate-300 text-slate-800"
                        }`}
                      >
                        <option value="">Sin Tercero</option>
                        {terceros.map((ter: any) => (
                          <option key={ter.id} value={ter.id}>[{ter.numero_identificacion}] {ter.razon_social || ter.nombre_comercial}</option>
                        ))}
                      </select>
                    </td>

                    {/* DÉBITO */}
                    <td className="p-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fila.debito ? Number(fila.debito).toLocaleString("es-CO") : ""}
                        onFocus={() => handleFocusDebito(index)}
                        onChange={(e) => {
                          if (fila.titulo_valor_id) return;
                          const raw = e.target.value.replace(/\./g, "").replace(/,/g, ".");
                          actualizarFila(index, "debito", raw);
                        }}
                        disabled={!!fila.titulo_valor_id}
                        placeholder="$ 0"
                        className={`w-full border rounded px-2 py-1 text-right font-mono outline-none ${
                          fila.titulo_valor_id ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "bg-white border-slate-300 text-slate-800"
                        }`}
                      />
                    </td>

                    {/* CRÉDITO */}
                    <td className="p-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fila.credito ? Number(fila.credito).toLocaleString("es-CO") : ""}
                        onChange={(e) => {
                          if (fila.titulo_valor_id) return;
                          const raw = e.target.value.replace(/\./g, "").replace(/,/g, ".");
                          actualizarFila(index, "credito", raw);
                        }}
                        disabled={!!fila.titulo_valor_id}
                        placeholder="$ 0"
                        className={`w-full border rounded px-2 py-1 text-right font-mono outline-none ${
                          fila.titulo_valor_id ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "bg-white border-slate-300 text-slate-800"
                        }`}
                      />
                    </td>

                    {/* ACCIÓN ELIMINAR */}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => eliminarFila(index)}
                        className="text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded transition"
                        title="Eliminar fila"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-[10px]">
              <tr>
                <td className="p-2 uppercase" colSpan={esBancario ? 4 : 3}>TOTALES Y DIFERENCIA</td>
                <td className="p-2 text-right font-mono">$ {totalDebitos.toLocaleString("es-CO")}</td>
                <td className="p-2 text-right font-mono">$ {totalCreditos.toLocaleString("es-CO")}</td>
                <td className="p-2 text-center">
                  {Math.abs(diferencia) <= 0.01 ? (
                    <span className="text-emerald-700 font-bold">Cuadrado ✓</span>
                  ) : (
                    <span className="text-red-600 font-bold" title="Partidas descuadradas">Diff: {diferencia.toLocaleString("es-CO")}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </form>
  );
}