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
  obtenerConceptosRetencion,
  guardarConceptoRetencion,
  obtenerAuxiliaresPorElemento,
  clonarConceptosAnioAnterior,
  copiarConceptosRetencion,
  ConceptoRetencionRow,
  ConceptoAuxiliarInfo,
} from "./conceptos-actions";
import {
  Plus,
  Edit,
  CheckCircle,
  XCircle,
  X,
  Copy,
  ClipboardCopy,
} from "lucide-react";

type Empresa = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
};

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

export default function ConceptosRetencionPage() {
  const router = useRouter();
  const usuarioIdRef = useRef<string | null>(null);
  const inicializadoRef = useRef<boolean>(false);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");

  const anioActual = new Date().getFullYear();
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(anioActual);

  const [conceptos, setConceptos] = useState<ConceptoRetencionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [auxiliaresPasivo, setAuxiliaresPasivo] = useState<
    ConceptoAuxiliarInfo[]
  >([]);
  const [auxiliaresActivo, setAuxiliaresActivo] = useState<
    ConceptoAuxiliarInfo[]
  >([]);

  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [conceptoEditando, setConceptoEditando] =
    useState<ConceptoRetencionRow | null>(null);

  // Estado modal copiar desde empresa activa hacia otra empresa asignada
  const [modalCopiarAbierto, setModalCopiarAbierto] = useState<boolean>(false);
  const [empresaDestinoId, setEmpresaDestinoId] = useState<string>("");
  const [anioOrigenCopia, setAnioOrigenCopia] = useState<number>(anioActual);
  const [copiandoConceptos, setCopiandoConceptos] = useState<boolean>(false);

  const [tipoRetencion, setTipoRetencion] = useState<"RENTA" | "IVA" | "ICA">(
    "RENTA"
  );
  const [conceptoTexto, setConceptoTexto] = useState<string>("");
  const [baseMinima, setBaseMinima] = useState<string>("0");
  const [tarifaComercial, setTarifaComercial] = useState<string>("0");
  const [cuentaPasivoId, setCuentaPasivoId] = useState<string>("");
  const [cuentaActivoId, setCuentaActivoId] = useState<string>("");
  const [codigoMunicipio, setCodigoMunicipio] = useState<string>("");
  const [guardando, setGuardando] = useState<boolean>(false);

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
        // Continuar con actualización directa si aplica
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

          const otraEmpresa = listaEmpresas.find(
            (e) => String(e.id) !== empresaIdAUsar
          );
          setEmpresaDestinoId(otraEmpresa ? String(otraEmpresa.id) : "");
        }
      } catch (err) {
        console.error(
          "Error inicializando empresas permitidas en conceptos de retención:",
          err
        );
      }
    }

    init();
    return () => {
      cancelado = true;
    };
  }, [isMounted, resolverUsuarioId]);

  const handleCambioEmpresa = async (nuevoId: string) => {
    setEmpresaId(nuevoId);

    const otraEmpresa = empresas.find((e) => String(e.id) !== String(nuevoId));
    setEmpresaDestinoId(otraEmpresa ? String(otraEmpresa.id) : "");

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

  const cargarDatosEmpresa = useCallback(
    async (empId: string, anio: number) => {
      if (!empId) return;
      setLoading(true);
      try {
        const [resConceptos, resPasivo, resActivo] = await Promise.all([
          obtenerConceptosRetencion(empId, anio),
          obtenerAuxiliaresPorElemento(empId, "Pasivo"),
          obtenerAuxiliaresPorElemento(empId, "Activo"),
        ]);

        if (resConceptos.success) {
          setConceptos(resConceptos.data || []);
        }
        if (resPasivo.success) {
          setAuxiliaresPasivo(resPasivo.data || []);
        }
        if (resActivo.success) {
          setAuxiliaresActivo(resActivo.data || []);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isMounted || !empresaId) return;

    const timer = setTimeout(() => {
      cargarDatosEmpresa(empresaId, anioSeleccionado);
    }, 60);

    return () => clearTimeout(timer);
  }, [isMounted, empresaId, anioSeleccionado, cargarDatosEmpresa]);

  const convertirTarifaParaBD = (valorComercial: number, tipo: string) => {
    if (tipo === "ICA") {
      return valorComercial / 1000;
    }
    return valorComercial / 100;
  };

  const convertirTarifaDesdeBD = (tarifaDb: number, tipo: string) => {
    const val = Number(tarifaDb || 0);
    if (tipo === "ICA") {
      return val * 1000;
    }
    return val * 100;
  };

  const abrirModalNuevo = () => {
    setConceptoEditando(null);
    setTipoRetencion("RENTA");
    setConceptoTexto("");
    setBaseMinima("0");
    setTarifaComercial("0");
    setCuentaPasivoId("");
    setCuentaActivoId("");
    setCodigoMunicipio("");
    setModalAbierto(true);
  };

  const abrirModalEditar = (item: ConceptoRetencionRow) => {
    setConceptoEditando(item);
    setTipoRetencion(item.tipo_retencion);
    setConceptoTexto(item.concepto);
    setBaseMinima(String(item.base_minima));
    setTarifaComercial(
      String(convertirTarifaDesdeBD(item.tarifa, item.tipo_retencion))
    );
    setCuentaPasivoId(
      item.concepto_auxiliar_id ? String(item.concepto_auxiliar_id) : ""
    );
    setCuentaActivoId(
      item.concepto_auxiliar_activo_id
        ? String(item.concepto_auxiliar_activo_id)
        : ""
    );
    setCodigoMunicipio(item.codigo_municipio || "");
    setModalAbierto(true);
  };

  const otrasEmpresasAsignadas = empresas.filter(
    (e) => String(e.id) !== String(empresaId)
  );

  const abrirModalCopiar = () => {
    setEmpresaDestinoId(
      otrasEmpresasAsignadas.length > 0
        ? String(otrasEmpresasAsignadas[0].id)
        : ""
    );
    setAnioOrigenCopia(anioSeleccionado);
    setModalCopiarAbierto(true);
  };

  const handleConfirmarCopia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) {
      alert("No se ha identificado la empresa activa de origen.");
      return;
    }
    if (!empresaDestinoId || String(empresaDestinoId) === String(empresaId)) {
      alert("Debe seleccionar otra empresa asignada como destino.");
      return;
    }

    setCopiandoConceptos(true);
    const res = await copiarConceptosRetencion({
      empresaOrigenId: empresaId,
      empresaDestinoId,
      anioOrigen: anioOrigenCopia,
      anioDestino: anioSeleccionado,
    });
    setCopiandoConceptos(false);

    if (res.success) {
      setModalCopiarAbierto(false);
      const mensajeExtra =
        res.omitidos && res.omitidos > 0
          ? ` (${res.omitidos} ya existían y se omitieron)`
          : "";
      alert(
        `Se copiaron ${res.copiados} concepto(s) de retención desde la empresa activa${mensajeExtra}. Recuerda asignar las cuentas auxiliares en la empresa destino.`
      );
      cargarDatosEmpresa(empresaId, anioSeleccionado);
    } else {
      alert("Error al copiar conceptos: " + res.error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conceptoTexto.trim()) {
      alert("El nombre del concepto es obligatorio.");
      return;
    }

    setGuardando(true);
    const tarifaFinal = convertirTarifaParaBD(
      Number(tarifaComercial),
      tipoRetencion
    );

    const res = await guardarConceptoRetencion({
      id: conceptoEditando?.id,
      empresa_id: Number(empresaId),
      anio: anioSeleccionado,
      tipo_retencion: tipoRetencion,
      concepto: conceptoTexto,
      base_minima: Number(baseMinima),
      tarifa: tarifaFinal,
      concepto_auxiliar_id: cuentaPasivoId ? Number(cuentaPasivoId) : null,
      concepto_auxiliar_activo_id: cuentaActivoId
        ? Number(cuentaActivoId)
        : null,
      codigo_municipio: tipoRetencion === "ICA" ? codigoMunicipio : null,
      activo: conceptoEditando ? conceptoEditando.activo : true,
    });

    setGuardando(false);

    if (res.success) {
      setModalAbierto(false);
      cargarDatosEmpresa(empresaId, anioSeleccionado);
    } else {
      alert("Error al guardar el concepto: " + res.error);
    }
  };

  const clonarAnioAnterior = async () => {
    const anioOrigen = anioSeleccionado - 1;
    const confirmar = window.confirm(
      `¿Desea clonar los conceptos del año ${anioOrigen} al año ${anioSeleccionado}? Esto le permitirá reutilizar la parametrización previa.`
    );
    if (!confirmar) return;

    setLoading(true);
    const res = await clonarConceptosAnioAnterior(
      empresaId,
      anioOrigen,
      anioSeleccionado
    );
    setLoading(false);

    if (res.success) {
      alert(`¡Conceptos clonados con éxito para el año ${anioSeleccionado}!`);
      cargarDatosEmpresa(empresaId, anioSeleccionado);
    } else {
      alert("Error en la clonación: " + res.error);
    }
  };

  const fmt = (v: number) => `$ ${Number(v || 0).toLocaleString("es-CO")}`;

  const formatearTarifaTabla = (tarifaDb: number, tipo: string) => {
    const valor = Number(tarifaDb || 0);
    if (tipo === "ICA") {
      const porMil = valor * 1000;
      return `${porMil.toFixed(1).replace(/\.?0+$/, "")} x mil`;
    }
    const porCiento = valor * 100;
    return `${porCiento.toFixed(1).replace(/\.?0+$/, "")}%`;
  };

  if (!isMounted) return null;

  const empresaOrigenObj = empresas.find(
    (e) => String(e.id) === String(empresaId)
  );
  const empresaOrigenNombre = empresaOrigenObj
    ? obtenerNombreEmpresa(empresaOrigenObj)
    : "Empresa Activa";

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
              Parametrización de Conceptos de Retención ({anioSeleccionado})
            </h1>
            <p className="text-sm text-slate-500">
              Gestión de tarifas, bases mínimas y cuentas contables por año
              fiscal.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abrirModalCopiar}
            disabled={!empresaId || otrasEmpresasAsignadas.length === 0}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs transition"
            title={
              otrasEmpresasAsignadas.length === 0
                ? "No tienes otra empresa asignada para copiar"
                : "Copiar conceptos de la empresa activa hacia otra empresa asignada"
            }
          >
            <ClipboardCopy className="w-4 h-4" /> Copiar a otra empresa
          </button>
          <button
            type="button"
            onClick={clonarAnioAnterior}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs transition"
            title="Copiar configuración del año anterior"
          >
            <Copy className="w-4 h-4" /> Clonar del {anioSeleccionado - 1}
          </button>
          <button
            type="button"
            onClick={abrirModalNuevo}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs transition"
          >
            <Plus className="w-4 h-4" /> Nuevo Concepto
          </button>
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

        <div className="md:col-span-3">
          <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
            Año Fiscal
          </label>
          <select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-sm outline-none"
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((anio) => (
              <option key={anio} value={anio}>
                {anio}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-semibold">
            Cargando conceptos para el año {anioSeleccionado}...
          </div>
        ) : conceptos.length === 0 ? (
          <div className="p-12 text-center text-slate-500 italic space-y-3">
            <p>No hay conceptos configurados para el año {anioSeleccionado}.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {otrasEmpresasAsignadas.length > 0 && (
                <button
                  type="button"
                  onClick={abrirModalCopiar}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <ClipboardCopy className="w-4 h-4" /> Copiar a otra empresa
                </button>
              )}
              <button
                type="button"
                onClick={clonarAnioAnterior}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Traer datos del año{" "}
                {anioSeleccionado - 1}
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b uppercase">
                <tr>
                  <th className="p-3.5">Impuesto</th>
                  <th className="p-3.5">Concepto</th>
                  <th className="p-3.5 text-right">Base Mínima</th>
                  <th className="p-3.5 text-center">Tarifa</th>
                  <th className="p-3.5">Cta. Pasivo (Ret. Practicada)</th>
                  <th className="p-3.5">Cta. Activo (Ret. Recibida)</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {conceptos.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-slate-900">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold ${
                          item.tipo_retencion === "RENTA"
                            ? "bg-blue-100 text-blue-800"
                            : item.tipo_retencion === "IVA"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {item.tipo_retencion}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900">
                      {item.concepto}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-700">
                      {fmt(item.base_minima)}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-indigo-700">
                      {formatearTarifaTabla(item.tarifa, item.tipo_retencion)}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {item.concepto_auxiliar ? (
                        `${item.concepto_auxiliar.codigo_auxiliar} - ${item.concepto_auxiliar.nombre}`
                      ) : (
                        <span className="text-red-500 italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {item.concepto_auxiliar_activo ? (
                        `${item.concepto_auxiliar_activo.codigo_auxiliar} - ${item.concepto_auxiliar_activo.nombre}`
                      ) : (
                        <span className="text-amber-600 italic">No aplica</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {item.activo ? (
                        <span className="text-emerald-600 flex items-center justify-center gap-1 font-semibold">
                          <CheckCircle className="w-4 h-4" /> Activo
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center justify-center gap-1">
                          <XCircle className="w-4 h-4" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => abrirModalEditar(item)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL COPIAR DESDE EMPRESA ACTIVA HACIA OTRA EMPRESA ASIGNADA */}
      {modalCopiarAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border max-w-lg w-full p-6 space-y-5 relative font-sans text-slate-900 text-sm">
            <button
              type="button"
              onClick={() => setModalCopiarAbierto(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold uppercase tracking-wide border-b pb-3">
              Copiar Conceptos desde Empresa Activa
            </h2>

            <form onSubmit={handleConfirmarCopia} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                Se copiarán desde la <strong>empresa activa</strong> tipo de
                impuesto, concepto, base mínima, tarifa, código de municipio y
                estado. Las <strong>cuentas auxiliares</strong> quedarán sin
                asignar para que las configures en la empresa destino.
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                  Empresa Origen (Empresa Activa)
                </label>
                <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800">
                  {empresaOrigenNombre}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                  Empresa Destino (Otra Empresa Asignada)
                </label>
                <select
                  value={empresaDestinoId}
                  onChange={(e) => setEmpresaDestinoId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900 outline-none"
                >
                  {otrasEmpresasAsignadas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {obtenerNombreEmpresa(emp)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    Año Origen
                  </label>
                  <select
                    value={anioOrigenCopia}
                    onChange={(e) => setAnioOrigenCopia(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 outline-none"
                  >
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((anio) => (
                      <option key={anio} value={anio}>
                        {anio}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    Año Destino
                  </label>
                  <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800">
                    {anioSeleccionado}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalCopiarAbierto(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={copiandoConceptos || !empresaDestinoId}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {copiandoConceptos ? "Copiando..." : "Copiar Conceptos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR CONCEPTO */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border max-w-2xl w-full p-8 space-y-6 relative font-sans text-slate-900 text-sm max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-base font-bold uppercase tracking-wide border-b pb-3">
              {conceptoEditando
                ? `Editar Concepto (${anioSeleccionado})`
                : `Nuevo Concepto para el año ${anioSeleccionado}`}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    Tipo de Impuesto
                  </label>
                  <select
                    value={tipoRetencion}
                    onChange={(e) =>
                      setTipoRetencion(
                        e.target.value as "RENTA" | "IVA" | "ICA"
                      )
                    }
                    disabled={!!conceptoEditando}
                    className={`w-full border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none ${
                      conceptoEditando
                        ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                        : "bg-white text-slate-900"
                    }`}
                  >
                    <option value="RENTA">Renta</option>
                    <option value="IVA">IVA</option>
                    <option value="ICA">ICA</option>
                  </select>
                </div>

                {tipoRetencion === "ICA" && (
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                      Código Municipio (DANE)
                    </label>
                    <input
                      type="text"
                      value={codigoMunicipio}
                      onChange={(e) => setCodigoMunicipio(e.target.value)}
                      placeholder="Ej: 68001"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                  Descripción del Concepto
                </label>
                <input
                  type="text"
                  value={conceptoTexto}
                  onChange={(e) => setConceptoTexto(e.target.value)}
                  placeholder="Ej: Compras generales, Servicios..."
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    Base Mínima ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={baseMinima}
                    onChange={(e) => setBaseMinima(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    {tipoRetencion === "ICA"
                      ? "Tarifa (Ej: 5.5 para 5.5 x mil)"
                      : "Tarifa (Ej: 3.5 para 3.5%)"}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tarifaComercial}
                    onChange={(e) => setTarifaComercial(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    Cuenta Auxiliar PASIVO (Crédito - Retención Practicada a
                    Proveedores)
                  </label>
                  <select
                    value={cuentaPasivoId}
                    onChange={(e) => setCuentaPasivoId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none text-xs font-mono"
                  >
                    <option value="">-- Seleccione Cuenta de Pasivo --</option>
                    {auxiliaresPasivo.map((aux) => (
                      <option key={aux.id} value={aux.id}>
                        {aux.codigo_auxiliar} - {aux.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs">
                    Cuenta Auxiliar ACTIVO (Débito - Retención Recibida /
                    Clientes)
                  </label>
                  <select
                    value={cuentaActivoId}
                    onChange={(e) => setCuentaActivoId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 font-semibold outline-none text-xs font-mono"
                  >
                    <option value="">
                      -- Seleccione Cuenta de Activo (Opcional) --
                    </option>
                    {auxiliaresActivo.map((aux) => (
                      <option key={aux.id} value={aux.id}>
                        {aux.codigo_auxiliar} - {aux.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Guardar Concepto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}