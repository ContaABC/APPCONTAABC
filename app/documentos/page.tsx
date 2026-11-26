"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
  setEmpresaActivaUsuario,
  setSucursalActivaUsuario,
  type Empresa as EmpresaPermitida,
  type Sucursal as SucursalPermitida,
} from "@/app/actions/accionesEmpresas";
import {
  obtenerClasesDocumentosPorTipo,
  obtenerAuxiliaresParaDocumentos,
  obtenerTerceros,
  obtenerTitulosValoresPorCuenta,
  guardarDocumentoContable,
} from "./actions";
import { validarPeriodoContable } from "@/lib/accounting-validations";

type EmpresaItem = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
};

type SucursalItem = SucursalPermitida & {
  nombre_sucursal?: string;
  codigo_sucursal?: string;
};

interface ClaseDocumentoItem {
  id: number | string;
  codigo_clase?: string;
  nombre_clase?: string;
  afecta_caja_bancos?: boolean;
}

interface AuxiliarItem {
  id: number | string;
  codigo: string;
  nombre: string;
  tipo_entidad?: string;
}

interface TerceroItem {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  numero_identificacion?: string | number;
}

interface TituloValorItem {
  id: number | string;
  numero_titulo?: string;
  monto?: number | string;
  tipo_titulo?: string;
  estado?: string;
  tercero_girador_id?: number | string | null;
}

interface DetalleFila {
  concepto_auxiliar_id: string;
  busquedaAuxiliar: string;
  filtrarAuxPorTexto: boolean;
  showAuxDropdown: boolean;
  tercero_id: string;
  busquedaTercero: string;
  filtrarTerceroPorTexto: boolean;
  showTerceroDropdown: boolean;
  cuenta_financiera_id: string;
  titulo_valor_id: string;
  titulosDisponibles: TituloValorItem[];
  debito: string;
  credito: string;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function obtenerNombreEmpresa(emp: EmpresaItem): string {
  return String(
    emp.razon_social || emp.nombre_comercial || emp.nombre || "Empresa"
  );
}

function obtenerNombreSucursal(suc: SucursalItem): string {
  return String(suc.nombre || suc.nombre_sucursal || `Sucursal ${suc.id}`);
}

function obtenerEtiquetaTercero(ter: TerceroItem): string {
  const nombre = ter.razon_social || ter.nombre_comercial || "Sin Nombre";
  return ter.numero_identificacion
    ? `[${ter.numero_identificacion}] ${nombre}`
    : nombre;
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

function crearFilaVacia(): DetalleFila {
  return {
    concepto_auxiliar_id: "",
    busquedaAuxiliar: "",
    filtrarAuxPorTexto: false,
    showAuxDropdown: false,
    tercero_id: "",
    busquedaTercero: "",
    filtrarTerceroPorTexto: false,
    showTerceroDropdown: false,
    cuenta_financiera_id: "",
    titulo_valor_id: "",
    titulosDisponibles: [],
    debito: "",
    credito: "",
  };
}

export default function DocumentosContablesPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [sucursales, setSucursales] = useState<SucursalItem[]>([]);
  const [clasesDocs, setClasesDocs] = useState<ClaseDocumentoItem[]>([]);
  const [auxiliares, setAuxiliares] = useState<AuxiliarItem[]>([]);
  const [terceros, setTerceros] = useState<TerceroItem[]>([]);

  // Tipo de Operación: false = Contable, true = Bancario
  const [esBancario, setEsBancario] = useState<boolean>(false);

  // Encabezado
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [claseDocumentoId, setClaseDocumentoId] = useState<string>("");
  const [fechaEmision, setFechaEmision] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [fechaContable, setFechaContable] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [glosaConcepto, setGlosaConcepto] = useState<string>("");

  // Estados para Control de Periodo Contable
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  // Detalle dinámico
  const [detalles, setDetalles] = useState<DetalleFila[]>([
    crearFilaVacia(),
    crearFilaVacia(),
  ]);

  const [loading, setLoading] = useState<boolean>(false);
  const auxDropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const terceroDropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>(
    {}
  );

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

  const persistirContextoEnPerfil = useCallback(
    async (empVal: string | null, sucVal: string | null) => {
      const uid = await resolverUsuarioId();
      if (!uid) return;

      const empNormalizado =
        empVal && empVal.trim() !== ""
          ? Number.isNaN(Number(empVal))
            ? empVal
            : Number(empVal)
          : null;

      const sucNormalizado =
        sucVal && sucVal.trim() !== ""
          ? Number.isNaN(Number(sucVal))
            ? sucVal
            : Number(sucVal)
          : null;

      try {
        if (empVal && empVal.trim() !== "") {
          await setEmpresaActivaUsuario(empVal, uid, sucVal || null);
        }
        if (sucVal !== undefined) {
          await setSucursalActivaUsuario(sucVal || null, uid);
        }
      } catch {
        // Continuar con actualización directa
      }

      const payload: {
        empresa_activa?: string | number | null;
        sucursal_activa?: string | number | null;
      } = {};
      if (empVal !== undefined) payload.empresa_activa = empNormalizado;
      if (sucVal !== undefined) payload.sucursal_activa = sucNormalizado;

      if (Object.keys(payload).length > 0) {
        await supabase
          .from("usuarios_perfiles")
          .update(payload)
          .eq("id", uid);
      }
    },
    [resolverUsuarioId]
  );

  // Función de validación de periodo en tiempo real
  const verificarPeriodo = useCallback(
    async (fecha: string) => {
      if (!empresaId || !sucursalId || !fecha) {
        setErrorPeriodo(null);
        return;
      }

      setValidandoPeriodo(true);
      setErrorPeriodo(null);

      try {
        const res = await validarPeriodoContable(
          empresaId,
          sucursalId,
          fecha
        );
        if (!res.valido) {
          setErrorPeriodo(
            res.mensaje || "Periodo no habilitado para transacciones."
          );
        }
      } finally {
        setValidandoPeriodo(false);
      }
    },
    [empresaId, sucursalId]
  );

  useEffect(() => {
    if (empresaId && sucursalId && fechaContable && isMounted) {
      verificarPeriodo(fechaContable);
    }
  }, [empresaId, sucursalId, fechaContable, isMounted, verificarPeriodo]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || inicializadoRef.current) return;
    inicializadoRef.current = true;
    let cancelado = false;

    async function initContexto() {
      try {
        const uid = await resolverUsuarioId();
        const permitidas = await getEmpresasPermitidas(uid);
        if (cancelado) return;

        const listaEmpresas: EmpresaItem[] = Array.isArray(permitidas)
          ? (permitidas as EmpresaItem[])
          : [];

        if (listaEmpresas.length > 0) {
          setEmpresas(listaEmpresas);

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

          let empresaIdAUsar = String(listaEmpresas[0].id);
          const candidataEmp = empBD || empCookie || empLocal;
          if (
            candidataEmp &&
            listaEmpresas.some((e) => String(e.id) === String(candidataEmp))
          ) {
            empresaIdAUsar = String(candidataEmp);
          }

          const empElegida =
            listaEmpresas.find((e) => String(e.id) === empresaIdAUsar) ||
            listaEmpresas[0];

          setEmpresaId(empresaIdAUsar);
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

          const sucPermitidas = await getSucursalesPermitidas(
            empresaIdAUsar,
            uid
          );
          if (cancelado) return;

          const listaSuc: SucursalItem[] = Array.isArray(sucPermitidas)
            ? (sucPermitidas as SucursalItem[])
            : [];
          setSucursales(listaSuc);

          if (listaSuc.length > 0) {
            let sucBD: string | null = null;
            try {
              const valSuc = await getSucursalActivaUsuario(uid);
              if (
                valSuc !== null &&
                valSuc !== undefined &&
                String(valSuc).trim() !== ""
              ) {
                sucBD = String(valSuc).trim();
              }
            } catch {
              // Ignorar
            }

            const sucCookie = getCookieValue("sucursal_activa");
            const sucLocal =
              typeof window !== "undefined"
                ? localStorage.getItem("sucursal_activa") ||
                  localStorage.getItem("sucursal_id")
                : null;
            const candidataSuc = sucBD || sucCookie || sucLocal;

            const sucElegida = candidataSuc
              ? listaSuc.find((s) => String(s.id) === String(candidataSuc)) ||
                listaSuc[0]
              : listaSuc[0];

            const idSucFinal = String(sucElegida.id);
            setSucursalId(idSucFinal);
            if (typeof window !== "undefined") {
              localStorage.setItem("sucursal_activa", idSucFinal);
              localStorage.setItem("sucursal_id", idSucFinal);
              localStorage.setItem(
                "sucursal_activa_nombre",
                obtenerNombreSucursal(sucElegida)
              );
            }
            document.cookie = `sucursal_activa=${encodeURIComponent(
              idSucFinal
            )}; path=/; max-age=86400; SameSite=Lax`;
          }
        }
      } catch (err) {
        console.error("Error inicializando contexto de documentos:", err);
      }
    }

    initContexto();
    return () => {
      cancelado = true;
    };
  }, [isMounted, resolverUsuarioId]);

  useEffect(() => {
    if (!isMounted) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      setDetalles((prev) =>
        prev.map((fila, idx) => {
          const auxRef = auxDropdownRefs.current[idx];
          const terRef = terceroDropdownRefs.current[idx];
          const clickFueraAux = auxRef && !auxRef.contains(target);
          const clickFueraTer = terRef && !terRef.contains(target);

          return {
            ...fila,
            showAuxDropdown: clickFueraAux ? false : fila.showAuxDropdown,
            showTerceroDropdown: clickFueraTer
              ? false
              : fila.showTerceroDropdown,
          };
        })
      );
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMounted]);

  useEffect(() => {
    if (!empresaId || !isMounted) return;
    let cancelado = false;

    async function cargarDatosEmpresa() {
      const parsedEmpresaId = Number(empresaId);

      const uid = await resolverUsuarioId();
      const sucPermitidas = await getSucursalesPermitidas(empresaId, uid);
      if (!cancelado) {
        const listaSuc: SucursalItem[] = Array.isArray(sucPermitidas)
          ? (sucPermitidas as SucursalItem[])
          : [];
        setSucursales(listaSuc);
        if (
          listaSuc.length > 0 &&
          !listaSuc.some((s) => String(s.id) === String(sucursalId))
        ) {
          setSucursalId(String(listaSuc[0].id));
        } else if (listaSuc.length === 0) {
          setSucursalId("");
        }
      }

      const claseRes = await obtenerClasesDocumentosPorTipo(
        parsedEmpresaId,
        esBancario
      );
      if (!cancelado) {
        if (claseRes.success && claseRes.data) {
          const clases = claseRes.data as ClaseDocumentoItem[];
          setClasesDocs(clases);
          setClaseDocumentoId(clases.length > 0 ? String(clases[0].id) : "");
        } else {
          setClasesDocs([]);
          setClaseDocumentoId("");
        }
      }

      const auxRes = await obtenerAuxiliaresParaDocumentos(
        parsedEmpresaId,
        esBancario
      );
      if (!cancelado && auxRes.success) {
        setAuxiliares((auxRes.data || []) as AuxiliarItem[]);
      }

      const terRes = await obtenerTerceros(parsedEmpresaId);
      if (!cancelado && terRes.success) {
        setTerceros((terRes.data || []) as TerceroItem[]);
      }
    }

    cargarDatosEmpresa();
    return () => {
      cancelado = true;
    };
  }, [empresaId, esBancario, isMounted, resolverUsuarioId, sucursalId]);

  const handleCambioEmpresa = async (nuevoId: string) => {
    setEmpresaId(nuevoId);
    setSucursalId("");
    setSucursales([]);

    if (typeof window !== "undefined") {
      if (nuevoId) {
        const empSel = empresas.find((e) => String(e.id) === nuevoId);
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
      } else {
        localStorage.removeItem("empresa_activa");
        localStorage.removeItem("empresa_id");
        localStorage.removeItem("empresa_activa_nombre");
        document.cookie = "empresa_activa=; path=/; max-age=0; SameSite=Lax";
      }
      localStorage.removeItem("sucursal_activa");
      localStorage.removeItem("sucursal_id");
      localStorage.removeItem("sucursal_activa_nombre");
      document.cookie = "sucursal_activa=; path=/; max-age=0; SameSite=Lax";
    }

    await persistirContextoEnPerfil(nuevoId || null, null);
  };

  const handleCambioSucursal = async (nuevoSucId: string) => {
    setSucursalId(nuevoSucId);

    if (typeof window !== "undefined") {
      if (nuevoSucId) {
        const sucSel = sucursales.find((s) => String(s.id) === nuevoSucId);
        localStorage.setItem("sucursal_activa", nuevoSucId);
        localStorage.setItem("sucursal_id", nuevoSucId);
        if (sucSel) {
          localStorage.setItem(
            "sucursal_activa_nombre",
            obtenerNombreSucursal(sucSel)
          );
        }
        document.cookie = `sucursal_activa=${encodeURIComponent(
          nuevoSucId
        )}; path=/; max-age=86400; SameSite=Lax`;
      } else {
        localStorage.removeItem("sucursal_activa");
        localStorage.removeItem("sucursal_id");
        localStorage.removeItem("sucursal_activa_nombre");
        document.cookie = "sucursal_activa=; path=/; max-age=0; SameSite=Lax";
      }
    }

    await persistirContextoEnPerfil(empresaId || null, nuevoSucId || null);
  };

  const agregarFila = () => {
    setDetalles((prev) => [...prev, crearFilaVacia()]);
  };

  const eliminarFila = (index: number) => {
    if (detalles.length === 1) return;
    setDetalles((prev) => prev.filter((_, i) => i !== index));
  };

  const actualizarFila = (
    index: number,
    campo: keyof DetalleFila,
    valor: string
  ) => {
    setDetalles((prev) => {
      const nuevosDetalles = [...prev];
      nuevosDetalles[index] = { ...nuevosDetalles[index], [campo]: valor };

      if (campo === "debito" && Number(valor) > 0) {
        nuevosDetalles[index].credito = "";
      } else if (campo === "credito" && Number(valor) > 0) {
        nuevosDetalles[index].debito = "";
      }

      return nuevosDetalles;
    });
  };

  const seleccionarAuxiliar = async (index: number, aux: AuxiliarItem) => {
    let titulos: TituloValorItem[] = [];
    const esBanco = aux.tipo_entidad === "Cuentas_Bancarias";

    if (esBanco) {
      const resTv = await obtenerTitulosValoresPorCuenta(empresaId, aux.id);
      if (resTv.success) {
        titulos = (resTv.data || []) as TituloValorItem[];
      }
    }

    setDetalles((prev) => {
      const nuevosDetalles = [...prev];
      nuevosDetalles[index] = {
        ...nuevosDetalles[index],
        concepto_auxiliar_id: String(aux.id),
        busquedaAuxiliar: `[${aux.codigo}] ${aux.nombre}`,
        filtrarAuxPorTexto: false,
        showAuxDropdown: false,
        cuenta_financiera_id: esBanco ? String(aux.id) : "",
        titulo_valor_id: "",
        titulosDisponibles: esBanco ? titulos : [],
      };
      return nuevosDetalles;
    });
  };

  const seleccionarTercero = (index: number, ter: TerceroItem) => {
    setDetalles((prev) => {
      const nuevosDetalles = [...prev];
      nuevosDetalles[index] = {
        ...nuevosDetalles[index],
        tercero_id: String(ter.id),
        busquedaTercero: obtenerEtiquetaTercero(ter),
        filtrarTerceroPorTexto: false,
        showTerceroDropdown: false,
      };
      return nuevosDetalles;
    });
  };

  const seleccionarTituloValor = (index: number, tvId: string) => {
    setDetalles((prev) => {
      const nuevosDetalles = [...prev];
      const fila = { ...nuevosDetalles[index], titulo_valor_id: tvId };

      if (!tvId) {
        fila.tercero_id = "";
        fila.busquedaTercero = "";
        fila.filtrarTerceroPorTexto = false;
        fila.debito = "";
        fila.credito = "";
        nuevosDetalles[index] = fila;
        return nuevosDetalles;
      }

      const tvSeleccionado = fila.titulosDisponibles.find(
        (t) => String(t.id) === tvId
      );

      if (tvSeleccionado) {
        if (tvSeleccionado.tercero_girador_id) {
          const terMatch = terceros.find(
            (t) => String(t.id) === String(tvSeleccionado.tercero_girador_id)
          );
          fila.tercero_id = String(tvSeleccionado.tercero_girador_id);
          fila.busquedaTercero = terMatch
            ? obtenerEtiquetaTercero(terMatch)
            : String(tvSeleccionado.tercero_girador_id);
          fila.filtrarTerceroPorTexto = false;
        }
        fila.debito = "";
        fila.credito = String(tvSeleccionado.monto || 0);
      }

      nuevosDetalles[index] = fila;
      return nuevosDetalles;
    });
  };

  const handleFocusDebito = (index: number) => {
    const fila = detalles[index];
    if (!fila || fila.titulo_valor_id) return;

    if (
      (!fila.credito || Number(fila.credito) === 0) &&
      (!fila.debito || Number(fila.debito) === 0)
    ) {
      const currentDebitos = detalles.reduce(
        (acc, d, i) => (i === index ? acc : acc + Number(d.debito || 0)),
        0
      );
      const currentCreditos = detalles.reduce(
        (acc, d, i) => (i === index ? acc : acc + Number(d.credito || 0)),
        0
      );
      const faltante = currentCreditos - currentDebitos;

      if (faltante > 0) {
        setDetalles((prev) => {
          const nuevosDetalles = [...prev];
          nuevosDetalles[index] = {
            ...nuevosDetalles[index],
            debito: String(faltante),
          };
          return nuevosDetalles;
        });
      }
    }
  };

  const totalDebitos = detalles.reduce(
    (acc, d) => acc + Number(d.debito || 0),
    0
  );
  const totalCreditos = detalles.reduce(
    (acc, d) => acc + Number(d.credito || 0),
    0
  );
  const diferencia = totalDebitos - totalCreditos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (errorPeriodo) {
      alert(
        "No se puede guardar el comprobante porque el periodo contable no es válido."
      );
      return;
    }

    if (!empresaId || !sucursalId || !claseDocumentoId) {
      alert("Seleccione la empresa, sucursal y la clase de documento.");
      return;
    }

    const detallesValidos = detalles.filter(
      (d) =>
        Boolean(d.concepto_auxiliar_id) &&
        (Number(d.debito || 0) > 0 || Number(d.credito || 0) > 0)
    );

    if (detallesValidos.length === 0) {
      alert(
        "Debe registrar al menos un movimiento con cuenta auxiliar y valor débito o crédito."
      );
      return;
    }

    if (Math.abs(diferencia) > 0.01) {
      alert(
        `El comprobante está descuadrado. Diferencia: $ ${diferencia.toLocaleString(
          "es-CO"
        )}`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await guardarDocumentoContable({
        empresa_id: Number(empresaId),
        sucursal_id: Number(sucursalId),
        clase_documento_id: Number(claseDocumentoId),
        fecha_emision: fechaEmision,
        fecha_contable: fechaContable,
        glosa_concepto: glosaConcepto,
        es_bancario: esBancario,
        detalles: detallesValidos.map((d) => ({
          concepto_auxiliar_id: Number(d.concepto_auxiliar_id),
          tercero_id: d.tercero_id ? Number(d.tercero_id) : null,
          cuenta_financiera_id: d.cuenta_financiera_id
            ? Number(d.cuenta_financiera_id)
            : null,
          titulo_valor_id: d.titulo_valor_id ? Number(d.titulo_valor_id) : null,
          debito: Number(d.debito || 0),
          credito: Number(d.credito || 0),
        })),
      });

      if (res.success) {
        alert(res.message);
        setGlosaConcepto("");
        setDetalles([crearFilaVacia(), crearFilaVacia()]);
      } else {
        alert("Error al guardar: " + res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="p-4 text-center text-xs text-slate-400">
        Cargando módulo de documentos...
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 max-w-7xl mx-auto space-y-4 text-xs font-sans"
    >
      {/* SELECTOR PRINCIPAL */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition border border-slate-200 cursor-pointer shrink-0"
          >
            ← Atrás
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-800">
              Elaboración de Documentos
            </h1>
            <p className="text-[11px] text-slate-500">
              Seleccione el tipo de operación para alternar entre notas contables
              y movimientos bancarios.
            </p>
          </div>
        </div>
        <div className="flex bg-slate-200 p-1 rounded-lg border border-slate-300 gap-1">
          <button
            type="button"
            onClick={() => setEsBancario(false)}
            className={`px-4 py-2 font-bold rounded transition text-xs cursor-pointer ${
              !esBancario
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-700 hover:text-slate-900 bg-white"
            }`}
          >
            📄 Documento Contable
          </button>
          <button
            type="button"
            onClick={() => setEsBancario(true)}
            className={`px-4 py-2 font-bold rounded transition text-xs cursor-pointer ${
              esBancario
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-700 hover:text-slate-900 bg-white"
            }`}
          >
            🏦 Documento Bancario / Tesorería
          </button>
        </div>
      </div>

      <div className="border-b pb-2 flex justify-between items-center">
        <span className="font-bold text-slate-700 uppercase">
          Modo Activo:{" "}
          <span className="text-indigo-600">
            {esBancario
              ? "Documentos Bancarios (Afecta Caja/Bancos)"
              : "Documentos Contables Generales"}
          </span>
        </span>

        <button
          type="submit"
          disabled={
            loading || Math.abs(diferencia) > 0.01 || Boolean(errorPeriodo)
          }
          className={`px-4 py-2 font-bold rounded text-white shadow transition ${
            Math.abs(diferencia) <= 0.01 && !loading && !errorPeriodo
              ? "bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
              : "bg-slate-400 cursor-not-allowed"
          }`}
        >
          {loading ? "Guardando..." : "💾 Guardar Comprobante"}
        </button>
      </div>

      {/* ENCABEZADO */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 items-end">
        <div className="md:col-span-4">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Empresa *
          </label>
          <select
            value={empresaId}
            onChange={(e) => handleCambioEmpresa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {obtenerNombreEmpresa(emp)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Sucursal *
          </label>
          <select
            value={sucursalId}
            onChange={(e) => handleCambioSucursal(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {obtenerNombreSucursal(suc)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Clase Documento *
          </label>
          <select
            value={claseDocumentoId}
            onChange={(e) => setClaseDocumentoId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            {clasesDocs.length > 0 ? (
              clasesDocs.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  [{cls.codigo_clase}] {cls.nombre_clase}
                </option>
              ))
            ) : (
              <option value="">No hay clases para este tipo</option>
            )}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            F. Emisión
          </label>
          <input
            type="date"
            value={fechaEmision}
            onChange={(e) => setFechaEmision(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-slate-800 outline-none text-[10px]"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            F. Contable
          </label>
          <input
            type="date"
            value={fechaContable}
            onChange={(e) => {
              const nuevaFecha = e.target.value;
              setFechaContable(nuevaFecha);
              if (errorPeriodo) setErrorPeriodo(null);
            }}
            onBlur={() => verificarPeriodo(fechaContable)}
            className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-slate-800 outline-none text-[10px]"
          />
          {validandoPeriodo && (
            <p className="text-[9px] text-blue-500 mt-0.5 animate-pulse">
              Verificando periodo...
            </p>
          )}
          {errorPeriodo && (
            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1 rounded mt-0.5">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>

        <div className="md:col-span-12 mt-1">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Descripción Documento *
          </label>
          <input
            type="text"
            value={glosaConcepto}
            onChange={(e) => setGlosaConcepto(e.target.value)}
            placeholder="Ingrese la descripción del documento..."
            required
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
          />
        </div>
      </div>

      {/* DETALLE DINÁMICO */}
      <div className="space-y-2 pb-24">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-slate-700 uppercase text-[11px]">
            Movimientos Contables y Operativos (Detalle)
          </h2>
          <button
            type="button"
            onClick={agregarFila}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded shadow-sm text-[11px] flex items-center gap-1 transition cursor-pointer"
          >
            ➕ Adicionar Fila (+)
          </button>
        </div>

        <div className="bg-white border rounded-lg shadow-sm overflow-visible">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
              <tr>
                <th className="p-2 w-8 text-center">#</th>
                <th className={`p-2 ${esBancario ? "w-[24%]" : "w-[33%]"}`}>
                  Cuenta Auxiliar NIIF *
                </th>
                {esBancario && (
                  <th className="p-2 w-[22%]">Título Valor (Cheque/Otros)</th>
                )}
                <th className={`p-2 ${esBancario ? "w-[27%]" : "w-[38%]"}`}>
                  Tercero
                </th>
                <th className="p-2 text-right w-24">Débito</th>
                <th className="p-2 text-right w-24">Crédito</th>
                <th className="p-2 w-9 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[11px]">
              {detalles.map((fila, index) => {
                const textoAux = fila.busquedaAuxiliar.trim().toLowerCase();
                const auxiliaresFiltrados =
                  fila.filtrarAuxPorTexto && textoAux
                    ? auxiliares.filter(
                        (aux) =>
                          aux.codigo.toLowerCase().includes(textoAux) ||
                          aux.nombre.toLowerCase().includes(textoAux)
                      )
                    : auxiliares;

                const textoTer = fila.busquedaTercero.trim().toLowerCase();
                const tercerosFiltrados =
                  fila.filtrarTerceroPorTexto && textoTer
                    ? terceros.filter((ter) => {
                        const etiqueta = obtenerEtiquetaTercero(ter)
                          .toLowerCase()
                          .trim();
                        return etiqueta.includes(textoTer);
                      })
                    : terceros;

                const esCuentaBancaria = fila.cuenta_financiera_id !== "";
                const tvActual = fila.titulosDisponibles.find(
                  (t) => String(t.id) === fila.titulo_valor_id
                );
                const tituloTvActual = tvActual
                  ? `[${tvActual.tipo_titulo}] #${tvActual.numero_titulo} ($${Number(
                      tvActual.monto || 0
                    ).toLocaleString("es-CO")})`
                  : undefined;

                return (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="p-2 text-center font-mono text-slate-500">
                      {index + 1}
                    </td>

                    {/* AUTOCOMPLETE AUXILIAR */}
                    <td
                      className="p-2 relative overflow-visible"
                      ref={(el) => {
                        auxDropdownRefs.current[index] = el;
                      }}
                    >
                      <input
                        type="text"
                        value={fila.busquedaAuxiliar}
                        title={fila.busquedaAuxiliar || undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDetalles((prev) => {
                            const nuevos = [...prev];
                            nuevos[index] = {
                              ...nuevos[index],
                              busquedaAuxiliar: val,
                              filtrarAuxPorTexto: true,
                              showAuxDropdown: true,
                              concepto_auxiliar_id: "",
                              cuenta_financiera_id: "",
                              titulosDisponibles: [],
                              titulo_valor_id: "",
                            };
                            return nuevos;
                          });
                        }}
                        onFocus={() => {
                          setDetalles((prev) => {
                            const nuevos = [...prev];
                            nuevos[index] = {
                              ...nuevos[index],
                              filtrarAuxPorTexto: false,
                              showAuxDropdown: true,
                            };
                            return nuevos;
                          });
                        }}
                        placeholder="Escriba código o nombre..."
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
                      />

                      {fila.showAuxDropdown && (
                        <div className="absolute left-2 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-2xl min-w-[360px] w-max max-w-xl max-h-60 overflow-y-auto z-[9999]">
                          {auxiliaresFiltrados.length > 0 ? (
                            auxiliaresFiltrados.map((aux) => (
                              <div
                                key={aux.id}
                                onClick={() => seleccionarAuxiliar(index, aux)}
                                className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 border-b border-slate-100 last:border-none text-xs whitespace-normal"
                              >
                                <span className="font-bold text-indigo-700">
                                  [{aux.codigo}]
                                </span>{" "}
                                {aux.nombre}{" "}
                                <span className="text-[10px] text-slate-400">
                                  ({aux.tipo_entidad})
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-3 text-slate-400 text-center text-xs">
                              No se encontraron cuentas
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* TÍTULO VALOR */}
                    {esBancario && (
                      <td className="p-2">
                        <select
                          value={fila.titulo_valor_id}
                          title={tituloTvActual}
                          onChange={(e) =>
                            seleccionarTituloValor(index, e.target.value)
                          }
                          disabled={!esCuentaBancaria}
                          className={`w-full border rounded px-2 py-1 font-medium outline-none truncate ${
                            !esCuentaBancaria
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                              : "bg-white border-slate-300 text-slate-800"
                          }`}
                        >
                          <option value="">
                            {esCuentaBancaria
                              ? "Seleccione Cheque..."
                              : "Seleccione banco primero"}
                          </option>
                          {fila.titulosDisponibles.map((tv) => (
                            <option key={tv.id} value={tv.id}>
                              [{tv.tipo_titulo}] #{tv.numero_titulo} ($
                              {Number(tv.monto || 0).toLocaleString("es-CO")})
                            </option>
                          ))}
                        </select>
                      </td>
                    )}

                    {/* TERCERO BUSCABLE POR ESCRITURA */}
                    <td
                      className="p-2 relative overflow-visible"
                      ref={(el) => {
                        terceroDropdownRefs.current[index] = el;
                      }}
                    >
                      <input
                        type="text"
                        value={fila.busquedaTercero}
                        title={fila.busquedaTercero || undefined}
                        disabled={Boolean(fila.titulo_valor_id)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDetalles((prev) => {
                            const nuevos = [...prev];
                            nuevos[index] = {
                              ...nuevos[index],
                              busquedaTercero: val,
                              filtrarTerceroPorTexto: true,
                              showTerceroDropdown: true,
                              tercero_id: "",
                            };
                            return nuevos;
                          });
                        }}
                        onFocus={() => {
                          if (fila.titulo_valor_id) return;
                          setDetalles((prev) => {
                            const nuevos = [...prev];
                            nuevos[index] = {
                              ...nuevos[index],
                              filtrarTerceroPorTexto: false,
                              showTerceroDropdown: true,
                            };
                            return nuevos;
                          });
                        }}
                        placeholder="Sin Tercero (escriba NIT o nombre)..."
                        className={`w-full border rounded px-2 py-1 font-medium outline-none truncate ${
                          fila.titulo_valor_id
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                            : "bg-white border-slate-300 text-slate-800"
                        }`}
                      />

                      {fila.showTerceroDropdown && !fila.titulo_valor_id && (
                        <div className="absolute left-2 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-2xl min-w-[340px] w-max max-w-xl max-h-60 overflow-y-auto z-[9999]">
                          <div
                            onClick={() => {
                              setDetalles((prev) => {
                                const nuevos = [...prev];
                                nuevos[index] = {
                                  ...nuevos[index],
                                  tercero_id: "",
                                  busquedaTercero: "",
                                  filtrarTerceroPorTexto: false,
                                  showTerceroDropdown: false,
                                };
                                return nuevos;
                              });
                            }}
                            className="px-3 py-1.5 hover:bg-slate-100 cursor-pointer text-slate-500 italic border-b border-slate-100 text-xs"
                          >
                            Sin Tercero
                          </div>

                          {tercerosFiltrados.length > 0 ? (
                            tercerosFiltrados.map((ter) => (
                              <div
                                key={ter.id}
                                onClick={() => seleccionarTercero(index, ter)}
                                className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 border-b border-slate-100 last:border-none text-xs whitespace-normal"
                              >
                                {obtenerEtiquetaTercero(ter)}
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-3 text-slate-400 text-center text-xs">
                              No se encontraron terceros
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* DÉBITO */}
                    <td className="p-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          fila.debito
                            ? Number(fila.debito).toLocaleString("es-CO")
                            : ""
                        }
                        onFocus={() => handleFocusDebito(index)}
                        onChange={(e) => {
                          if (fila.titulo_valor_id) return;
                          const raw = e.target.value
                            .replace(/\./g, "")
                            .replace(/,/g, ".");
                          actualizarFila(index, "debito", raw);
                        }}
                        disabled={Boolean(fila.titulo_valor_id)}
                        placeholder="$ 0"
                        className={`w-full border rounded px-1.5 py-1 text-right font-mono outline-none ${
                          fila.titulo_valor_id
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                            : "bg-white border-slate-300 text-slate-800"
                        }`}
                      />
                    </td>

                    {/* CRÉDITO */}
                    <td className="p-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          fila.credito
                            ? Number(fila.credito).toLocaleString("es-CO")
                            : ""
                        }
                        onChange={(e) => {
                          if (fila.titulo_valor_id) return;
                          const raw = e.target.value
                            .replace(/\./g, "")
                            .replace(/,/g, ".");
                          actualizarFila(index, "credito", raw);
                        }}
                        disabled={Boolean(fila.titulo_valor_id)}
                        placeholder="$ 0"
                        className={`w-full border rounded px-1.5 py-1 text-right font-mono outline-none ${
                          fila.titulo_valor_id
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                            : "bg-white border-slate-300 text-slate-800"
                        }`}
                      />
                    </td>

                    {/* ACCIÓN ELIMINAR */}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => eliminarFila(index)}
                        className="text-red-500 hover:text-red-700 font-bold px-1 py-1 rounded transition cursor-pointer"
                        title="Eliminar fila"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-[11px]">
              <tr>
                <td className="p-2.5 pr-6 text-right" colSpan={esBancario ? 6 : 5}>
                  <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 font-mono mr-3">
                    <span>
                      Débito:{" "}
                      <strong className="text-slate-900">
                        $ {totalDebitos.toLocaleString("es-CO")}
                      </strong>
                    </span>
                    <span>
                      Crédito:{" "}
                      <strong className="text-slate-900">
                        $ {totalCreditos.toLocaleString("es-CO")}
                      </strong>
                    </span>
                    {Math.abs(diferencia) <= 0.01 ? (
                      <span className="text-emerald-700 font-sans font-bold">
                        Diferencia: $ 0 (Cuadrado ✓)
                      </span>
                    ) : (
                      <span
                        className="text-red-600 font-bold"
                        title="Partidas descuadradas"
                      >
                        Diferencia: $ {diferencia.toLocaleString("es-CO")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </form>
  );
}