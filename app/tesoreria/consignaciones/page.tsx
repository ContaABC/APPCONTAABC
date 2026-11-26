"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  FormEvent,
} from "react";
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
  obtenerDatosBaseConsignacion,
  ejecutarConsignacionBancaria,
  ChequeEnCaja,
  CuentaFinancieraData,
  ConceptoAuxiliarData,
  ClaseDocumentoData,
} from "./consignaciones-actions";
import { validarPeriodoContable } from "@/lib/accounting-validations";

type EmpresaItem = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
};

type SucursalItem = SucursalPermitida & {
  nombre_sucursal?: string;
};

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

export default function ConsignacionesPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [sucursales, setSucursales] = useState<SucursalItem[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  const [cuentasBancos, setCuentasBancos] = useState<CuentaFinancieraData[]>([]);
  const [conceptosAuxiliares, setConceptosAuxiliares] = useState<
    ConceptoAuxiliarData[]
  >([]);
  const [clasesDoc, setClasesDoc] = useState<ClaseDocumentoData[]>([]);
  const [chequesEnCaja, setChequesEnCaja] = useState<ChequeEnCaja[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [tipoConsignacion, setTipoConsignacion] = useState<
    "EFECTIVO" | "CHEQUES"
  >("EFECTIVO");
  const [cuentaBancoId, setCuentaBancoId] = useState<string>("");
  const [claseDocId, setClaseDocId] = useState<string>("");
  const [conceptoAuxiliarId, setConceptoAuxiliarId] = useState<string>("");
  const [valorEfectivo, setValorEfectivo] = useState<number>(0);
  const [chequesSeleccionados, setChequesSeleccionados] = useState<{
    [key: number]: boolean;
  }>({});
  const [fechaContable, setFechaContable] = useState<string>("");
  const [glosa, setGlosa] = useState<string>(
    "Consignación bancaria de tesorería"
  );
  const [procesando, setProcesando] = useState<boolean>(false);

  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    setFechaContable(new Date().toISOString().split("T")[0]);
  }, []);

  const verificarPeriodo = useCallback(
    async (fecha: string) => {
      if (!empresaId || !sucursalId || !fecha) {
        setErrorPeriodo(null);
        return;
      }

      setValidandoPeriodo(true);
      setErrorPeriodo(null);

      try {
        const res = await validarPeriodoContable(empresaId, sucursalId, fecha);
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
    if (empresaId && sucursalId && fechaContable) {
      verificarPeriodo(fechaContable);
    }
  }, [empresaId, sucursalId, fechaContable, verificarPeriodo]);

  useEffect(() => {
    if (!isMounted || inicializadoRef.current) return;
    inicializadoRef.current = true;
    let cancelado = false;

    async function init() {
      let uid: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) uid = data.user.id;
      } catch {
        // Ignorar
      }
      if (!uid) {
        uid = obtenerUsuarioIdDesdeLocalStorage();
      }
      usuarioIdRef.current = uid;

      const permitidas = await getEmpresasPermitidas(uid);
      if (cancelado) return;

      const listaEmpresas: EmpresaItem[] = Array.isArray(permitidas)
        ? (permitidas as EmpresaItem[])
        : [];
      setEmpresas(listaEmpresas);

      if (listaEmpresas.length === 0) {
        setEmpresaId("");
        return;
      }

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

      const sucPermitidas = await getSucursalesPermitidas(empresaIdAUsar, uid);
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

    init();
    return () => {
      cancelado = true;
    };
  }, [isMounted]);

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

    if (!nuevoId) return;

    setEmpresaActivaUsuario(nuevoId, usuarioIdRef.current, null).catch(
      () => {}
    );

    const sucPermitidas = await getSucursalesPermitidas(
      nuevoId,
      usuarioIdRef.current
    );
    const listaSuc: SucursalItem[] = Array.isArray(sucPermitidas)
      ? (sucPermitidas as SucursalItem[])
      : [];
    setSucursales(listaSuc);

    if (listaSuc.length > 0) {
      const idSucPrimera = String(listaSuc[0].id);
      setSucursalId(idSucPrimera);
      if (typeof window !== "undefined") {
        localStorage.setItem("sucursal_activa", idSucPrimera);
        localStorage.setItem("sucursal_id", idSucPrimera);
        localStorage.setItem(
          "sucursal_activa_nombre",
          obtenerNombreSucursal(listaSuc[0])
        );
      }
      document.cookie = `sucursal_activa=${encodeURIComponent(
        idSucPrimera
      )}; path=/; max-age=86400; SameSite=Lax`;
    }
  };

  const handleCambioSucursal = (nuevoSucId: string) => {
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
    setSucursalActivaUsuario(nuevoSucId || null, usuarioIdRef.current).catch(
      () => {}
    );
  };

  const cargarDatos = useCallback(async () => {
    if (!empresaId || !sucursalId) {
      setCuentasBancos([]);
      setConceptosAuxiliares([]);
      setClasesDoc([]);
      setChequesEnCaja([]);
      return;
    }

    setLoading(true);
    const parsedEmpresaId = Number(empresaId);
    const parsedSucursalId = Number(sucursalId);

    const baseRes = await obtenerDatosBaseConsignacion(
      parsedEmpresaId,
      parsedSucursalId
    );

    if (baseRes.success) {
      const listaCuentas = baseRes.cuentasBancos || [];
      const listaConceptos = baseRes.conceptosAuxiliares || [];
      const listaClases = baseRes.clasesDocumento || [];

      setCuentasBancos(listaCuentas);
      setConceptosAuxiliares(listaConceptos);
      setClasesDoc(listaClases);
      setChequesEnCaja(baseRes.chequesEnCaja || []);

      setCuentaBancoId(listaCuentas.length > 0 ? String(listaCuentas[0].id) : "");
      setClaseDocId(listaClases.length > 0 ? String(listaClases[0].id) : "");
      setConceptoAuxiliarId(
        listaConceptos.length > 0 ? String(listaConceptos[0].id) : ""
      );
    }
    setChequesSeleccionados({});
    setLoading(false);
  }, [empresaId, sucursalId]);

  useEffect(() => {
    if (!isMounted || !inicializadoRef.current) return;
    cargarDatos();
  }, [isMounted, cargarDatos]);

  const handleToggleCheque = (id: number) => {
    setChequesSeleccionados((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalValorConsignacion = useMemo(() => {
    if (tipoConsignacion === "EFECTIVO") {
      return Number(valorEfectivo || 0);
    }
    return Object.keys(chequesSeleccionados)
      .filter((id) => chequesSeleccionados[Number(id)])
      .reduce((acc, id) => {
        const chq = chequesEnCaja.find((c) => c.id === Number(id));
        return acc + Number(chq?.monto || 0);
      }, 0);
  }, [tipoConsignacion, valorEfectivo, chequesSeleccionados, chequesEnCaja]);

  const fmt = (v?: number | null) =>
    `$ ${Math.round(Number(v || 0)).toLocaleString("es-CO")}`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (errorPeriodo) {
      alert(
        "No se puede ejecutar la consignación porque el periodo contable no es válido o está cerrado."
      );
      return;
    }

    if (!empresaId || !sucursalId) {
      alert("La Empresa y la Sucursal son obligatorias.");
      return;
    }
    if (!cuentaBancoId) {
      alert("Seleccione la cuenta bancaria de destino.");
      return;
    }
    if (!claseDocId) {
      alert("Seleccione la clase de documento.");
      return;
    }
    if (!conceptoAuxiliarId) {
      alert(
        "Seleccione el concepto auxiliar contable (contrapartida crédito)."
      );
      return;
    }
    if (tipoConsignacion === "EFECTIVO" && valorEfectivo <= 0) {
      alert("Ingrese un valor de efectivo válido.");
      return;
    }

    const chequesIdsList = Object.keys(chequesSeleccionados)
      .filter((id) => chequesSeleccionados[Number(id)])
      .map((id) => Number(id));

    if (tipoConsignacion === "CHEQUES" && chequesIdsList.length === 0) {
      alert("Seleccione al menos un cheque de la lista.");
      return;
    }

    setProcesando(true);
    try {
      const res = await ejecutarConsignacionBancaria({
        empresa_id: Number(empresaId),
        sucursal_id: Number(sucursalId),
        clase_documento_id: Number(claseDocId),
        cuenta_financiera_id: Number(cuentaBancoId),
        fecha_contable: fechaContable,
        tipo_consignacion: tipoConsignacion,
        concepto_auxiliar_id: Number(conceptoAuxiliarId),
        valor_efectivo:
          tipoConsignacion === "EFECTIVO" ? Number(valorEfectivo) : 0,
        cheques_ids: tipoConsignacion === "CHEQUES" ? chequesIdsList : [],
        glosa,
      });

      if (res && res.success) {
        alert(
          `¡Consignación procesada con éxito! Comprobante N°: ${res.numero_documento}`
        );
        setValorEfectivo(0);
        setChequesSeleccionados({});
        await cargarDatos();
      } else {
        alert(
          "Error al procesar la consignación: " +
            (res?.error || "Error desconocido")
        );
      }
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 text-xs font-sans">
      <div className="border-b pb-2 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
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
              Módulo de Consignaciones Bancarias
            </h1>
            <p className="text-[11px] text-slate-500">
              Registro de depósitos de efectivo (Caja) y cheques en custodia (En
              Caja).
            </p>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-200 p-1 rounded self-start md:self-auto">
          <button
            type="button"
            onClick={() => setTipoConsignacion("EFECTIVO")}
            className={`px-3 py-1 font-bold rounded text-[11px] transition cursor-pointer ${
              tipoConsignacion === "EFECTIVO"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-300"
            }`}
          >
            💵 Consignar Efectivo
          </button>
          <button
            type="button"
            onClick={() => setTipoConsignacion("CHEQUES")}
            className={`px-3 py-1 font-bold rounded text-[11px] transition cursor-pointer ${
              tipoConsignacion === "CHEQUES"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-300"
            }`}
          >
            📜 Consignar Cheques
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Empresa *
          </label>
          <select
            value={empresaId}
            onChange={(e) => handleCambioEmpresa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate cursor-pointer"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {obtenerNombreEmpresa(emp)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Sucursal *
          </label>
          <select
            value={sucursalId}
            onChange={(e) => handleCambioSucursal(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none cursor-pointer"
          >
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {obtenerNombreSucursal(suc)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Clase de Documento
          </label>
          <select
            value={claseDocId}
            onChange={(e) => setClaseDocId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none cursor-pointer"
          >
            {clasesDoc.map((cd) => (
              <option key={cd.id} value={cd.id}>
                {cd.nombre_clase}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Cuenta Bancaria Destino
          </label>
          <select
            value={cuentaBancoId}
            onChange={(e) => setCuentaBancoId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate cursor-pointer"
          >
            {cuentasBancos.map((cta) => (
              <option key={cta.id} value={cta.id}>
                {cta.nombre_cuenta} ({cta.numero_cuenta})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Fecha Contable *
          </label>
          <input
            type="date"
            value={fechaContable}
            onChange={(e) => {
              setFechaContable(e.target.value);
              if (errorPeriodo) setErrorPeriodo(null);
            }}
            onBlur={() => verificarPeriodo(fechaContable)}
            required
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
          />
          {validandoPeriodo && (
            <p className="text-[9px] text-blue-600 mt-0.5 animate-pulse">
              Verificando periodo...
            </p>
          )}
          {errorPeriodo && (
            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1 rounded mt-0.5">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>

        <div className="md:col-span-6">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Concepto Auxiliar Contable (Contrapartida Crédito)
          </label>
          <select
            value={conceptoAuxiliarId}
            onChange={(e) => setConceptoAuxiliarId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate cursor-pointer"
          >
            {conceptosAuxiliares.map((ca) => (
              <option key={ca.id} value={ca.id}>
                [{ca.codigo_auxiliar}] {ca.nombre}
              </option>
            ))}
          </select>
        </div>

        {tipoConsignacion === "EFECTIVO" && (
          <div className="md:col-span-6">
            <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
              Valor en Efectivo a Consignar
            </label>
            <input
              type="number"
              placeholder="Ej: 1500000"
              value={valorEfectivo || ""}
              onChange={(e) => setValorEfectivo(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-800 outline-none"
            />
          </div>
        )}
      </div>

      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-1/2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">
            Glosa / Concepto General
          </label>
          <input
            type="text"
            value={glosa}
            onChange={(e) => setGlosa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-slate-500 uppercase text-[10px] block font-bold">
              Total Consignación:
            </span>
            <span className="font-mono font-bold text-emerald-700 text-base">
              {fmt(totalValorConsignacion)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              !isMounted ||
              procesando ||
              totalValorConsignacion <= 0 ||
              !empresaId ||
              !sucursalId ||
              Boolean(errorPeriodo)
            }
            suppressHydrationWarning
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded shadow transition text-xs cursor-pointer"
          >
            {procesando ? "Procesando..." : "💾 Ejecutar Consignación"}
          </button>
        </div>
      </div>

      {tipoConsignacion === "CHEQUES" && (
        <div className="space-y-2">
          <h2 className="font-bold text-slate-700 uppercase text-[11px]">
            Cheques Disponibles en Caja (Estado: En_Caja)
          </h2>
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              Cargando títulos valores...
            </div>
          ) : chequesEnCaja.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic bg-white border rounded-lg">
              No hay cheques disponibles en caja para la empresa y sucursal
              seleccionada.
            </div>
          ) : (
            <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
                  <tr>
                    <th className="p-2 text-center w-10">Sel.</th>
                    <th className="p-2">N° Cheque</th>
                    <th className="p-2">Banco Emisor</th>
                    <th className="p-2">Girador</th>
                    <th className="p-2 text-center">F. Expedición</th>
                    <th className="p-2 text-center">F. Cobro Posfechado</th>
                    <th className="p-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[10px]">
                  {chequesEnCaja.map((chq) => {
                    const sel = !!chequesSeleccionados[chq.id];
                    const bancoNombre =
                      chq.banco_girador?.nombre_banco || "N/A";
                    const giradorNombre =
                      chq.tercero_girador?.razon_social || "N/A";

                    return (
                      <tr
                        key={chq.id}
                        className={
                          sel ? "bg-indigo-50/40" : "hover:bg-slate-50"
                        }
                      >
                        <td className="p-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => handleToggleCheque(chq.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-2 font-bold text-slate-900 align-middle">
                          {chq.numero_titulo || ""}
                        </td>
                        <td className="p-2 text-slate-700 align-middle">
                          {bancoNombre}
                        </td>
                        <td className="p-2 text-slate-700 align-middle">
                          {giradorNombre}
                        </td>
                        <td className="p-2 text-center text-slate-600 align-middle">
                          {chq.fecha_expedicion || ""}
                        </td>
                        <td className="p-2 text-center text-slate-600 align-middle">
                          {chq.fecha_cobro_posfechado || ""}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700 align-middle">
                          {fmt(chq.monto)}
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