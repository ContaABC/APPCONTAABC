"use server";

import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import crypto from "crypto";
import QRCode from "qrcode";

export interface ItemXml {
  item_id?: string | null;
  codigo_ref?: string;
  nombre_item: string;
  cantidad: number;
  valor_unitario: number;
  subtotal: number;
  porcentaje_iva?: number;
  valor_iva?: number;
  total: number;
}

export interface ItemFacturaManual {
  id?: string;
  item_id: string | number | "";
  codigo: string;
  nombre: string;
  cantidad: number;
  valorUnitario: number;
  porcentajeIva: number;
  subtotal: number;
  iva: number;
  total: number;
}

export interface FacturaXmlData {
  cufe?: string;
  numero_factura: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  fecha_contable?: string;
  total: number;
  subtotal: number;
  iva: number;
  emisor_nit: string;
  emisor_nombre: string;
  receptor_nit: string;
  receptor_nombre: string;
}

export interface RegistrarFacturaManualPayload {
  empresa_id: number;
  sucursal_id: number;
  clase_documento_id: number;
  cliente_id: number | string;
  cliente_nit: string;
  cliente_nombre: string;
  cliente_email?: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_contable?: string;
  subtotal: number;
  descuentos?: number;
  iva: number;
  otros_impuestos?: number;
  total_factura: number;
  prefijo?: string;
  tipo_documento?: string;
  moneda?: string;
  items?: ItemFacturaManual[];
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan las variables de entorno de Supabase.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Genera el CUFE oficial de la DIAN utilizando el algoritmo SHA-384
 */
function calcularCufe(
  numFactura: string,
  fechaEmision: string,
  subtotal: number,
  iva: number,
  total: number,
  nitEmisor: string,
  nitReceptor: string,
  claveTecnica: string = "1234567890SecretKeyDIAN"
): string {
  const valSubtotal = Number(subtotal || 0).toFixed(2);
  const valIva = Number(iva || 0).toFixed(2);
  const valTotal = Number(total || 0).toFixed(2);

  const cadenaCufe = `${numFactura}${fechaEmision}00:00:00-05:00${valSubtotal}01${valIva}040.00030.00${valTotal}${nitEmisor}${nitReceptor}${claveTecnica}1`;

  return crypto.createHash("sha384").update(cadenaCufe).digest("hex");
}

/**
 * Construye la URL del Código QR de la DIAN para consulta pública
 */
function generarUrlQrDian(
  numFactura: string,
  nitEmisor: string,
  nitReceptor: string,
  fechaEmision: string,
  total: number,
  iva: number,
  cufe: string
): string {
  const valTotal = Number(total || 0).toFixed(2);
  const valIva = Number(iva || 0).toFixed(2);
  return `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}&numfactura=${numFactura}&nitemisor=${nitEmisor}&nitreceptor=${nitReceptor}&fecha=${fechaEmision}&valtotal=${valTotal}&valiva=${valIva}`;
}

function numeroALetras(monto: number): string {
  const unidades = [
    "", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"
  ];
  const decenas = [
    "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"
  ];
  const centenas = [
    "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
    "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"
  ];

  function convertGroup(n: number): string {
    let output = "";
    if (n === 100) return "CIEN";
    if (n >= 100) {
      output += centenas[Math.floor(n / 100)] + " ";
      n %= 100;
    }
    if (n >= 20) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      if (d === 2 && u > 0) {
        output += "VEINTI" + unidades[u] + " ";
      } else {
        output += decenas[d] + (u > 0 ? " Y " + unidades[u] : "") + " ";
      }
    } else if (n > 0) {
      output += unidades[n] + " ";
    }
    return output.trim();
  }

  const entero = Math.floor(monto);
  if (entero === 0) return "SON: CERO PESOS M/CTE.";

  let resultado = "";
  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const resto = entero % 1000;

  if (millones > 0) {
    resultado += millones === 1 ? "UN MILLON " : convertGroup(millones) + " MILLONES ";
  }
  if (miles > 0) {
    resultado += miles === 1 ? "UN MIL " : convertGroup(miles) + " MIL ";
  }
  if (resto > 0) {
    resultado += convertGroup(resto) + " ";
  }

  return `SON: ${resultado.trim()} PESOS M/CTE.`;
}

async function subirArchivoStorage(
  contenido: string | Buffer,
  empresaId: number,
  subcarpeta: "xml" | "pdf",
  nombreArchivo: string,
  contentType: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const bucketName = "comprobantes";
    const rutaFinal = `${subcarpeta}/empresa_${empresaId}/${nombreArchivo}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(rutaFinal, contenido, { contentType, upsert: true });

    if (uploadError) {
      console.error(`Error al subir ${rutaFinal} a Storage:`, uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(rutaFinal);
    return data?.publicUrl || null;
  } catch (err) {
    console.error(`Excepción al subir archivo a Storage:`, err);
    return null;
  }
}

/**
 * Genera el PDF con la discriminación del Valor del IVA por cada ítem y los rangos de la Resolución DIAN.
 */
async function generarPdfBuffer(
  numeroFactura: string,
  empresaInfo: {
    razon_social?: string;
    nit_identificacion?: string;
    dv?: string;
    direccion?: string;
    ciudad?: string;
    pais?: string;
    telefono?: string;
    email?: string;
  },
  clienteNombre: string,
  clienteNit: string,
  fechaEmision: string,
  fechaVencimiento: string,
  items: ItemXml[],
  subtotal: number,
  iva: number,
  total: number,
  resolucionInfo?: {
    numero_resolucion?: string;
    prefijo?: string;
    consecutivo_inicial?: string;
    consecutivo_final?: string;
    fecha_expedicion?: string;
    fecha_vigencia_hasta?: string;
  },
  cufe?: string,
  qrCodeUrl?: string
): Promise<Buffer> {
  const doc = new jsPDF();

  const nitCompleto = empresaInfo.nit_identificacion
    ? `${empresaInfo.nit_identificacion}${empresaInfo.dv ? `-${empresaInfo.dv}` : ""}`
    : "N/A";

  const ubicacionEmpresa = [empresaInfo.direccion, empresaInfo.ciudad, empresaInfo.pais]
    .filter(Boolean)
    .join(", ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(empresaInfo.razon_social || "EMPRESA S.A.S.", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`NIT: ${nitCompleto}`, 14, 20);
  if (ubicacionEmpresa) doc.text(`Dirección: ${ubicacionEmpresa}`, 14, 24);

  const contacto = [
    empresaInfo.telefono ? `Tel: ${empresaInfo.telefono}` : null,
    empresaInfo.email ? `Email: ${empresaInfo.email}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (contacto) doc.text(contacto, 14, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`FACTURA DE VENTA N°: ${numeroFactura}`, 196, 20, { align: "right" });

  doc.line(14, 32, 196, 32);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL CLIENTE:", 14, 38);

  doc.setFont("helvetica", "normal");
  doc.text(`Cliente: ${clienteNombre}`, 14, 43);
  doc.text(`NIT / CC: ${clienteNit}`, 14, 48);

  doc.setFont("helvetica", "bold");
  doc.text("FECHAS DE CONTROL:", 130, 38);

  doc.setFont("helvetica", "normal");
  doc.text(`Fecha Emisión: ${fechaEmision}`, 130, 43);
  doc.text(`Fecha Vencimiento: ${fechaVencimiento}`, 130, 48);

  let y = 57;
  doc.setFillColor(242, 242, 242);
  doc.rect(14, y - 5, 182, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.text("Código", 16, y);
  doc.text("Descripción", 36, y);
  doc.text("Cant.", 95, y, { align: "center" });
  doc.text("V. Unitario", 125, y, { align: "right" });
  doc.text("IVA %", 145, y, { align: "center" });
  doc.text("V. IVA", 168, y, { align: "right" });
  doc.text("Total", 192, y, { align: "right" });

  doc.line(14, y + 2, 196, y + 2);

  y += 8;
  doc.setFont("helvetica", "normal");

  items.forEach((item) => {
    doc.text(String(item.codigo_ref || "-"), 16, y);
    doc.text(String(item.nombre_item).substring(0, 26), 36, y);
    doc.text(String(item.cantidad), 95, y, { align: "center" });
    doc.text(
      `$${Number(item.valor_unitario).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`,
      125,
      y,
      { align: "right" }
    );
    doc.text(`${item.porcentaje_iva ?? 19}%`, 145, y, { align: "center" });
    doc.text(
      `$${Number(item.valor_iva || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`,
      168,
      y,
      { align: "right" }
    );
    doc.text(
      `$${Number(item.total).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`,
      192,
      y,
      { align: "right" }
    );
    y += 6;
  });

  doc.line(14, y, 196, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 155, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`$${subtotal.toLocaleString("es-CO", { minimumFractionDigits: 2 })}`, 192, y, { align: "right" });

  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.text("IVA Total:", 155, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`$${iva.toLocaleString("es-CO", { minimumFractionDigits: 2 })}`, 192, y, { align: "right" });

  y += 6.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Total Factura:", 155, y, { align: "right" });
  doc.text(`$${total.toLocaleString("es-CO", { minimumFractionDigits: 2 })}`, 192, y, { align: "right" });

  y += 10;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(numeroALetras(total), 14, y);

  if (resolucionInfo) {
    y += 8;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMACIÓN DE AUTORIZACIÓN DIAN:", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.text(`Resolución N°: ${resolucionInfo.numero_resolucion || "N/A"} de Fecha: ${resolucionInfo.fecha_expedicion || "N/A"}`, 14, y);
    y += 3.5;
    doc.text(`Prefijo: ${resolucionInfo.prefijo || "N/A"} | Rango Autorizado: Desde ${resolucionInfo.consecutivo_inicial} Hasta ${resolucionInfo.consecutivo_final}`, 14, y);
    y += 3.5;
    doc.text(`Vigencia hasta: ${resolucionInfo.fecha_vigencia_hasta || "N/A"}`, 14, y);
  }

  if (cufe || qrCodeUrl) {
    y += 6;
    doc.line(14, y, 196, y);
    y += 5;

    if (cufe) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("CUFE:", 14, y);
      doc.setFont("helvetica", "normal");
      const cufeSplitted = doc.splitTextToSize(cufe, 140);
      doc.text(cufeSplitted, 14, y + 4);
    }

    if (qrCodeUrl) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, { margin: 1, width: 100 });
        doc.addImage(qrDataUrl, "PNG", 162, y - 2, 30, 30);
      } catch (qrErr) {
        console.error("Error generando imagen QR:", qrErr);
      }
    }
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

function parsearItemsXmlNativo(xmlString: string): ItemXml[] {
  const items: ItemXml[] = [];
  try {
    const lineRegex =
      /<(?:cbc:|cac:)?(?:InvoiceLine|CreditNoteLine)>([\s\S]*?)<\/(?:cbc:|cac:)?(?:InvoiceLine|CreditNoteLine)>/g;
    let match: RegExpExecArray | null;

    while ((match = lineRegex.exec(xmlString)) !== null) {
      const lineContent = match[1];

      const descMatch = /<(?:cbc:)?Description>([\s\S]*?)<\/(?:cbc:)?Description>/.exec(lineContent);
      const qtyMatch = /<(?:cbc:)?(?:InvoicedQuantity|CreditedQuantity)[^>]*>([\s\S]*?)<\/(?:cbc:)?(?:InvoicedQuantity|CreditedQuantity)>/.exec(lineContent);
      const lineSubtotalMatch = /<(?:cbc:)?LineExtensionAmount[^>]*>([\s\S]*?)<\/(?:cbc:)?LineExtensionAmount>/.exec(lineContent);
      const priceMatch = /<(?:cbc:)?PriceAmount[^>]*>([\s\S]*?)<\/(?:cbc:)?PriceAmount>/.exec(lineContent);
      const codeMatch = /<(?:cbc:)?ID[^>]*>([\s\S]*?)<\/(?:cbc:)?ID>/.exec(lineContent);
      const taxAmountMatch = /<(?:cbc:)?TaxAmount[^>]*>([\s\S]*?)<\/(?:cbc:)?TaxAmount>/.exec(lineContent);
      const percentMatch = /<(?:cbc:)?Percent[^>]*>([\s\S]*?)<\/(?:cbc:)?Percent>/.exec(lineContent);

      const nombre_item = descMatch ? descMatch[1].trim() : "Producto / Servicio";
      const cantidad = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
      const subtotal = lineSubtotalMatch ? parseFloat(lineSubtotalMatch[1]) : 0;
      let valor_unitario = priceMatch ? parseFloat(priceMatch[1]) : 0;

      if (valor_unitario === 0 && cantidad > 0 && subtotal > 0) {
        valor_unitario = subtotal / cantidad;
      }

      const valor_iva = taxAmountMatch ? parseFloat(taxAmountMatch[1]) : 0;
      const porcentaje_iva = percentMatch ? parseFloat(percentMatch[1]) : 0;
      const codigo_ref = codeMatch ? codeMatch[1].trim() : "";

      items.push({
        item_id: null,
        codigo_ref,
        nombre_item,
        cantidad,
        valor_unitario,
        subtotal,
        porcentaje_iva,
        valor_iva,
        total: subtotal + valor_iva,
      });
    }
  } catch (e) {
    console.warn("Error parseando líneas XML con método nativo:", e);
  }
  return items;
}

export async function procesarFacturaEmitidaXmlAdmin(
  datosXml: FacturaXmlData,
  companyId: string,
  branchId: string,
  documentClassId: string,
  contenidoXml: string,
  pdfUrlInput?: string
) {
  const supabase = getSupabaseAdmin();

  try {
    const empIdNum = parseInt(companyId, 10);
    const sucIdNum = parseInt(branchId, 10);
    const docClassIdNum = parseInt(documentClassId, 10);

    if (isNaN(empIdNum) || isNaN(sucIdNum) || isNaN(docClassIdNum)) {
      return {
        success: false,
        error: "IDs de empresa, sucursal o clase de documento no válidos.",
      };
    }

    const { data: empresaInfo } = await supabase
      .from("empresas")
      .select("razon_social, nit_identificacion, dv, direccion, ciudad, pais, telefono, email")
      .eq("id", empIdNum)
      .maybeSingle();

    const empObj = {
      razon_social: empresaInfo?.razon_social || datosXml.emisor_nombre,
      nit_identificacion: empresaInfo?.nit_identificacion || datosXml.emisor_nit,
      dv: empresaInfo?.dv || "",
      direccion: empresaInfo?.direccion || "",
      ciudad: empresaInfo?.ciudad || "",
      pais: empresaInfo?.pais || "",
      telefono: empresaInfo?.telefono || "",
      email: empresaInfo?.email || "",
    };

    const { data: mapaDoc } = await supabase
      .from("clase_documento_conceptos")
      .select("concepto_auxiliar_debito")
      .eq("empresa_id", empIdNum)
      .eq("clase_documento_id", docClassIdNum)
      .maybeSingle();

    let clienteId: number | null = null;
    const { data: terceroExistente } = await supabase
      .from("terceros")
      .select("id")
      .eq("empresa_id", empIdNum)
      .eq("numero_identificacion", datosXml.receptor_nit)
      .maybeSingle();

    if (terceroExistente) {
      clienteId = Number(terceroExistente.id);
    } else {
      const { data: nuevoTercero, error: errTercero } = await supabase
        .from("terceros")
        .insert({
          empresa_id: empIdNum,
          numero_identificacion: datosXml.receptor_nit,
          razon_social: datosXml.receptor_nombre,
          nombre_comercial: datosXml.receptor_nombre,
          es_cliente: true,
        })
        .select("id")
        .single();

      if (errTercero) {
        return {
          success: false,
          error: `Error creando el cliente en la empresa: ${errTercero.message}`,
        };
      }
      clienteId = Number(nuevoTercero.id);
    }

    const itemsList: ItemXml[] = contenidoXml ? parsearItemsXmlNativo(contenidoXml) : [];

    const { data: resultRpc, error: errorRpc } = await supabase.rpc(
      "fn_registrar_factura_emitida_completa",
      {
        p_empresa_id: empIdNum,
        p_sucursal_id: sucIdNum,
        p_clase_documento_id: docClassIdNum,
        p_cliente_id: clienteId,
        p_cliente_nit: datosXml.receptor_nit,
        p_cliente_nombre: datosXml.receptor_nombre,
        p_cliente_email: null,
        p_numero_factura: datosXml.numero_factura,
        p_prefijo: null,
        p_tipo_documento: "FACTURA",
        p_fecha_emision: datosXml.fecha_emision,
        p_fecha_vencimiento: datosXml.fecha_vencimiento || datosXml.fecha_emision,
        p_fecha_contable: datosXml.fecha_contable || datosXml.fecha_emision,
        p_concepto_auxiliar_id: mapaDoc?.concepto_auxiliar_debito || null,
        p_moneda: "COP",
        p_subtotal: datosXml.subtotal,
        p_descuentos: 0,
        p_iva: datosXml.iva,
        p_otros_impuestos: 0,
        p_retenciones: 0,
        p_total_factura: datosXml.total,
        p_cufe: datosXml.cufe || null,
        p_xml_firmado_url: null,
        p_pdf_url: pdfUrlInput || null,
        p_qr_code: null,
        p_estado_dian: "PROCESADA",
        p_estado_cobro: "PENDIENTE",
        p_items: itemsList,
      }
    );

    if (errorRpc || !resultRpc || resultRpc.length === 0) {
      return { success: false, error: errorRpc?.message || "Error al invocar la RPC." };
    }

    const facturaId = resultRpc[0].factura_id;
    const numFacturaGenerado = resultRpc[0].numero_factura;

    const cufeFinal =
      datosXml.cufe ||
      calcularCufe(
        numFacturaGenerado,
        datosXml.fecha_emision,
        datosXml.subtotal,
        datosXml.iva,
        datosXml.total,
        empObj.nit_identificacion,
        datosXml.receptor_nit
      );

    const qrCodeUrl = generarUrlQrDian(
      numFacturaGenerado,
      empObj.nit_identificacion,
      datosXml.receptor_nit,
      datosXml.fecha_emision,
      datosXml.total,
      datosXml.iva,
      cufeFinal
    );

    let xmlUrl: string | null = null;
    if (contenidoXml) {
      xmlUrl = await subirArchivoStorage(
        contenidoXml,
        empIdNum,
        "xml",
        `${numFacturaGenerado}.xml`,
        "application/xml"
      );
    }

    const pdfBuffer = await generarPdfBuffer(
      numFacturaGenerado,
      empObj,
      datosXml.receptor_nombre,
      datosXml.receptor_nit,
      datosXml.fecha_emision,
      datosXml.fecha_vencimiento || datosXml.fecha_emision,
      itemsList,
      datosXml.subtotal,
      datosXml.iva,
      datosXml.total,
      undefined,
      cufeFinal,
      qrCodeUrl
    );

    const pdfUrl = await subirArchivoStorage(
      pdfBuffer,
      empIdNum,
      "pdf",
      `${numFacturaGenerado}.pdf`,
      "application/pdf"
    );

    await supabase
      .from("facturas_emitidas")
      .update({
        cufe: cufeFinal,
        qr_code: qrCodeUrl,
        xml_firmado_url: xmlUrl,
        pdf_url: pdfUrl || pdfUrlInput || null,
      })
      .eq("id", facturaId);

    return {
      success: true,
      facturaId,
      numeroFactura: numFacturaGenerado,
      numeroDocumentoContable: numFacturaGenerado,
      cufe: cufeFinal,
      qrCodeUrl,
      xmlUrl,
      pdfUrl,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Error inesperado al procesar la factura emitida.";
    return { success: false, error: errorMsg };
  }
}

export async function registrarFacturaEmitida(payload: RegistrarFacturaManualPayload) {
  const supabase = getSupabaseAdmin();

  try {
    const { data: resResolucion, error: errResolucion } = await supabase.rpc(
      "obtener_siguiente_consecutivo_factura",
      {
        p_empresa_id: payload.empresa_id,
        p_sucursal_id: payload.sucursal_id,
      }
    );

    if (errResolucion || !resResolucion || !resResolucion.success) {
      return {
        success: false,
        error: resResolucion?.error || errResolucion?.message || "No se pudo obtener el consecutivo de la resolución DIAN activa.",
      };
    }

    const prefijoFactura = resResolucion.prefijo || "";
    const numeroConsecutivoFactura = resResolucion.numero_factura;
    const numeroFacturaOficial = prefijoFactura ? `${prefijoFactura}${numeroConsecutivoFactura}` : String(numeroConsecutivoFactura);

    const { data: resolucionDb } = await supabase
      .from("resoluciones_facturacion")
      .select("*")
      .eq("id", resResolucion.resolucion_id)
      .maybeSingle();

    const longitudCeros = resolucionDb ? String(resolucionDb.consecutivo_final).length : 6;
    const inicialConCeros = resolucionDb ? String(resolucionDb.consecutivo_inicial).padStart(longitudCeros, '0') : "000001";
    const finalConCeros = resolucionDb ? String(resolucionDb.consecutivo_final).padStart(longitudCeros, '0') : "100000";

    const { data: empresaInfo } = await supabase
      .from("empresas")
      .select("razon_social, nit_identificacion, dv, direccion, ciudad, pais, telefono, email")
      .eq("id", payload.empresa_id)
      .maybeSingle();

    const empObj = {
      razon_social: empresaInfo?.razon_social || "EMPRESA S.A.S.",
      nit_identificacion: empresaInfo?.nit_identificacion || "",
      dv: empresaInfo?.dv || "",
      direccion: empresaInfo?.direccion || "",
      ciudad: empresaInfo?.ciudad || "",
      pais: empresaInfo?.pais || "",
      telefono: empresaInfo?.telefono || "",
      email: empresaInfo?.email || "",
    };

    const { data: mapaDoc } = await supabase
      .from("clase_documento_conceptos")
      .select("concepto_auxiliar_debito")
      .eq("empresa_id", payload.empresa_id)
      .eq("clase_documento_id", payload.clase_documento_id)
      .maybeSingle();

    const clienteIdNum = payload.cliente_id !== "" ? Number(payload.cliente_id) : null;

    const itemsFormatted: ItemXml[] = (payload.items || []).map((item) => ({
      item_id: item.item_id !== "" && item.item_id !== null && item.item_id !== undefined ? String(item.item_id) : null,
      codigo_ref: item.codigo,
      nombre_item: item.nombre,
      cantidad: item.cantidad,
      valor_unitario: item.valorUnitario,
      subtotal: item.subtotal,
      porcentaje_iva: item.porcentajeIva,
      valor_iva: item.iva,
      total: item.total,
    }));

    const { data: resultRpc, error: errorRpc } = await supabase.rpc(
      "fn_registrar_factura_emitida_completa",
      {
        p_empresa_id: payload.empresa_id,
        p_sucursal_id: payload.sucursal_id,
        p_clase_documento_id: payload.clase_documento_id,
        p_cliente_id: clienteIdNum,
        p_cliente_nit: payload.cliente_nit,
        p_cliente_nombre: payload.cliente_nombre,
        p_cliente_email: payload.cliente_email || null,
        p_numero_factura: numeroFacturaOficial,
        p_prefijo: prefijoFactura || null,
        p_tipo_documento: payload.tipo_documento || "FACTURA",
        p_fecha_emision: payload.fecha_emision,
        p_fecha_vencimiento: payload.fecha_vencimiento,
        p_fecha_contable: payload.fecha_contable || payload.fecha_emision,
        p_concepto_auxiliar_id: mapaDoc?.concepto_auxiliar_debito || null,
        p_moneda: payload.moneda || "COP",
        p_subtotal: payload.subtotal,
        p_descuentos: payload.descuentos || 0,
        p_iva: payload.iva,
        p_otros_impuestos: payload.otros_impuestos || 0,
        p_retenciones: 0,
        p_total_factura: payload.total_factura,
        p_cufe: null,
        p_xml_firmado_url: null,
        p_pdf_url: null,
        p_qr_code: null,
        p_estado_dian: "PENDIENTE",
        p_estado_cobro: "PENDIENTE",
        p_items: itemsFormatted,
      }
    );

    if (errorRpc || !resultRpc || resultRpc.length === 0) {
      return { success: false, error: errorRpc?.message || "Error al invocar la RPC de registro." };
    }

    const facturaId = resultRpc[0].factura_id;
    const numFacturaGenerado = resultRpc[0].numero_factura || numeroFacturaOficial;
    const numDocumentoContable = resultRpc[0].numero_documento_contable || resultRpc[0].numero_documento || "N/A";

    const cufeGenerado = calcularCufe(
      numFacturaGenerado,
      payload.fecha_emision,
      payload.subtotal,
      payload.iva,
      payload.total_factura,
      empObj.nit_identificacion,
      payload.cliente_nit
    );

    const qrCodeUrl = generarUrlQrDian(
      numFacturaGenerado,
      empObj.nit_identificacion,
      payload.cliente_nit,
      payload.fecha_emision,
      payload.total_factura,
      payload.iva,
      cufeGenerado
    );

    const lineasXml = itemsFormatted
      .map(
        (item, idx) => `
      <cac:InvoiceLine>
        <cbc:ID>${idx + 1}</cbc:ID>
        <cbc:InvoicedQuantity>${item.cantidad}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount>${item.subtotal}</cbc:LineExtensionAmount>
        <cac:Item>
          <cbc:Description>${item.nombre_item}</cbc:Description>
          <cac:SellersItemIdentification><cbc:ID>${item.codigo_ref || ""}</cbc:ID></cac:SellersItemIdentification>
        </cac:Item>
        <cac:Price><cbc:PriceAmount>${item.valor_unitario}</cbc:PriceAmount></cac:Price>
        <cac:TaxTotal>
          <cbc:TaxAmount>${item.valor_iva || 0}</cbc:TaxAmount>
          <cac:TaxSubtotal><cbc:Percent>${item.porcentaje_iva || 0}</cbc:Percent></cac:TaxSubtotal>
        </cac:TaxTotal>
      </cac:InvoiceLine>`
      )
      .join("\n");

    const contenidoXmlManual = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${numFacturaGenerado}</cbc:ID>
  <cbc:UUID schemeName="CUFE-SHA384">${cufeGenerado}</cbc:UUID>
  <cbc:IssueDate>${payload.fecha_emision}</cbc:IssueDate>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyTaxScheme><cbc:CompanyID>${empObj.nit_identificacion}</cbc:CompanyID></cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyTaxScheme><cbc:RegistrationName>${payload.cliente_nombre}</cbc:RegistrationName><cbc:CompanyID>${payload.cliente_nit}</cbc:CompanyID></cac:PartyTaxScheme></cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount>${payload.subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount>${payload.total_factura}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount>${payload.total_factura}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineasXml}
</Invoice>`;

    const xmlUrl = await subirArchivoStorage(
      contenidoXmlManual,
      payload.empresa_id,
      "xml",
      `${numFacturaGenerado}.xml`,
      "application/xml"
    );

    const pdfBuffer = await generarPdfBuffer(
      numFacturaGenerado,
      empObj,
      payload.cliente_nombre,
      payload.cliente_nit,
      payload.fecha_emision,
      payload.fecha_vencimiento,
      itemsFormatted,
      payload.subtotal,
      payload.iva,
      payload.total_factura,
      resolucionDb ? {
        numero_resolucion: resolucionDb.numero_resolucion,
        prefijo: resolucionDb.prefijo,
        consecutivo_inicial: inicialConCeros,
        consecutivo_final: finalConCeros,
        fecha_expedicion: resolucionDb.fecha_expedicion,
        fecha_vigencia_hasta: resolucionDb.fecha_vigencia_hasta
      } : undefined,
      cufeGenerado,
      qrCodeUrl
    );

    const pdfUrl = await subirArchivoStorage(
      pdfBuffer,
      payload.empresa_id,
      "pdf",
      `${numFacturaGenerado}.pdf`,
      "application/pdf"
    );

    await supabase
      .from("facturas_emitidas")
      .update({
        cufe: cufeGenerado,
        qr_code: qrCodeUrl,
        xml_firmado_url: xmlUrl,
        pdf_url: pdfUrl,
      })
      .eq("id", facturaId);

    return {
      success: true,
      facturaId,
      numeroFactura: numFacturaGenerado,
      numeroDocumentoContable: numDocumentoContable,
      cufe: cufeGenerado,
      qrCodeUrl,
      xmlUrl,
      pdfUrl,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Error inesperado al registrar la factura emitida.";
    return { success: false, error: errorMsg };
  }
}