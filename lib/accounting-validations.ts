"use server";

import { createClient } from "@supabase/supabase-js";

interface ValidacionResultado {
  valido: boolean;
  mensaje?: string;
}

interface CierrePeriodo {
  periodo_desde: string;
  periodo_hasta: string;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan las variables de entorno de Supabase (URL o Service Role Key).");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function validarPeriodoContable(
  empresaId: string | number, 
  sucursalId: string | number, 
  fechaContable: string
): Promise<ValidacionResultado> {
  try {
    if (!empresaId || !sucursalId || !fechaContable) {
      return { valido: true };
    }

    const supabase = getSupabaseAdmin();

    // 1. Verificar si la fecha cae dentro de un periodo con estado 'Cerrado'
    const { data: cierresCerrados, error: errCierre } = await supabase
      .from("cierres")
      .select("periodo_desde, periodo_hasta")
      .eq("empresa_id", Number(empresaId))
      .eq("sucursal_id", Number(sucursalId))
      .eq("estado", "Cerrado")
      .lte("periodo_desde", fechaContable)
      .gte("periodo_hasta", fechaContable);

    if (errCierre) {
      console.error("Error consultando cierres:", errCierre.message);
      return { valido: true }; // Evitamos bloquear por fallo técnico de red
    }

    const cierresCerradosTyped = cierresCerrados as CierrePeriodo[] | null;

    if (cierresCerradosTyped && cierresCerradosTyped.length > 0) {
      const c = cierresCerradosTyped[0];
      return { 
        valido: false, 
        mensaje: `⚠️ Periodo Cerrado, No se Pueden Efectuar Registros (${c.periodo_desde} al ${c.periodo_hasta}).` 
      };
    }

    // 2. Verificar si la fecha está dentro de algún periodo con estado 'Abierto'
    const { data: cierresAbiertos, error: errAbierto } = await supabase
      .from("cierres")
      .select("periodo_desde, periodo_hasta")
      .eq("empresa_id", Number(empresaId))
      .eq("sucursal_id", Number(sucursalId))
      .eq("estado", "Abierto")
      .lte("periodo_desde", fechaContable)
      .gte("periodo_hasta", fechaContable);

    if (errAbierto) {
      console.error("Error consultando periodos abiertos:", errAbierto.message);
      return { valido: true };
    }

    const cierresAbiertosTyped = cierresAbiertos as CierrePeriodo[] | null;

    // Si no se encuentra ningún registro de periodo abierto que cubra esta fecha
    if (!cierresAbiertosTyped || cierresAbiertosTyped.length === 0) {
      return { 
        valido: false, 
        mensaje: `⚠️ Periodo No Abierto para Transacciones. La fecha ${fechaContable} no cuenta con un periodo habilitado.` 
      };
    }

    // Si pasa ambas validaciones, el periodo está abierto y disponible
    return { valido: true };
  } catch (err: unknown) {
    const mensajeError = err instanceof Error ? err.message : String(err);
    return { valido: false, mensaje: `Error al validar periodo: ${mensajeError}` };
  }
}