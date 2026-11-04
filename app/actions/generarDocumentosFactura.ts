"use server";

import { createClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import crypto from "crypto";
import React from "react";
import { FacturaPDFTemplate } from "@/components/pdf/FacturaPDFTemplate";

// Inicializar cliente de Supabase con Service Role para permisos de escritura en Storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function generarDocumentosFacturaAction(facturaId: string) {
  try {
    // 1. Obtener la cabecera y detalle de la factura
    const { data: factura, error: errFactura } = await supabaseAdmin
      .from("facturas_emitidas")
      .select("*")
      .eq("id", facturaId)
      .single();

    if (errFactura || !factura) {
      throw new Error("No se encontró la factura especificada.");
    }

    const { data: items, error: errItems } = await supabaseAdmin
      .from("detalle_facturas_emitidas")
      .select("*")
      .eq("factura_id", facturaId);

    if (errItems) {
      throw new Error("Error al obtener los ítems de la factura.");
    }

    // 2. Generar CUFE de prueba (Hash SHA-384 sintético)
    const cufeSemilla = `${factura.numero_factura}${factura.fecha_emision}${factura.total_factura}${factura.cliente_nit}`;
    const cufePruebas = crypto.createHash("sha384").update(cufeSemilla).digest("hex");

    // 3. Generar Código QR en formato Base64
    const qrData = `NumFac: ${factura.numero_factura}\nNitCliente: ${factura.cliente_nit}\nValTol: ${factura.total_factura}\nCUFE: ${cufePruebas}`;
    const qrBase64 = await QRCode.toDataURL(qrData);

    // 4. Generar XML UBL 2.1 Sintético (Estructura de prueba)
    const xmlContenido = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>${factura.numero_factura}</ID>
  <UUID schemeName="CUFE-SHA384">${cufePruebas}</UUID>
  <IssueDate>${factura.fecha_emision}</IssueDate>
  <AccountingSupplierParty>
    <PartyIdentification><ID>${factura.empresa_id}</ID></PartyIdentification>
  </AccountingSupplierParty>
  <AccountingCustomerParty>
    <PartyIdentification><ID>${factura.cliente_nit}</ID></PartyIdentification>
    <PartyName><Name>${factura.cliente_nombre}</Name></PartyName>
  </AccountingCustomerParty>
  <LegalMonetaryTotal>
    <LineExtensionAmount currencyID="COP">${factura.subtotal}</LineExtensionAmount>
    <TaxInclusiveAmount currencyID="COP">${factura.total_factura}</TaxInclusiveAmount>
    <PayableAmount currencyID="COP">${factura.total_factura}</PayableAmount>
  </LegalMonetaryTotal>
</Invoice>`;

    const xmlBuffer = Buffer.from(xmlContenido, "utf-8");

    // 5. Renderizar el PDF a Buffer
    const pdfBuffer = await renderToBuffer(
      React.createElement(FacturaPDFTemplate, {
        factura: { ...factura, cufe: cufePruebas },
        items: items || [],
        qrBase64
      })
    );

    // 6. Subir archivos a Supabase Storage
    const xmlPath = `facturas/${factura.empresa_id}/${factura.numero_factura}.xml`;
    const pdfPath = `facturas/${factura.empresa_id}/${factura.numero_factura}.pdf`;

    // Subir XML
    await supabaseAdmin.storage
      .from("comprobantes")
      .upload(xmlPath, xmlBuffer, { contentType: "application/xml", upsert: true });

    // Subir PDF
    await supabaseAdmin.storage
      .from("comprobantes")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });

    // Obtener URLs públicas
    const { data: urlXml } = supabaseAdmin.storage.from("comprobantes").getPublicUrl(xmlPath);
    const { data: urlPdf } = supabaseAdmin.storage.from("comprobantes").getPublicUrl(pdfPath);

    // 7. Actualizar la factura con los enlaces y CUFE generados
    const { error: errUpdate } = await supabaseAdmin
      .from("facturas_emitidas")
      .update({
        cufe: cufePruebas,
        qr_code: qrData,
        xml_firmado_url: urlXml.publicUrl,
        pdf_url: urlPdf.publicUrl,
        estado_dian: "PRUEBAS_GENERADO"
      })
      .eq("id", facturaId);

    if (errUpdate) {
      throw new Error(`Error actualizando facturas_emitidas: ${errUpdate.message}`);
    }

    return {
      success: true,
      pdfUrl: urlPdf.publicUrl,
      xmlUrl: urlXml.publicUrl,
      cufe: cufePruebas
    };
  } catch (error: any) {
    console.error("Error al generar documentos:", error);
    return { success: false, error: error.message };
  }
}