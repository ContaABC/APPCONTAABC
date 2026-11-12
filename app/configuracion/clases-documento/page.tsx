"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  obtenerEmpresasAsignacion,
  obtenerCatalogosPorEmpresa,
  obtenerParametrizacionClase,
  guardarParametrizacionClase,
} from "./actions";

export default function ClaseDocumentoConceptosPage() {
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Listas de datos con tipo explícito
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [clasesDocumento, setClasesDocumento] = useState<any[]>([]);
  const [conceptosAuxiliares, setConceptosAuxiliares] = useState<any[]>([]);

  // Estados del formulario
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");
  const [selectedClaseId, setSelectedClaseId] = useState<string>("");
  const [selectedConceptoDebitoId, setSelectedConceptoDebitoId] = useState<string>("");
  const [selectedConceptoCreditoId, setSelectedConceptoCreditoId] = useState<string>("");
  const [selectedConceptoIvaId, setSelectedConceptoIvaId] = useState<string>("");

  // Estados de UI
  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true);
  const [loadingFiltrados, setLoadingFiltrados] = useState<boolean>(false);
  const [notificacion, setNotificacion] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    async function cargarEmpresas() {
      setLoadingEmpresas(true);
      const res = await obtenerEmpresasAsignacion();
      if (res.success) {
        setEmpresas(res.data || []);
      }
      setLoadingEmpresas(false);
    }
    cargarEmpresas();
  }, []);

  // Cargar Clases y Conceptos al cambiar de empresa
  useEffect(() => {
    if (!selectedEmpresaId) {
      setClasesDocumento([]);
      setConceptosAuxiliares([]);
      setSelectedClaseId("");
      setSelectedConceptoDebitoId("");
      setSelectedConceptoCreditoId("");
      setSelectedConceptoIvaId("");
      return;
    }

    async function cargarCatalogos() {
      setLoadingFiltrados(true);
      const res = await obtenerCatalogosPorEmpresa(Number(selectedEmpresaId));
      if (res.success) {
        setClasesDocumento(res.clases || []);
        setConceptosAuxiliares(res.conceptos || []);
      } else {
        setClasesDocumento([]);
        setConceptosAuxiliares([]);
      }
      setLoadingFiltrados(false);
    }
    cargarCatalogos();
  }, [selectedEmpresaId]);

  // Cargar parametrización existente al seleccionar la clase de documento
  useEffect(() => {
    if (!selectedClaseId) {
      setSelectedConceptoDebitoId("");
      setSelectedConceptoCreditoId("");
      setSelectedConceptoIvaId("");
      return;
    }

    async function cargarParametrizacion() {
      const res = await obtenerParametrizacionClase(Number(selectedClaseId));
      if (res.success && res.data) {
        setSelectedConceptoDebitoId(res.data.concepto_auxiliar_debito ? String(res.data.concepto_auxiliar_debito) : "");
        setSelectedConceptoCreditoId(res.data.concepto_auxiliar_credito ? String(res.data.concepto_auxiliar_credito) : "");
        setSelectedConceptoIvaId(res.data.concepto_auxiliar_iva_id ? String(res.data.concepto_auxiliar_iva_id) : "");
      }
    }
    cargarParametrizacion();
  }, [selectedClaseId]);

  const mostrarNotificacion = (tipo: "exito" | "error", mensaje: string) => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => setNotificacion(null), 4000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmpresaId || !selectedClaseId || !selectedConceptoDebitoId || !selectedConceptoCreditoId) {
      mostrarNotificacion("error", "Debes seleccionar la Empresa, la Clase de Documento y los conceptos principales (Débito y Crédito).");
      return;
    }

    if (selectedConceptoDebitoId === selectedConceptoCreditoId) {
      mostrarNotificacion("error", "El concepto Débito y el concepto Crédito no pueden ser el mismo.");
      return;
    }

    setNotificacion(null);

    startTransition(async () => {
      const res = await guardarParametrizacionClase({
        empresaId: Number(selectedEmpresaId),
        claseDocumentoId: Number(selectedClaseId),
        conceptoDebitoId: Number(selectedConceptoDebitoId),
        conceptoCreditoId: Number(selectedConceptoCreditoId),
        conceptoIvaId: selectedConceptoIvaId ? Number(selectedConceptoIvaId) : null,
      });

      if (res.success) {
        mostrarNotificacion("exito", res.mensaje || "Parametrización guardada correctamente.");
      } else {
        mostrarNotificacion("error", res.error || "Ocurrió un error al guardar.");
      }
    });
  };

  if (!mounted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 text-xs">
      <h1 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">
        Asignación Contable: Clases de Documento vs Conceptos
      </h1>

      {notificacion && (
        <div
          className={`p-3 mb-4 rounded-md font-medium border ${
            notificacion.tipo === "exito"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {notificacion.mensaje}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selector de Empresa */}
        <div>
          <label className="block font-semibold text-gray-700 mb-1">Empresa</label>
          <select
            value={selectedEmpresaId}
            onChange={(e) => {
              setSelectedEmpresaId(e.target.value);
              setSelectedClaseId("");
              setSelectedConceptoDebitoId("");
              setSelectedConceptoCreditoId("");
              setSelectedConceptoIvaId("");
            }}
            disabled={loadingEmpresas}
            className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">
              {loadingEmpresas ? "Cargando empresas..." : "-- Selecciona una Empresa --"}
            </option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Clase de Documento */}
        <div>
          <label className="block font-semibold text-gray-700 mb-1">Clase de Documento</label>
          <select
            value={selectedClaseId}
            onChange={(e) => setSelectedClaseId(e.target.value)}
            disabled={!selectedEmpresaId || loadingFiltrados}
            className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">
              {!selectedEmpresaId
                ? "-- Selecciona primero una Empresa --"
                : loadingFiltrados
                ? "Cargando clases..."
                : clasesDocumento.length === 0
                ? "No hay clases de documento asociadas"
                : "-- Selecciona una Clase de Documento --"}
            </option>
            {clasesDocumento.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.codigo_clase ? `[${cls.codigo_clase}] ` : ""}
                {cls.nombre_clase || cls.nombre}
              </option>
            ))}
          </select>
        </div>

        <hr className="my-4 border-gray-200" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Concepto DÉBITO */}
          <div>
            <label className="block font-semibold text-blue-800 mb-1">
              Concepto Auxiliar DÉBITO (Cuentas por Cobrar)
            </label>
            <select
              value={selectedConceptoDebitoId}
              onChange={(e) => setSelectedConceptoDebitoId(e.target.value)}
              disabled={!selectedEmpresaId || loadingFiltrados}
              className="w-full border border-blue-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">-- Concepto para Débito (Activo) --</option>
              {conceptosAuxiliares
                .filter((conc) => conc.elemento === 'Activo')
                .map((conc) => (
                  <option key={`deb-${conc.id}`} value={conc.id}>
                    {conc.codigo_auxiliar ? `[${conc.codigo_auxiliar}] ` : ""}
                    {conc.nombre}
                  </option>
                ))}
            </select>
          </div>

          {/* Concepto CRÉDITO */}
          <div>
            <label className="block font-semibold text-green-800 mb-1">
              Concepto Auxiliar CRÉDITO (Ingresos / Ventas)
            </label>
            <select
              value={selectedConceptoCreditoId}
              onChange={(e) => setSelectedConceptoCreditoId(e.target.value)}
              disabled={!selectedEmpresaId || loadingFiltrados}
              className="w-full border border-green-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            >
              <option value="">-- Concepto para Crédito (Ingreso) --</option>
              {conceptosAuxiliares
                .filter((conc) => conc.elemento === 'Ingresos')
                .map((conc) => (
                  <option key={`cred-${conc.id}`} value={conc.id}>
                    {conc.codigo_auxiliar ? `[${conc.codigo_auxiliar}] ` : ""}
                    {conc.nombre}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Concepto IVA */}
        <div className="pt-2">
          <label className="block font-semibold text-purple-800 mb-1">
            Concepto Auxiliar IVA Generado (Crédito Impuesto a las Ventas)
          </label>
          <select
            value={selectedConceptoIvaId}
            onChange={(e) => setSelectedConceptoIvaId(e.target.value)}
            disabled={!selectedEmpresaId || loadingFiltrados}
            className="w-full border border-purple-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
          >
            <option value="">-- Selecciona Cuenta de IVA (Pasivo) --</option>
            {conceptosAuxiliares
              .filter((conc) => conc.elemento === 'Pasivo')
              .map((conc) => (
                <option key={`iva-${conc.id}`} value={conc.id}>
                  {conc.codigo_auxiliar ? `[${conc.codigo_auxiliar}] ` : ""}
                  {conc.nombre}
                </option>
              ))}
          </select>
        </div>

        {/* Botón Guardar */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending || !selectedEmpresaId}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-md transition-colors disabled:bg-gray-400 shadow"
          >
            {isPending ? "Guardando..." : "Guardar Configuración Contable"}
          </button>
        </div>
      </form>
    </div>
  );
}