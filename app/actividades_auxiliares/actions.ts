'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const TIPOS_ENTIDAD_VALIDOS = [
  'Auxiliar_General',
  'Actividad_ABC',
  'Centro_Costo',
  'Subcuenta_Gasto'
]

// ==========================================
// 1. OBTENER DATOS (Equivalente al GET)
// ==========================================
export async function getActividadesAuxiliaresData(params?: {
  accion?: string
  empresaId?: string | number
}) {
  try {
    const cookieStore = await cookies()
    const empresaId = params?.empresaId || cookieStore.get('empresa_activa')?.value

    // CASO: Listar Subconceptos NIIF por empresa
    if (params?.accion === 'listar_subconceptos_niif') {
      if (!empresaId) {
        return { exito: false, mensaje: 'El parámetro empresa_id es obligatorio o no hay sesión activa' }
      }

      const { data: subconceptos, error } = await supabaseAdmin
        .from('subconceptos_niif')
        .select('id, codigo, nombre, empresa_id')
        .eq('empresa_id', Number(empresaId))
        .order('codigo', { ascending: true })

      if (error) throw error
      return { exito: true, datos: subconceptos || [] }
    }

    // CASO POR DEFECTO: Listar Conceptos Auxiliares
    if (!empresaId) {
      return { exito: false, mensaje: 'El parámetro empresa_id es requerido para listar conceptos o no hay sesión activa' }
    }

    const { data: conceptos, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .select(`
        *,
        subconceptos_niif (
          codigo,
          nombre
        )
      `)
      .eq('empresa_id', Number(empresaId))
      .order('id', { ascending: false })

    if (error) throw error

    const conceptosFormateados = (conceptos || []).map((item: any) => ({
      ...item,
      codigo_niif_padre: item.subconceptos_niif?.codigo || null,
      nombre_niif_padre: item.subconceptos_niif?.nombre || null
    }))

    return { exito: true, datos: conceptosFormateados }

  } catch (error: any) {
    console.error('❌ Error en getActividadesAuxiliaresData:', error)
    return { exito: false, mensaje: 'Error interno en el servidor', error: error.message }
  }
}

// ==========================================
// 2. CREAR REGISTRO (Equivalente al POST)
// ==========================================
export async function crearActividadAuxiliar(formData: any) {
  try {
    const cookieStore = await cookies()
    const empresa_id = formData.empresa_id || formData.empresaId || cookieStore.get('empresa_activa')?.value

    const {
      subconcepto_niif_id,
      codigo_auxiliar,
      nombre,
      tipo_entidad,
      descripcion,
      nombre_inductor,
      capacidad_total_inductor,
      costo_estimado_inductor,
      estado
    } = formData

    if (!empresa_id || !codigo_auxiliar || !nombre) {
      return { exito: false, mensaje: 'Faltan campos obligatorios o no hay sesión activa (empresa_id, codigo_auxiliar, nombre)' }
    }

    const tipoEntidadSanitizado = TIPOS_ENTIDAD_VALIDOS.includes(tipo_entidad)
      ? tipo_entidad
      : 'Auxiliar_General'

    const esActividadABC = tipoEntidadSanitizado === 'Actividad_ABC'

    if (esActividadABC) {
      if (
        !nombre_inductor || !String(nombre_inductor).trim() ||
        !capacidad_total_inductor || !String(capacidad_total_inductor).trim() ||
        costo_estimado_inductor === null || costo_estimado_inductor === undefined || costo_estimado_inductor === '' || isNaN(costo_estimado_inductor)
      ) {
        return { exito: false, mensaje: 'Para la entidad Actividad ABC, los campos "Nombre del Inductor", "Capacidad Total" y "Costo Estimado" son obligatorios.' }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .insert([
        {
          empresa_id: Number(empresa_id),
          subconcepto_niif_id: subconcepto_niif_id ? Number(subconcepto_niif_id) : null,
          codigo_auxiliar,
          nombre,
          tipo_entidad: tipoEntidadSanitizado,
          descripcion: descripcion || null,
          nombre_inductor: esActividadABC ? String(nombre_inductor).trim() : null,
          capacidad_total_inductor: esActividadABC ? String(capacidad_total_inductor).trim() : null,
          costo_estimado_inductor: esActividadABC ? parseFloat(costo_estimado_inductor) : null,
          estado: estado !== undefined ? estado : 'Activo'
        }
      ])
      .select()

    if (error) {
      console.error('❌ Error al insertar concepto auxiliar:', error)
      return { exito: false, mensaje: error.message }
    }

    return {
      exito: true,
      mensaje: 'Concepto auxiliar creado correctamente',
      datos: data[0]
    }

  } catch (error: any) {
    console.error('❌ Error fatal en crearActividadAuxiliar:', error)
    return { exito: false, mensaje: 'Error interno del servidor', error: error.message }
  }
}

// ==========================================
// 3. ACTUALIZAR REGISTRO (Equivalente al PUT)
// ==========================================
export async function actualizarActividadAuxiliar(formData: any) {
  try {
    const cookieStore = await cookies()
    const empresa_id = formData.empresa_id || formData.empresaId || cookieStore.get('empresa_activa')?.value

    const {
      id,
      subconcepto_niif_id,
      codigo_auxiliar,
      nombre,
      tipo_entidad,
      descripcion,
      nombre_inductor,
      capacidad_total_inductor,
      costo_estimado_inductor,
      estado
    } = formData

    if (!id) {
      return { exito: false, mensaje: 'El id del concepto es obligatorio para actualizar' }
    }

    const tipoEntidadSanitizado = TIPOS_ENTIDAD_VALIDOS.includes(tipo_entidad)
      ? tipo_entidad
      : 'Auxiliar_General'

    const esActividadABC = tipoEntidadSanitizado === 'Actividad_ABC'

    if (esActividadABC) {
      if (
        !nombre_inductor || !String(nombre_inductor).trim() ||
        !capacidad_total_inductor || !String(capacidad_total_inductor).trim() ||
        costo_estimado_inductor === null || costo_estimado_inductor === undefined || costo_estimado_inductor === '' || isNaN(costo_estimado_inductor)
      ) {
        return { exito: false, mensaje: 'Para la entidad Actividad ABC, los campos "Nombre del Inductor", "Capacidad Total" y "Costo Estimado" son obligatorios.' }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .update({
        empresa_id: empresa_id ? Number(empresa_id) : undefined,
        subconcepto_niif_id: subconcepto_niif_id ? Number(subconcepto_niif_id) : null,
        codigo_auxiliar,
        nombre,
        tipo_entidad: tipoEntidadSanitizado,
        descripcion: descripcion || null,
        nombre_inductor: esActividadABC ? String(nombre_inductor).trim() : null,
        capacidad_total_inductor: esActividadABC ? String(capacidad_total_inductor).trim() : null,
        costo_estimado_inductor: esActividadABC ? parseFloat(costo_estimado_inductor) : null,
        estado
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('❌ Error al actualizar concepto auxiliar:', error)
      return { exito: false, mensaje: error.message }
    }

    return {
      exito: true,
      mensaje: 'Concepto auxiliar actualizado correctamente',
      datos: data[0]
    }

  } catch (error: any) {
    console.error('❌ Error fatal en actualizarActividadAuxiliar:', error)
    return { exito: false, mensaje: 'Error interno del servidor', error: error.message }
  }
}

// ==========================================
// 4. ELIMINAR REGISTRO (Equivalente al DELETE)
// ==========================================
export async function eliminarActividadAuxiliar(id: string | number) {
  try {
    if (!id) {
      return { exito: false, mensaje: 'El id es requerido para eliminar' }
    }

    const { error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ Error al eliminar actividad auxiliar:', error)
      return { exito: false, mensaje: error.message }
    }

    return {
      exito: true,
      mensaje: 'Actividad auxiliar eliminada correctamente'
    }

  } catch (error: any) {
    console.error('❌ Error fatal en eliminarActividadAuxiliar:', error)
    return { exito: false, mensaje: 'Error interno del servidor', error: error.message }
  }
}