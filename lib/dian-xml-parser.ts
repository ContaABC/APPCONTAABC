import { XMLParser } from 'fast-xml-parser';

export interface FacturaDianParsed {
  prefijo: string | null;
  numero_factura: string;
  cufe_cude: string | null;
  tipo_documento: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  emisor_nit: string;
  emisor_nombre: string;
  adquirente_nit: string;
  adquirente_nombre: string;
  moneda: string;
  subtotal: number;
  descuentos: number;
  impuestos: number;
  retenciones: number;
  total_factura: number;
}

export function parseDianXml(xmlText: string): FacturaDianParsed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true, // Remueve prefijos de namespace como cbc:, cac:
  });

  const parsed = parser.parse(xmlText);

  // Manejar el caso de que el XML venga encapsulado en AttachedDocument
  let invoice = parsed.Invoice || parsed.CreditNote || parsed.DebitNote;

  if (!invoice && parsed.AttachedDocument) {
    const attachmentString = parsed.AttachedDocument?.Attachment?.ExternalReference?.Description;
    if (attachmentString) {
      const innerParsed = parser.parse(attachmentString);
      invoice = innerParsed.Invoice || innerParsed.CreditNote || innerParsed.DebitNote;
    }
  }

  if (!invoice) {
    throw new Error('El XML proporcionado no es un documento de Facturación Electrónica DIAN válido.');
  }

  // Identificar tipo de documento
  let tipoDocumento = 'Factura_Venta';
  if (parsed.CreditNote) tipoDocumento = 'Nota_Credito';
  if (parsed.DebitNote) tipoDocumento = 'Nota_Debito';

  // 1. Numeración y Prefijo
  const idCompleto = String(invoice.ID || '');
  const prefijoMatch = idCompleto.match(/^([A-Za-z]+)/);
  const prefijo = prefijoMatch ? prefijoMatch[1] : null;

  // 2. CUFE / CUDE
  const uuidNode = invoice.UUID;
  const cufe_cude = typeof uuidNode === 'object' ? uuidNode['#text'] : uuidNode;

  // 3. Fechas
  const fecha_emision = invoice.IssueDate;
  const fecha_vencimiento = invoice.PaymentMeans?.DueDate || invoice.DueDate || null;

  // 4. Datos del Emisor (Proveedor)
  const emisorParty = invoice.AccountingSupplierParty?.Party;
  const emisor_nit = emisorParty?.PartyTaxScheme?.CompanyID?.['#text'] || emisorParty?.PartyTaxScheme?.CompanyID;
  const emisor_nombre = emisorParty?.PartyLegalEntity?.RegistrationName || emisorParty?.PartyName?.Name;

  // 5. Datos del Adquirente (Cliente)
  const clienteParty = invoice.AccountingCustomerParty?.Party;
  const adquirente_nit = clienteParty?.PartyTaxScheme?.CompanyID?.['#text'] || clienteParty?.PartyTaxScheme?.CompanyID;
  const adquirente_nombre = clienteParty?.PartyLegalEntity?.RegistrationName || clienteParty?.PartyName?.Name;

  // 6. Valores Financieros y Totales
  const legalMonetaryTotal = invoice.LegalMonetaryTotal || invoice.RequestedMonetaryTotal || {};
  const moneda = legalMonetaryTotal.PayableAmount?.['@_currencyID'] || 'COP';

  const subtotal = parseFloat(legalMonetaryTotal.LineExtensionAmount?.['#text'] || legalMonetaryTotal.LineExtensionAmount || 0);
  const descuentos = parseFloat(legalMonetaryTotal.AllowanceTotalAmount?.['#text'] || legalMonetaryTotal.AllowanceTotalAmount || 0);
  const total_factura = parseFloat(legalMonetaryTotal.PayableAmount?.['#text'] || legalMonetaryTotal.PayableAmount || 0);

  // 7. Impuestos y Retenciones
  let impuestos = 0;
  let retenciones = 0;

  const taxTotals = Array.isArray(invoice.TaxTotal) ? invoice.TaxTotal : [invoice.TaxTotal].filter(Boolean);

  for (const tax of taxTotals) {
    const amount = parseFloat(tax?.TaxAmount?.['#text'] || tax?.TaxAmount || 0);
    // Verificar si es ReteIVA, ReteFuente o ReteICA (Withholding Tax)
    const isWithholding = tax?.TaxSubtotal?.TaxCategory?.TaxScheme?.Name?.includes('Rete') || false;
    
    if (isWithholding) {
      retenciones += amount;
    } else {
      impuestos += amount;
    }
  }

  return {
    prefijo,
    numero_factura: idCompleto,
    cufe_cude: cufe_cude || null,
    tipo_documento: tipoDocumento,
    fecha_emision,
    fecha_vencimiento: fecha_vencimiento || null,
    emisor_nit: String(emisor_nit),
    emisor_nombre: String(emisor_nombre),
    adquirente_nit: String(adquirente_nit),
    adquirente_nombre: String(adquirente_nombre),
    moneda,
    subtotal,
    descuentos,
    impuestos,
    retenciones,
    total_factura,
  };
}