"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  type Empresa as EmpresaPermitida,
  type Sucursal as SucursalPermitida,
} from "@/app/actions/accionesEmpresas";

// ==========================================
// 1. TIPOS E INTERFACES EXPLICITOS Y COMPLETOS
// ==========================================

export type EmpresaAsignadaCobro = EmpresaPermitida & {
  nombre?: string;
  nombre_comercial?: string;
};

export type SucursalAsignadaCobro = SucursalPermitida & {
  nombre_sucursal?: string;
  codigo_dane?: string;
};

export interface ActionResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface PagoFacturaItem {
  facturaId?: string;
  documentoOrigen: string;
  fechaContable: string;
  valorAbono: number;
  abonoBruto?: number;
  terceroNit: string;
  retencionRenta?: number;
  retencionIva?: number;
  retencionIca?: number;
  conceptoRentaId?: number | null;
  conceptoIvaId?: number | null;
  conceptoIcaId?: number | null;
  baseRenta?: number;
  baseIva?: number;
  baseIca?: number;
  cuentaFinancieraId?: number | string | null;
  cuenta_financiera_id?: number | string | null;
  conceptoAuxiliarId?: number | string | null;
  formaPago?: string | null;
  numeroCheque?: string | null;
  bancoGiradorId?: number | null;
  fechaVencimientoCheque?: string | null;
}

export interface RegistrarCobroPayload {
  empresaId: number | string;
  sucursalId: number | string;
  codigoDaneSucursal: string;
  claseDocumentoId: number | string;
  formaPago?: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | string;
  conceptoAuxiliarId?: number | string | null;
  cuenta_financiera_id?: number | string | null;
  concepto_auxiliar_id?: number | string | null;
  cuentaFinancieraId?: number | string | null;
  conceptoRentaId?: number | string | null;
  conceptoIvaId?: number | string | null;
  conceptoIcaId?: number | string | null;
  pagos: PagoFacturaItem[];
  observaciones?: string;
}

export interface ResultadoCobro {
  success: boolean;
  registrosProcesados: number;
  numeroDocumento?: string;
}

export interface FilaCobroMasivo {
  documento_origen: string;
  fecha_contable: string;
  valor_abono: number;
  abono_bruto?: number;
  tercero_nit: string;
  retencion_renta: number;
  retencion_iva: number;
  retencion_ica: number;
  concepto_renta_id?: number | null;
  concepto_iva_id?: number | null;
  concepto_ica_id?: number | null;
  base_renta: number;
  base_iva: number;
  base_ica: number;
  cuenta_financiera_id: number | null;
  concepto_auxiliar_id?: number | null;
  forma_pago?: string | null;
  numero_cheque?: string | null;
  banco_girador_id?: number | null;
  fecha_vencimiento_cheque?: string | null;
  observaciones?: string | null;
}

export interface RegistrarCobroMasivoPayload {
  empresaId: number | string;
  sucursalId: number | string;
  codigoDaneSucursal: string;
  claseDocumentoId: number | string;
  conceptoAuxiliarId?: number | string | null;
  cuentaFinancieraId?: number | string | null;
  cuenta_financiera_id?: number | string | null;
  concepto_auxiliar_id?: number | string | null;
  conceptoRentaId?: number | string | null;
  conceptoIvaId?: number | string | null;
  conceptoIcaId?: number | string | null;
  formaPago?: string;
  filas: FilaCobroMasivo[];
  observaciones?: string;
}

export interface ResultadoCobroMasivo {
  success: boolean;
  registros_procesados: number;
  numero_documento?: string;
  transaccion_id?: number;
}

export interface ConceptoAuxiliarCobro {
  id: number | string;
  codigo_auxiliar?: string;
  nombre?: string;
  tipo_entidad?: string;
  empresa_id?: number | string;
}

export interface CuentaFinancieraCobro {
  id: number | string;
  nombre_cuenta?: string;
  numero_cuenta?: string;
  banco_id?: number | string | null;
  empresa_id?: number | string;
  sucursal_id?: number | string | null;
  concepto_auxiliar_id?: number | string | null;
}

export interface BancoNacionalCobro {
  id: number | string;
  codigo?: string;
  nombre?: string;
}
export interface RetencionesTerceroConfig {
  conceptoRentaId: string | null;
  conceptoIvaId: string | null;
  conceptoIcaId: string | null;
  tieneRentaDefinida: boolean;
  tieneIvaDefinida: boolean;
  tieneIcaDefinida: boolean;
}

export async function obtenerRetencionesTercero(
  empresaId: number | string,
  nitTercero: string
): Promise<ActionResponse<RetencionesTerceroConfig>> {
  try {
    const empId = Number(empresaId);
    const nitLimpio = String(nitTercero || "").trim();

    if (!empId || !nitLimpio) {
      return {
        success: true,
        data: {
          conceptoRentaId: null,
          conceptoIvaId: null,
          conceptoIcaId: null,
          tieneRentaDefinida: false,
          tieneIvaDefinida: false,
          tieneIcaDefinida: false,
        },
        error: null,
      };
    }

    const supabase = getSupabaseAdmin();

    const { data: tercero, error } = await supabase
      .from("terceros")
      .select("retencion_renta_id, retencion_iva_id, retencion_ica_id")
      .eq("empresa_id", empId)
      .eq("numero_identificacion", nitLimpio)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!tercero) {
      return {
        success: true,
        data: {
          conceptoRentaId: null,
          conceptoIvaId: null,
          conceptoIcaId: null,
          tieneRentaDefinida: false,
          tieneIvaDefinida: false,
          tieneIcaDefinida: false,
        },
        error: null,
      };
    }

    const rentaStr =
      tercero.retencion_renta_id !== null &&
      tercero.retencion_renta_id !== undefined &&
      String(tercero.retencion_renta_id).trim() !== ""
        ? String(tercero.retencion_renta_id).trim()
        : null;

    const ivaStr =
      tercero.retencion_iva_id !== null &&
      tercero.retencion_iva_id !== undefined &&
      String(tercero.retencion_iva_id).trim() !== ""
        ? String(tercero.retencion_iva_id).trim()
        : null;

    const icaStr =
      tercero.retencion_ica_id !== null &&
      tercero.retencion_ica_id !== undefined &&
      String(tercero.retencion_ica_id).trim() !== ""
        ? String(tercero.retencion_ica_id).trim()
        : null;

    return {
      success: true,
      data: {
        conceptoRentaId: rentaStr,
        conceptoIvaId: ivaStr,
        conceptoIcaId: icaStr,
        tieneRentaDefinida: Boolean(rentaStr),
        tieneIvaDefinida: Boolean(ivaStr),
        tieneIcaDefinida: Boolean(icaStr),
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error en obtenerRetencionesTercero:", err);
    return {
      success: false,
      data: null,
      error: message || "Error consultando retenciones del tercero.",
    };
  }
}

export interface FacturaClienteSaldo {
  id: number | string;
  numero_factura: string;
  fecha_emision: string;
  subtotal: number;
  iva: number;
  total_abonos: number;
  total_factura: number;
  saldo_pendiente: number;
  estado_factura: string;
  estado_cobro?: string | null;
  cliente_id?: number | string | null;
  cliente_nit?: string | null;
  cliente_nombre?: string | null;
  sucursal_id?: number | string | null;
  notas_asociadas: string;
}

interface NotaFacturaRow {
  id: number | string;
  factura_emitida_id: number | string;
  tipo_nota?: string | null;
  numero_nota?: string | null;
  total_nota?: number | null;
}

// ==========================================
// 2. CONEXIÓN A SUPABASE (ADMIN CLIENT)
// ==========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseAdminInstance: ReturnType<typeof createClient<any>> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return supabaseAdminInstance;
}

// ==========================================
// 3. CONSULTAS DE APOYO (READ-ONLY)
// ==========================================

export async function obtenerEmpresasAsignadasCobros(
  usuarioId?: string | null
): Promise<ActionResponse<EmpresaAsignadaCobro[]>> {
  try {
    const permitidas = await getEmpresasPermitidas(usuarioId || null);
    const lista: EmpresaAsignadaCobro[] = Array.isArray(permitidas)
      ? (permitidas as EmpresaAsignadaCobro[])
      : [];
    return { success: true, data: lista, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error en obtenerEmpresasAsignadasCobros:", err);
    return {
      success: false,
      data: [],
      error: message || "Error al consultar empresas asignadas.",
    };
  }
}

export async function obtenerSucursalesAsignadasCobros(
  empresaId: number | string,
  usuarioId?: string | null
): Promise<ActionResponse<SucursalAsignadaCobro[]>> {
  try {
    if (!empresaId) return { success: true, data: [], error: null };
    const permitidas = await getSucursalesPermitidas(
      String(empresaId),
      usuarioId || null
    );
    const lista: SucursalAsignadaCobro[] = Array.isArray(permitidas)
      ? (permitidas as SucursalAsignadaCobro[])
      : [];
    return { success: true, data: lista, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error en obtenerSucursalesAsignadasCobros:", err);
    return {
      success: false,
      data: [],
      error: message || "Error al consultar sucursales asignadas.",
    };
  }
}

export async function obtenerEmpresas(): Promise<
  ActionResponse<EmpresaAsignadaCobro[]>
> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .select("*")
      .order("razon_social", { ascending: true });

    if (error) {
      console.error("Supabase Error en obtenerEmpresas:", error.message);
      return { success: false, data: [], error: error.message };
    }
    return {
      success: true,
      data: (data || []) as EmpresaAsignadaCobro[],
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Catch Error en obtenerEmpresas:", err);
    return {
      success: false,
      data: [],
      error: message || "Error al consultar empresas.",
    };
  }
}

export async function obtenerSucursales(
  empresaId: number | string
): Promise<ActionResponse<SucursalAsignadaCobro[]>> {
  try {
    const parsedEmpresaId = Number(empresaId);
    if (!parsedEmpresaId) return { success: true, data: [], error: null };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("sucursales")
      .select("*")
      .eq("empresa_id", parsedEmpresaId)
      .order("codigo_sucursal", { ascending: true });

    if (error) {
      console.error("Supabase Error en obtenerSucursales:", error.message);
      return { success: false, data: [], error: error.message };
    }
    return {
      success: true,
      data: (data || []) as SucursalAsignadaCobro[],
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Catch Error en obtenerSucursales:", err);
    return {
      success: false,
      data: [],
      error: message || "Error al consultar sucursales.",
    };
  }
}

export async function obtenerClasesDocumento(
  empresaId: number | string
): Promise<
  ActionResponse<{ id: number | string; codigo_clase?: string; nombre_clase?: string }[]>
> {
  try {
    const empId = Number(empresaId);
    if (!empId) return { success: true, data: [], error: null };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("clases_documento")
      .select("id, codigo_clase, nombre_clase")
      .eq("empresa_id", empId)
      .eq("afecta_caja_bancos", true)
      .order("nombre_clase", { ascending: true });

    if (error) {
      console.error("Error obteniendo clases de documentos:", error.message);
      return { success: false, data: [], error: error.message };
    }

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error en obtenerClasesDocumento:", err);
    return {
      success: false,
      data: [],
      error: message || "Error al obtener clases de documento.",
    };
  }
}

export async function obtenerClientesConSaldo(
  empresaId: number | string
): Promise<ActionResponse<FacturaClienteSaldo[]>> {
  try {
    const empId = Number(empresaId);
    if (!empId) return { success: true, data: [], error: null };

    const supabase = getSupabaseAdmin();

    const { data: facturas, error } = await supabase
      .from("facturas_emitidas")
      .select(
        `
        id,
        numero_factura,
        fecha_emision,
        subtotal,
        iva,
        total_abonos,
        total_factura,
        saldo_pendiente,
        estado_factura,
        estado_cobro,
        cliente_id,
        cliente_nit,
        cliente_nombre,
        sucursal_id
      `
      )
      .eq("empresa_id", empId)
      .eq("estado_factura", "Activa")
      .gt("saldo_pendiente", 0)
      .order("fecha_emision", { ascending: true });

    if (error) throw new Error(error.message);
    if (!facturas || facturas.length === 0)
      return { success: true, data: [], error: null };

    const facturaIds = facturas.map((f) => f.id);

    const { data: notas, error: errNotas } = await supabase
      .from("notas_facturas_emitidas")
      .select("id, factura_emitida_id, tipo_nota, numero_nota, total_nota")
      .in("factura_emitida_id", facturaIds);

    if (errNotas) {
      console.error("Error consultando notas asociadas:", errNotas.message);
    }

    const listaNotas = (notas || []) as NotaFacturaRow[];

    const facturasConNotas: FacturaClienteSaldo[] = facturas.map((fac) => {
      const notasDeEstaFactura = listaNotas.filter(
        (n) => String(n.factura_emitida_id).trim() === String(fac.id).trim()
      );

      const textoNotas = notasDeEstaFactura
        .map((n) => {
          const tipo = n.tipo_nota || "Nota";
          const num = n.numero_nota || n.id;
          const valor = Number(n.total_nota || 0).toLocaleString("es-CO");
          return `${tipo} N° ${num} ($${valor})`;
        })
        .join(" | ");

      return {
        ...fac,
        notas_asociadas: textoNotas || "Sin notas registradas",
      };
    });

    return { success: true, data: facturasConNotas, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error obteniendo clientes con saldo:", err);
    return {
      success: false,
      data: [],
      error: message || "Error consultando facturas con saldo.",
    };
  }
}

export async function obtenerConceptosYBancos(
  empresaId: number | string,
  sucursalId?: number | string
): Promise<
  ActionResponse<{
    conceptos: ConceptoAuxiliarCobro[];
    cuentasFinancieras: CuentaFinancieraCobro[];
    bancosNacionales: BancoNacionalCobro[];
  }>
> {
  try {
    const empId = Number(empresaId);
    if (!empId) {
      return {
        success: true,
        data: { conceptos: [], cuentasFinancieras: [], bancosNacionales: [] },
        error: null,
      };
    }

    const supabase = getSupabaseAdmin();

    let queryCuentas = supabase
      .from("cuentas_financieras")
      .select(
        "id, nombre_cuenta, numero_cuenta, banco_id, empresa_id, sucursal_id, concepto_auxiliar_id"
      )
      .eq("empresa_id", empId);

    if (sucursalId && sucursalId !== "" && sucursalId !== "undefined") {
      queryCuentas = queryCuentas.eq("sucursal_id", Number(sucursalId));
    }

    const [
      { data: conceptos, error: errC },
      { data: cuentasFinancieras, error: errF },
      { data: bancosNacionales, error: errB },
    ] = await Promise.all([
      supabase
        .from("conceptos_auxiliares")
        .select("id, codigo_auxiliar, nombre, tipo_entidad, empresa_id")
        .eq("empresa_id", empId)
        .order("codigo_auxiliar", { ascending: true }),
      queryCuentas,
      supabase
        .from("bancos_nacionales")
        .select("id, codigo, nombre")
        .order("nombre", { ascending: true }),
    ]);

    if (errC)
      console.error("Error obteniendo conceptos auxiliares:", errC.message);
    if (errF)
      console.error("Error obteniendo cuentas financieras:", errF.message);
    if (errB) console.error("Error obteniendo bancos nacionales:", errB.message);

    return {
      success: true,
      data: {
        conceptos: (conceptos || []) as ConceptoAuxiliarCobro[],
        cuentasFinancieras: (cuentasFinancieras ||
          []) as CuentaFinancieraCobro[],
        bancosNacionales: (bancosNacionales || []) as BancoNacionalCobro[],
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error general en obtenerConceptosYBancos:", err);
    return {
      success: false,
      data: null,
      error: message || "Error al cargar catálogos financieros.",
    };
  }
}

export async function obtenerConceptosRetencion(
  empresaId: number,
  tipo: string,
  fechaContable?: string
) {
  try {
    const supabase = getSupabaseAdmin();
    const anio = fechaContable
      ? new Date(fechaContable).getFullYear()
      : new Date().getFullYear();

    const { data, error } = await supabase
      .from("conceptos_retencion")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("tipo_retencion", tipo)
      .eq("anio", anio);

    if (error) throw error;
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function crearBancoNacional(
  codigo: string,
  nombre: string
): Promise<ActionResponse<BancoNacionalCobro>> {
  try {
    if (!codigo || !nombre) {
      throw new Error("El código y el nombre del banco son obligatorios.");
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bancos_nacionales")
      .insert([{ codigo: codigo.trim(), nombre: nombre.trim() }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      success: true,
      data: data as BancoNacionalCobro,
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: null,
      error: message || "Error al crear banco nacional.",
    };
  }
}

// ==========================================
// 4. ACCIONES PRINCIPALES DE TRANSACCIÓN (WRITE)
// ==========================================

export async function registrarCobroFacturas(
  payload: RegistrarCobroPayload
): Promise<ActionResponse<ResultadoCobro>> {
  try {
    if (!payload.empresaId)
      throw new Error("Debe especificar una empresa válida.");
    if (!payload.sucursalId)
      throw new Error("Debe especificar una sucursal válida.");
    if (!payload.codigoDaneSucursal)
      throw new Error("El código DANE de la sucursal es obligatorio.");
    if (!payload.claseDocumentoId)
      throw new Error("Debe especificar una clase de documento válida.");
    if (!payload.pagos || payload.pagos.length === 0) {
      throw new Error("Debe incluir al menos un pago/factura.");
    }

    const esTransferencia =
      payload.formaPago === "Transferencia / Consignación" ||
      payload.formaPago === "TRANSFERENCIA" ||
      payload.formaPago?.toUpperCase().includes("TRANSFERENCIA");

    const cuentaFinancieraFinalId = Number(
      payload.cuentaFinancieraId || payload.cuenta_financiera_id || 0
    );

    if (esTransferencia && cuentaFinancieraFinalId <= 0) {
      throw new Error(
        "Para la opción 'Transferencia / Consignación' es obligatorio seleccionar una cuenta financiera válida."
      );
    }

    const filas: FilaCobroMasivo[] = payload.pagos.map((pago) => {
      const cuentaIdFila = Number(
        pago.cuentaFinancieraId ||
          pago.cuenta_financiera_id ||
          cuentaFinancieraFinalId ||
          0
      );

      return {
        documento_origen: pago.documentoOrigen,
        fecha_contable: pago.fechaContable,
        valor_abono: Number(pago.valorAbono || 0),
        abono_bruto: Number(pago.abonoBruto || 0),
        tercero_nit: pago.terceroNit,
        retencion_renta: Number(pago.retencionRenta || 0),
        retencion_iva: Number(pago.retencionIva || 0),
        retencion_ica: Number(pago.retencionIca || 0),
        concepto_renta_id: pago.conceptoRentaId
          ? Number(pago.conceptoRentaId)
          : null,
        concepto_iva_id: pago.conceptoIvaId
          ? Number(pago.conceptoIvaId)
          : null,
        concepto_ica_id: pago.conceptoIcaId
          ? Number(pago.conceptoIcaId)
          : null,
        base_renta: Number(pago.baseRenta || 0),
        base_iva: Number(pago.baseIva || 0),
        base_ica: Number(pago.baseIca || 0),
        cuenta_financiera_id: cuentaIdFila > 0 ? cuentaIdFila : null,
        forma_pago: payload.formaPago || pago.formaPago || null,
        numero_cheque: pago.numeroCheque || null,
        banco_girador_id: pago.bancoGiradorId
          ? Number(pago.bancoGiradorId)
          : null,
        fecha_vencimiento_cheque: pago.fechaVencimientoCheque || null,
        observaciones: payload.observaciones || null,
      };
    });

    const respuestaMasiva = await procesarCobroMasivoConRetenciones({
      empresaId: payload.empresaId,
      sucursalId: payload.sucursalId,
      codigoDaneSucursal: payload.codigoDaneSucursal,
      claseDocumentoId: payload.claseDocumentoId,
      conceptoAuxiliarId: payload.conceptoAuxiliarId,
      cuentaFinancieraId: payload.cuentaFinancieraId,
      conceptoRentaId: payload.conceptoRentaId,
      conceptoIvaId: payload.conceptoIvaId,
      conceptoIcaId: payload.conceptoIcaId,
      formaPago: payload.formaPago,
      filas,
      observaciones: payload.observaciones,
    });

    if (!respuestaMasiva.success) {
      throw new Error(respuestaMasiva.error || "Error al procesar el cobro.");
    }

    return {
      success: true,
      data: {
        success: true,
        registrosProcesados:
          respuestaMasiva.data?.registros_procesados || filas.length,
        numeroDocumento: respuestaMasiva.data?.numero_documento,
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error en registrarCobroFacturas:", err);
    return {
      success: false,
      data: null,
      error: message || "Ocurrió un error inesperado al procesar el cobro.",
    };
  }
}

export async function procesarCobroMasivoConRetenciones(
  payload: RegistrarCobroMasivoPayload
): Promise<ActionResponse<ResultadoCobroMasivo>> {
  const supabase = getSupabaseAdmin();

  try {
    if (!payload.empresaId)
      throw new Error("Debe especificar una empresa válida.");
    if (!payload.claseDocumentoId)
      throw new Error("Debe especificar una clase de documento válida.");
    if (!payload.filas || payload.filas.length === 0) {
      throw new Error(
        "Debe incluir al menos una fila para procesar el cobro."
      );
    }

    const { data: resultadoRpc, error: errRpc } = await supabase.rpc(
      "procesar_cobro_masivo_con_retenciones",
      {
        p_empresa_id: Number(payload.empresaId),
        p_sucursal_id: Number(payload.sucursalId || 0),
        p_codigo_dane_sucursal: payload.codigoDaneSucursal || "00000",
        p_clase_documento_id: Number(payload.claseDocumentoId),
        p_filas: payload.filas,
      }
    );

    if (errRpc) {
      console.error(
        "Error devuelto por la RPC procesar_cobro_masivo_con_retenciones:",
        errRpc
      );
      throw new Error(`Error en el proceso de cobro: ${errRpc.message}`);
    }

    revalidatePath("/cobros");
    revalidatePath("/facturas");

    const regProc = resultadoRpc?.registros_procesados ?? payload.filas.length;
    const docGen = resultadoRpc?.numero_documento ?? "N/A";

    return {
      success: true,
      data: {
        success: resultadoRpc?.success ?? true,
        registros_procesados: regProc,
        numero_documento: docGen,
        transaccion_id: resultadoRpc?.transaccion_id,
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error en procesarCobroMasivoConRetenciones:", err);
    return {
      success: false,
      data: null,
      error:
        message ||
        "Ocurrió un error inesperado al procesar el cobro con retenciones.",
    };
  }
}