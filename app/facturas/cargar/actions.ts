"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseNumericId(id: string | number | undefined | null): number {
  if (id === null || id === undefined) return 0;
  const strId = String(id).trim();
  if (!/^\d+$/.test(strId)) return 0;
  const parsed = parseInt(strId, 10);
  return isNaN(parsed) ? 0 : parsed;
}

async function resolverEmpresaId(
  empresaId?: number | string | null
): Promise<number> {
  if (
    empresaId !== null &&
    empresaId !== undefined &&
    String(empresaId).trim() !== ""
  ) {
    const parsed = parseNumericId(empresaId);
    if (parsed > 0) return parsed;
  }
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return parseNumericId(idCookie);
}

async function validarEmpresaAsignadaUsuario(
  empresaId: number
): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const cookieStore = await cookies();
    const token =
      cookieStore.get("sb-access-token")?.value ||
      cookieStore.get("supabase-auth-token")?.value;

    if (!token) return true;

    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);

    if (!user) return true;

    const { data: permisos, error } = await supabaseAdmin
      .from("usuario_permisos_tx")
      .select("empresa_id")
      .eq("usuario_id", user.id)
      .eq("empresa_id", empresaId);

    if (error) return true;
    return Array.isArray(permisos) && permisos.length > 0;
  } catch {
    return true;
  }
}

function normalizarNit(nit?: string): string {
  if (!nit) return "";
  return nit.replace(/[.\-\s]/g, "").trim();
}

function nitBaseSinDv(nitLimpio: string): string {
  // Si el NIT tiene más de 8 dígitos, el último suele ser dígito de verificación en CO
  if (nitLimpio.length > 8) {
    return nitLimpio.slice(0, -1);
  }
  return nitLimpio;
}

function nitsCoinciden(nitA?: string, nitB?: string): boolean {
  const a = normalizarNit(nitA);
  const b = normalizarNit(nitB);
  if (!a || !b) return false;
  if (a === b) return true;
  return nitBaseSinDv(a) === nitBaseSinDv(b);
}

function parseSafeNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  const str = String(val).trim();
  if (!str) return 0;

  // Soporta formato con miles/decimales de forma segura
  const cleanStr = str.replace(/[^\d.,-]/g, "");
  const normalized =
    cleanStr.includes(",") && !cleanStr.includes(".")
      ? cleanStr.replace(",", ".")
      : cleanStr.replace(/,/g, "");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

function parseSafeDate(fechaStr?: string): string {
  const hoy = new Date().toISOString().split("T")[0];
  if (!fechaStr) return hoy;

  const rawClean = fechaStr.split("T")[0].trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawClean)) {
    const check = new Date(`${rawClean}T00:00:00Z`);
    if (!isNaN(check.getTime())) return rawClean;
  }

  const dateObj = new Date(rawClean);
  if (isNaN(dateObj.getTime())) {
    return hoy;
  }

  return dateObj.toISOString().split("T")[0];
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
  contenidoXml?: string;
  pdfUrl?: string;

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
  empresaId?: string | number | null,
  sucursalId?: string | number | null,
  claseDocumentoId?: string | number | null,
  contenidoXml?: string,
  pdfUrl?: string,
  fechaContabilidad?: string,
  retencionesManuales?: {
    retencion_renta_id?: string | number | null;
    retencion_iva_id?: string | number | null;
    retencion_ica_id?: string | number | null;
  }
) {
  let uploadedStoragePath: string | null = null;

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    const parsedSucursalId = parseNumericId(sucursalId);
    const parsedClaseDocId = parseNumericId(claseDocumentoId);

    if (!parsedEmpresaId) {
      throw new Error(
        "Debe seleccionar una empresa válida (ID numérico inválido)."
      );
    }
    if (!parsedSucursalId) {
      throw new Error(
        "Debe seleccionar una sucursal válida (ID numérico inválido)."
      );
    }
    if (!parsedClaseDocId) {
      throw new Error(
        "Debe seleccionar una clase de documento válida (ID numérico inválido)."
      );
    }

    const nitEmisorRaw = datosXml.emisor_nit?.trim();
    const nombreEmisor =
      datosXml.emisor_nombre?.trim() || "PROVEEDOR DESCONOCIDO";
    const nitReceptorXml = datosXml.receptor_nit?.trim();

    if (!nitEmisorRaw) {
      throw new Error("El NIT del emisor es obligatorio en el XML.");
    }
    if (!nitReceptorXml) {
      throw new Error("El NIT del receptor no se encontró en el XML.");
    }

    // 1. Validar Empresa
    const { data: empresaData, error: errorEmpresa } = await supabaseAdmin
      .from("empresas")
      .select("*")
      .eq("id", parsedEmpresaId)
      .single();

    if (errorEmpresa || !empresaData) {
      throw new Error(
        "No se pudo obtener la información de la empresa seleccionada."
      );
    }

    // 1.1 Validar permisos de empresa asignada al usuario
    const tienePermisoEmpresa = await validarEmpresaAsignadaUsuario(
      parsedEmpresaId
    );
    if (!tienePermisoEmpresa) {
      throw new Error(
        "No tiene permisos asignados para operar en la empresa seleccionada."
      );
    }

    // 2. Validar que la Sucursal pertenezca a la Empresa seleccionada
    const { data: sucursalData, error: errorSucursal } = await supabaseAdmin
      .from("sucursales")
      .select("id, empresa_id")
      .eq("id", parsedSucursalId)
      .eq("empresa_id", parsedEmpresaId)
      .maybeSingle();

    if (errorSucursal || !sucursalData) {
      throw new Error(
        "La sucursal seleccionada no pertenece a la empresa activa."
      );
    }

    const nitEmpresaDB =
      empresaData.nit ||
      empresaData.nit_identificacion ||
      empresaData.numero_identificacion ||
      "";
    const nitEmpresaLimpio = normalizarNit(nitEmpresaDB);

    if (nitEmpresaLimpio && !nitsCoinciden(nitEmpresaDB, nitReceptorXml)) {
      const nombreEmpresa =
        empresaData.razon_social ||
        empresaData.nombre_comercial ||
        "la empresa activa";
      throw new Error(
        `La factura fue emitida para el NIT ${nitReceptorXml}, pero la empresa seleccionada es ${nombreEmpresa} (NIT ${nitEmpresaDB}).`
      );
    }

    // 3. Buscar Tercero por Empresa (Incluyendo sus retenciones por defecto configuradas)
    const { data: tercerosEmpresa, error: errorTercero } = await supabaseAdmin
      .from("terceros")
      .select(
        "id, numero_identificacion, retencion_renta_id, retencion_iva_id, retencion_ica_id"
      )
      .eq("empresa_id", parsedEmpresaId);

    if (errorTercero) {
      throw new Error(`Error al consultar tercero: ${errorTercero.message}`);
    }

    const terceroEncontrado = tercerosEmpresa?.find((t) =>
      nitsCoinciden(String(t.numero_identificacion || ""), nitEmisorRaw)
    );

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

    // Resolver Retenciones: Prioridad -> 1. Ajuste Manual, 2. Objeto XML, 3. Configuración del Tercero
    const rentaIdFinal = parseNumericId(
      retencionesManuales?.retencion_renta_id ??
        datosXml.retencion_renta_id ??
        terceroEncontrado.retencion_renta_id
    );
    const ivaIdFinal = parseNumericId(
      retencionesManuales?.retencion_iva_id ??
        datosXml.retencion_iva_id ??
        terceroEncontrado.retencion_iva_id
    );
    const icaIdFinal = parseNumericId(
      retencionesManuales?.retencion_ica_id ??
        datosXml.retencion_ica_id ??
        terceroEncontrado.retencion_ica_id
    );

    // 4. Obtener el prefijo/sigla de la Clase de Documento
    const { data: claseDocData } = await supabaseAdmin
      .from("clases_documento")
      .select("codigo_clase, sigla")
      .eq("id", parsedClaseDocId)
      .maybeSingle();

    const prefijoClase =
      claseDocData?.sigla || claseDocData?.codigo_clase || "FC";

    // 5. Obtener Conceptos Auxiliares (Débito y Crédito)
    const { data: mapaConceptos } = await supabaseAdmin
      .from("clase_documento_conceptos")
      .select("concepto_auxiliar_debito, concepto_auxiliar_credito")
      .eq("clase_documento_id", parsedClaseDocId)
      .eq("empresa_id", parsedEmpresaId)
      .maybeSingle();

    const conceptoDebitoId = parseNumericId(
      mapaConceptos?.concepto_auxiliar_debito
    );
    const conceptoCreditoId = parseNumericId(
      mapaConceptos?.concepto_auxiliar_credito
    );

    if (!conceptoDebitoId || !conceptoCreditoId) {
      throw new Error(
        "La Clase de Documento seleccionada no tiene parametrizados los Conceptos Débito y Crédito en la sección de parametrización."
      );
    }

    // 6. Carga del archivo XML al Bucket Storage 'facturas-xml'
    const xmlFinalContent = contenidoXml || datosXml.contenidoXml;
    let xmlUrlStored: string | null = null;

    if (xmlFinalContent) {
      const numFacturaClean = (datosXml.numero_factura || "FAC").replace(
        /[^a-zA-Z0-9_.-]/g,
        "_"
      );
      const storagePath = `${parsedEmpresaId}/${Date.now()}_${numFacturaClean}.xml`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("facturas-xml")
        .upload(storagePath, xmlFinalContent, {
          contentType: "application/xml",
          upsert: true,
        });

      if (uploadError) {
        console.warn(
          "Error al subir archivo a Storage 'facturas-xml':",
          uploadError.message
        );
      } else if (uploadData) {
        uploadedStoragePath = storagePath;
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

    const totalNum = parseSafeNumber(datosXml.total);
    const impuestosNum = parseSafeNumber(datosXml.iva);
    const subtotalNum =
      datosXml.subtotal !== undefined && datosXml.subtotal !== null
        ? parseSafeNumber(datosXml.subtotal)
        : Math.max(0, totalNum - impuestosNum);

    const pdfFinalRaw = pdfUrl || datosXml.pdfUrl;
    const pdfUrlFinal =
      pdfFinalRaw && String(pdfFinalRaw).trim() !== ""
        ? String(pdfFinalRaw).trim()
        : null;

    // 7. Payload con inclusión de retenciones resueltas para la RPC
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
      p_subtotal: subtotalNum,
      p_impuestos: impuestosNum,
      p_total_factura: totalNum,
      p_cufe_cude: datosXml.cufe ? String(datosXml.cufe).trim() : null,
      p_debito_id: conceptoDebitoId,
      p_credito_id: conceptoCreditoId,
      p_xml_url: xmlUrlStored,
      p_pdf_url: pdfUrlFinal,

      p_retencion_renta_id: rentaIdFinal > 0 ? rentaIdFinal : null,
      p_retencion_iva_id: ivaIdFinal > 0 ? ivaIdFinal : null,
      p_retencion_ica_id: icaIdFinal > 0 ? icaIdFinal : null,
    };

    // 8. Inserción Atómica llamando a la RPC
    const { data: facturaId, error: errorRpc } = await supabaseAdmin.rpc(
      "fn_registrar_factura_recibida_completa",
      rpcPayload
    );

    if (errorRpc) {
      if (uploadedStoragePath) {
        await supabaseAdmin.storage
          .from("facturas-xml")
          .remove([uploadedStoragePath]);
      }
      console.error(
        "Error en RPC fn_registrar_factura_recibida_completa:",
        errorRpc
      );
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
        },
      },
      error: null,
    };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error ? err.message : "Error al procesar la factura.";
    console.error("Error en procesarFacturaXmlAdmin:", mensaje);
    return {
      success: false,
      data: null,
      error: mensaje,
    };
  }
}

// ==========================================
// 2. CARGA MASIVA EN LOTE
// ==========================================

export async function procesarFacturasXmlMasivoAdmin(
  listaXml: DatosXmlItem[],
  empresaId?: string | number | null,
  sucursalId?: string | number | null,
  claseDocumentoId?: string | number | null,
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

  const empresaLoteId = await resolverEmpresaId(empresaId);
  if (!empresaLoteId) {
    return {
      success: false,
      error:
        "No se pudo determinar una empresa activa válida para el cargue masivo.",
      resumen: { total: listaXml.length, exitosos: 0, fallidos: listaXml.length },
      detalle: listaXml.map((item) => ({
        numeroFactura: item.numero_factura || "SIN_NUMERO",
        exito: false,
        error: "Empresa activa no válida.",
      })),
    };
  }

  const detalleResultados: ResultadoFacturaItem[] = [];
  let exitososCount = 0;
  let fallidosCount = 0;

  for (const itemXml of listaXml) {
    const numFactura = itemXml.numero_factura || "SIN_NUMERO";

    try {
      const res = await procesarFacturaXmlAdmin(
        itemXml,
        empresaLoteId,
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
    } catch (err: unknown) {
      fallidosCount++;
      const mensaje =
        err instanceof Error
          ? err.message
          : "Error desconocido durante la ejecución.";
      detalleResultados.push({
        numeroFactura: numFactura,
        exito: false,
        error: mensaje,
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