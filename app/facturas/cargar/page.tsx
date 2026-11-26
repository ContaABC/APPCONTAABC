"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  Suspense,
  useMemo,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  obtenerEmpresas,
  obtenerSucursales,
} from "@/app/consultas/movimientos/actions";
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  setEmpresaActivaUsuario,
} from "@/app/actions/accionesEmpresas";
import { obtenerDatosAuxiliaresPago } from "@/app/tesoreria/pagos/pagos-actions";
import XmlUploader from "@/components/xml-uploader";
import XmlUploaderMasivo from "@/components/xml-uploader-masivo";
import { validarPeriodoContable } from "@/lib/accounting-validations";

interface UserType {
  id: string;
  email?: string;
  nombre?: string;
}

interface Company {
  id: number | string;
  empresa_id?: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
}

interface Branch {
  id: number | string;
  empresa_id?: number | string;
  codigo_sucursal?: string;
  nombre: string;
  name?: string;
}

interface DocumentClass {
  id: number | string;
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
  nombre?: string;
  base_minima?: number;
  tarifa?: number;
  porcentaje?: number;
  activo?: boolean;
  codigo_municipio?: string | null;
}

function getClienteBrowser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function setCookieValue(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=86400; SameSite=Lax`;
}

function recortarConceptoConPorcentaje(
  conceptoTexto: string,
  pct: number,
  maxConceptoLen = 54
): string {
  const limpio = conceptoTexto.trim();
  const sufijo = ` (${pct}%)`;
  if (limpio.length <= maxConceptoLen) {
    return `${limpio}${sufijo}`;
  }
  return `${limpio.slice(0, maxConceptoLen).trimEnd()}...${sufijo}`;
}

function CargarFacturasContent() {
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState<boolean>(false);
  const [rutaRetorno, setRutaRetorno] = useState<string>("/modulos/proveedores");
  const [tituloRetorno, setTituloRetorno] = useState<string>(
    "Volver a Proveedores"
  );

  const [user, setUser] = useState<UserType | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [documentClasses, setDocumentClasses] = useState<DocumentClass[]>([]);
  const [tercerosEmpresa, setTercerosEmpresa] = useState<TerceroRetencionInfo[]>([]);
  const [conceptosRetencion, setConceptosRetencion] = useState<
    ConceptoRetencionItem[]
  >([]);

  const [selectedRentaId, setSelectedRentaId] = useState<string>("");
  const [selectedIvaId, setSelectedIvaId] = useState<string>("");
  const [selectedIcaId, setSelectedIcaId] = useState<string>("");
  const [rentaDesplegada, setRentaDesplegada] = useState<boolean>(false);
  const [hoverRentaTexto, setHoverRentaTexto] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"individual" | "masiva">(
    "individual"
  );

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("empresa_activa") ||
        localStorage.getItem("empresa_id") ||
        ""
      );
    }
    return "";
  });
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("sucursal_activa") ||
        localStorage.getItem("sucursal_id") ||
        ""
      );
    }
    return "";
  });
  const [selectedDocumentClassId, setSelectedDocumentClassId] =
    useState<string>("");

  const [fechaContabilizacion, setFechaContabilizacion] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const conceptosRenta = useMemo(
    () => conceptosRetencion.filter((c) => c.tipo_retencion === "RENTA"),
    [conceptosRetencion]
  );

  const conceptosIva = useMemo(
    () => conceptosRetencion.filter((c) => c.tipo_retencion === "IVA"),
    [conceptosRetencion]
  );

  const conceptosIca = useMemo(
    () => conceptosRetencion.filter((c) => c.tipo_retencion === "ICA"),
    [conceptosRetencion]
  );

  const conceptoRentaSeleccionado = useMemo(() => {
    if (!selectedRentaId) return null;
    return (
      conceptosRenta.find((c) => String(c.id) === String(selectedRentaId)) ||
      null
    );
  }, [conceptosRenta, selectedRentaId]);

  const textoRentaSeleccionadaCompleto = useMemo(() => {
    if (!conceptoRentaSeleccionado) return null;
    const nombre =
      conceptoRentaSeleccionado.concepto ||
      conceptoRentaSeleccionado.nombre ||
      "";
    const pct =
      conceptoRentaSeleccionado.tarifa != null
        ? Number(conceptoRentaSeleccionado.tarifa)
        : Number(conceptoRentaSeleccionado.porcentaje || 0) * 100;
    return `${nombre} (${pct}%)`;
  }, [conceptoRentaSeleccionado]);

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
        sucursalIdStr &&
        !Number.isNaN(Number(sucursalIdStr)) &&
        Number(sucursalIdStr) > 0
          ? Number(sucursalIdStr)
          : null;

      if (typeof window !== "undefined") {
        localStorage.setItem("empresa_activa", String(empresaIdStr));
        localStorage.setItem("empresa_id", String(empresaIdStr));
        setCookieValue("empresa_activa", String(empresaIdStr));

        if (sucursalIdStr) {
          localStorage.setItem("sucursal_activa", String(sucursalIdStr));
          localStorage.setItem("sucursal_id", String(sucursalIdStr));
          setCookieValue("sucursal_activa", String(sucursalIdStr));
        } else {
          localStorage.removeItem("sucursal_activa");
          localStorage.removeItem("sucursal_id");
          document.cookie =
            "sucursal_activa=; path=/; max-age=0; SameSite=Lax";
        }
      }

      try {
        await setEmpresaActivaUsuario(empresaIdStr);
      } catch {
        // Ignorar si no aplica
      }

      const userId = user?.id;
      if (userId && !Number.isNaN(empNum) && empNum > 0) {
        const payloadUpdate: {
          empresa_activa: number;
          sucursal_activa?: number | null;
        } = { empresa_activa: empNum };

        if (sucursalIdStr !== undefined) {
          payloadUpdate.sucursal_activa = sucNum;
        }

        const client = getClienteBrowser();
        await client
          .from("usuarios_perfiles")
          .update(payloadUpdate)
          .eq("id", userId);
      }
    },
    [user?.id]
  );

  const verificarPeriodo = useCallback(
    async (fecha: string, empIdOverride?: string, sucIdOverride?: string) => {
      const empId = empIdOverride ?? selectedCompanyId;
      const sucId = sucIdOverride ?? selectedBranchId;

      if (!empId || !fecha) {
        setErrorPeriodo(null);
        setValidandoPeriodo(false);
        return;
      }

      setValidandoPeriodo(true);
      setErrorPeriodo(null);

      try {
        const res = await validarPeriodoContable(empId, sucId, fecha);
        setErrorPeriodo(
          res.valido
            ? null
            : res.mensaje ||
                "Periodo no habilitado para transacciones en la empresa seleccionada."
        );
      } catch {
        setErrorPeriodo(null);
      } finally {
        setValidandoPeriodo(false);
      }
    },
    [selectedCompanyId, selectedBranchId]
  );

  useEffect(() => {
    if (!mounted) return;
    if (!selectedCompanyId || !fechaContabilizacion) {
      setErrorPeriodo(null);
      setValidandoPeriodo(false);
      return;
    }
    verificarPeriodo(
      fechaContabilizacion,
      selectedCompanyId,
      selectedBranchId
    );
  }, [
    mounted,
    selectedCompanyId,
    selectedBranchId,
    fechaContabilizacion,
    verificarPeriodo,
  ]);

  const fetchBranches = useCallback(
    async (companyId: string, sucursalUrlOverride?: string | null) => {
      const sucRes = await obtenerSucursales(Number(companyId));
      const lista = sucRes.success ? ((sucRes.data || []) as Branch[]) : [];
      setBranches(lista);

      if (lista.length === 0) {
        setSelectedBranchId("");
        return;
      }

      const guardada =
        sucursalUrlOverride ||
        (typeof window !== "undefined"
          ? localStorage.getItem("sucursal_activa") ||
            localStorage.getItem("sucursal_id") ||
            getCookieValue("sucursal_activa") ||
            ""
          : "");

      const existe = lista.some((b) => String(b.id) === String(guardada));
      setSelectedBranchId(
        existe && guardada ? String(guardada) : String(lista[0].id)
      );
    },
    []
  );

  const fetchDocumentClasses = useCallback(async (companyId: string) => {
    const client = getClienteBrowser();
    const { data } = await client
      .from("clases_documento")
      .select("*")
      .eq("empresa_id", Number(companyId))
      .order("codigo_clase", { ascending: true });

    const lista = (data || []) as DocumentClass[];
    setDocumentClasses(lista);
    setSelectedDocumentClassId(lista.length > 0 ? String(lista[0].id) : "");
  }, []);

  const fetchTercerosYRetenciones = useCallback(async (companyId: string) => {
    const empNum = Number(companyId);
    if (!companyId || Number.isNaN(empNum) || empNum <= 0) {
      setTercerosEmpresa([]);
      setConceptosRetencion([]);
      return;
    }

    const client = getClienteBrowser();

    const { data: tercData, error: tercErr } = await client
      .from("terceros")
      .select(
        "id, numero_identificacion, razon_social, nombre_comercial, retencion_renta_id, retencion_iva_id, retencion_ica_id"
      )
      .eq("empresa_id", empNum);

    if (!tercErr) {
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

    const auxRes = await obtenerDatosAuxiliaresPago(empNum);
    if (auxRes?.success && Array.isArray(auxRes.conceptosRetencion)) {
      setConceptosRetencion(
        auxRes.conceptosRetencion as ConceptoRetencionItem[]
      );
    } else {
      setConceptosRetencion([]);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);
    setErrorPeriodo(null);
    try {
      const client = getClienteBrowser();
      let listaEmpresas: Company[] = [];

      const {
        data: { user: authUser },
      } = await client.auth.getUser();

      if (authUser) {
        setUser({ id: authUser.id, email: authUser.email });
        const { data: permisosTx } = await client
          .from("usuario_permisos_tx")
          .select("empresa_id")
          .eq("usuario_id", authUser.id);

        const idsPermitidos = Array.from(
          new Set(
            (permisosTx || [])
              .map((p: { empresa_id?: number | string | null }) =>
                p.empresa_id != null ? String(p.empresa_id) : ""
              )
              .filter(Boolean)
          )
        );

        if (idsPermitidos.length > 0) {
          const { data: rowsEmp } = await client
            .from("empresas")
            .select("id, razon_social, nombre_comercial")
            .in("id", idsPermitidos);

          if (rowsEmp && rowsEmp.length > 0) {
            listaEmpresas = rowsEmp as Company[];
          }
        }
      }

      if (listaEmpresas.length === 0) {
        try {
          const resPermitidas: unknown = await getEmpresasPermitidas();
          if (Array.isArray(resPermitidas)) {
            listaEmpresas = resPermitidas as Company[];
          } else if (
            resPermitidas &&
            typeof resPermitidas === "object" &&
            Array.isArray((resPermitidas as { datos?: unknown }).datos)
          ) {
            listaEmpresas = (resPermitidas as { datos: Company[] }).datos;
          }
        } catch {
          // Ignorar
        }
      }

      if (listaEmpresas.length === 0) {
        const res = await obtenerEmpresas();
        if (res.success && Array.isArray(res.data)) {
          listaEmpresas = res.data as Company[];
        }
      }

      if (listaEmpresas.length > 0) {
        const ordenadas = [...listaEmpresas].sort((a, b) => {
          const nomA = a.razon_social || a.nombre_comercial || a.nombre || "";
          const nomB = b.razon_social || b.nombre_comercial || b.nombre || "";
          return nomA.localeCompare(nomB, "es", { sensitivity: "base" });
        });
        setCompanies(ordenadas);

        let empresaActivaBD: string | null = null;
        try {
          const bdVal = await getEmpresaActivaUsuario();
          if (bdVal) empresaActivaBD = String(bdVal);
        } catch {
          // Ignorar
        }

        const empresaParam =
          searchParams.get("empresaId") || searchParams.get("empresa_id");
        const localEmp =
          typeof window !== "undefined"
            ? localStorage.getItem("empresa_activa") ||
              localStorage.getItem("empresa_id")
            : null;
        const cookieEmp = getCookieValue("empresa_activa");

        const candidata =
          empresaParam || localEmp || cookieEmp || empresaActivaBD;
        const existe = ordenadas.some(
          (e) => String(e.id || e.empresa_id) === String(candidata)
        );

        const idFinal =
          existe && candidata
            ? String(candidata)
            : String(ordenadas[0].id || ordenadas[0].empresa_id);

        setSelectedCompanyId(idFinal);
        if (typeof window !== "undefined") {
          localStorage.setItem("empresa_activa", idFinal);
          localStorage.setItem("empresa_id", idFinal);
        }
        setCookieValue("empresa_activa", idFinal);
      } else {
        setCompanies([]);
        setSelectedCompanyId("");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al cargar empresas asignadas."
      );
    } finally {
      setLoadingInitial(false);
    }
  }, [searchParams]);

  useEffect(() => {
    setMounted(true);
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!mounted || !selectedCompanyId) return;

    const sucursalParam =
      searchParams.get("sucursalId") || searchParams.get("sucursal_id");

    const syncCompanyData = async () => {
      setSelectedBranchId("");
      setSelectedDocumentClassId("");
      setSelectedRentaId("");
      setSelectedIvaId("");
      setSelectedIcaId("");
      setRentaDesplegada(false);
      setHoverRentaTexto(null);
      setErrorPeriodo(null);

      await persistirContextoUsuario(selectedCompanyId, sucursalParam || "");
      await Promise.all([
        fetchBranches(selectedCompanyId, sucursalParam),
        fetchDocumentClasses(selectedCompanyId),
        fetchTercerosYRetenciones(selectedCompanyId),
      ]);
    };

    syncCompanyData();
  }, [
    selectedCompanyId,
    mounted,
    searchParams,
    persistirContextoUsuario,
    fetchBranches,
    fetchDocumentClasses,
    fetchTercerosYRetenciones,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted || !selectedCompanyId || !selectedBranchId) return;
    persistirContextoUsuario(selectedCompanyId, selectedBranchId);
  }, [mounted, selectedCompanyId, selectedBranchId, persistirContextoUsuario]);

  if (!mounted || loadingInitial) {
    return (
      <div className="max-w-7xl mx-auto p-6 text-center text-sm font-medium text-gray-500">
        Cargando interfaz...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 text-sm">
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={rutaRetorno}
            title={tituloRetorno}
            className="p-2.5 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Carga de Facturas XML
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
              Contabilización Automática &amp; Retenciones
            </p>
          </div>
        </div>
        {user && (
          <div className="text-xs text-gray-500">
            Usuario:{" "}
            <span className="font-semibold text-gray-700">{user.email}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-xs md:text-sm">
          {error}
        </div>
      )}

      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("individual")}
          className={`py-2 px-5 text-xs md:text-sm font-semibold rounded-t border-t border-l border-r transition-colors cursor-pointer ${
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
          className={`py-2 px-5 text-xs md:text-sm font-semibold rounded-t border-t border-l border-r transition-colors cursor-pointer ${
            activeTab === "masiva"
              ? "bg-white border-gray-300 text-blue-600 border-b-transparent -mb-px"
              : "bg-gray-50 border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📦 Carga Masiva (Lote)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200 items-start">
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Empresa *
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              setErrorPeriodo(null);
            }}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate"
          >
            <option value="">-- Seleccione --</option>
            {companies.map((comp) => {
              const id = String(comp.id || comp.empresa_id);
              return (
                <option key={id} value={id}>
                  {comp.razon_social || comp.nombre_comercial || comp.nombre}
                </option>
              );
            })}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Sucursal *
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            disabled={!selectedCompanyId || branches.length === 0}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-100 truncate"
          >
            <option value="">
              {branches.length === 0 ? "Sin sucursales" : "-- Seleccione --"}
            </option>
            {branches.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>
                {b.nombre || b.name}
                {b.codigo_sucursal ? ` (${b.codigo_sucursal})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Clase Documento *
          </label>
          <select
            value={selectedDocumentClassId}
            onChange={(e) => setSelectedDocumentClassId(e.target.value)}
            disabled={!selectedCompanyId || documentClasses.length === 0}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-100 truncate"
          >
            <option value="">
              {documentClasses.length === 0
                ? "Sin clases"
                : "-- Seleccione --"}
            </option>
            {documentClasses.map((dc) => (
              <option key={String(dc.id)} value={String(dc.id)}>
                {dc.codigo_clase ? `[${dc.codigo_clase}] ` : ""}
                {dc.nombre_clase || dc.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Fecha Contabilidad *
          </label>
          <input
            type="date"
            value={fechaContabilizacion}
            disabled={!selectedCompanyId}
            onChange={(e) => {
              const nuevaFecha = e.target.value;
              setFechaContabilizacion(nuevaFecha);
              if (errorPeriodo) setErrorPeriodo(null);
            }}
            onBlur={() => {
              if (selectedCompanyId && fechaContabilizacion) {
                verificarPeriodo(
                  fechaContabilizacion,
                  selectedCompanyId,
                  selectedBranchId
                );
              }
            }}
            className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs md:text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-100"
          />
          {selectedCompanyId && validandoPeriodo && (
            <p className="text-xs text-blue-500 mt-1 animate-pulse">
              Verificando...
            </p>
          )}
          {selectedCompanyId && errorPeriodo && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1.5 rounded mt-1">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>

        <div
          className="md:col-span-4 pt-2 border-t border-gray-100 relative"
          onMouseEnter={() => {
            if (textoRentaSeleccionadaCompleto) {
              setHoverRentaTexto(textoRentaSeleccionadaCompleto);
            }
          }}
          onMouseLeave={() => {
            setHoverRentaTexto(null);
            setRentaDesplegada(false);
          }}
        >
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Retención RENTA
          </label>
          <select
            value={selectedRentaId}
            size={rentaDesplegada ? Math.min(6, conceptosRenta.length + 1) : 1}
            title={textoRentaSeleccionadaCompleto || "Retención RENTA"}
            onFocus={() => setRentaDesplegada(true)}
            onBlur={() => {
              setRentaDesplegada(false);
              setHoverRentaTexto(null);
            }}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedRentaId(val);
              setRentaDesplegada(false);
              const found = conceptosRenta.find(
                (item) => String(item.id) === String(val)
              );
              if (found) {
                const nom = found.concepto || found.nombre || "";
                const p =
                  found.tarifa != null
                    ? Number(found.tarifa)
                    : Number(found.porcentaje || 0) * 100;
                setHoverRentaTexto(`${nom} (${p}%)`);
              } else {
                setHoverRentaTexto(null);
              }
            }}
            className={`w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate cursor-pointer ${
              rentaDesplegada ? "max-h-36 overflow-y-auto" : ""
            }`}
          >
            <option value="">-- Sin Retención Renta --</option>
            {conceptosRenta.map((cr) => {
              const nombre = cr.concepto || cr.nombre || "";
              const pct =
                cr.tarifa != null
                  ? Number(cr.tarifa)
                  : Number(cr.porcentaje || 0) * 100;
              const textoCompleto = `${nombre} (${pct}%)`;
              return (
                <option
                  key={String(cr.id)}
                  value={String(cr.id)}
                  title={textoCompleto}
                  onMouseEnter={() => setHoverRentaTexto(textoCompleto)}
                >
                  {recortarConceptoConPorcentaje(nombre, pct, 54)}
                </option>
              );
            })}
          </select>

          {hoverRentaTexto && (
            <div className="mt-1.5 p-2 bg-slate-900 text-white text-[11px] rounded-md shadow-md border border-slate-700 leading-snug">
              {hoverRentaTexto}
            </div>
          )}
        </div>

        <div className="md:col-span-4 pt-2 border-t border-gray-100">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Retención IVA
          </label>
          <select
            value={selectedIvaId}
            onChange={(e) => setSelectedIvaId(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate cursor-pointer"
          >
            <option value="">-- Sin Retención IVA --</option>
            {conceptosIva.map((cr) => {
              const nombre = cr.concepto || cr.nombre || "";
              const pct =
                cr.tarifa != null
                  ? Number(cr.tarifa)
                  : Number(cr.porcentaje || 0) * 100;
              const textoCompleto = `${nombre} (${pct}%)`;
              return (
                <option
                  key={String(cr.id)}
                  value={String(cr.id)}
                  title={textoCompleto}
                >
                  {textoCompleto}
                </option>
              );
            })}
          </select>
        </div>

        <div className="md:col-span-4 pt-2 border-t border-gray-100">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Retención ICA
          </label>
          <select
            value={selectedIcaId}
            onChange={(e) => setSelectedIcaId(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate cursor-pointer"
          >
            <option value="">-- Sin Retención ICA --</option>
            {conceptosIca.map((cr) => {
              const nombre = cr.concepto || cr.nombre || "";
              const porMil =
                cr.tarifa != null
                  ? Number(cr.tarifa)
                  : Number(cr.porcentaje || 0) * 1000;
              const textoCompleto = `${nombre} (${porMil} x mil)`;
              return (
                <option
                  key={String(cr.id)}
                  value={String(cr.id)}
                  title={textoCompleto}
                >
                  {textoCompleto}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {selectedCompanyId && errorPeriodo ? (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs md:text-sm font-semibold flex items-center justify-between">
          <span>
            🛑 No es posible realizar la carga de facturas XML porque el periodo
            contable seleccionado no se encuentra habilitado o está cerrado para
            la empresa activa.
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

      {tercerosEmpresa.length > 0 && (
        <div className="hidden" data-terceros-count={tercerosEmpresa.length} />
      )}
    </div>
  );
}

export default function CargarFacturasPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto p-6 text-center text-sm font-medium text-gray-500">
          Cargando interfaz...
        </div>
      }
    >
      <CargarFacturasContent />
    </Suspense>
  );
}