"use client";

import React, { useState, useEffect } from "react";
import { obtenerEmpresas } from "@/app/consultas/movimientos/movimientos-actions";
import { 
  obtenerConceptosRetencion, 
  guardarConceptoRetencion, 
  obtenerAuxiliaresPorElemento,
  clonarConceptosAnioAnterior
} from "./conceptos-actions";
import { Plus, Edit, CheckCircle, XCircle, Search, X, Copy } from "lucide-react";

export default function ConceptosRetencionPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  
  const anioActual = new Date().getFullYear();
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(anioActual);

  const [conceptos, setConceptos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [auxiliaresPasivo, setAuxiliaresPasivo] = useState<any[]>([]);
  const [auxiliaresActivo, setAuxiliaresActivo] = useState<any[]>([]);

  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [conceptoEditando, setConceptoEditando] = useState<any | null>(null);

  const [tipoRetencion, setTipoRetencion] = useState<"RENTA" | "IVA" | "ICA">("RENTA");
  const [conceptoTexto, setConceptoTexto] = useState<string>("");
  const [baseMinima, setBaseMinima] = useState<string>("0");
  const [tarifaComercial, setTarifaComercial] = useState<string>("0");
  const [cuentaPasivoId, setCuentaPasivoId] = useState<string>("");
  const [cuentaActivoId, setCuentaActivoId] = useState<string>("");
  const [codigoMunicipio, setCodigoMunicipio] = useState<string>("");
  const [guardando, setGuardando] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function init() {
      const res = await obtenerEmpresas();
      if (res.success && res.data && res.data.length > 0) {
        setEmpresas(res.data);
        setEmpresaId(String(res.data[0].id));
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!empresaId) return;
    cargarDatosEmpresa();
  }, [empresaId, anioSeleccionado]);

  async function cargarDatosEmpresa() {
    setLoading(true);
    const resConceptos = await obtenerConceptosRetencion(empresaId, anioSeleccionado);
    if (resConceptos.success) {
      setConceptos(resConceptos.data || []);
    }

    const resPasivo = await obtenerAuxiliaresPorElemento(empresaId, "Pasivo");
    if (resPasivo.success) setAuxiliaresPasivo(resPasivo.data || []);

    const resActivo = await obtenerAuxiliaresPorElemento(empresaId, "Activo");
    if (resActivo.success) setAuxiliaresActivo(resActivo.data || []);

    setLoading(false);
  }

  const convertirTarifaParaBD = (valorComercial: number, tipo: string) => {
    if (tipo === "ICA") {
      return valorComercial / 1000;
    } else {
      return valorComercial / 100;
    }
  };

  const convertirTarifaDesdeBD = (tarifaDb: number, tipo: string) => {
    const val = Number(tarifaDb || 0);
    if (tipo === "ICA") {
      return val * 1000;
    } else {
      return val * 100;
    }
  };

  const abrirModalNuevo = () => {
    setConceptoEditando(null);
    setTipoRetencion("RENTA");
    setConceptoTexto("");
    setBaseMinima("0");
    setTarifaComercial("0");
    setCuentaPasivoId("");
    setCuentaActivoId("");
    setCodigoMunicipio("");
    setModalAbierto(true);
  };

  const abrirModalEditar = (item: any) => {
    setConceptoEditando(item);
    setTipoRetencion(item.tipo_retencion);
    setConceptoTexto(item.concepto);
    setBaseMinima(String(item.base_minima));
    setTarifaComercial(String(convertirTarifaDesdeBD(item.tarifa, item.tipo_retencion)));
    setCuentaPasivoId(item.concepto_auxiliar_id ? String(item.concepto_auxiliar_id) : "");
    setCuentaActivoId(item.concepto_auxiliar_activo_id ? String(item.concepto_auxiliar_activo_id) : "");
    setCodigoMunicipio(item.codigo_municipio || "");
    setModalAbierto(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conceptoTexto.trim()) {
      alert("El nombre del concepto es obligatorio.");
      return;
    }

    setGuardando(true);
    const tarifaFinal = convertirTarifaParaBD(Number(tarifaComercial), tipoRetencion);

    const res = await guardarConceptoRetencion({
      id: conceptoEditando?.id,
      empresa_id: Number(empresaId),
      anio: anioSeleccionado,
      tipo_retencion: tipoRetencion,
      concepto: conceptoTexto,
      base_minima: Number(baseMinima),
      tarifa: tarifaFinal,
      concepto_auxiliar_id: cuentaPasivoId ? Number(cuentaPasivoId) : null,
      concepto_auxiliar_activo_id: cuentaActivoId ? Number(cuentaActivoId) : null,
      codigo_municipio: tipoRetencion === "ICA" ? codigoMunicipio : null,
      activo: true
    });

    setGuardando(false);

    if (res.success) {
      setModalAbierto(false);
      cargarDatosEmpresa();
    } else {
      alert("Error al guardar el concepto: " + res.error);
    }
  };

  const clonarAnioAnterior = async () => {
    const anioOrigen = anioSeleccionado - 1;
    const confirmar = window.confirm(`¿Desea clonar los conceptos del año ${anioOrigen} al año ${anioSeleccionado}? Esto le permitirá reutilizar la parametrización previa.`);
    if (!confirmar) return;

    setLoading(true);
    const res = await clonarConceptosAnioAnterior(empresaId, anioOrigen, anioSeleccionado);
    setLoading(false);

    if (res.success) {
      alert(`¡Conceptos clonados con éxito para el año ${anioSeleccionado}!`);
      cargarDatosEmpresa();
    } else {
      alert("Error en la clonación: " + res.error);
    }
  };

  const fmt = (v: number) => `$ ${Number(v || 0).toLocaleString("es-CO")}`;

  const formatearTarifaTabla = (tarifaDb: number, tipo: string) => {
    const valor = Number(tarifaDb || 0);
    if (tipo === "ICA") {
      const porMil = valor * 1000;
      return `${porMil.toFixed(1).replace(/\.?0+$/, '')} x mil`;
    } else {
      const porCiento = valor * 100;
      return `${porCiento.toFixed(1).replace(/\.?0+$/, '')}%`;
    }
  };

  if (!isMounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-sm font-sans">
      {/* ENCABEZADO */}
      <div className="border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Parametrización de Conceptos de Retención ({anioSeleccionado})
          </h1>
          <p className="text-sm text-slate-500">
            Gestión de tarifas, bases mínimas y cuentas contables por año fiscal.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={clonarAnioAnterior}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs transition"
            title="Copiar configuración del año anterior"
          >
            <Copy className="w-4 h-4" /> Clonar del {anioSeleccionado - 1}
          </button>
          <button
            type="button"
            onClick={abrirModalNuevo}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs transition"
          >
            <Plus className="w-4 h-4" /> Nuevo Concepto
          </button>
        </div>
      </div>

      {/* FILTROS DE EMPRESA Y AÑO */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="md:col-span-6">
          <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold text-sm outline-none"
          >
            {empresas.map((emp: any) => (
              <option key={emp.id} value={emp.id}>{emp.razon_social || emp.nombre_comercial}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">Año Fiscal</label>
          <select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-sm outline-none"
          >
            {[2026, 2027, 2028, 2029, 2030].map((anio) => (
              <option key={anio} value={anio}>{anio}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA DE CONCEPTOS */}
      <div className="bg-white border rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-semibold">Cargando conceptos para el año {anioSeleccionado}...</div>
        ) : conceptos.length === 0 ? (
          <div className="p-12 text-center text-slate-500 italic space-y-3">
            <p>No hay conceptos configurados para el año {anioSeleccionado}.</p>
            <button
              type="button"
              onClick={clonarAnioAnterior}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4" /> Traer datos del año {anioSeleccionado - 1}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b uppercase">
                <tr>
                  <th className="p-3.5">Impuesto</th>
                  <th className="p-3.5">Concepto</th>
                  <th className="p-3.5 text-right">Base Mínima</th>
                  <th className="p-3.5 text-center">Tarifa</th>
                  <th className="p-3.5">Cta. Pasivo (Ret. Practicada)</th>
                  <th className="p-3.5">Cta. Activo (Ret. Recibida)</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {conceptos.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-slate-900">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        item.tipo_retencion === 'RENTA' ? 'bg-blue-100 text-blue-800' :
                        item.tipo_retencion === 'IVA' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {item.tipo_retencion}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900">{item.concepto}</td>
                    <td className="p-3.5 text-right font-mono text-slate-700">{fmt(item.base_minima)}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-indigo-700">
                      {formatearTarifaTabla(item.tarifa, item.tipo_retencion)}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {item.concepto_auxiliar ? `${item.concepto_auxiliar.codigo_auxiliar} - ${item.concepto_auxiliar.nombre}` : <span className="text-red-500 italic">Sin asignar</span>}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {item.concepto_auxiliar_activo ? `${item.concepto_auxiliar_activo.codigo_auxiliar} - ${item.concepto_auxiliar_activo.nombre}` : <span className="text-amber-600 italic">No aplica</span>}
                    </td>
                    <td className="p-3.5 text-center">
                      {item.activo ? (
                        <span className="text-emerald-600 flex items-center justify-center gap-1 font-semibold"><CheckCircle className="w-4 h-4" /> Activo</span>
                      ) : (
                        <span className="text-slate-400 flex items-center justify-center gap-1"><XCircle className="w-4 h-4" /> Inactivo</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => abrirModalEditar(item)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border max-w-2xl w-full p-8 space-y-6 relative font-sans text-slate-900 text-sm max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalAbierto(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-base font-bold uppercase tracking-wide border-b pb-3">
              {conceptoEditando ? `Editar Concepto (${anioSeleccionado})` : `Nuevo Concepto para el año ${anioSeleccionado}`}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">Tipo de Impuesto</label>
                  <select
                    value={tipoRetencion}
                    onChange={(e) => setTipoRetencion(e.target.value as any)}
                    disabled={!!conceptoEditando}
                    className={`w-full border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none ${
                      conceptoEditando ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'
                    }`}
                  >
                    <option value="RENTA">Renta</option>
                    <option value="IVA">IVA</option>
                    <option value="ICA">ICA</option>
                  </select>
                </div>

                {tipoRetencion === 'ICA' && (
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">Código Municipio (DANE)</label>
                    <input
                      type="text"
                      value={codigoMunicipio}
                      onChange={(e) => setCodigoMunicipio(e.target.value)}
                      placeholder="Ej: 68001"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">Descripción del Concepto</label>
                <input
                  type="text"
                  value={conceptoTexto}
                  onChange={(e) => setConceptoTexto(e.target.value)}
                  placeholder="Ej: Compras generales, Servicios..."
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">Base Mínima ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={baseMinima}
                    onChange={(e) => setBaseMinima(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    {tipoRetencion === 'ICA' ? 'Tarifa (Ej: 5.5 para 5.5 x mil)' : 'Tarifa (Ej: 3.5 para 3.5%)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tarifaComercial}
                    onChange={(e) => setTarifaComercial(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none font-mono"
                  />
                </div>
              </div>

              {/* DOBLE PARAMETRIZACIÓN DE CUENTAS AUXILIARES */}
              <div className="space-y-4 pt-2 border-t">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    Cuenta Auxiliar PASIVO (Crédito - Retención Practicada a Proveedores)
                  </label>
                  <select
                    value={cuentaPasivoId}
                    onChange={(e) => setCuentaPasivoId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none text-xs font-mono"
                  >
                    <option value="">-- Seleccione Cuenta de Pasivo --</option>
                    {auxiliaresPasivo.map((aux: any) => (
                      <option key={aux.id} value={aux.id}>
                        {aux.codigo_auxiliar} - {aux.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    Cuenta Auxiliar ACTIVO (Débito - Retención Recibida / Clientes)
                  </label>
                  <select
                    value={cuentaActivoId}
                    onChange={(e) => setCuentaActivoId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none text-xs font-mono"
                  >
                    <option value="">-- Seleccione Cuenta de Activo (Opcional) --</option>
                    {auxiliaresActivo.map((aux: any) => (
                      <option key={aux.id} value={aux.id}>
                        {aux.codigo_auxiliar} - {aux.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Guardar Concepto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}