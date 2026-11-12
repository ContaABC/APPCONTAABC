"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)."
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

export async function obtenerEmpresas() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("empresas")
      .select("id, razon_social, nombre_comercial")
      .order("razon_social", { ascending: true });

    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al obtener empresas.";
    return { success: false, data: [], error: mensaje };
  }
}

export async function obtenerSucursales(empresaId?: number | string | null) {
  try {
    const idEmpresa = await resolverEmpresaId(empresaId);
    if (!idEmpresa) return { success: true, data: [], error: null };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sucursales")
      .select("id, nombre, codigo_sucursal")
      .eq("empresa_id", idEmpresa)
      .order("id", { ascending: true });

    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: data || [], error: null };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al obtener sucursales.";
    return { success: false, data: [], error: mensaje };
  }
}

export async function consultarMovimientosTransacciones(
  empresaId?: number | string | null,
  sucursalId?: number | string | null,
  anio?: number | string | null,
  mes?: number | string | null
) {
  try {
    const idEmpresa = await resolverEmpresaId(empresaId);
    if (!idEmpresa) throw new Error("Debe especificar o tener activa una empresa válida.");

    const parsedSucursalId = sucursalId ? Number(sucursalId) : null;
    const parsedAnio = anio ? Number(anio) : null;
    const parsedMes = mes ? Number(mes) : null;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc("obtener_movimientos_transacciones", {
      p_empresa_id: idEmpresa,
      p_sucursal_id: parsedSucursalId,
      p_anio: parsedAnio,
      p_mes: parsedMes,
    });

    if (error) throw new Error(`Error en RPC: ${error.message}`);

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al consultar los movimientos contables.";
    console.error("Error en consultarMovimientosTransacciones:", mensaje);
    return {
      success: false,
      data: [],
      error: mensaje,
    };
  }
}

export async function obtenerComprobanteTransaccion(transaccionId: number | string) {
  try {
    const parsedId = Number(transaccionId);
    if (!parsedId) throw new Error("ID de transacción inválido.");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("obtener_comprobante_transaccion", {
      p_transaccion_id: parsedId,
    });

    if (error) throw new Error(`Error en RPC: ${error.message}`);

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al obtener el comprobante contable.";
    console.error("Error en obtenerComprobanteTransaccion:", mensaje);
    return {
      success: false,
      data: [],
      error: mensaje,
    };
  }
}