"use client";

import React, { useState, useEffect, useMemo, ChangeEvent } from "react";
import { procesarFacturaXmlAdmin } from "@/app/facturas/cargar/actions";
import { supabase } from "@/lib/supabaseClient";

interface XmlUploaderProps {
  selectedCompanyId: string;
  selectedBranchId: string;
  selectedDocumentClassId: string;
  fechaContabilizacion: string;
  onSuccess?: () => void;
}

interface ItemParsed {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface InvoiceParsedData {
  numeroFactura: string;
  cufe: string;
  fechaEmision: string;
  emisorNit: string;
  emisorNombre: string;
  clienteNit: string;
  clienteNombre: string;
  subtotal: number;
  impuestos: number;
  total: number;
  xmlContent: string;
  items: ItemParsed[];
}

interface ConceptoRetencion {
  id: number | string;
  empresa_id: number;
  tipo_retencion: string;
  codigo?: string;
  concepto?: string;
  descripcion?: string;
  tarifa: number;
  activo?: boolean;
}

export default function XmlUploader({
  selectedCompanyId,
  selectedBranchId,
  selectedDocumentClassId,
  fechaContabilizacion,
  onSuccess,
}: XmlUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrlInput, setPdfUrlInput] = useState<string>("");
  const [parsedInvoice, setParsedInvoice] = useState<InvoiceParsedData | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Conceptos de retención para la empresa activa
  const [conceptosRetencion, setConceptosRetencion] = useState<ConceptoRetencion[]>([]);

  // Estados para las retenciones seleccionadas en pantalla
  const [retRentaId, setRetRentaId] = useState<string>("");
  const [retIvaId, setRetIvaId] = useState<string>("");
  const [retIcaId, setRetIcaId] = useState<string>("");

  const formatCOP = (val: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val || 0);

  const normalizarNit = (nit?: string): string => {
    if (!nit) return "";
    return nit.replace(/[\.\-\s]/g, "").trim();
  };

  // Cargar conceptos de retención consumiendo la API interna /api/conceptos-retencion
  useEffect(() => {
    if (!selectedCompanyId) {
      setConceptosRetencion([]);
      return;
    }

    const cargarConceptos = async () => {
      try {
        const response = await fetch(`/api/conceptos-retencion?empresa_id=${selectedCompanyId}`);
        const result = await response.json();

        if (result.exito && result.conceptos) {
          setConceptosRetencion(result.conceptos);
        } else {
          setConceptosRetencion([]);
          console.error("Error al cargar conceptos de retención:", result.mensaje);
        }
      } catch (err) {
        console.error("Error al cargar conceptos de retención:", err);
        setConceptosRetencion([]);
      }
    };

    cargarConceptos();
  }, [selectedCompanyId]);

  // Filtrado exacto por la columna tipo_retencion
  const conceptosRenta = useMemo(() => {
    return conceptosRetencion.filter((c) => (c.tipo_retencion || "").toUpperCase() === "RENTA" && c.activo !== false);
  }, [conceptosRetencion]);

  const conceptosIva = useMemo(() => {
    return conceptosRetencion.filter((c) => (c.tipo_retencion || "").toUpperCase() === "IVA" && c.activo !== false);
  }, [conceptosRetencion]);

  const conceptosIca = useMemo(() => {
    return conceptosRetencion.filter((c) => (c.tipo_retencion || "").toUpperCase() === "ICA" && c.activo !== false);
  }, [conceptosRetencion]);

  // Helper para obtener el primer elemento por su localName
  const getFirstByLocalName = (parent: Element | Document, localName: string): Element | null => {
    const elements = parent.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].localName === localName) {
        return elements[i];
      }
    }
    return null;
  };

  // Helper para obtener todos los elementos por localName
  const getAllByLocalName = (parent: Element | Document, localName: string): Element[] => {
    const elements = parent.getElementsByTagName("*");
    const result: Element[] = [];
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].localName === localName) {
        result.push(elements[i]);
      }
    }
    return result;
  };

  const getTextValue = (parent: Element | Document | null, localName: string): string => {
    if (!parent) return "";
    const el = getFirstByLocalName(parent, localName);
    return el?.textContent?.trim() || "";
  };

  // Extrae los datos reales de Party en el estándar DIAN
  const parsePartyData = (partyParentNode: Element | null) => {
    if (!partyParentNode) return { nit: "Sin Identificación", nombre: "Sin Nombre" };

    const partyNode = getFirstByLocalName(partyParentNode, "Party") || partyParentNode;

    let nit = "";
    const partyTaxScheme = getFirstByLocalName(partyNode, "PartyTaxScheme");
    if (partyTaxScheme) {
      nit = getTextValue(partyTaxScheme, "CompanyID");
    }
    if (!nit) {
      const partyIdent = getFirstByLocalName(partyNode, "PartyIdentification");
      if (partyIdent) {
        nit = getTextValue(partyIdent, "ID");
      }
    }
    if (!nit) {
      nit = getTextValue(partyNode, "CompanyID") || getTextValue(partyNode, "ID");
    }

    let nombre = "";
    const partyTaxSchemeReg = getFirstByLocalName(partyNode, "PartyTaxScheme");
    if (partyTaxSchemeReg) {
      nombre = getTextValue(partyTaxSchemeReg, "RegistrationName");
    }
    if (!nombre) {
      const partyLegalEntity = getFirstByLocalName(partyNode, "PartyLegalEntity");
      if (partyLegalEntity) {
        nombre = getTextValue(partyLegalEntity, "RegistrationName");
      }
    }
    if (!nombre) {
      const partyNameNode = getFirstByLocalName(partyNode, "PartyName");
      if (partyNameNode) {
        nombre = getTextValue(partyNameNode, "Name");
      }
    }
    if (!nombre) {
      nombre = getTextValue(partyNode, "RegistrationName") || getTextValue(partyNode, "Name");
    }

    return {
      nit: nit || "Sin Identificación",
      nombre: nombre || "Sin Nombre",
    };
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStatusMessage(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".xml")) {
      setStatusMessage({ type: "error", text: "Por favor seleccione un archivo con extensión .xml" });
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parser = new DOMParser();
        let xmlDoc = parser.parseFromString(text, "text/xml");

        const attachedDoc = getFirstByLocalName(xmlDoc, "AttachedDocument");
        if (attachedDoc) {
          const descriptionXml = getTextValue(attachedDoc, "Description");
          if (descriptionXml && descriptionXml.includes("<Invoice")) {
            xmlDoc = parser.parseFromString(descriptionXml, "text/xml");
          }
        }

        const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
        if (parserError) {
          throw new Error("El archivo XML presenta errores de sintaxis.");
        }

        const numeroFactura = getTextValue(xmlDoc, "ID") || "SIN_NUMERO";
        const cufe = getTextValue(xmlDoc, "UUID") || "";
        const fechaEmision = getTextValue(xmlDoc, "IssueDate") || new Date().toISOString().split("T")[0];

        const supplierNode = getFirstByLocalName(xmlDoc, "AccountingSupplierParty");
        const emisor = parsePartyData(supplierNode);

        const customerNode = getFirstByLocalName(xmlDoc, "AccountingCustomerParty");
        const cliente = parsePartyData(customerNode);

        const legalMonetaryTotal = getFirstByLocalName(xmlDoc, "LegalMonetaryTotal");
        let subtotalVal = 0;
        let totalVal = 0;

        if (legalMonetaryTotal) {
          subtotalVal = parseFloat(getTextValue(legalMonetaryTotal, "LineExtensionAmount") || "0");
          totalVal = parseFloat(getTextValue(legalMonetaryTotal, "PayableAmount") || "0");
        }

        const taxTotalNodes = getAllByLocalName(xmlDoc, "TaxTotal");
        let taxVal = 0;
        taxTotalNodes.forEach((node) => {
          const taxAmt = parseFloat(getTextValue(node, "TaxAmount") || "0");
          if (taxAmt > 0) taxVal += taxAmt;
        });

        let invoiceLines = getAllByLocalName(xmlDoc, "InvoiceLine");
        if (invoiceLines.length === 0) {
          invoiceLines = getAllByLocalName(xmlDoc, "CreditNoteLine");
        }

        const items: ItemParsed[] = invoiceLines.map((lineNode) => {
          const itemNode = getFirstByLocalName(lineNode, "Item");
          let descripcion = "";
          if (itemNode) {
            descripcion = getTextValue(itemNode, "Description");
          }
          if (!descripcion) {
            descripcion = getTextValue(lineNode, "Description") || "Producto / Servicio";
          }

          let codigo = "";
          if (itemNode) {
            const sellersItem = getFirstByLocalName(itemNode, "SellersItemIdentification");
            const standardItem = getFirstByLocalName(itemNode, "StandardItemIdentification");
            codigo = getTextValue(sellersItem, "ID") || getTextValue(standardItem, "ID");
          }
          if (!codigo) {
            codigo = getTextValue(lineNode, "ID");
          }

          const qtyEl = getFirstByLocalName(lineNode, "InvoicedQuantity") || getFirstByLocalName(lineNode, "CreditedQuantity");
          const cantidad = parseFloat(qtyEl?.textContent?.trim() || "1");

          const lineSubtotal = parseFloat(getTextValue(lineNode, "LineExtensionAmount") || "0");

          const priceNode = getFirstByLocalName(lineNode, "Price");
          let precioUnitario = 0;
          if (priceNode) {
            precioUnitario = parseFloat(getTextValue(priceNode, "PriceAmount") || "0");
          }
          if (precioUnitario === 0) {
            precioUnitario = parseFloat(getTextValue(lineNode, "PriceAmount") || "0");
          }
          if (precioUnitario === 0 && cantidad > 0 && lineSubtotal > 0) {
            precioUnitario = lineSubtotal / cantidad;
          }

          return {
            codigo,
            descripcion,
            cantidad,
            precio_unitario: precioUnitario,
            subtotal: lineSubtotal > 0 ? lineSubtotal : cantidad * precioUnitario,
          };
        });

        setParsedInvoice({
          numeroFactura,
          cufe,
          fechaEmision,
          emisorNit: emisor.nit,
          emisorNombre: emisor.nombre,
          clienteNit: cliente.nit,
          clienteNombre: cliente.nombre,
          subtotal: subtotalVal,
          impuestos: taxVal,
          total: totalVal > 0 ? totalVal : subtotalVal + taxVal,
          xmlContent: text,
          items,
        });

        // Consultar retenciones configuradas en la tabla 'terceros'
        if (selectedCompanyId && emisor.nit) {
          const nitEmisorLimpio = normalizarNit(emisor.nit);
          const empresaIdNum = Number(selectedCompanyId);

          const { data: terceros } = await supabase
            .from("terceros")
            .select("id, numero_identificacion, retencion_renta_id, retencion_iva_id, retencion_ica_id")
            .eq("empresa_id", empresaIdNum);

          const terceroEncontrado = terceros?.find((t) => {
            const nitDB = normalizarNit(String(t.numero_identificacion || ""));
            return nitDB === nitEmisorLimpio || nitDB.startsWith(nitEmisorLimpio) || nitEmisorLimpio.startsWith(nitDB);
          });

          if (terceroEncontrado) {
            setRetRentaId(terceroEncontrado.retencion_renta_id ? String(terceroEncontrado.retencion_renta_id) : "");
            setRetIvaId(terceroEncontrado.retencion_iva_id ? String(terceroEncontrado.retencion_iva_id) : "");
            setRetIcaId(terceroEncontrado.retencion_ica_id ? String(terceroEncontrado.retencion_ica_id) : "");
          } else {
            setRetRentaId("");
            setRetIvaId("");
            setRetIcaId("");
          }
        }
      } catch (err: unknown) {
        console.error("Error al previsualizar XML:", err);
        const errorMsg = err instanceof Error ? err.message : "No se pudo leer la estructura del XML.";
        setStatusMessage({ type: "error", text: errorMsg });
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsText(selectedFile);
  };

  const handleSaveInvoice = async () => {
    if (!selectedCompanyId || !selectedBranchId || !selectedDocumentClassId) {
      setStatusMessage({ type: "error", text: "Debe seleccionar Empresa, Sucursal y Clase de Documento." });
      return;
    }

    if (!parsedInvoice) {
      setStatusMessage({ type: "error", text: "No hay ninguna factura cargada." });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await procesarFacturaXmlAdmin(
        {
          cufe: parsedInvoice.cufe,
          numero_factura: parsedInvoice.numeroFactura,
          fecha_emision: parsedInvoice.fechaEmision,
          total: parsedInvoice.total,
          subtotal: parsedInvoice.subtotal,
          iva: parsedInvoice.impuestos,
          emisor_nit: parsedInvoice.emisorNit,
          emisor_nombre: parsedInvoice.emisorNombre,
          receptor_nit: parsedInvoice.clienteNit,
          receptor_nombre: parsedInvoice.clienteNombre,
        },
        selectedCompanyId,
        selectedBranchId,
        selectedDocumentClassId,
        parsedInvoice.xmlContent,
        pdfUrlInput.trim() || undefined,
        fechaContabilizacion,
        {
          retencion_renta_id: retRentaId ? retRentaId : null,
          retencion_iva_id: retIvaId ? retIvaId : null,
          retencion_ica_id: retIcaId ? retIcaId : null,
        }
      );

      if (!res.success) {
        throw new Error(res.error || "Ocurrió un error al guardar la factura.");
      }

      setStatusMessage({ type: "success", text: `Factura ${parsedInvoice.numeroFactura} contabilizada con éxito.` });
      setFile(null);
      setParsedInvoice(null);
      setPdfUrlInput("");
      setRetRentaId("");
      setRetIvaId("");
      setRetIcaId("");

      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar factura.";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {statusMessage && (
        <div
          className={`px-2.5 py-1 rounded text-xs font-medium ${
            statusMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {!parsedInvoice && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-white p-2 rounded border border-dashed border-gray-300 items-center">
          <div className="md:col-span-2 flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-700 whitespace-nowrap">Archivo XML:</span>
            <input
              type="file"
              accept=".xml"
              onChange={handleFileChange}
              disabled={isParsing}
              className="block w-full text-xs text-gray-500 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="URL del PDF adjunto (opcional)"
              value={pdfUrlInput}
              onChange={(e) => setPdfUrlInput(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-700 focus:bg-white"
            />
          </div>
        </div>
      )}

      {parsedInvoice && (
        <div className="bg-white rounded border border-blue-200 p-2 space-y-1.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-blue-50/80 p-2 rounded text-xs border border-blue-100">
            <div className="flex flex-col justify-center">
              <span className="text-[9px] text-gray-500 uppercase font-semibold leading-tight">Factura Nº</span>
              <span className="font-bold text-blue-900 text-sm leading-tight">{parsedInvoice.numeroFactura}</span>
              <span className="text-[10px] text-gray-600 mt-0.5">Emisión: {parsedInvoice.fechaEmision}</span>
            </div>

            <div className="border-t md:border-t-0 md:border-l border-blue-200 pt-1 md:pt-0 md:pl-3 flex flex-col justify-center">
              <span className="text-[9px] text-blue-800 uppercase font-bold leading-tight">Emisor (Proveedor)</span>
              <span className="font-semibold text-gray-900 truncate leading-tight" title={parsedInvoice.emisorNombre}>
                {parsedInvoice.emisorNombre}
              </span>
              <span className="text-[10px] font-mono text-gray-600">NIT/ID: {parsedInvoice.emisorNit}</span>
            </div>

            <div className="border-t md:border-t-0 md:border-l border-blue-200 pt-1 md:pt-0 md:pl-3 flex items-center justify-between">
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-[9px] text-amber-800 uppercase font-bold leading-tight">Adquirente (Facturado a)</span>
                <span className="font-semibold text-gray-900 truncate leading-tight" title={parsedInvoice.clienteNombre}>
                  {parsedInvoice.clienteNombre}
                </span>
                <span className="text-[10px] font-mono text-gray-600">NIT/ID: {parsedInvoice.clienteNit}</span>
              </div>

              <button
                type="button"
                onClick={() => setParsedInvoice(null)}
                className="ml-2 px-2 py-1 text-[10px] text-gray-600 hover:text-red-600 bg-white border border-gray-300 hover:border-red-300 rounded font-medium shadow-2xs whitespace-nowrap"
              >
                Cambiar XML
              </button>
            </div>
          </div>

          {/* SECCIÓN DE SELECCIÓN DE RETENCIONES HEREDADAS DEL TERCERO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-blue-50/40 p-2 rounded border border-blue-200 items-end">
            <div>
              <label className="block text-[10px] font-bold text-blue-900 uppercase mb-0.5">
                Ret. Renta
              </label>
              <select
                value={retRentaId}
                onChange={(e) => setRetRentaId(e.target.value)}
                className="w-full border border-blue-300 rounded h-7 px-1 bg-white text-[10px] truncate"
              >
                <option value="">-- Seleccione --</option>
                {conceptosRenta.map((c) => {
                  const tarifaPorcentaje = (Number(c.tarifa || 0) * 100).toFixed(2);
                  const conceptoLargo = c.concepto || c.descripcion || "";
                  const conceptoCorto = conceptoLargo.length > 45 
                    ? `${conceptoLargo.substring(0, 45)}...` 
                    : conceptoLargo;
                  const codigoStr = c.codigo ? `${c.codigo} - ` : "";

                  return (
                    <option key={c.id} value={c.id} title={`${conceptoLargo} (${tarifaPorcentaje}%)`}>
                      {`${codigoStr}${conceptoCorto} (${tarifaPorcentaje}%)`}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-blue-900 uppercase mb-0.5">
                Ret. IVA
              </label>
              <select
                value={retIvaId}
                onChange={(e) => setRetIvaId(e.target.value)}
                className="w-full border border-blue-300 rounded h-7 px-1 bg-white text-[10px] truncate"
              >
                <option value="">-- Seleccione --</option>
                {conceptosIva.map((c) => {
                  const tarifaPorcentaje = (Number(c.tarifa || 0) * 100).toFixed(2);
                  const conceptoLargo = c.concepto || c.descripcion || "";
                  const conceptoCorto = conceptoLargo.length > 45 
                    ? `${conceptoLargo.substring(0, 45)}...` 
                    : conceptoLargo;
                  const codigoStr = c.codigo ? `${c.codigo} - ` : "";

                  return (
                    <option key={c.id} value={c.id} title={`${conceptoLargo} (${tarifaPorcentaje}%)`}>
                      {`${codigoStr}${conceptoCorto} (${tarifaPorcentaje}%)`}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-blue-900 uppercase mb-0.5">
                Ret. ICA
              </label>
              <select
                value={retIcaId}
                onChange={(e) => setRetIcaId(e.target.value)}
                className="w-full border border-blue-300 rounded h-7 px-1 bg-white text-[10px] truncate"
              >
                <option value="">-- Seleccione --</option>
                {conceptosIca.map((c) => {
                  const tarifaPorMil = (Number(c.tarifa || 0) * 1000).toFixed(2);
                  const conceptoLargo = c.concepto || c.descripcion || "";
                  const conceptoCorto = conceptoLargo.length > 45 
                    ? `${conceptoLargo.substring(0, 45)}...` 
                    : conceptoLargo;
                  const codigoStr = c.codigo ? `${c.codigo} - ` : "";

                  return (
                    <option key={c.id} value={c.id} title={`${conceptoLargo} (${tarifaPorMil}‰)`}>
                      {`${codigoStr}${conceptoCorto} (${tarifaPorMil}‰)`}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="max-h-28 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-gray-100 text-gray-600 uppercase font-semibold text-[9px] sticky top-0 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-1 w-16">Código</th>
                    <th className="px-2 py-1">Concepto / Producto</th>
                    <th className="px-2 py-1 text-center w-16">Cant.</th>
                    <th className="px-2 py-1 text-right w-24">V. Unitario</th>
                    <th className="px-2 py-1 text-right w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {parsedInvoice.items.length > 0 ? (
                    parsedInvoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 font-sans">
                        <td className="px-2 py-0.5 font-mono text-[10px] text-gray-500">{item.codigo || "-"}</td>
                        <td className="px-2 py-0.5 truncate max-w-xs">{item.descripcion}</td>
                        <td className="px-2 py-0.5 text-center font-mono font-medium">{item.cantidad}</td>
                        <td className="px-2 py-0.5 text-right font-mono">{formatCOP(item.precio_unitario)}</td>
                        <td className="px-2 py-0.5 text-right font-mono font-medium">{formatCOP(item.subtotal)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-2 py-2 text-center text-xs text-gray-400 italic">
                        No se encontraron detalles de ítems en el XML.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-gray-500 text-[11px]">Subtotal: <strong className="text-gray-800">{formatCOP(parsedInvoice.subtotal)}</strong></span>
              <span className="text-gray-500 text-[11px]">IVA / Imp: <strong className="text-gray-800">{formatCOP(parsedInvoice.impuestos)}</strong></span>
              <span className="text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                Total: {formatCOP(parsedInvoice.total)}
              </span>
            </div>

            <button
              onClick={handleSaveInvoice}
              disabled={isSaving}
              className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-xs transition-colors disabled:bg-blue-300 cursor-pointer"
            >
              {isSaving ? "Guardando y Contabilizando..." : "Guardar y Contabilizar Factura"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}