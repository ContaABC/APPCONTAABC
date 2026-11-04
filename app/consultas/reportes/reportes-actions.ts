"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)."
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

export async function obtenerCatalogosPorNivel(empresaId: number, nivel: 1 | 2 | 3) {
  const supabase = getSupabaseAdmin();
  try {
    if (nivel === 1) {
      const { data, error } = await supabase
        .from("conceptos_niif")
        .select("id, codigo_concepto, nombre")
        .eq("empresa_id", empresaId);
      if (error) throw error;
      return { success: true, data: (data || []).map((x: any) => ({ id: x.id, codigo: x.codigo_concepto, nombre: x.nombre })) };
    } 
    else if (nivel === 2) {
      const { data, error } = await supabase
        .from("subconceptos_niif")
        .select("id, codigo, nombre")
        .eq("empresa_id", empresaId);
      if (error) throw error;
      return { success: true, data: (data || []).map((x: any) => ({ id: x.id, codigo: x.codigo, nombre: x.nombre })) };
    } 
    else {
      const { data, error } = await supabase
        .from("conceptos_auxiliares")
        .select("id, codigo_auxiliar, nombre")
        .eq("empresa_id", empresaId);
      if (error) throw error;
      return { success: true, data: (data || []).map((x: any) => ({ id: x.id, codigo: x.codigo_auxiliar, nombre: x.nombre })) };
    }
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function obtenerBalanceDePrueba(
  empresaId: number | string, 
  sucursalId?: number | string | null, 
  anio?: number | string | null, 
  mes?: number | string | null, 
  nivel?: 'CONCEPTOS' | 'SUBCONCEPTOS' | 'AUXILIARES'
) {
  const supabase = getSupabaseAdmin();
  const parsedEmpresaId = Number(empresaId);
  const parsedSucursalId = sucursalId ? Number(sucursalId) : null;
  const parsedAnio = anio ? Number(anio) : null;
  const parsedMes = mes ? Number(mes) : null;

  try {
    if (nivel === 'AUXILIARES') {
      const { data: catAux, error: errCat } = await supabase
        .from("conceptos_auxiliares")
        .select("id, codigo_auxiliar, nombre")
        .eq("empresa_id", parsedEmpresaId);
      if (errCat) throw errCat;

      let qAct = supabase
        .from("saldos_acumulados_auxiliares")
        .select("concepto_auxiliar_id, total_debito, total_credito")
        .eq("empresa_id", parsedEmpresaId)
        .eq("anio", parsedAnio)
        .eq("mes", parsedMes);

      if (parsedSucursalId) qAct = qAct.eq("sucursal_id", parsedSucursalId);
      const { data: actData } = await qAct;

      let qHist = supabase
        .from("saldos_acumulados_auxiliares")
        .select("concepto_auxiliar_id, total_debito, total_credito")
        .eq("empresa_id", parsedEmpresaId)
        .eq("anio", parsedAnio)
        .lt("mes", parsedMes);

      if (parsedSucursalId) qHist = qHist.eq("sucursal_id", parsedSucursalId);
      const { data: histData } = await qHist;

      const mapAnt = new Map<string, number>();
      (histData || []).forEach((row: any) => {
        const key = String(row.concepto_auxiliar_id);
        const deb = Number(row.total_debito || 0);
        const cred = Number(row.total_credito || 0);
        mapAnt.set(key, (mapAnt.get(key) || 0) + (deb - cred));
      });

      const mapAct = new Map<string, { total_debito: number; total_credito: number }>();
      (actData || []).forEach((row: any) => {
        const key = String(row.concepto_auxiliar_id);
        const ex = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
        mapAct.set(key, {
          total_debito: ex.total_debito + Number(row.total_debito || 0),
          total_credito: ex.total_credito + Number(row.total_credito || 0)
        });
      });

      const resultado = (catAux || []).map((m: any) => {
        const key = String(m.id);
        const ant = mapAnt.get(key) || 0;
        const mov = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
        const final = ant + mov.total_debito - mov.total_credito;

        return {
          id: m.id,
          saldo_anterior: ant,
          total_debito: mov.total_debito,
          total_credito: mov.total_credito,
          saldo_final: final,
          codigo_orden: m.codigo_auxiliar || 'N/A',
          concepto_auxiliar: {
            codigo_auxiliar: m.codigo_auxiliar || 'N/A',
            nombre: m.nombre || 'Sin Descripción'
          }
        };
      });

      resultado.sort((a: any, b: any) => String(a.codigo_orden).localeCompare(String(b.codigo_orden)));
      return { success: true, data: resultado };
    }
    else if (nivel === 'SUBCONCEPTOS') {
      const { data: catSub, error: errCat } = await supabase
        .from("subconceptos_niif")
        .select("id, codigo, nombre")
        .eq("empresa_id", parsedEmpresaId);
      if (errCat) throw errCat;

      let qAct = supabase
        .from("saldos_acumulados_subconceptos")
        .select("subconcepto_niif_id, total_debito, total_credito")
        .eq("empresa_id", parsedEmpresaId)
        .eq("anio", parsedAnio)
        .eq("mes", parsedMes);

      if (parsedSucursalId) qAct = qAct.eq("sucursal_id", parsedSucursalId);
      const { data: actData } = await qAct;

      let qHist = supabase
        .from("saldos_acumulados_subconceptos")
        .select("subconcepto_niif_id, total_debito, total_credito")
        .eq("empresa_id", parsedEmpresaId)
        .eq("anio", parsedAnio)
        .lt("mes", parsedMes);

      if (parsedSucursalId) qHist = qHist.eq("sucursal_id", parsedSucursalId);
      const { data: histData } = await qHist;

      const mapAnt = new Map<string, number>();
      (histData || []).forEach((row: any) => {
        const key = String(row.subconcepto_niif_id).toLowerCase().trim();
        const deb = Number(row.total_debito || 0);
        const cred = Number(row.total_credito || 0);
        mapAnt.set(key, (mapAnt.get(key) || 0) + (deb - cred));
      });

      const mapAct = new Map<string, { total_debito: number; total_credito: number }>();
      (actData || []).forEach((row: any) => {
        const key = String(row.subconcepto_niif_id).toLowerCase().trim();
        const ex = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
        mapAct.set(key, {
          total_debito: ex.total_debito + Number(row.total_debito || 0),
          total_credito: ex.total_credito + Number(row.total_credito || 0)
        });
      });

      const resultado = (catSub || []).map((m: any) => {
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
          codigo_orden: m.codigo || 'N/A',
          subconcepto: {
            codigo: m.codigo || 'N/A',
            nombre: m.nombre || 'Sin Descripción'
          }
        };
      });

      resultado.sort((a: any, b: any) => String(a.codigo_orden).localeCompare(String(b.codigo_orden)));
      return { success: true, data: resultado };
    }
    else {
      const { data: catConc, error: errCat } = await supabase
        .from("conceptos_niif")
        .select("id, codigo_concepto, nombre")
        .eq("empresa_id", parsedEmpresaId);
      if (errCat) throw errCat;

      let qAct = supabase
        .from("saldos_acumulados_conceptos")
        .select("concepto_niif_id, total_debito, total_credito")
        .eq("empresa_id", parsedEmpresaId)
        .eq("anio", parsedAnio)
        .eq("mes", parsedMes);

      if (parsedSucursalId) qAct = qAct.eq("sucursal_id", parsedSucursalId);
      const { data: actData } = await qAct;

      let qHist = supabase
        .from("saldos_acumulados_conceptos")
        .select("concepto_niif_id, total_debito, total_credito")
        .eq("empresa_id", parsedEmpresaId)
        .eq("anio", parsedAnio)
        .lt("mes", parsedMes);

      if (parsedSucursalId) qHist = qHist.eq("sucursal_id", parsedSucursalId);
      const { data: histData } = await qHist;

      const mapAnt = new Map<string, number>();
      (histData || []).forEach((row: any) => {
        const key = String(row.concepto_niif_id).toLowerCase().trim();
        const deb = Number(row.total_debito || 0);
        const cred = Number(row.total_credito || 0);
        mapAnt.set(key, (mapAnt.get(key) || 0) + (deb - cred));
      });

      const mapAct = new Map<string, { total_debito: number; total_credito: number }>();
      (actData || []).forEach((row: any) => {
        const key = String(row.concepto_niif_id).toLowerCase().trim();
        const ex = mapAct.get(key) || { total_debito: 0, total_credito: 0 };
        mapAct.set(key, {
          total_debito: ex.total_debito + Number(row.total_debito || 0),
          total_credito: ex.total_credito + Number(row.total_credito || 0)
        });
      });

      const resultado = (catConc || []).map((m: any) => {
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
          codigo_orden: m.codigo_concepto || 'N/A',
          concepto: {
            codigo: m.codigo_concepto || 'N/A',
            nombre: m.nombre || 'Sin Descripción'
          }
        };
      });

      resultado.sort((a: any, b: any) => String(a.codigo_orden).localeCompare(String(b.codigo_orden)));
      return { success: true, data: resultado };
    }
  } catch (err: any) {
    console.error("Error en obtenerBalanceDePrueba:", err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function obtenerLibroMayorPorNivel(
  empresaId: number | string,
  sucursalId: number | string | null,
  nivel: 1 | 2 | 3,
  itemId: number | string,
  fechaInicio: string,
  fechaFin: string
) {
  const supabase = getSupabaseAdmin();
  const parsedEmpresaId = Number(empresaId);
  const parsedSucursalId = sucursalId ? Number(sucursalId) : null;

  try {
    let auxiliaresIds: number[] = [];

    if (nivel === 3) {
      auxiliaresIds = [Number(itemId)];
    } else if (nivel === 2) {
      const { data: auxs } = await supabase
        .from('conceptos_auxiliares')
        .select('id')
        .eq('subconcepto_niif_id', itemId);
      auxiliaresIds = (auxs || []).map((x: any) => x.id);
    } else {
      const { data: subs } = await supabase
        .from('subconceptos_niif')
        .select('id')
        .eq('concepto_niif_id', itemId);
      const subIds = (subs || []).map((x: any) => x.id);

      if (subIds.length > 0) {
        const { data: auxs } = await supabase
          .from('conceptos_auxiliares')
          .select('id')
          .in('subconcepto_niif_id', subIds);
        auxiliaresIds = (auxs || []).map((x: any) => x.id);
      }
    }

    if (auxiliaresIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('detalle_transacciones')
      .select(`
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
      `)
      .in('concepto_auxiliar_id', auxiliaresIds)
      .gte('fecha_contable', fechaInicio)
      .lte('fecha_contable', fechaFin)
      .order('fecha_contable', { ascending: true });

    if (error) throw error;

    const filtrados = (data || []).filter((item: any) => 
      item.transaccion?.empresa_id === parsedEmpresaId && 
      (parsedSucursalId ? item.transaccion?.sucursal_id === parsedSucursalId : true)
    );

    return { success: true, data: filtrados };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

// LIBRO DIARIO AUDITADO Y VERIFICADO CON COLUMNAS REALES
export async function obtenerLibroDiario(
  empresaId: number | string,
  sucursalId: number | string | null,
  anio: number | string,
  mes: number | string
) {
  const supabase = getSupabaseAdmin();
  const parsedEmpresaId = Number(empresaId);
  const parsedSucursalId = sucursalId ? Number(sucursalId) : null;
  const parsedAnio = Number(anio);
  const parsedMes = Number(mes);

  try {
    const fechaInicio = `${parsedAnio}-${String(parsedMes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(parsedAnio, parsedMes, 0).getDate();
    const fechaFin = `${parsedAnio}-${String(parsedMes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    // 1. Filtrar transacciones por empresa, sucursal opcional y fecha_contable
    let qTrans = supabase
      .from('transacciones')
      .select('id')
      .eq('empresa_id', parsedEmpresaId)
      .gte('fecha_contable', fechaInicio)
      .lte('fecha_contable', fechaFin);

    if (parsedSucursalId) {
      qTrans = qTrans.eq('sucursal_id', parsedSucursalId);
    }

    const { data: transData, error: errTrans } = await qTrans;
    if (errTrans) throw errTrans;

    const transIds = (transData || []).map((t: any) => t.id);
    if (transIds.length === 0) {
      return { success: true, data: [] };
    }

    // 2. Consultar detalle_transacciones con los nombres exactos de las columnas y llaves foráneas
    const { data, error } = await supabase
      .from('detalle_transacciones')
      .select(`
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
      `)
      .in('transaccion_id', transIds);

    if (error) throw error;

    // 3. Ordenamiento estricto: Fecha Contable -> Clase de Documento -> Consecutivo
    const sortedData = (data || []).sort((a: any, b: any) => {
      const fechaA = a.transaccion?.fecha_contable || a.fecha_contable || "";
      const fechaB = b.transaccion?.fecha_contable || b.fecha_contable || "";
      if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);

      const claseA = Number(a.transaccion?.clase_documento_id || 0);
      const claseB = Number(b.transaccion?.clase_documento_id || 0);
      if (claseA !== claseB) return claseA - claseB;

      const numA = String(a.transaccion?.numero_documento || "");
      const numB = String(b.transaccion?.numero_documento || "");
      return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return { success: true, data: sortedData };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}