"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import XmlUploader from "@/components/xml-uploader";
import XmlUploaderMasivo from "@/components/xml-uploader-masivo";
import { validarPeriodoContable } from "@/lib/accounting-validations";

interface UserType {
  id: string;
  email?: string;
  tipo_usuario?: string;
}

interface Company {
  id: string | number;
  razon_social?: string;
  nit_identificacion?: string;
}

interface Branch {
  id: string | number;
  nombre?: string;
  name?: string;
}

interface DocumentClass {
  id: string | number;
  codigo_clase?: string;
  nombre_clase?: string;
  nombre?: string;
}

export interface TerceroRetencionInfo {
  id: number | string;
  numero_identificacion?: string;
  razon_social?: string;
  nombre?: string;
  retencion_renta_id?: number | string | null;
  retencion_iva_id?: number | string | null;
  retencion_ica_id?: number | string | null;
}

export interface ConceptoRetencionItem {
  id: number | string;
  empresa_id?: number | string | null;
  anio?: number;
  tipo_retencion?: "RENTA" | "IVA" | "ICA" | string;
  concepto?: string;
  base_minima?: number;
  tarifa?: number;
  activo?: boolean;
  codigo_municipio?: string | null;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function extraerAnioFecha(fechaStr?: string): number {
  if (fechaStr) {
    const match = /^(\d{4})/.exec(fechaStr.trim());
    if (match) {
      const anioNum = Number(match[1]);
      if (!Number.isNaN(anioNum) && anioNum > 1900) return anioNum;
    }
    const d = new Date(fechaStr);
    if (!Number.isNaN(d.getTime())) return d.getUTCFullYear();
  }
  return new Date().getFullYear();
}

function CargarFacturasContent() {
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState<boolean>(false);
  const [rutaRetorno, setRutaRetorno] = useState<string>("/modulos/proveedores");
  const [tituloRetorno, setTituloRetorno] = useState<string>("Volver a Proveedores");

  const [user, setUser] = useState<UserType | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [documentClasses, setDocumentClasses] = useState<DocumentClass[]>([]);
  const [tercerosEmpresa, setTercerosEmpresa] = useState<TerceroRetencionInfo[]>([]);
  const [conceptosRetencion, setConceptosRetencion] = useState<ConceptoRetencionItem[]>([]);

  const [activeTab, setActiveTab] = useState<"individual" | "masiva">("individual");

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedDocumentClassId, setSelectedDocumentClassId] = useState<string>("");

  const [fechaContabilizacion, setFechaContabilizacion] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromParam = searchParams.get("from");
    if (fromParam && fromParam.startsWith("/")) {
      setRutaRetorno(fromParam);
      setTituloRetorno(
        fromParam.startsWith("/modulos/contabilidad")
          ? "Volver a Contabilidad"
          : "Volver a Proveedores"
      );
    }
  }, [searchParams]);

  const persistirContextoUsuario = useCallback(
    async (empresaIdStr: string, sucursalIdStr?: string) => {
      if (!empresaIdStr) return;

      const empNum = Number(empresaIdStr);
      const sucNum =
        sucursalIdStr && !Number.isNaN(Number(sucursalIdStr)) && Number(sucursalIdStr) > 0
          ? Number(sucursalIdStr)
          : null;

      if (typeof window !== "undefined") {
        localStorage.setItem("empresa_activa", String(empresaIdStr));
        localStorage.setItem("empresa_id", String(empresaIdStr));
        document.cookie = `empresa_activa=${encodeURIComponent(
          String(empresaIdStr)
        )}; path=/; max-age=86400; SameSite=Lax`;

        if (sucursalIdStr) {
          localStorage.setItem("sucursal_activa", String(sucursalIdStr));
          localStorage.setItem("sucursal_id", String(sucursalIdStr));
          document.cookie = `sucursal_activa=${encodeURIComponent(
            String(sucursalIdStr)
          )}; path=/; max-age=86400; SameSite=Lax`;
        } else {
          localStorage.removeItem("sucursal_activa");
          localStorage.removeItem("sucursal_id");
          document.cookie =
            "sucursal_activa=; path=/; max-age=0; SameSite=Lax";
        }
      }

      const userId = user?.id;
      if (userId && !Number.isNaN(empNum) && empNum > 0) {
        const payloadUpdate: {
          empresa_activa: number;
          sucursal_activa?: number | null;
        } = {
          empresa_activa: empNum,
        };

        if (sucursalIdStr !== undefined) {
          payloadUpdate.sucursal_activa = sucNum;
        }

        const { error: perfilErr } = await supabase
          .from("usuarios_perfiles")
          .update(payloadUpdate)
          .eq("id", userId);

        if (perfilErr) {
          const { error: perfilErrAlt } = await supabase
            .from("usuarios_perfiles")
            .update(payloadUpdate)
            .eq("usuario_id", userId);

          if (perfilErrAlt) {
            console.error(
              "Error al actualizar usuarios_perfiles:",
              perfilErrAlt.message || perfilErrAlt
            );
          }
        }
      }
    },
    [user?.id]
  );

  const verificarPeriodo = useCallback(
    async (fecha: string) => {
      if (!selectedCompanyId || !selectedBranchId || !fecha) {
        setErrorPeriodo(null);
        return;
      }

      setValidandoPeriodo(true);
      setErrorPeriodo(null);

      const res = await validarPeriodoContable(selectedCompanyId, selectedBranchId, fecha);
      if (!res.valido) {
        setErrorPeriodo(res.mensaje || "Periodo no habilitado para transacciones.");
      }

      setValidandoPeriodo(false);
    },
    [selectedCompanyId, selectedBranchId]
  );

  useEffect(() => {
    if (selectedCompanyId && selectedBranchId && fechaContabilizacion && mounted) {
      verificarPeriodo(fechaContabilizacion);
    }
  }, [selectedCompanyId, selectedBranchId, fechaContabilizacion, mounted, verificarPeriodo]);

  const fetchBranches = useCallback(async (companyId: string, userId?: string) => {
    try {
      const { data, error: branchErr } = await supabase
        .from("sucursales")
        .select("*")
        .eq("empresa_id", Number(companyId))
        .order("nombre", { ascending: true });

      if (branchErr) throw branchErr;

      const sucursalesList = (data || []) as Branch[];
      setBranches(sucursalesList);

      if (sucursalesList.length === 0) {
        setSelectedBranchId("");
        return;
      }

      let sucursalPreferida =
        typeof window !== "undefined"
          ? localStorage.getItem("sucursal_activa") ||
            localStorage.getItem("sucursal_id") ||
            getCookieValue("sucursal_activa") ||
            ""
          : "";

      if (userId) {
        const { data: permisosUsrSuc } = await supabase
          .from("usuario_permisos_tx")
          .select("sucursal_id")
          .eq("usuario_id", userId)
          .eq("empresa_id", Number(companyId))
          .not("sucursal_id", "is", null);

        const idsSucAsignadas = (permisosUsrSuc || [])
          .map((r: { sucursal_id?: string | number | null }) =>
            r.sucursal_id != null ? String(r.sucursal_id) : ""
          )
          .filter(Boolean);

        if (idsSucAsignadas.length > 0) {
          sucursalPreferida = idsSucAsignadas.includes(sucursalPreferida)
            ? sucursalPreferida
            : idsSucAsignadas[0];
        }
      }

      const existeSuc = sucursalesList.some(
        (b) => String(b.id) === String(sucursalPreferida)
      );
      setSelectedBranchId(
        existeSuc && sucursalPreferida
          ? String(sucursalPreferida)
          : String(sucursalesList[0].id)
      );
    } catch (err: unknown) {
      console.error("Error al cargar sucursales:", err);
      setBranches([]);
      setSelectedBranchId("");
    }
  }, []);

  const fetchDocumentClasses = useCallback(async (companyId: string) => {
    try {
      const { data, error: classErr } = await supabase
        .from("clases_documento")
        .select("*")
        .eq("empresa_id", Number(companyId))
        .order("codigo_clase", { ascending: true });

      if (classErr) throw classErr;

      const clasesList = (data || []) as DocumentClass[];
      setDocumentClasses(clasesList);
      if (clasesList.length > 0) {
        setSelectedDocumentClassId(String(clasesList[0].id));
      } else {
        setSelectedDocumentClassId("");
      }
    } catch (err: unknown) {
      console.error("Error al cargar clases de documento:", err);
      setDocumentClasses([]);
      setSelectedDocumentClassId("");
    }
  }, []);

  const fetchTercerosYRetenciones = useCallback(
    async (companyId: string, fechaStr?: string) => {
      const empNum = Number(companyId);
      if (!companyId || Number.isNaN(empNum) || empNum <= 0) {
        setTercerosEmpresa([]);
        setConceptosRetencion([]);
        return;
      }

      const anioContabilidad = extraerAnioFecha(fechaStr);

      const { data: tercData, error: tercErr } = await supabase
        .from("terceros")
        .select(
          "id, numero_identificacion, razon_social, nombre_comercial, retencion_renta_id, retencion_iva_id, retencion_ica_id"
        )
        .eq("empresa_id", empNum);

      if (tercErr) {
        console.error(
          "Error al cargar terceros por empresa:",
          tercErr.message || tercErr.code || JSON.stringify(tercErr)
        );
        setTercerosEmpresa([]);
      } else {
        const normalizados = (
          (tercData || []) as Array<
            TerceroRetencionInfo & { nombre_comercial?: string | null }
          >
        ).map((t) => ({
          ...t,
          nombre: t.nombre || t.nombre_comercial || t.razon_social || "",
        }));
        setTercerosEmpresa(normalizados);
      }

      const { data: retData, error: retErr } = await supabase
        .from("conceptos_retencion")
        .select(
          "id, empresa_id, anio, tipo_retencion, concepto, base_minima, tarifa, activo, codigo_municipio"
        )
        .eq("empresa_id", empNum)
        .eq("anio", anioContabilidad);

      if (retErr) {
        console.error(
          "Error al cargar conceptos_retencion por empresa y año:",
          retErr.message || retErr.code || JSON.stringify(retErr)
        );
        setConceptosRetencion([]);
      } else {
        setConceptosRetencion((retData || []) as ConceptoRetencionItem[]);
      }
    },
    []
  );

  const fetchInitialData = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData?.user || null;
      if (currentUser) {
        setUser({ id: currentUser.id, email: currentUser.email });
      }

      let idsEmpresasPermitidas: number[] = [];
      if (currentUser) {
        const { data: permisosData } = await supabase
          .from("usuario_permisos_tx")
          .select("empresa_id")
          .eq("usuario_id", currentUser.id);

        idsEmpresasPermitidas = Array.from(
          new Set(
            (permisosData || [])
              .map((p: { empresa_id?: string | number | null }) =>
                p.empresa_id != null ? Number(p.empresa_id) : NaN
              )
              .filter((n) => !Number.isNaN(n) && n > 0)
          )
        );
      }

      let empresasQuery = supabase
        .from("empresas")
        .select("id, razon_social, nit_identificacion")
        .order("razon_social", { ascending: true });

      if (idsEmpresasPermitidas.length > 0) {
        empresasQuery = empresasQuery.in("id", idsEmpresasPermitidas);
      }

      const { data: compData, error: compErr } = await empresasQuery;
      if (compErr) throw compErr;

      const empresasList = (compData || []) as Company[];
      setCompanies(empresasList);

      if (empresasList.length > 0) {
        const empresaGuardadaCookie = getCookieValue("empresa_activa");
        const empresaGuardadaLocal =
          typeof window !== "undefined"
            ? localStorage.getItem("empresa_activa") ||
              localStorage.getItem("empresa_id")
            : null;

        const empresaIdParaSeleccionar =
          empresaGuardadaLocal || empresaGuardadaCookie;
        const existeEmpresa = empresasList.some(
          (emp: Company) => String(emp.id) === String(empresaIdParaSeleccionar)
        );

        if (existeEmpresa && empresaIdParaSeleccionar) {
          setSelectedCompanyId(String(empresaIdParaSeleccionar));
        } else {
          setSelectedCompanyId(String(empresasList[0].id));
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar datos iniciales.";
      setError(msg);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!mounted || !selectedCompanyId) return;

    const syncCompanyData = async () => {
      setSelectedBranchId("");
      setSelectedDocumentClassId("");
      setErrorPeriodo(null);

      await persistirContextoUsuario(selectedCompanyId, "");

      await Promise.all([
        fetchBranches(selectedCompanyId, user?.id),
        fetchDocumentClasses(selectedCompanyId),
        fetchTercerosYRetenciones(selectedCompanyId, fechaContabilizacion),
      ]);
    };

    syncCompanyData();
  }, [
    selectedCompanyId,
    mounted,
    user?.id,
    persistirContextoUsuario,
    fetchBranches,
    fetchDocumentClasses,
    fetchTercerosYRetenciones,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted || !selectedCompanyId) return;
    fetchTercerosYRetenciones(selectedCompanyId, fechaContabilizacion);
  }, [mounted, selectedCompanyId, fechaContabilizacion, fetchTercerosYRetenciones]);

  useEffect(() => {
    if (!mounted || !selectedCompanyId || !selectedBranchId) return;
    persistirContextoUsuario(selectedCompanyId, selectedBranchId);
  }, [mounted, selectedCompanyId, selectedBranchId, persistirContextoUsuario]);

  if (!mounted || loadingInitial) {
    return (
      <div className="max-w-6xl mx-auto p-4 text-center text-xs font-medium text-gray-500">
        Cargando interfaz...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-3 space-y-3 text-xs">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2.5">
          <Link
            href={rutaRetorno}
            title={tituloRetorno}
            className="p-2 text-gray-600 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg transition flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-base font-bold text-gray-900 leading-none">
            Carga de Facturas XML
          </h1>
          <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            Contabilización Automática & Retenciones
          </span>
        </div>
        {user && (
          <div className="text-[10px] text-gray-500">
            Usuario: <span className="font-medium text-gray-700">{user.email}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-1.5 bg-red-50 border border-red-200 text-red-800 rounded text-[11px]">
          {error}
        </div>
      )}

      {/* Selector de Modo (Tabs Carga Individual / Carga Masiva) */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("individual")}
          className={`py-1.5 px-4 text-xs font-semibold rounded-t border-t border-l border-r transition-colors cursor-pointer ${
            activeTab === "individual"
              ? "bg-white border-gray-300 text-blue-600 border-b-transparent -mb-px"
              : "bg-gray-50 border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📄 Carga Individual
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("masiva")}
          className={`py-1.5 px-4 text-xs font-semibold rounded-t border-t border-l border-r transition-colors cursor-pointer ${
            activeTab === "masiva"
              ? "bg-white border-gray-300 text-blue-600 border-b-transparent -mb-px"
              : "bg-gray-50 border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📦 Carga Masiva (Lote)
        </button>
      </div>

      {/* Selectores Parámetros */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-gray-50 p-2 rounded border border-gray-200 items-start">
        <div className="md:col-span-3">
          <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
            Empresa *
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 truncate"
          >
            <option value="">-- Seleccione --</option>
            {companies.map((comp) => (
              <option key={comp.id} value={String(comp.id)}>
                {comp.razon_social || "Sin Nombre"}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
            Sucursal *
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            disabled={!selectedCompanyId || branches.length === 0}
            className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 truncate"
          >
            <option value="">
              {branches.length === 0 ? "Sin sucursales" : "-- Seleccione --"}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.nombre || b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
            Clase Documento *
          </label>
          <select
            value={selectedDocumentClassId}
            onChange={(e) => setSelectedDocumentClassId(e.target.value)}
            disabled={!selectedCompanyId || documentClasses.length === 0}
            className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 truncate"
          >
            <option value="">
              {documentClasses.length === 0 ? "Sin clases" : "-- Seleccione --"}
            </option>
            {documentClasses.map((dc) => (
              <option key={dc.id} value={String(dc.id)}>
                {dc.codigo_clase ? `[${dc.codigo_clase}] ` : ""}
                {dc.nombre_clase || dc.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
            Fecha Contabilidad *
          </label>
          <input
            type="date"
            value={fechaContabilizacion}
            onChange={(e) => {
              const nuevaFecha = e.target.value;
              setFechaContabilizacion(nuevaFecha);
              if (errorPeriodo) setErrorPeriodo(null);
            }}
            onBlur={() => verificarPeriodo(fechaContabilizacion)}
            className="w-full bg-white border border-gray-300 rounded px-1.5 py-1 text-[11px] text-gray-800 focus:ring-1 focus:ring-blue-500"
          />
          {validandoPeriodo && (
            <p className="text-[9px] text-blue-500 mt-0.5 animate-pulse">
              Verificando...
            </p>
          )}
          {errorPeriodo && (
            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1 rounded mt-0.5">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>
      </div>

      {errorPeriodo ? (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded text-xs font-semibold flex items-center justify-between">
          <span>
            🛑 No es posible realizar la carga de facturas XML porque el periodo
            contable seleccionado no se encuentra habilitado o está cerrado.
          </span>
        </div>
      ) : activeTab === "individual" ? (
        <XmlUploader
          selectedCompanyId={selectedCompanyId}
          selectedBranchId={selectedBranchId}
          selectedDocumentClassId={selectedDocumentClassId}
          fechaContabilizacion={fechaContabilizacion}
        />
      ) : (
        <XmlUploaderMasivo
          selectedCompanyId={selectedCompanyId}
          selectedBranchId={selectedBranchId}
          selectedDocumentClassId={selectedDocumentClassId}
          fechaContabilizacion={fechaContabilizacion}
        />
      )}
    </div>
  );
}

export default function CargarFacturasPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto p-4 text-center text-xs font-medium text-gray-500">
          Cargando interfaz...
        </div>
      }
    >
      <CargarFacturasContent />
    </Suspense>
  );
}