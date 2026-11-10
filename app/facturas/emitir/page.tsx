'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { registrarFacturaEmitida, procesarFacturaEmitidaXmlAdmin, FacturaXmlData, ItemXml } from './actions';
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

interface FacturaXmlStaged {
  id: string;
  nombreArchivo: string;
  contenidoXml: string;
  datos: FacturaXmlData;
  items: ItemXml[];
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

  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);
  
  const [itemsDetalle, setItemsDetalle] = useState<ItemSeleccionado[]>([]);
  const [xmlsStaged, setXmlsStaged] = useState<FacturaXmlStaged[]>([]);

  const [busquedaItems, setBusquedaItems] = useState<{ [key: string]: string }>({});
  const [filaActivaMenu, setFilaActivaMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [pdfUrlGenerada, setPdfUrlGenerada] = useState<string | null>(null);

  const limpiarMensaje = () => {
    if (mensaje) setMensaje(null);
  };

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
    setXmlsStaged([]);
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

  const formularioCompleto = Boolean(empresaId && sucursalId && claseDocId && cliente);

  // Función para procesar y previsualizar uno o varios archivos XML
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!formularioCompleto) {
      setMensaje({
        tipo: 'error',
        texto: 'Por favor seleccione primero Empresa, Sucursal, Tipo de Documento y Cliente antes de importar XMLs.',
      });
      e.target.value = '';
      return;
    }

    const empresaSeleccionada = empresas.find(emp => Number(emp.id) === Number(empresaId));
    const nitEmpresaSistema = String(empresaSeleccionada?.nit_identificacion || "").trim();
    const nitClienteSistema = String(cliente.nit || cliente.numero_identificacion || "").trim();

    limpiarMensaje();
    setCargando(true);

    const nuevasFacturasStaged: FacturaXmlStaged[] = [];
    let erroresValidacion = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const xmlText = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const numeroFactura = xmlDoc.querySelector("ID")?.textContent || 
                              xmlDoc.getElementsByTagNameNS("*", "ID")[0]?.textContent || `DOC-${i+1}`;
        
        const fechaEm = xmlDoc.querySelector("IssueDate")?.textContent || 
                        xmlDoc.getElementsByTagNameNS("*", "IssueDate")[0]?.textContent || fechaEmision;
        
        const fechaVen = xmlDoc.querySelector("DueDate")?.textContent || 
                         xmlDoc.getElementsByTagNameNS("*", "DueDate")[0]?.textContent || fechaVencimiento;

        const cufe = xmlDoc.querySelector("UUID")?.textContent || 
                     xmlDoc.getElementsByTagNameNS("*", "UUID")[0]?.textContent || undefined;

        let lineasElements: Element[] = [];
        const q1 = xmlDoc.querySelectorAll("InvoiceLine, CreditNoteLine");
        if (q1.length > 0) {
          lineasElements = Array.from(q1);
        } else {
          const q2 = xmlDoc.getElementsByTagNameNS("*", "InvoiceLine");
          if (q2.length > 0) {
            lineasElements = Array.from(q2);
          } else {
            const q3 = xmlDoc.getElementsByTagNameNS("*", "CreditNoteLine");
            if (q3.length > 0) lineasElements = Array.from(q3);
          }
        }

        const parsedItems: ItemXml[] = [];
        lineasElements.forEach((line, idx) => {
          const descNode = line.querySelector("Description") || line.getElementsByTagNameNS("*", "Description")[0];
          const nombre_item = descNode?.textContent || `Ítem ${idx + 1}`;

          const qtyNode = line.querySelector("InvoicedQuantity, CreditedQuantity") || line.getElementsByTagNameNS("*", "InvoicedQuantity")[0];
          const cantidad = Number(qtyNode?.textContent || 1);

          const subNode = line.querySelector("LineExtensionAmount") || line.getElementsByTagNameNS("*", "LineExtensionAmount")[0];
          const lineSub = Number(subNode?.textContent || 0);

          const priceNode = line.querySelector("PriceAmount") || line.getElementsByTagNameNS("*", "PriceAmount")[0];
          let valor_unitario = Number(priceNode?.textContent || 0);
          if (valor_unitario === 0 && cantidad > 0 && lineSub > 0) {
            valor_unitario = lineSub / cantidad;
          }

          const taxNode = line.querySelector("TaxAmount") || line.getElementsByTagNameNS("*", "TaxAmount")[0];
          const valor_iva = Number(taxNode?.textContent || (lineSub * 0.19));

          parsedItems.push({
            item_id: null,
            codigo_ref: "",
            nombre_item,
            cantidad,
            valor_unitario,
            subtotal: lineSub,
            porcentaje_iva: 19,
            valor_iva,
            total: lineSub + valor_iva
          });
        });

        const subtotalXml = Number(
          xmlDoc.querySelector("LegalMonetaryTotal LineExtensionAmount")?.textContent || 
          xmlDoc.getElementsByTagNameNS("*", "LineExtensionAmount")[0]?.textContent || 
          parsedItems.reduce((acc, it) => acc + it.subtotal, 0)
        );

        const ivaXml = Number(
          xmlDoc.querySelector("TaxTotal TaxAmount")?.textContent || 
          xmlDoc.getElementsByTagNameNS("*", "TaxAmount")[0]?.textContent || 
          parsedItems.reduce((acc, it) => acc + (it.valor_iva || 0), 0)
        );

        const totalXml = Number(
          xmlDoc.querySelector("LegalMonetaryTotal TaxInclusiveAmount")?.textContent || 
          xmlDoc.querySelector("LegalMonetaryTotal PayableAmount")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "TaxInclusiveAmount")[0]?.textContent || 
          xmlDoc.getElementsByTagNameNS("*", "PayableAmount")[0]?.textContent || 
          (subtotalXml + ivaXml)
        );

        const emisorNit = xmlDoc.querySelector("AccountingSupplierParty PartyTaxScheme CompanyID")?.textContent || 
                          xmlDoc.getElementsByTagNameNS("*", "CompanyID")[0]?.textContent || "";
        const emisorNombre = xmlDoc.querySelector("AccountingSupplierParty PartyLegalEntity RegistrationName")?.textContent || "EMPRESA EMISORA";

        const receptorNit = xmlDoc.querySelector("AccountingCustomerParty PartyTaxScheme CompanyID")?.textContent || 
                            xmlDoc.getElementsByTagNameNS("*", "CompanyID")[1]?.textContent || "";
        const receptorNombre = xmlDoc.querySelector("AccountingCustomerParty PartyLegalEntity RegistrationName")?.textContent || "CLIENTE RECEPTOR";

        if (nitEmpresaSistema && emisorNit && !emisorNit.includes(nitEmpresaSistema)) {
          erroresValidacion++;
          continue;
        }

        if (nitClienteSistema && receptorNit && !receptorNit.includes(nitClienteSistema)) {
          erroresValidacion++;
          continue;
        }

        nuevasFacturasStaged.push({
          id: `${Date.now()}-${i}`,
          nombreArchivo: file.name,
          contenidoXml: xmlText,
          datos: {
            numero_factura: numeroFactura,
            fecha_emision: fechaEm,
            fecha_vencimiento: fechaVen,
            fecha_contable: fechaContable || fechaEm,
            subtotal: subtotalXml,
            iva: ivaXml,
            total: totalXml,
            emisor_nit: emisorNit,
            emisor_nombre: emisorNombre,
            receptor_nit: receptorNit,
            receptor_nombre: receptorNombre,
            cufe
          },
          items: parsedItems
        });
      } catch (err) {
        console.error(`Error leyendo el archivo ${file.name}:`, err);
      }
    }

    setCargando(false);
    e.target.value = '';

    if (nuevasFacturasStaged.length > 0) {
      setXmlsStaged((prev) => [...prev, ...nuevasFacturasStaged]);
      setMensaje({ tipo: 'ok', texto: `Se previsualizaron ${nuevasFacturasStaged.length} archivo(s) XML correctamente.` });
    } else {
      setMensaje({ 
        tipo: 'error', 
        texto: erroresValidacion > 0 
          ? 'Los XMLs fueron rechazados porque el NIT del emisor o receptor no coincide con la Empresa o Cliente seleccionados.' 
          : 'No se pudieron extraer datos válidos de los archivos XML.' 
      });
    }
  };

  const eliminarXmlStaged = (id: string) => {
    setXmlsStaged((prev) => prev.filter(x => x.id !== id));
  };

  const confirmarYRegistrarLote = async () => {
    if (xmlsStaged.length === 0) return;

    if (errorPeriodo) {
      setMensaje({
        tipo: 'error',
        texto: 'No se puede registrar el lote porque el periodo contable no es válido o está cerrado.',
      });
      return;
    }

    setCargando(true);
    limpiarMensaje();

    let exitosos = 0;
    let errores = 0;
    let ultimoPdf: string | null = null;

    for (const staged of xmlsStaged) {
      const datosAProcesar = {
        ...staged.datos,
        fecha_contable: fechaContable || staged.datos.fecha_emision,
        fecha_vencimiento: fechaVencimiento || staged.datos.fecha_vencimiento,
        fecha_emision: fechaEmision || staged.datos.fecha_emision
      };

      const res = await procesarFacturaEmitidaXmlAdmin(
        datosAProcesar,
        String(empresaId),
        String(sucursalId),
        String(claseDocId),
        staged.contenidoXml
      );

      if (res.success) {
        exitosos++;
        if (res.pdfUrl) ultimoPdf = res.pdfUrl;
      } else {
        errores++;
        console.error(`Error en factura ${staged.datos.numero_factura}:`, res.error);
      }
    }

    setCargando(false);

    if (errores === 0) {
      setMensaje({
        tipo: 'ok',
        texto: `¡Lote procesado con éxito! Se registraron ${exitosos} factura(s) XML correctamente en contabilidad.`,
      });
      setXmlsStaged([]);
      if (ultimoPdf) setPdfUrlGenerada(ultimoPdf);
    } else {
      setMensaje({
        tipo: 'error',
        texto: `Proceso finalizado con advertencias: ${exitosos} exitosas, ${errores} con errores. Verifique consola.`,
      });
    }
  };

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
    setPdfUrlGenerada(null);

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
        texto: 'Por favor complete todos los campos obligatorios del encabezado.',
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
      .filter((item) => item.item_id !== '' || item.nombre !== '')
      .map((item) => ({
        id: item.id,
        item_id: String(item.item_id || ''),
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
        texto: `¡Factura manual ${res.numeroFactura} registrada exitosamente! Documento Contable N°: ${res.numeroDocumentoContable}.`,
      });

      if (res.pdfUrl) {
        setPdfUrlGenerada(res.pdfUrl);
      }

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
      <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow-md border border-gray-100 my-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
          <div className="h-40 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-white rounded-xl shadow-md border border-gray-100 my-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Emitir o Importar Factura de Venta (XML / Manual)
        </h1>

        {/* BOTÓN / INPUT PARA SUBIR XML (BLOQUEADO HASTA COMPLETAR ENCABEZADO) */}
        <div className="flex items-center gap-2">
          <label className={`inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-xs rounded-lg transition shadow-sm ${
            formularioCompleto 
              ? 'cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow' 
              : 'cursor-not-allowed bg-gray-300 text-gray-500 opacity-60'
          }`}>
            <span>📁 Importar XML (Uno o Varios)</span>
            <input 
              type="file" 
              accept=".xml" 
              multiple 
              disabled={!formularioCompleto}
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {!formularioCompleto && (
        <div className="p-3 mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg font-medium">
          ⚠️ Por favor seleccione primero <strong>Empresa, Sucursal, Tipo de Documento y Cliente</strong> para habilitar la carga de archivos XML.
        </div>
      )}

      {mensaje && (
        <div
          className={`p-4 mb-6 rounded-lg text-sm font-medium flex flex-col gap-2 ${
            mensaje.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{mensaje.texto}</span>

          {pdfUrlGenerada && mensaje.tipo === 'ok' && (
            <div>
              <a
                href={pdfUrlGenerada}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-bold rounded shadow text-xs transition-colors"
              >
                📄 Ver / Descargar PDF del Comprobante
              </a>
            </div>
          )}
        </div>
      )}

      {/* ENCABEZADO DE CONFIGURACIÓN (SIEMPRE ARRIBA) */}
      <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Empresa *
            </label>
            <select
              required
              value={empresaId}
              onChange={(e) => {
                limpiarMensaje();
                setEmpresaId(e.target.value ? Number(e.target.value) : '');
              }}
              className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">
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
              className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white"
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">
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
              className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white"
            >
              <option value="">
                {!empresaId ? 'Seleccione Empresa...' : 'Seleccione Tipo...'}
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

        {/* CLIENTE Y FECHAS DE CONTROL */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2 border-t border-gray-200">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Cliente (Tercero Receptor) *
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
              className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white"
            >
              <option value="">Seleccione Cliente...</option>
              {tercerosClientes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.razon_social} ({t.numero_identificacion || t.nit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              F. Emisión General
            </label>
            <input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
              className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              F. Vencimiento General
            </label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
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
              className="w-full text-sm p-2 border border-gray-300 rounded-md bg-white"
              required
            />
            {validandoPeriodo && (
              <p className="text-xs text-blue-500 mt-1 animate-pulse">Verificando...</p>
            )}
            {errorPeriodo && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1.5 rounded mt-1">
                ⚠️ {errorPeriodo}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* TABLA DE PREVISUALIZACIÓN DE XMLs STAGED (LOTE) */}
      {xmlsStaged.length > 0 && (
        <div className="mb-6 p-4 bg-indigo-50/60 rounded-lg border border-indigo-200 space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
              📋 Previsualización de Facturas XML Verificadas ({xmlsStaged.length})
            </h2>
            <button
              type="button"
              onClick={confirmarYRegistrarLote}
              disabled={cargando || Boolean(errorPeriodo)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-md transition disabled:bg-gray-400"
            >
              {cargando ? 'Registrando en Sistema...' : 'Confirmar y Registrar Lote en Sistema'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 border-collapse bg-white rounded-md shadow-sm">
              <thead className="bg-indigo-100 text-indigo-900 uppercase font-semibold">
                <tr>
                  <th className="p-2.5">Archivo XML</th>
                  <th className="p-2.5">N° Factura</th>
                  <th className="p-2.5">Emisor (NIT)</th>
                  <th className="p-2.5">Receptor / Cliente</th>
                  <th className="p-2.5 text-center">Fecha</th>
                  <th className="p-2.5 text-right">Total</th>
                  <th className="p-2.5 text-center">Ítems</th>
                  <th className="p-2.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {xmlsStaged.map((staged) => (
                  <tr key={staged.id} className="hover:bg-indigo-50/30">
                    <td className="p-2.5 font-mono text-gray-500">{staged.nombreArchivo}</td>
                    <td className="p-2.5 font-bold text-indigo-950">{staged.datos.numero_factura}</td>
                    <td className="p-2.5">{staged.datos.emisor_nit}</td>
                    <td className="p-2.5">{staged.datos.receptor_nombre} ({staged.datos.receptor_nit})</td>
                    <td className="p-2.5 text-center">{staged.datos.fecha_emision}</td>
                    <td className="p-2.5 text-right font-bold text-gray-900">
                      ${staged.datos.total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-center font-semibold">{staged.items.length}</td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => eliminarXmlStaged(staged.id)}
                        className="text-red-500 hover:text-red-700 font-bold px-2 py-1"
                        title="Quitar de la lista"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORMULARIO DE EMISIÓN MANUAL (MANTENIDO) */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Ítems / Servicios a Facturar Manualmente
            </h2>
            <button
              type="button"
              onClick={agregarFilaItem}
              disabled={!empresaId}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-300 shadow-sm"
            >
              + Agregar Ítem
            </button>
          </div>

          <div className="relative">
            <table className="w-full text-left text-sm text-gray-700 border-collapse">
              <thead className="bg-gray-100 text-gray-800 uppercase font-semibold text-xs">
                <tr>
                  <th className="p-2.5 w-1/3">Ítem / Producto</th>
                  <th className="p-2.5 w-20 text-center">Cant.</th>
                  <th className="p-2.5 w-32 text-right">Valor Unit.</th>
                  <th className="p-2.5 w-24 text-center">% IVA</th>
                  <th className="p-2.5 w-28 text-right">Subtotal</th>
                  <th className="p-2.5 w-28 text-right">IVA</th>
                  <th className="p-2.5 w-32 text-right">Total</th>
                  <th className="p-2.5 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {itemsDetalle.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-400 text-sm">
                      Haga clic en "+ Agregar Ítem" o importe XMLs arriba para procesar por lote.
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
                          <input
                            type="text"
                            placeholder="Buscar ítem..."
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
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 bg-white"
                          />

                          {filaActivaMenu === fila.id && (
                            <div 
                              ref={menuRef} 
                              className="absolute z-50 left-2 right-2 top-full mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-56 overflow-y-auto"
                            >
                              {filtrados.length === 0 ? (
                                <div className="p-3 text-gray-400 text-xs italic">No se encontraron ítems</div>
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
                            className="w-full p-2 border border-gray-300 rounded-md text-sm text-center bg-white"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={fila.valorUnitario}
                            onChange={(e) => actualizarFila(fila.id, 'valorUnitario', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm text-right font-medium bg-white"
                          />
                        </td>

                        <td className="p-2">
                          <select
                            value={fila.porcentajeIva}
                            onChange={(e) => actualizarFila(fila.id, 'porcentajeIva', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm text-center bg-white"
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
                            className="text-red-500 hover:text-red-700 font-bold p-1"
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

        {/* RESUMEN Y BOTÓN DE GUARDAR MANUAL */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-full md:w-1/2 bg-blue-50 p-4 rounded-lg flex flex-col space-y-2 border border-blue-100">
            <div className="flex justify-between text-xs text-gray-700">
              <span>Subtotal:</span>
              <span className="font-semibold text-sm">
                ${subtotalGeneral.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-700">
              <span>IVA Total:</span>
              <span className="font-semibold text-sm">
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

          <button
            type="submit"
            disabled={cargando || Boolean(errorPeriodo)}
            className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 text-sm shadow-md"
          >
            {cargando ? 'Procesando...' : 'Guardar y Emitir Factura Manual'}
          </button>
        </div>
      </form>
    </div>
  );
}