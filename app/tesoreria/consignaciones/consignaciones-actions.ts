"use server";

import { createClient } from "@supabase/supabase-js";

// ==========================================
// INTERFACES Y TIPOS
// ==========================================
export interface BancoGiradorInfo {
  nombre_banco: string;
}

export interface TerceroGiradorInfo {
  razon_social: string;
  numero_documento?: string;
}

export interface CuentaFinancieraData {
  id: number | string;
  nombre_cuenta?: string;
  numero_cuenta?: string;
}

export interface ConceptoAuxiliarData {
  id: number | string;
  codigo_auxiliar?: string;
  nombre?: string;
}

export interface ClaseDocumentoData {
  id: number | string;
  nombre_clase?: string;
}

export interface ChequeEnCaja {
  id: number;
  empresa_id: number;
  sucursal_id: number;
  tipo_titulo: string;
  estado: string;
  numero_titulo?: string | null;
  fecha_expedicion?: string | null;
  fecha_cobro_posfechado?: string | null;
  monto?: number | null;
  banco_girador_id?: number | null;
  tercero_girador_id?: number | null;
  banco_girador: BancoGiradorInfo;
  tercero_girador: TerceroGiradorInfo;
}

export interface DatosBaseConsignacionResultado {
  success: boolean;
  error?: string;
  cuentasBancos?: CuentaFinancieraData[];
  conceptosAuxiliares?: ConceptoAuxiliarData[];
  clasesDocumento?: ClaseDocumentoData[];
  chequesEnCaja?: ChequeEnCaja[];
}

export interface ConsignacionPayload {
  empresa_id: number;
  sucursal_id: number;
  clase_documento_id: number;
  cuenta_financiera_id: number;
  fecha_contable: string;
  tipo_consignacion: "EFECTIVO" | "CHEQUES";
  concepto_auxiliar_id?: number | null;
  valor_efectivo?: number;
  cheques_ids?: number[];
  glosa: string;
}

interface ChequeRow {
  id: number;
  empresa_id: number;
  sucursal_id: number;
  tipo_titulo: string;
  estado: string;
  numero_titulo?: string | null;
  fecha_expedicion?: string | null;
  fecha_cobro_posfechado?: string | null;
  monto?: number | null;
  banco_girador_id?: number | null;
  tercero_girador_id?: number | null;
}

interface BancoRow {
  id: number | string;
  nombre: string;
}

interface TerceroRow {
  id: number | string;
  razon_social?: string | null;
  primer_nombre?: string | null;
  primer_apellido?: string | null;
  nombre_comercial?: string | null;
  numero_identificacion?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseAdminInstance: ReturnType<typeof createClient<any>> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return supabaseAdminInstance;
}

export async function obtenerDatosBaseConsignacion(
  empresaId: number,
  sucursalId: number
): Promise<DatosBaseConsignacionResultado> {
  if (!empresaId || !sucursalId) {
    return { success: false, error: "Empresa y Sucursal son obligatorios." };
  }

  const supabase = getSupabaseAdmin();

  try {
    const [
      { data: cuentasBancos },
      { data: conceptosAuxiliares },
      { data: clasesDocumento },
      { data: chequesRaw, error: errCheques },
    ] = await Promise.all([
      supabase
        .from("cuentas_financieras")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("sucursal_id", sucursalId)
        .eq("estado", "Activa"),
      supabase
        .from("conceptos_auxiliares")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("tipo_entidad", "Cuentas_Caja"),
      supabase
        .from("clases_documento")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("estado", "Activa"),
      supabase
        .from("titulos_valores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("sucursal_id", sucursalId)
        .eq("tipo_titulo", "Cheque")
        .in("estado", ["En_Caja", "Devuelto"]),
    ]);

    if (errCheques) {
      console.error("Error al consultar titulos_valores:", errCheques);
    }

    const chequesList = (chequesRaw || []) as ChequeRow[];
    let chequesEnCaja: ChequeEnCaja[] = [];

    if (chequesList.length > 0) {
      const bancoIds = Array.from(
        new Set(
          chequesList
            .map((c) => c.banco_girador_id)
            .filter((v): v is number => v != null)
        )
      );
      const terceroIds = Array.from(
        new Set(
          chequesList
            .map((c) => c.tercero_girador_id)
            .filter((v): v is number => v != null)
        )
      );

      const [{ data: bancosData }, { data: tercerosData }] = await Promise.all([
        bancoIds.length > 0
          ? supabase
              .from("bancos_nacionales")
              .select("id, nombre")
              .in("id", bancoIds)
          : Promise.resolve({ data: [] as BancoRow[] }),
        terceroIds.length > 0
          ? supabase
              .from("terceros")
              .select(
                "id, razon_social, primer_nombre, primer_apellido, nombre_comercial, numero_identificacion"
              )
              .in("id", terceroIds)
          : Promise.resolve({ data: [] as TerceroRow[] }),
      ]);

      const bancosMap = new Map<string, BancoGiradorInfo>();
      ((bancosData || []) as BancoRow[]).forEach((b) => {
        bancosMap.set(String(b.id), { nombre_banco: b.nombre });
      });

      const tercerosMap = new Map<string, TerceroGiradorInfo>();
      ((tercerosData || []) as TerceroRow[]).forEach((t) => {
        let nombreTercero = t.razon_social || "";
        if (!nombreTercero && (t.primer_nombre || t.primer_apellido)) {
          nombreTercero = `${t.primer_nombre || ""} ${
            t.primer_apellido || ""
          }`.trim();
        }
        if (!nombreTercero) {
          nombreTercero = t.nombre_comercial || `Tercero ID: ${t.id}`;
        }

        tercerosMap.set(String(t.id), {
          razon_social: nombreTercero,
          numero_documento: t.numero_identificacion || undefined,
        });
      });

      chequesEnCaja = chequesList.map((chq) => ({
        ...chq,
        banco_girador: bancosMap.get(String(chq.banco_girador_id)) || {
          nombre_banco: "N/A",
        },
        tercero_girador: tercerosMap.get(String(chq.tercero_girador_id)) || {
          razon_social: "N/A",
        },
      }));
    }

    return {
      success: true,
      cuentasBancos: (cuentasBancos || []) as CuentaFinancieraData[],
      conceptosAuxiliares: (conceptosAuxiliares ||
        []) as ConceptoAuxiliarData[],
      clasesDocumento: (clasesDocumento || []) as ClaseDocumentoData[],
      chequesEnCaja,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error general:", error);
    return { success: false, error: message };
  }
}

export async function ejecutarConsignacionBancaria(data: ConsignacionPayload) {
  if (!data.empresa_id || !data.sucursal_id) {
    return {
      success: false,
      error: "Empresa y Sucursal son obligatorios para ejecutar la consignación.",
    };
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: res, error } = await supabase.rpc(
      "procesar_consignacion_bancaria",
      {
        p_empresa_id: data.empresa_id,
        p_sucursal_id: data.sucursal_id,
        p_clase_documento_id: data.clase_documento_id,
        p_cuenta_financiera_id: data.cuenta_financiera_id,
        p_fecha_contable: data.fecha_contable,
        p_tipo_consignacion: data.tipo_consignacion,
        p_concepto_auxiliar_id: data.concepto_auxiliar_id || null,
        p_valor_efectivo: data.valor_efectivo || 0,
        p_cheques_ids: data.cheques_ids || [],
        p_glosa: data.glosa,
      }
    );

    if (error) throw error;
    if (!res) {
      return {
        success: false,
        error: "No se recibió respuesta del proceso de consignación.",
      };
    }
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}