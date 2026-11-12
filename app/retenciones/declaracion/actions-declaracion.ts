"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan las variables de entorno de Supabase.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolverEmpresaId(empresaId?: number | string | null): Promise<number> {
  if (empresaId !== undefined && empresaId !== null && String(empresaId) !== "0" && String(empresaId) !== "") {
    return Number(empresaId);
  }
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
}

export interface EmpresaRow {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  nit?: string;
}

export interface SucursalRow {
  id: number | string;
  nombre?: string;
  codigo_sucursal?: string;
  ciudad?: string;
  departamento?: string;
}

export interface ClaseDocumentoRow {
  id: number | string;
  codigo_clase?: string;
  nombre_clase?: string;
  afecta_caja_bancos?: boolean;
}

export interface ConceptoAuxiliarRow {
  id: number | string;
  codigo_auxiliar?: string;
  nombre?: string;
  elemento?: string;
}

export interface ConceptoRetencionNested {
  id: number | string;
  concepto?: string;
  tarifa?: number;
  concepto_auxiliar_id?: number | string | null;
  concepto_auxiliar_ajuste_debito_id?: number | string | null;
  concepto_auxiliar_ajuste_credito_id?: number | string | null;
}

export interface RetencionMovimientoRow {
  id: number | string;
  empresa_id: number | string;
  sucursal_id?: number | string;
  tercero_id?: number | string;
  base_gravable?: number;
  valor_retencion?: number;
  tipo_retencion?: string;
  tipo_operacion?: string;
  fecha_contable?: string;
  conceptos_retencion?: ConceptoRetencionNested | null;
  [key: string]: unknown;
}

export interface TotalesDeclaracion {
  base: number;
  retencionReal: number;
  retencionAproximada: number;
}

export interface DetalleAgrupadoItem {
  conceptoAuxiliarId: number | string;
  concepto?: string;
  valorRetencionTotal: number;
  ajusteDebitoId?: number | string | null;
  ajusteCreditoId?: number | string | null;
  [key: string]: unknown;
}

// 1. Obtener Empresas ordenadas alfabéticamente
export async function obtenerEmpresas() {
  try {
    const supabase = getSupabaseClient();
    let { data, error } = await supabase
      .from("empresas")
      .select("id, razon_social, nombre_comercial, nit")
      .order("razon_social", { ascending: true });
    
    if (error || !data || data.length === 0) {
      const resAlt = await supabase.from("empresas").select("*").order("razon_social", { ascending: true });
      if (resAlt.error) throw resAlt.error;
      data = resAlt.data;
    }

    return { success: true, data: (data || []) as EmpresaRow[] };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg, data: [] as EmpresaRow[] };
  }
}

// 2. Obtener Sucursales por Empresa
export async function obtenerSucursales(empresaId?: string | number | null) {
  try {
    const supabase = getSupabaseClient();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return { success: true, data: [] as SucursalRow[] };
    }

    const { data, error } = await supabase
      .from("sucursales")
      .select("id, nombre, codigo_sucursal, ciudad, departamento")
      .eq("empresa_id", parsedEmpresaId)
      .order("codigo_sucursal", { ascending: true });

    if (error) throw error;
    return { success: true, data: (data || []) as SucursalRow[] };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg, data: [] as SucursalRow[] };
  }
}

// 3. Obtener Clases de Documento
export async function obtenerClasesDocumento(empresaId?: string | number | null) {
  try {
    const supabase = getSupabaseClient();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return { success: true, data: [] as ClaseDocumentoRow[] };
    }
    
    const { data, error } = await supabase
      .from("clases_documento")
      .select("id, codigo_clase, nombre_clase, afecta_caja_bancos")
      .eq("empresa_id", parsedEmpresaId)
      .eq("afecta_caja_bancos", false)
      .order("codigo_clase", { ascending: true });

    if (error) throw error;

    return { success: true, data: (data || []) as ClaseDocumentoRow[] };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg, data: [] as ClaseDocumentoRow[] };
  }
}

// 4. Obtener Conceptos Auxiliares 
export async function obtenerConceptosAuxiliares(empresaId?: string | number | null) {
  try {
    const supabase = getSupabaseClient();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return { success: true, data: [] as ConceptoAuxiliarRow[] };
    }
    
    let { data, error } = await supabase
      .from("conceptos_auxiliares")
      .select("id, codigo_auxiliar, nombre, elemento")
      .eq("empresa_id", parsedEmpresaId)
      .eq("elemento", "Pasivo")
      .order("codigo_auxiliar", { ascending: true });

    if (error || !data || data.length === 0) {
      const resAlt = await supabase
        .from("conceptos_auxiliares")
        .select("id, codigo_auxiliar, nombre, elemento")
        .limit(300);
      
      if (resAlt.error) throw resAlt.error;
      data = resAlt.data;
    }

    return { success: true, data: (data || []) as ConceptoAuxiliarRow[] };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg, data: [] as ConceptoAuxiliarRow[] };
  }
}

// 5. Consultar movimientos y verificar cierre previo
export async function obtenerMovimientosRetencionesPorPeriodo({
  empresaId,
  sucursalId,
  tipoRetencion,
  periodoDesde,
  periodoHasta,
}: {
  empresaId?: string | number | null;
  sucursalId?: string | number | null;
  tipoRetencion: string;
  periodoDesde: string;
  periodoHasta: string;
}) {
  try {
    const supabase = getSupabaseClient();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return { success: false, error: "No se pudo determinar la empresa activa.", data: [] as RetencionMovimientoRow[], yaCerrado: false };
    }

    let sucursalFinalId: number | string | null = sucursalId !== undefined && sucursalId !== null && String(sucursalId) !== "" ? sucursalId : null;
    if (!sucursalFinalId) {
      const { data: sucDefault } = await supabase
        .from("sucursales")
        .select("id")
        .eq("empresa_id", parsedEmpresaId)
        .eq("codigo_sucursal", "SUC-001")
        .maybeSingle();
      if (sucDefault) sucursalFinalId = sucDefault.id;
    }

    if (sucursalFinalId) {
      const { data: cierreExistente } = await supabase
        .from("cierres")
        .select("numero_documento")
        .eq("empresa_id", parsedEmpresaId)
        .eq("sucursal_id", sucursalFinalId)
        .eq("modulo", "RETENCIONES")
        .eq("subtipo_proceso", tipoRetencion)
        .eq("periodo_desde", periodoDesde)
        .eq("periodo_hasta", periodoHasta)
        .maybeSingle();

      if (cierreExistente) {
        return {
          success: false,
          yaCerrado: true,
          numeroDocumento: cierreExistente.numero_documento,
          error: `⚠️ El proceso de cierre de retenciones (${tipoRetencion}) para este periodo y sucursal ya fue ejecutado previamente bajo el documento N° ${cierreExistente.numero_documento}.`,
          data: [] as RetencionMovimientoRow[],
        };
      }
    }
    
    let query = supabase
      .from("retenciones_movimientos")
      .select(`
        *,
        conceptos_retencion (
          id,
          concepto,
          tarifa,
          concepto_auxiliar_id,
          concepto_auxiliar_ajuste_debito_id,
          concepto_auxiliar_ajuste_credito_id
        )
      `)
      .eq("empresa_id", parsedEmpresaId)
      .eq("tipo_retencion", tipoRetencion)
      .eq("tipo_operacion", "PRACTICADA_A_PROVEEDOR")
      .gte("fecha_contable", periodoDesde)
      .lte("fecha_contable", periodoHasta);

    if (sucursalId !== undefined && sucursalId !== null && String(sucursalId) !== "") {
      query = query.eq("sucursal_id", Number(sucursalId));
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data: (data || []) as RetencionMovimientoRow[], yaCerrado: false };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg, data: [] as RetencionMovimientoRow[], yaCerrado: false };
  }
}

// 6. Registrar Asiento Contable de Cierre de Retenciones
export async function registrarAsientoCierreRetenciones({
  empresaId,
  sucursalId,
  claseDocumentoId,
  conceptoAuxiliarCreditoId,
  tipoRetencion,
  periodoDesde,
  periodoHasta,
  fechaContable,
  totales,
  detallesAgrupados,
}: {
  empresaId?: string | number | null;
  sucursalId?: string | number | null;
  claseDocumentoId: string | number;
  conceptoAuxiliarCreditoId: string | number;
  tipoRetencion: string;
  periodoDesde: string;
  periodoHasta: string;
  fechaContable: string;
  totales: TotalesDeclaracion;
  detallesAgrupados: DetalleAgrupadoItem[];
}) {
  const supabase = getSupabaseClient();
  let transaccionIdCreada: number | string | null = null;
  let consecutivoTomado: number | null = null;

  try {
    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    if (!parsedEmpresaId) {
      throw new Error("No se pudo determinar la empresa activa.");
    }

    let sucursalFinalId: number | string | null = sucursalId !== undefined && sucursalId !== null && String(sucursalId) !== "" ? sucursalId : null;

    if (!sucursalFinalId) {
      const { data: sucDefault } = await supabase
        .from("sucursales")
        .select("id")
        .eq("empresa_id", parsedEmpresaId)
        .eq("codigo_sucursal", "SUC-001")
        .maybeSingle();

      if (sucDefault) {
        sucursalFinalId = sucDefault.id;
      } else {
        const { data: sucAny } = await supabase
          .from("sucursales")
          .select("id")
          .eq("empresa_id", parsedEmpresaId)
          .limit(1)
          .maybeSingle();
        if (sucAny) sucursalFinalId = sucAny.id;
      }
    }

    if (!sucursalFinalId) {
      throw new Error("No se encontró una sucursal válida (SUC-001) para asociar a la transacción.");
    }

    const { data: cierreExistente } = await supabase
      .from("cierres")
      .select("id, numero_documento")
      .eq("empresa_id", parsedEmpresaId)
      .eq("sucursal_id", sucursalFinalId)
      .eq("modulo", "RETENCIONES")
      .eq("subtipo_proceso", tipoRetencion)
      .eq("periodo_desde", periodoDesde)
      .eq("periodo_hasta", periodoHasta)
      .maybeSingle();

    if (cierreExistente) {
      throw new Error(`⚠️ Proceso bloqueado: Ya se efectuó el proceso de cierre de retenciones (${tipoRetencion}) para esta sucursal en el periodo del ${periodoDesde} al ${periodoHasta} bajo el documento N° ${cierreExistente.numero_documento}.`);
    }

    let terceroEmpresaId: number | string | null = null;
    const { data: terceroData } = await supabase
      .from("terceros")
      .select("id")
      .eq("empresa_id", parsedEmpresaId)
      .eq("es_empresa_propia", true)
      .limit(1)
      .maybeSingle();

    if (terceroData) {
      terceroEmpresaId = terceroData.id;
    } else {
      const { data: cualquierTercero } = await supabase
        .from("terceros")
        .select("id")
        .eq("empresa_id", parsedEmpresaId)
        .limit(1)
        .maybeSingle();
      if (cualquierTercero) terceroEmpresaId = cualquierTercero.id;
    }

    if (!terceroEmpresaId) {
      throw new Error("No se encontró ningún tercero registrado para esta empresa en la tabla 'terceros'. Es obligatorio.");
    }

    const { data: claseDocData, error: errClaseDoc } = await supabase
      .from("clases_documento")
      .select("codigo_clase")
      .eq("id", claseDocumentoId)
      .single();

    if (errClaseDoc || !claseDocData) {
      throw new Error("No se pudo obtener la clase de documento.");
    }

    const prefijoClase = claseDocData.codigo_clase || "DOC";

    const { data: consecutivoData, error: errConsGet } = await supabase
      .from("consecutivos")
      .select("id, ultimo_numero, longitud_numero")
      .eq("empresa_id", parsedEmpresaId)
      .eq("clase_documento_id", claseDocumentoId)
      .single();

    if (errConsGet || !consecutivoData) {
      throw new Error("No se encontró un registro de consecutivo configurado para esta clase de documento y empresa.");
    }

    const { data: transaccionesExistentes } = await supabase
      .from("transacciones")
      .select("numero_documento")
      .eq("empresa_id", parsedEmpresaId)
      .eq("clase_documento_id", claseDocumentoId);

    let mayorNumero = Number(consecutivoData.ultimo_numero);

    if (transaccionesExistentes && transaccionesExistentes.length > 0) {
      transaccionesExistentes.forEach((t) => {
        const match = t.numero_documento?.match(/\d+/);
        if (match) {
          const numParsed = parseInt(match[0], 10);
          if (numParsed > mayorNumero) mayorNumero = numParsed;
        }
      });
    }

    consecutivoTomado = mayorNumero + 1;
    const longitudPad = consecutivoData.longitud_numero || 6;
    const numeroSecuencialFormateado = String(consecutivoTomado).padStart(longitudPad, "0");
    const numeroDocumentoFinal = `${prefijoClase}-${numeroSecuencialFormateado}`;

    await supabase
      .from("consecutivos")
      .update({ ultimo_numero: consecutivoTomado })
      .eq("id", consecutivoData.id);

    const fechaContableDoc = periodoHasta; 
    const glosaTexto = `Retenciones de ${tipoRetencion}, Correspondientes al periodo desde ${periodoDesde} hasta ${periodoHasta}`;

    const { data: transaccion, error: errTrans } = await supabase
      .from("transacciones")
      .insert({
        empresa_id: parsedEmpresaId,
        sucursal_id: sucursalFinalId,
        clase_documento_id: claseDocumentoId,
        tercero_id: terceroEmpresaId,
        numero_documento: numeroDocumentoFinal,
        fecha_emision: fechaContableDoc,
        fecha_contable: fechaContableDoc,
        glosa_concepto: glosaTexto,
        modulo_origen: "CONTABILIDAD",
        estado: "Registrado",
      })
      .select("id, numero_documento")
      .single();

    if (errTrans || !transaccion) {
      throw new Error(`Error al crear la cabecera de la transacción: ${errTrans?.message}`);
    }

    transaccionIdCreada = transaccion.id;
    const idTransaccionSeguro = transaccion.id as number | string;

    interface DetalleInsertPayload {
      transaccion_id: number | string;
      concepto_auxiliar_id: number | string;
      tercero_id: number | string;
      debito: number;
      credito: number;
      fecha_contable: string;
    }

    const detallesInsertar: DetalleInsertPayload[] = [];
    let sumaDebitosAproximados = 0;
    let ajusteDebitoConfigId: number | string | null = null;
    let ajusteCreditoConfigId: number | string | null = null;

    for (const item of detallesAgrupados) {
      if (!item.conceptoAuxiliarId) {
        throw new Error(`El concepto "${item.concepto}" no tiene asociado un concepto auxiliar (cuenta de débito).`);
      }

      if (item.ajusteDebitoId) ajusteDebitoConfigId = item.ajusteDebitoId;
      if (item.ajusteCreditoId) ajusteCreditoConfigId = item.ajusteCreditoId;

      const valorAproximadoConcepto = Math.round(item.valorRetencionTotal / 1000) * 1000;
      sumaDebitosAproximados += valorAproximadoConcepto;

      if (valorAproximadoConcepto > 0) {
        detallesInsertar.push({
          transaccion_id: idTransaccionSeguro,
          concepto_auxiliar_id: item.conceptoAuxiliarId,
          tercero_id: terceroEmpresaId,
          debito: valorAproximadoConcepto,
          credito: 0,
          fecha_contable: fechaContableDoc,
        });
      }
    }

    const valorCreditoPrincipal = totales.retencionReal;
    detallesInsertar.push({
      transaccion_id: idTransaccionSeguro,
      concepto_auxiliar_id: conceptoAuxiliarCreditoId,
      tercero_id: terceroEmpresaId,
      debito: 0,
      credito: valorCreditoPrincipal,
      fecha_contable: fechaContableDoc,
    });

    const diferenciaAproximacion = sumaDebitosAproximados - valorCreditoPrincipal;

    if (diferenciaAproximacion > 0) {
      const cuentaCreditoAjuste = ajusteCreditoConfigId;
      if (!cuentaCreditoAjuste) {
        throw new Error(`Existe una diferencia por aproximación de $${diferenciaAproximacion.toLocaleString("es-CO")}. No se encontró configurado el 'concepto_auxiliar_ajuste_credito_id' en los conceptos.`);
      }
      detallesInsertar.push({
        transaccion_id: idTransaccionSeguro,
        concepto_auxiliar_id: cuentaCreditoAjuste,
        tercero_id: terceroEmpresaId,
        debito: 0,
        credito: Math.abs(diferenciaAproximacion),
        fecha_contable: fechaContableDoc,
      });
    } else if (diferenciaAproximacion < 0) {
      const cuentaDebitoAjuste = ajusteDebitoConfigId;
      if (!cuentaDebitoAjuste) {
        throw new Error(`Existe una diferencia por aproximación de $${Math.abs(diferenciaAproximacion).toLocaleString("es-CO")}. No se encontró configurado el 'concepto_auxiliar_ajuste_debito_id' en los conceptos.`);
      }
      detallesInsertar.push({
        transaccion_id: idTransaccionSeguro,
        concepto_auxiliar_id: cuentaDebitoAjuste,
        tercero_id: terceroEmpresaId,
        debito: Math.abs(diferenciaAproximacion),
        credito: 0,
        fecha_contable: fechaContableDoc,
      });
    }

    const { error: errDetalles } = await supabase
      .from("detalle_transacciones")
      .insert(detallesInsertar);

    if (errDetalles) {
      throw new Error(`Error al insertar los detalles del comprobante: ${errDetalles.message}`);
    }

    const { error: errCierreIns } = await supabase
      .from("cierres")
      .insert({
        empresa_id: parsedEmpresaId,
        sucursal_id: sucursalFinalId,
        modulo: "RETENCIONES",
        subtipo_proceso: tipoRetencion,
        periodo_desde: periodoDesde,
        periodo_hasta: periodoHasta,
        transaccion_id: idTransaccionSeguro,
        numero_documento: numeroDocumentoFinal,
      });

    if (errCierreIns) {
      throw new Error(`Error al registrar el control de cierre: ${errCierreIns.message}`);
    }

    return {
      success: true,
      data: {
        numeroDocumento: transaccion.numero_documento,
      },
    };

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (transaccionIdCreada) {
      try {
        await supabase.from("detalle_transacciones").delete().eq("transaccion_id", transaccionIdCreada);
        await supabase.from("transacciones").delete().eq("id", transaccionIdCreada);
      } catch (rollbackErr) {
        console.error("Error ejecutando rollback:", rollbackErr);
      }
    }

    if (consecutivoTomado && claseDocumentoId) {
      try {
        const parsedEmpresaId = await resolverEmpresaId(empresaId);
        await supabase
          .from("consecutivos")
          .update({ ultimo_numero: consecutivoTomado - 1 })
          .eq("empresa_id", parsedEmpresaId)
          .eq("clase_documento_id", claseDocumentoId);
      } catch (consRollbackErr) {
        console.error("Error rollback consecutivo:", consRollbackErr);
      }
    }

    return { success: false, error: errorMsg };
  }
}