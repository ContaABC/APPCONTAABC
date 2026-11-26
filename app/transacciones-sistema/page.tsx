"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  obtenerTransaccionesSistema,
  guardarTransaccionSistema,
  eliminarTransaccionSistema,
  type TransaccionSistema,
} from "./actions";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Route,
} from "lucide-react";

const MODULOS_SUGERIDOS = [
  "CONTABILIDAD",
  "CARTERA",
  "TESORERIA",
  "INVENTARIOS",
  "COMPRAS",
  "VENTAS",
  "NOMINA",
  "SEGURIDAD",
  "CONFIGURACION",
];

const LAYOUTS_SUGERIDOS = [
  "default",
  "dashboard",
  "contabilidad",
  "admin",
];

function quitarTildes(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function canonizarModulo(modulo: string): string {
  const limpio = quitarTildes(modulo);
  const mapaCanonico: Record<string, string> = {
    CONFIGURACION: "CONFIGURACION",
    TESORERIA: "TESORERIA",
    NOMINA: "NOMINA",
    CONTABILIDAD: "CONTABILIDAD",
    CARTERA: "CARTERA",
    INVENTARIOS: "INVENTARIOS",
    COMPRAS: "COMPRAS",
    VENTAS: "VENTAS",
    SEGURIDAD: "SEGURIDAD",
  };
  return mapaCanonico[limpio] || limpio;
}

export default function TransaccionesSistemaPage() {
  const router = useRouter();

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [registros, setRegistros] = useState<TransaccionSistema[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);

  // Campos del formulario
  const [editId, setEditId] = useState<number | undefined>(undefined);
  const [rutaAcceso, setRutaAcceso] = useState<string>("");
  const [modulo, setModulo] = useState<string>("CONTABILIDAD");
  const [layout, setLayout] = useState<string>("default");
  const [esModuloPadre, setEsModuloPadre] = useState<boolean>(false);

  // Filtros de tabla
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroModulo, setFiltroModulo] = useState<string>("TODOS");

  // Feedback
  const [mensaje, setMensaje] = useState<{
    tipo: "success" | "error";
    texto: string;
  } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const cargarRegistros = useCallback(async () => {
    setCargando(true);
    const res = await obtenerTransaccionesSistema();
    setCargando(false);
    if (res.success) {
      setRegistros(res.data);
    } else {
      setMensaje({
        tipo: "error",
        texto: res.error || "No se pudieron cargar las transacciones.",
      });
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    cargarRegistros();
  }, [isMounted, cargarRegistros]);

  const limpiarFormulario = () => {
    setEditId(undefined);
    setRutaAcceso("");
    setModulo("CONTABILIDAD");
    setLayout("default");
    setEsModuloPadre(false);
  };

  const handleEditar = (item: TransaccionSistema) => {
    setEditId(item.id);
    setRutaAcceso(item.ruta_acceso);
    setModulo(canonizarModulo(item.modulo));
    setLayout(item.layout);
    setEsModuloPadre(Boolean(item.es_modulo_padre));
    setMensaje(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    setGuardando(true);

    const moduloFinal = canonizarModulo(modulo);

    const res = await guardarTransaccionSistema({
      id: editId,
      ruta_acceso: rutaAcceso,
      modulo: moduloFinal,
      layout,
      es_modulo_padre: esModuloPadre,
    });

    setGuardando(false);

    if (res.success) {
      setMensaje({
        tipo: "success",
        texto: editId
          ? `Transacción "${res.data?.ruta_acceso}" actualizada con éxito.`
          : `Transacción "${res.data?.ruta_acceso}" registrada con éxito.`,
      });
      limpiarFormulario();
      await cargarRegistros();
    } else {
      setMensaje({
        tipo: "error",
        texto: res.error || "No se pudo guardar la transacción.",
      });
    }
  };

  const handleEliminar = async (item: TransaccionSistema) => {
    setMensaje(null);
    const res = await eliminarTransaccionSistema(item.id);
    if (res.success) {
      setMensaje({
        tipo: "success",
        texto: `Transacción "${item.ruta_acceso}" eliminada.`,
      });
      if (editId === item.id) {
        limpiarFormulario();
      }
      await cargarRegistros();
    } else {
      setMensaje({
        tipo: "error",
        texto: res.error || "No se pudo eliminar la transacción.",
      });
    }
  };

  const modulosDisponibles = useMemo(() => {
    const mapaMods = new Map<string, string>();
    MODULOS_SUGERIDOS.forEach((m) => {
      const canon = canonizarModulo(m);
      if (canon && !mapaMods.has(canon)) {
        mapaMods.set(canon, canon);
      }
    });
    registros.forEach((r) => {
      if (r.modulo) {
        const canon = canonizarModulo(r.modulo);
        if (canon && !mapaMods.has(canon)) {
          mapaMods.set(canon, canon);
        }
      }
    });
    return Array.from(mapaMods.values()).sort();
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtroCanon =
      filtroModulo === "TODOS" ? "TODOS" : canonizarModulo(filtroModulo);

    return registros.filter((r) => {
      const modCanon = canonizarModulo(r.modulo || "");
      const coincideModulo =
        filtroCanon === "TODOS" || modCanon === filtroCanon;
      if (!coincideModulo) return false;
      if (!q) return true;
      return (
        r.ruta_acceso.toLowerCase().includes(q) ||
        quitarTildes(r.modulo).toLowerCase().includes(quitarTildes(q)) ||
        r.layout.toLowerCase().includes(q)
      );
    });
  }, [registros, busqueda, filtroModulo]);

  if (!isMounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-sm font-sans">
      {/* Encabezado */}
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
              Transacciones del Sistema
            </h1>
            <p className="text-sm text-slate-500">
              Registro y administración de rutas, módulos y layouts en{" "}
              <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                transacciones_sistema
              </code>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Mensajes */}
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

      {/* Formulario de alta / edición */}
      <form
        onSubmit={handleGuardar}
        className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase">
            <Route className="w-4 h-4 text-indigo-600" />
            {editId
              ? `Editando Transacción #${editId}`
              : "Nueva Transacción del Sistema"}
          </div>
          {editId && (
            <button
              type="button"
              onClick={limpiarFormulario}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Cancelar edición
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
              Ruta de Acceso (única)
            </label>
            <input
              type="text"
              value={rutaAcceso}
              onChange={(e) => setRutaAcceso(e.target.value)}
              placeholder="/contabilidad/certificados-retencion"
              required
              maxLength={255}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
              Módulo
            </label>
            <input
              type="text"
              list="lista-modulos-sugeridos"
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              placeholder="CONTABILIDAD"
              required
              maxLength={100}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold text-xs uppercase outline-none focus:border-indigo-500"
            />
            <datalist id="lista-modulos-sugeridos">
              {modulosDisponibles.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="md:col-span-4">
            <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
              Layout
            </label>
            <input
              type="text"
              list="lista-layouts-sugeridos"
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
              placeholder="default"
              required
              maxLength={255}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs outline-none focus:border-indigo-500"
            />
            <datalist id="lista-layouts-sugeridos">
              {LAYOUTS_SUGERIDOS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={esModuloPadre}
              onChange={(e) => setEsModuloPadre(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Es módulo padre
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={limpiarFormulario}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs border border-slate-300 cursor-pointer transition"
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              {guardando
                ? "Guardando..."
                : editId
                ? "Actualizar Transacción"
                : "Adicionar Transacción"}
            </button>
          </div>
        </div>
      </form>

      {/* Filtros y listado */}
      <div className="bg-white border rounded-xl p-4 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por ruta, módulo o layout..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 shrink-0">
              Módulo:
            </label>
            <select
              value={filtroModulo}
              onChange={(e) => setFiltroModulo(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="TODOS">Todos</option>
              {modulosDisponibles.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {cargando ? (
          <div className="p-10 text-center text-slate-500 font-semibold">
            Cargando transacciones del sistema...
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="p-10 text-center text-slate-500 italic">
            No se encontraron transacciones con los filtros actuales.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b uppercase">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Ruta de Acceso</th>
                  <th className="p-3">Módulo</th>
                  <th className="p-3">Layout</th>
                  <th className="p-3 text-center">Módulo Padre</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {registrosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-500">{item.id}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {item.ruta_acceso}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px]">
                        {canonizarModulo(item.modulo)}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      {item.layout}
                    </td>
                    <td className="p-3 text-center">
                      {item.es_modulo_padre ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Sí
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold text-[10px]">
                          No
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditar(item)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminar(item)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}