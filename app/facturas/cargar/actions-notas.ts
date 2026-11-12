"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan las variables de entorno de Supabase.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolverEmpresaId(empresaId?: number | string | null): Promise<number> {
  if (empresaId) return Number(empresaId);
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
}

export interface ProcesarNotaParams {
  empresaId?: number | string | null;
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
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(datos.empresaId);

    if (!parsedEmpresaId) {
      throw new Error("Debe especificar una empresa válida para registrar la nota.");
    }

    // 1. Obtener la factura original y sus saldos
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
        empresa_id: parsedEmpresaId,
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

    // 4. Replicar la Contabilidad (Partida Doble)
    const { data: detallesOriginales, error: errorDetalles } = await supabase
      .from("detalles_transaccion")
      .select("*")
      .eq("factura_id", datos.facturaRecibidaId);

    if (errorDetalles) {
      console.warn("Aviso al consultar detalles contables originales:", errorDetalles.message);
    }

    if (detallesOriginales && detallesOriginales.length > 0) {
      const facturaSubtotalNum = Number(factura.subtotal) || 0;
      const proporcion = facturaSubtotalNum > 0 ? datos.subtotal / facturaSubtotalNum : 1;

      const nuevosDetallesContables = detallesOriginales.map((item: any) => {
        const debitoOriginal = Number(item.debito) || 0;
        const creditoOriginal = Number(item.credito) || 0;

        let nuevoDebito = 0;
        let nuevoCredito = 0;

        if (esCredito) {
          // NC: Se invierten las naturalezas
          nuevoDebito = creditoOriginal * proporcion;
          nuevoCredito = debitoOriginal * proporcion;
        } else {
          // ND: Conserva las mismas naturalezas
          nuevoDebito = debitoOriginal * proporcion;
          nuevoCredito = creditoOriginal * proporcion;
        }

        return {
          empresa_id: parsedEmpresaId,
          nota_id: notaInsertada.id,
          cuenta_auxiliar_id: item.cuenta_auxiliar_id,
          tercero_id: item.tercero_id,
          debito: Math.round(nuevoDebito * 100) / 100,
          credito: Math.round(nuevoCredito * 100) / 100,
          concepto: `${esCredito ? "NC" : "ND"} ${datos.numeroNota} a Factura`,
        };
      });

      const { error: errorAsiento } = await supabase
        .from("detalles_transaccion")
        .insert(nuevosDetallesContables);

      if (errorAsiento) {
        console.warn("Nota creada pero hubo error al registrar asiento contable:", errorAsiento.message);
      }
    }

    return { success: true, nota: notaInsertada, error: null };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al registrar la nota.";
    console.error("Error en registrarNotaRecibida:", mensaje);
    return { success: false, nota: null, error: mensaje };
  }
}