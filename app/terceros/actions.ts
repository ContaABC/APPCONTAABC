"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function obtenerEmpresaIdActiva(empresaIdParam?: string | null): Promise<string | null> {
  if (empresaIdParam) return empresaIdParam;
  const cookieStore = await cookies();
  return cookieStore.get("empresa_activa")?.value || null;
}

/**
 * Obtener terceros o buscar uno específico por ID o número de identificación.
 */
export async function obtenerTercerosAction({ empresaId, id, numeroIdentificacion }: { empresaId?: string; id?: string | number; numeroIdentificacion?: string } = {}) {
  try {
    const activeEmpresaId = await obtenerEmpresaIdActiva(empresaId);

    if (!activeEmpresaId) {
      return { exito: false, mensaje: "El parámetro empresa_id es requerido o no hay sesión activa." };
    }

    if (id) {
      const { data, error } = await supabase
        .from("terceros")
        .select("*")
        .eq("id", id)
        .eq("empresa_id", activeEmpresaId)
        .single();

      if (error || !data) {
        return { existe: false, tercero: null };
      }
      return { existe: true, tercero: data };
    }

    if (numeroIdentificacion) {
      const { data, error } = await supabase
        .from("terceros")
        .select("*")
        .eq("empresa_id", activeEmpresaId)
        .eq("numero_identificacion", numeroIdentificacion)
        .maybeSingle();

      if (error) {
        return { exito: false, mensaje: "Error al consultar la base de datos.", error: error.message };
      }

      if (data) {
        return { existe: true, tercero: data, data };
      } else {
        return { existe: false, tercero: null };
      }
    }

    const { data, error } = await supabase
      .from("terceros")
      .select("*")
      .eq("empresa_id", activeEmpresaId)
      .order("razon_social", { ascending: true });

    if (error) {
      return { exito: false, mensaje: "Error al obtener terceros.", error: error.message };
    }

    return { exito: true, terceros: data };
  } catch (error: any) {
    return { exito: false, mensaje: "Error interno del servidor.", error: error.message };
  }
}

/**
 * Crear un nuevo tercero (Individual o Carga Masiva)
 */
export async function crearTerceroAction(formDataOLista: any) {
  try {
    const cookieStore = await cookies();
    const cookieEmpresaActiva = cookieStore.get("empresa_activa")?.value;

    // Carga Masiva (Array)
    if (Array.isArray(formDataOLista)) {
      if (formDataOLista.length === 0) {
        return { exito: false, mensaje: "El listado masivo no contiene registros válidos." };
      }

      const payloadMasivo = formDataOLista.map((item) => {
        const { es_contratista, ...resto } = item;
        return {
          ...resto,
          empresa_id: resto.empresa_id || cookieEmpresaActiva,
          es_arrendador: item.es_arrendador !== undefined ? !!item.es_arrendador : !!es_contratista,
        };
      });

      const { data, error } = await supabase
        .from("terceros")
        .upsert(payloadMasivo, { onConflict: "empresa_id, numero_identificacion" })
        .select();

      if (error) {
        console.error("Error Supabase POST Masivo:", error);
        return { exito: false, mensaje: "Error al procesar la carga masiva.", error: error.message };
      }

      return {
        exito: true,
        mensaje: `Se procesaron correctamente ${data ? data.length : formDataOLista.length} registros.`,
        creados: data ? data.length : formDataOLista.length,
        terceros: data,
      };
    }

    // Registro Individual
    let {
      empresa_id,
      tipo_documento,
      numero_identificacion,
      dv,
      razon_social,
      nombre_comercial,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      email,
      telefono,
      direccion,
      codigo_dane,
      ciudad,
      departamento_estado,
      regimen_fiscal,
      responsabilidad_tributaria,
      codigo_ciiu,
      codigo_ciiu_2,
      codigo_ciiu_3,
      codigo_ciiu_4,
      retencion_renta_id,
      retencion_iva_id,
      retencion_ica_id,
      es_cliente,
      es_proveedor,
      es_empleado,
      es_contratista,
      es_arrendador,
      estado,
    } = formDataOLista;

    empresa_id = empresa_id || cookieEmpresaActiva;

    if (!empresa_id || !numero_identificacion || !razon_social) {
      return {
        exito: false,
        mensaje: "Empresa (o sesión activa), número de identificación y razón social son obligatorios.",
      };
    }

    const { data: existente } = await supabase
      .from("terceros")
      .select("id")
      .eq("empresa_id", empresa_id)
      .eq("numero_identificacion", numero_identificacion)
      .maybeSingle();

    if (existente) {
      return { exito: false, mensaje: "Ya existe un tercero registrado con esta identificación en la empresa." };
    }

    const payloadInsercion = {
      empresa_id,
      tipo_documento,
      numero_identificacion,
      dv: dv || null,
      razon_social,
      nombre_comercial: nombre_comercial || null,
      primer_nombre: primer_nombre || null,
      segundo_nombre: segundo_nombre || null,
      primer_apellido: primer_apellido || null,
      segundo_apellido: segundo_apellido || null,
      email: email || null,
      telefono: telefono || null,
      direccion: direccion || null,
      codigo_dane: codigo_dane || "68001",
      ciudad: ciudad || "Bucaramanga",
      departamento_estado: departamento_estado || "Santander",
      regimen_fiscal: regimen_fiscal || "48",
      responsabilidad_tributaria: responsabilidad_tributaria || "R-99-PN",
      codigo_ciiu: codigo_ciiu || null,
      codigo_ciiu_2: codigo_ciiu_2 || null,
      codigo_ciiu_3: codigo_ciiu_3 || null,
      codigo_ciiu_4: codigo_ciiu_4 || null,
      retencion_renta_id: retencion_renta_id ? Number(retencion_renta_id) : null,
      retencion_iva_id: retencion_iva_id ? Number(retencion_iva_id) : null,
      retencion_ica_id: retencion_ica_id ? Number(retencion_ica_id) : null,
      es_cliente: !!es_cliente,
      es_proveedor: !!es_proveedor,
      es_empleado: !!es_empleado,
      es_arrendador: es_arrendador !== undefined ? !!es_arrendador : !!es_contratista,
      estado: estado || "ACTIVO",
    };

    const { data, error } = await supabase
      .from("terceros")
      .insert([payloadInsercion])
      .select()
      .single();

    if (error) {
      console.error("Error Supabase POST Terceros:", error);
      return { exito: false, mensaje: "Error al insertar el tercero.", error: error.message };
    }

    return { exito: true, mensaje: "Tercero creado exitosamente.", tercero: data };
  } catch (error: any) {
    console.error("Error Servidor POST Terceros:", error);
    return { exito: false, mensaje: "Error interno del servidor al crear.", error: error.message };
  }
}

/**
 * Modificar tercero existente o cambiar estado (Activo/Inactivo)
 */
export async function actualizarTerceroAction(formData: any) {
  try {
    const cookieStore = await cookies();
    const cookieEmpresaActiva = cookieStore.get("empresa_activa")?.value;
    const { id, created_at, updated_at, es_contratista, ...datosRecibidos } = formData;

    if (!id) {
      return { exito: false, mensaje: "El ID del tercero es obligatorio para actualizar." };
    }

    const payloadActualizacion: Record<string, any> = {};

    const camposPermitidos = [
      "empresa_id", "tipo_documento", "numero_identificacion", "dv",
      "razon_social", "nombre_comercial", "primer_nombre", "segundo_nombre",
      "primer_apellido", "segundo_apellido", "email", "telefono", "direccion",
      "codigo_dane", "ciudad", "departamento_estado", "regimen_fiscal",
      "responsabilidad_tributaria", "codigo_ciiu", "codigo_ciiu_2", "codigo_ciiu_3", "codigo_ciiu_4",
      "retencion_renta_id", "retencion_iva_id", "retencion_ica_id", "es_cliente", "es_proveedor",
      "es_empleado", "es_arrendador", "estado"
    ];

    camposPermitidos.forEach((campo) => {
      if (datosRecibidos[campo] !== undefined) {
        if (["retencion_renta_id", "retencion_iva_id", "retencion_ica_id"].includes(campo)) {
          payloadActualizacion[campo] = datosRecibidos[campo] ? Number(datosRecibidos[campo]) : null;
        } else {
          payloadActualizacion[campo] = datosRecibidos[campo];
        }
      }
    });

    if (!payloadActualizacion.empresa_id && cookieEmpresaActiva) {
      payloadActualizacion.empresa_id = cookieEmpresaActiva;
    }

    if (es_contratista !== undefined && payloadActualizacion.es_arrendador === undefined) {
      payloadActualizacion.es_arrendador = !!es_contratista;
    }

    const { data, error } = await supabase
      .from("terceros")
      .update(payloadActualizacion)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error Supabase PUT Terceros:", error);
      return { exito: false, mensaje: `Error al actualizar el tercero: ${error.message}`, error: error.message };
    }

    return {
      exito: true,
      mensaje: "Tercero actualizado correctamente.",
      data,
      tercero: data,
    };
  } catch (error: any) {
    console.error("Error Servidor PUT Terceros:", error);
    return { exito: false, mensaje: "Error interno del servidor al actualizar.", error: error.message };
  }
}

/**
 * Eliminar tercero o inactivarlo si tiene movimientos asociados.
 */
export async function eliminarTerceroAction(id: string | number) {
  try {
    if (!id) {
      return { exito: false, mensaje: "El ID del tercero es requerido para la eliminación." };
    }

    const { count: movimientosCount, error: errorMovs } = await supabase
      .from("movimientos_contables")
      .select("id", { count: "exact", head: true })
      .eq("tercero_id", id);

    if (!errorMovs && movimientosCount && movimientosCount > 0) {
      const { data: terceroInactivado, error: errorInactivar } = await supabase
        .from("terceros")
        .update({ estado: "INACTIVO" })
        .eq("id", id)
        .select()
        .single();

      if (errorInactivar) {
        console.error("Error al inactivar tercero:", errorInactivar);
      }

      return {
        exito: false,
        tieneMovimientos: true,
        mensaje: "No se puede eliminar el tercero porque posee registros o movimientos asociados. Su estado ha sido cambiado automáticamente a INACTIVO.",
        terceroActualizado: terceroInactivado,
      };
    }

    const { error: errorDelete } = await supabase
      .from("terceros")
      .delete()
      .eq("id", id);

    if (errorDelete) {
      console.error("Error Supabase DELETE Terceros:", errorDelete);
      return { exito: false, mensaje: "Error al eliminar el tercero de la base de datos.", error: errorDelete.message };
    }

    return {
      exito: true,
      tieneMovimientos: false,
      mensaje: "Tercero eliminado correctamente.",
    };
  } catch (error: any) {
    console.error("Error Servidor DELETE Terceros:", error);
    return { exito: false, mensaje: "Error interno del servidor al eliminar.", error: error.message };
  }
}