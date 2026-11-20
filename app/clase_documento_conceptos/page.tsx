"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback, useMemo } from "react";
import { getEmpresasPermitidas } from "@/app/actions/accionesEmpresas";
import { createClient } from "@supabase/supabase-js";
import {
  getClaseDocumentoConceptosData,
  guardarClaseDocumentoConceptos
} from "./actions";
import {
  ArrowLeft,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Percent,
  Sparkles
} from "lucide-react";

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
  elemento?: string; // 'Activo', 'Pasivo', 'Patrimonio', 'Ingresos', 'Gastos', 'Costos'
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

  // Inicialización síncrona de empresa activa
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("empresa_activa") || localStorage.getItem("empresa_id") || "";
    }
    return "";
  });

  // Estados del formulario
  const [selectedClaseId, setSelectedClaseId] = useState<string>("");
  const [selectedConceptoDebitoId, setSelectedConceptoDebitoId] = useState<string>("");
  const [selectedConceptoCreditoId, setSelectedConceptoCreditoId] = useState<string>("");
  const [selectedConceptoIvaId, setSelectedConceptoIvaId] = useState<string>("");

  // Estados de UI
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true);
  const [loadingFiltrados, setLoadingFiltrados] = useState<boolean>(false);
  const [notificacion, setNotificacion] = useState<NotificacionEstado | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cargarEmpresas = useCallback(async () => {
    setLoadingEmpresas(true);
    try {
      let listaEmpresas: Empresa[] = [];
      const resPermitidas: any = await getEmpresasPermitidas();

      if (Array.isArray(resPermitidas)) {
        listaEmpresas = resPermitidas;
      } else if (Array.isArray(resPermitidas?.datos)) {
        listaEmpresas = resPermitidas.datos;
      } else if (Array.isArray(resPermitidas?.data)) {
        listaEmpresas = resPermitidas.data;
      }

      const empresaGuardada =
        (typeof window !== "undefined"
          ? localStorage.getItem("empresa_activa") || localStorage.getItem("empresa_id")
          : "") ||
        (typeof document !== "undefined"
          ? document.cookie.match(/(^| )empresa_activa=([^;]+)/)?.[2] ?? ""
          : "");

      // Respaldo con Supabase si getEmpresasPermitidas retorna vacío
      if (listaEmpresas.length === 0) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          const { data: authData } = await supabase.auth.getSession();
          const userId = authData?.session?.user?.id;

          let empresaIds: string[] = [];
          if (userId) {
            const { data: permisosTx } = await supabase
              .from("usuario_permisos_tx")
              .select("empresa_id")
              .eq("usuario_id", userId);

            if (permisosTx && permisosTx.length > 0) {
              empresaIds = Array.from(
                new Set(permisosTx.map((p: any) => String(p.empresa_id)).filter(Boolean))
              );
            }
          }

          if (empresaIds.length > 0) {
            const { data: empData } = await supabase
              .from("empresas")
              .select("id, razon_social, nombre_comercial")
              .in("id", empresaIds)
              .order("razon_social", { ascending: true });

            if (empData && empData.length > 0) {
              listaEmpresas = empData;
            }
          } else if (empresaGuardada) {
            const { data: empUnica } = await supabase
              .from("empresas")
              .select("id, razon_social, nombre_comercial")
              .eq("id", empresaGuardada)
              .maybeSingle();

            if (empUnica) {
              listaEmpresas = [empUnica];
            }
          }
        }
      }

      if (listaEmpresas.length > 0) {
        setEmpresas(listaEmpresas);

        if (empresaGuardada && listaEmpresas.some((e: Empresa) => String(e.id) === String(empresaGuardada))) {
          setSelectedEmpresaId(String(empresaGuardada));
        } else {
          const primeraEmpresa = String(listaEmpresas[0].id);
          setSelectedEmpresaId(primeraEmpresa);
          if (typeof window !== "undefined") {
            localStorage.setItem("empresa_activa", primeraEmpresa);
            localStorage.setItem("empresa_id", primeraEmpresa);
          }
          document.cookie = `empresa_activa=${primeraEmpresa}; path=/; max-age=86400; SameSite=Lax`;
        }
      } else {
        setEmpresas([]);
      }
    } catch (err) {
      console.error("Error al cargar empresas:", err);
      setEmpresas([]);
    } finally {
      setLoadingEmpresas(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    cargarEmpresas();
  }, [mounted, cargarEmpresas]);

  const handleCambioEmpresa = (nuevaEmpresaId: string) => {
    setSelectedEmpresaId(nuevaEmpresaId);
    setSelectedClaseId("");
    setSelectedConceptoDebitoId("");
    setSelectedConceptoCreditoId("");
    setSelectedConceptoIvaId("");

    if (typeof window !== "undefined") {
      localStorage.setItem("empresa_activa", nuevaEmpresaId);
      localStorage.setItem("empresa_id", nuevaEmpresaId);
    }
    document.cookie = `empresa_activa=${nuevaEmpresaId}; path=/; max-age=86400; SameSite=Lax`;
  };

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
        const resultado: any = await getClaseDocumentoConceptosData({ empresaId: selectedEmpresaId });

        if (resultado && !resultado.error) {
          setClasesDocumento(resultado.clases || []);
          setConceptosAuxiliares(resultado.conceptos || []);
        } else {
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

  useEffect(() => {
    if (!selectedClaseId) {
      setSelectedConceptoDebitoId("");
      setSelectedConceptoCreditoId("");
      setSelectedConceptoIvaId("");
      return;
    }

    const cargarParametrizacion = async () => {
      try {
        const data: any = await getClaseDocumentoConceptosData({
          empresaId: selectedEmpresaId,
          claseDocumentoId: selectedClaseId
        });

        if (data && !data.error) {
          setSelectedConceptoDebitoId(data.concepto_auxiliar_debito ? String(data.concepto_auxiliar_debito) : "");
          setSelectedConceptoCreditoId(data.concepto_auxiliar_credito ? String(data.concepto_auxiliar_credito) : "");
          setSelectedConceptoIvaId(data.concepto_auxiliar_iva_id ? String(data.concepto_auxiliar_iva_id) : "");
        }
      } catch (err) {
        console.error("Error al cargar parametrización existente:", err);
      }
    };

    cargarParametrizacion();
  }, [selectedClaseId, selectedEmpresaId]);

  const mostrarNotificacion = (tipo: "exito" | "error", mensaje: string) => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => {
      setNotificacion(null);
    }, 4000);
  };

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
      const resultado: any = await guardarClaseDocumentoConceptos({
        empresaId: Number(selectedEmpresaId),
        claseDocumentoId: Number(selectedClaseId),
        conceptoDebitoId: Number(selectedConceptoDebitoId),
        conceptoCreditoId: Number(selectedConceptoCreditoId),
        conceptoIvaId: selectedConceptoIvaId ? Number(selectedConceptoIvaId) : null,
      });

      if (resultado.error) {
        throw new Error(resultado.error);
      }

      mostrarNotificacion("exito", resultado.mensaje || "Parametrización guardada correctamente.");
    } catch (err: any) {
      mostrarNotificacion("error", err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const conceptosPorId = useMemo(() => {
    const map = new Map<string, ConceptoAuxiliar>();
    conceptosAuxiliares.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [conceptosAuxiliares]);

  const formatoConcepto = (id?: string) => {
    if (!id) return null;
    const item = conceptosPorId.get(String(id));
    if (!item) return null;
    return `${item.codigo_auxiliar ? `[${item.codigo_auxiliar}] ` : ""}${item.nombre || ""}`;
  };

  const renderizarOpcionesAgrupadas = (placeholder: string) => {
    const grupos = ["Activo", "Pasivo", "Patrimonio", "Ingresos", "Gastos", "Costos"];

    return (
      <>
        <option value="">{placeholder}</option>
        {grupos.map((elemento) => {
          const itemsDelGrupo = conceptosAuxiliares.filter((c) => c.elemento === elemento);
          if (itemsDelGrupo.length === 0) return null;

          return (
            <optgroup key={elemento} label={`--- ${elemento.toUpperCase()} ---`}>
              {itemsDelGrupo.map((conc) => (
                <option key={conc.id} value={String(conc.id)}>
                  {conc.codigo_auxiliar ? `[${conc.codigo_auxiliar}] ` : ""}{conc.nombre}
                </option>
              ))}
            </optgroup>
          );
        })}
      </>
    );
  };

  if (!mounted) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">Cargando entorno seguro...</div>
    );
  }

  return (
    <div className="p-4 md:p-5 max-w-5xl mx-auto space-y-3.5 min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60">
      {notificacion && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all animate-in fade-in slide-in-from-top-4 ${
            notificacion.tipo === "exito"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {notificacion.tipo === "exito" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{notificacion.mensaje}</span>
        </div>
      )}

      {/* Encabezado Superior con Selector de Empresa */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl shadow-sm border border-slate-200/90">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href="/modulos/contabilidad/configuracion"
            className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition flex items-center justify-center shrink-0"
            title="Volver a Configuración"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-slate-800 tracking-tight truncate">
                Clase de Documento &gt;&gt; Conceptos
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Sparkles className="w-3 h-3" /> Parametrización NIIF
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 truncate">
              Asignación de conceptos auxiliares Débito, Crédito e IVA por clase de documento
            </p>
          </div>
        </div>

        {/* Selector de Empresa en la cabecera */}
        <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 px-3 py-1.5 rounded-xl transition shrink-0">
          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Empresa:
          </span>
          <select
            value={selectedEmpresaId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => handleCambioEmpresa(e.target.value)}
            disabled={!mounted || loadingEmpresas || empresas.length <= 1}
            suppressHydrationWarning
            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1 max-w-[230px] md:max-w-[270px] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {!mounted || loadingEmpresas ? (
              <option value="">Cargando empresas...</option>
            ) : empresas.length === 0 ? (
              <option value="">Sin empresas asignadas</option>
            ) : (
              <>
                {empresas.length !== 1 && <option value="">-- Selecciona una Empresa --</option>}
                {empresas.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.razon_social || emp.nombre_comercial || emp.nombre}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>

      {/* Formulario Compacto */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Sección 1: Clase de Documento */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-5 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-800 leading-tight">
                  1. Clase de Documento *
                </h2>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  Elige el tipo de comprobante a parametrizar
                </p>
              </div>
            </div>

            <div className="w-full md:w-[380px] lg:w-[430px] shrink-0">
              <select
                value={selectedClaseId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedClaseId(e.target.value)}
                disabled={!selectedEmpresaId || loadingFiltrados}
                className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition cursor-pointer disabled:opacity-60"
              >
                <option value="">
                  {!selectedEmpresaId
                    ? "-- Selecciona primero una Empresa --"
                    : loadingFiltrados
                    ? "Cargando clases de documento..."
                    : clasesDocumento.length === 0
                    ? "No hay clases asociadas a esta empresa"
                    : "-- Selecciona una Clase de Documento --"}
                </option>
                {clasesDocumento.map((cls) => (
                  <option key={cls.id} value={String(cls.id)}>
                    {cls.codigo_clase ? `[${cls.codigo_clase}] ` : ""}
                    {cls.nombre_clase || cls.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sección 2: Conceptos Contables Principales (Débito y Crédito) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-5 py-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 leading-tight">
                  2. Asiento Contable Base (Débito y Crédito)
                </h2>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  Selecciona los conceptos auxiliares principales agrupados por elemento contable
                </p>
              </div>
            </div>
            {loadingFiltrados && (
              <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-medium shrink-0">
                <RefreshCw className="w-3 h-3 animate-spin" /> Cargando...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-blue-50/35 border border-blue-200/70 space-y-1.5">
              <label className="flex items-center justify-between text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                  Concepto Auxiliar DÉBITO *
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  DEBE
                </span>
              </label>
              <select
                value={selectedConceptoDebitoId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedConceptoDebitoId(e.target.value)}
                disabled={!selectedEmpresaId || !selectedClaseId || loadingFiltrados}
                className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition cursor-pointer disabled:opacity-60 shadow-2xs"
              >
                {renderizarOpcionesAgrupadas("-- Seleccionar Concepto Débito --")}
              </select>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/35 border border-emerald-200/70 space-y-1.5">
              <label className="flex items-center justify-between text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  Concepto Auxiliar CRÉDITO *
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  HABER
                </span>
              </label>
              <select
                value={selectedConceptoCreditoId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedConceptoCreditoId(e.target.value)}
                disabled={!selectedEmpresaId || !selectedClaseId || loadingFiltrados}
                className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition cursor-pointer disabled:opacity-60 shadow-2xs"
              >
                {renderizarOpcionesAgrupadas("-- Seleccionar Concepto Crédito --")}
              </select>
            </div>
          </div>
        </div>

        {/* Sección 3: Impuesto al Valor Agregado */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-5 py-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                <Percent className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-800 leading-tight">
                  3. Impuesto al Valor Agregado (Opcional)
                </h2>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  Asocia la cuenta auxiliar de pasivo para IVA generado cuando aplique
                </p>
              </div>
            </div>

            <div className="w-full md:w-[380px] lg:w-[430px] shrink-0">
              <select
                value={selectedConceptoIvaId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedConceptoIvaId(e.target.value)}
                disabled={!selectedEmpresaId || !selectedClaseId || loadingFiltrados}
                className="w-full bg-purple-50/35 border border-purple-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15 transition cursor-pointer disabled:opacity-60 shadow-2xs"
              >
                <option value="">-- Selecciona Cuenta de IVA (Pasivo) --</option>
                {conceptosAuxiliares
                  .filter((conc) => conc.elemento === "Pasivo")
                  .map((conc) => (
                    <option key={`iva-${conc.id}`} value={String(conc.id)}>
                      {conc.codigo_auxiliar ? `[${conc.codigo_auxiliar}] ` : ""}
                      {conc.nombre}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Resumen compacto + botón guardar */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <strong className="text-blue-700">Débito:</strong>{" "}
                {formatoConcepto(selectedConceptoDebitoId) || "Sin seleccionar"}
              </span>
              <span>
                <strong className="text-emerald-700">Crédito:</strong>{" "}
                {formatoConcepto(selectedConceptoCreditoId) || "Sin seleccionar"}
              </span>
              {selectedConceptoIvaId && (
                <span>
                  <strong className="text-purple-700">IVA:</strong>{" "}
                  {formatoConcepto(selectedConceptoIvaId)}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !selectedEmpresaId || !selectedClaseId}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {loading ? "Guardando..." : "Guardar Configuración Contable"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}