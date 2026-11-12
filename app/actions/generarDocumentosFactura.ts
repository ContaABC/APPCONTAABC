"use server";

import { createClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import crypto from "crypto";
import React from "react";
import { FacturaPDFTemplate } from "@/components/pdf/FacturaPDFTemplate";

// ==========================================
// INTERFACES Y TIPOS
// ==========================================
export interface FacturaItem {
  id?: number | string;
  factura_id?: string;
  descripcion?: string;
  nombre_item?: string; // Añadido para compatibilidad con el template PDF
  cantidad?: number;
  precio_unitario?: number;
  valor_unitario?: number; // Añadido por si el template lo usa
  subtotal?: number;
  total?: number; // Añadido por si el template lo usa
  [key: string]: any;
}

export interface FacturaCabecera {
  id: string;
  empresa_id: number | string;
  numero_factura: string;
  fecha_emision: string;
  cliente_nit: string;
  cliente_nombre: string;
  subtotal: number;
  total_factura: number;
  iva?: number; // Añadido como opcional para que no falle si el template lo exige
  cufe?: string;
  qr_code?: string;
  xml_firmado_url?: string;
  pdf_url?: string;
  estado_dian?: string;
  [key: string]: any;
}

export interface GenerarDocumentoResultado {
  success: boolean;
  pdfUrl?: string;
  xmlUrl?: string;
  cufe?: string;
  error?: string;
}

// Inicializar cliente de Supabase con Service Role para permisos de escritura en Storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function generarDocumentosFacturaAction(
  facturaId: string
): Promise<GenerarDocumentoResultado> {
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

    const facturaData: FacturaCabecera = factura;

    const { data: items, error: errItems } = await supabaseAdmin
      .from("detalle_facturas_emitidas")
      .select("*")
      .eq("factura_id", facturaId);

    if (errItems) {
      throw new Error("Error al obtener los ítems de la factura.");
    }

    const itemsData: FacturaItem[] = items || [];

    // 2. Generar CUFE de prueba (Hash SHA-384 sintético)
    const cufeSemilla = `${facturaData.numero_factura}${facturaData.fecha_emision}${facturaData.total_factura}${facturaData.cliente_nit}`;
    const cufePruebas = crypto.createHash("sha384").update(cufeSemilla).digest("hex");

    // 3. Generar Código QR en formato Base64
    const qrData = `NumFac: ${facturaData.numero_factura}\nNitCliente: ${facturaData.cliente_nit}\nValTol: ${facturaData.total_factura}\nCUFE: ${cufePruebas}`;
    const qrBase64 = await QRCode.toDataURL(qrData);

    // 4. Generar XML UBL 2.1 Sintético (Estructura de prueba)
    const xmlContenido = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>${facturaData.numero_factura}</ID>
  <UUID schemeName="CUFE-SHA384">${cufePruebas}</UUID>
  <IssueDate>${facturaData.fecha_emision}</IssueDate>
  <AccountingSupplierParty>
    <PartyIdentification><ID>${facturaData.empresa_id}</ID></PartyIdentification>
  </AccountingSupplierParty>
  <AccountingCustomerParty>
    <PartyIdentification><ID>${facturaData.cliente_nit}</ID></PartyIdentification>
    <PartyName><Name>${facturaData.cliente_nombre}</Name></PartyName>
  </AccountingCustomerParty>
  <LegalMonetaryTotal>
    <LineExtensionAmount currencyID="COP">${facturaData.subtotal}</LineExtensionAmount>
    <TaxInclusiveAmount currencyID="COP">${facturaData.total_factura}</TaxInclusiveAmount>
    <PayableAmount currencyID="COP">${facturaData.total_factura}</PayableAmount>
  </LegalMonetaryTotal>
</Invoice>`;

    const xmlBuffer = Buffer.from(xmlContenido, "utf-8");

    // 5. Renderizar el PDF a Buffer
    // Mapear y normalizar los ítems para que cumplan exactamente con el tipo que exige el template PDF
    const itemsParaPDF = itemsData.map((item) => ({
      ...item,
      nombre_item: item.nombre_item || item.descripcion || "Ítem o servicio",
      cantidad: Number(item.cantidad || 1),
      valor_unitario: Number(item.valor_unitario || item.precio_unitario || 0),
      total: Number(item.total || item.subtotal || (Number(item.cantidad || 1) * Number(item.valor_unitario || item.precio_unitario || 0))),
    }));

    // 5. Renderizar el PDF a Buffer
    const pdfBuffer = await renderToBuffer(
      React.createElement(FacturaPDFTemplate, {
        factura: { 
          ...facturaData, 
          iva: facturaData.iva || 0, 
          cufe: cufePruebas 
        },
        items: itemsParaPDF,
        qrBase64,
      })
    );

    // 6. Subir archivos a Supabase Storage
    const xmlPath = `facturas/${facturaData.empresa_id}/${facturaData.numero_factura}.xml`;
    const pdfPath = `facturas/${facturaData.empresa_id}/${facturaData.numero_factura}.pdf`;

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
        estado_dian: "PRUEBAS_GENERADO",
      })
      .eq("id", facturaId);

    if (errUpdate) {
      throw new Error(`Error actualizando facturas_emitidas: ${errUpdate.message}`);
    }

    return {
      success: true,
      pdfUrl: urlPdf.publicUrl,
      xmlUrl: urlXml.publicUrl,
      cufe: cufePruebas,
    };
  } catch (error: any) {
    console.error("Error al generar documentos:", error);
    return { success: false, error: error.message || "Error desconocido al procesar la factura." };
  }
}