"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor."
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolverEmpresaId(
  empresaId?: number | string | null
): Promise<number> {
  if (
    empresaId !== undefined &&
    empresaId !== null &&
    String(empresaId).trim() !== "" &&
    String(empresaId) !== "undefined" &&
    String(empresaId) !== "null"
  ) {
    const num = Number(empresaId);
    if (!Number.isNaN(num) && Number.isInteger(num) && num > 0) {
      return num;
    }
  }

  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  const cookieNum = Number(idCookie || 0);
  return !Number.isNaN(cookieNum) && Number.isInteger(cookieNum) && cookieNum > 0
    ? cookieNum
    : 0;
}

function normalizarNit(nit?: string | null): string {
  if (!nit) return "";
  return nit.replace(/[.\-\s]/g, "").trim();
}

function montoSeguro(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100) / 100;
}

export async function listarFacturasProveedorParaNota(
  empresaId?: number | string | null,
  proveedorNit?: string | null
) {
  try {
    const supabase = getSupabaseAdmin();
    const empIdNum = await resolverEmpresaId(empresaId);

    if (!empIdNum) {
      return {
        success: false,
        facturas: [],
        error: "Empresa no válida o no seleccionada.",
      };
    }

    const { data, error } = await supabase
      .from("facturas_recibidas")
      .select(
        "id, prefijo, numero_factura, cufe_cude, fecha_emision, tercero_nit, tercero_nombre, subtotal, impuestos, total_factura, saldo_pendiente"
      )
      .eq("empresa_id", empIdNum)
      .order("fecha_emision", { ascending: false })
      .limit(300);

    if (error) {
      return {
        success: false,
        facturas: [],
        error: `Error consultando facturas_recibidas: ${error.message}`,
      };
    }

    const nitObjetivo = normalizarNit(proveedorNit);
    const filtradas = (data || []).filter((row) => {
      if (!nitObjetivo) return true;
      const nitRow = normalizarNit(String(row.tercero_nit || ""));
      return (
        nitRow === nitObjetivo ||
        nitRow.startsWith(nitObjetivo) ||
        nitObjetivo.startsWith(nitRow)
      );
    });

    const facturasFormateadas = filtradas.map((row) => {
      const pref = row.prefijo ? `${String(row.prefijo)}-` : "";
      const numRaw = String(row.numero_factura || "");
      return {
        id: String(row.id),
        numero_factura: `${pref}${numRaw}` || "S/N",
        cufe: row.cufe_cude ? String(row.cufe_cude) : undefined,
        fecha_emision: row.fecha_emision ? String(row.fecha_emision) : undefined,
        emisor_nombre: String(row.tercero_nombre || "Sin Nombre"),
        emisor_nit: String(row.tercero_nit || ""),
        subtotal: Number(row.subtotal ?? 0),
        impuestos: Number(row.impuestos ?? 0),
        total_factura: Number(row.total_factura ?? 0),
        saldo_pendiente: Number(row.saldo_pendiente ?? row.total_factura ?? 0),
      };
    });

    return {
      success: true,
      facturas: facturasFormateadas,
      error: null,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al listar facturas recibidas.";
    return { success: false, facturas: [], error: msg };
  }
}

export interface ProcesarNotaParams {
  empresaId?: number | string | null;
  sucursalId?: number | string | null;
  usuarioId?: string | null;
  facturaRecibidaId: string;
  tipoNota: "CREDITO" | "DEBITO";
  numeroNota: string;
  cude: string;
  fechaEmision: string;
  fechaContable?: string;
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
      return {
        success: false,
        nota: null,
        error: "Debe especificar una empresa válida para registrar la nota.",
      };
    }

    if (!datos.facturaRecibidaId) {
      return {
        success: false,
        nota: null,
        error: "Debe seleccionar la factura de proveedor afectada.",
      };
    }

    const numeroNotaLimpio = String(datos.numeroNota || "").trim();
    if (!numeroNotaLimpio) {
      return {
        success: false,
        nota: null,
        error: "Debe indicar el número de la nota.",
      };
    }

    const tipoNotaSanitizado: "CREDITO" | "DEBITO" =
      datos.tipoNota === "DEBITO" ? "DEBITO" : "CREDITO";

    const subNota = montoSeguro(datos.subtotal);
    const impNota = montoSeguro(datos.impuestos);
    const totNota =
      montoSeguro(datos.montoTotal) > 0
        ? montoSeguro(datos.montoTotal)
        : montoSeguro(subNota + impNota);

    const sucIdNum =
      datos.sucursalId &&
      !Number.isNaN(Number(datos.sucursalId)) &&
      Number(datos.sucursalId) > 0
        ? Number(datos.sucursalId)
        : null;

    // 1. Obtener la factura original verificando que pertenezca a la empresa activa
    const { data: factura, error: errorFactura } = await supabase
      .from("facturas_recibidas")
      .select(
        "id, empresa_id, subtotal, impuestos, total_factura, saldo_pendiente"
      )
      .eq("id", datos.facturaRecibidaId)
      .eq("empresa_id", parsedEmpresaId)
      .single();

    if (errorFactura || !factura) {
      return {
        success: false,
        nota: null,
        error: `No se encontró la factura referenciada (ID: ${datos.facturaRecibidaId}) en la empresa seleccionada.`,
      };
    }

    // 2. Registrar la Nota Crédito / Débito en notas_recibidas
    const insertNotaPayload: Record<string, unknown> = {
      empresa_id: parsedEmpresaId,
      factura_recibida_id: datos.facturaRecibidaId,
      tipo_nota: tipoNotaSanitizado,
      numero_nota: numeroNotaLimpio,
      cude: datos.cude ? datos.cude.trim() : null,
      fecha_emision: datos.fechaEmision,
      subtotal: subNota,
      impuestos: impNota,
      monto_total: totNota,
      motivo: datos.motivo ? datos.motivo.trim() : null,
      xml_url: datos.xmlUrl ? datos.xmlUrl.trim() : null,
      pdf_url: datos.pdfUrl ? datos.pdfUrl.trim() : null,
    };

    if (sucIdNum) {
      insertNotaPayload.sucursal_id = sucIdNum;
    }
    if (datos.fechaContable) {
      insertNotaPayload.fecha_contable = datos.fechaContable;
    }
    if (datos.usuarioId) {
      insertNotaPayload.usuario_id = datos.usuarioId;
    }

    const { data: notaInsertada, error: errorNota } = await supabase
      .from("notas_recibidas")
      .insert(insertNotaPayload)
      .select()
      .single();

    if (errorNota || !notaInsertada) {
      return {
        success: false,
        nota: null,
        error: `Error al insertar la nota: ${errorNota?.message || "sin detalle"}`,
      };
    }

    // 3. Actualizar montos y saldo_pendiente en la factura original
    const esCredito = tipoNotaSanitizado === "CREDITO";
    const subOriginal = Number(factura.subtotal) || 0;
    const impOriginal = Number(factura.impuestos) || 0;
    const totOriginal = Number(factura.total_factura) || 0;
    const saldoOriginal =
      factura.saldo_pendiente !== null && factura.saldo_pendiente !== undefined
        ? Number(factura.saldo_pendiente)
        : totOriginal;

    const nuevoSubtotal = montoSeguro(
      Math.max(0, esCredito ? subOriginal - subNota : subOriginal + subNota)
    );
    const nuevosImpuestos = montoSeguro(
      Math.max(0, esCredito ? impOriginal - impNota : impOriginal + impNota)
    );
    const nuevoTotal = montoSeguro(
      Math.max(0, esCredito ? totOriginal - totNota : totOriginal + totNota)
    );
    const nuevoSaldoPendiente = montoSeguro(
      Math.max(0, esCredito ? saldoOriginal - totNota : saldoOriginal + totNota)
    );

    const { error: errorUpdateFactura } = await supabase
      .from("facturas_recibidas")
      .update({
        subtotal: nuevoSubtotal,
        impuestos: nuevosImpuestos,
        total_factura: nuevoTotal,
        saldo_pendiente: nuevoSaldoPendiente,
      })
      .eq("id", datos.facturaRecibidaId)
      .eq("empresa_id", parsedEmpresaId);

    if (errorUpdateFactura) {
      await supabase.from("notas_recibidas").delete().eq("id", notaInsertada.id);
      return {
        success: false,
        nota: null,
        error: `Error al actualizar saldos de la factura: ${errorUpdateFactura.message}`,
      };
    }

    // 4. Replicar la Contabilidad (Partida Doble)
    const { data: detallesOriginales, error: errorDetalles } = await supabase
      .from("detalles_transaccion")
      .select("*")
      .eq("factura_id", datos.facturaRecibidaId);

    if (errorDetalles) {
      console.warn(
        "Aviso al consultar detalles contables originales:",
        errorDetalles.message
      );
    }

    if (detallesOriginales && detallesOriginales.length > 0) {
      const proporcion =
        subOriginal > 0
          ? subNota / subOriginal
          : totOriginal > 0
          ? totNota / totOriginal
          : 1;

      const nuevosDetallesContables = detallesOriginales.map(
        (item: {
          debito?: number | string | null;
          credito?: number | string | null;
          cuenta_auxiliar_id?: number | string | null;
          tercero_id?: number | string | null;
        }) => {
          const debitoOriginal = Number(item.debito) || 0;
          const creditoOriginal = Number(item.credito) || 0;

          const nuevoDebito = esCredito
            ? creditoOriginal * proporcion
            : debitoOriginal * proporcion;
          const nuevoCredito = esCredito
            ? debitoOriginal * proporcion
            : creditoOriginal * proporcion;

          return {
            empresa_id: parsedEmpresaId,
            sucursal_id: sucIdNum,
            nota_id: notaInsertada.id,
            cuenta_auxiliar_id: item.cuenta_auxiliar_id,
            tercero_id: item.tercero_id,
            debito: montoSeguro(nuevoDebito),
            credito: montoSeguro(nuevoCredito),
            fecha_contable: datos.fechaContable || datos.fechaEmision,
            concepto: `${esCredito ? "NC" : "ND"} ${numeroNotaLimpio} a Factura`,
          };
        }
      );

      const { error: errorAsiento } = await supabase
        .from("detalles_transaccion")
        .insert(nuevosDetallesContables);

      if (errorAsiento) {
        // Revertir factura y nota si falla el asiento contable
        await supabase
          .from("facturas_recibidas")
          .update({
            subtotal: subOriginal,
            impuestos: impOriginal,
            total_factura: totOriginal,
            saldo_pendiente: saldoOriginal,
          })
          .eq("id", datos.facturaRecibidaId)
          .eq("empresa_id", parsedEmpresaId);

        await supabase.from("notas_recibidas").delete().eq("id", notaInsertada.id);

        return {
          success: false,
          nota: null,
          error: `No se pudo registrar el asiento contable; se revirtió la nota: ${errorAsiento.message}`,
        };
      }
    }

    return { success: true, nota: notaInsertada, error: null };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error desconocido al registrar la nota.";
    console.error("Error en registrarNotaRecibida:", mensaje);
    return { success: false, nota: null, error: mensaje };
  }
}