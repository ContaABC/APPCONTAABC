"use server";

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function obtenerDatosBaseConsignacion(empresaId: number, sucursalId: number) {
  if (!empresaId || !sucursalId) {
    return { success: false, error: "Empresa y Sucursal son obligatorios." };
  }

  const supabase = getSupabaseAdmin();

  try {
    // 1. Cuentas financieras
    const { data: cuentasBancos } = await supabase
      .from("cuentas_financieras")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("sucursal_id", sucursalId)
      .eq("estado", "Activa");

    // 2. Conceptos auxiliares
    const { data: conceptosAuxiliares } = await supabase
      .from("conceptos_auxiliares")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("tipo_entidad", "Cuentas_Caja");

    // 3. Clases de documento
    const { data: clasesDocumento } = await supabase
      .from("clases_documento")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activa");

    // 4. Cheques en caja (consulta limpia)
    const { data: chequesRaw, error: errCheques } = await supabase
      .from("titulos_valores")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("sucursal_id", sucursalId)
      .eq("tipo_titulo", "Cheque")
      .in("estado", ["En_Caja", "Devuelto"]);

    if (errCheques) {
      console.error("Error al consultar titulos_valores:", errCheques);
    }

    const chequesList = chequesRaw || [];
    let chequesEnCaja = [];

    // 5. Enriquecimiento seguro usando los nombres reales de las columnas de tus tablas
    if (chequesList.length > 0) {
      const bancoIds = Array.from(new Set(chequesList.map((c: any) => c.banco_girador_id).filter((v: any) => v != null)));
      const terceroIds = Array.from(new Set(chequesList.map((c: any) => c.tercero_girador_id).filter((v: any) => v != null)));

      let bancosMap = new Map();
      if (bancoIds.length > 0) {
        const { data: bancosData } = await supabase
          .from("bancos_nacionales")
          .select("id, nombre") // Columna correcta: nombre
          .in("id", bancoIds);
        
        if (bancosData) {
          bancosData.forEach((b: any) => {
            bancosMap.set(String(b.id), { nombre_banco: b.nombre });
          });
        }
      }

      let tercerosMap = new Map();
      if (terceroIds.length > 0) {
        const { data: tercerosData } = await supabase
          .from("terceros")
          .select("id, razon_social, primer_nombre, primer_apellido, nombre_comercial, numero_identificacion")
          .in("id", terceroIds);
        
        if (tercerosData) {
          tercerosData.forEach((t: any) => {
            // Resolver nombre de forma robusta según tu schema
            let nombreTercero = t.razon_social;
            if (!nombreTercero && (t.primer_nombre || t.primer_apellido)) {
              nombreTercero = `${t.primer_nombre || ""} ${t.primer_apellido || ""}`.trim();
            }
            if (!nombreTercero) {
              nombreTercero = t.nombre_comercial || `Tercero ID: ${t.id}`;
            }

            tercerosMap.set(String(t.id), { 
              razon_social: nombreTercero,
              numero_documento: t.numero_identificacion 
            });
          });
        }
      }

      chequesEnCaja = chequesList.map((chq: any) => ({
        ...chq,
        banco_girador: bancosMap.get(String(chq.banco_girador_id)) || { nombre_banco: "N/A" },
        tercero_girador: tercerosMap.get(String(chq.tercero_girador_id)) || { razon_social: "N/A" },
      }));
    }

    return {
      success: true,
      cuentasBancos: cuentasBancos || [],
      conceptosAuxiliares: conceptosAuxiliares || [],
      clasesDocumento: clasesDocumento || [],
      chequesEnCaja: chequesEnCaja,
    };
  } catch (error: any) {
    console.error("Error general:", error);
    return { success: false, error: error.message };
  }
}

export async function ejecutarConsignacionBancaria(data: {
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
}) {
  if (!data.empresa_id || !data.sucursal_id) {
    return { success: false, error: "Empresa y Sucursal son obligatorios para ejecutar la consignación." };
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: res, error } = await supabase.rpc("procesar_consignacion_bancaria", {
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
    });

    if (error) throw error;
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}