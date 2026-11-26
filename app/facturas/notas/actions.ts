"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseAdminInstance: ReturnType<typeof createClient<any>> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return supabaseAdminInstance;
}

async function resolverEmpresaId(
  empresaId?: number | string | null
): Promise<number> {
  if (
    empresaId !== null &&
    empresaId !== undefined &&
    String(empresaId).trim() !== ""
  ) {
    const num = Number(empresaId);
    return Number.isNaN(num) ? 0 : num;
  }
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  const numCookie = Number(idCookie || 0);
  return Number.isNaN(numCookie) ? 0 : numCookie;
}

export interface DatosXmlNota {
  tipoNota: "CREDITO" | "DEBITO";
  numeroNota: string;
  cude?: string;
  fechaEmision: string;
  subtotal: number;
  impuestos: number;
  montoTotal: number;
  motivo?: string;
  numeroFacturaReferencia?: string;
  cufeFacturaReferencia?: string;
}

export type DatosXmlNotaEmitida = DatosXmlNota;

export async function registrarNotaEmitidaDesdeXml(
  datosXml: DatosXmlNotaEmitida,
  empresaId?: number | string | null,
  sucursalId?: number | string | null,
  fechaContable?: string // Formato YYYY-MM-DD
) {
  try {
    const supabase = getSupabaseAdmin();
    const empIdNum = await resolverEmpresaId(empresaId);
    const sucIdNum =
      sucursalId !== null &&
      sucursalId !== undefined &&
      String(sucursalId).trim() !== ""
        ? Number(sucursalId)
        : null;
    const fechaContableFinal = fechaContable || datosXml.fechaEmision;

    if (!empIdNum) {
      return { success: false, error: "Debe especificar una empresa válida." };
    }

    if (!datosXml.numeroNota?.trim()) {
      return { success: false, error: "El XML no contiene un número de nota válido." };
    }

    // 0. Evitar duplicados de la misma nota en la empresa
    const { data: notaExistente } = await supabase
      .from("notas_emitidas")
      .select("id, numero_nota")
      .eq("empresa_id", empIdNum)
      .eq("numero_nota", datosXml.numeroNota.trim())
      .maybeSingle();

    if (notaExistente) {
      return {
        success: false,
        error: `La nota N° ${datosXml.numeroNota.trim()} ya se encuentra registrada en esta empresa.`,
      };
    }

    // 1. Buscar la factura emitida original por número de factura o CUFE dentro de la empresa
    let query = supabase
      .from("facturas_emitidas")
      .select(
        "id, subtotal, iva, total_factura, empresa_id, cliente_id, cliente_nit, cliente_nombre"
      )
      .eq("empresa_id", empIdNum);

    if (datosXml.numeroFacturaReferencia?.trim()) {
      query = query.eq(
        "numero_factura",
        datosXml.numeroFacturaReferencia.trim()
      );
    } else if (datosXml.cufeFacturaReferencia?.trim()) {
      query = query.eq("cufe", datosXml.cufeFacturaReferencia.trim());
    } else {
      return {
        success: false,
        error:
          "Debe proporcionar el número de factura o el CUFE de referencia.",
      };
    }

    const { data: facturas, error: errorBusqueda } = await query;

    if (errorBusqueda || !facturas || facturas.length === 0) {
      return {
        success: false,
        error: `No se encontró en la empresa seleccionada la factura de venta de referencia (N° ${
          datosXml.numeroFacturaReferencia || "S/N"
        }). Cargue primero la factura original.`,
      };
    }

    const facturaOriginal = facturas[0] as Record<string, unknown>;
    const facturaOriginalId = String(facturaOriginal.id);

    // 2. Insertar en la tabla de notas emitidas
    const { data: notaRegistrada, error: errorNota } = await supabase
      .from("notas_emitidas")
      .insert({
        empresa_id: empIdNum,
        sucursal_id: sucIdNum,
        factura_emitida_id: facturaOriginalId,
        tipo_nota: datosXml.tipoNota,
        numero_nota: datosXml.numeroNota.trim(),
        cude: datosXml.cude || null,
        fecha_emision: datosXml.fechaEmision,
        fecha_contable: fechaContableFinal,
        subtotal: Number(datosXml.subtotal || 0),
        impuestos: Number(datosXml.impuestos || 0),
        monto_total: Number(datosXml.montoTotal || 0),
        motivo: datosXml.motivo || null,
      })
      .select("id, numero_nota")
      .single();

    if (errorNota || !notaRegistrada) {
      return {
        success: false,
        error: `Error al registrar la nota emitida: ${
          errorNota?.message || "No se pudo insertar la nota."
        }`,
      };
    }

    // 3. Reorganizar / actualizar saldos de la factura emitida original
    const esCredito = datosXml.tipoNota === "CREDITO";
    const subOrig = Number(facturaOriginal.subtotal || 0);
    const ivaOrig = Number(facturaOriginal.iva || 0);
    const totOrig = Number(facturaOriginal.total_factura || 0);

    const nuevoSubtotal = esCredito
      ? subOrig - Number(datosXml.subtotal || 0)
      : subOrig + Number(datosXml.subtotal || 0);

    const nuevosImpuestos = esCredito
      ? ivaOrig - Number(datosXml.impuestos || 0)
      : ivaOrig + Number(datosXml.impuestos || 0);

    const nuevoTotal = esCredito
      ? totOrig - Number(datosXml.montoTotal || 0)
      : totOrig + Number(datosXml.montoTotal || 0);

    await supabase
      .from("facturas_emitidas")
      .update({
        subtotal: Math.max(0, Math.round(nuevoSubtotal * 100) / 100),
        iva: Math.max(0, Math.round(nuevosImpuestos * 100) / 100),
        total_factura: Math.max(0, Math.round(nuevoTotal * 100) / 100),
      })
      .eq("id", facturaOriginalId);

    // 4. Invertir / Incrementar Transacción Contable usando la transacción origen de la factura
    const { data: transaccionOrig } = await supabase
      .from("transacciones")
      .select("id")
      .eq("referencia_origen_id", facturaOriginalId)
      .maybeSingle();

    if (transaccionOrig?.id) {
      const { data: detallesOrig } = await supabase
        .from("detalle_transacciones")
        .select("concepto_auxiliar_id, tercero_id, debito, credito")
        .eq("transaccion_id", transaccionOrig.id);

      if (Array.isArray(detallesOrig) && detallesOrig.length > 0) {
        const { data: transaccionNota, error: errTxNota } = await supabase
          .from("transacciones")
          .insert({
            empresa_id: empIdNum,
            sucursal_id: sucIdNum,
            numero_documento: datosXml.numeroNota.trim(),
            fecha_emision: datosXml.fechaEmision,
            fecha_vencimiento: fechaContableFinal,
            glosa_concepto: `Causación Nota ${datosXml.tipoNota} Emitida N° ${
              datosXml.numeroNota.trim()
            } (Ref: ${datosXml.numeroFacturaReferencia || "S/N"})`,
            modulo_origen: "NOTAS_EMITIDAS",
            referencia_origen_id: notaRegistrada.id,
            estado: "Registrado",
          })
          .select("id")
          .single();

        if (transaccionNota?.id && !errTxNota) {
          const proporcion =
            subOrig > 0 ? Number(datosXml.subtotal || 0) / subOrig : 1;

          const nuevosDetalles = detallesOrig.map(
            (d: Record<string, unknown>) => {
              const debitoOrig = Number(d.debito) || 0;
              const creditoOrig = Number(d.credito) || 0;

              return {
                transaccion_id: transaccionNota.id,
                concepto_auxiliar_id: d.concepto_auxiliar_id,
                tercero_id: d.tercero_id,
                debito: esCredito
                  ? Math.round(creditoOrig * proporcion * 100) / 100
                  : Math.round(debitoOrig * proporcion * 100) / 100,
                credito: esCredito
                  ? Math.round(debitoOrig * proporcion * 100) / 100
                  : Math.round(creditoOrig * proporcion * 100) / 100,
              };
            }
          );

          await supabase.from("detalle_transacciones").insert(nuevosDetalles);
        }
      }
    }

    revalidatePath("/facturas/notas");
    revalidatePath("/notas-emitidas");
    revalidatePath("/facturas-emitidas");

    return {
      success: true,
      notaId: notaRegistrada.id,
      numeroNota: notaRegistrada.numero_nota,
    };
  } catch (err: unknown) {
    const mensajeError = err instanceof Error ? err.message : String(err);
    return { success: false, error: mensajeError };
  }
}

export const registrarNotaDesdeXml = registrarNotaEmitidaDesdeXml;