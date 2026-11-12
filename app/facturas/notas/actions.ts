"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

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

async function resolverEmpresaId(empresaId?: number | string | null): Promise<number> {
  if (empresaId) return Number(empresaId);
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
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
  const supabase = getSupabaseAdmin();

  try {
    const empIdNum = await resolverEmpresaId(empresaId);
    const sucIdNum = sucursalId ? Number(sucursalId) : null;
    const fechaContableFinal = fechaContable || datosXml.fechaEmision;

    if (!empIdNum) {
      return { success: false, error: "Debe especificar una empresa válida." };
    }

    // 1. Buscar la factura emitida original por número de factura o CUFE dentro de la empresa
    let query = supabase
      .from("facturas_emitidas")
      .select("id, subtotal, iva, total_factura, empresa_id, cliente_id, cliente_nit, cliente_nombre")
      .eq("empresa_id", empIdNum);

    if (datosXml.numeroFacturaReferencia) {
      query = query.eq("numero_factura", datosXml.numeroFacturaReferencia);
    } else if (datosXml.cufeFacturaReferencia) {
      query = query.eq("cufe", datosXml.cufeFacturaReferencia);
    } else {
      return { success: false, error: "Debe proporcionar el número de factura o el CUFE de referencia." };
    }

    const { data: facturas, error: errorBusqueda } = await query;

    if (errorBusqueda || !facturas || facturas.length === 0) {
      return {
        success: false,
        error: `No se encontró en la empresa seleccionada la factura de venta de referencia (N° ${datosXml.numeroFacturaReferencia || "S/N"}). Cargue primero la factura original.`,
      };
    }

    const facturaOriginal = facturas[0];

    // 2. Insertar en la tabla de notas emitidas
    const { data: notaRegistrada, error: errorNota } = await supabase
      .from("notas_emitidas")
      .insert({
        empresa_id: empIdNum,
        sucursal_id: sucIdNum,
        factura_emitida_id: facturaOriginal.id,
        tipo_nota: datosXml.tipoNota,
        numero_nota: datosXml.numeroNota,
        cude: datosXml.cude || null,
        fecha_emision: datosXml.fechaEmision,
        fecha_contable: fechaContableFinal,
        subtotal: datosXml.subtotal,
        impuestos: datosXml.impuestos,
        monto_total: datosXml.montoTotal,
        motivo: datosXml.motivo || null,
      })
      .select()
      .single();

    if (errorNota) {
      return { success: false, error: `Error al registrar la nota emitida: ${errorNota.message}` };
    }

    // 3. Reorganizar / actualizar saldos de la factura emitida original
    const esCredito = datosXml.tipoNota === "CREDITO";

    const nuevoSubtotal = esCredito
      ? Number(facturaOriginal.subtotal) - datosXml.subtotal
      : Number(facturaOriginal.subtotal) + datosXml.subtotal;

    const nuevosImpuestos = esCredito
      ? Number(facturaOriginal.iva) - datosXml.impuestos
      : Number(facturaOriginal.iva) + datosXml.impuestos;

    const nuevoTotal = esCredito
      ? Number(facturaOriginal.total_factura) - datosXml.montoTotal
      : Number(facturaOriginal.total_factura) + datosXml.montoTotal;

    await supabase
      .from("facturas_emitidas")
      .update({
        subtotal: Math.max(0, nuevoSubtotal),
        iva: Math.max(0, nuevosImpuestos),
        total_factura: Math.max(0, nuevoTotal),
      })
      .eq("id", facturaOriginal.id);

    // 4. Invertir / Incrementar Transacción Contable usando la transacción origen de la factura
    const { data: transaccionOrig } = await supabase
      .from("transacciones")
      .select("id")
      .eq("referencia_origen_id", facturaOriginal.id)
      .maybeSingle();

    if (transaccionOrig) {
      const { data: detallesOrig } = await supabase
        .from("detalle_transacciones")
        .select("*")
        .eq("transaccion_id", transaccionOrig.id);

      if (detallesOrig && detallesOrig.length > 0) {
        const { data: transaccionNota, error: errTxNota } = await supabase
          .from("transacciones")
          .insert({
            empresa_id: empIdNum,
            sucursal_id: sucIdNum,
            numero_documento: datosXml.numeroNota,
            fecha_emision: datosXml.fechaEmision,
            fecha_vencimiento: fechaContableFinal,
            glosa_concepto: `Causación Nota ${datosXml.tipoNota} Emitida N° ${datosXml.numeroNota} (Ref: ${datosXml.numeroFacturaReferencia || "S/N"})`,
            modulo_origen: "NOTAS_EMITIDAS",
            referencia_origen_id: notaRegistrada.id,
            estado: "Registrado",
          })
          .select("id")
          .single();

        if (transaccionNota && !errTxNota) {
          const proporcion =
            Number(facturaOriginal.subtotal) > 0
              ? datosXml.subtotal / Number(facturaOriginal.subtotal)
              : 1;

          const nuevosDetalles = detallesOrig.map((d) => {
            const debitoOrig = Number(d.debito) || 0;
            const creditoOrig = Number(d.credito) || 0;

            // Para notas crédito de ventas, invertimos débitos y créditos contables
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
          });

          await supabase.from("detalle_transacciones").insert(nuevosDetalles);
        }
      }
    }

    return { success: true, notaId: notaRegistrada.id, numeroNota: datosXml.numeroNota };
  } catch (err: unknown) {
    const mensajeError = err instanceof Error ? err.message : String(err);
    return { success: false, error: mensajeError };
  }
}
export const registrarNotaDesdeXml = registrarNotaEmitidaDesdeXml;