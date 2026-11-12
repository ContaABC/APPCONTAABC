"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function resolverEmpresaId(empresaId?: number | string | null): Promise<number> {
  if (empresaId) return Number(empresaId);
  const cookieStore = await cookies();
  const idCookie = cookieStore.get("empresa_activa")?.value;
  return Number(idCookie || 0);
}

export async function obtenerEmpresasParaCierre() {
  try {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, razon_social, nombre_comercial, nit_identificacion, dv, fecha_inicio_operaciones")
      .order("razon_social", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al obtener empresas.";
    return { success: false, error: mensaje, data: [] };
  }
}

export async function obtenerSucursalesPorEmpresa(empresaId?: number | string | null) {
  try {
    const idEmpresa = await resolverEmpresaId(empresaId);
    if (!idEmpresa) return { success: true, data: [] };

    const { data, error } = await supabase
      .from("sucursales")
      .select("*")
      .eq("empresa_id", idEmpresa);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al obtener sucursales.";
    return { success: false, error: mensaje, data: [] };
  }
}

export async function obtenerClasesDocumentoEmpresa(empresaId?: number | string | null) {
  try {
    const idEmpresa = await resolverEmpresaId(empresaId);
    if (!idEmpresa) return { success: true, data: [] };

    const { data, error } = await supabase
      .from("clases_documento")
      .select("*")
      .eq("empresa_id", idEmpresa)
      .order("nombre_clase", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al obtener clases de documento.";
    return { success: false, error: mensaje, data: [] };
  }
}

export async function actualizarEstadoClaseDocumento(claseId: number, estado: string) {
  try {
    const { data, error } = await supabase
      .from("clases_documento")
      .update({ estado })
      .eq("id", claseId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al actualizar estado de clase de documento.";
    return { success: false, error: mensaje };
  }
}

export async function actualizarEstadoTodasClasesDocumento(empresaId: number, estado: string) {
  try {
    const { data, error } = await supabase
      .from("clases_documento")
      .update({ estado })
      .eq("empresa_id", empresaId)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al actualizar todas las clases de documento.";
    return { success: false, error: mensaje };
  }
}

export async function obtenerUltimoCierrePeriodo(empresaId: number, sucursalId: number, modulo: string) {
  try {
    const query = supabase
      .from("cierres")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("modulo", modulo)
      .eq("subtipo_proceso", "CIERRE_MENSUAL")
      .order("periodo_hasta", { ascending: false })
      .limit(1);

    if (sucursalId) {
      query.eq("sucursal_id", sucursalId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al obtener último cierre.";
    return { success: false, error: mensaje, data: null };
  }
}

export async function ejecutarCierreServer(payload: {
  empresaId: number;
  sucursalId: number | null | undefined;
  modulo: string;
  subtipoProceso: string;
  periodoDesde: string;
  periodoHasta: string;
  usuarioCreacion?: string;
}) {
  try {
    let sucursalIdFinal = payload.sucursalId;

    if (!sucursalIdFinal) {
      const { data: sucursalDefault, error: errSuc } = await supabase
        .from("sucursales")
        .select("id")
        .eq("empresa_id", payload.empresaId)
        .eq("codigo_sucursal", "SUC-001")
        .maybeSingle();

      if (errSuc || !sucursalDefault) {
        throw new Error("No se encontró la sucursal por defecto con código 'SUC-001' para esta empresa.");
      }
      sucursalIdFinal = sucursalDefault.id;
    }

    if (payload.modulo === "CONTABILIDAD") {
      const { data, error } = await supabase.rpc("ejecutar_cierre_contable", {
        p_empresa_id: payload.empresaId,
        p_sucursal_id: sucursalIdFinal,
        p_modulo: payload.modulo,
        p_subtipo_proceso: payload.subtipoProceso,
        p_periodo_desde: payload.periodoDesde,
        p_periodo_hasta: payload.periodoHasta,
        p_usuario_creacion: payload.usuarioCreacion || null,
      });

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from("cierres")
        .insert({
          empresa_id: payload.empresaId,
          sucursal_id: sucursalIdFinal,
          modulo: payload.modulo,
          subtipo_proceso: payload.subtipoProceso,
          periodo_desde: payload.periodoDesde,
          periodo_hasta: payload.periodoHasta,
          fecha_cierre: new Date().toISOString().split("T")[0],
          estado: "Cerrado",
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, mensaje: `Módulo ${payload.modulo} cerrado correctamente para el período.` };
    }
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al ejecutar cierre.";
    return { success: false, error: mensaje };
  }
}

export async function procesarCierreAnualServer(payload: {
  empresaId: number;
  sucursalId: number | null | undefined;
  anio: number;
  cuentaCierreId?: number;
  cuentaPatrimonioId?: number;
  claseDocumentoId?: number;
  soloSimular: boolean;
}) {
  try {
    let sucursalIdFinal = payload.sucursalId;

    if (!sucursalIdFinal || Number.isNaN(Number(sucursalIdFinal))) {
      const { data: sucursalDefault, error: errSuc } = await supabase
        .from("sucursales")
        .select("id")
        .eq("empresa_id", payload.empresaId)
        .eq("codigo_sucursal", "SUC-001")
        .maybeSingle();

      if (errSuc || !sucursalDefault) {
        throw new Error("No se encontró la sucursal por defecto 'SUC-001' para esta empresa.");
      }
      sucursalIdFinal = sucursalDefault.id;
    }

    const anioCierre = payload.anio;

    const { data: empresa, error: errEmp } = await supabase
      .from("empresas")
      .select("fecha_inicio_operaciones")
      .eq("id", payload.empresaId)
      .single();

    if (errEmp || !empresa || !empresa.fecha_inicio_operaciones) {
      throw new Error("No se encontró la fecha de inicio de operaciones de la empresa.");
    }

    const anioInicioOperaciones = Number(empresa.fecha_inicio_operaciones.substring(0, 4));
    const mesInicioOperaciones = Number(empresa.fecha_inicio_operaciones.substring(5, 7));

    if (anioCierre < anioInicioOperaciones) {
      throw new Error(`El año a cerrar (${anioCierre}) no puede ser anterior a la fecha de inicio de operaciones (${anioInicioOperaciones}).`);
    }

    let mesInicioValidacion = (anioCierre === anioInicioOperaciones) ? mesInicioOperaciones : 1;
    const periodoInicioRange = `${anioCierre}-${String(mesInicioValidacion).padStart(2, "0")}-01`;
    const periodoFinRange = `${anioCierre}-12-01`;

    const { data: cierresMensuales, error: errCierresMensuales } = await supabase
      .from("cierres")
      .select("periodo_desde, estado")
      .eq("empresa_id", payload.empresaId)
      .eq("sucursal_id", Number(sucursalIdFinal))
      .eq("modulo", "CONTABILIDAD")
      .eq("subtipo_proceso", "CIERRE_MENSUAL")
      .gte("periodo_desde", periodoInicioRange)
      .lte("periodo_desde", periodoFinRange);

    if (errCierresMensuales) throw new Error("Error al validar los cierres mensuales previos: " + errCierresMensuales.message);

    const mesesCerradosSet = new Set(
      (cierresMensuales || [])
        .filter((c: any) => c.estado === "Cerrado")
        .map((c: any) => c.periodo_desde.substring(0, 7))
    );

    const mesesFaltantes: string[] = [];
    for (let mes = mesInicioValidacion; mes <= 12; mes++) {
      const mesStr = String(mes).padStart(2, "0");
      const periodoKey = `${anioCierre}-${mesStr}`;
      if (!mesesCerradosSet.has(periodoKey)) {
        mesesFaltantes.push(periodoKey);
      }
    }

    if (mesesFaltantes.length > 0) {
      throw new Error(
        `No es posible procesar el cierre anual. Los siguientes meses del año ${anioCierre} no tienen su cierre mensual cerrado: [${mesesFaltantes.join(", ")}].`
      );
    }

    let querySaldos = supabase
      .from("saldos_acumulados_auxiliares")
      .select("*")
      .eq("empresa_id", payload.empresaId)
      .eq("sucursal_id", Number(sucursalIdFinal))
      .eq("anio", anioCierre);

    const [resConceptos, resSaldos] = await Promise.all([
      supabase.from("conceptos_auxiliares").select("*").eq("empresa_id", payload.empresaId),
      querySaldos
    ]);

    if (resSaldos.error) throw new Error("Error al consultar saldos acumulados: " + resSaldos.error.message);
    
    const conceptosMap = new Map();
    (resConceptos.data || []).forEach((c: any) => {
      conceptosMap.set(c.id, c);
    });

    const saldosPorConceptoMap = new Map();
    (resSaldos.data || []).forEach((s: any) => {
      const conceptoId = s.concepto_auxiliar_id;
      if (!saldosPorConceptoMap.has(conceptoId) || s.mes > saldosPorConceptoMap.get(conceptoId).mes) {
        saldosPorConceptoMap.set(conceptoId, s);
      }
    });

    const detallesConceptos: any[] = [];
    let sumaResultadoNeto = 0;

    saldosPorConceptoMap.forEach((s: any) => {
      const cta = conceptosMap.get(s.concepto_auxiliar_id);
      const saldo = Number(s.saldo_final || 0);
      if (!cta || saldo === 0) return;

      const elementoCta = String(cta.elemento || "").toUpperCase().trim();

      if (["INGRESOS", "INGRESO", "GASTOS", "GASTO", "COSTOS", "COSTO"].includes(elementoCta)) {
        let tipoNormalizado = "INGRESOS";
        if (elementoCta.startsWith("GASTO")) tipoNormalizado = "GASTOS";
        if (elementoCta.startsWith("COSTO")) tipoNormalizado = "COSTOS";

        sumaResultadoNeto += saldo;

        detallesConceptos.push({
          tipo: tipoNormalizado,
          cuenta: cta.codigo_auxiliar || "",
          nombre: cta.nombre || "",
          saldo: saldo,
          concepto_id: cta.id
        });
      }
    });

    detallesConceptos.sort((a, b) => a.tipo.localeCompare(b.tipo));

    if (payload.cuentaCierreId) {
      const cuentaCierreObj = conceptosMap.get(Number(payload.cuentaCierreId));
      if (cuentaCierreObj) {
        detallesConceptos.push({
          tipo: "CIERRE DE RESULTADOS",
          cuenta: cuentaCierreObj.codigo_auxiliar || "",
          nombre: cuentaCierreObj.nombre || "Cuenta de Cierre (PyG)",
          saldo: sumaResultadoNeto,
          concepto_id: cuentaCierreObj.id
        });
      }
    }

    if (payload.cuentaPatrimonioId) {
      const cuentaPatrimonioObj = conceptosMap.get(Number(payload.cuentaPatrimonioId));
      if (cuentaPatrimonioObj) {
        detallesConceptos.push({
          tipo: "PATRIMONIO (DESTINO)",
          cuenta: cuentaPatrimonioObj.codigo_auxiliar || "",
          nombre: cuentaPatrimonioObj.nombre || "Resultado del Ejercicio (Patrimonio)",
          saldo: -sumaResultadoNeto,
          concepto_id: cuentaPatrimonioObj.id
        });
      }
    }

    if (payload.soloSimular) {
      return {
        success: true,
        simulacion: true,
        detalles: detallesConceptos,
        mensaje: "¡Previsualización de doble fase (Cierre de Resultados y Traslado a Patrimonio) generada con éxito!"
      };
    }

    if (!payload.cuentaCierreId) {
      throw new Error("Debe seleccionar la cuenta auxiliar de cierre de resultados.");
    }
    if (!payload.cuentaPatrimonioId) {
      throw new Error("Debe seleccionar la cuenta auxiliar de Patrimonio para el traslado final.");
    }
    if (!payload.claseDocumentoId) {
      throw new Error("Debe seleccionar la clase de documento para el comprobante de cierre anual.");
    }

    const periodoDesde = `${anioCierre}-12-01`;
    const periodoHasta = `${anioCierre}-12-31`;

    const datosCierre = {
      empresa_id: payload.empresaId,
      sucursal_id: Number(sucursalIdFinal),
      modulo: "CONTABILIDAD",
      subtipo_proceso: "CIERRE_ANUAL",
      periodo_desde: periodoDesde,
      periodo_hasta: periodoHasta,
      fecha_cierre: new Date().toISOString().split("T")[0],
      estado: "Cerrado",
    };

    const { data: cierreExistente } = await supabase
      .from("cierres")
      .select("id")
      .eq("empresa_id", payload.empresaId)
      .eq("sucursal_id", Number(sucursalIdFinal))
      .eq("modulo", "CONTABILIDAD")
      .eq("subtipo_proceso", "CIERRE_ANUAL")
      .eq("periodo_desde", periodoDesde)
      .maybeSingle();

    if (cierreExistente) {
      const { error: errUpd } = await supabase
        .from("cierres")
        .update(datosCierre)
        .eq("id", cierreExistente.id);
      if (errUpd) throw errUpd;
    } else {
      const { error: errIns } = await supabase
        .from("cierres")
        .insert(datosCierre);
      if (errIns) throw errIns;
    }

    return { 
      success: true, 
      simulacion: false,
      mensaje: `¡Comprobante de Cierre Anual en doble fase (Mes 13) del año ${anioCierre} grabado con éxito!` 
    };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al procesar cierre anual.";
    return { success: false, error: mensaje };
  }
}

export async function obtenerPeriodosAperturas(empresaId: number, sucursalId: number) {
  try {
    const { data: empresa, error: errEmp } = await supabase
      .from("empresas")
      .select("fecha_inicio_operaciones")
      .eq("id", empresaId)
      .single();

    if (errEmp || !empresa || !empresa.fecha_inicio_operaciones) {
      return { success: true, data: [] };
    }

    let queryCierres = supabase
      .from("cierres")
      .select("periodo_desde, periodo_hasta, estado, modulo, subtipo_proceso")
      .eq("empresa_id", empresaId);

    if (sucursalId) {
      queryCierres.eq("sucursal_id", sucursalId);
    }

    const { data: cierresData } = await queryCierres;
    
    const estadosMap = new Map<string, string>();
    const cierresContablesMap = new Set<string>();

    (cierresData || []).forEach((c: any) => {
      const key = c.periodo_desde.substring(0, 7);
      if (c.modulo === "CONTABILIDAD" && (c.subtipo_proceso === "CIERRE_MENSUAL" || c.subtipo_proceso === "CIERRE_ANULAR" || c.subtipo_proceso === "CIERRE_ANUAL")) {
        cierresContablesMap.add(key);
      }
      if (c.modulo === "CONTABILIDAD" && c.subtipo_proceso === "APERTURA_PERIODO") {
        estadosMap.set(key, c.estado || "Abierto");
      }
    });

    const [anioInicio, mesInicio] = empresa.fecha_inicio_operaciones.split("-").map(Number);
    const fechaActual = new Date();
    let maxAnio = fechaActual.getFullYear();
    let maxMes = fechaActual.getMonth() + 1;

    (cierresData || []).forEach((c: any) => {
      const [y, m] = c.periodo_desde.split("-").map(Number);
      if (y > maxAnio || (y === maxAnio && m > maxMes)) {
        maxAnio = y;
        maxMes = m;
      }
    });

    let periodos = [];
    let curAnio = anioInicio;
    let curMes = mesInicio;

    while (curAnio < maxAnio || (curAnio === maxAnio && curMes <= maxMes)) {
      const mesStr = String(curMes).padStart(2, "0");
      const periodoKey = `${curAnio}-${mesStr}`;
      
      const esContable = cierresContablesMap.has(periodoKey);
      let estadoFinal = esContable ? "Cerrado" : (estadosMap.get(periodoKey) || "Abierto");

      periodos.push({
        anio: curAnio,
        mes: curMes,
        periodo: periodoKey,
        estado: estadoFinal,
        esCierreContable: esContable,
      });

      curMes += 1;
      if (curMes > 12) {
        curMes = 1;
        curAnio += 1;
      }
    }

    return { success: true, data: periodos.reverse() };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al obtener periodos y aperturas.";
    return { success: false, error: mensaje, data: [] };
  }
}

export async function habilitarPeriodoAperturaServer(payload: {
  empresaId: number;
  sucursalId: number | null | undefined;
  anio: number;
  mes: number;
}) {
  try {
    let sucursalIdFinal = payload.sucursalId;

    if (!sucursalIdFinal) {
      const { data: sucursalDefault, error: errSuc } = await supabase
        .from("sucursales")
        .select("id")
        .eq("empresa_id", payload.empresaId)
        .eq("codigo_sucursal", "SUC-001")
        .maybeSingle();

      if (errSuc || !sucursalDefault) {
        throw new Error("No se encontró la sucursal por defecto con código '001' para esta empresa.");
      }
      sucursalIdFinal = sucursalDefault.id;
    }

    const periodoDesde = `${payload.anio}-${String(payload.mes).padStart(2, "0")}-01`;
    const ultimoDia = new Date(payload.anio, payload.mes, 0).getDate();
    const periodoHasta = `${payload.anio}-${String(payload.mes).padStart(2, "0")}-${ultimoDia}`;

    const { data: existente } = await supabase
      .from("cierres")
      .select("id, estado")
      .eq("empresa_id", payload.empresaId)
      .eq("sucursal_id", sucursalIdFinal)
      .eq("modulo", "CONTABILIDAD")
      .eq("periodo_desde", periodoDesde)
      .maybeSingle();

    if (existente) {
      if (existente.estado === "Abierto") {
        throw new Error(`El período ${payload.anio}-${String(payload.mes).padStart(2, "0")} ya se encuentra abierto.`);
      } else {
        const { error: errUpdate } = await supabase
          .from("cierres")
          .update({ estado: "Abierto" })
          .eq("id", existente.id);

        if (errUpdate) throw errUpdate;
        return { success: true, mensaje: `¡Período ${payload.anio}-${String(payload.mes).padStart(2, "0")} reabierto con éxito!` };
      }
    }

    const { error: errInsert } = await supabase
      .from("cierres")
      .insert({
        empresa_id: payload.empresaId,
        sucursal_id: sucursalIdFinal,
        modulo: "CONTABILIDAD",
        subtipo_proceso: "APERTURA_PERIODO",
        periodo_desde: periodoDesde,
        periodo_hasta: periodoHasta,
        fecha_cierre: new Date().toISOString().split("T")[0],
        estado: "Abierto",
      });

    if (errInsert) throw errInsert;
    return { success: true, mensaje: `¡Período ${payload.anio}-${String(payload.mes).padStart(2, "0")} habilitado con éxito!` };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al habilitar periodo de apertura.";
    return { success: false, error: mensaje };
  }
}

export async function bloquearPeriodoAperturaServer(payload: {
  empresaId: number;
  sucursalId: number | null | undefined;
  periodoDesde: string;
}) {
  try {
    let sucursalIdFinal = payload.sucursalId;

    if (!sucursalIdFinal || Number.isNaN(Number(sucursalIdFinal))) {
      const { data: sucursalDefault, error: errSuc } = await supabase
        .from("sucursales")
        .select("id")
        .eq("empresa_id", payload.empresaId)
        .eq("codigo_sucursal", "SUC-001")
        .maybeSingle();

      if (errSuc) throw new Error("Error al buscar la sucursal SUC-001: " + errSuc.message);
      if (!sucursalDefault) throw new Error("No se encontró la sucursal con código 'SUC-001' para esta empresa.");
      
      sucursalIdFinal = sucursalDefault.id;
    }

    const anio = payload.periodoDesde.substring(0, 4);
    const mes = payload.periodoDesde.substring(5, 7);
    const periodoInicio = `${anio}-${mes}-01`;
    const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate();
    const periodoFin = `${anio}-${mes}-${ultimoDia}`;

    const { data: existente, error: errBusqueda } = await supabase
      .from("cierres")
      .select("id")
      .eq("empresa_id", payload.empresaId)
      .eq("sucursal_id", Number(sucursalIdFinal))
      .eq("periodo_desde", periodoInicio)
      .eq("modulo", "CONTABILIDAD")
      .maybeSingle();

    if (errBusqueda) throw new Error("Error buscando registro existente: " + errBusqueda.message);

    if (existente) {
      const { error: errUpdate } = await supabase
        .from("cierres")
        .update({ 
          estado: "Cerrado",
          subtipo_proceso: "APERTURA_PERIODO" 
        })
        .eq("id", existente.id);

      if (errUpdate) throw new Error("Error al actualizar el cierre: " + errUpdate.message);
    } else {
      const { error: errInsert } = await supabase
        .from("cierres")
        .insert({
          empresa_id: payload.empresaId,
          sucursal_id: Number(sucursalIdFinal),
          modulo: "CONTABILIDAD",
          subtipo_proceso: "APERTURA_PERIODO",
          periodo_desde: periodoInicio,
          periodo_hasta: periodoFin,
          fecha_cierre: new Date().toISOString().split("T")[0],
          estado: "Cerrado",
        });

      if (errInsert) throw new Error("Error al insertar el cierre: " + errInsert.message);
    }

    return { success: true, mensaje: `¡Período bloqueado/cerrado con éxito!` };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al bloquear periodo.";
    return { success: false, error: mensaje };
  }
}

export async function desbloquearPeriodoAperturaServer(payload: {
  empresaId: number;
  sucursalId: number | null | undefined;
  periodoDesde: string;
}) {
  try {
    let sucursalIdFinal = payload.sucursalId;

    if (!sucursalIdFinal || Number.isNaN(Number(sucursalIdFinal))) {
      const { data: sucursalDefault, error: errSuc } = await supabase
        .from("sucursales")
        .select("id")
        .eq("empresa_id", payload.empresaId)
        .eq("codigo_sucursal", "SUC-001")
        .maybeSingle();

      if (errSuc) throw new Error("Error al buscar la sucursal SUC-001: " + errSuc.message);
      if (!sucursalDefault) throw new Error("No se encontró la sucursal con código 'SUC-001' para esta empresa.");
      
      sucursalIdFinal = sucursalDefault.id;
    }

    const anio = payload.periodoDesde.substring(0, 4);
    const mes = payload.periodoDesde.substring(5, 7);
    const periodoInicio = `${anio}-${mes}-01`;
    const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate();
    const periodoFin = `${anio}-${mes}-${ultimoDia}`;

    const { data: existente, error: errBusqueda } = await supabase
      .from("cierres")
      .select("id, subtipo_proceso")
      .eq("empresa_id", payload.empresaId)
      .eq("sucursal_id", Number(sucursalIdFinal))
      .eq("periodo_desde", periodoInicio)
      .eq("modulo", "CONTABILIDAD")
      .maybeSingle();

    if (errBusqueda) throw new Error("Error buscando registro existente: " + errBusqueda.message);

    if (existente) {
      const { error: errUpdate } = await supabase
        .from("cierres")
        .update({ 
          estado: "Abierto",
          subtipo_proceso: "APERTURA_PERIODO" 
        })
        .eq("id", existente.id);

      if (errUpdate) throw new Error("Error al desbloquear el cierre: " + errUpdate.message);
    } else {
      const { error: errInsert } = await supabase
        .from("cierres")
        .insert({
          empresa_id: payload.empresaId,
          sucursal_id: Number(sucursalIdFinal),
          modulo: "CONTABILIDAD",
          subtipo_proceso: "APERTURA_PERIODO",
          periodo_desde: periodoInicio,
          periodo_hasta: periodoFin,
          fecha_cierre: new Date().toISOString().split("T")[0],
          estado: "Abierto",
        });

      if (errInsert) throw new Error("Error al insertar el desbloqueo: " + errInsert.message);
    }

    return { success: true, mensaje: `¡Período desbloqueado con éxito!` };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al desbloquear periodo.";
    return { success: false, error: mensaje };
  }
}

export async function obtenerCuentasAuxiliaresPorElemento(empresaId?: number | string | null, elemento?: string) {
  try {
    const idEmpresa = await resolverEmpresaId(empresaId);
    if (!idEmpresa || !elemento) return { success: true, data: [] };

    const { data, error } = await supabase
      .from("conceptos_auxiliares")
      .select("id, codigo_auxiliar, nombre, elemento")
      .eq("empresa_id", idEmpresa)
      .eq("elemento", elemento)
      .order("codigo_auxiliar", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : "Error al obtener cuentas auxiliares.";
    return { success: false, error: mensaje, data: [] };
  }
}