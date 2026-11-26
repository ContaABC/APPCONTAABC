"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ClipboardCheck,
  Search,
  Building2,
  Layers,
  LogIn,
  LogOut,
  PlusCircle,
  Pencil,
  FileText,
  RefreshCw,
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Empresa {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
}

interface Sucursal {
  id: number | string;
  empresa_id: number | string;
  nombre?: string;
  nombre_sucursal?: string;
}

interface UsuarioPerfil {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
}

interface AuditoriaLogRow {
  id: string;
  usuario_id: string;
  empresa_id: number | string | null;
  sucursal_id: number | string | null;
  tipo_evento: "LOGIN" | "LOGOUT" | "TX_ACCION" | string;
  modulo?: string | null;
  tx_nombre?: string | null;
  clase_documento?: string | null;
  accion_sql?: string | null;
  cantidad_inserciones?: number | null;
  cantidad_actualizaciones?: number | null;
  hora_entrada?: string | null;
  hora_salida?: string | null;
  detalle?: string | null;
  creado_en: string;
}

function formatHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFechaHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditoriaUsuariosPage() {
  const hoyIso = new Date().toISOString().split("T")[0];
  const hace7DiasIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [modoConsolidado, setModoConsolidado] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState<string>("");

  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState<string>("");
  const [usuarioIdSeleccionado, setUsuarioIdSeleccionado] =
    useState<string>("");

  const [fechaDesde, setFechaDesde] = useState<string>(hace7DiasIso);
  const [fechaHasta, setFechaHasta] = useState<string>(hoyIso);
  const [filtroClaseDoc, setFiltroClaseDoc] = useState<string>("");
  const [filtroTx, setFiltroTx] = useState<string>("");

  const [registros, setRegistros] = useState<AuditoriaLogRow[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState<boolean>(true);
  const [cargandoAuditoria, setCargandoAuditoria] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    async function cargarCatalogosIniciales() {
      setCargandoCatalogos(true);
      setErrorMsg("");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setErrorMsg("Sesión no iniciada.");
          return;
        }

        const { data: permisosAdmin } = await supabase
          .from("usuario_permisos_tx")
          .select("empresa_id")
          .eq("usuario_id", session.user.id);

        const idsEmpAdmin = Array.from(
          new Set(
            (permisosAdmin || [])
              .map((p: { empresa_id?: string | number | null }) =>
                p.empresa_id != null ? String(p.empresa_id).trim() : ""
              )
              .filter(Boolean)
          )
        );

        const empresasNums = idsEmpAdmin
          .map((id) => Number(id))
          .filter((n) => !Number.isNaN(n));

        const [empRes, usrRes, sucRes] = await Promise.all([
          empresasNums.length > 0
            ? supabase
                .from("empresas")
                .select("id, razon_social, nombre_comercial")
                .in("id", empresasNums)
                .order("razon_social", { ascending: true })
            : Promise.resolve({ data: [] }),
          supabase
            .from("usuarios_perfiles")
            .select("id, nombres, apellidos, cedula, email")
            .order("nombres", { ascending: true }),
          empresasNums.length > 0
            ? supabase
                .from("sucursales")
                .select("id, empresa_id, nombre")
                .in("empresa_id", empresasNums)
            : Promise.resolve({ data: [] }),
        ]);

        const listaEmp = (empRes.data || []) as Empresa[];
        const listaUsr = (usrRes.data || []) as UsuarioPerfil[];
        const listaSuc = (sucRes.data || []) as Sucursal[];

        setEmpresas(listaEmp);
        setUsuarios(listaUsr);
        setSucursales(listaSuc);

        if (listaEmp.length > 0) {
          setEmpresaId(String(listaEmp[0].id));
        }
        if (listaUsr.length > 0) {
          setUsuarioIdSeleccionado(listaUsr[0].id);
        }
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Error al cargar catálogos de auditoría."
        );
      } finally {
        setCargandoCatalogos(false);
      }
    }

    cargarCatalogosIniciales();
  }, []);

  const consultarAuditoria = useCallback(async () => {
    if (!usuarioIdSeleccionado) {
      setRegistros([]);
      return;
    }

    setCargandoAuditoria(true);
    setErrorMsg("");

    try {
      let query = supabase
        .from("auditoria_usuarios_logs")
        .select("*")
        .eq("usuario_id", usuarioIdSeleccionado)
        .order("creado_en", { ascending: false });

      if (!modoConsolidado && empresaId) {
        query = query.eq("empresa_id", Number(empresaId));
        if (sucursalId) {
          query = query.eq("sucursal_id", Number(sucursalId));
        }
      } else if (modoConsolidado && empresas.length > 0) {
        const idsPermitidos = empresas
          .map((e) => Number(e.id))
          .filter((n) => !Number.isNaN(n));
        if (idsPermitidos.length > 0) {
          query = query.in("empresa_id", idsPermitidos);
        }
      }

      if (fechaDesde) {
        query = query.gte("creado_en", `${fechaDesde}T00:00:00.000Z`);
      }
      if (fechaHasta) {
        query = query.lte("creado_en", `${fechaHasta}T23:59:59.999Z`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRegistros((data || []) as AuditoriaLogRow[]);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "No se pudo consultar la auditoría del usuario."
      );
      setRegistros([]);
    } finally {
      setCargandoAuditoria(false);
    }
  }, [
    usuarioIdSeleccionado,
    modoConsolidado,
    empresaId,
    sucursalId,
    empresas,
    fechaDesde,
    fechaHasta,
  ]);

  useEffect(() => {
    if (!cargandoCatalogos && usuarioIdSeleccionado) {
      consultarAuditoria();
    }
  }, [cargandoCatalogos, usuarioIdSeleccionado, consultarAuditoria]);

  const usuariosFiltrados = useMemo(() => {
    const q = busquedaUsuario.toLowerCase().trim();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nombres?.toLowerCase().includes(q) ||
        u.apellidos?.toLowerCase().includes(q) ||
        u.cedula?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [usuarios, busquedaUsuario]);

  const sucursalesDeEmpresa = useMemo(() => {
    if (!empresaId) return [];
    return sucursales.filter((s) => String(s.empresa_id) === String(empresaId));
  }, [sucursales, empresaId]);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      const matchClase = filtroClaseDoc
        ? (r.clase_documento || "")
            .toLowerCase()
            .includes(filtroClaseDoc.toLowerCase())
        : true;
      const matchTx = filtroTx
        ? `${r.tx_nombre || ""} ${r.modulo || ""}`
            .toLowerCase()
            .includes(filtroTx.toLowerCase())
        : true;
      return matchClase && matchTx;
    });
  }, [registros, filtroClaseDoc, filtroTx]);

  const resumen = useMemo(() => {
    let totalInserciones = 0;
    let totalActualizaciones = 0;
    let ultimaEntrada: string | null = null;
    let ultimaSalida: string | null = null;
    const clasesDoc = new Set<string>();
    const txsUsadas = new Set<string>();

    for (const r of registrosFiltrados) {
      totalInserciones += Number(r.cantidad_inserciones || 0);
      totalActualizaciones += Number(r.cantidad_actualizaciones || 0);

      if (r.clase_documento) clasesDoc.add(r.clase_documento);
      if (r.tx_nombre) txsUsadas.add(r.tx_nombre);

      const entradaCand = r.hora_entrada || (r.tipo_evento === "LOGIN" ? r.creado_en : null);
      const salidaCand = r.hora_salida || (r.tipo_evento === "LOGOUT" ? r.creado_en : null);

      if (entradaCand && (!ultimaEntrada || new Date(entradaCand) > new Date(ultimaEntrada))) {
        ultimaEntrada = entradaCand;
      }
      if (salidaCand && (!ultimaSalida || new Date(salidaCand) > new Date(ultimaSalida))) {
        ultimaSalida = salidaCand;
      }
    }

    return {
      totalInserciones,
      totalActualizaciones,
      ultimaEntrada,
      ultimaSalida,
      totalClasesDoc: clasesDoc.size,
      totalTxs: txsUsadas.size,
    };
  }, [registrosFiltrados]);

  const nombreEmpresaPorId = (id: number | string | null) => {
    if (id == null) return "Consolidado";
    const emp = empresas.find((e) => String(e.id) === String(id));
    return emp?.razon_social || emp?.nombre_comercial || emp?.nombre || `Empresa #${id}`;
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8 text-xs">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              href="/modulos/contabilidad/configuracion"
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Volver"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold">
                Auditoría de Actividad por Usuario
              </h1>
              <p className="text-[11px] text-zinc-500">
                TX utilizadas, inserciones/actualizaciones, clases de documento,
                entrada y salida ({modoConsolidado ? "Consolidado" : "Por Empresa"}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModoConsolidado(false)}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                !modoConsolidado
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Por Empresa</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setModoConsolidado(true);
                setSucursalId("");
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                modoConsolidado
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Consolidado</span>
            </button>

            <button
              type="button"
              onClick={consultarAuditoria}
              disabled={cargandoAuditoria}
              className="px-3 py-1.5 rounded-xl font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${cargandoAuditoria ? "animate-spin" : ""}`}
              />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Filtros */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Selección de Usuario */}
          <div className="lg:col-span-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2.5">
            <h2 className="font-bold">1. Usuario a Auditar</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Buscar por nombre, cédula o correo..."
                value={busquedaUsuario}
                onChange={(e) => setBusquedaUsuario(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
              {usuariosFiltrados.map((u) => {
                const activo = String(u.id) === String(usuarioIdSeleccionado);
                return (
                  <div
                    key={u.id}
                    onClick={() => setUsuarioIdSeleccionado(u.id)}
                    className={`p-2 rounded-xl border cursor-pointer transition ${
                      activo
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 font-bold"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="truncate">
                        {u.nombres} {u.apellidos}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        CC {u.cedula}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Parámetros de Alcance y Filtros */}
          <div className="lg:col-span-8 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <h2 className="font-bold">2. Alcance y Filtros de Consulta</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {!modoConsolidado ? (
                <>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                      Empresa
                    </label>
                    <select
                      value={empresaId}
                      onChange={(e) => {
                        setEmpresaId(e.target.value);
                        setSucursalId("");
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-semibold cursor-pointer"
                    >
                      {empresas.map((emp) => (
                        <option
                          key={emp.id}
                          value={String(emp.id)}
                          className="dark:bg-zinc-900"
                        >
                          {emp.razon_social || emp.nombre_comercial || emp.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                      Sucursal
                    </label>
                    <select
                      value={sucursalId}
                      onChange={(e) => setSucursalId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-semibold cursor-pointer"
                    >
                      <option value="" className="dark:bg-zinc-900">
                        Todas las sucursales
                      </option>
                      {sucursalesDeEmpresa.map((suc) => (
                        <option
                          key={suc.id}
                          value={String(suc.id)}
                          className="dark:bg-zinc-900"
                        >
                          {suc.nombre || suc.nombre_sucursal}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2 flex items-center px-3 py-2 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 text-indigo-800 dark:text-indigo-200 font-semibold">
                  Consolidando registros de todas las empresas autorizadas ({empresas.length}).
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                  Clase de Documento
                </label>
                <input
                  type="text"
                  placeholder="Ej. FV, NC, RC..."
                  value={filtroClaseDoc}
                  onChange={(e) => setFiltroClaseDoc(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                  Transacción / Módulo
                </label>
                <input
                  type="text"
                  placeholder="Ej. Facturas, Contabilidad..."
                  value={filtroTx}
                  onChange={(e) => setFiltroTx(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tarjetas Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-[11px] font-semibold">
              <span>Última Entrada</span>
              <LogIn className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm font-bold mt-1">{formatHora(resumen.ultimaEntrada)}</p>
            <p className="text-[10px] text-zinc-400">
              {resumen.ultimaEntrada ? formatFechaHora(resumen.ultimaEntrada) : "Sin registro"}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-[11px] font-semibold">
              <span>Última Salida</span>
              <LogOut className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-sm font-bold mt-1">{formatHora(resumen.ultimaSalida)}</p>
            <p className="text-[10px] text-zinc-400">
              {resumen.ultimaSalida ? formatFechaHora(resumen.ultimaSalida) : "Sin registro"}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-[11px] font-semibold">
              <span>Total Inserciones</span>
              <PlusCircle className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-base font-extrabold text-blue-600 mt-1">
              {resumen.totalInserciones}
            </p>
            <p className="text-[10px] text-zinc-400">
              {resumen.totalTxs} TX · {resumen.totalClasesDoc} clases doc
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-[11px] font-semibold">
              <span>Total Actualizaciones</span>
              <Pencil className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-base font-extrabold text-amber-600 mt-1">
              {resumen.totalActualizaciones}
            </p>
            <p className="text-[10px] text-zinc-400">
              {registrosFiltrados.length} eventos listados
            </p>
          </div>
        </div>

        {/* Tabla de Auditoría */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Detalle de Operaciones y Sesiones</span>
          </h2>

          {cargandoAuditoria ? (
            <p className="text-center text-zinc-400 py-8">
              Consultando registros de auditoría...
            </p>
          ) : registrosFiltrados.length === 0 ? (
            <p className="text-center text-zinc-400 py-8">
              No hay registros de auditoría para los filtros seleccionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase text-zinc-500">
                    <th className="py-2 pr-3">Fecha / Hora</th>
                    {modoConsolidado && <th className="py-2 pr-3">Empresa</th>}
                    <th className="py-2 pr-3">Módulo / TX</th>
                    <th className="py-2 pr-3">Clase Doc</th>
                    <th className="py-2 pr-3 text-right">Inserciones</th>
                    <th className="py-2 pr-3 text-right">Updates</th>
                    <th className="py-2 pr-3">Entrada</th>
                    <th className="py-2">Salida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {registrosFiltrados.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap font-medium">
                        {formatFechaHora(r.creado_en)}
                      </td>
                      {modoConsolidado && (
                        <td className="py-2 pr-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                          {nombreEmpresaPorId(r.empresa_id)}
                        </td>
                      )}
                      <td className="py-2 pr-3">
                        <span className="font-semibold">
                          {r.tx_nombre || r.tipo_evento}
                        </span>
                        {r.modulo && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {r.modulo}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap font-mono text-[11px]">
                        {r.clase_documento || "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-bold text-blue-600">
                        {Number(r.cantidad_inserciones || 0)}
                      </td>
                      <td className="py-2 pr-3 text-right font-bold text-amber-600">
                        {Number(r.cantidad_actualizaciones || 0)}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                        {formatHora(
                          r.hora_entrada ||
                            (r.tipo_evento === "LOGIN" ? r.creado_en : null)
                        )}
                      </td>
                      <td className="py-2 whitespace-nowrap text-rose-700 dark:text-rose-400">
                        {formatHora(
                          r.hora_salida ||
                            (r.tipo_evento === "LOGOUT" ? r.creado_en : null)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}