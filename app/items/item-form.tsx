"use client";

import React, { useState, useEffect } from "react";
import {
  obtenerSucursales,
  obtenerItemsPorEmpresaYSucursal,
  guardarItemFacturacion,
  cambiarEstadoItemFacturacion,
  eliminarItemFacturacion,
} from "./actions";

export interface Empresa {
  id: number | string;
  razon_social: string;
}

export interface Sucursal {
  id: number | string;
  empresa_id: number | string;
  nombre_sucursal?: string;
  codigo_sucursal?: string;
  nombre?: string;
}

export interface ItemFacturacion {
  id: number | string;
  empresa_id: number | string;
  sucursal_id: number | string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  precio_venta: number;
  porcentaje_iva: number;
  aplica_descuento: boolean;
  porcentaje_descuento_max: number;
  estado: boolean;
}

interface ItemFormProps {
  empresasIniciales: Empresa[];
}

const INITIAL_FORM = {
  id: "",
  codigo: "",
  nombre: "",
  descripcion: "",
  precio_venta: "",
  porcentaje_iva: "19",
  aplica_descuento: false,
  porcentaje_descuento_max: "0",
};

export default function ItemForm({ empresasIniciales }: ItemFormProps) {
  // Evitar error de Hidratación en Next.js
  const [isMounted, setIsMounted] = useState(false);

  // Filtros contextuales
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [items, setItems] = useState<ItemFacturacion[]>([]);

  // Estados UI y Subformulario
  const [loading, setLoading] = useState(false);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulario de ítem
  const [formData, setFormData] = useState(INITIAL_FORM);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Cargar sucursales cuando cambia Empresa
  useEffect(() => {
    if (!isMounted) return;

    async function cargarSucursales() {
      setSucursalId("");
      setItems([]);
      if (!empresaId) {
        setSucursales([]);
        return;
      }
      const res = await obtenerSucursales(empresaId);
      if (res.success) {
        setSucursales(res.data);
      } else {
        setSucursales([]);
      }
    }

    cargarSucursales();
  }, [empresaId, isMounted]);

  // 2. Cargar ítems cuando cambia Empresa y Sucursal
  useEffect(() => {
    if (!isMounted) return;

    if (empresaId && sucursalId) {
      cargarItems();
    } else {
      setItems([]);
    }
  }, [empresaId, sucursalId, isMounted]);

  async function cargarItems() {
    if (!empresaId || !sucursalId) return;
    setLoadingTabla(true);
    const res = await obtenerItemsPorEmpresaYSucursal(empresaId, sucursalId);
    if (res.success) {
      setItems(res.data);
    } else {
      setErrorMsg(res.error);
    }
    setLoadingTabla(false);
  }

  const abrirModalNuevo = () => {
    setFormData(INITIAL_FORM);
    setErrorMsg(null);
    setSuccessMsg(null);
    setMostrarModal(true);
  };

  const abrirModalEditar = (item: ItemFacturacion) => {
    setFormData({
      id: String(item.id),
      codigo: item.codigo || "",
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      precio_venta: String(item.precio_venta ?? 0),
      porcentaje_iva: String(item.porcentaje_iva ?? 19),
      aplica_descuento: !!item.aplica_descuento,
      porcentaje_descuento_max: String(item.porcentaje_descuento_max ?? 0),
    });
    setErrorMsg(null);
    setSuccessMsg(null);
    setMostrarModal(true);
  };

  const handleInactivarToggle = async (item: ItemFacturacion) => {
    const nuevoEstado = !item.estado;
    const confirmacion = confirm(
      `¿Desea ${nuevoEstado ? "activar" : "inactivar"} el ítem "${item.nombre}"?`
    );
    if (!confirmacion) return;

    const res = await cambiarEstadoItemFacturacion(item.id, nuevoEstado);
    if (res.error) {
      alert(res.error);
    } else {
      await cargarItems();
    }
  };

  const handleEliminarItem = async (item: ItemFacturacion) => {
    if (!confirm(`¿Está seguro de eliminar el ítem "${item.nombre}"?`)) return;

    const res = await eliminarItemFacturacion(item.id);
    if (res.error) {
      alert(res.error);
    } else {
      await cargarItems();
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
        ...(name === "aplica_descuento" && !checked
          ? { porcentaje_descuento_max: "0" }
          : {}),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await guardarItemFacturacion({
      id: formData.id || undefined,
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      codigo: formData.codigo,
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      porcentaje_iva: parseFloat(formData.porcentaje_iva) || 0,
      aplica_descuento: formData.aplica_descuento,
      porcentaje_descuento_max: parseFloat(formData.porcentaje_descuento_max) || 0,
      estado: true, // Se obliga a guardar como activo
    });

    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(
        formData.id
          ? "Ítem actualizado correctamente."
          : "Ítem creado exitosamente."
      );
      setTimeout(() => {
        setMostrarModal(false);
        cargarItems();
      }, 1000);
    }
  };

  if (!isMounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        <div className="h-20 bg-gray-100 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. SELECCIÓN SUPERIOR: Empresa y Sucursal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Empresa *
          </label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Seleccione Empresa --</option>
            {empresasIniciales.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Sucursal *
          </label>
          <select
            value={sucursalId}
            disabled={!empresaId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          >
            <option value="">
              {empresaId
                ? "-- Seleccione Sucursal --"
                : "-- Primero seleccione Empresa --"}
            </option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.nombre_sucursal || suc.nombre || `Sucursal ${suc.id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. TABLA Y ACCIONES */}
      {empresaId && sucursalId && (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm space-y-4 p-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Ítems de Facturación Registrados
              </h2>
              <p className="text-xs text-slate-500">
                Catálogo de servicios y productos parametrizados para la sucursal.
              </p>
            </div>
            <button
              type="button"
              onClick={abrirModalNuevo}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition"
            >
              + Crear Nuevo Ítem
            </button>
          </div>

          {loadingTabla ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Cargando catálogo...
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No hay ítems parametrizados para esta empresa y sucursal.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b">
                  <tr>
                    <th className="p-3">Código / Ref.</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3 text-right">Precio Venta</th>
                    <th className="p-3 text-center">% IVA</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center w-28">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-semibold text-slate-900">
                        {item.codigo}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {item.nombre}
                      </td>
                      <td className="p-3 text-slate-500 italic max-w-xs truncate">
                        {item.descripcion || "-"}
                      </td>
                      <td className="p-3 text-right font-mono font-medium">
                        ${Number(item.precio_venta).toLocaleString("es-CO")}
                      </td>
                      <td className="p-3 text-center">{item.porcentaje_iva}%</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                            item.estado
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {item.estado ? "ACTIVO" : "INACTIVO"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Modificar */}
                          <button
                            onClick={() => abrirModalEditar(item)}
                            title="Modificar"
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            ✏️
                          </button>
                          {/* Inactivar / Activar */}
                          <button
                            onClick={() => handleInactivarToggle(item)}
                            title={item.estado ? "Inactivar" : "Activar"}
                            className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                          >
                            {item.estado ? "🚫" : "✅"}
                          </button>
                          {/* Eliminar */}
                          <button
                            onClick={() => handleEliminarItem(item)}
                            title="Eliminar"
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. SUBFORMULARIO MODAL */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                {formData.id ? "Modificar Ítem" : "Crear Nuevo Ítem"}
              </h3>
              <button
                onClick={() => setMostrarModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded border border-rose-200">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 text-sm text-emerald-600 bg-emerald-50 rounded border border-emerald-200">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Código / Referencia *
                  </label>
                  <input
                    type="text"
                    name="codigo"
                    required
                    value={formData.codigo}
                    onChange={handleChange}
                    placeholder="Ej: SERV-001"
                    className="w-full text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Precio de Venta *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="precio_venta"
                    required
                    value={formData.precio_venta}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre / Ítem *
                </label>
                <input
                  type="text"
                  name="nombre"
                  required
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Mantenimiento Preventivo"
                  className="w-full text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  name="descripcion"
                  rows={2}
                  value={formData.descripcion}
                  onChange={handleChange}
                  placeholder="Añada detalles o especificaciones adicionales del producto o servicio..."
                  className="w-full text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Porcentaje IVA (%)
                  </label>
                  <select
                    name="porcentaje_iva"
                    value={formData.porcentaje_iva}
                    onChange={handleChange}
                    className="w-full text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">0% (Exento / Excluido)</option>
                    <option value="5">5%</option>
                    <option value="19">19% (IVA General)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="flex items-center gap-2 p-2 bg-slate-50 border rounded-md">
                    <input
                      type="checkbox"
                      id="aplica_descuento"
                      name="aplica_descuento"
                      checked={formData.aplica_descuento}
                      onChange={handleChange}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="aplica_descuento"
                      className="text-xs font-medium text-slate-700"
                    >
                      Aplica Descuento
                    </label>
                  </div>
                </div>
              </div>

              {formData.aplica_descuento && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    % Descuento Máximo
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="porcentaje_descuento_max"
                    required={formData.aplica_descuento}
                    value={formData.porcentaje_descuento_max}
                    onChange={handleChange}
                    placeholder="0 - 100"
                    className="w-full text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Guardando..." : "Guardar Ítem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}