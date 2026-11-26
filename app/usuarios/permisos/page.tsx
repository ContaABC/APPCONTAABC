"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
}

interface Sucursal {
  id: string | number;
  empresa_id: string | number;
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

interface TransaccionSistema {
  id: number;
  ruta_acceso?: string;
  modulo: string;
  layout: string;
  es_modulo_padre: boolean;
}

interface PermisoTxRow {
  empresa_id: number | string;
  sucursal_id: number | string | null;
  transaccion_id: number | string | null;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function quitarTildes(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizarModuloKey(modulo?: string | null): string {
  const limpio = quitarTildes(String(modulo || "GENERAL"))
    .replace(/\s+/g, " ")
    .toUpperCase();
  return limpio || "GENERAL";
}

function PermisosUsuariosContent() {
  const searchParams = useSearchParams();

  const [rutaRetorno, setRutaRetorno] = useState<string>(
    "/modulos/contabilidad/configuracion"
  );
  const [tituloRetorno, setTituloRetorno] = useState<string>(
    "Volver a Configuración"
  );

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaIdSeleccionada, setEmpresaIdSeleccionada] =
    useState<string>("");

  const [sucursalesLista, setSucursalesLista] = useState<Sucursal[]>([]);
  const [sucursalIdSeleccionada, setSucursalIdSeleccionada] =
    useState<string>("");

  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState<string>("");
  const [usuarioIdSeleccionado, setUsuarioIdSeleccionado] =
    useState<string>("");
  const [usuarioFijadoId, setUsuarioFijadoId] = useState<string>("");

  const [transacciones, setTransacciones] = useState<TransaccionSistema[]>([]);
  const [modulosSeleccionados, setModulosSeleccionados] = useState<string[]>(
    []
  );
  const [permisosActuales, setPermisosActuales] = useState<number[]>([]);

  const [cargandoTx, setCargandoTx] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);

  const empresasRef = useRef<Empresa[]>([]);
  const transaccionesRef = useRef<TransaccionSistema[]>([]);
  const inicializadoRef = useRef<boolean>(false);

  useEffect(() => {
    empresasRef.current = empresas;
  }, [empresas]);

  useEffect(() => {
    transaccionesRef.current = transacciones;
  }, [transacciones]);

  useEffect(() => {
    const fromParam = searchParams.get("from");
    if (fromParam && fromParam.startsWith("/")) {
      setRutaRetorno(fromParam);
      setTituloRetorno(
        fromParam.startsWith("/usuarios")
          ? "Volver a Gestión de Usuarios"
          : "Volver a Configuración"
      );
    } else if (typeof document !== "undefined" && document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        if (
          refUrl.origin === window.location.origin &&
          refUrl.pathname.startsWith("/")
        ) {
          setRutaRetorno(refUrl.pathname);
          setTituloRetorno(
            refUrl.pathname.startsWith("/usuarios")
              ? "Volver a Gestión de Usuarios"
              : "Volver a Configuración"
          );
        }
      } catch {
        // Mantener ruta por defecto
      }
    }
  }, [searchParams]);

  const calcularModulosDesdeIds = useCallback(
    (idsTx: number[], txsBase?: TransaccionSistema[]) => {
      const listaTx = txsBase ?? transaccionesRef.current;
      if (!idsTx || idsTx.length === 0) return [];
      return Array.from(
        new Set(
          listaTx
            .filter((tx) => idsTx.includes(Number(tx.id)))
            .map((tx) => normalizarModuloKey(tx.modulo))
            .filter(Boolean)
        )
      );
    },
    []
  );

  const cargarSucursalesDeEmpresa = useCallback(
    async (empId: string, sucursalPreferida?: string): Promise<Sucursal[]> => {
      if (!empId) {
        setSucursalesLista([]);
        setSucursalIdSeleccionada("");
        return [];
      }

      const { data } = await supabase
        .from("sucursales")
        .select("id, empresa_id, nombre")
        .eq("empresa_id", Number(empId));

      const lista = (data || []) as Sucursal[];
      setSucursalesLista(lista);

      if (
        sucursalPreferida &&
        lista.some((s) => String(s.id) === String(sucursalPreferida))
      ) {
        setSucursalIdSeleccionada(String(sucursalPreferida));
      } else {
        setSucursalIdSeleccionada("");
      }

      return lista;
    },
    []
  );

  const cargarPermisosContextoActual = useCallback(
    async (
      usrId: string,
      empId: string,
      sucId: string,
      txsBase?: TransaccionSistema[]
    ) => {
      if (!usrId || !empId) {
        setPermisosActuales([]);
        setModulosSeleccionados([]);
        return;
      }

      const listaTx = txsBase ?? transaccionesRef.current;

      if (sucId) {
        const { data } = await supabase
          .from("usuario_permisos_tx")
          .select("transaccion_id")
          .eq("usuario_id", usrId)
          .eq("empresa_id", Number(empId))
          .eq("sucursal_id", Number(sucId));

        let idsPermitidos = Array.from(
          new Set(
            (data || [])
              .map((p: { transaccion_id?: number | string | null }) =>
                p.transaccion_id != null ? Number(p.transaccion_id) : NaN
              )
              .filter((id) => !Number.isNaN(id))
          )
        );

        if (idsPermitidos.length === 0) {
          const { data: dataGeneral } = await supabase
            .from("usuario_permisos_tx")
            .select("transaccion_id")
            .eq("usuario_id", usrId)
            .eq("empresa_id", Number(empId))
            .is("sucursal_id", null);

          idsPermitidos = Array.from(
            new Set(
              (dataGeneral || [])
                .map((p: { transaccion_id?: number | string | null }) =>
                  p.transaccion_id != null ? Number(p.transaccion_id) : NaN
                )
                .filter((id) => !Number.isNaN(id))
            )
          );
        }

        setPermisosActuales(idsPermitidos);
        setModulosSeleccionados(calcularModulosDesdeIds(idsPermitidos, listaTx));
        return;
      }

      const { data: dataGeneral } = await supabase
        .from("usuario_permisos_tx")
        .select("transaccion_id")
        .eq("usuario_id", usrId)
        .eq("empresa_id", Number(empId))
        .is("sucursal_id", null);

      let idsPermitidos = Array.from(
        new Set(
          (dataGeneral || [])
            .map((p: { transaccion_id?: number | string | null }) =>
              p.transaccion_id != null ? Number(p.transaccion_id) : NaN
            )
            .filter((id) => !Number.isNaN(id))
        )
      );

      if (idsPermitidos.length === 0) {
        const { data: dataEmpresa } = await supabase
          .from("usuario_permisos_tx")
          .select("transaccion_id")
          .eq("usuario_id", usrId)
          .eq("empresa_id", Number(empId));

        idsPermitidos = Array.from(
          new Set(
            (dataEmpresa || [])
              .map((p: { transaccion_id?: number | string | null }) =>
                p.transaccion_id != null ? Number(p.transaccion_id) : NaN
              )
              .filter((id) => !Number.isNaN(id))
          )
        );
      }

      setPermisosActuales(idsPermitidos);
      setModulosSeleccionados(calcularModulosDesdeIds(idsPermitidos, listaTx));
    },
    [calcularModulosDesdeIds]
  );

  const aplicarContextoYPermisosUsuario = useCallback(
    async (
      usrId: string,
      empresaActualReferencia?: string,
      listaEmpresasBase?: Empresa[],
      listaTxBase?: TransaccionSistema[]
    ) => {
      const empresasDisponibles = listaEmpresasBase ?? empresasRef.current;
      const txsDisponibles = listaTxBase ?? transaccionesRef.current;

      if (!usrId) {
        setPermisosActuales([]);
        setModulosSeleccionados([]);
        return;
      }

      const idsPermitidosSet = new Set(
        empresasDisponibles.map((e) => String(e.id))
      );

      const { data: asignacionesUsr } = await supabase
        .from("usuario_permisos_tx")
        .select("empresa_id, sucursal_id, transaccion_id")
        .eq("usuario_id", usrId);

      const filasUsuario = ((asignacionesUsr || []) as PermisoTxRow[]).filter(
        (row) => idsPermitidosSet.has(String(row.empresa_id))
      );

      let empresaObjetivo = empresaActualReferencia || "";
      let sucursalObjetivo = "";

      if (filasUsuario.length > 0) {
        const empresasAsignadasUsr = Array.from(
          new Set(filasUsuario.map((f) => String(f.empresa_id)))
        );
        if (!empresasAsignadasUsr.includes(String(empresaObjetivo))) {
          empresaObjetivo = empresasAsignadasUsr[0];
        }

        const filasDeEmpresa = filasUsuario.filter(
          (f) => String(f.empresa_id) === String(empresaObjetivo)
        );
        const sucursalesAsignadas = Array.from(
          new Set(
            filasDeEmpresa
              .map((f) =>
                f.sucursal_id != null ? String(f.sucursal_id).trim() : ""
              )
              .filter(Boolean)
          )
        );

        if (sucursalesAsignadas.length > 0) {
          sucursalObjetivo = sucursalesAsignadas[0];
        }
      } else if (!empresaObjetivo && empresasDisponibles.length > 0) {
        empresaObjetivo = String(empresasDisponibles[0].id);
      }

      if (empresaObjetivo) {
        setEmpresaIdSeleccionada(String(empresaObjetivo));
      }

      // Cargar sucursales en paralelo con el cálculo de permisos
      const listaSuc = await cargarSucursalesDeEmpresa(
        String(empresaObjetivo || ""),
        sucursalObjetivo
      );
      const sucFinal =
        sucursalObjetivo &&
        listaSuc.some((s) => String(s.id) === String(sucursalObjetivo))
          ? String(sucursalObjetivo)
          : "";

      await cargarPermisosContextoActual(
        usrId,
        String(empresaObjetivo || ""),
        sucFinal,
        txsDisponibles
      );
    },
    [cargarSucursalesDeEmpresa, cargarPermisosContextoActual]
  );

  useEffect(() => {
    if (inicializadoRef.current) return;
    inicializadoRef.current = true;

    async function cargarDatosIniciales() {
      try {
        setCargandoTx(true);

        const usuarioParam = searchParams.get("usuarioId");
        const usuarioStorage =
          typeof window !== "undefined"
            ? sessionStorage.getItem("nuevo_usuario_permisos_id")
            : null;
        const usuarioObjetivo = (usuarioParam || usuarioStorage || "").trim();

        const [
          {
            data: { session },
          },
          txRes,
          usrRes,
        ] = await Promise.all([
          supabase.auth.getSession(),
          supabase
            .from("transacciones_sistema")
            .select("id, modulo, layout, es_modulo_padre")
            .order("modulo", { ascending: true }),
          supabase
            .from("usuarios_perfiles")
            .select("id, nombres, apellidos, cedula, email")
            .eq("activo", true)
            .order("nombres", { ascending: true }),
        ]);

        const user = session?.user;
        if (!user) {
          setEmpresas([]);
          setEmpresaIdSeleccionada("");
          setUsuarios([]);
          setUsuarioIdSeleccionado("");
          return;
        }

        const listaTx: TransaccionSistema[] =
          !txRes.error && txRes.data ? (txRes.data as TransaccionSistema[]) : [];
        transaccionesRef.current = listaTx;
        setTransacciones(listaTx);

        const { data: permisosAdmin } = await supabase
          .from("usuario_permisos_tx")
          .select("empresa_id")
          .eq("usuario_id", user.id);

        const idsEmpresasAdmin = Array.from(
          new Set(
            (permisosAdmin || [])
              .map((p: { empresa_id?: string | number | null }) =>
                p.empresa_id != null ? String(p.empresa_id).trim() : ""
              )
              .filter(Boolean)
          )
        );

        if (idsEmpresasAdmin.length === 0) {
          setEmpresas([]);
          setEmpresaIdSeleccionada("");
          setUsuarios([]);
          setUsuarioIdSeleccionado("");
          return;
        }

        const empresasNums = idsEmpresasAdmin
          .map((id) => Number(id))
          .filter((n) => !Number.isNaN(n));

        const todosUsuariosActivos =
          !usrRes.error && usrRes.data ? (usrRes.data as UsuarioPerfil[]) : [];
        const idsUsuariosActivos = todosUsuariosActivos.map((u) => u.id);

        // Ejecutar consulta de empresas y permisos en el alcance en paralelo
        const [empRes, permisosAlcanceRes, permisosActivosRes] =
          await Promise.all([
            supabase
              .from("empresas")
              .select("id, razon_social, nombre_comercial")
              .in("id", empresasNums)
              .order("razon_social", { ascending: true }),
            supabase
              .from("usuario_permisos_tx")
              .select("usuario_id")
              .in("empresa_id", empresasNums),
            idsUsuariosActivos.length > 0
              ? supabase
                  .from("usuario_permisos_tx")
                  .select("usuario_id")
                  .in("usuario_id", idsUsuariosActivos)
              : Promise.resolve({ data: [] }),
          ]);

        const listaEmp: Empresa[] = (empRes.data || []) as Empresa[];
        empresasRef.current = listaEmp;
        setEmpresas(listaEmp);

        let empresaInicial = "";
        if (listaEmp.length > 0) {
          const cookieEmpresa = getCookieValue("empresa_activa");
          const empresaGuardadaLocal =
            typeof window !== "undefined"
              ? localStorage.getItem("empresa_activa") ||
                localStorage.getItem("empresa_id")
              : null;

          const empresaIdParaSeleccionar =
            empresaGuardadaLocal || cookieEmpresa;
          const existeEmpresa = listaEmp.some(
            (emp: Empresa) => String(emp.id) === String(empresaIdParaSeleccionar)
          );

          empresaInicial =
            existeEmpresa && empresaIdParaSeleccionar
              ? String(empresaIdParaSeleccionar)
              : String(listaEmp[0].id);

          setEmpresaIdSeleccionada(empresaInicial);
        }

        const usuariosConAlgunaAsignacion = new Set(
          ((permisosActivosRes.data || []) as { usuario_id?: string | null }[])
            .map((p) => (p.usuario_id ? String(p.usuario_id).trim() : ""))
            .filter(Boolean)
        );

        const usuariosEnEmpresasAdmin = new Set(
          ((permisosAlcanceRes.data || []) as { usuario_id?: string | null }[])
            .map((p) => (p.usuario_id ? String(p.usuario_id).trim() : ""))
            .filter(Boolean)
        );

        const filtradosAlcance = todosUsuariosActivos.filter((u) => {
          const uid = String(u.id);
          const sinAsignaciones = !usuariosConAlgunaAsignacion.has(uid);
          const enEmpresasAdmin = usuariosEnEmpresasAdmin.has(uid);
          const esUsuarioObjetivo = Boolean(
            usuarioObjetivo && uid === usuarioObjetivo
          );
          return sinAsignaciones || enEmpresasAdmin || esUsuarioObjetivo;
        });

        setUsuarios(filtradosAlcance);

        let usuarioElegido = "";
        if (
          usuarioObjetivo &&
          filtradosAlcance.some((u) => String(u.id) === usuarioObjetivo)
        ) {
          usuarioElegido = usuarioObjetivo;
          setUsuarioFijadoId(usuarioObjetivo);
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("nuevo_usuario_permisos_id");
          }
        } else if (filtradosAlcance.length > 0) {
          usuarioElegido = filtradosAlcance[0].id;
        }

        setUsuarioIdSeleccionado(usuarioElegido);

        if (usuarioElegido) {
          await aplicarContextoYPermisosUsuario(
            usuarioElegido,
            empresaInicial,
            listaEmp,
            listaTx
          );
        } else if (empresaInicial) {
          await cargarSucursalesDeEmpresa(empresaInicial);
        }
      } catch (err) {
        console.error("Error en carga inicial:", err);
      } finally {
        setCargandoTx(false);
      }
    }

    cargarDatosIniciales();
  }, [searchParams, aplicarContextoYPermisosUsuario, cargarSucursalesDeEmpresa]);

  useEffect(() => {
    if (empresaIdSeleccionada && typeof window !== "undefined") {
      localStorage.setItem("empresa_activa", String(empresaIdSeleccionada));
      localStorage.setItem("empresa_id", String(empresaIdSeleccionada));
      document.cookie = `empresa_activa=${empresaIdSeleccionada}; path=/; max-age=86400; SameSite=Lax`;
    }
  }, [empresaIdSeleccionada]);

  const handleSeleccionarUsuario = async (nuevoUsuarioId: string) => {
    setUsuarioIdSeleccionado(nuevoUsuarioId);
    setModulosSeleccionados([]);
    setPermisosActuales([]);
    await aplicarContextoYPermisosUsuario(nuevoUsuarioId, empresaIdSeleccionada);
  };

  const handleCambioEmpresaManual = async (nuevaEmpId: string) => {
    setEmpresaIdSeleccionada(nuevaEmpId);
    setSucursalIdSeleccionada("");
    await cargarSucursalesDeEmpresa(nuevaEmpId);
    if (usuarioIdSeleccionado && nuevaEmpId) {
      await cargarPermisosContextoActual(usuarioIdSeleccionado, nuevaEmpId, "");
    }
  };

  const handleCambioSucursalManual = async (nuevaSucId: string) => {
    setSucursalIdSeleccionada(nuevaSucId);
    if (usuarioIdSeleccionado && empresaIdSeleccionada) {
      await cargarPermisosContextoActual(
        usuarioIdSeleccionado,
        empresaIdSeleccionada,
        nuevaSucId
      );
    }
  };

  const handleTogglePermiso = (tx: TransaccionSistema) => {
    const txId = Number(tx.id);
    const estaMarcado = permisosActuales.includes(txId);
    const modKey = normalizarModuloKey(tx.modulo);

    if (tx.es_modulo_padre) {
      const txsDelModulo = transacciones.filter(
        (t) => normalizarModuloKey(t.modulo) === modKey
      );
      const idsDelModulo = txsDelModulo.map((t) => Number(t.id));

      if (!estaMarcado) {
        setPermisosActuales((prev) =>
          Array.from(new Set([...prev, ...idsDelModulo]))
        );
      } else {
        setPermisosActuales((prev) =>
          prev.filter((id) => !idsDelModulo.includes(id))
        );
      }
    } else {
      setPermisosActuales((prev) =>
        prev.includes(txId)
          ? prev.filter((id) => id !== txId)
          : [...prev, txId]
      );
    }
  };

  const toggleModuloFiltro = (moduloNombre: string) => {
    const modKey = normalizarModuloKey(moduloNombre);
    setModulosSeleccionados((prev) =>
      prev.includes(modKey)
        ? prev.filter((m) => m !== modKey)
        : [...prev, modKey]
    );
  };

  const guardarPermisos = async () => {
    if (!usuarioIdSeleccionado || !empresaIdSeleccionada) {
      alert("Selecciona un usuario y una empresa obligatoriamente.");
      return;
    }

    const empresaPermitida = empresas.some(
      (e) => String(e.id) === String(empresaIdSeleccionada)
    );
    if (!empresaPermitida) {
      alert(
        "No tienes autorización para asignar permisos en la empresa seleccionada."
      );
      return;
    }

    setGuardando(true);
    try {
      if (sucursalIdSeleccionada) {
        const { error: deleteGenError } = await supabase
          .from("usuario_permisos_tx")
          .delete()
          .eq("usuario_id", usuarioIdSeleccionado)
          .eq("empresa_id", Number(empresaIdSeleccionada))
          .is("sucursal_id", null);

        if (deleteGenError) throw deleteGenError;

        const { error: deleteSucError } = await supabase
          .from("usuario_permisos_tx")
          .delete()
          .eq("usuario_id", usuarioIdSeleccionado)
          .eq("empresa_id", Number(empresaIdSeleccionada))
          .eq("sucursal_id", Number(sucursalIdSeleccionada));

        if (deleteSucError) throw deleteSucError;
      } else {
        const { error: deleteError } = await supabase
          .from("usuario_permisos_tx")
          .delete()
          .eq("usuario_id", usuarioIdSeleccionado)
          .eq("empresa_id", Number(empresaIdSeleccionada));

        if (deleteError) throw deleteError;
      }

      if (permisosActuales.length > 0) {
        const registrosNuevos = permisosActuales.map((txId) => ({
          usuario_id: usuarioIdSeleccionado,
          empresa_id: Number(empresaIdSeleccionada),
          sucursal_id: sucursalIdSeleccionada
            ? Number(sucursalIdSeleccionada)
            : null,
          transaccion_id: txId,
        }));

        const { error: insertError } = await supabase
          .from("usuario_permisos_tx")
          .insert(registrosNuevos);
        if (insertError) throw insertError;
      } else {
        const { error: insertBaseError } = await supabase
          .from("usuario_permisos_tx")
          .insert([
            {
              usuario_id: usuarioIdSeleccionado,
              empresa_id: Number(empresaIdSeleccionada),
              sucursal_id: sucursalIdSeleccionada
                ? Number(sucursalIdSeleccionada)
                : null,
              transaccion_id: null,
            },
          ]);
        if (insertBaseError) throw insertBaseError;
      }

      await cargarPermisosContextoActual(
        usuarioIdSeleccionado,
        empresaIdSeleccionada,
        sucursalIdSeleccionada
      );
      alert("¡Permisos y alcances de sucursal actualizados exitosamente!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Error al guardar permisos: " + msg);
    } finally {
      setGuardando(false);
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    if (usuarioFijadoId && String(u.id) !== String(usuarioFijadoId)) {
      return false;
    }
    const texto = busquedaUsuario.toLowerCase();
    return (
      u.nombres?.toLowerCase().includes(texto) ||
      u.apellidos?.toLowerCase().includes(texto) ||
      u.cedula?.toLowerCase().includes(texto) ||
      u.email?.toLowerCase().includes(texto)
    );
  });

  const listaModulosDisponibles = Array.from(
    new Set(transacciones.map((t) => normalizarModuloKey(t.modulo)))
  ).sort();

  const transaccionesPorModulo = transacciones.reduce<
    Record<string, TransaccionSistema[]>
  >((acc, tx) => {
    const moduloKey = normalizarModuloKey(tx.modulo);
    if (!acc[moduloKey]) acc[moduloKey] = [];
    acc[moduloKey].push(tx);
    return acc;
  }, {});

  return (
    <div className="p-3 md:p-4 max-w-7xl mx-auto space-y-3 text-xs bg-slate-50/50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href={rutaRetorno}
            title={tituloRetorno}
            className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">
              Control de Acceso por Transacciones (TX)
            </h1>
            <p className="text-slate-500 text-[11px] truncate">
              Asigna permisos granulares filtrando por usuario y módulos
              corporativos.
            </p>
          </div>
        </div>

        <button
          onClick={guardarPermisos}
          disabled={
            guardando || !usuarioIdSeleccionado || !empresaIdSeleccionada
          }
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-sm shadow-indigo-200 transition cursor-pointer disabled:opacity-50 shrink-0"
        >
          {guardando ? "Guardando..." : "💾 Guardar Permisos"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900 text-xs">
                1. Seleccionar Usuario
              </h2>
              <p className="text-slate-400 text-[10px]">
                {usuarioFijadoId
                  ? "Mostrando únicamente el usuario seleccionado."
                  : "Busca por nombre, cédula o correo electrónico."}
              </p>
            </div>
            {usuarioFijadoId && (
              <button
                type="button"
                onClick={() => {
                  setUsuarioFijadoId("");
                  setBusquedaUsuario("");
                }}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer shrink-0"
              >
                Ver todos
              </button>
            )}
          </div>

          <input
            type="text"
            placeholder="🔍 Filtrar usuarios..."
            value={busquedaUsuario}
            onChange={(e) => setBusquedaUsuario(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none bg-slate-50/50 font-medium focus:ring-2 focus:ring-indigo-500/20"
          />

          <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
            {cargandoTx ? (
              <div className="p-2.5 text-center text-slate-400">
                Cargando usuarios...
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="p-2.5 text-center text-slate-400">
                No se encontraron usuarios en el alcance de sus empresas.
              </div>
            ) : (
              usuariosFiltrados.map((usr) => {
                const seleccionado =
                  String(usuarioIdSeleccionado) === String(usr.id);
                return (
                  <div
                    key={usr.id}
                    onClick={() => handleSeleccionarUsuario(usr.id)}
                    className={`px-2.5 py-1.5 rounded-xl border transition cursor-pointer flex flex-col ${
                      seleccionado
                        ? "bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold shadow-2xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs font-bold truncate">
                        {usr.nombres} {usr.apellidos}
                      </span>
                      <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0">
                        C.C. {usr.cedula}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate">
                      {usr.email}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div>
              <h2 className="font-bold text-slate-900 text-xs">
                2. Empresa Activa y Sucursal
              </h2>
              <p className="text-slate-400 text-[10px]">
                Define el ámbito corporativo de los permisos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Empresa Activa *
                </label>
                <select
                  value={empresaIdSeleccionada}
                  onChange={(e) => handleCambioEmpresaManual(e.target.value)}
                  disabled={cargandoTx || empresas.length === 0}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none bg-slate-50/50 font-bold text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {empresas.length === 0 ? (
                    <option value="">Sin empresas asignadas</option>
                  ) : (
                    empresas.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.razon_social || emp.nombre}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Sucursal (Opcional)
                </label>
                <select
                  value={sucursalIdSeleccionada}
                  onChange={(e) => handleCambioSucursalManual(e.target.value)}
                  disabled={cargandoTx || sucursalesLista.length === 0}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none bg-slate-50/50 font-bold text-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  <option value="">-- Todas (General) --</option>
                  {sucursalesLista.map((suc) => (
                    <option key={suc.id} value={String(suc.id)}>
                      {suc.nombre || suc.nombre_sucursal}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                3. Filtrar por Módulos Mayores
              </label>
              <div className="flex flex-wrap gap-1">
                {listaModulosDisponibles.map((mod) => {
                  const activo = modulosSeleccionados.includes(mod);
                  return (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => toggleModuloFiltro(mod)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                        activo
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {activo ? "✓ " : "+ "} {mod}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm">
        <h3 className="font-bold text-slate-900 text-xs mb-2.5 border-b border-slate-100 pb-1.5">
          Matriz de Transacciones (TX) para los Módulos Seleccionados
        </h3>

        {cargandoTx ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            Cargando transacciones...
          </div>
        ) : modulosSeleccionados.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            No hay módulos activos para el usuario seleccionado o no has
            encendido ninguno en el filtro superior.
          </div>
        ) : (
          <div className="space-y-2.5">
            {modulosSeleccionados.map((moduloNombre) => {
              const txsDelModulo = transaccionesPorModulo[moduloNombre] || [];
              if (txsDelModulo.length === 0) return null;

              const modulosPadre = txsDelModulo.filter(
                (t: TransaccionSistema) => Boolean(t.es_modulo_padre)
              );
              const txsHijas = txsDelModulo.filter(
                (t: TransaccionSistema) => !Boolean(t.es_modulo_padre)
              );

              return (
                <div
                  key={moduloNombre}
                  className="border border-slate-200/60 rounded-xl p-2.5 bg-slate-50/40 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1">
                        📂 Módulo:{" "}
                        <span className="text-indigo-600 font-extrabold">
                          {moduloNombre}
                        </span>
                      </h4>

                      {modulosPadre.map((padre: TransaccionSistema) => {
                        const isPadreChecked = permisosActuales.includes(
                          Number(padre.id)
                        );
                        return (
                          <label
                            key={padre.id}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100/70 transition cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isPadreChecked}
                              onChange={() => handleTogglePermiso(padre)}
                              className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-extrabold text-amber-950">
                              {padre.layout} (Módulo Padre)
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {txsHijas.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                      {txsHijas.map((tx: TransaccionSistema) => {
                        const isChecked = permisosActuales.includes(
                          Number(tx.id)
                        );

                        return (
                          <label
                            key={tx.id}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-white border-slate-200 hover:bg-slate-50 transition cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermiso(tx)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                            />
                            <span className="text-[11px] text-slate-800 font-semibold truncate">
                              {tx.layout}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PermisosUsuariosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-center text-xs text-zinc-400">
          Cargando permisos...
        </div>
      }
    >
      <PermisosUsuariosContent />
    </Suspense>
  );
}