"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
} from "@/app/actions/accionesEmpresas";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parsePositiveId(valor?: number | string | null): number {
  if (valor === undefined || valor === null) return 0;
  const str = String(valor).trim();
  if (!str) return 0;
  const num = Number(str);
  return Number.isFinite(num) && num > 0 ? Math.trunc(num) : 0;
}

async function resolverEmpresaId(
  empresaId?: number | string | null
): Promise<number> {
  const directa = parsePositiveId(empresaId);
  if (directa > 0) return directa;

  const cookieStore = await cookies();
  const idCookie =
    cookieStore.get("empresa_activa")?.value ||
    cookieStore.get("empresa_id")?.value;
  const desdeCookie = parsePositiveId(idCookie);
  if (desdeCookie > 0) return desdeCookie;

  try {
    const activaUsuario = await getEmpresaActivaUsuario();
    const desdeUsuario = parsePositiveId(activaUsuario);
    if (desdeUsuario > 0) return desdeUsuario;
  } catch {
    // Ignorar si no aplica
  }

  return 0;
}

/**
 * Obtener Empresas (filtradas por empresas asignadas si aplica)
 */
export async function obtenerEmpresas() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    let permitidasIds: number[] | null = null;
    try {
      const resPermitidas: unknown = await getEmpresasPermitidas();
      const lista = Array.isArray(resPermitidas)
        ? resPermitidas
        : resPermitidas &&
            typeof resPermitidas === "object" &&
            Array.isArray((resPermitidas as { datos?: unknown }).datos)
          ? (resPermitidas as { datos: unknown[] }).datos
          : null;

      if (Array.isArray(lista)) {
        permitidasIds = lista
          .map((item) => {
            if (typeof item === "object" && item !== null) {
              const obj = item as { id?: unknown; empresa_id?: unknown };
              return parsePositiveId(obj.id as string | number | null) ||
                parsePositiveId(obj.empresa_id as string | number | null);
            }
            return parsePositiveId(item as string | number | null);
          })
          .filter((id) => id > 0);
      }
    } catch {
      permitidasIds = null;
    }

    let query = supabaseAdmin
      .from("empresas")
      .select("*")
      .order("razon_social", { ascending: true });

    if (permitidasIds !== null) {
      if (permitidasIds.length === 0) {
        return { success: true, data: [], error: null };
      }
      query = query.in("id", permitidasIds);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error ? err.message : "Error al obtener empresas.";
    return { success: false, data: [], error: mensaje };
  }
}

/**
 * Obtener Sucursales por empresa_id
 */
export async function obtenerSucursales(empresaId?: number | string | null) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    if (!parsedEmpresaId) return { success: true, data: [], error: null };

    const { data, error } = await supabaseAdmin
      .from("sucursales")
      .select("*")
      .eq("empresa_id", parsedEmpresaId)
      .order("codigo_sucursal", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error ? err.message : "Error al obtener sucursales.";
    return { success: false, data: [], error: mensaje };
  }
}

/**
 * Obtiene el listado de facturas recibidas (incluye fecha_emision)
 */
export async function obtenerFacturasRecibidas(
  empresaId?: number | string | null,
  sucursalId?: number | string | null
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return {
        success: false,
        data: [],
        error: "Debe seleccionar o tener activa una empresa válida.",
      };
    }

    let query = supabaseAdmin
      .from("facturas_recibidas")
      .select(`
        id,
        numero_factura,
        tercero_nit,
        tercero_nombre,
        fecha_emision,
        fecha_vencimiento,
        subtotal,
        impuestos,
        total_factura,
        saldo_pendiente,
        estado_pago,
        estado_dian,
        cufe_cude
      `)
      .eq("empresa_id", parsedEmpresaId);

    const parsedSucursalId = parsePositiveId(sucursalId);
    if (parsedSucursalId > 0) {
      query = query.eq("sucursal_id", parsedSucursalId);
    }

    const { data, error } = await query.order("fecha_emision", {
      ascending: false,
    });

    if (error) throw new Error(error.message);

    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error ? err.message : "Error al obtener las facturas.";
    return { success: false, data: [], error: mensaje };
  }
}

/**
 * Obtiene la transacción y el detalle del asiento contable
 * (Ordenado visualmente: primero Débitos, luego Créditos)
 */
export async function obtenerAsientoPorFactura(facturaId: string | number) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const uuidFactura = String(facturaId).trim();

    // 1. Buscar la transacción en transacciones
    const { data: transaccion, error: errorTx } = await supabaseAdmin
      .from("transacciones")
      .select(`
        id,
        numero_documento,
        fecha_emision,
        fecha_contable,
        glosa_concepto,
        estado,
        clases_documento (
          codigo_clase,
          nombre_clase
        )
      `)
      .eq("modulo_origen", "FACTURAS_RECIBIDAS")
      .eq("referencia_origen_id", uuidFactura)
      .maybeSingle();

    if (errorTx) throw new Error(errorTx.message);

    if (!transaccion) {
      return {
        success: false,
        data: null,
        error: `No se encontró un asiento contable en 'transacciones' asociado a la factura ID ${uuidFactura}.`,
      };
    }

    // 2. Traer el detalle ordenando estrictamente: Débitos primero, Créditos después
    const { data: detalles, error: errorDetalles } = await supabaseAdmin
      .from("detalle_transacciones")
      .select(`
        id,
        concepto_auxiliar_id,
        debito,
        credito,
        conceptos_auxiliares (
          codigo_auxiliar,
          nombre
        )
      `)
      .eq("transaccion_id", transaccion.id)
      .order("debito", { ascending: false }) // Pone los débitos arriba
      .order("id", { ascending: true }); // Orden secundario por ID

    if (errorDetalles) throw new Error(errorDetalles.message);

    return {
      success: true,
      data: {
        transaccion: {
          ...transaccion,
          fecha_contable: transaccion.fecha_contable || transaccion.fecha_emision,
          fecha: transaccion.fecha_contable || transaccion.fecha_emision,
        },
        detalles: detalles || [],
      },
      error: null,
    };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error ? err.message : "Error al consultar el asiento.";
    return { success: false, data: null, error: mensaje };
  }
}