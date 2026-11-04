"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import XmlUploader from "@/components/xml-uploader";
import XmlUploaderMasivo from "@/components/xml-uploader-masivo";

interface UserType {
  id: string;
  email?: string;
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

export default function CargarFacturasPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [documentClasses, setDocumentClasses] = useState<DocumentClass[]>([]);

  // Pestaña activa: 'individual' | 'masiva'
  const [activeTab, setActiveTab] = useState<"individual" | "masiva">("individual");

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedDocumentClassId, setSelectedDocumentClassId] = useState<string>("");

  const [fechaContabilizacion, setFechaContabilizacion] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async (companyId: string) => {
    try {
      const { data, error: branchErr } = await supabase
        .from("sucursales")
        .select("*")
        .eq("empresa_id", companyId)
        .order("nombre", { ascending: true });

      if (branchErr) throw branchErr;

      const sucursalesList = data || [];
      setBranches(sucursalesList);
      if (sucursalesList.length > 0) {
        setSelectedBranchId(String(sucursalesList[0].id));
      } else {
        setSelectedBranchId("");
      }
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
        .eq("empresa_id", companyId)
        .order("codigo_clase", { ascending: true });

      if (classErr) throw classErr;

      const clasesList = data || [];
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

  const fetchInitialData = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setUser({ id: userData.user.id, email: userData.user.email });
      }

      const { data: compData, error: compErr } = await supabase
        .from("empresas")
        .select("id, razon_social, nit_identificacion")
        .order("razon_social", { ascending: true });

      if (compErr) throw compErr;

      const empresasList = compData || [];
      setCompanies(empresasList);

      if (empresasList.length > 0) {
        setSelectedCompanyId(String(empresasList[0].id));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar datos iniciales.";
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
      await fetchBranches(selectedCompanyId);
      await fetchDocumentClasses(selectedCompanyId);
    };

    syncCompanyData();
  }, [selectedCompanyId, mounted, fetchBranches, fetchDocumentClasses]);

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
      <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
        <div className="flex items-center gap-2">
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
          onClick={() => setActiveTab("individual")}
          className={`py-1.5 px-4 text-xs font-semibold rounded-t border-t border-l border-r transition-colors ${
            activeTab === "individual"
              ? "bg-white border-gray-300 text-blue-600 border-b-transparent -mb-px"
              : "bg-gray-50 border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📄 Carga Individual
        </button>
        <button
          onClick={() => setActiveTab("masiva")}
          className={`py-1.5 px-4 text-xs font-semibold rounded-t border-t border-l border-r transition-colors ${
            activeTab === "masiva"
              ? "bg-white border-gray-300 text-blue-600 border-b-transparent -mb-px"
              : "bg-gray-50 border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📦 Carga Masiva (Lote)
        </button>
      </div>

      {/* Selectores Parámetros (Compartidos por ambas vistas) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-50 p-2 rounded border border-gray-200">
        <div>
          <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
            Empresa *
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Seleccione --</option>
            {companies.map((comp) => (
              <option key={comp.id} value={String(comp.id)}>
                {comp.razon_social || "Sin Nombre"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
            Sucursal *
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            disabled={!selectedCompanyId || branches.length === 0}
            className="w-full bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
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

        <div>
          <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
            Clase Documento *
          </label>
          <select
            value={selectedDocumentClassId}
            onChange={(e) => setSelectedDocumentClassId(e.target.value)}
            disabled={!selectedCompanyId || documentClasses.length === 0}
            className="w-full bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
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

        <div>
          <label className="block text-[9px] font-bold text-gray-600 uppercase mb-0.5">
            Fecha Contabilidad *
          </label>
          <input
            type="date"
            value={fechaContabilizacion}
            onChange={(e) => setFechaContabilizacion(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Renderizado Condicional del Componente según la Pestaña Activa */}
      {activeTab === "individual" ? (
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