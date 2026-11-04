"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function obtenerSucursales(empresaId: number | string) {
  try {
    const parsedEmpresaId = Number(empresaId);
    if (!parsedEmpresaId) return { success: true, data: [], error: null };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sucursales")
      .select("id, nombre, codigo_sucursal")
      .eq("empresa_id", parsedEmpresaId)
      .order("id", { ascending: true });

    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: data || [], error: null };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function consultarMovimientosTransacciones(
  empresaId: number | string,
  sucursalId?: number | string | null,
  anio?: number | string | null,
  mes?: number | string | null
) {
  try {
    const parsedEmpresaId = Number(empresaId);
    if (!parsedEmpresaId) throw new Error("Debe especificar una empresa válida.");

    const parsedSucursalId = sucursalId ? Number(sucursalId) : null;
    const parsedAnio = anio ? Number(anio) : null;
    const parsedMes = mes ? Number(mes) : null;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc("obtener_movimientos_transacciones", {
      p_empresa_id: parsedEmpresaId,
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
  } catch (err: any) {
    console.error("Error en consultarMovimientosTransacciones:", err);
    return {
      success: false,
      data: [],
      error: err.message || "Error al consultar los movimientos contables.",
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
  } catch (err: any) {
    console.error("Error en obtenerComprobanteTransaccion:", err);
    return {
      success: false,
      data: [],
      error: err.message || "Error al obtener el comprobante contable.",
    };
  }
}