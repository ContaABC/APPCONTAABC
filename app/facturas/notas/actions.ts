"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseKey);

export interface DatosXmlNota {
  tipoNota: "CREDITO" | "DEBITO";
  numeroNota: string;
  cude: string;
  fechaEmision: string;
  subtotal: number;
  impuestos: number;
  montoTotal: number;
  motivo: string;
  numeroFacturaReferencia: string;
  cufeFacturaReferencia: string;
}

export async function registrarNotaDesdeXml(
  datosXml: DatosXmlNota,
  empresaId: number,
  sucursalId: number | null,
  fechaContable: string // Formato YYYY-MM-DD
) {
  try {
    // 1. Buscar la factura original por número de factura o CUFE dentro de la empresa
    let query = supabase
      .from("facturas_recibidas")
      .select("id, subtotal, impuestos, total_factura, empresa_id")
      .eq("empresa_id", empresaId);

    if (datosXml.numeroFacturaReferencia) {
      query = query.eq("numero_factura", datosXml.numeroFacturaReferencia);
    } else if (datosXml.cufeFacturaReferencia) {
      query = query.eq("cufe_cude", datosXml.cufeFacturaReferencia);
    }

    const { data: facturas, error: errorBusqueda } = await query;

    if (errorBusqueda || !facturas || facturas.length === 0) {
      return {
        success: false,
        error: `No se encontró en la empresa seleccionada la factura de referencia (N° ${datosXml.numeroFacturaReferencia || "S/N"}). Cargue primero la factura original.`,
      };
    }

    const facturaOriginal = facturas[0];

    // 2. Insertar en notas_recibidas asociando Sucursal y Fecha Contable
    const { data: notaRegistrada, error: errorNota } = await supabase
      .from("notas_recibidas")
      .insert({
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        factura_recibida_id: facturaOriginal.id,
        tipo_nota: datosXml.tipoNota,
        numero_nota: datosXml.numeroNota,
        cude: datosXml.cude,
        fecha_emision: datosXml.fechaEmision,
        fecha_contable: fechaContable,
        subtotal: datosXml.subtotal,
        impuestos: datosXml.impuestos,
        monto_total: datosXml.montoTotal,
        motivo: datosXml.motivo || null,
      })
      .select()
      .single();

    if (errorNota) {
      return { success: false, error: `Error al registrar nota: ${errorNota.message}` };
    }

    // 3. Reorganizar saldos de la factura original
    const esCredito = datosXml.tipoNota === "CREDITO";

    const nuevoSubtotal = esCredito
      ? Number(facturaOriginal.subtotal) - datosXml.subtotal
      : Number(facturaOriginal.subtotal) + datosXml.subtotal;

    const nuevosImpuestos = esCredito
      ? Number(facturaOriginal.impuestos) - datosXml.impuestos
      : Number(facturaOriginal.impuestos) + datosXml.impuestos;

    const nuevoTotal = esCredito
      ? Number(facturaOriginal.total_factura) - datosXml.montoTotal
      : Number(facturaOriginal.total_factura) + datosXml.montoTotal;

    await supabase
      .from("facturas_recibidas")
      .update({
        subtotal: Math.max(0, nuevoSubtotal),
        impuestos: Math.max(0, nuevosImpuestos),
        total_factura: Math.max(0, nuevoTotal),
      })
      .eq("id", facturaOriginal.id);

    // 4. Invertir / Incrementar Transacción Contable usando la FECHA CONTABLE
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
        const { data: transaccionNota } = await supabase
          .from("transacciones")
          .insert({
            empresa_id: empresaId,
            sucursal_id: sucursalId,
            numero_documento: datosXml.numeroNota,
            fecha_emision: datosXml.fechaEmision,
            fecha_vencimiento: fechaContable, // Asignamos la fecha contable al movimiento contable
            glosa_concepto: `Causación Nota ${datosXml.tipoNota} N° ${datosXml.numeroNota}`,
            modulo_origen: "NOTAS_RECIBIDAS",
            referencia_origen_id: notaRegistrada.id,
            estado: "Registrado",
          })
          .select("id")
          .single();

        if (transaccionNota) {
          const proporcion =
            Number(facturaOriginal.subtotal) > 0
              ? datosXml.subtotal / Number(facturaOriginal.subtotal)
              : 1;

          const nuevosDetalles = detallesOrig.map((d) => {
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
          });

          await supabase.from("detalle_transacciones").insert(nuevosDetalles);
        }
      }
    }

    return { success: true, notaId: notaRegistrada.id };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}