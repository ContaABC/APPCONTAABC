"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

interface CatalogoRow {
  id: string | number;
  codigo?: string;
  codigo_concepto?: string;
  codigo_auxiliar?: string;
  nombre?: string;
}

interface SaldoAcumuladoRow {
  concepto_niif_id?: string | number;
  subconcepto_niif_id?: string | number;
  concepto_auxiliar_id?: string | number;
  total_debito?: number | string | null;
  total_credito?: number | string | null;
}

interface BalanceFilaItem {
  id: string | number;
  saldo_anterior: number;
  total_debito: number;
  total_credito: number;
  saldo_final: number;
  codigo_orden: string;
  concepto?: { codigo: string; nombre: string };
  subconcepto?: { codigo: string; nombre: string };
  concepto_auxiliar?: { codigo_auxiliar: string; nombre: string };
}

interface DetalleTransaccionMayorRow {
  id: string | number;
  debito?: number | string | null;
  credito?: number | string | null;
  fecha_contable?: string | null;
  concepto_auxiliar_id?: string | number | null;
  transaccion?: {
    id?: string | number;
    numero_documento?: string | null;
    glosa_concepto?: string | null;
    modulo_origen?: string | null;
    empresa_id?: number | string | null;
    sucursal_id?: number | string | null;
    clase_documento_id?: number | string | null;
    fecha_contable?: string | null;
  } | null;
  tercero?: {
    id?: string | number;
    razon_social?: string | null;
    nombre_comercial?: string | null;
    numero_identificacion?: string | null;
  } | null;
  concepto_auxiliar?: {
    id?: string | number;
    codigo_auxiliar?: string | null;
    nombre?: string | null;
  } | null;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)."
    );
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
    String(empresaId).trim() !== ""
  ) {
    const parsed = Number(empresaId);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  const parsedCookie = Number(idCookie || 0);
  return Number.isNaN(parsedCookie) ? 0 : parsedCookie;
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
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error desconocido al obtener empresas.";
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
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error desconocido al obtener sucursales.";
    return { success: false, data: [], error: mensaje };
  }
}

export async function obtenerCatalogosPorNivel(
  empresaId?: number | string | null,
  nivel?: 1 | 2 | 3
) {
  const supabase = getSupabaseAdmin();
  try {
    const idEmpresa = await resolverEmpresaId(empresaId);
    if (!idEmpresa)
      throw new Error("Debe especificar o tener activa una empresa válida.");

    if (nivel === 1) {
      const { data, error } = await supabase
        .from("conceptos_niif")
        .select("id, codigo_concepto, nombre")
        .eq("empresa_id", idEmpresa);
      if (error) throw error;
      return {
        success: true,
        data: ((data || []) as CatalogoRow[]).map((x) => ({
          id: x.id,
          codigo: x.codigo_concepto || "",
          nombre: x.nombre || "",
        })),
      };
    } else if (nivel === 2) {
      const { data, error } = await supabase
        .from("subconceptos_niif")
        .select("id, codigo, nombre")
        .eq("empresa_id", idEmpresa);
      if (error) throw error;
      return {
        success: true,
        data: ((data || []) as CatalogoRow[]).map((x) => ({
          id: x.id,
          codigo: x.codigo || "",
          nombre: x.nombre || "",
        })),
      };
    } else {
      const { data, error } = await supabase
        .from("conceptos_auxiliares")
        .select("id, codigo_auxiliar, nombre")
        .eq("empresa_id", idEmpresa);
      if (error) throw error;
      return {
        success: true,
        data: ((data || []) as CatalogoRow[]).map((x) => ({
          id: x.id,
          codigo: x.codigo_auxiliar || "",
          nombre: x.nombre || "",
        })),
      };
    }
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error desconocido al obtener catálogos.";
    return { success: false, error: mensaje, data: [] };
  }
}

export async function obtenerBalanceDePrueba(
  empresaId?: number | string | null,
  sucursalId?: number | string | null,
  anio?: number | string | null,
  mes?: number | string | null,
  nivel?: "CONCEPTOS" | "SUBCONCEPTOS" | "AUXILIARES"
) {
  const supabase = getSupabaseAdmin();
  const idEmpresa = await resolverEmpresaId(empresaId);
  const parsedSucursalId = sucursalId ? Number(sucursalId) : null;
  const parsedAnio = anio ? Number(anio) : null;
  const parsedMes = mes ? Number(mes) : null;

  try {
    if (!idEmpresa)
      throw new Error("Debe especificar o tener activa una empresa válida.");
    if (!parsedAnio || !parsedMes) {
      throw new Error("Debe seleccionar un año y un mes para el balance de prueba.");
    }

    if (nivel === "AUXILIARES") {
      const { data: catAux, error: errCat } = await supabase
        .from("conceptos_auxiliares")
        .select("id, codigo_auxiliar, nombre")
        .eq("empresa_id", idEmpresa);
      if (errCat) throw errCat;

      let qAct = supabase
        .from("saldos_acumulados_auxiliares")
        .select("concepto_auxiliar_id, total_debito, total_credito")
        .eq("empresa_id", idEmpresa)
        .eq("anio", parsedAnio)
        .eq("mes", parsedMes);

      if (parsedSucursalId) qAct = qAct.eq("sucursal_id", parsedSucursalId);
      const { data: actData } = await qAct;

      let qHist = supabase
        .from("saldos_acumulados_auxiliares")
        .select("concepto_auxiliar_id, total_debito, total_credito")
        .eq("empresa_id", idEmpresa)
        .eq("anio", parsedAnio)
        .lt("mes", parsedMes);

      if (parsedSucursalId) qHist = qHist.eq("sucursal_id", parsedSucursalId);
      const { data: histData } = await qHist;

      const mapAnt = new Map<string, number>();
      ((histData || []) as SaldoAcumuladoRow[]).forEach((row) => {
        const key = String(row.concepto_auxiliar_id || "")
          .toLowerCase()
          .trim();
        if (!key) return;
        const deb = Number(row.total_debito || 0);
        const cred = Number(row.total_credito || 0);
        mapAnt.set(key, (mapAnt.get(key) || 0) + (deb - cred));
      });

      const mapAct = new Map<
        string,
        { total_debito: number; total_credito: number }
      >();
      ((actData || []) as SaldoAcumuladoRow[]).forEach((row) => {
        const key = String(row.concepto_auxiliar_id || "")
          .toLowerCase()
          .trim();
        if (!key) return;
        const ex = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
        mapAct.set(key, {
          total_debito: ex.total_debito + Number(row.total_debito || 0),
          total_credito: ex.total_credito + Number(row.total_credito || 0),
        });
      });

      const resultado: BalanceFilaItem[] = ((catAux || []) as CatalogoRow[]).map(
        (m) => {
          const key = String(m.id).toLowerCase().trim();
          const ant = mapAnt.get(key) || 0;
          const mov = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
          const final = ant + mov.total_debito - mov.total_credito;

          return {
            id: m.id,
            saldo_anterior: ant,
            total_debito: mov.total_debito,
            total_credito: mov.total_credito,
            saldo_final: final,
            codigo_orden: m.codigo_auxiliar || "N/A",
            concepto_auxiliar: {
              codigo_auxiliar: m.codigo_auxiliar || "N/A",
              nombre: m.nombre || "Sin Descripción",
            },
          };
        }
      );

      resultado.sort((a, b) =>
        String(a.codigo_orden).localeCompare(String(b.codigo_orden))
      );
      return { success: true, data: resultado };
    } else if (nivel === "SUBCONCEPTOS") {
      const { data: catSub, error: errCat } = await supabase
        .from("subconceptos_niif")
        .select("id, codigo, nombre")
        .eq("empresa_id", idEmpresa);
      if (errCat) throw errCat;

      let qAct = supabase
        .from("saldos_acumulados_subconceptos")
        .select("subconcepto_niif_id, total_debito, total_credito")
        .eq("empresa_id", idEmpresa)
        .eq("anio", parsedAnio)
        .eq("mes", parsedMes);

      if (parsedSucursalId) qAct = qAct.eq("sucursal_id", parsedSucursalId);
      const { data: actData } = await qAct;

      let qHist = supabase
        .from("saldos_acumulados_subconceptos")
        .select("subconcepto_niif_id, total_debito, total_credito")
        .eq("empresa_id", idEmpresa)
        .eq("anio", parsedAnio)
        .lt("mes", parsedMes);

      if (parsedSucursalId) qHist = qHist.eq("sucursal_id", parsedSucursalId);
      const { data: histData } = await qHist;

      const mapAnt = new Map<string, number>();
      ((histData || []) as SaldoAcumuladoRow[]).forEach((row) => {
        const key = String(row.subconcepto_niif_id || "")
          .toLowerCase()
          .trim();
        if (!key) return;
        const deb = Number(row.total_debito || 0);
        const cred = Number(row.total_credito || 0);
        mapAnt.set(key, (mapAnt.get(key) || 0) + (deb - cred));
      });

      const mapAct = new Map<
        string,
        { total_debito: number; total_credito: number }
      >();
      ((actData || []) as SaldoAcumuladoRow[]).forEach((row) => {
        const key = String(row.subconcepto_niif_id || "")
          .toLowerCase()
          .trim();
        if (!key) return;
        const ex = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
        mapAct.set(key, {
          total_debito: ex.total_debito + Number(row.total_debito || 0),
          total_credito: ex.total_credito + Number(row.total_credito || 0),
        });
      });

      const resultado: BalanceFilaItem[] = ((catSub || []) as CatalogoRow[]).map(
        (m) => {
          const key = String(m.id).toLowerCase().trim();
          const ant = mapAnt.get(key) || 0;
          const mov = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
          const final = ant + mov.total_debito - mov.total_credito;

          return {
            id: m.id,
            saldo_anterior: ant,
            total_debito: mov.total_debito,
            total_credito: mov.total_credito,
            saldo_final: final,
            codigo_orden: m.codigo || "N/A",
            subconcepto: {
              codigo: m.codigo || "N/A",
              nombre: m.nombre || "Sin Descripción",
            },
          };
        }
      );

      resultado.sort((a, b) =>
        String(a.codigo_orden).localeCompare(String(b.codigo_orden))
      );
      return { success: true, data: resultado };
    } else {
      const { data: catConc, error: errCat } = await supabase
        .from("conceptos_niif")
        .select("id, codigo_concepto, nombre")
        .eq("empresa_id", idEmpresa);
      if (errCat) throw errCat;

      let qAct = supabase
        .from("saldos_acumulados_conceptos")
        .select("concepto_niif_id, total_debito, total_credito")
        .eq("empresa_id", idEmpresa)
        .eq("anio", parsedAnio)
        .eq("mes", parsedMes);

      if (parsedSucursalId) qAct = qAct.eq("sucursal_id", parsedSucursalId);
      const { data: actData } = await qAct;

      let qHist = supabase
        .from("saldos_acumulados_conceptos")
        .select("concepto_niif_id, total_debito, total_credito")
        .eq("empresa_id", idEmpresa)
        .eq("anio", parsedAnio)
        .lt("mes", parsedMes);

      if (parsedSucursalId) qHist = qHist.eq("sucursal_id", parsedSucursalId);
      const { data: histData } = await qHist;

      const mapAnt = new Map<string, number>();
      ((histData || []) as SaldoAcumuladoRow[]).forEach((row) => {
        const key = String(row.concepto_niif_id || "")
          .toLowerCase()
          .trim();
        if (!key) return;
        const deb = Number(row.total_debito || 0);
        const cred = Number(row.total_credito || 0);
        mapAnt.set(key, (mapAnt.get(key) || 0) + (deb - cred));
      });

      const mapAct = new Map<
        string,
        { total_debito: number; total_credito: number }
      >();
      ((actData || []) as SaldoAcumuladoRow[]).forEach((row) => {
        const key = String(row.concepto_niif_id || "")
          .toLowerCase()
          .trim();
        if (!key) return;
        const ex = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
        mapAct.set(key, {
          total_debito: ex.total_debito + Number(row.total_debito || 0),
          total_credito: ex.total_credito + Number(row.total_credito || 0),
        });
      });

      const resultado: BalanceFilaItem[] = (
        (catConc || []) as CatalogoRow[]
      ).map((m) => {
        const key = String(m.id).toLowerCase().trim();
        const ant = mapAnt.get(key) || 0;
        const mov = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
        const final = ant + mov.total_debito - mov.total_credito;

        return {
          id: m.id,
          saldo_anterior: ant,
          total_debito: mov.total_debito,
          total_credito: mov.total_credito,
          saldo_final: final,
          codigo_orden: m.codigo_concepto || "N/A",
          concepto: {
            codigo: m.codigo_concepto || "N/A",
            nombre: m.nombre || "Sin Descripción",
          },
        };
      });

      resultado.sort((a, b) =>
        String(a.codigo_orden).localeCompare(String(b.codigo_orden))
      );
      return { success: true, data: resultado };
    }
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error desconocido al obtener el balance de prueba.";
    console.error("Error en obtenerBalanceDePrueba:", mensaje);
    return { success: false, error: mensaje, data: [] };
  }
}

export async function obtenerLibroMayorPorNivel(
  empresaId?: number | string | null,
  sucursalId?: number | string | null,
  nivel?: 1 | 2 | 3,
  itemId?: number | string,
  fechaInicio?: string,
  fechaFin?: string
) {
  const supabase = getSupabaseAdmin();
  const idEmpresa = await resolverEmpresaId(empresaId);
  const parsedSucursalId = sucursalId ? Number(sucursalId) : null;

  try {
    if (!idEmpresa)
      throw new Error("Debe especificar o tener activa una empresa válida.");
    if (!itemId || !nivel || !fechaInicio || !fechaFin) {
      return { success: true, data: [] };
    }

    let auxiliaresIds: Array<number | string> = [];

    if (nivel === 3) {
      auxiliaresIds = [itemId];
    } else if (nivel === 2) {
      const { data: auxs } = await supabase
        .from("conceptos_auxiliares")
        .select("id")
        .eq("subconcepto_niif_id", itemId);
      auxiliaresIds = ((auxs || []) as CatalogoRow[]).map((x) => x.id);
    } else {
      const { data: subs } = await supabase
        .from("subconceptos_niif")
        .select("id")
        .eq("concepto_niif_id", itemId);
      const subIds = ((subs || []) as CatalogoRow[]).map((x) => x.id);

      if (subIds.length > 0) {
        const { data: auxs } = await supabase
          .from("conceptos_auxiliares")
          .select("id")
          .in("subconcepto_niif_id", subIds);
        auxiliaresIds = ((auxs || []) as CatalogoRow[]).map((x) => x.id);
      }
    }

    if (auxiliaresIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("detalle_transacciones")
      .select(
        `
        id,
        debito,
        credito,
        fecha_contable,
        concepto_auxiliar_id,
        transaccion:transaccion_id (
          id,
          numero_documento,
          glosa_concepto,
          modulo_origen,
          empresa_id,
          sucursal_id,
          clase_documento_id,
          fecha_contable
        ),
        tercero:tercero_id (
          id,
          razon_social,
          nombre_comercial,
          numero_identificacion
        )
      `
      )
      .in("concepto_auxiliar_id", auxiliaresIds)
      .gte("fecha_contable", fechaInicio)
      .lte("fecha_contable", fechaFin)
      .order("fecha_contable", { ascending: true });

    if (error) throw error;

    const filtrados = ((data || []) as unknown as DetalleTransaccionMayorRow[]).filter(
      (item) =>
        Number(item.transaccion?.empresa_id) === idEmpresa &&
        (parsedSucursalId
          ? Number(item.transaccion?.sucursal_id) === parsedSucursalId
          : true)
    );

    return { success: true, data: filtrados };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error desconocido al obtener el libro mayor.";
    return { success: false, error: mensaje, data: [] };
  }
}

export async function obtenerLibroDiario(
  empresaId?: number | string | null,
  sucursalId?: number | string | null,
  anio?: number | string,
  mes?: number | string
) {
  const supabase = getSupabaseAdmin();
  const idEmpresa = await resolverEmpresaId(empresaId);
  const parsedSucursalId = sucursalId ? Number(sucursalId) : null;
  const parsedAnio = anio ? Number(anio) : null;
  const parsedMes = mes ? Number(mes) : null;

  try {
    if (!idEmpresa)
      throw new Error("Debe especificar o tener activa una empresa válida.");
    if (!parsedAnio || !parsedMes) {
      throw new Error("Debe seleccionar un año y un mes para el libro diario.");
    }

    const fechaInicio = `${parsedAnio}-${String(parsedMes).padStart(
      2,
      "0"
    )}-01`;
    const ultimoDia = new Date(parsedAnio, parsedMes, 0).getDate();
    const fechaFin = `${parsedAnio}-${String(parsedMes).padStart(
      2,
      "0"
    )}-${String(ultimoDia).padStart(2, "0")}`;

    let qTrans = supabase
      .from("transacciones")
      .select("id")
      .eq("empresa_id", idEmpresa)
      .gte("fecha_contable", fechaInicio)
      .lte("fecha_contable", fechaFin);

    if (parsedSucursalId) {
      qTrans = qTrans.eq("sucursal_id", parsedSucursalId);
    }

    const { data: transData, error: errTrans } = await qTrans;
    if (errTrans) throw errTrans;

    const transIds = ((transData || []) as CatalogoRow[]).map((t) => t.id);
    if (transIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("detalle_transacciones")
      .select(
        `
        id,
        debito,
        credito,
        fecha_contable,
        transaccion:transaccion_id (
          id,
          fecha_contable,
          clase_documento_id,
          numero_documento,
          glosa_concepto,
          empresa_id,
          sucursal_id
        ),
        tercero:tercero_id (
          id,
          razon_social,
          nombre_comercial,
          numero_identificacion
        ),
        concepto_auxiliar:concepto_auxiliar_id (
          id,
          codigo_auxiliar,
          nombre
        )
      `
      )
      .in("transaccion_id", transIds);

    if (error) throw error;

    const sortedData = ((data || []) as unknown as DetalleTransaccionMayorRow[]).sort(
      (a, b) => {
        const fechaA =
          a.transaccion?.fecha_contable || a.fecha_contable || "";
        const fechaB =
          b.transaccion?.fecha_contable || b.fecha_contable || "";
        if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);

        const claseA = Number(a.transaccion?.clase_documento_id || 0);
        const claseB = Number(b.transaccion?.clase_documento_id || 0);
        if (claseA !== claseB) return claseA - claseB;

        const numA = String(a.transaccion?.numero_documento || "");
        const numB = String(b.transaccion?.numero_documento || "");
        return numA.localeCompare(numB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
    );

    return { success: true, data: sortedData };
  } catch (err: unknown) {
    const mensaje =
      err instanceof Error
        ? err.message
        : "Error desconocido al obtener el libro diario.";
    return { success: false, error: mensaje, data: [] };
  }
}