"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  setEmpresaActivaUsuario,
  type Empresa as EmpresaPermitida,
} from "@/app/actions/accionesEmpresas";
import {
  obtenerSucursalesPorEmpresa,
  obtenerClasesDocumentoEmpresa,
  actualizarEstadoClaseDocumento,
  actualizarEstadoTodasClasesDocumento,
  obtenerUltimoCierrePeriodo,
  ejecutarCierreServer,
  procesarCierreAnualServer,
  obtenerPeriodosAperturas,
  bloquearPeriodoAperturaServer,
  desbloquearPeriodoAperturaServer,
  habilitarPeriodoAperturaServer,
  obtenerCuentasAuxiliaresPorElemento,
} from "./actions";
import {
  Lock,
  Unlock,
  Calendar,
  FileSpreadsheet,
  Layers,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

type Empresa = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
  nit_identificacion?: string;
  dv?: string;
};

interface SucursalItem {
  id: number | string;
  nombre?: string;
  codigo_sucursal?: string;
  ciudad?: string;
}

interface ClaseDocItem {
  id: number;
  codigo_clase?: string;
  nombre_clase?: string;
  estado?: string;
  es_sistema?: boolean;
}

interface CuentaAuxItem {
  id: number;
  codigo_auxiliar?: string;
  nombre?: string;
  elemento?: string;
}

interface PeriodoAperturaItem {
  anio: number;
  mes: number;
  periodo: string;
  estado: string;
  esCierreContable: boolean;
}

interface DetalleSimulacionItem {
  tipo: string;
  cuenta: string;
  nombre: string;
  saldo: number;
  concepto_id?: number;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function obtenerNombreEmpresa(emp: Empresa): string {
  return String(
    emp.razon_social || emp.nombre_comercial || emp.nombre || "Empresa"
  );
}

function obtenerUsuarioIdDesdeLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  for (const clave of ["usuario_id", "user_id", "uid"]) {
    const val = localStorage.getItem(clave);
    if (val && val.trim()) return val.trim();
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.includes("auth-token") || k.includes("supabase")) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const idEncontrado =
          parsed?.user?.id ||
          parsed?.currentSession?.user?.id ||
          parsed?.session?.user?.id ||
          null;
        if (idEncontrado && typeof idEncontrado === "string") {
          return idEncontrado;
        }
      } catch {
        // Ignorar
      }
    }
  }
  return null;
}

function obtenerRangoMesActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const desde = new Date(y, m, 1).toISOString().split("T")[0];
  const hasta = new Date(y, m + 1, 0).toISOString().split("T")[0];
  return { desde, hasta };
}

export default function CierresContablesPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const rangoMes = obtenerRangoMesActual();
  const anioActual = new Date().getFullYear();

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");

  const [sucursales, setSucursales] = useState<SucursalItem[]>([]);
  const [sucursalId, setSucursalId] = useState<string>("");

  const [pestanaActiva, setPestanaActiva] = useState<
    "MENSUAL" | "ANUAL" | "PERIODOS" | "CLASES"
  >("MENSUAL");

  const [moduloCierre, setModuloCierre] = useState<string>("CONTABILIDAD");
  const [subtipoProceso, setSubtipoProceso] = useState<string>("CIERRE_MENSUAL");
  const [periodoDesde, setPeriodoDesde] = useState<string>(rangoMes.desde);
  const [periodoHasta, setPeriodoHasta] = useState<string>(rangoMes.hasta);
  const [ultimoCierreTexto, setUltimoCierreTexto] = useState<string>("");
  const [ejecutandoMensual, setEjecutandoMensual] = useState<boolean>(false);

  const [anioCierre, setAnioCierre] = useState<number>(anioActual - 1);
  const [clasesDocumento, setClasesDocumento] = useState<ClaseDocItem[]>([]);
  const [claseDocumentoId, setClaseDocumentoId] = useState<string>("");
  const [cuentasPatrimonio, setCuentasPatrimonio] = useState<CuentaAuxItem[]>(
    []
  );
  const [cuentaPatrimonioId, setCuentaPatrimonioId] = useState<string>("");
  const [detallesSimulacion, setDetallesSimulacion] = useState<
    DetalleSimulacionItem[]
  >([]);
  const [procesandoAnual, setProcesandoAnual] = useState<boolean>(false);

  const [periodos, setPeriodos] = useState<PeriodoAperturaItem[]>([]);
  const [cargandoPeriodos, setCargandoPeriodos] = useState<boolean>(false);
  const [nuevoAnioHabilitar, setNuevoAnioHabilitar] =
    useState<number>(anioActual);
  const [nuevoMesHabilitar, setNuevoMesHabilitar] = useState<number>(
    new Date().getMonth() + 1
  );

  const [mensaje, setMensaje] = useState<{
    tipo: "success" | "error";
    texto: string;
  } | null>(null);

  const resolverUsuarioId = useCallback(async (): Promise<string | null> => {
    if (usuarioIdRef.current) return usuarioIdRef.current;
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        usuarioIdRef.current = data.user.id;
        return data.user.id;
      }
    } catch {
      // Ignorar
    }
    const localUid = obtenerUsuarioIdDesdeLocalStorage();
    if (localUid) {
      usuarioIdRef.current = localUid;
    }
    return localUid;
  }, []);

  const persistirEmpresaActiva = useCallback(
    async (empVal: string) => {
      if (!empVal) return;
      const uid = await resolverUsuarioId();
      const empNormalizado = Number.isNaN(Number(empVal))
        ? empVal
        : Number(empVal);

      try {
        await setEmpresaActivaUsuario(empVal, uid, null);
      } catch {
        // Continuar
      }

      if (uid) {
        await supabase
          .from("usuarios_perfiles")
          .update({ empresa_activa: empNormalizado })
          .eq("id", uid);
      }
    },
    [resolverUsuarioId]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || inicializadoRef.current) return;
    inicializadoRef.current = true;
    let cancelado = false;

    async function init() {
      try {
        const uid = await resolverUsuarioId();
        const permitidas = await getEmpresasPermitidas(uid);
        if (cancelado) return;

        const listaEmpresas: Empresa[] = Array.isArray(permitidas)
          ? (permitidas as Empresa[])
          : [];
        setEmpresas(listaEmpresas);

        if (listaEmpresas.length > 0) {
          let empBD: string | null = null;
          try {
            const valBD = await getEmpresaActivaUsuario(uid);
            if (
              valBD !== null &&
              valBD !== undefined &&
              String(valBD).trim() !== ""
            ) {
              empBD = String(valBD).trim();
            }
          } catch {
            // Ignorar
          }

          const empCookie = getCookieValue("empresa_activa");
          const empLocal =
            typeof window !== "undefined"
              ? localStorage.getItem("empresa_activa") ||
                localStorage.getItem("empresa_id")
              : null;

          const candidata = empBD || empCookie || empLocal;
          let empresaIdAUsar = String(listaEmpresas[0].id);

          if (
            candidata &&
            listaEmpresas.some((e) => String(e.id) === String(candidata))
          ) {
            empresaIdAUsar = String(candidata);
          }

          const empElegida =
            listaEmpresas.find((e) => String(e.id) === empresaIdAUsar) ||
            listaEmpresas[0];

          if (typeof window !== "undefined") {
            localStorage.setItem("empresa_activa", empresaIdAUsar);
            localStorage.setItem("empresa_id", empresaIdAUsar);
            localStorage.setItem(
              "empresa_activa_nombre",
              obtenerNombreEmpresa(empElegida)
            );
          }
          document.cookie = `empresa_activa=${encodeURIComponent(
            empresaIdAUsar
          )}; path=/; max-age=86400; SameSite=Lax`;

          setEmpresaId(empresaIdAUsar);
        }
      } catch (err) {
        console.error("Error inicializando cierres contables:", err);
      }
    }

    init();
    return () => {
      cancelado = true;
    };
  }, [isMounted, resolverUsuarioId]);

  const handleCambioEmpresa = async (nuevoId: string) => {
    setEmpresaId(nuevoId);
    setSucursalId("");
    setDetallesSimulacion([]);
    setMensaje(null);

    if (typeof window !== "undefined" && nuevoId) {
      const empSel = empresas.find((e) => String(e.id) === String(nuevoId));
      localStorage.setItem("empresa_activa", nuevoId);
      localStorage.setItem("empresa_id", nuevoId);
      if (empSel) {
        localStorage.setItem(
          "empresa_activa_nombre",
          obtenerNombreEmpresa(empSel)
        );
      }
      document.cookie = `empresa_activa=${encodeURIComponent(
        nuevoId
      )}; path=/; max-age=86400; SameSite=Lax`;
    }

    await persistirEmpresaActiva(nuevoId);
  };

  const cargarPeriodos = useCallback(async (empId: string, sucId: string) => {
    if (!empId) return;
    setCargandoPeriodos(true);
    const res = await obtenerPeriodosAperturas(
      Number(empId),
      Number(sucId || 0)
    );
    setCargandoPeriodos(false);
    if (res.success) {
      setPeriodos((res.data || []) as PeriodoAperturaItem[]);
    }
  }, []);

  const cargarUltimoCierre = useCallback(
    async (empId: string, sucId: string, mod: string) => {
      if (!empId) return;
      const res = await obtenerUltimoCierrePeriodo(
        Number(empId),
        Number(sucId || 0),
        mod
      );
      if (res.success && res.data) {
        setUltimoCierreTexto(
          `Último cierre ${mod}: ${res.data.periodo_desde} al ${res.data.periodo_hasta} (${res.data.estado})`
        );
      } else {
        setUltimoCierreTexto(`Sin cierres previos registrados en ${mod}.`);
      }
    },
    []
  );

  useEffect(() => {
    if (!isMounted || !empresaId) return;

    async function cargarDatos() {
      const [resSuc, resClases, resPatrimonio] = await Promise.all([
        obtenerSucursalesPorEmpresa(empresaId),
        obtenerClasesDocumentoEmpresa(empresaId),
        obtenerCuentasAuxiliaresPorElemento(empresaId, "Patrimonio"),
      ]);

      const listaSuc = (resSuc.data || []) as SucursalItem[];
      setSucursales(listaSuc);
      const sucDefault =
        listaSuc.find((s) => s.codigo_sucursal === "SUC-001") || listaSuc[0];
      const sucIdInicial = sucDefault ? String(sucDefault.id) : "";
      setSucursalId(sucIdInicial);

      const listaClases = (resClases.data || []) as ClaseDocItem[];
      setClasesDocumento(listaClases);
      setClaseDocumentoId(
        listaClases.length > 0 ? String(listaClases[0].id) : ""
      );

      const listaPat = (resPatrimonio.data || []) as CuentaAuxItem[];
      setCuentasPatrimonio(listaPat);
      setCuentaPatrimonioId(listaPat.length > 0 ? String(listaPat[0].id) : "");

      await Promise.all([
        cargarUltimoCierre(empresaId, sucIdInicial, moduloCierre),
        cargarPeriodos(empresaId, sucIdInicial),
      ]);
    }

    cargarDatos();
  }, [isMounted, empresaId, moduloCierre, cargarUltimoCierre, cargarPeriodos]);

  useEffect(() => {
    if (!isMounted || !empresaId) return;
    cargarUltimoCierre(empresaId, sucursalId, moduloCierre);
    cargarPeriodos(empresaId, sucursalId);
  }, [
    isMounted,
    empresaId,
    sucursalId,
    moduloCierre,
    cargarUltimoCierre,
    cargarPeriodos,
  ]);

  const handleEjecutarCierreMensual = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (!empresaId) {
      setMensaje({ tipo: "error", texto: "Seleccione una empresa activa." });
      return;
    }

    setEjecutandoMensual(true);
    const uid = await resolverUsuarioId();
    const res = await ejecutarCierreServer({
      empresaId: Number(empresaId),
      sucursalId: sucursalId ? Number(sucursalId) : null,
      modulo: moduloCierre,
      subtipoProceso,
      periodoDesde,
      periodoHasta,
      usuarioCreacion: uid || undefined,
    });
    setEjecutandoMensual(false);

    if (res?.success) {
      setMensaje({
        tipo: "success",
        texto: res.mensaje || "Cierre ejecutado correctamente.",
      });
      await Promise.all([
        cargarUltimoCierre(empresaId, sucursalId, moduloCierre),
        cargarPeriodos(empresaId, sucursalId),
      ]);
    } else {
      setMensaje({
        tipo: "error",
        texto: res?.error || "No se pudo ejecutar el cierre.",
      });
    }
  };

  const handleCierreAnual = async (soloSimular: boolean) => {
    setMensaje(null);
    setProcesandoAnual(true);

    const res = await procesarCierreAnualServer({
      empresaId: Number(empresaId),
      sucursalId: sucursalId ? Number(sucursalId) : null,
      anio: Number(anioCierre),
      cuentaPatrimonioId: cuentaPatrimonioId
        ? Number(cuentaPatrimonioId)
        : undefined,
      claseDocumentoId: claseDocumentoId
        ? Number(claseDocumentoId)
        : undefined,
      soloSimular,
    });

    setProcesandoAnual(false);

    if (res?.success) {
      if (res.simulacion && Array.isArray(res.detalles)) {
        setDetallesSimulacion(res.detalles as DetalleSimulacionItem[]);
      }
      setMensaje({
        tipo: "success",
        texto: res.mensaje || "Proceso de cierre anual completado.",
      });
      if (!soloSimular) {
        await cargarPeriodos(empresaId, sucursalId);
      }
    } else {
      setMensaje({
        tipo: "error",
        texto: res?.error || "Error al procesar el cierre anual.",
      });
    }
  };

  const handleToggleEstadoClase = async (clase: ClaseDocItem) => {
    setMensaje(null);
    const nuevoEstado: "Activa" | "Inactiva" =
      clase.estado === "Inactiva" ? "Activa" : "Inactiva";
    const res = await actualizarEstadoClaseDocumento(clase.id, nuevoEstado);
    if (res.success) {
      setClasesDocumento((prev) =>
        prev.map((c) => (c.id === clase.id ? { ...c, estado: nuevoEstado } : c))
      );
    } else {
      setMensaje({
        tipo: "error",
        texto: res.error || "Error al actualizar estado de clase de documento.",
      });
    }
  };

  const handleEstadoTodasClases = async (estado: "Activa" | "Inactiva") => {
    if (!empresaId) return;
    setMensaje(null);
    const res = await actualizarEstadoTodasClasesDocumento(
      Number(empresaId),
      estado
    );
    if (res.success) {
      setClasesDocumento((prev) => prev.map((c) => ({ ...c, estado })));
      setMensaje({
        tipo: "success",
        texto: `Todas las clases de documento marcadas como ${estado}.`,
      });
    } else {
      setMensaje({
        tipo: "error",
        texto: res.error || "Error al actualizar las clases de documento.",
      });
    }
  };

  const handleBloquear = async (periodoStr: string) => {
    setMensaje(null);
    const res = await bloquearPeriodoAperturaServer({
      empresaId: Number(empresaId),
      sucursalId: sucursalId ? Number(sucursalId) : null,
      periodoDesde: `${periodoStr}-01`,
    });
    if (res.success) {
      setMensaje({
        tipo: "success",
        texto: res.mensaje || "Periodo bloqueado.",
      });
      await cargarPeriodos(empresaId, sucursalId);
    } else {
      setMensaje({ tipo: "error", texto: res.error || "Error al bloquear." });
    }
  };

  const handleDesbloquear = async (periodoStr: string) => {
    setMensaje(null);
    const res = await desbloquearPeriodoAperturaServer({
      empresaId: Number(empresaId),
      sucursalId: sucursalId ? Number(sucursalId) : null,
      periodoDesde: `${periodoStr}-01`,
    });
    if (res.success) {
      setMensaje({
        tipo: "success",
        texto: res.mensaje || "Periodo desbloqueado.",
      });
      await cargarPeriodos(empresaId, sucursalId);
    } else {
      setMensaje({
        tipo: "error",
        texto: res.error || "Error al desbloquear.",
      });
    }
  };

  const handleHabilitarNuevoPeriodo = async () => {
    setMensaje(null);
    const res = await habilitarPeriodoAperturaServer({
      empresaId: Number(empresaId),
      sucursalId: sucursalId ? Number(sucursalId) : null,
      anio: Number(nuevoAnioHabilitar),
      mes: Number(nuevoMesHabilitar),
    });
    if (res.success) {
      setMensaje({
        tipo: "success",
        texto: res.mensaje || "Periodo habilitado.",
      });
      await cargarPeriodos(empresaId, sucursalId);
    } else {
      setMensaje({
        tipo: "error",
        texto: res.error || "Error al habilitar periodo.",
      });
    }
  };

  const fmt = (v: number) => `$ ${Number(v || 0).toLocaleString("es-CO")}`;

  if (!isMounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-sm font-sans">
      <div className="border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition border border-slate-200 cursor-pointer shrink-0"
          >
            ← Atrás
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Cierres Contables y Control de Periodos
            </h1>
            <p className="text-sm text-slate-500">
              Cierres mensuales, cierre anual NIIF y administración de periodos.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="md:col-span-6">
          <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
            Empresa Activa
          </label>
          <select
            value={empresaId}
            onChange={(e) => handleCambioEmpresa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold text-sm outline-none"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {obtenerNombreEmpresa(emp)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-6">
          <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
            Sucursal
          </label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold text-sm outline-none"
          >
            {sucursales.map((suc) => (
              <option key={suc.id} value={String(suc.id)}>
                {suc.codigo_sucursal ? `${suc.codigo_sucursal} - ` : ""}
                {suc.nombre || suc.ciudad || `Sucursal #${suc.id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        <button
          type="button"
          onClick={() => {
            setPestanaActiva("MENSUAL");
            setMensaje(null);
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            pestanaActiva === "MENSUAL"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Calendar className="w-4 h-4" /> Cierre Mensual / Módulo
        </button>

        <button
          type="button"
          onClick={() => {
            setPestanaActiva("ANUAL");
            setMensaje(null);
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            pestanaActiva === "ANUAL"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Cierre Anual
        </button>

        <button
          type="button"
          onClick={() => {
            setPestanaActiva("PERIODOS");
            setMensaje(null);
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            pestanaActiva === "PERIODOS"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Lock className="w-4 h-4" /> Apertura y Bloqueo de Periodos
        </button>

        <button
          type="button"
          onClick={() => {
            setPestanaActiva("CLASES");
            setMensaje(null);
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
            pestanaActiva === "CLASES"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" /> Clases de Documento
        </button>
      </div>

      {mensaje && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-start gap-3 ${
            mensaje.tipo === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {mensaje.tipo === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{mensaje.texto}</span>
        </div>
      )}

      {pestanaActiva === "MENSUAL" && (
        <form
          onSubmit={handleEjecutarCierreMensual}
          className="bg-white border rounded-xl p-6 space-y-5 shadow-2xs"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
            <h2 className="text-sm font-bold uppercase text-slate-800">
              Ejecución de Cierre por Periodo
            </h2>
            <span className="text-xs font-mono text-slate-500">
              {ultimoCierreTexto}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
                Módulo
              </label>
              <select
                value={moduloCierre}
                onChange={(e) => setModuloCierre(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none"
              >
                <option value="CONTABILIDAD">Contabilidad</option>
                <option value="CARTERA">Cartera</option>
                <option value="TESORERIA">Tesorería</option>
                <option value="INVENTARIOS">Inventarios</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
                Subtipo Proceso
              </label>
              <select
                value={subtipoProceso}
                onChange={(e) => setSubtipoProceso(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
              >
                <option value="CIERRE_MENSUAL">Cierre Mensual</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
                Periodo Desde
              </label>
              <input
                type="date"
                value={periodoDesde}
                onChange={(e) => setPeriodoDesde(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
                Periodo Hasta
              </label>
              <input
                type="date"
                value={periodoHasta}
                onChange={(e) => setPeriodoHasta(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={ejecutandoMensual || !empresaId}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer transition"
            >
              <Lock className="w-4 h-4" />
              {ejecutandoMensual ? "Ejecutando cierre..." : "Ejecutar Cierre"}
            </button>
          </div>
        </form>
      )}

      {pestanaActiva === "ANUAL" && (
        <div className="bg-white border rounded-xl p-6 space-y-5 shadow-2xs">
          <h2 className="text-sm font-bold uppercase text-slate-800 border-b pb-3">
            Cierre Anual NIIF — Traslado Directo a Patrimonio
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
                Año a Cerrar
              </label>
              <select
                value={anioCierre}
                onChange={(e) => setAnioCierre(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none"
              >
                {[2024, 2025, 2026, 2027, 2028].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
                Clase de Documento
              </label>
              <select
                value={claseDocumentoId}
                onChange={(e) => setClaseDocumentoId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
              >
                <option value="">-- Seleccione --</option>
                {clasesDocumento.map((cd) => (
                  <option key={cd.id} value={String(cd.id)}>
                    {cd.codigo_clase ? `${cd.codigo_clase} - ` : ""}
                    {cd.nombre_clase || `Clase #${cd.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
                Cuenta Patrimonio (Destino)
              </label>
              <select
                value={cuentaPatrimonioId}
                onChange={(e) => setCuentaPatrimonioId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 outline-none"
              >
                <option value="">-- Seleccione --</option>
                {cuentasPatrimonio.map((cta) => (
                  <option key={cta.id} value={String(cta.id)}>
                    {cta.codigo_auxiliar} - {cta.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleCierreAnual(true)}
              disabled={procesandoAnual || !empresaId}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer transition"
            >
              <Eye className="w-4 h-4" /> Simular Cierre Anual
            </button>
            <button
              type="button"
              onClick={() => handleCierreAnual(false)}
              disabled={procesandoAnual || !empresaId}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer transition"
            >
              <Lock className="w-4 h-4" />
              {procesandoAnual ? "Procesando..." : "Procesar Cierre Anual"}
            </button>
          </div>

          {detallesSimulacion.length > 0 && (
            <div className="overflow-x-auto border rounded-xl mt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b uppercase">
                  <tr>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Cuenta</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detallesSimulacion.map((det, idx) => (
                    <tr
                      key={`${det.cuenta}_${idx}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="p-3 font-bold text-slate-800">
                        {det.tipo}
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {det.cuenta}
                      </td>
                      <td className="p-3 text-slate-900">{det.nombre}</td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-700">
                        {fmt(det.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {pestanaActiva === "PERIODOS" && (
        <div className="bg-white border rounded-xl p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b pb-4">
            <div>
              <h2 className="text-sm font-bold uppercase text-slate-800">
                Control de Periodos Contables
              </h2>
              <p className="text-xs text-slate-500">
                Habilita, bloquea o desbloquea periodos mensuales.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Año
                </label>
                <input
                  type="number"
                  value={nuevoAnioHabilitar}
                  onChange={(e) => setNuevoAnioHabilitar(Number(e.target.value))}
                  className="w-24 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Mes (1-12)
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={nuevoMesHabilitar}
                  onChange={(e) => setNuevoMesHabilitar(Number(e.target.value))}
                  className="w-20 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleHabilitarNuevoPeriodo}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer transition"
              >
                Habilitar Periodo
              </button>
            </div>
          </div>

          {cargandoPeriodos ? (
            <div className="p-8 text-center text-slate-500 font-semibold">
              Cargando periodos...
            </div>
          ) : periodos.length === 0 ? (
            <div className="p-8 text-center text-slate-500 italic">
              No hay periodos disponibles para mostrar.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b uppercase">
                  <tr>
                    <th className="p-3">Periodo</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {periodos.map((p) => (
                    <tr key={p.periodo} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {p.periodo}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.estado === "Cerrado"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {p.estado}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {p.estado === "Cerrado" ? (
                          <button
                            type="button"
                            onClick={() => handleDesbloquear(p.periodo)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <Unlock className="w-3.5 h-3.5" /> Desbloquear
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBloquear(p.periodo)}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <Lock className="w-3.5 h-3.5" /> Bloquear
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
      )}

      {pestanaActiva === "CLASES" && (
        <div className="bg-white border rounded-xl p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
            <div>
              <h2 className="text-sm font-bold uppercase text-slate-800">
                Estado de Clases de Documento
              </h2>
              <p className="text-xs text-slate-500">
                Activa o inactiva clases de documento para la empresa activa.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleEstadoTodasClases("Activa")}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs cursor-pointer transition"
              >
                Activar Todas
              </button>
              <button
                type="button"
                onClick={() => handleEstadoTodasClases("Inactiva")}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer transition"
              >
                Inactivar Todas
              </button>
            </div>
          </div>

          {clasesDocumento.length === 0 ? (
            <div className="p-8 text-center text-slate-500 italic">
              No hay clases de documento registradas para esta empresa.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b uppercase">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clasesDocumento.map((cd) => {
                    const estaInactiva =
                      cd.estado === "Inactiva" || cd.estado === "Inactivo";
                    return (
                      <tr key={cd.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-800">
                          {cd.codigo_clase || "-"}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          {cd.nombre_clase || `Clase #${cd.id}`}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              estaInactiva
                                ? "bg-slate-200 text-slate-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {estaInactiva ? "Inactiva" : "Activa"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleEstadoClase(cd)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                          >
                            {estaInactiva ? "Activar" : "Inactivar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}