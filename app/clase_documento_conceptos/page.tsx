"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback } from "react";

// ==========================================
// INTERFACES Y TIPOS
// ==========================================
interface Empresa {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
}

interface ClaseDocumento {
  id: number | string;
  codigo_clase?: string;
  nombre_clase?: string;
  nombre?: string;
}

interface ConceptoAuxiliar {
  id: number | string;
  codigo_auxiliar?: string;
  nombre?: string;
  elemento?: string; // 'Activo', 'Ingresos', 'Pasivo', etc.
}

interface NotificacionEstado {
  tipo: "exito" | "error";
  mensaje: string;
}

export default function ClaseDocumentoConceptosPage() {
  const [mounted, setMounted] = useState<boolean>(false);

  // Listas de datos
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [clasesDocumento, setClasesDocumento] = useState<ClaseDocumento[]>([]);
  const [conceptosAuxiliares, setConceptosAuxiliares] = useState<ConceptoAuxiliar[]>([]);

  // Estados del formulario
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");
  const [selectedClaseId, setSelectedClaseId] = useState<string>("");
  const [selectedConceptoDebitoId, setSelectedConceptoDebitoId] = useState<string>("");
  const [selectedConceptoCreditoId, setSelectedConceptoCreditoId] = useState<string>("");
  const [selectedConceptoIvaId, setSelectedConceptoIvaId] = useState<string>("");

  // Estados de UI
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true);
  const [loadingFiltrados, setLoadingFiltrados] = useState<boolean>(false);
  const [notificacion, setNotificacion] = useState<NotificacionEstado | null>(null);

  // 1. Manejo de montaje para evitar discrepancias en SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Cargar Empresas desde la API unificada del ERP (/api/empresas/listar)
  const cargarEmpresas = useCallback(async () => {
    setLoadingEmpresas(true);
    try {
      const res = await fetch("/api/empresas/listar");
      
      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const textData = await res.text();
      if (!textData) {
        throw new Error("Respuesta vacía del servidor");
      }

      const data = JSON.parse(textData);

      if (data.exito && Array.isArray(data.empresas)) {
        const listaEmpresas = data.empresas;
        setEmpresas(listaEmpresas);

        if (listaEmpresas.length > 0) {
          const empresaGuardada = 
            (typeof window !== 'undefined' ? localStorage.getItem('empresa_activa') || localStorage.getItem('empresa_id') : '') ||
            (document.cookie.match(/(^| )empresa_activa=([^;]+)/)?.[2] ?? '');

          if (empresaGuardada && listaEmpresas.some((e: Empresa) => String(e.id) === String(empresaGuardada))) {
            setSelectedEmpresaId(String(empresaGuardada));
          } else {
            const primeraEmpresa = String(listaEmpresas[0].id);
            setSelectedEmpresaId(primeraEmpresa);
            if (typeof window !== 'undefined') {
              localStorage.setItem('empresa_activa', primeraEmpresa);
              localStorage.setItem('empresa_id', primeraEmpresa);
            }
            document.cookie = `empresa_activa=${primeraEmpresa}; path=/; max-age=86400; SameSite=Lax`;
          }
        }
      } else {
        console.error("Error al obtener empresas:", data.mensaje || "Estructura no válida");
      }
    } catch (err) {
      console.error("Error al cargar empresas:", err);
    } finally {
      setLoadingEmpresas(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    cargarEmpresas();
  }, [mounted, cargarEmpresas]);

  // Manejador centralizado para cambio manual de empresa
  const handleCambioEmpresa = (nuevaEmpresaId: string) => {
    setSelectedEmpresaId(nuevaEmpresaId);
    setSelectedClaseId("");
    setSelectedConceptoDebitoId("");
    setSelectedConceptoCreditoId("");
    setSelectedConceptoIvaId("");

    if (typeof window !== 'undefined') {
      localStorage.setItem('empresa_activa', nuevaEmpresaId);
      localStorage.setItem('empresa_id', nuevaEmpresaId);
    }
    document.cookie = `empresa_activa=${nuevaEmpresaId}; path=/; max-age=86400; SameSite=Lax`;
  };

  // 3. Cargar Clases de Documento y Conceptos Auxiliares según la empresa seleccionada
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

    const cargarCatalogosPorEmpresa = async () => {
      setLoadingFiltrados(true);
      try {
        const res = await fetch(`/api/clase-documento-conceptos?empresaId=${selectedEmpresaId}`);
        
        if (!res.ok) {
          throw new Error(`HTTP Error: ${res.status}`);
        }

        const textData = await res.text();
        if (!textData) {
          throw new Error("Respuesta vacía del servidor para catálogos");
        }

        const data = JSON.parse(textData);

        if (res.ok) {
          setClasesDocumento(data.clases || []);
          setConceptosAuxiliares(data.conceptos || []);
        } else {
          console.error("Error al cargar catálogos:", data.error);
          setClasesDocumento([]);
          setConceptosAuxiliares([]);
        }
      } catch (err) {
        console.error("Error al obtener catálogos de la empresa:", err);
        setClasesDocumento([]);
        setConceptosAuxiliares([]);
      } finally {
        setLoadingFiltrados(false);
      }
    };

    cargarCatalogosPorEmpresa();
  }, [selectedEmpresaId]);

  // 4. Cargar la parametrización previa si el usuario selecciona una clase de documento
  useEffect(() => {
    if (!selectedClaseId) {
      setSelectedConceptoDebitoId("");
      setSelectedConceptoCreditoId("");
      setSelectedConceptoIvaId("");
      return;
    }

    const cargarParametrizacion = async () => {
      try {
        const res = await fetch(`/api/clase-documento-conceptos?claseDocumentoId=${selectedClaseId}`);
        const data = await res.json();

        if (res.ok && data) {
          setSelectedConceptoDebitoId(data.concepto_auxiliar_debito ? String(data.concepto_auxiliar_debito) : "");
          setSelectedConceptoCreditoId(data.concepto_auxiliar_credito ? String(data.concepto_auxiliar_credito) : "");
          setSelectedConceptoIvaId(data.concepto_auxiliar_iva_id ? String(data.concepto_auxiliar_iva_id) : "");
        }
      } catch (err) {
        console.error("Error al cargar parametrización existente:", err);
      }
    };

    cargarParametrizacion();
  }, [selectedClaseId]);

  const mostrarNotificacion = (tipo: "exito" | "error", mensaje: string) => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => {
      setNotificacion(null);
    }, 4000);
  };

  // 5. Guardar la configuración llamando al endpoint POST
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedEmpresaId || !selectedClaseId || !selectedConceptoDebitoId || !selectedConceptoCreditoId) {
      mostrarNotificacion("error", "Debes seleccionar la Empresa, la Clase de Documento y los conceptos principales (Débito y Crédito).");
      return;
    }

    if (selectedConceptoDebitoId === selectedConceptoCreditoId) {
      mostrarNotificacion("error", "El concepto Débito y el concepto Crédito no pueden ser el mismo.");
      return;
    }

    setLoading(true);
    setNotificacion(null);

    try {
      const response = await fetch("/api/clase-documento-conceptos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          empresaId: Number(selectedEmpresaId),
          claseDocumentoId: Number(selectedClaseId),
          conceptoDebitoId: Number(selectedConceptoDebitoId),
          conceptoCreditoId: Number(selectedConceptoCreditoId),
          conceptoIvaId: selectedConceptoIvaId ? Number(selectedConceptoIvaId) : null,
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.error || "Ocurrió un error al guardar la información.");
      }

      mostrarNotificacion("exito", resultado.mensaje || "Parametrización guardada correctamente.");
    } catch (err: any) {
      mostrarNotificacion("error", err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
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
    <div className="p-6 max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <h1 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
        Asignación Contable: Clases de Documento vs Conceptos
      </h1>

      {notificacion && (
        <div
          className={`p-3 mb-4 rounded-md text-sm border ${
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empresa
          </label>
          <select
            value={selectedEmpresaId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => handleCambioEmpresa(e.target.value)}
            disabled={loadingEmpresas}
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 cursor-pointer"
          >
            <option value="">
              {loadingEmpresas ? "Cargando empresas..." : "-- Selecciona una Empresa --"}
            </option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial || emp.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Clase de Documento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Clase de Documento
          </label>
          <select
            value={selectedClaseId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedClaseId(e.target.value)}
            disabled={!selectedEmpresaId || loadingFiltrados}
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 cursor-pointer"
          >
            <option value="">
              {!selectedEmpresaId
                ? "-- Selecciona primero una Empresa --"
                : loadingFiltrados
                ? "Cargando clases..."
                : clasesDocumento.length === 0
                ? "No hay clases de documento asociadas a esta empresa"
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

        {/* Grilla con etiquetas optimizadas de una sola línea */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Concepto DÉBITO (Filtrado por Activo) */}
          <div>
            <label className="block text-sm font-semibold text-blue-800 mb-1">
              Concepto Auxiliar DÉBITO (Cuentas por Cobrar)
            </label>
            <select
              value={selectedConceptoDebitoId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedConceptoDebitoId(e.target.value)}
              disabled={!selectedEmpresaId || loadingFiltrados}
              className="w-full border border-blue-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 cursor-pointer"
            >
              <option value="">
                {!selectedEmpresaId
                  ? "-- Selecciona primero Empresa --"
                  : loadingFiltrados
                  ? "Cargando conceptos..."
                  : "-- Concepto para Débito (Activo) --"}
              </option>
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

          {/* Concepto CRÉDITO PRINCIPAL (Filtrado por Ingreso) */}
          <div>
            <label className="block text-sm font-semibold text-green-800 mb-1">
              Concepto Auxiliar CRÉDITO (Ingresos / Ventas)
            </label>
            <select
              value={selectedConceptoCreditoId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedConceptoCreditoId(e.target.value)}
              disabled={!selectedEmpresaId || loadingFiltrados}
              className="w-full border border-green-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 cursor-pointer"
            >
              <option value="">
                {!selectedEmpresaId
                  ? "-- Selecciona primero Empresa --"
                  : loadingFiltrados
                  ? "Cargando conceptos..."
                  : "-- Concepto para Crédito (Ingreso) --"}
              </option>
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

        {/* Concepto CRÉDITO IVA (Filtrado por Pasivo) */}
        <div className="pt-2">
          <label className="block text-sm font-semibold text-purple-800 mb-1">
            Concepto Auxiliar IVA Generado (Crédito Impuesto a las Ventas)
          </label>
          <select
            value={selectedConceptoIvaId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedConceptoIvaId(e.target.value)}
            disabled={!selectedEmpresaId || loadingFiltrados}
            className="w-full border border-purple-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 cursor-pointer"
          >
            <option value="">
              {!selectedEmpresaId
                ? "-- Selecciona primero Empresa --"
                : loadingFiltrados
                ? "Cargando conceptos..."
                : "-- Selecciona Cuenta de IVA (Pasivo) --"}
            </option>
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
            disabled={loading || !selectedEmpresaId}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-6 py-2.5 rounded-md transition-colors disabled:bg-gray-400 cursor-pointer"
          >
            {loading ? "Guardando..." : "Guardar Configuración Contable"}
          </button>
        </div>
      </form>
    </div>
  );
}