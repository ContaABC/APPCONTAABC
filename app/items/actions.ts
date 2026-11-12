"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
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

export interface ItemFacturacionInput {
  id?: string | number;
  empresa_id?: number | string | null;
  sucursal_id: number | string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  precio_venta: number;
  porcentaje_iva?: number;
  aplica_descuento: boolean;
  porcentaje_descuento_max: number;
  estado?: boolean;
}

/**
 * Obtener Empresas
 */
export async function obtenerEmpresas() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("empresas")
      .select("*")
      .order("razon_social", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, data: [], error: errorMsg };
  }
}

/**
 * Obtener Sucursales por empresa_id
 */
export async function obtenerSucursales(empresaId?: number | string | null) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    if (!parsedEmpresaId) return { success: true, data: [], error: null };

    const { data, error } = await supabase
      .from("sucursales")
      .select("*")
      .eq("empresa_id", parsedEmpresaId)
      .order("codigo_sucursal", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, data: [], error: errorMsg };
  }
}

/**
 * Obtener Ítems por Empresa y Sucursal
 */
export async function obtenerItemsPorEmpresaYSucursal(
  empresaId?: number | string | null,
  sucursalId?: number | string | null
) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    const parsedSucursalId = sucursalId ? Number(sucursalId) : null;

    if (!parsedEmpresaId || !parsedSucursalId) {
      return { success: true, data: [], error: null };
    }

    const { data, error } = await supabase
      .from("items_facturacion")
      .select("*")
      .eq("empresa_id", parsedEmpresaId)
      .eq("sucursal_id", parsedSucursalId)
      .order("nombre", { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, data: [], error: errorMsg };
  }
}

/**
 * Guardar o Actualizar Ítem de Facturación
 */
export async function guardarItemFacturacion(data: ItemFacturacionInput) {
  try {
    const supabase = getSupabaseAdmin();

    const parsedEmpresaId = await resolverEmpresaId(data.empresa_id);
    const parsedSucursalId = data.sucursal_id ? Number(data.sucursal_id) : 0;

    if (!parsedEmpresaId || !parsedSucursalId) {
      return { error: "Debe seleccionar una empresa y una sucursal válidas." };
    }

    if (!data.codigo.trim() || !data.nombre.trim()) {
      return { error: "El código y la referencia/nombre son obligatorios." };
    }

    if (data.precio_venta < 0) {
      return { error: "El precio de venta no puede ser negativo." };
    }

    const payload = {
      empresa_id: parsedEmpresaId,
      sucursal_id: parsedSucursalId,
      codigo: data.codigo.trim(),
      nombre: data.nombre.trim(),
      descripcion: data.descripcion?.trim() || null,
      precio_venta: data.precio_venta,
      porcentaje_iva: data.porcentaje_iva ?? 0,
      aplica_descuento: data.aplica_descuento,
      porcentaje_descuento_max: data.aplica_descuento ? data.porcentaje_descuento_max : 0,
      estado: data.estado ?? true,
    };

    let query;
    if (data.id) {
      query = supabase
        .from("items_facturacion")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
    } else {
      query = supabase
        .from("items_facturacion")
        .insert([payload])
        .select()
        .single();
    }

    const { data: itemGuardado, error } = await query;

    if (error) {
      console.error("Error al guardar ítem:", error);
      return { error: `No se pudo guardar el ítem: ${error.message}` };
    }

    revalidatePath("/items");
    return { success: true, item: itemGuardado };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error interno del servidor.";
    return { error: errorMsg };
  }
}

/**
 * Cambiar estado (Inactivar) un ítem
 */
export async function cambiarEstadoItemFacturacion(id: string | number, estado: boolean) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("items_facturacion")
      .update({ estado })
      .eq("id", id);

    if (error) {
      return { error: `No se pudo actualizar el estado: ${error.message}` };
    }

    revalidatePath("/items");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error interno del servidor.";
    return { error: errorMsg };
  }
}

/**
 * Eliminar Ítem con verificación de movimientos
 */
export async function eliminarItemFacturacion(id: string | number) {
  try {
    const supabase = getSupabaseAdmin();

    const { count, error: checkError } = await supabase
      .from("detalle_facturas_emitidas")
      .select("id", { count: "exact", head: true })
      .eq("item_id", id);

    if (checkError) {
      return { error: `Error al validar movimientos: ${checkError.message}` };
    }

    if (count && count > 0) {
      return {
        error: `No es posible eliminar el ítem porque cuenta con ${count} movimiento(s) en facturas emitidas. Puede inactivarlo en su lugar.`,
      };
    }

    const { error: deleteError } = await supabase
      .from("items_facturacion")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return { error: `No se pudo eliminar el ítem: ${deleteError.message}` };
    }

    revalidatePath("/items");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error interno del servidor.";
    return { error: errorMsg };
  }
}