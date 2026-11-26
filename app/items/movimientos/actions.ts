"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseAdminInstance: ReturnType<typeof createClient<any>> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
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

export interface ItemFiltro {
  id: number | string;
  codigo?: string | null;
  nombre: string;
}

export interface MovimientoItemDetalle {
  id: number;
  factura_id: string;
  numero_factura: string;
  fecha_movimiento: string;
  sucursal_id: string | number | null;
  item_id: number | null;
  codigo_ref: string;
  nombre_item: string;
  cantidad: number;
  valor_unitario: number;
  subtotal: number;
  porcentaje_iva: number;
  valor_iva: number;
  total: number;
  verificado: boolean;
  observacion_verificacion: string;
}

export interface AcumuladoItem {
  clave_agrupacion: string;
  item_id: number | null;
  codigo_ref: string;
  nombre_item: string;
  num_movimientos: number;
  cantidad_total: number;
  subtotal_total: number;
  iva_total: number;
  total_general: number;
  movimientos_ok: number;
  movimientos_con_diferencia: number;
  verificado_ok: boolean;
  detalle_verificacion: string;
  movimientos: MovimientoItemDetalle[];
}

export interface ConsultaMovimientosResponse {
  success: boolean;
  data: AcumuladoItem[];
  resumen: {
    total_items: number;
    total_movimientos: number;
    cantidad_total: number;
    subtotal_total: number;
    iva_total: number;
    total_general: number;
    movimientos_verificados_ok: number;
    movimientos_con_diferencia: number;
  };
  error: string | null;
}

function verificarLineaMovimiento(
  cantidad: number,
  valorUnitario: number,
  subtotal: number,
  porcentajeIva: number,
  valorIva: number,
  total: number
): { verificado: boolean; observacion: string } {
  const tolerancia = 1; // Tolerancia de 1 peso por redondeos decimales en facturación
  const subtotalEsperado = cantidad * valorUnitario;
  const ivaEsperado = subtotal * (porcentajeIva / 100);
  const totalEsperado = subtotal + valorIva;

  const diferencias: string[] = [];

  if (Math.abs(subtotal - subtotalEsperado) > tolerancia) {
    diferencias.push(
      `Subtotal (${subtotal.toFixed(2)}) difiere de Cant×V.Unit (${subtotalEsperado.toFixed(2)})`
    );
  }
  if (Math.abs(valorIva - ivaEsperado) > tolerancia) {
    diferencias.push(
      `IVA (${valorIva.toFixed(2)}) difiere de Sub×${porcentajeIva}% (${ivaEsperado.toFixed(2)})`
    );
  }
  if (Math.abs(total - totalEsperado) > tolerancia) {
    diferencias.push(
      `Total (${total.toFixed(2)}) difiere de Sub+IVA (${totalEsperado.toFixed(2)})`
    );
  }

  if (diferencias.length > 0) {
    return { verificado: false, observacion: diferencias.join(" · ") };
  }
  return { verificado: true, observacion: "Cuadre matemático OK" };
}

/**
 * Obtener catálogo de ítems para el filtro
 */
export async function obtenerCatalogoItemsFiltro(
  empresaId?: number | string | null,
  sucursalId?: number | string | null
): Promise<{ success: boolean; data: ItemFiltro[]; error: string | null }> {
  try {
    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    if (!parsedEmpresaId) {
      return { success: true, data: [], error: null };
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("items_facturacion")
      .select("id, codigo, nombre, sucursal_id")
      .eq("empresa_id", parsedEmpresaId)
      .order("nombre", { ascending: true });

    if (sucursalId && String(sucursalId).trim() !== "") {
      query = query.eq("sucursal_id", Number(sucursalId));
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, data: [], error: errorMsg };
  }
}

/**
 * Consultar movimientos acumulados por ítem desde detalle_facturas_emitidas
 * con filtros de Empresa, Sucursal, Ítem y Periodo (Desde - Hasta)
 */
export async function consultarMovimientosAcumuladosItems(params: {
  empresaId?: number | string | null;
  sucursalId?: number | string | null;
  itemId?: number | string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
}): Promise<ConsultaMovimientosResponse> {
  const resumenVacio = {
    total_items: 0,
    total_movimientos: 0,
    cantidad_total: 0,
    subtotal_total: 0,
    iva_total: 0,
    total_general: 0,
    movimientos_verificados_ok: 0,
    movimientos_con_diferencia: 0,
  };

  try {
    const parsedEmpresaId = await resolverEmpresaId(params.empresaId);
    if (!parsedEmpresaId) {
      return {
        success: true,
        data: [],
        resumen: resumenVacio,
        error: null,
      };
    }

    const supabase = getSupabaseAdmin();
    const parsedItemId =
      params.itemId && String(params.itemId).trim() !== ""
        ? Number(params.itemId)
        : null;

    let detalleQuery = supabase
      .from("detalle_facturas_emitidas")
      .select(
        "id, factura_id, empresa_id, item_id, codigo_ref, nombre_item, cantidad, valor_unitario, subtotal, porcentaje_iva, valor_iva, total, created_at"
      )
      .eq("empresa_id", parsedEmpresaId)
      .order("created_at", { ascending: false });

    if (parsedItemId && !Number.isNaN(parsedItemId)) {
      detalleQuery = detalleQuery.eq("item_id", parsedItemId);
    }

    const { data: detallesRaw, error: errDetalle } = await detalleQuery;
    if (errDetalle) throw new Error(errDetalle.message);

    const detalles = Array.isArray(detallesRaw) ? detallesRaw : [];
    if (detalles.length === 0) {
      return {
        success: true,
        data: [],
        resumen: resumenVacio,
        error: null,
      };
    }

    // Obtener facturas asociadas para filtrar por sucursal y periodo (fecha_emision)
    const facturaIds = Array.from(
      new Set(
        detalles
          .map((d: Record<string, unknown>) => d.factura_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    const facturasMap = new Map<
      string,
      {
        numero_factura: string;
        fecha_emision: string;
        sucursal_id: string | number | null;
      }
    >();

    if (facturaIds.length > 0) {
      const { data: facturasData, error: errFacturas } = await supabase
        .from("facturas_emitidas")
        .select("id, numero_factura, fecha_emision, sucursal_id")
        .in("id", facturaIds);

      if (errFacturas) {
        console.warn("Advertencia consultando facturas_emitidas:", errFacturas.message);
      } else if (Array.isArray(facturasData)) {
        for (const f of facturasData as Array<Record<string, unknown>>) {
          facturasMap.set(String(f.id), {
            numero_factura: String(f.numero_factura || f.id || "-"),
            fecha_emision: f.fecha_emision
              ? String(f.fecha_emision).slice(0, 10)
              : "",
            sucursal_id: (f.sucursal_id as string | number | null) ?? null,
          });
        }
      }
    }

    const sucFiltro =
      params.sucursalId && String(params.sucursalId).trim() !== ""
        ? String(params.sucursalId).trim()
        : "";
    const desde = params.fechaDesde ? String(params.fechaDesde).slice(0, 10) : "";
    const hasta = params.fechaHasta ? String(params.fechaHasta).slice(0, 10) : "";

    const agrupadosMap = new Map<string, AcumuladoItem>();

    let totalMovimientos = 0;
    let cantidadTotalGlobal = 0;
    let subtotalTotalGlobal = 0;
    let ivaTotalGlobal = 0;
    let totalGeneralGlobal = 0;
    let movOkGlobal = 0;
    let movDiffGlobal = 0;

    for (const row of detalles as Array<Record<string, unknown>>) {
      const facturaIdStr = String(row.factura_id || "");
      const facturaInfo = facturasMap.get(facturaIdStr);

      const sucFactura = facturaInfo?.sucursal_id ?? null;
      if (sucFiltro && String(sucFactura ?? "") !== sucFiltro) {
        continue;
      }

      const fechaRef =
        facturaInfo?.fecha_emision ||
        (row.created_at ? String(row.created_at).slice(0, 10) : "");

      if (desde && fechaRef && fechaRef < desde) {
        continue;
      }
      if (hasta && fechaRef && fechaRef > hasta) {
        continue;
      }

      const itemIdNum =
        row.item_id !== null && row.item_id !== undefined
          ? Number(row.item_id)
          : null;
      const codigoRef = String(row.codigo_ref || "").trim();
      const nombreItem = String(row.nombre_item || "Ítem sin nombre").trim();

      const cantidad = Number(row.cantidad ?? 0);
      const valorUnitario = Number(row.valor_unitario ?? 0);
      const subtotal = Number(row.subtotal ?? 0);
      const porcentajeIva = Number(row.porcentaje_iva ?? 0);
      const valorIva = Number(row.valor_iva ?? 0);
      const total = Number(row.total ?? 0);

      const check = verificarLineaMovimiento(
        cantidad,
        valorUnitario,
        subtotal,
        porcentajeIva,
        valorIva,
        total
      );

      const movDetalle: MovimientoItemDetalle = {
        id: Number(row.id),
        factura_id: facturaIdStr,
        numero_factura: facturaInfo?.numero_factura || facturaIdStr.slice(0, 8),
        fecha_movimiento: fechaRef || "-",
        sucursal_id: sucFactura,
        item_id: itemIdNum,
        codigo_ref: codigoRef || "-",
        nombre_item: nombreItem,
        cantidad,
        valor_unitario: valorUnitario,
        subtotal,
        porcentaje_iva: porcentajeIva,
        valor_iva: valorIva,
        total,
        verificado: check.verificado,
        observacion_verificacion: check.observacion,
      };

      const clave =
        itemIdNum !== null && !Number.isNaN(itemIdNum)
          ? `id:${itemIdNum}`
          : `ref:${codigoRef}|nom:${nombreItem.toLowerCase()}`;

      let grupo = agrupadosMap.get(clave);
      if (!grupo) {
        grupo = {
          clave_agrupacion: clave,
          item_id: itemIdNum,
          codigo_ref: codigoRef || "-",
          nombre_item: nombreItem,
          num_movimientos: 0,
          cantidad_total: 0,
          subtotal_total: 0,
          iva_total: 0,
          total_general: 0,
          movimientos_ok: 0,
          movimientos_con_diferencia: 0,
          verificado_ok: true,
          detalle_verificacion: "",
          movimientos: [],
        };
        agrupadosMap.set(clave, grupo);
      }

      grupo.num_movimientos += 1;
      grupo.cantidad_total += cantidad;
      grupo.subtotal_total += subtotal;
      grupo.iva_total += valorIva;
      grupo.total_general += total;
      if (check.verificado) {
        grupo.movimientos_ok += 1;
        movOkGlobal += 1;
      } else {
        grupo.movimientos_con_diferencia += 1;
        movDiffGlobal += 1;
      }
      grupo.movimientos.push(movDetalle);

      totalMovimientos += 1;
      cantidadTotalGlobal += cantidad;
      subtotalTotalGlobal += subtotal;
      ivaTotalGlobal += valorIva;
      totalGeneralGlobal += total;
    }

    const acumulados = Array.from(agrupadosMap.values())
      .map((g) => {
        const ok = g.movimientos_con_diferencia === 0;
        return {
          ...g,
          verificado_ok: ok,
          detalle_verificacion: ok
            ? `${g.num_movimientos}/${g.num_movimientos} movimientos verificados OK`
            : `${g.movimientos_con_diferencia} movimiento(s) con diferencia de cuadre`,
        };
      })
      .sort((a, b) =>
        a.nombre_item.localeCompare(b.nombre_item, "es", { sensitivity: "base" })
      );

    return {
      success: true,
      data: acumulados,
      resumen: {
        total_items: acumulados.length,
        total_movimientos: totalMovimientos,
        cantidad_total: cantidadTotalGlobal,
        subtotal_total: subtotalTotalGlobal,
        iva_total: ivaTotalGlobal,
        total_general: totalGeneralGlobal,
        movimientos_verificados_ok: movOkGlobal,
        movimientos_con_diferencia: movDiffGlobal,
      },
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: [],
      resumen: resumenVacio,
      error: errorMsg,
    };
  }
}