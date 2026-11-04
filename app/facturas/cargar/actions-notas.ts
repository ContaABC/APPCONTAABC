"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

interface ProcesarNotaParams {
  empresaId: number;
  facturaRecibidaId: string; // UUID de la factura afectada
  tipoNota: "CREDITO" | "DEBITO";
  numeroNota: string;
  cude: string;
  fechaEmision: string;
  subtotal: number;
  impuestos: number;
  montoTotal: number;
  motivo?: string;
  xmlUrl?: string;
  pdfUrl?: string;
}

export async function registrarNotaRecibida(datos: ProcesarNotaParams) {
  try {
    // 1. Obtener la factura original y sus asientos/movimientos contables
    const { data: factura, error: errorFactura } = await supabase
      .from("facturas_recibidas")
      .select("id, subtotal, impuestos, total_factura")
      .eq("id", datos.facturaRecibidaId)
      .single();

    if (errorFactura || !factura) {
      throw new Error(`No se encontró la factura referenciada (ID: ${datos.facturaRecibidaId})`);
    }

    // 2. Registrar la Nota Crédito / Débito en la tabla
    const { data: notaInsertada, error: errorNota } = await supabase
      .from("notas_recibidas")
      .insert({
        empresa_id: datos.empresaId,
        factura_recibida_id: datos.facturaRecibidaId,
        tipo_nota: datos.tipoNota,
        numero_nota: datos.numeroNota,
        cude: datos.cude,
        fecha_emision: datos.fechaEmision,
        subtotal: datos.subtotal,
        impuestos: datos.impuestos,
        monto_total: datos.montoTotal,
        motivo: datos.motivo || null,
        xml_url: datos.xmlUrl || null,
        pdf_url: datos.pdfUrl || null,
      })
      .select()
      .single();

    if (errorNota) {
      throw new Error(`Error al insertar la nota: ${errorNota.message}`);
    }

    // 3. Actualizar los montos en la factura original
    const esCredito = datos.tipoNota === "CREDITO";
    
    // Si es Crédito resta, si es Débito suma
    const nuevoSubtotal = esCredito
      ? Number(factura.subtotal) - datos.subtotal
      : Number(factura.subtotal) + datos.subtotal;

    const nuevosImpuestos = esCredito
      ? Number(factura.impuestos) - datos.impuestos
      : Number(factura.impuestos) + datos.impuestos;

    const nuevoTotal = esCredito
      ? Number(factura.total_factura) - datos.montoTotal
      : Number(factura.total_factura) + datos.montoTotal;

    const { error: errorUpdateFactura } = await supabase
      .from("facturas_recibidas")
      .update({
        subtotal: nuevoSubtotal,
        impuestos: nuevosImpuestos,
        total_factura: nuevoTotal,
      })
      .eq("id", datos.facturaRecibidaId);

    if (errorUpdateFactura) {
      throw new Error(`Error al actualizar saldos de la factura: ${errorUpdateFactura.message}`);
    }

    // 4. Replicar la Contabilidad (Partida Doble) usando los mismos conceptos/cuentas de la factura
    // Consultamos los detalles contables de la factura inicial
    const { data: detallesOriginales, error: errorDetalles } = await supabase
      .from("detalles_transaccion") // O tu tabla de movimientos contables
      .select("*")
      .eq("factura_id", datos.facturaRecibidaId);

    if (detallesOriginales && detallesOriginales.length > 0) {
      // Proporcionamos el factor de proporción en caso de que la NC/ND sea parcial
      const proporcion = factura.subtotal > 0 ? datos.subtotal / Number(factura.subtotal) : 1;

      const nuevosDetallesContables = detallesOriginales.map((item) => {
        const debitoOriginal = Number(item.debito) || 0;
        const creditoOriginal = Number(item.credito) || 0;

        let nuevoDebito = 0;
        let nuevoCredito = 0;

        if (esCredito) {
          // NC: Se invierten las naturalezas (Débito pasa a Crédito y viceversa)
          nuevoDebito = creditoOriginal * proporcion;
          nuevoCredito = debitoOriginal * proporcion;
        } else {
          // ND: Conserva las mismas naturalezas
          nuevoDebito = debitoOriginal * proporcion;
          nuevoCredito = creditoOriginal * proporcion;
        }

        return {
          empresa_id: datos.empresaId,
          nota_id: notaInsertada.id, // Vinculado a la nota
          cuenta_auxiliar_id: item.cuenta_auxiliar_id,
          tercero_id: item.tercero_id,
          debito: Math.round(nuevoDebito * 100) / 100,
          credito: Math.round(nuevoCredito * 100) / 100,
          concepto: `${datos.tipoNota === "CREDITO" ? "NC" : "ND"} ${datos.numeroNota} a Factura`,
        };
      });

      const { error: errorAsiento } = await supabase
        .from("detalles_transaccion")
        .insert(nuevosDetallesContables);

      if (errorAsiento) {
        console.warn("Nota creada pero hubo error al registrar asiento contable:", errorAsiento.message);
      }
    }

    return { success: true, nota: notaInsertada };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}