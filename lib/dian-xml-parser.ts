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

  const parsed = parser.parse(xmlText) as Record<string, any>;

  // Manejar el caso de que el XML venga encapsulado en AttachedDocument
  let invoice = parsed.Invoice || parsed.CreditNote || parsed.DebitNote;

  if (!invoice && parsed.AttachedDocument) {
    const attachmentString = parsed.AttachedDocument?.Attachment?.ExternalReference?.Description;
    if (attachmentString) {
      const innerParsed = parser.parse(attachmentString) as Record<string, any>;
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
  const cufe_cude = typeof uuidNode === 'object' && uuidNode !== null ? uuidNode['#text'] : uuidNode;

  // 3. Fechas
  const fecha_emision = String(invoice.IssueDate || '');
  const fecha_vencimiento = invoice.PaymentMeans?.DueDate || invoice.DueDate || null;

  // 4. Datos del Emisor (Proveedor)
  const emisorParty = invoice.AccountingSupplierParty?.Party;
  const emisorNitNode = emisorParty?.PartyTaxScheme?.CompanyID;
  const emisor_nit = typeof emisorNitNode === 'object' && emisorNitNode !== null ? emisorNitNode['#text'] : emisorNitNode;
  const emisor_nombre = emisorParty?.PartyLegalEntity?.RegistrationName || emisorParty?.PartyName?.Name;

  // 5. Datos del Adquirente (Cliente)
  const clienteParty = invoice.AccountingCustomerParty?.Party;
  const clienteNitNode = clienteParty?.PartyTaxScheme?.CompanyID;
  const adquirente_nit = typeof clienteNitNode === 'object' && clienteNitNode !== null ? clienteNitNode['#text'] : clienteNitNode;
  const adquirente_nombre = clienteParty?.PartyLegalEntity?.RegistrationName || clienteParty?.PartyName?.Name;

  // 6. Valores Financieros y Totales
  const legalMonetaryTotal = invoice.LegalMonetaryTotal || invoice.RequestedMonetaryTotal || {};
  const moneda = legalMonetaryTotal.PayableAmount?.['@_currencyID'] || 'COP';

  const parseValor = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'object' && val !== null) {
      return parseFloat(val['#text'] || 0);
    }
    return parseFloat(val) || 0;
  };

  const subtotal = parseValor(legalMonetaryTotal.LineExtensionAmount);
  const descuentos = parseValor(legalMonetaryTotal.AllowanceTotalAmount);
  const total_factura = parseValor(legalMonetaryTotal.PayableAmount);

  // 7. Impuestos y Retenciones
  let impuestos = 0;
  let retenciones = 0;

  const taxTotals = Array.isArray(invoice.TaxTotal) ? invoice.TaxTotal : [invoice.TaxTotal].filter(Boolean);

  for (const tax of taxTotals) {
    const amount = parseValor(tax?.TaxAmount);
    
    // Verificar si es ReteIVA, ReteFuente o ReteICA (Withholding Tax)
    const taxSchemeName = String(tax?.TaxSubtotal?.TaxCategory?.TaxScheme?.Name || '');
    const isWithholding = taxSchemeName.includes('Rete') || false;
    
    if (isWithholding) {
      retenciones += amount;
    } else {
       impuestos += amount;
    }
  }

  return {
    prefijo,
    numero_factura: idCompleto,
    cufe_cude: cufe_cude ? String(cufe_cude) : null,
    tipo_documento: tipoDocumento,
    fecha_emision,
    fecha_vencimiento: fecha_vencimiento ? String(fecha_vencimiento) : null,
    emisor_nit: String(emisor_nit || ''),
    emisor_nombre: String(emisor_nombre || ''),
    adquirente_nit: String(adquirente_nit || ''),
    adquirente_nombre: String(adquirente_nombre || ''),
    moneda: String(moneda),
    subtotal,
    descuentos,
    impuestos,
    retenciones,
    total_factura,
  };
}