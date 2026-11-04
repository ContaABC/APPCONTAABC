"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { jsPDF } from "jspdf";
import crypto from "crypto";
import QRCode from "qrcode";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan variables de entorno para Supabase.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function calcularCude(
  numNota: string,
  fechaEmision: string,
  subtotal: number,
  iva: number,
  total: number,
  nitEmisor: string,
  nitReceptor: string,
  claveTecnica: string = "1234567890SecretKeyDIAN"
): string {
  const valSub = Number(subtotal || 0).toFixed(2);
  const valIva = Number(iva || 0).toFixed(2);
  const valTotal = Number(total || 0).toFixed(2);

  const cadenaCude = `${numNota}${fechaEmision}00:00:00-05:00${valSub}01${valIva}040.00030.00${valTotal}${nitEmisor}${nitReceptor}${claveTecnica}1`;
  return crypto.createHash("sha384").update(cadenaCude).digest("hex");
}

function generarUrlQrNotaDian(
  numNota: string,
  nitEmisor: string,
  nitReceptor: string,
  fechaEmision: string,
  total: number,
  iva: number,
  cude: string
): string {
  const valTotal = Number(total || 0).toFixed(2);
  const valIva = Number(iva || 0).toFixed(2);
  return `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cude}&numfactura=${numNota}&nitemisor=${nitEmisor}&nitreceptor=${nitReceptor}&fecha=${fechaEmision}&valtotal=${valTotal}&valiva=${valIva}`;
}

function numeroALetras(monto: number): string {
  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const decenas = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

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

  if (millones > 0) resultado += (millones === 1 ? "UN MILLON " : convertGroup(millones) + " MILLONES ");
  if (miles > 0) resultado += (miles === 1 ? "UN MIL " : convertGroup(miles) + " MIL ");
  if (resto > 0) resultado += convertGroup(resto) + " ";

  return `SON: ${resultado.trim()} PESOS M/CTE.`;
}

async function subirArchivoStorage(
  contenido: string | Buffer,
  empresaId: number,
  subcarpeta: "xml" | "pdf",
  nombreArchivo: string,
  contentType: string
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const bucketName = "comprobantes";
  const rutaFinal = `${subcarpeta}/empresa_${empresaId}/${nombreArchivo}`;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(rutaFinal, contenido, { contentType, upsert: true });

  if (uploadError) {
    throw new Error(`Error al subir ${rutaFinal} a Storage: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(rutaFinal);
  return data.publicUrl;
}

async function generarPdfNotaBuffer(
  tipoNota: string,
  numeroNota: string,
  empresaInfo: any,
  clienteNombre: string,
  clienteNit: string,
  fechaEmision: string,
  fechaVencimiento: string,
  numeroFacturaAfectada: string,
  items: any[],
  subtotal: number,
  iva: number,
  total: number,
  cude?: string,
  qrUrl?: string
): Promise<Buffer> {
  const doc = new jsPDF();
  const nitEmisor = empresaInfo?.nit_identificacion
    ? `${empresaInfo.nit_identificacion}${empresaInfo.dv ? `-${empresaInfo.dv}` : ""}`
    : "N/A";

  // Cabecera Empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(empresaInfo?.razon_social || "EMPRESA S.A.S.", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`NIT: ${nitEmisor}`, 14, 20);

  const direccionCompleta = [
    empresaInfo?.direccion,
    empresaInfo?.ciudad,
    empresaInfo?.pais
  ].filter(Boolean).join(" - ");

  if (direccionCompleta) {
    doc.text(`Dirección: ${direccionCompleta}`, 14, 24);
  }

  if (empresaInfo?.telefono || empresaInfo?.email) {
    doc.text(`Tel: ${empresaInfo?.telefono || ""} | Email: ${empresaInfo?.email || ""}`, 14, 28);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`NOTA ${tipoNota} N°: ${numeroNota}`, 196, 20, { align: "right" });

  doc.line(14, 32, 196, 32);

  // Datos Cliente, Factura Afectada y Fechas
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL CLIENTE:", 14, 38);
  doc.setFont("helvetica", "normal");
  doc.text(`Cliente: ${clienteNombre}`, 14, 43);
  doc.text(`NIT / CC: ${clienteNit}`, 14, 48);

  doc.setFont("helvetica", "bold");
  doc.text(`Factura Afectada N°: ${numeroFacturaAfectada || "N/A"}`, 14, 53);
  doc.setFont("helvetica", "normal");

  doc.text(`Fecha Emisión: ${fechaEmision}`, 130, 43);
  doc.text(`Fecha Vencimiento: ${fechaVencimiento}`, 130, 48);

  let y = 62;
  doc.setFillColor(242, 242, 242);
  doc.rect(14, y - 5, 182, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.text("Código", 16, y);
  doc.text("Descripción", 42, y);
  doc.text("Cant.", 110, y, { align: "center" });
  doc.text("V. Unitario", 155, y, { align: "right" });
  doc.text("Total", 192, y, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "normal");

  items.forEach((item) => {
    const cod = item.codigo || item.codigo_ref || "-";
    const desc = item.nombre || item.nombre_item || "Ítem de nota";
    doc.text(String(cod), 16, y);
    doc.text(String(desc).substring(0, 38), 42, y);
    doc.text(String(item.cantidad), 110, y, { align: "center" });
    doc.text(`$${Number(item.valorUnitario || item.valor_unitario || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`, 155, y, { align: "right" });
    doc.text(`$${Number(item.total || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`, 192, y, { align: "right" });
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
  doc.text("IVA:", 155, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`$${iva.toLocaleString("es-CO", { minimumFractionDigits: 2 })}`, 192, y, { align: "right" });

  y += 6.5;
  doc.setFont("helvetica", "bold");
  doc.text("Total Nota:", 155, y, { align: "right" });
  doc.text(`$${total.toLocaleString("es-CO", { minimumFractionDigits: 2 })}`, 192, y, { align: "right" });

  y += 10;
  doc.setFontSize(8.5);
  doc.text(numeroALetras(total), 14, y);

  if (cude) {
    y += 10;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("CUDE:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(cude, 140), 14, y + 4);
  }

  if (qrUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 100 });
      doc.addImage(qrDataUrl, "PNG", 160, y - 2, 30, 30);
    } catch (e) {
      console.error("Error generando QR gráfico para PDF:", e);
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export async function obtenerFacturasParaNota(empresaId: string | number, sucursalId: string | number) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("facturas_emitidas")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("sucursal_id", sucursalId)
      .eq("estado_factura", "Activa")
      .gt("saldo_pendiente", 0)
      .order("fecha_emision", { ascending: false });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function obtenerItemsFacturaEmitida(facturaId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("detalle_facturas_emitidas")
      .select("*")
      .eq("factura_id", facturaId);

    if (error) throw new Error(error.message);
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function verificarNotasFactura(facturaId: string | number) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("notas_facturas_emitidas")
      .select("id, numero_nota, tipo_nota, total_nota")
      .eq("factura_emitida_id", facturaId);

    if (error) throw new Error(error.message);

    const tieneNotas = (data || []).length > 0;
    return { success: true, tieneNotas, cantidadNotas: (data || []).length, data: data || [] };
  } catch (err: any) {
    return { success: false, tieneNotas: false, cantidadNotas: 0, data: [], error: err.message };
  }
}

export interface ItemNotaInput {
  item_id?: number | string | null;
  codigo?: string;
  codigo_ref?: string;
  nombre?: string;
  nombre_item?: string;
  cantidad: number;
  valorUnitario: number;
  porcentajeIva: number;
  subtotal: number;
  iva: number;
  total: number;
}

export interface RegistrarNotaPayload {
  empresa_id: number;
  sucursal_id: number;
  clase_documento_id: number;
  factura_emitida_id: string;
  cliente_id: number;
  cliente_nit: string;
  cliente_nombre: string;
  tipo_nota: "CREDITO" | "DEBITO";
  concepto_dian: string;
  fecha_emision: string;
  items: ItemNotaInput[];
}

export async function registrarNotaEmitida(payload: RegistrarNotaPayload) {
  const supabase = getSupabaseAdmin();

  try {
    const itemsValidos = payload.items || [];

    const subtotalReal = itemsValidos.reduce((acc, i) => acc + Number(i.subtotal || 0), 0);
    const ivaReal = itemsValidos.reduce((acc, i) => acc + Number(i.iva || 0), 0);
    const totalReal = subtotalReal + ivaReal;

    const { data: empresaInfo } = await supabase
      .from("empresas")
      .select("razon_social, nit_identificacion, dv, direccion, ciudad, pais, telefono, email")
      .eq("id", payload.empresa_id)
      .maybeSingle();

    const nitEmisor = empresaInfo?.nit_identificacion || "900000000";

    const { data: facturaInfo } = await supabase
      .from("facturas_emitidas")
      .select("fecha_vencimiento, numero_factura, total_factura")
      .eq("id", payload.factura_emitida_id)
      .maybeSingle();

    const fechaVencimientoNota = facturaInfo?.fecha_vencimiento || payload.fecha_emision;
    const numeroFacturaAfectada = facturaInfo?.numero_factura || "";

    let numeroNotaFinal = `NC-${Date.now().toString().slice(-6)}`;
    let prefijoDocumento = "NC";

    const { data: claseDocData } = await supabase
      .from("clases_documento")
      .select("prefijo")
      .eq("id", payload.clase_documento_id)
      .maybeSingle();

    if (claseDocData && claseDocData.prefijo) {
      prefijoDocumento = claseDocData.prefijo;
    }

    const { data: consecutivoData } = await supabase
      .from("consecutivos")
      .select("id, ultimo_numero, prefijo")
      .eq("empresa_id", payload.empresa_id)
      .eq("clase_documento_id", payload.clase_documento_id)
      .maybeSingle();

    if (consecutivoData) {
      if (consecutivoData.prefijo) {
        prefijoDocumento = consecutivoData.prefijo;
      }
      const siguienteNum = (consecutivoData.ultimo_numero || 0) + 1;
      numeroNotaFinal = `${prefijoDocumento}-${String(siguienteNum).padStart(5, "0")}`;

      const { error: errConsecutivo } = await supabase
        .from("consecutivos")
        .update({ ultimo_numero: siguienteNum })
        .eq("id", consecutivoData.id);

      if (errConsecutivo) {
        throw new Error(`Error al actualizar el consecutivo: ${errConsecutivo.message}`);
      }
    } else {
      numeroNotaFinal = `${prefijoDocumento}-00001`;
    }

    const cudeGenerado = calcularCude(
      numeroNotaFinal,
      payload.fecha_emision,
      subtotalReal,
      ivaReal,
      totalReal,
      nitEmisor,
      payload.cliente_nit
    );

    const qrCodeUrl = generarUrlQrNotaDian(
      numeroNotaFinal,
      nitEmisor,
      payload.cliente_nit,
      payload.fecha_emision,
      totalReal,
      ivaReal,
      cudeGenerado
    );

    const lineasXml = itemsValidos
      .map(
        (item, idx) => `
  <cac:CreditNoteLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:CreditedQuantity>${item.cantidad}</cbc:CreditedQuantity>
    <cbc:LineExtensionAmount>${item.subtotal}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Description>${item.nombre || item.nombre_item}</cbc:Description></cac:Item>
    <cac:Price><cbc:PriceAmount>${item.valorUnitario}</cbc:PriceAmount></cac:Price>
  </cac:CreditNoteLine>`
      )
      .join("\n");

    const contenidoXml = `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2">
  <cbc:ID>${numeroNotaFinal}</cbc:ID>
  <cbc:IssueDate>${payload.fecha_emision}</cbc:IssueDate>
  ${lineasXml}
</CreditNote>`;

    const xmlUrl = await subirArchivoStorage(
      contenidoXml,
      payload.empresa_id,
      "xml",
      `${numeroNotaFinal}.xml`,
      "application/xml"
    );

    const pdfBuffer = await generarPdfNotaBuffer(
      payload.tipo_nota,
      numeroNotaFinal,
      empresaInfo,
      payload.cliente_nombre,
      payload.cliente_nit,
      payload.fecha_emision,
      fechaVencimientoNota,
      numeroFacturaAfectada,
      itemsValidos,
      subtotalReal,
      ivaReal,
      totalReal,
      cudeGenerado,
      qrCodeUrl
    );

    const pdfUrl = await subirArchivoStorage(
      pdfBuffer,
      payload.empresa_id,
      "pdf",
      `${numeroNotaFinal}.pdf`,
      "application/pdf"
    );

    const { data: notaInsertada, error: errNota } = await supabase
      .from("notas_facturas_emitidas")
      .insert([
        {
          empresa_id: payload.empresa_id,
          sucursal_id: payload.sucursal_id,
          factura_emitida_id: payload.factura_emitida_id,
          numero_nota: numeroNotaFinal,
          tipo_nota: payload.tipo_nota,
          motivo: payload.concepto_dian,
          fecha_emision: payload.fecha_emision,
          subtotal: subtotalReal,
          impuestos: ivaReal,
          total_nota: totalReal,
          cude: cudeGenerado,
          qr_code: qrCodeUrl,
          xml_firmado_url: xmlUrl,
          pdf_url: pdfUrl,
          estado_dian: "REGISTRADA",
          creado_en: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (errNota) {
      throw new Error(`Error al registrar cabecera de nota: ${errNota.message}`);
    }

    const notaId = notaInsertada.id;

    if (itemsValidos.length > 0) {
      const itemsPayload = itemsValidos.map((i) => ({
        nota_id: notaId,
        empresa_id: payload.empresa_id,
        sucursal_id: payload.sucursal_id,
        item_id: i.item_id ? Number(i.item_id) : null,
        codigo_ref: i.codigo || i.codigo_ref || "",
        nombre_item: i.nombre || i.nombre_item || "Ítem de nota",
        cantidad: Number(i.cantidad) || 0,
        valor_unitario: Number(i.valorUnitario) || 0,
        subtotal: Number(i.subtotal) || 0,
        porcentaje_iva: Number(i.porcentajeIva) || 0,
        valor_iva: Number(i.iva) || 0,
        total: Number(i.total) || 0,
      }));

      const { error: errDetalle } = await supabase
        .from("detalle_notas_facturas_emitidas")
        .insert(itemsPayload);

      if (errDetalle) {
        throw new Error(`Error al registrar detalle de la nota: ${errDetalle.message}`);
      }
    }

    const { data: transaccionOriginal } = await supabase
      .from("transacciones")
      .select("id")
      .eq("referencia_origen_id", payload.factura_emitida_id)
      .maybeSingle();

    let detallesContablesPayload: any[] = [];

    if (transaccionOriginal) {
      const { data: detallesOriginales } = await supabase
        .from("detalle_transacciones")
        .select("concepto_auxiliar_id, tercero_id, debito, credito")
        .eq("transaccion_id", transaccionOriginal.id);

      if (detallesOriginales && detallesOriginales.length > 0) {
        detallesContablesPayload = detallesOriginales.map((d) => {
          const debitoOrig = Number(d.debito || 0);
          const creditoOrig = Number(d.credito || 0);

          if (payload.tipo_nota === "DEBITO") {
            return {
              concepto_auxiliar_id: d.concepto_auxiliar_id,
              tercero_id: d.tercero_id || payload.cliente_id,
              debito: debitoOrig,
              credito: creditoOrig,
            };
          } else {
            return {
              concepto_auxiliar_id: d.concepto_auxiliar_id,
              tercero_id: d.tercero_id || payload.cliente_id,
              debito: creditoOrig,
              credito: debitoOrig,
            };
          }
        });
      }
    }

    const { data: transaccionNueva, error: errTrans } = await supabase
      .from("transacciones")
      .insert([
        {
          empresa_id: payload.empresa_id,
          sucursal_id: payload.sucursal_id,
          clase_documento_id: payload.clase_documento_id,
          tercero_id: payload.cliente_id,
          numero_documento: numeroNotaFinal,
          fecha_emision: payload.fecha_emision,
          fecha_vencimiento: fechaVencimientoNota,
          fecha_contable: payload.fecha_emision,
          glosa_concepto: `Causación Nota ${payload.tipo_nota} N° ${numeroNotaFinal} (${payload.cliente_nombre})`,
          modulo_origen: "FACTURAS_EMITIDAS",
          referencia_origen_id: notaId,
          estado: "Registrado",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (errTrans) {
      throw new Error(`Error al registrar transacción contable: ${errTrans.message}`);
    }

    if (detallesContablesPayload.length > 0) {
      const detalleTransaccionFinal = detallesContablesPayload.map((dt) => ({
        transaccion_id: transaccionNueva.id,
        concepto_auxiliar_id: dt.concepto_auxiliar_id,
        tercero_id: dt.tercero_id,
        debito: dt.debito,
        credito: dt.credito,
      }));

      const { error: errDetalleTrans } = await supabase
        .from("detalle_transacciones")
        .insert(detalleTransaccionFinal);

      if (errDetalleTrans) {
        throw new Error(`Error al registrar el detalle de la transacción: ${errDetalleTrans.message}`);
      }
    }

    const esConceptoAnulacion = String(payload.concepto_dian).trim() === "2";
    if (payload.tipo_nota === "CREDITO" && esConceptoAnulacion) {
      const { error: errFacturaUpd } = await supabase
        .from("facturas_emitidas")
        .update({
          estado_factura: "Anulada",
          estado_cobro: "ANULADA",
          saldo_pendiente: 0,
        })
        .eq("id", payload.factura_emitida_id);

      if (errFacturaUpd) {
        throw new Error(`Error al actualizar el estado de la factura: ${errFacturaUpd.message}`);
      }
    }

    revalidatePath("/notas-emitidas");
    revalidatePath("/facturas/emitir");
    return { success: true, notaId, numeroNota: numeroNotaFinal };
  } catch (err: any) {
    console.error("Excepción en registrarNotaEmitida:", err);
    return { success: false, error: err.message || "Error interno al registrar la nota." };
  }
}