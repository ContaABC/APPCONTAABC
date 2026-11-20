"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { getEmpresasPermitidas } from "@/app/actions/accionesEmpresas";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true);
  const [empresaId, setEmpresaId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("empresa_activa") || localStorage.getItem("empresa_id") || "";
    }
    return "";
  });
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

  // Cargar únicamente empresas asignadas al usuario y detectar la empresa activa
  useEffect(() => {
    if (!isMounted) return;

    async function cargarEmpresas() {
      setLoadingEmpresas(true);
      try {
        let listaEmpresas: Empresa[] = [];

        const { data: authData } = await supabase.auth.getSession();
        const userId = authData?.session?.user?.id;

        if (userId) {
          const { data: permisosTx } = await supabase
            .from("usuario_permisos_tx")
            .select("empresa_id")
            .eq("usuario_id", userId);

          const empresaIds = Array.from(
            new Set((permisosTx || []).map((p: any) => String(p.empresa_id)).filter(Boolean))
          );

          if (empresaIds.length > 0) {
            const { data, error } = await supabase
              .from("empresas")
              .select("*")
              .in("id", empresaIds)
              .order("razon_social", { ascending: true });

            if (!error && data && data.length > 0) {
              listaEmpresas = data;
            }
          }
        }

        if (listaEmpresas.length === 0) {
          const resPermitidas: any = await getEmpresasPermitidas();
          if (Array.isArray(resPermitidas)) {
            listaEmpresas = resPermitidas;
          } else if (Array.isArray(resPermitidas?.datos)) {
            listaEmpresas = resPermitidas.datos;
          } else if (Array.isArray(resPermitidas?.data)) {
            listaEmpresas = resPermitidas.data;
          }
        }

        if (listaEmpresas.length > 0) {
          setEmpresas(listaEmpresas);

          const cookieEmpresa = document.cookie
            .split("; ")
            .find((row) => row.startsWith("empresa_activa="));
          const empresaGuardadaCookie = cookieEmpresa ? cookieEmpresa.split("=")[1] : null;
          const empresaGuardadaLocal =
            typeof window !== "undefined"
              ? localStorage.getItem("empresa_activa") || localStorage.getItem("empresa_id")
              : null;

          const empresaIdParaSeleccionar = empresaGuardadaLocal || empresaGuardadaCookie;
          const existeEmpresa = listaEmpresas.some(
            (emp: Empresa) => String(emp.id) === String(empresaIdParaSeleccionar)
          );

          const idFinal =
            existeEmpresa && empresaIdParaSeleccionar
              ? String(empresaIdParaSeleccionar)
              : String(listaEmpresas[0].id);

          setEmpresaId(idFinal);
          if (typeof window !== "undefined") {
            localStorage.setItem("empresa_activa", idFinal);
            localStorage.setItem("empresa_id", idFinal);
          }
          document.cookie = `empresa_activa=${idFinal}; path=/; max-age=86400; SameSite=Lax`;
        } else {
          setEmpresas([]);
        }
      } catch (err) {
        console.error("Error al cargar empresas asignadas:", err);
        setEmpresas([]);
      } finally {
        setLoadingEmpresas(false);
      }
    }

    cargarEmpresas();
  }, [isMounted]);

  // Persistir cambios de empresaId y sincronizar sucursal activa y perfil de usuario
  const handleCambioEmpresa = async (nuevoId: string) => {
    setEmpresaId(nuevoId);
    if (!nuevoId) {
      setClases([]);
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("empresa_activa", String(nuevoId));
      localStorage.setItem("empresa_id", String(nuevoId));
    }
    document.cookie = `empresa_activa=${nuevoId}; path=/; max-age=86400; SameSite=Lax`;

    try {
      const { data: authData } = await supabase.auth.getSession();
      const userId = authData?.session?.user?.id;
      if (userId) {
        const { data: sucursalesEmpresa } = await supabase
          .from("sucursales")
          .select("id")
          .eq("empresa_id", nuevoId)
          .order("id", { ascending: true })
          .limit(1);

        const payloadUpdate: Record<string, any> = { empresa_activa: nuevoId };
        if (sucursalesEmpresa && sucursalesEmpresa.length > 0) {
          const primeraSucursalId = String(sucursalesEmpresa[0].id);
          payloadUpdate.sucursal_activa = primeraSucursalId;
          if (typeof window !== "undefined") {
            localStorage.setItem("sucursal_activa", primeraSucursalId);
          }
          document.cookie = `sucursal_activa=${primeraSucursalId}; path=/; max-age=86400; SameSite=Lax`;
        }

        await supabase
          .from("usuarios_perfiles")
          .update(payloadUpdate)
          .eq("id", userId);
      }
    } catch (err) {
      console.error("Error al sincronizar empresa y sucursal en perfil:", err);
    }
  };

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
    <div className="p-6 max-w-7xl mx-auto space-y-5 text-xs bg-slate-50/50 min-h-screen">
      {/* Encabezado limpio con botón atrás antes del título */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/modulos/contabilidad/configuracion"
            className="p-2.5 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition flex items-center justify-center shrink-0"
            title="Volver a Configuración"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">
              Clases de Documento
            </h1>
            <p className="text-slate-500 text-xs truncate">
              Administra los tipos, códigos y configuración contable de documentos por empresa.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Empresa:</span>
            <select
              value={empresaId}
              onChange={(e) => handleCambioEmpresa(e.target.value)}
              disabled={!isMounted || loadingEmpresas || empresas.length <= 1}
              suppressHydrationWarning
              className="bg-transparent border-none text-xs text-slate-800 font-bold outline-none cursor-pointer max-w-[280px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!isMounted || loadingEmpresas ? (
                <option value="">Cargando empresas...</option>
              ) : empresas.length === 0 ? (
                <option value="">Sin empresas asignadas</option>
              ) : (
                <>
                  {empresas.length !== 1 && <option value="">-- Seleccione una Empresa --</option>}
                  {empresas.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.razon_social || emp.nombre_comercial || emp.nombre} ({emp.nit || emp.nit_identificacion || ""})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <button
            onClick={abrirModalNuevo}
            disabled={!isMounted || !empresaId}
            suppressHydrationWarning
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-sm shadow-indigo-200 transition cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
          >
            <span className="text-sm leading-none">+</span> Nueva Clase
          </button>
        </div>
      </div>

      {/* Tabla con diseño limpio y refinado */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Cargando clases de documento...</div>
        ) : clases.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No hay clases de documento registradas para esta empresa.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Nombre de la Clase</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4 text-center">Caja/Bancos</th>
                  <th className="py-3 px-4 text-center">Sistema</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition group">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{c.codigo_clase}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{c.nombre_clase}</td>
                    <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate">{c.descripcion || "—"}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md ${c.afecta_caja_bancos ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" : "bg-slate-100 text-slate-400"}`}>
                        {c.afecta_caja_bancos ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md ${c.es_sistema ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60" : "bg-slate-100 text-slate-400"}`}>
                        {c.es_sistema ? "Sistema" : "Manual"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md ${c.estado === "Inactiva" ? "bg-rose-50 text-rose-700 border border-rose-200/60" : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"}`}>
                        {c.estado || "Activa"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => abrirModalEditar(c)}
                          title="Editar"
                          className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition cursor-pointer"
                        >
                          ✏️
                        </button>
                        {!c.es_sistema && (
                          <button
                            onClick={() => eliminarClase(c)}
                            title="Eliminar"
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                {claseEditar ? "Editar Clase de Documento" : "Nueva Clase de Documento"}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-sm">✕</button>
            </div>

            <form onSubmit={guardarClase} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Código Clase *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={codigoClase}
                    onChange={(e) => setCodigoClase(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                    placeholder="Ej: 01"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Estado</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as "Activa" | "Inactiva")}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none bg-slate-50/50 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="Activa">Activa</option>
                    <option value="Inactiva">Inactiva</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre de la Clase *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={nombreClase}
                  onChange={(e) => setNombreClase(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 font-medium text-slate-800"
                  placeholder="Ej: Facturas de Proveedores"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                  placeholder="Detalle o uso de esta clase de documento..."
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  id="afecta_caja"
                  checked={afectaCajaBancos}
                  onChange={(e) => setAfectaCajaBancos(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="afecta_caja" className="text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                  Afecta Caja y Bancos (Movimientos de Tesorería)
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setModalAbierto(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition">Cancelar</button>
                <button type="submit" disabled={guardando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-indigo-200 cursor-pointer transition disabled:opacity-50">
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