'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { registrarFacturaEmitida } from './actions';
import { supabase } from '@/lib/supabaseClient';
import { validarPeriodoContable } from "@/lib/accounting-validations";

interface ItemSeleccionado {
  id: string;
  item_id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  valorUnitario: number;
  porcentajeIva: number;
  subtotal: number;
  iva: number;
  total: number;
}

export default function EmitirFacturaPage() {
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);

  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [clasesDoc, setClasesDoc] = useState<any[]>([]);
  const [tercerosClientes, setTercerosClientes] = useState<any[]>([]);
  const [catalogoItems, setCatalogoItems] = useState<any[]>([]);

  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [sucursalId, setSucursalId] = useState<number | ''>('');
  const [claseDocId, setClaseDocId] = useState<number | ''>('');
  const [cliente, setCliente] = useState<any>(null);

  const [fechaEmision, setFechaEmision] = useState<string>('');
  const [fechaVencimiento, setFechaVencimiento] = useState<string>('');
  const [fechaContable, setFechaContable] = useState<string>('');

  // Estados para Control de Periodo Contable
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);
  
  const [itemsDetalle, setItemsDetalle] = useState<ItemSeleccionado[]>([]);

  // Estados para autocompletado de ítems activos por fila
  const [busquedaItems, setBusquedaItems] = useState<{ [key: string]: string }>({});
  const [filaActivaMenu, setFilaActivaMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [pdfUrlGenerada, setPdfUrlGenerada] = useState<string | null>(null);

  const limpiarMensaje = () => {
    if (mensaje) setMensaje(null);
  };

  // Manejar clics fuera del menú desplegable del autocompletado para cerrarlo
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setFilaActivaMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const verificarPeriodo = async (fecha: string) => {
    if (!empresaId || !sucursalId || !fecha) {
      setErrorPeriodo(null);
      return;
    }

    setValidandoPeriodo(true);
    setErrorPeriodo(null);

    const res = await validarPeriodoContable(String(empresaId), String(sucursalId), fecha);
    if (!res.valido) {
      setErrorPeriodo(res.mensaje || "Periodo no habilitado para transacciones.");
    }

    setValidandoPeriodo(false);
  };

  useEffect(() => {
    if (empresaId && sucursalId && fechaContable) {
      verificarPeriodo(fechaContable);
    }
  }, [empresaId, sucursalId]);

  useEffect(() => {
    setIsMounted(true);
    const hoyDate = new Date();
    const hoyStr = hoyDate.toISOString().split('T')[0];

    const vencimientoDate = new Date();
    vencimientoDate.setDate(hoyDate.getDate() + 30);
    const vencimientoStr = vencimientoDate.toISOString().split('T')[0];

    setFechaEmision(hoyStr);
    setFechaVencimiento(vencimientoStr);
    setFechaContable(hoyStr);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    async function cargarCatalogos() {
      const { data: empData } = await supabase
        .from('empresas')
        .select('*')
        .order('razon_social', { ascending: true });
      if (empData) setEmpresas(empData);
    }

    cargarCatalogos();
  }, [isMounted]);

  useEffect(() => {
    setSucursalId('');
    setClaseDocId('');
    setCliente(null);
    setItemsDetalle([]);
    setBusquedaItems({});

    if (!empresaId) {
      setSucursales([]);
      setClasesDoc([]);
      setTercerosClientes([]);
      setCatalogoItems([]);
      return;
    }

    async function cargarDatosDependientes() {
      const { data: sucData } = await supabase
        .from('sucursales')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('codigo_sucursal', { ascending: true });
      if (sucData) setSucursales(sucData);

      const { data: docData } = await supabase
        .from('clases_documento')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('codigo_clase', { ascending: true });
      if (docData) setClasesDoc(docData);

      const { data: terData } = await supabase
        .from('terceros')
        .select('*')
        .eq('empresa_id', empresaId)
        .or('es_cliente.eq.true,es_cliente.eq.TRUE')
        .order('razon_social', { ascending: true });
      if (terData) setTercerosClientes(terData);

      const { data: itemData } = await supabase
        .from('items_facturacion')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('estado', true)
        .order('nombre', { ascending: true });

      if (itemData && itemData.length > 0) {
        setCatalogoItems(itemData);
      } else {
        const { data: fallbackItems } = await supabase
          .from('items_facturacion')
          .select('*')
          .eq('empresa_id', empresaId)
          .limit(100);
        setCatalogoItems(fallbackItems || []);
      }
    }

    cargarDatosDependientes();
  }, [empresaId]);

  const agregarFilaItem = () => {
    limpiarMensaje();
    const nuevaId = Date.now().toString();
    setItemsDetalle((prev) => [
      ...prev,
      {
        id: nuevaId,
        item_id: '',
        codigo: '',
        nombre: '',
        cantidad: 1,
        valorUnitario: 0,
        porcentajeIva: 19,
        subtotal: 0,
        iva: 0,
        total: 0,
      },
    ]);
  };

  const seleccionarItemCatalogo = (filaId: string, itemCatalog: any) => {
    limpiarMensaje();
    setFilaActivaMenu(null);

    setBusquedaItems((prev) => ({
      ...prev,
      [filaId]: `${itemCatalog.codigo ? `[${itemCatalog.codigo}] ` : ''}${itemCatalog.nombre || itemCatalog.descripcion || ''}`
    }));

    setItemsDetalle((prev) =>
      prev.map((fila) => {
        if (fila.id !== filaId) return fila;

        const vUnit = Number(itemCatalog.precio_venta || itemCatalog.valor_unitario || 0);
        const pctIva = Number(itemCatalog.porcentaje_iva ?? 19);
        const cant = fila.cantidad || 1;

        const sub = cant * vUnit;
        const valorIva = sub * (pctIva / 100);

        return {
          ...fila,
          item_id: String(itemCatalog.id),
          codigo: itemCatalog.codigo || '',
          nombre: itemCatalog.nombre || itemCatalog.descripcion || '',
          valorUnitario: vUnit,
          porcentajeIva: pctIva,
          subtotal: sub,
          iva: valorIva,
          total: sub + valorIva,
        };
      })
    );
  };

  const actualizarFila = (filaId: string, campo: keyof ItemSeleccionado, valor: any) => {
    limpiarMensaje();
    setItemsDetalle((prev) =>
      prev.map((fila) => {
        if (fila.id !== filaId) return fila;

        const valNum = valor === '' ? 0 : Number(valor);
        const updated = {
          ...fila,
          [campo]:
            campo === 'cantidad' || campo === 'valorUnitario' || campo === 'porcentajeIva'
              ? valNum
              : valor,
        };

        const cant = Number(updated.cantidad) || 0;
        const vUnit = Number(updated.valorUnitario) || 0;
        const pctIva = Number(updated.porcentajeIva) || 0;

        const sub = cant * vUnit;
        const valorIva = sub * (pctIva / 100);

        return {
          ...updated,
          subtotal: sub,
          iva: valorIva,
          total: sub + valorIva,
        };
      })
    );
  };

  const eliminarFila = (filaId: string) => {
    limpiarMensaje();
    setItemsDetalle((prev) => prev.filter((f) => f.id !== filaId));
    setBusquedaItems((prev) => {
      const copy = { ...prev };
      delete copy[filaId];
      return copy;
    });
  };

  const subtotalGeneral = itemsDetalle.reduce((acc, i) => acc + i.subtotal, 0);
  const ivaGeneral = itemsDetalle.reduce((acc, i) => acc + i.iva, 0);
  const totalFactura = subtotalGeneral + ivaGeneral;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (errorPeriodo) {
      setMensaje({
        tipo: 'error',
        texto: 'No se puede emitir la factura porque el periodo contable no es válido o está cerrado.',
      });
      return;
    }

    if (!empresaId || !sucursalId || !claseDocId || !cliente) {
      setMensaje({
        tipo: 'error',
        texto: 'Por favor complete todos los campos obligatorios del encabezado (Empresa, Sucursal, Tipo de Documento y Cliente).',
      });
      return;
    }

    if (itemsDetalle.length === 0 || subtotalGeneral <= 0) {
      setMensaje({
        tipo: 'error',
        texto: 'Debe agregar al menos un ítem a la factura con valor superior a cero.',
      });
      return;
    }

    setCargando(true);

    const itemsFormatted = itemsDetalle
      .filter((item) => item.item_id !== '')
      .map((item) => ({
        id: item.id,
        item_id: String(item.item_id),
        codigo: item.codigo,
        nombre: item.nombre,
        cantidad: Number(item.cantidad),
        valorUnitario: Number(item.valorUnitario),
        porcentajeIva: Number(item.porcentajeIva),
        subtotal: Number(item.subtotal),
        iva: Number(item.iva),
        total: Number(item.total),
      }));

    const res = await registrarFacturaEmitida({
      empresa_id: Number(empresaId),
      sucursal_id: Number(sucursalId),
      clase_documento_id: Number(claseDocId),
      cliente_id: String(cliente.id),
      cliente_nit: cliente.nit || cliente.numero_identificacion || '',
      cliente_nombre: cliente.razon_social || 'Cliente General',
      cliente_email: cliente.email || '',
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      fecha_contable: fechaContable,
      subtotal: subtotalGeneral,
      descuentos: 0,
      iva: ivaGeneral,
      otros_impuestos: 0,
      total_factura: totalFactura,
      prefijo: '',
      tipo_documento: 'FACTURA',
      moneda: 'COP',
      items: itemsFormatted,
    });

    setCargando(false);

    if (res.success) {
      setMensaje({
        tipo: 'ok',
        texto: `¡Factura ${res.numeroFactura} registrada exitosamente! Documento Contable N°: ${res.numeroDocumentoContable}.`,
        });

      // --- ABRIR / DESCARGAR PDF AUTOMÁTICAMENTE ---
      if (res.pdfUrl) {
        setPdfUrlGenerada(res.pdfUrl);
      }
{mensaje && (
        <div
          className={`p-4 mb-6 rounded-lg text-sm font-medium flex flex-col gap-2 ${
            mensaje.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{mensaje.texto}</span>

          {/* Botón directo que el navegador Nombrará como seguro para abrir */}
          {pdfUrlGenerada && mensaje.tipo === 'ok' && (
            <div>
              <a
                href={pdfUrlGenerada}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-bold rounded shadow text-xs transition-colors"
              >
                📄 Ver / Descargar PDF de la Factura
              </a>
            </div>
          )}
        </div>
      )}
      // Limpiar formulario
      setItemsDetalle([]);
      setBusquedaItems({});
      setCliente(null);
    } else {
      setMensaje({
        tipo: 'error',
        texto: `Error al registrar: ${res.error}`,
      });
    }
  };

  if (!isMounted) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-md border border-gray-100 my-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
          <div className="h-40 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-md border border-gray-100 my-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Emitir Nueva Factura de Venta
      </h1>

      {mensaje && (
        <div
          className={`p-4 mb-6 rounded-lg text-sm font-medium ${
            mensaje.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Empresa *
            </label>
            <select
              required
              value={empresaId}
              onChange={(e) => {
                limpiarMensaje();
                setEmpresaId(e.target.value ? Number(e.target.value) : '');
              }}
              className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccione Empresa...</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.razon_social || emp.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Sucursal *
            </label>
            <select
              required
              disabled={!empresaId}
              value={sucursalId}
              onChange={(e) => {
                limpiarMensaje();
                setSucursalId(e.target.value ? Number(e.target.value) : '');
              }}
              className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Seleccione Sucursal...</option>
              {sucursales.map((suc) => (
                <option key={suc.id} value={suc.id}>
                  {suc.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Tipo Documento *
            </label>
            <select
              required
              disabled={!empresaId}
              value={claseDocId}
              onChange={(e) => {
                limpiarMensaje();
                setClaseDocId(e.target.value ? Number(e.target.value) : '');
              }}
              className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">
                {!empresaId
                  ? 'Seleccione Empresa primero'
                  : clasesDoc.length === 0
                  ? 'No hay tipos de documento para esta empresa'
                  : 'Seleccione Tipo...'}
              </option>
              {clasesDoc.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo_clase ? `[${c.codigo_clase}] ` : ''}
                  {c.nombre_clase || c.descripcion || c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Cliente (Tercero) *
            </label>
            <select
              required
              disabled={!empresaId}
              value={cliente?.id || ''}
              onChange={(e) => {
                limpiarMensaje();
                const sel = tercerosClientes.find((t) => String(t.id) === String(e.target.value));
                setCliente(sel || null);
              }}
              className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">
                {!empresaId
                  ? 'Seleccione Empresa primero'
                  : tercerosClientes.length === 0
                  ? 'No hay clientes registrados'
                  : 'Seleccione Cliente...'}
              </option>
              {tercerosClientes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.razon_social}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              F. Emisión
            </label>
            <input
              type="date"
              value={fechaEmision}
              onChange={(e) => {
                limpiarMensaje();
                setFechaEmision(e.target.value);
              }}
              className="w-full text-xs p-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              F. Vencimiento
            </label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => {
                limpiarMensaje();
                setFechaVencimiento(e.target.value);
              }}
              className="w-full text-xs p-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              F. Contable *
            </label>
            <input
              type="date"
              value={fechaContable}
              onChange={(e) => {
                limpiarMensaje();
                const nuevaFecha = e.target.value;
                setFechaContable(nuevaFecha);
                if (errorPeriodo) setErrorPeriodo(null);
              }}
              onBlur={() => verificarPeriodo(fechaContable)}
              className="w-full text-xs p-2 border border-gray-300 rounded-md"
              required
            />
            {validandoPeriodo && (
              <p className="text-[10px] text-blue-500 mt-1 animate-pulse">Verificando periodo...</p>
            )}
            {errorPeriodo && (
              <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1.5 rounded mt-1">
                ⚠️ {errorPeriodo}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Ítems / Servicios a Facturar
            </h2>
            <button
              type="button"
              onClick={agregarFilaItem}
              disabled={!empresaId}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition-colors disabled:bg-gray-300"
            >
              + Agregar Ítem
            </button>
          </div>

          {/* QUITAMOS EL OVERFLOW-X-AUTO DEL CONTENEDOR PRINCIPAL O LO MANEJAMOS VISIBLE */}
          <div className="relative">
            <table className="w-full text-left text-xs text-gray-600 border-collapse">
              <thead className="bg-gray-100 text-gray-700 uppercase font-semibold">
                <tr>
                  <th className="p-2 w-1/3">Ítem / Producto (Búsqueda predictiva)</th>
                  <th className="p-2 w-20 text-center">Cant.</th>
                  <th className="p-2 w-32 text-right">Valor Unit.</th>
                  <th className="p-2 w-24 text-center">% IVA</th>
                  <th className="p-2 w-28 text-right">Subtotal</th>
                  <th className="p-2 w-28 text-right">IVA</th>
                  <th className="p-2 w-32 text-right">Total</th>
                  <th className="p-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {itemsDetalle.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-gray-400">
                      Haga clic en "+ Agregar Ítem" para buscar y seleccionar productos o servicios.
                    </td>
                  </tr>
                ) : (
                  itemsDetalle.map((fila) => {
                    const textoBusqueda = busquedaItems[fila.id] ?? (fila.nombre ? `${fila.codigo ? `[${fila.codigo}] ` : ''}${fila.nombre}` : '');
                    const filtrados = catalogoItems.filter((item) => {
                      const txt = `${item.codigo || ''} ${item.nombre || ''} ${item.descripcion || ''}`.toLowerCase();
                      return txt.includes(textoBusqueda.toLowerCase());
                    });

                    return (
                      <tr key={fila.id}>
                        <td className="p-2 relative overflow-visible">
                          {/* INPUT DE BÚSQUEDA PREDICTIVA */}
                          <input
                            type="text"
                            placeholder="Escriba para buscar ítem..."
                            value={textoBusqueda}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBusquedaItems((prev) => ({ ...prev, [fila.id]: val }));
                              setFilaActivaMenu(fila.id);
                              if (!val) {
                                seleccionarItemCatalogo(fila.id, { id: '', codigo: '', nombre: '', precio_venta: 0, porcentaje_iva: 19 });
                              }
                            }}
                            onFocus={() => setFilaActivaMenu(fila.id)}
                            className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                          />

                          {/* MENÚ DESPLEGABLE FLOTANTE CON POSICIONAMIENTO ASEGURADO */}
                          {filaActivaMenu === fila.id && (
                            <div 
                              ref={menuRef} 
                              className="absolute z-50 left-2 right-2 top-full mt-1 bg-white border border-gray-300 rounded-md shadow-2xl max-h-56 overflow-y-auto"
                            >
                              {filtrados.length === 0 ? (
                                <div className="p-2 text-gray-400 text-xs italic">No se encontraron ítems</div>
                              ) : (
                                filtrados.map((item) => (
                                  <div
                                    key={item.id}
                                    onClick={() => seleccionarItemCatalogo(fila.id, item)}
                                    className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-100 flex justify-between items-center"
                                  >
                                    <span className="font-medium text-gray-800">
                                      {item.codigo ? `[${item.codigo}] ` : ''}{item.nombre || item.descripcion}
                                    </span>
                                    <span className="text-blue-600 font-mono font-bold">
                                      ${Number(item.precio_venta || item.valor_unitario || 0).toLocaleString('es-CO')}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={fila.cantidad}
                            onChange={(e) => actualizarFila(fila.id, 'cantidad', e.target.value)}
                            className="w-full p-1.5 border border-gray-300 rounded text-xs text-center"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={fila.valorUnitario}
                            onChange={(e) => actualizarFila(fila.id, 'valorUnitario', e.target.value)}
                            className="w-full p-1.5 border border-gray-300 rounded text-xs text-right font-medium"
                          />
                        </td>

                        <td className="p-2">
                          <select
                            value={fila.porcentajeIva}
                            onChange={(e) => actualizarFila(fila.id, 'porcentajeIva', e.target.value)}
                            className="w-full p-1.5 border border-gray-300 rounded text-xs text-center"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={19}>19%</option>
                          </select>
                        </td>

                        <td className="p-2 text-right font-medium text-gray-700">
                          ${fila.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-2 text-right text-gray-500">
                          ${fila.iva.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-2 text-right font-semibold text-gray-900">
                          ${fila.total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => eliminarFila(fila.id)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RESUMEN DE TOTALES (SIN RETENCIONES) */}
        <div className="flex justify-end p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-full md:w-1/2 bg-blue-50 p-4 rounded-lg flex flex-col space-y-1.5 border border-blue-100">
            <div className="flex justify-between text-xs text-gray-700">
              <span>Subtotal:</span>
              <span className="font-semibold">
                ${subtotalGeneral.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-700">
              <span>IVA Total:</span>
              <span className="font-semibold">
                ${ivaGeneral.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-blue-950 pt-2 border-t border-blue-200">
              <span>TOTAL A COBRAR:</span>
              <span>
                ${totalFactura.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={cargando || Boolean(errorPeriodo)}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {cargando ? 'Procesando...' : 'Guardar y Emitir Factura'}
          </button>
        </div>
      </form>
    </div>
  );
}
