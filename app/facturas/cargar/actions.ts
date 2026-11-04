"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizarNit(nit?: string): string {
  if (!nit) return "";
  return nit.replace(/[\.\-\s]/g, "").trim();
}

/**
 * Parsea un ID a número entero (BIGINT).
 */
function parseNumericId(id: string | number | undefined | null): number {
  if (id === null || id === undefined) return 0;
  const strId = String(id).trim();
  if (!/^\d+$/.test(strId)) return 0;
  const parsed = parseInt(strId, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parsea un valor numérico/moneda de forma segura.
 */
function parseSafeNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  const cleanStr = String(val).replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Garantiza una fecha en formato YYYY-MM-DD válida.
 */
function parseSafeDate(fechaStr?: string): string {
  if (!fechaStr) return new Date().toISOString().split("T")[0];

  const rawClean = fechaStr.split("T")[0].trim();
  const dateObj = new Date(rawClean);

  if (isNaN(dateObj.getTime())) {
    return new Date().toISOString().split("T")[0];
  }

  return rawClean;
}

// ==========================================
// INTERFACES REUTILIZABLES
// ==========================================

export interface DatosXmlItem {
  cufe?: string;
  numero_factura?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  total?: number;
  subtotal?: number;
  iva?: number;
  emisor_nit?: string;
  emisor_nombre?: string;
  receptor_nit?: string;
  receptor_nombre?: string;
  contenidoXml?: string; // Raw text del XML
  pdfUrl?: string; // Opcional
  
  // Nuevos campos opcionales para ajuste manual o masivo de retenciones
  retencion_renta_id?: string | number | null;
  retencion_iva_id?: string | number | null;
  retencion_ica_id?: string | number | null;
}

export interface ResultadoFacturaItem {
  numeroFactura: string;
  exito: boolean;
  facturaId?: number | string | null;
  error?: string | null;
}

// ==========================================
// 1. CARGA INDIVIDUAL
// ==========================================

export async function procesarFacturaXmlAdmin(
  datosXml: DatosXmlItem,
  empresaId: string | number,
  sucursalId: string | number,
  claseDocumentoId: string | number,
  contenidoXml?: string, // Contenido raw en texto del archivo XML
  pdfUrl?: string, // URL del archivo PDF si se provee
  fechaContabilidad?: string, // Fecha de contabilidad seleccionada por el usuario en pantalla
  retencionesManuales?: {
    retencion_renta_id?: string | number | null;
    retencion_iva_id?: string | number | null;
    retencion_ica_id?: string | number | null;
  }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const parsedEmpresaId = parseNumericId(empresaId);
    const parsedSucursalId = parseNumericId(sucursalId);
    const parsedClaseDocId = parseNumericId(claseDocumentoId);

    if (!parsedEmpresaId) throw new Error("Debe seleccionar una empresa válida (ID numérico inválido).");
    if (!parsedSucursalId) throw new Error("Debe seleccionar una sucursal válida (ID numérico inválido).");
    if (!parsedClaseDocId) throw new Error("Debe seleccionar una clase de documento válida (ID numérico inválido).");

    const nitEmisorRaw = datosXml.emisor_nit?.trim();
    const nitEmisorLimpio = normalizarNit(nitEmisorRaw);
    const nombreEmisor = datosXml.emisor_nombre?.trim() || "PROVEEDOR DESCONOCIDO";
    const nitReceptorXml = datosXml.receptor_nit?.trim();

    if (!nitEmisorRaw) throw new Error("El NIT del emisor es obligatorio en el XML.");
    if (!nitReceptorXml) throw new Error("El NIT del receptor no se encontró en el XML.");

    // 1. Validar Empresa
    const { data: empresaData, error: errorEmpresa } = await supabaseAdmin
      .from("empresas")
      .select("*")
      .eq("id", parsedEmpresaId)
      .single();

    if (errorEmpresa || !empresaData) {
      throw new Error("No se pudo obtener la información de la empresa seleccionada.");
    }

    const nitEmpresaDB =
      empresaData.nit ||
      empresaData.nit_identificacion ||
      empresaData.numero_identificacion ||
      "";
    const nitEmpresaLimpio = normalizarNit(nitEmpresaDB);
    const nitReceptorLimpio = normalizarNit(nitReceptorXml);

    if (
      nitEmpresaLimpio &&
      !nitReceptorLimpio.startsWith(nitEmpresaLimpio) &&
      !nitEmpresaLimpio.startsWith(nitReceptorLimpio)
    ) {
      const nombreEmpresa =
        empresaData.razon_social || empresaData.nombre_comercial || "la empresa activa";
      throw new Error(
        `La factura fue emitida para el NIT ${nitReceptorXml}, pero la empresa seleccionada es ${nombreEmpresa} (NIT ${nitEmpresaDB}).`
      );
    }

    // 2. Buscar Tercero por Empresa (Incluyendo sus retenciones por defecto configuradas)
    const { data: tercerosEmpresa, error: errorTercero } = await supabaseAdmin
      .from("terceros")
      .select("id, numero_identificacion, retencion_renta_id, retencion_iva_id, retencion_ica_id")
      .eq("empresa_id", parsedEmpresaId);

    if (errorTercero) throw new Error(`Error al consultar tercero: ${errorTercero.message}`);

    const terceroEncontrado = tercerosEmpresa?.find((t) => {
      const nitDB = normalizarNit(String(t.numero_identificacion || ""));
      return (
        nitDB === nitEmisorLimpio ||
        nitDB.startsWith(nitEmisorLimpio) ||
        nitEmisorLimpio.startsWith(nitDB)
      );
    });

    if (!terceroEncontrado) {
      throw new Error(
        `El proveedor con NIT ${nitEmisorRaw} (${nombreEmisor}) no se encuentra registrado en la empresa seleccionada.`
      );
    }

    const terceroIdNum = parseNumericId(terceroEncontrado.id);
    if (!terceroIdNum) {
      throw new Error(
        `El tercero encontrado con NIT ${nitEmisorRaw} tiene un ID no válido: "${terceroEncontrado.id}". Debe ser un número entero (BIGINT).`
      );
    }

    // Resolver Retenciones: Prioridad -> 1. Ajuste Manual/Pantalla, 2. Propiedad del Objeto XML, 3. Configuración por defecto del Tercero
  const rentaIdFinal = parseNumericId(
    retencionesManuales?.retencion_renta_id ?? datosXml.retencion_renta_id ?? terceroEncontrado.retencion_renta_id
  );
  const ivaIdFinal = parseNumericId(
    retencionesManuales?.retencion_iva_id ?? datosXml.retencion_iva_id ?? terceroEncontrado.retencion_iva_id
  );
  const icaIdFinal = parseNumericId(
    retencionesManuales?.retencion_ica_id ?? datosXml.retencion_ica_id ?? terceroEncontrado.retencion_ica_id
  );

    // 3. Obtener el prefijo/sigla de la Clase de Documento
    const { data: claseDocData } = await supabaseAdmin
      .from("clases_documento")
      .select("codigo_clase, sigla")
      .eq("id", parsedClaseDocId)
      .maybeSingle();

    const prefijoClase = claseDocData?.sigla || claseDocData?.codigo_clase || "FC";

    // 4. Obtener Conceptos Auxiliares (Débito y Crédito)
    const { data: mapaConceptos } = await supabaseAdmin
      .from("clase_documento_conceptos")
      .select("concepto_auxiliar_debito, concepto_auxiliar_credito")
      .eq("clase_documento_id", parsedClaseDocId)
      .eq("empresa_id", parsedEmpresaId)
      .maybeSingle();

    const conceptoDebitoId = parseNumericId(mapaConceptos?.concepto_auxiliar_debito);
    const conceptoCreditoId = parseNumericId(mapaConceptos?.concepto_auxiliar_credito);

    if (!conceptoDebitoId || !conceptoCreditoId) {
      throw new Error(
        "La Clase de Documento seleccionada no tiene parametrizados los Conceptos Débito y Crédito en la sección de parametrización."
      );
    }

    // 5. Carga del archivo XML al Bucket Storage 'facturas-xml'
    const xmlFinalContent = contenidoXml || datosXml.contenidoXml;
    let xmlUrlStored: string | null = null;

    if (xmlFinalContent) {
      const numFacturaClean = (datosXml.numero_factura || "FAC").replace(/[^a-zA-Z0-9_.-]/g, "_");
      const storagePath = `${parsedEmpresaId}/${Date.now()}_${numFacturaClean}.xml`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("facturas-xml")
        .upload(storagePath, xmlFinalContent, {
          contentType: "application/xml",
          upsert: true,
        });

      if (uploadError) {
        console.warn("Error al subir archivo a Storage 'facturas-xml':", uploadError.message);
      } else if (uploadData) {
        const { data: publicUrlData } = supabaseAdmin.storage
          .from("facturas-xml")
          .getPublicUrl(storagePath);

        xmlUrlStored = publicUrlData.publicUrl;
      }
    }

    const fechaEmisionFormatted = parseSafeDate(datosXml.fecha_emision);
    const fechaVencFormatted = datosXml.fecha_vencimiento
      ? parseSafeDate(datosXml.fecha_vencimiento)
      : fechaEmisionFormatted;
    
    const fechaContabilidadFormatted = parseSafeDate(fechaContabilidad);

    // 6. Payload con inclusión de retenciones resueltas para la RPC
    const rpcPayload = {
      p_empresa_id: parsedEmpresaId,
      p_sucursal_id: parsedSucursalId,
      p_clase_documento_id: parsedClaseDocId,
      p_tercero_id: terceroIdNum,
      p_tercero_nit: String(nitEmisorRaw),
      p_tercero_nombre: String(nombreEmisor),
      p_numero_factura: String(datosXml.numero_factura || "SF"),
      p_prefijo_clase: String(prefijoClase),
      p_fecha_emision: fechaEmisionFormatted,
      p_fecha_vencimiento: fechaVencFormatted,
      p_fecha_contabilidad: fechaContabilidadFormatted,
      p_subtotal: parseSafeNumber(datosXml.subtotal),
      p_impuestos: parseSafeNumber(datosXml.iva),
      p_total_factura: parseSafeNumber(datosXml.total),
      p_cufe_cude: datosXml.cufe ? String(datosXml.cufe).trim() : null,
      p_debito_id: conceptoDebitoId,
      p_credito_id: conceptoCreditoId,
      p_xml_url: xmlUrlStored,
      p_pdf_url: pdfUrl || datosXml.pdfUrl ? String(pdfUrl || datosXml.pdfUrl).trim() : null,
      
      // Nuevos parámetros de retención enviados a la base de datos
      p_retencion_renta_id: rentaIdFinal > 0 ? rentaIdFinal : null,
      p_retencion_iva_id: ivaIdFinal > 0 ? ivaIdFinal : null,
      p_retencion_ica_id: icaIdFinal > 0 ? icaIdFinal : null,
    };

    console.log("PAYLOAD SANITIZADO RPC CON RETENCIONES AUTOMÁTICAS Y MANUALES:", rpcPayload);

    // 7. Inserción Atómica llamando a la RPC
    const { data: facturaId, error: errorRpc } = await supabaseAdmin.rpc(
      "fn_registrar_factura_recibida_completa",
      rpcPayload
    );

    if (errorRpc) {
      console.error("Error en RPC fn_registrar_factura_recibida_completa:", errorRpc);
      throw new Error(errorRpc.message);
    }

    return {
      success: true,
      data: { 
        facturaId, 
        xmlUrl: xmlUrlStored,
        retencionesAplicadas: {
          rentaId: rentaIdFinal,
          ivaId: ivaIdFinal,
          icaId: icaIdFinal,
        }
      },
      error: null,
    };
  } catch (err: any) {
    console.error("Error en procesarFacturaXmlAdmin:", err);
    return {
      success: false,
      data: null,
      error: err.message || "Error al procesar la factura.",
    };
  }
}

// ==========================================
// 2. CARGA MASIVA EN LOTE
// ==========================================

export async function procesarFacturasXmlMasivoAdmin(
  listaXml: DatosXmlItem[],
  empresaId: string | number,
  sucursalId: string | number,
  claseDocumentoId: string | number,
  fechaContabilidad?: string
) {
  if (!listaXml || listaXml.length === 0) {
    return {
      success: false,
      error: "No se recibieron facturas para procesar.",
      resumen: { total: 0, exitosos: 0, fallidos: 0 },
      detalle: [],
    };
  }

  const detalleResultados: ResultadoFacturaItem[] = [];
  let exitososCount = 0;
  let fallidosCount = 0;

  // Iterar y procesar cada factura reutilizando de manera segura la función individual
  for (const itemXml of listaXml) {
    const numFactura = itemXml.numero_factura || "SIN_NUMERO";

    try {
      // Al ser masivo, si el objeto itemXml trae explícitamente retenciones (ej. desde un Excel cargado), 
      // se le pasarán automáticamente a la función individual. De lo contrario, heredará los del tercero.
      const res = await procesarFacturaXmlAdmin(
        itemXml,
        empresaId,
        sucursalId,
        claseDocumentoId,
        itemXml.contenidoXml,
        itemXml.pdfUrl,
        fechaContabilidad,
        {
          retencion_renta_id: itemXml.retencion_renta_id,
          retencion_iva_id: itemXml.retencion_iva_id,
          retencion_ica_id: itemXml.retencion_ica_id,
        }
      );

      if (res.success) {
        exitososCount++;
        detalleResultados.push({
          numeroFactura: numFactura,
          exito: true,
          facturaId: res.data?.facturaId,
          error: null,
        });
      } else {
        fallidosCount++;
        detalleResultados.push({
          numeroFactura: numFactura,
          exito: false,
          error: res.error,
        });
      }
    } catch (err: any) {
      fallidosCount++;
      detalleResultados.push({
        numeroFactura: numFactura,
        exito: false,
        error: err.message || "Error desconocido durante la ejecución.",
      });
    }
  }

  return {
    success: exitososCount > 0,
    resumen: {
      total: listaXml.length,
      exitosos: exitososCount,
      fallidos: fallidosCount,
    },
    detalle: detalleResultados,
  };
}