"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

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

async function resolverEmpresaId(empresaId?: number | string | null): Promise<number> {
  if (empresaId && String(empresaId) !== "0" && String(empresaId) !== "") {
    return Number(empresaId);
  }
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
}

export interface EmpresaInfo {
  razon_social?: string;
  nit_identificacion?: string;
  dv?: string;
  direccion?: string;
  telefono?: string;
  ciudad?: string;
  departamento?: string;
  email?: string;
}

export interface SucursalInfo {
  nombre?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  telefono?: string;
}

export interface TerceroCertificado {
  id: number | string;
  nombre: string;
  nit?: string;
  dv?: string;
  direccion?: string;
  telefono?: string;
  ciudad?: string;
}

export interface DetalleCertificado {
  concepto: string;
  tarifa: number;
  base: number;
  retenido: number;
}

export interface CertificadoItem {
  tercero: TerceroCertificado;
  total_base: number;
  total_retenido: number;
  detalles: DetalleCertificado[];
}

export interface DiferenciaItem {
  tercero_id: string | number;
  nit: string;
  nombre: string;
  auxiliar: number;
  contabilidad: number;
  diferencia: number;
}

export interface CertificadosRetencionResult {
  success: boolean;
  empresa: EmpresaInfo | null;
  sucursal: SucursalInfo | null;
  certificados: CertificadoItem[];
  diferencias: DiferenciaItem[];
  error: string | null;
}

export async function obtenerCertificadosRetencion(
  empresaId: number | string | null | undefined,
  sucursalId: number | string | undefined,
  tipoRetencion: "RENTA" | "IVA" | "ICA",
  fechaInicio: string,
  fechaFin: string
): Promise<CertificadosRetencionResult> {
  try {
    const supabase = getSupabaseAdmin();
    const parsedEmpresaId = await resolverEmpresaId(empresaId);

    if (!parsedEmpresaId) {
      return {
        success: false,
        empresa: null,
        sucursal: null,
        certificados: [],
        diferencias: [],
        error: "No se ha especificado una empresa activa o válida.",
      };
    }

    // 1. Obtener datos de la empresa y su dirección
    const { data: empresaData } = await supabase
      .from("empresas")
      .select("razon_social, nit_identificacion, dv, direccion, telefono, ciudad, departamento, email")
      .eq("id", parsedEmpresaId)
      .single();

    let direccionEmpresa = empresaData?.direccion;
    if (!direccionEmpresa) {
      const { data: sucPrincipal } = await supabase
        .from("sucursales")
        .select("direccion")
        .eq("empresa_id", parsedEmpresaId)
        .eq("es_bodega_principal", true)
        .maybeSingle();
      
      if (sucPrincipal?.direccion) {
        direccionEmpresa = sucPrincipal.direccion;
      }
    }

    const empresaFinal: EmpresaInfo = {
      ...(empresaData || {}),
      direccion: direccionEmpresa || "No registrada"
    };

    let sucursalData: SucursalInfo | null = null;
    if (sucursalId && String(sucursalId) !== "0") {
      const { data: suc } = await supabase
        .from("sucursales")
        .select("nombre, direccion, ciudad, departamento, telefono")
        .eq("id", Number(sucursalId))
        .single();
      sucursalData = suc;
    }

    // 2. Consultar los movimientos de retención filtrando estrictamente por PRACTICADA_A_PROVEEDOR
    let queryMovs = supabase
      .from("retenciones_movimientos")
      .select(`
        id,
        base_gravable,
        valor_retencion,
        fecha_contable,
        tercero_id,
        sucursal_id,
        tipo_retencion,
        tipo_operacion,
        terceros (
          id,
          razon_social,
          primer_nombre,
          segundo_nombre,
          primer_apellido,
          segundo_apellido,
          numero_identificacion,
          dv,
          direccion,
          telefono,
          ciudad
        ),
        conceptos_retencion (
          id,
          tipo_retencion,
          concepto,
          tarifa,
          concepto_auxiliar_id
        )
      `)
      .eq("empresa_id", parsedEmpresaId)
      .eq("tipo_retencion", tipoRetencion)
      .eq("tipo_operacion", "PRACTICADA_A_PROVEEDOR")
      .gte("fecha_contable", fechaInicio)
      .lte("fecha_contable", fechaFin);

    if (sucursalId && String(sucursalId) !== "0") {
      queryMovs = queryMovs.eq("sucursal_id", Number(sucursalId));
    }

    const { data: movimientos, error: errMovs } = await queryMovs;
    if (errMovs) throw errMovs;

    if (!movimientos || movimientos.length === 0) {
      return { success: true, empresa: empresaFinal, sucursal: sucursalData, certificados: [], diferencias: [], error: null };
    }

    interface TransaccionDetalleRow {
      tercero_id: number | string | null;
      concepto_auxiliar_id: number | string | null;
      debito?: number | string;
      credito?: number | string;
    }

    // 3. Consultar la contabilidad haciendo JOIN con transacciones para filtrar por empresa_id y fechas
    let queryTrans = supabase
      .from("detalle_transacciones")
      .select(`
        tercero_id,
        concepto_auxiliar_id,
        debito,
        credito,
        transacciones!inner (
          empresa_id,
          sucursal_id
        )
      `)
      .eq("transacciones.empresa_id", parsedEmpresaId)
      .gte("fecha_contable", fechaInicio)
      .lte("fecha_contable", fechaFin);

    if (sucursalId && String(sucursalId) !== "0") {
      queryTrans = queryTrans.eq("transacciones.sucursal_id", Number(sucursalId));
    }

    const { data: transaccionesContables, error: errTrans } = await queryTrans;
    if (errTrans) throw errTrans;

    // 4. Mapear saldos contables por clave única: `${tercero_id}_${concepto_auxiliar_id}`
    const mapaContable = new Map<string, number>();
    (transaccionesContables as TransaccionDetalleRow[] || []).forEach((t) => {
      if (!t.tercero_id || !t.concepto_auxiliar_id) return;
      const clave = `${t.tercero_id}_${t.concepto_auxiliar_id}`;
      const actual = mapaContable.get(clave) || 0;
      const netoMovimiento = Number(t.credito || 0) - Number(t.debito || 0);
      mapaContable.set(clave, actual + netoMovimiento);
    });

    interface TerceroDB {
      id?: number | string;
      razon_social?: string;
      primer_nombre?: string;
      segundo_nombre?: string;
      primer_apellido?: string;
      segundo_apellido?: string;
      numero_identificacion?: string;
      dv?: string;
      direccion?: string;
      telefono?: string;
      ciudad?: string;
    }

    interface MovimientoDB {
      id?: number | string;
      base_gravable?: number | string;
      valor_retencion?: number | string;
      fecha_contable?: string;
      tercero_id?: number | string;
      sucursal_id?: number | string;
      tipo_retencion?: string;
      tipo_operacion?: string;
      terceros?: TerceroDB;
      conceptos_retencion?: {
        id?: number | string;
        tipo_retencion?: string;
        concepto?: string;
        tarifa?: number | string;
        concepto_auxiliar_id?: number | string;
      };
    }

    // 5. Agrupar auxiliar por Tercero y Concepto Auxiliar para validar contra contabilidad
    const auxiliarAgrupado = new Map<string, { total: number; tercero: TerceroDB; concepto: string }>();
    (movimientos as MovimientoDB[] || []).forEach((mov) => {
      const tid = mov.tercero_id;
      const conceptoAuxId = mov.conceptos_retencion?.concepto_auxiliar_id;
      if (!tid || !conceptoAuxId) return;

      const clave = `${tid}_${conceptoAuxId}`;
      const actual = auxiliarAgrupado.get(clave) || { 
        total: 0, 
        tercero: mov.terceros || {}, 
        concepto: mov.conceptos_retencion?.concepto || "" 
      };
      actual.total += Number(mov.valor_retencion || 0);
      auxiliarAgrupado.set(clave, actual);
    });

    // 6. Validar diferencias reales cruzando ambas tablas con tolerancia menor a 1 peso
    const diferenciasEncontradas: DiferenciaItem[] = [];
    const tercerosConDiferenciaMap = new Map<string | number, DiferenciaItem>();

    auxiliarAgrupado.forEach((val, clave) => {
      const totalAuxiliar = Number(val.total.toFixed(2));
      const totalContable = Number((mapaContable.get(clave) || 0).toFixed(2));

      if (Math.abs(totalAuxiliar - totalContable) > 1) {
        const [tid] = clave.split("_");
        const terceroInfo = val.tercero;
        const nombreTercero = terceroInfo?.razon_social || 
          [terceroInfo?.primer_nombre, terceroInfo?.segundo_nombre, terceroInfo?.primer_apellido, terceroInfo?.segundo_apellido].filter(Boolean).join(" ") || "Tercero ID " + tid;

        const nitFormateado = `${terceroInfo?.numero_identificacion || ''}${terceroInfo?.dv ? '-' + terceroInfo.dv : ''}`;

        if (!tercerosConDiferenciaMap.has(tid)) {
          tercerosConDiferenciaMap.set(tid, {
            tercero_id: tid,
            nit: nitFormateado,
            nombre: nombreTercero,
            auxiliar: 0,
            contabilidad: 0,
            diferencia: 0
          });
        }

        const itemDif = tercerosConDiferenciaMap.get(tid)!;
        itemDif.auxiliar += totalAuxiliar;
        itemDif.contabilidad += totalContable;
        itemDif.diferencia += (totalAuxiliar - totalContable);
      }
    });

    tercerosConDiferenciaMap.forEach((v) => diferenciasEncontradas.push(v));

    // 7. Si hay diferencias, BLOQUEAR la generación y retornar la lista de afectados
    if (diferenciasEncontradas.length > 0) {
      return {
        success: false,
        empresa: empresaFinal,
        sucursal: sucursalData,
        certificados: [],
        diferencias: diferenciasEncontradas,
        error: "Se encontraron diferencias contables entre el auxiliar de retenciones y las transacciones registradas para uno o más terceros."
      };
    }

    // 8. Si todo está correcto, construir los certificados agrupados por concepto
    const mapaTerceros = new Map<string | number, { tercero: TerceroCertificado; total_base: number; total_retenido: number; conceptosMap: Map<string, DetalleCertificado> }>();

    (movimientos as MovimientoDB[] || []).forEach((mov) => {
      const tercero = mov.terceros;
      if (!tercero || !tercero.id) return;

      const nombreTercero = tercero.razon_social || 
        [tercero.primer_nombre, tercero.segundo_nombre, tercero.primer_apellido, tercero.segundo_apellido].filter(Boolean).join(" ");

      if (!mapaTerceros.has(tercero.id)) {
        mapaTerceros.set(tercero.id, {
          tercero: {
            id: tercero.id,
            nombre: nombreTercero || "Sin Nombre",
            nit: tercero.numero_identificacion,
            dv: tercero.dv ? `-${tercero.dv}` : "",
            direccion: tercero.direccion,
            telefono: tercero.telefono,
            ciudad: tercero.ciudad || "N/A"
          },
          total_base: 0,
          total_retenido: 0,
          conceptosMap: new Map<string, DetalleCertificado>()
        });
      }

      const itemTercero = mapaTerceros.get(tercero.id)!;
      itemTercero.total_base += Number(mov.base_gravable || 0);
      itemTercero.total_retenido += Number(mov.valor_retencion || 0);

      const nombreConcepto = mov.conceptos_retencion?.concepto || mov.tipo_operacion || "Retención General";
      const tarifaMov = Number(mov.conceptos_retencion?.tarifa || 0);
      const claveConcepto = `${nombreConcepto}_${tarifaMov}`;

      if (!itemTercero.conceptosMap.has(claveConcepto)) {
        itemTercero.conceptosMap.set(claveConcepto, {
          concepto: nombreConcepto,
          tarifa: tarifaMov,
          base: 0,
          retenido: 0
        });
      }

      const itemConcepto = itemTercero.conceptosMap.get(claveConcepto)!;
      itemConcepto.base += Number(mov.base_gravable || 0);
      itemConcepto.retenido += Number(mov.valor_retencion || 0);
    });

    const certificadosFinales: CertificadoItem[] = Array.from(mapaTerceros.values()).map((cert) => ({
      tercero: cert.tercero,
      total_base: cert.total_base,
      total_retenido: cert.total_retenido,
      detalles: Array.from(cert.conceptosMap.values())
    }));

    return {
      success: true,
      empresa: empresaFinal,
      sucursal: sucursalData,
      certificados: certificadosFinales,
      diferencias: [],
      error: null
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, empresa: null, sucursal: null, certificados: [], diferencias: [], error: errorMsg };
  }
}