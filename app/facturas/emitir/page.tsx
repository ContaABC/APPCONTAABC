'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { registrarFacturaEmitida } from './actions';
import { supabase } from '@/lib/supabaseClient';

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

  const [itemsDetalle, setItemsDetalle] = useState<ItemSeleccionado[]>([]);

  const [retenciones, setRetenciones] = useState<number>(0);

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Función auxiliar para limpiar el mensaje de éxito/error al interactuar
  const limpiarMensaje = () => {
    if (mensaje) setMensaje(null);
  };

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

  // Cargar únicamente empresas al montar el componente
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

  // Cargar datos dependientes (sucursales, clases de documento, clientes, ítems) filtrados por Empresa
  useEffect(() => {
    setSucursalId('');
    setClaseDocId('');
    setCliente(null);
    setItemsDetalle([]);

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

      // Clases de documento filtradas por empresa
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
    setItemsDetalle((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
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

  const seleccionarItemCatalogo = (filaId: string, itemIdStr: string) => {
    limpiarMensaje();
    const itemCatalog = catalogoItems.find((i) => String(i.id) === itemIdStr);

    setItemsDetalle((prev) =>
      prev.map((fila) => {
        if (fila.id !== filaId) return fila;

        if (!itemCatalog) {
          return {
            ...fila,
            item_id: '',
            codigo: '',
            nombre: '',
            valorUnitario: 0,
            subtotal: 0,
            iva: 0,
            total: 0,
          };
        }

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
  };

  const subtotalGeneral = itemsDetalle.reduce((acc, i) => acc + i.subtotal, 0);
  const ivaGeneral = itemsDetalle.reduce((acc, i) => acc + i.iva, 0);
  const totalFactura = subtotalGeneral + ivaGeneral - Number(retenciones);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (!empresaId || !sucursalId || !claseDocId || !cliente) {
      setMensaje({
        tipo: 'error',
        texto:
          'Por favor complete todos los campos obligatorios del encabezado (Empresa, Sucursal, Tipo de Documento y Cliente).',
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
      retenciones: Number(retenciones),
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
        texto: `Factura ${res.numeroFactura} registrada exitosamente. Documento Contable N°: ${res.numeroDocumentoContable}.`,
      });

      // --- LIMPIAR FORMULARIO PARA LA SIGUIENTE FACTURA ---
      setItemsDetalle([]); // Borra todos los ítems de la factura anterior
      setCliente(null);    // Limpia el cliente seleccionado
      setRetenciones(0);   // Restablece las retenciones
      // Opcional: si también deseas limpiar la sucursal o el tipo de documento, puedes agregarlo aquí.
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
              F. Contable
            </label>
            <input
              type="date"
              value={fechaContable}
              onChange={(e) => {
                limpiarMensaje();
                setFechaContable(e.target.value);
              }}
              className="w-full text-xs p-2 border border-gray-300 rounded-md"
            />
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-100 text-gray-700 uppercase font-semibold">
                <tr>
                  <th className="p-2 w-1/3">Ítem / Producto</th>
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
                      Haga clic en "+ Agregar Ítem" para seleccionar productos o servicios del catálogo.
                    </td>
                  </tr>
                ) : (
                  itemsDetalle.map((fila) => (
                    <tr key={fila.id}>
                      <td className="p-2">
                        <select
                          value={fila.item_id}
                          onChange={(e) => seleccionarItemCatalogo(fila.id, e.target.value)}
                          className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">
                            {catalogoItems.length === 0
                              ? 'No hay ítems parametrizados'
                              : 'Seleccionar Ítem...'}
                          </option>
                          {catalogoItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.codigo ? `[${item.codigo}] ` : ''}
                              {item.nombre || item.descripcion}
                            </option>
                          ))}
                        </select>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-full md:w-1/3 mb-4 md:mb-0">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Retenciones Aplicadas ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={retenciones}
              onChange={(e) => {
                limpiarMensaje();
                setRetenciones(Number(e.target.value));
              }}
              className="w-full text-sm p-2 border border-gray-300 rounded-md font-medium"
            />
          </div>

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
            <div className="flex justify-between text-xs text-gray-700">
              <span>Retenciones:</span>
              <span className="font-semibold text-red-600">
                -${Number(retenciones).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
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
            disabled={cargando}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {cargando ? 'Procesando...' : 'Guardar y Emitir Factura'}
          </button>
        </div>
      </form>
    </div>
  );
}