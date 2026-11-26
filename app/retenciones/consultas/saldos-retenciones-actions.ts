"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan las variables de entorno de Supabase.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
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
    String(empresaId).trim() !== "0"
  ) {
    const parsed = Number(empresaId);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  const parsedCookie = Number(idCookie || 0);
  return Number.isNaN(parsedCookie) ? 0 : parsedCookie;
}

export interface SucursalSaldoRow {
  id: number | string;
  nombre?: string;
  codigo_sucursal?: string;
  ciudad?: string;
}

export interface TerceroSaldoRow {
  id: number | string;
  razon_social?: string | null;
  nombre_comercial?: string | null;
  nombre?: string | null;
  identificacion?: string | null;
  nit?: string | null;
  numero_documento?: string | null;
}

export interface ConceptoRetencionRef {
  id: number;
  concepto?: string;
  tarifa?: number;
  anio?: number;
  base_minima?: number;
  codigo_municipio?: string | null;
}

export interface RetencionMovimientoSaldoRow {
  id: string;
  empresa_id: number;
  sucursal_id: number | null;
  tercero_id: number;
  tercero_nombre?: string;
  tercero_identificacion?: string;
  fecha_contable: string;
  tipo_operacion: "EFECTUADA_POR_CLIENTE" | "PRACTICADA_A_PROVEEDOR" | string;
  documento_origen: string;
  tipo_retencion: "RENTA" | "IVA" | "ICA" | string;
  base_gravable: number;
  porcentaje: number;
  valor_retencion: number;
  conceptos_retencion_id: number | null;
  conceptos_retencion?: ConceptoRetencionRef | null;
}

export interface SaldoConceptoVigenciaRow {
  clave: string;
  conceptos_retencion_id: number | null;
  concepto: string;
  tipo_retencion: string;
  tipo_operacion: string;
  vigencia: string;
  porcentaje: number;
  cantidad_movimientos: number;
  base_gravable_total: number;
  valor_retencion_total: number;
}

export async function obtenerSucursalesSaldo(
  empresaId?: number | string | null
) {
  try {
    const supabase = getSupabaseClient();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    if (!parsedEmpresaId) {
      return { success: true, data: [] as SucursalSaldoRow[] };
    }

    const { data, error } = await supabase
      .from("sucursales")
      .select("id, nombre, codigo_sucursal, ciudad")
      .eq("empresa_id", parsedEmpresaId)
      .order("codigo_sucursal", { ascending: true });

    if (error) throw error;
    return { success: true, data: (data || []) as SucursalSaldoRow[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, data: [] as SucursalSaldoRow[] };
  }
}

export async function obtenerTercerosSaldo(
  empresaId?: number | string | null
) {
  try {
    const supabase = getSupabaseClient();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);
    if (!parsedEmpresaId) {
      return { success: true, data: [] as TerceroSaldoRow[] };
    }

    const { data, error } = await supabase
      .from("terceros")
      .select("*")
      .eq("empresa_id", parsedEmpresaId)
      .limit(1000);

    if (error) throw error;

    const lista = (data || []) as TerceroSaldoRow[];
    lista.sort((a, b) => {
      const na = String(
        a.razon_social || a.nombre_comercial || a.nombre || ""
      ).toLowerCase();
      const nb = String(
        b.razon_social || b.nombre_comercial || b.nombre || ""
      ).toLowerCase();
      return na.localeCompare(nb);
    });

    return { success: true, data: lista };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, data: [] as TerceroSaldoRow[] };
  }
}

export async function consultarSaldosRetenciones(params: {
  empresaId?: number | string | null;
  sucursalId?: string | number | null;
  terceroId?: string | number | null;
  tipoRetencion?: string;
  tipoOperacion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}) {
  try {
    const supabase = getSupabaseClient();
    const parsedEmpresaId = await resolverEmpresaId(params.empresaId);

    if (!parsedEmpresaId) {
      return {
        success: false,
        error: "No se pudo identificar la empresa activa.",
        movimientos: [] as RetencionMovimientoSaldoRow[],
      };
    }

    let query = supabase
      .from("retenciones_movimientos")
      .select(
        `
        id,
        empresa_id,
        sucursal_id,
        tercero_id,
        fecha_contable,
        tipo_operacion,
        documento_origen,
        tipo_retencion,
        base_gravable,
        porcentaje,
        valor_retencion,
        conceptos_retencion_id,
        conceptos_retencion (
          id,
          concepto,
          tarifa,
          anio,
          base_minima,
          codigo_municipio
        )
      `
      )
      .eq("empresa_id", parsedEmpresaId)
      .order("fecha_contable", { ascending: false });

    if (
      params.sucursalId !== undefined &&
      params.sucursalId !== null &&
      String(params.sucursalId).trim() !== ""
    ) {
      query = query.eq("sucursal_id", Number(params.sucursalId));
    }

    if (
      params.terceroId !== undefined &&
      params.terceroId !== null &&
      String(params.terceroId).trim() !== "" &&
      String(params.terceroId) !== "TODOS"
    ) {
      query = query.eq("tercero_id", Number(params.terceroId));
    }

    if (params.tipoRetencion && params.tipoRetencion !== "TODOS") {
      query = query.eq("tipo_retencion", params.tipoRetencion);
    }

    if (params.tipoOperacion && params.tipoOperacion !== "TODOS") {
      query = query.eq("tipo_operacion", params.tipoOperacion);
    }

    if (params.fechaDesde && params.fechaDesde.trim() !== "") {
      query = query.gte("fecha_contable", params.fechaDesde.trim());
    }

    if (params.fechaHasta && params.fechaHasta.trim() !== "") {
      query = query.lte("fecha_contable", params.fechaHasta.trim());
    }

    const { data, error } = await query;
    if (error) throw error;

    const normalizados: RetencionMovimientoSaldoRow[] = (data || []).map(
      (row: Record<string, unknown>) => {
        const rawConcepto = row.conceptos_retencion;
        const conceptoObj: ConceptoRetencionRef | null = Array.isArray(
          rawConcepto
        )
          ? (rawConcepto[0] as ConceptoRetencionRef | undefined) ?? null
          : (rawConcepto as ConceptoRetencionRef | null) ?? null;

        return {
          id: String(row.id),
          empresa_id: Number(row.empresa_id),
          sucursal_id:
            row.sucursal_id !== null && row.sucursal_id !== undefined
              ? Number(row.sucursal_id)
              : null,
          tercero_id: Number(row.tercero_id),
          fecha_contable: String(row.fecha_contable || ""),
          tipo_operacion: String(row.tipo_operacion || ""),
          documento_origen: String(row.documento_origen || ""),
          tipo_retencion: String(row.tipo_retencion || ""),
          base_gravable: Number(row.base_gravable || 0),
          porcentaje: Number(row.porcentaje || 0),
          valor_retencion: Number(row.valor_retencion || 0),
          conceptos_retencion_id:
            row.conceptos_retencion_id !== null &&
            row.conceptos_retencion_id !== undefined
              ? Number(row.conceptos_retencion_id)
              : null,
          conceptos_retencion: conceptoObj,
        };
      }
    );

    return {
      success: true,
      movimientos: normalizados,
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg,
      movimientos: [] as RetencionMovimientoSaldoRow[],
    };
  }
}