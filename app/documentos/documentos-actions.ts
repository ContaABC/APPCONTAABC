"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan variables de entorno de Supabase.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Obtener clases de documentos según tipo
export async function obtenerClasesDocumentosPorTipo(empresaId: number | string, afectaCajaBancos: boolean) {
  const supabase = getSupabaseAdmin();
  try {
    const parsedEmpresaId = Number(empresaId);
    if (!parsedEmpresaId) return { success: true, data: [] };

    const { data, error } = await supabase
      .from("clases_documento")
      .select("id, codigo_clase, nombre_clase, afecta_caja_bancos")
      .eq("empresa_id", parsedEmpresaId)
      .eq("afecta_caja_bancos", afectaCajaBancos)
      .order("codigo_clase", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

// Obtener conceptos auxiliares (Cuentas_Bancarias y Cuentas de Ingresos)
export async function obtenerAuxiliaresParaDocumentos(empresaId: number | string, soloBancarios: boolean = false) {
  const supabase = getSupabaseAdmin();
  try {
    let query = supabase
      .from("conceptos_auxiliares")
      .select("id, codigo_auxiliar, nombre, tipo_entidad")
      .eq("empresa_id", Number(empresaId));

    const { data, error } = await query.order("codigo_auxiliar", { ascending: true });

    if (error) throw error;

    let filtrados = data || [];
    if (soloBancarios) {
      filtrados = filtrados.filter((x: any) => {
        const tipo = (x.tipo_entidad || "").trim().toLowerCase();
        return tipo.includes("bancarias") || tipo.includes("ingresos") || tipo.includes("cuenta_bancaria");
      });
    }

    const mapeados = filtrados.map((x: any) => ({
      id: x.id,
      codigo: x.codigo_auxiliar,
      nombre: x.nombre,
      tipo_entidad: x.tipo_entidad
    }));

    return { success: true, data: mapeados };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

// Obtener terceros
export async function obtenerTerceros(empresaId: number | string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from("terceros")
      .select("id, razon_social, nombre_comercial, numero_identificacion")
      .eq("empresa_id", Number(empresaId))
      .order("razon_social", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

// Obtener Títulos Valores (Cheques) cruzando el auxiliar seleccionado con la cuenta financiera real
export async function obtenerTitulosValoresPorCuenta(empresaId: number | string, conceptoAuxiliarId: number | string) {
  const supabase = getSupabaseAdmin();
  try {
    const parsedEmpresaId = Number(empresaId);
    const parsedAuxId = Number(conceptoAuxiliarId);
    if (!parsedEmpresaId || !parsedAuxId) return { success: true, data: [] };

    // 1. Buscar el id de la cuenta financiera asociado a este concepto auxiliar
    const { data: cuentaFin, error: errCta } = await supabase
      .from("cuentas_financieras")
      .select("id")
      .eq("concepto_auxiliar_id", parsedAuxId)
      .maybeSingle();

    if (errCta || !cuentaFin) {
      return { success: true, data: [] };
    }

    const cuentaFinancieraIdReal = cuentaFin.id;

    // 2. Consultar los cheques en titulos_valores cruzando con la cuenta_financiera_id real
    const { data, error } = await supabase
      .from("titulos_valores")
      .select("id, numero_titulo, monto, tipo_titulo, estado, tercero_girador_id, tercero_beneficiario_id, cuenta_financiera_id")
      .eq("empresa_id", parsedEmpresaId)
      .eq("cuenta_financiera_id", cuentaFinancieraIdReal)
      .in("estado", ["Consignado", "Devuelto"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

// Guardar Documento Contable o Bancario unificado de forma 100% atómica (Rollback completo si falla algo)
export async function guardarDocumentoContable(formData: {
  empresa_id: number;
  sucursal_id: number;
  clase_documento_id: number;
  fecha_emision: string;
  fecha_contable: string;
  glosa_concepto: string;
  es_bancario: boolean;
  detalles: Array<{
    concepto_auxiliar_id: number;
    tercero_id: number | null;
    cuenta_financiera_id: number | null;
    titulo_valor_id: number | null;
    debito: number;
    credito: number;
  }>;
}) {
  const supabase = getSupabaseAdmin();
  try {
    const totalDebitos = formData.detalles.reduce((acc, d) => acc + Number(d.debito || 0), 0);
    const totalCreditos = formData.detalles.reduce((acc, d) => acc + Number(d.credito || 0), 0);

    if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
      return { success: false, error: `El comprobante no está en sumas iguales. Débitos: ${totalDebitos} vs Créditos: ${totalCreditos}` };
    }

    // Invocamos la función RPC atómica en Postgres
    const { data, error } = await supabase.rpc("guardar_documento_completo", {
      p_empresa_id: Number(formData.empresa_id),
      p_sucursal_id: Number(formData.sucursal_id),
      p_clase_documento_id: Number(formData.clase_documento_id),
      p_fecha_emision: formData.fecha_emision,
      p_fecha_contable: formData.fecha_contable,
      p_glosa_concepto: formData.glosa_concepto,
      p_es_bancario: Boolean(formData.es_bancario),
      p_detalles: formData.detalles
    });

    if (error) {
      return { success: false, error: "Error en la transacción del servidor: " + error.message };
    }

    if (!data.success) {
      return { success: false, error: data.error || "Error desconocido al procesar el documento." };
    }

    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message || "Error crítico de conexión." };
  }
}