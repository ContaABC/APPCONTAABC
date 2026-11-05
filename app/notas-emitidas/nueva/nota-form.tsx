"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  obtenerFacturasParaNota,
  obtenerItemsFacturaEmitida,
  verificarNotasFactura,
  registrarNotaEmitida,
  ItemNotaInput,
} from "./actions";

interface ItemFacturaOriginal {
  item_id?: number | string | null;
  codigo_ref?: string;
  nombre: string;
  cantidadOriginal: number;
  valorUnitarioOriginal: number;
  subtotalOriginal: number;
  porcentajeIva: number;
  ivaOriginal: number;
  totalOriginal: number;
  cantidadNota: number;
  valorUnitarioNota: number;
}

interface NotaEmitidaFormProps {
  empresas: any[];
  sucursales: any[];
  clasesDocumento: any[];
  empresaIdInicial?: string;
  sucursalIdInicial?: string;
}

export default function NotaEmitidaForm({
  empresas,
  sucursales,
  clasesDocumento,
  empresaIdInicial = "",
  sucursalIdInicial = "",
}: NotaEmitidaFormProps) {
  const [isMounted, setIsMounted] = useState(false);

  const [empresaId, setEmpresaId] = useState<string>(String(empresaIdInicial || ""));
  const [sucursalId, setSucursalId] = useState<string>(String(sucursalIdInicial || ""));
  const [claseDocId, setClaseDocId] = useState<string>("");

  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string>("");
  const [facturas, setFacturas] = useState<any[]>([]);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<any | null>(null);

  const [items, setItems] = useState<ItemFacturaOriginal[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [tipoNota, setTipoNota] = useState<"CREDITO" | "DEBITO">("CREDITO");
  const [fechaEmision, setFechaEmision] = useState("");
  const [conceptoDian, setConceptoDian] = useState("1");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  
  const [notaCreadaExito, setNotaCreadaExito] = useState<{ numeroNota: string; facturaOriginal: string; tipo: string } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setFechaEmision(new Date().toISOString().split("T")[0]);
  }, []);

  const sucursalesFiltradas = useMemo(() => {
    if (!empresaId) return [];
    return sucursales.filter((s) => String(s.empresa_id) === String(empresaId));
  }, [empresaId, sucursales]);

  const clasesFiltradas = useMemo(() => {
    if (!empresaId) return [];
    return clasesDocumento.filter((c) => String(c.empresa_id) === String(empresaId));
  }, [empresaId, clasesDocumento]);

  const handleEmpresaChange = (nuevaEmpresaId: string) => {
    setEmpresaId(nuevaEmpresaId);
    setSucursalId("");
    setClaseDocId("");
    setClientes([]);
    setClienteIdSeleccionado("");
    setFacturas([]);
    setFacturaSeleccionada(null);
    setItems([]);
    setNotaCreadaExito(null);
  };

  useEffect(() => {
    if (!isMounted) return;

    async function cargarDatosDependientes() {
      if (!empresaId || !sucursalId) {
        setClientes([]);
        setClienteIdSeleccionado("");
        setFacturas([]);
        setFacturaSeleccionada(null);
        setItems([]);
        return;
      }

      const { data: terData } = await supabase
        .from("terceros")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("es_cliente", true)
        .order("razon_social", { ascending: true });

      setClientes(terData || []);
      setClienteIdSeleccionado("");
      setFacturas([]);
      setFacturaSeleccionada(null);
      setItems([]);

      const res = await obtenerFacturasParaNota(empresaId, sucursalId);
      if (res.success) {
        const facturasValidas = (res.data || []).filter(
          (f: any) =>
            String(f.estado_factura || "").toLowerCase() === "activa" &&
            Number(f.saldo_pendiente || f.total_factura || 0) > 0
        );
        setFacturas(facturasValidas);
      }
    }

    cargarDatosDependientes();
  }, [empresaId, sucursalId, isMounted]);

  const facturasFiltradasPorCliente = useMemo(() => {
    if (!clienteIdSeleccionado) return [];
    return facturas.filter((f) => String(f.cliente_id) === String(clienteIdSeleccionado));
  }, [facturas, clienteIdSeleccionado]);

  const esAnulacionTotal = tipoNota === "CREDITO" && conceptoDian === "2";

  useEffect(() => {
    async function validarAnulacionConNotas() {
      if (esAnulacionTotal && facturaSeleccionada) {
        const res = await verificarNotasFactura(facturaSeleccionada.id);
        if (res.success && res.data && res.data.length > 0) {
          setMsg({
            tipo: "error",
            texto: `La factura N° ${facturaSeleccionada.numero_factura} ya cuenta con ${res.data.length} nota(s) previa(s). No se puede realizar una anulación total directa hasta anular o limpiar las notas existentes.`,
          });
        } else {
          setMsg(null);
        }
      } else {
        setMsg(null);
      }
    }
    validarAnulacionConNotas();
  }, [esAnulacionTotal, facturaSeleccionada]);

  const handleFacturaChange = async (facturaId: string) => {
    const fact = facturas.find((f) => String(f.id) === String(facturaId)) || null;
    setFacturaSeleccionada(fact);
    setMsg(null);

    if (!fact) {
      setItems([]);
      return;
    }

    if (esAnulacionTotal) {
      const resNotas = await verificarNotasFactura(fact.id);
      if (resNotas.success && resNotas.data && resNotas.data.length > 0) {
        setMsg({
          tipo: "error",
          texto: `La factura N° ${fact.numero_factura} ya cuenta con notas previas. No se permite anulación total.`,
        });
      }
    }

    setLoadingItems(true);
    const res = await obtenerItemsFacturaEmitida(fact.id);

    if (res.success && res.data && res.data.length > 0) {
      const itemsMapeados: ItemFacturaOriginal[] = res.data.map((i: any) => {
        const cant = Number(i.cantidad) || 1;
        const vUnit = Number(i.valor_unitario) || 0;
        const sub = Number(i.subtotal) || cant * vUnit;
        const pctIva = Number(i.porcentaje_iva) || 0;
        const vIva = Number(i.valor_iva) || (sub * pctIva) / 100;

        return {
          item_id: i.item_id || null,
          codigo_ref: i.codigo_ref || "",
          nombre: i.nombre_item || "Ítem sin nombre",
          cantidadOriginal: cant,
          valorUnitarioOriginal: vUnit,
          subtotalOriginal: sub,
          porcentajeIva: pctIva,
          ivaOriginal: vIva,
          totalOriginal: sub + vIva,
          cantidadNota: esAnulacionTotal ? cant : 0,
          valorUnitarioNota: esAnulacionTotal ? vUnit : 0,
        };
      });
      setItems(itemsMapeados);
    } else {
      const sub = Number(fact.subtotal) || Number(fact.total_factura) || 0;
      const vIva = Number(fact.iva) || 0;
      setItems([
        {
          item_id: null,
          codigo_ref: "",
          nombre: `Factura Emitida N° ${fact.numero_factura}`,
          cantidadOriginal: 1,
          valorUnitarioOriginal: sub,
          subtotalOriginal: sub,
          porcentajeIva: sub > 0 ? (vIva / sub) * 100 : 0,
          ivaOriginal: vIva,
          totalOriginal: sub + vIva,
          cantidadNota: esAnulacionTotal ? 1 : 0,
          valorUnitarioNota: esAnulacionTotal ? sub : 0,
        },
      ]);
    }
    setLoadingItems(false);
  };

  useEffect(() => {
    if (items.length > 0) {
      setItems((prev) =>
        prev.map((i) => ({
          ...i,
          cantidadNota: esAnulacionTotal ? i.cantidadOriginal : i.cantidadNota,
          valorUnitarioNota: esAnulacionTotal ? i.valorUnitarioOriginal : i.valorUnitarioNota,
        }))
      );
    }
  }, [esAnulacionTotal]);

  const handleItemNotaChange = (index: number, field: "cantidadNota" | "valorUnitarioNota", val: number) => {
    if (esAnulacionTotal) return;

    const itemActual = items[index];
    let valorValidado = val < 0 ? 0 : val;

    if (field === "cantidadNota" && valorValidado > itemActual.cantidadOriginal) {
      valorValidado = itemActual.cantidadOriginal;
      setMsg({
        tipo: "error",
        texto: `La cantidad de la nota no puede superar la cantidad original (${itemActual.cantidadOriginal}) del ítem.`,
      });
    } else if (field === "valorUnitarioNota" && valorValidado > itemActual.valorUnitarioOriginal) {
      valorValidado = itemActual.valorUnitarioOriginal;
      setMsg({
        tipo: "error",
        texto: `El valor unitario de la nota no puede superar el valor unitario original ($${itemActual.valorUnitarioOriginal.toLocaleString("es-CO")}) del ítem.`,
      });
    } else {
      setMsg(null);
    }

    const nuevosItems = [...items];
    nuevosItems[index] = {
      ...nuevosItems[index],
      [field]: valorValidado,
    };
    setItems(nuevosItems);
  };

  // 🔹 Cálculos totales de la nota y de la factura original
  const totalesCalculados = useMemo(() => {
    let subtotalNota = 0;
    let ivaNota = 0;

    items.forEach((i) => {
      const subLinea = i.cantidadNota * i.valorUnitarioNota;
      const ivaLinea = (subLinea * i.porcentajeIva) / 100;
      subtotalNota += subLinea;
      ivaNota += ivaLinea;
    });

    const totalNota = subtotalNota + ivaNota;

    const subtotalOriginalFactura = facturaSeleccionada 
      ? Number(facturaSeleccionada.subtotal || facturaSeleccionada.total_factura || 0) 
      : 0;
    const ivaOriginalFactura = facturaSeleccionada 
      ? Number(facturaSeleccionada.iva || 0) 
      : 0;
    const totalOriginalFactura = facturaSeleccionada 
      ? Number(facturaSeleccionada.total_factura || 0) 
      : 0;

    return {
      subtotalNota,
      ivaNota,
      totalNota,
      subtotalOriginalFactura,
      ivaOriginalFactura,
      totalOriginalFactura,
    };
  }, [items, facturaSeleccionada]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facturaSeleccionada) return;

    setLoading(true);
    setMsg(null);
    setNotaCreadaExito(null);

    const itemsPayload: ItemNotaInput[] = items.map((i) => {
      const subNota = i.cantidadNota * i.valorUnitarioNota;
      const ivaNota = (subNota * i.porcentajeIva) / 100;
      return {
        item_id: i.item_id,
        codigo: i.codigo_ref,
        nombre: i.nombre,
        cantidad: i.cantidadNota,
        valorUnitario: i.valorUnitarioNota,
        porcentajeIva: i.porcentajeIva,
        subtotal: subNota,
        iva: ivaNota,
        total: subNota + ivaNota,
      };
    });

    const numeroFacturaOriginal = facturaSeleccionada?.numero_factura || "N/A";

    const res = await registrarNotaEmitida({
      empresa_id: Number(empresaId),
      sucursal_id: Number(sucursalId),
      clase_documento_id: Number(claseDocId),
      factura_emitida_id: facturaSeleccionada.id,
      cliente_id: Number(facturaSeleccionada.cliente_id),
      cliente_nit: facturaSeleccionada.cliente_nit,
      cliente_nombre: facturaSeleccionada.cliente_nombre,
      tipo_nota: tipoNota,
      concepto_dian: conceptoDian,
      fecha_emision: fechaEmision,
      items: itemsPayload,
    });

    setLoading(false);

    if (res.error) {
      setMsg({ tipo: "error", texto: res.error });
    } else {
      setNotaCreadaExito({
        numeroNota: res.numeroNota?? '',
        facturaOriginal: numeroFacturaOriginal,
        tipo: tipoNota,
      });

      setItems([]);
      setFacturaSeleccionada(null);
      setClienteIdSeleccionado("");
    }
  };

  if (!isMounted) return null;

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Registrar Nota a Factura Emitida</h2>
          <p className="text-xs text-slate-500">Ajuste de crédito o débito aplicado a la facturación de venta.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border">
            <span className="text-xs font-bold text-slate-600">Tipo:</span>
            <select
              value={tipoNota}
              onChange={(e) => {
                setTipoNota(e.target.value as any);
                setConceptoDian("1");
                setNotaCreadaExito(null);
              }}
              className="text-xs font-bold text-blue-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="CREDITO">NOTA CRÉDITO</option>
              <option value="DEBITO">NOTA DÉBITO</option>
            </select>
          </div>

          <Link
            href={`/notas-emitidas?empresaId=${empresaId}&sucursalId=${sucursalId}`}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition"
          >
            ← Volver a Consultas
          </Link>
        </div>
      </div>

      {notaCreadaExito && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-emerald-900 font-bold text-sm flex items-center gap-2">
              <span>✅</span> ¡Nota {notaCreadaExito.tipo} N° {notaCreadaExito.numeroNota} generada exitosamente!
            </h4>
            <p className="text-emerald-700 text-xs mt-1">
              Aplicada correctamente a la Factura N° <span className="font-semibold">{notaCreadaExito.facturaOriginal}</span>. El formulario está listo para registrar otra nota.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotaCreadaExito(null)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition shrink-0"
          >
            Cerrar aviso
          </button>
        </div>
      )}

      {msg && (
        <div
          className={`p-3 rounded-lg text-sm font-medium ${
            msg.tipo === "error"
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {msg.texto}
        </div>
      )}

      {/* Selectores principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Empresa *</label>
          <select
            value={empresaId}
            onChange={(e) => handleEmpresaChange(e.target.value)}
            required
            className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">-- Seleccione Empresa --</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.razon_social || e.nombre_comercial || e.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Sucursal *</label>
          <select
            value={sucursalId}
            onChange={(e) => {
              setSucursalId(e.target.value);
              setNotaCreadaExito(null);
            }}
            required
            disabled={!empresaId}
            className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100"
          >
            <option value="">-- Seleccione Sucursal --</option>
            {sucursalesFiltradas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre_sucursal || s.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Clase de Documento *</label>
          <select
            value={claseDocId}
            onChange={(e) => setClaseDocId(e.target.value)}
            required
            disabled={!empresaId}
            className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100"
          >
            <option value="">-- Seleccione Clase Documento --</option>
            {clasesFiltradas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo_clase ? `[${c.codigo_clase}] ` : ""}
                {c.nombre_clase || c.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Concepto DIAN, Cliente y Factura Afectada */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Concepto DIAN *</label>
          <select
            value={conceptoDian}
            onChange={(e) => setConceptoDian(e.target.value)}
            className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
          >
            {tipoNota === "CREDITO" ? (
              <>
                <option value="1">1 - Devolución parcial / total de bienes</option>
                <option value="2">2 - Anulación de factura electrónica</option>
                <option value="3">3 - Rebaja o descuento</option>
                <option value="4">4 - Ajuste de precio</option>
              </>
            ) : (
              <>
                <option value="1">1 - Intereses</option>
                <option value="2">2 - Gastos por cobrar</option>
                <option value="3">3 - Cambio del valor</option>
              </>
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Cliente *</label>
          <select
            value={clienteIdSeleccionado}
            onChange={(e) => {
              setClienteIdSeleccionado(e.target.value);
              setFacturaSeleccionada(null);
              setItems([]);
              setNotaCreadaExito(null);
            }}
            required
            disabled={!sucursalId}
            className="w-full p-2 border rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 truncate"
          >
            <option value="">-- Seleccione Cliente --</option>
            {clientes.map((cli) => (
              <option key={cli.id} value={cli.id}>
                {cli.numero_identificacion || cli.nit ? `${cli.numero_identificacion || cli.nit} - ` : ""}
                {cli.razon_social || cli.nombre_comercial}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Factura Emitida Afectada *</label>
          <select
            value={facturaSeleccionada?.id || ""}
            onChange={(e) => {
              handleFacturaChange(e.target.value);
              setNotaCreadaExito(null);
            }}
            required
            disabled={!clienteIdSeleccionado}
            className="w-full p-2 border rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100"
          >
            <option value="">
              {!clienteIdSeleccionado
                ? "-- Seleccione Cliente primero --"
                : facturasFiltradasPorCliente.length === 0
                ? "-- Sin facturas activas con saldo pendiente --"
                : "-- Seleccione Factura --"}
            </option>
            {facturasFiltradasPorCliente.map((f) => (
              <option key={f.id} value={f.id}>
                N° {f.numero_factura} (Saldo: ${Number(f.saldo_pendiente ?? f.total_factura).toLocaleString("es-CO")})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ítems Facturados y Totales */}
      {facturaSeleccionada && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Detalle de Factura N° {facturaSeleccionada.numero_factura} y Valores de Ajuste
              </h3>
              {esAnulacionTotal && (
                <span className="text-xs text-amber-600 font-semibold">
                  ⚠️ Anulación Activa: Los valores de la nota están bloqueados al 100% de la factura original.
                </span>
              )}
            </div>
          </div>

          {loadingItems ? (
            <div className="p-8 text-center text-slate-500 text-xs">Cargando detalle de ítems...</div>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3 border-r">Ítem / Descripción</th>
                    <th className="p-3 text-center border-r bg-slate-200/60 w-20">Cant. Orig.</th>
                    <th className="p-3 text-right border-r bg-slate-200/60 w-24">V. Unit. Orig.</th>
                    <th className="p-3 text-right border-r bg-slate-200/60 w-16">IVA %</th>
                    <th className="p-3 text-right border-r bg-slate-200/60 w-24">V. IVA Orig.</th>
                    <th className="p-3 text-center border-r w-20 text-blue-700">Cant. Nota</th>
                    <th className="p-3 text-right border-r w-28 text-blue-700">V. Unit. Nota</th>
                    <th className="p-3 text-right w-28 font-bold">Total Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, idx) => {
                    const subtotalLineaNota = item.cantidadNota * item.valorUnitarioNota;
                    const ivaLineaNota = (subtotalLineaNota * item.porcentajeIva) / 100;
                    const totalLineaNota = subtotalLineaNota + ivaLineaNota;

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="p-3 border-r font-medium text-slate-800">
                          {item.nombre}
                          {item.codigo_ref && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              Ref: {item.codigo_ref}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center border-r bg-slate-50 font-mono text-slate-600">
                          {item.cantidadOriginal}
                        </td>
                        <td className="p-3 text-right border-r bg-slate-50 font-mono text-slate-600">
                          ${item.valorUnitarioOriginal.toLocaleString("es-CO")}
                        </td>
                        <td className="p-3 text-right border-r bg-slate-50 font-mono text-slate-600">
                          {item.porcentajeIva}%
                        </td>
                        <td className="p-3 text-right border-r bg-slate-50 font-mono text-slate-600">
                          ${item.ivaOriginal.toLocaleString("es-CO")}
                        </td>
                        <td className="p-2 border-r bg-blue-50/20">
                          <input
                            type="number"
                            min="0"
                            max={item.cantidadOriginal}
                            step="0.01"
                            disabled={esAnulacionTotal}
                            value={item.cantidadNota}
                            onChange={(e) => handleItemNotaChange(idx, "cantidadNota", Number(e.target.value))}
                            className="w-full p-1.5 border rounded text-center font-mono font-bold text-blue-900 bg-white disabled:bg-slate-100"
                          />
                        </td>
                        <td className="p-2 border-r bg-blue-50/20">
                          <input
                            type="number"
                            min="0"
                            max={item.valorUnitarioOriginal}
                            step="0.01"
                            disabled={esAnulacionTotal}
                            value={item.valorUnitarioNota}
                            onChange={(e) => handleItemNotaChange(idx, "valorUnitarioNota", Number(e.target.value))}
                            className="w-full p-1.5 border rounded text-right font-mono font-bold text-blue-900 bg-white disabled:bg-slate-100"
                          />
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          ${totalLineaNota.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 🔹 SECCIÓN DE TOTALES DE LA FACTURA ORIGINAL Y DE LA NOTA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Totales Factura Original */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Totales Factura Original (N° {facturaSeleccionada.numero_factura})
              </h4>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal Original:</span>
                <span className="font-mono">${totalesCalculados.subtotalOriginalFactura.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>IVA Original:</span>
                <span className="font-mono">${totalesCalculados.ivaOriginalFactura.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-800 border-t pt-1">
                <span>Total Factura:</span>
                <span className="font-mono">${totalesCalculados.totalOriginalFactura.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Totales de la Nota */}
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
              <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                Totales de la Nota {tipoNota}
              </h4>
              <div className="flex justify-between text-xs text-slate-700">
                <span>Subtotal Nota:</span>
                <span className="font-mono">${totalesCalculados.subtotalNota.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-700">
                <span>IVA Nota:</span>
                <span className="font-mono">${totalesCalculados.ivaNota.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-blue-900 border-t border-blue-200 pt-1">
                <span>Total Nota:</span>
                <span className="font-mono">${totalesCalculados.totalNota.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={loading || !facturaSeleccionada || items.length === 0 || (msg?.tipo === "error" && msg.texto.includes("cuenta con"))}
          className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Procesando Nota..." : `Generar Nota ${tipoNota}`}
        </button>
      </div>
    </form>
  );
}