"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

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

async function resolverEmpresaId(
  empresaId?: number | string | null
): Promise<number> {
  if (empresaId && Number(empresaId) > 0) return Number(empresaId);
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
}

export async function listarFacturasProveedorParaNota(
  empresaId?: number | string | null,
  proveedorNit?: string | null
) {
  try {
    const supabase = getSupabaseAdmin();
    const empId = await resolverEmpresaId(empresaId);
    if (!empId) {
      return { success: true, facturas: [] };
    }

    let query = supabase
      .from("facturas_recibidas")
      .select("*")
      .eq("empresa_id", empId)
      .order("fecha_emision", { ascending: false });

    if (proveedorNit && proveedorNit.trim() !== "") {
      query = query.eq("tercero_nit", proveedorNit.trim());
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const facturasMapeadas = (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      cufe: row.cufe_cude,
      emisor_nombre: row.tercero_nombre,
      emisor_nit: row.tercero_nit,
    }));

    return { success: true, facturas: facturasMapeadas };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, facturas: [], error: errorMsg };
  }
}

export interface RegistrarNotaRecibidaPayload {
  empresaId?: number | string | null;
  sucursalId?: number | string | null;
  usuarioId?: string | null;
  claseDocumentoId?: number | string | null;
  facturaRecibidaId: string;
  tipoNota: "CREDITO" | "DEBITO";
  numeroNota: string;
  cude?: string;
  fechaEmision: string;
  fechaContable: string;
  subtotal: number;
  impuestos: number;
  montoTotal: number;
  motivo?: string;
  xmlUrl?: string;
  pdfUrl?: string;
}

export async function registrarNotaRecibida(
  payload: RegistrarNotaRecibidaPayload
) {
  const supabase = getSupabaseAdmin();

  try {
    const empId = await resolverEmpresaId(payload.empresaId);
    if (!empId) {
      return { success: false, error: "Empresa activa no válida." };
    }

    const sucIdNum =
      payload.sucursalId && Number(payload.sucursalId) > 0
        ? Number(payload.sucursalId)
        : null;

    const subtotalNum = Number(payload.subtotal || 0);
    const impuestosNum = Number(payload.impuestos || 0);
    const totalNotaNum =
      Number(payload.montoTotal || 0) > 0
        ? Number(payload.montoTotal || 0)
        : subtotalNum + impuestosNum;

    if (totalNotaNum <= 0) {
      return {
        success: false,
        error: "El monto total de la nota debe ser mayor a cero.",
      };
    }

    // 1. Consultar factura recibida afectada por empresa
    const { data: factura, error: errFact } = await supabase
      .from("facturas_recibidas")
      .select("*")
      .eq("id", payload.facturaRecibidaId)
      .eq("empresa_id", empId)
      .maybeSingle();

    if (errFact || !factura) {
      throw new Error(
        errFact?.message ||
          "No se encontró la factura de proveedor para la empresa seleccionada."
      );
    }

    // 2. Consultar transacción contable original de la factura
    const { data: transaccionOriginal, error: errTxOrig } = await supabase
      .from("transacciones")
      .select("id, tercero_id, sucursal_id, clase_documento_id")
      .eq("referencia_origen_id", factura.id)
      .eq("empresa_id", empId)
      .maybeSingle();

    if (errTxOrig || !transaccionOriginal) {
      throw new Error(
        "No se encontró la causación contable original de la factura recibida."
      );
    }

    const { data: detallesOrig, error: errDetOrig } = await supabase
      .from("detalle_transacciones")
      .select(
        "concepto_auxiliar_id, tercero_id, cuenta_financiera_id, titulo_valor_id, debito, credito"
      )
      .eq("transaccion_id", transaccionOriginal.id);

    if (errDetOrig || !detallesOrig || detallesOrig.length === 0) {
      throw new Error(
        "La causación contable original de la factura no tiene líneas en detalle_transacciones."
      );
    }

    const totalFacturaOrig = Number(factura.total_factura || 0);
    if (totalFacturaOrig <= 0) {
      throw new Error("El total de la factura original no es válido.");
    }

    // Porcentaje / proporción de la nota respecto al valor de la factura
    const factorProporcion = totalNotaNum / totalFacturaOrig;

    // 3. Consecutivo del documento contable por empresa
    let claseDocIdNum =
      payload.claseDocumentoId && Number(payload.claseDocumentoId) > 0
        ? Number(payload.claseDocumentoId)
        : transaccionOriginal.clase_documento_id
        ? Number(transaccionOriginal.clase_documento_id)
        : null;

    let prefijoDoc = payload.tipoNota === "CREDITO" ? "NCP" : "NDP";
    let longitudNum = 5;
    let numeroDocumentoContable = `${prefijoDoc}-${Date.now()
      .toString()
      .slice(-longitudNum)}`;

    if (claseDocIdNum) {
      const { data: consecutivo } = await supabase
        .from("consecutivos")
        .select("id, ultimo_numero, prefijo, longitud_numero")
        .eq("empresa_id", empId)
        .eq("clase_documento_id", claseDocIdNum)
        .maybeSingle();

      if (consecutivo) {
        if (consecutivo.prefijo) prefijoDoc = String(consecutivo.prefijo);
        if (
          consecutivo.longitud_numero &&
          Number(consecutivo.longitud_numero) > 0
        ) {
          longitudNum = Number(consecutivo.longitud_numero);
        }
        const siguiente = Number(consecutivo.ultimo_numero || 0) + 1;
        numeroDocumentoContable = `${prefijoDoc}-${String(siguiente).padStart(
          longitudNum,
          "0"
        )}`;

        const { error: errUpdCons } = await supabase
          .from("consecutivos")
          .update({
            ultimo_numero: siguiente,
            actualizado_en: new Date().toISOString(),
          })
          .eq("id", consecutivo.id)
          .eq("empresa_id", empId);

        if (errUpdCons) {
          throw new Error(
            `Error al actualizar consecutivo: ${errUpdCons.message}`
          );
        }
      } else {
        numeroDocumentoContable = `${prefijoDoc}-${String(1).padStart(
          longitudNum,
          "0"
        )}`;
      }
    }

    // 4. Insertar en notas_facturas_recibidas
    const { data: notaInsertada, error: errNota } = await supabase
      .from("notas_facturas_recibidas")
      .insert([
        {
          empresa_id: empId,
          factura_recibida_id: factura.id,
          tipo_nota: payload.tipoNota,
          numero_nota: payload.numeroNota,
          cude: payload.cude || null,
          fecha_emision: payload.fechaEmision,
          subtotal: subtotalNum,
          impuestos: impuestosNum,
          monto_total: totalNotaNum,
          concepto_auxiliar_id: factura.concepto_auxiliar_id || null,
          motivo: payload.motivo || null,
          xml_url: payload.xmlUrl || null,
          pdf_url: payload.pdfUrl || null,
          creado_en: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (errNota) {
      throw new Error(`Error al registrar nota recibida: ${errNota.message}`);
    }

    // 5. Asiento contable inverso al de notas emitidas, escalado por la proporción de la nota
    const terceroProveedorId = transaccionOriginal.tercero_id
      ? Number(transaccionOriginal.tercero_id)
      : factura.tercero_id
      ? Number(factura.tercero_id)
      : null;

    const sucursalTransaccion =
      sucIdNum ??
      (transaccionOriginal.sucursal_id
        ? Number(transaccionOriginal.sucursal_id)
        : factura.sucursal_id
        ? Number(factura.sucursal_id)
        : null);

    const lineasContables = detallesOrig.map((d) => {
      const debEscalado = Number(
        (Number(d.debito || 0) * factorProporcion).toFixed(2)
      );
      const credEscalado = Number(
        (Number(d.credito || 0) * factorProporcion).toFixed(2)
      );

      // Sentido inverso a notas emitidas:
      // CREDITO recibida invierte débito/crédito; DEBITO recibida conserva débito/crédito
      const esCredito = payload.tipoNota === "CREDITO";

      return {
        concepto_auxiliar_id: Number(d.concepto_auxiliar_id),
        tercero_id: d.tercero_id
          ? Number(d.tercero_id)
          : terceroProveedorId,
        cuenta_financiera_id: d.cuenta_financiera_id
          ? Number(d.cuenta_financiera_id)
          : null,
        titulo_valor_id: d.titulo_valor_id
          ? Number(d.titulo_valor_id)
          : null,
        debito: esCredito ? credEscalado : debEscalado,
        credito: esCredito ? debEscalado : credEscalado,
      };
    });

    const nombreProveedor = factura.tercero_nombre || "Proveedor";

    const { data: transaccionNueva, error: errTrans } = await supabase
      .from("transacciones")
      .insert([
        {
          empresa_id: empId,
          sucursal_id: sucursalTransaccion,
          clase_documento_id: claseDocIdNum,
          creado_por_user_id: payload.usuarioId || null,
          tercero_id: terceroProveedorId,
          numero_documento: numeroDocumentoContable,
          fecha_emision: payload.fechaEmision,
          fecha_vencimiento: factura.fecha_vencimiento || payload.fechaEmision,
          fecha_contable: payload.fechaContable,
          glosa_concepto: `Causación Nota ${payload.tipoNota} Proveedor N° ${payload.numeroNota} (${nombreProveedor})`,
          modulo_origen: "FACTURAS_RECIBIDAS",
          referencia_origen_id: notaInsertada.id,
          estado: "Registrado",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (errTrans) {
      throw new Error(
        `Error al registrar transacción contable: ${errTrans.message}`
      );
    }

    const lineasInsert = lineasContables.map((dt) => ({
      transaccion_id: transaccionNueva.id,
      concepto_auxiliar_id: dt.concepto_auxiliar_id,
      tercero_id: dt.tercero_id,
      cuenta_financiera_id: dt.cuenta_financiera_id,
      titulo_valor_id: dt.titulo_valor_id,
      debito: dt.debito,
      credito: dt.credito,
      fecha_contable: payload.fechaContable,
      created_at: new Date().toISOString(),
    }));

    const { error: errDetTrans } = await supabase
      .from("detalle_transacciones")
      .insert(lineasInsert);

    if (errDetTrans) {
      throw new Error(
        `Error al registrar detalle contable: ${errDetTrans.message}`
      );
    }

    // 6. Actualizar saldo, abonos y estado de pago de facturas_recibidas por empresa
    const saldoActual = Number(
      factura.saldo_pendiente ?? factura.total_factura ?? 0
    );
    const abonosActuales = Number(factura.total_abonos ?? 0);

    const nuevoSaldo =
      payload.tipoNota === "CREDITO"
        ? Math.max(0, Number((saldoActual - totalNotaNum).toFixed(2)))
        : Number((saldoActual + totalNotaNum).toFixed(2));

    const nuevosAbonos =
      payload.tipoNota === "CREDITO"
        ? Number((abonosActuales + totalNotaNum).toFixed(2))
        : abonosActuales;

    const actualizacionFactura: Record<string, unknown> = {
      saldo_pendiente: nuevoSaldo,
      total_abonos: nuevosAbonos,
      actualizado_en: new Date().toISOString(),
    };

    if (payload.tipoNota === "CREDITO" && nuevoSaldo === 0) {
      actualizacionFactura.estado_pago = "PAGADA";
    }

    const { error: errUpdFact } = await supabase
      .from("facturas_recibidas")
      .update(actualizacionFactura)
      .eq("id", factura.id)
      .eq("empresa_id", empId);

    if (errUpdFact) {
      throw new Error(
        `Error al actualizar saldo de la factura recibida: ${errUpdFact.message}`
      );
    }

    revalidatePath("/facturas/notas_recibidas");
    revalidatePath("/modulos/proveedores");

    return {
      success: true,
      notaId: notaInsertada.id,
      numeroDocumentoContable,
      nuevoSaldo,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Error al registrar la nota recibida.";
    console.error("Error en registrarNotaRecibida:", err);
    return { success: false, error: errorMsg };
  }
}