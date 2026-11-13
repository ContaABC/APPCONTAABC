"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

interface Empresa {
  id: string | number;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
  nit?: string;
  nit_identificacion?: string;
}

interface ClaseDocumento {
  id: string | number;
  empresa_id: string | number;
  codigo_clase: string;
  nombre_clase: string;
  descripcion?: string | null;
  afecta_caja_bancos?: boolean;
  es_sistema?: boolean;
  estado?: "Activa" | "Inactiva";
}

export default function ClasesDocumentoPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [clases, setClases] = useState<ClaseDocumento[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Estados del formulario modal (Crear / Editar)
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [claseEditar, setClaseEditar] = useState<ClaseDocumento | null>(null);
  
  const [codigoClase, setCodigoClase] = useState<string>("");
  const [nombreClase, setNombreClase] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");
  const [afectaCajaBancos, setAfectaCajaBancos] = useState<boolean>(false);
  const [estado, setEstado] = useState<"Activa" | "Inactiva">("Activa");
  const [guardando, setGuardando] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cargar empresas y detectar la empresa activa corporativa
  useEffect(() => {
    if (!isMounted) return;

    async function cargarEmpresas() {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .order("razon_social", { ascending: true });

      if (!error && data && data.length > 0) {
        setEmpresas(data);

        const cookieEmpresa = document.cookie
          .split("; ")
          .find((row) => row.startsWith("empresa_activa="));
        const empresaGuardadaCookie = cookieEmpresa ? cookieEmpresa.split("=")[1] : null;
        const empresaGuardadaLocal = typeof window !== "undefined" ? localStorage.getItem("empresa_activa") : null;

        const empresaIdParaSeleccionar = empresaGuardadaCookie || empresaGuardadaLocal;
        const existeEmpresa = data.some((emp: Empresa) => String(emp.id) === String(empresaIdParaSeleccionar));

        if (existeEmpresa && empresaIdParaSeleccionar) {
          setEmpresaId(String(empresaIdParaSeleccionar));
        } else {
          setEmpresaId(String(data[0].id));
        }
      }
    }
    cargarEmpresas();
  }, [isMounted]);

  // Persistir cambios de empresaId
  useEffect(() => {
    if (empresaId && typeof window !== "undefined") {
      localStorage.setItem("empresa_activa", String(empresaId));
      document.cookie = `empresa_activa=${empresaId}; path=/; max-age=86400; SameSite=Lax`;
    }
  }, [empresaId]);

  const cargarClases = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("clases_documento")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("codigo_clase", { ascending: true });

    if (!error && data) {
      setClases(data);
    } else {
      setClases([]);
    }
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    if (isMounted && empresaId) {
      cargarClases();
    }
  }, [empresaId, isMounted, cargarClases]);

  const abrirModalNuevo = () => {
    setClaseEditar(null);
    setCodigoClase("");
    setNombreClase("");
    setDescripcion("");
    setAfectaCajaBancos(false);
    setEstado("Activa");
    setModalAbierto(true);
  };

  const abrirModalEditar = (clase: ClaseDocumento) => {
    setClaseEditar(clase);
    setCodigoClase(clase.codigo_clase || "");
    setNombreClase(clase.nombre_clase || "");
    setDescripcion(clase.descripcion || "");
    setAfectaCajaBancos(Boolean(clase.afecta_caja_bancos));
    setEstado(clase.estado || "Activa");
    setModalAbierto(true);
  };

  const guardarClase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId || !codigoClase || !nombreClase) {
      alert("Por favor completa los campos requeridos.");
      return;
    }

    setGuardando(true);
    try {
      if (claseEditar) {
        const { error } = await supabase
          .from("clases_documento")
          .update({
            codigo_clase: codigoClase,
            nombre_clase: nombreClase,
            descripcion: descripcion || null,
            afecta_caja_bancos: afectaCajaBancos,
            estado: estado,
          })
          .eq("id", claseEditar.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("clases_documento").insert({
          empresa_id: empresaId,
          codigo_clase: codigoClase,
          nombre_clase: nombreClase,
          descripcion: descripcion || null,
          afecta_caja_bancos: afectaCajaBancos,
          estado: estado,
        });

        if (error) throw error;
      }

      setModalAbierto(false);
      cargarClases();
    } catch (err: any) {
      alert("Error al guardar la clase de documento: " + (err.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const eliminarClase = async (clase: ClaseDocumento) => {
    if (clase.es_sistema) {
      alert("Esta clase es del sistema y está protegida contra eliminación.");
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la clase "${clase.nombre_clase}"?`)) return;

    const { error } = await supabase.from("clases_documento").delete().eq("id", clase.id);
    if (!error) {
      cargarClases();
    } else {
      alert("No se pudo eliminar la clase de documento (puede estar protegida por el trigger del sistema).");
    }
  };

  if (!isMounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/modulos/contabilidad/configuracion"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              ← Regresar a Configuración
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Clases de Documento</h1>
          <p className="text-sm text-slate-500">Administra los tipos, códigos y configuración contable de documentos por empresa.</p>
        </div>
        <button
          onClick={abrirModalNuevo}
          disabled={!empresaId}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md transition cursor-pointer disabled:opacity-50"
        >
          + Nueva Clase de Documento
        </button>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Empresa Activa</label>
        <select
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          className="w-full md:w-1/2 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.razon_social || emp.nombre_comercial || emp.nombre} ({emp.nit || emp.nit_identificacion || ""})
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Cargando clases de documento...</div>
        ) : clases.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No hay clases de documento registradas para esta empresa.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="p-3">Código</th>
                  <th className="p-3">Nombre de la Clase</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3 text-center">Caja/Bancos</th>
                  <th className="p-3 text-center">Sistema</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-slate-900">{c.codigo_clase}</td>
                    <td className="p-3 font-medium text-slate-800">{c.nombre_clase}</td>
                    <td className="p-3 text-slate-500">{c.descripcion || "—"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${c.afecta_caja_bancos ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {c.afecta_caja_bancos ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${c.es_sistema ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                        {c.es_sistema ? "Sistema" : "Manual"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${c.estado === "Inactiva" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {c.estado || "Activa"}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-2">
                      <button onClick={() => abrirModalEditar(c)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer">
                        Editar
                      </button>
                      {!c.es_sistema && (
                        <button onClick={() => eliminarClase(c)} className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-semibold cursor-pointer">
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base">
                {claseEditar ? "Editar Clase de Documento" : "Nueva Clase de Documento"}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={guardarClase} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Código Clase *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={codigoClase}
                    onChange={(e) => setCodigoClase(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none font-mono"
                    placeholder="Ej: 01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Estado</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as "Activa" | "Inactiva")}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none bg-white font-medium"
                  >
                    <option value="Activa">Activa</option>
                    <option value="Inactiva">Inactiva</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nombre de la Clase *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={nombreClase}
                  onChange={(e) => setNombreClase(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="Ej: Facturas de Proveedores"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="Detalle o uso de esta clase de documento..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="afecta_caja"
                  checked={afectaCajaBancos}
                  onChange={(e) => setAfectaCajaBancos(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="afecta_caja" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Afecta Caja y Bancos (Movimientos de Tesorería)
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setModalAbierto(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold cursor-pointer">Cancelar</button>
                <button type="submit" disabled={guardando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">
                  {guardando ? "Guardando..." : "Guardar Clase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}