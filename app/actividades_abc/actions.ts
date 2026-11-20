'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ==========================================
// 1. OBTENER DATOS (Equivalente al GET)
// ==========================================
export async function getActividadesAbcData(params?: {
  accion?: string
  empresaId?: string | number
}) {
  try {
    const cookieStore = await cookies()
    const empresa_id = params?.empresaId || cookieStore.get('empresa_activa')?.value

    // Listar todas las empresas para los selectores
    if (params?.accion === 'listar_empresas') {
      const { data: empresas, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social, nombre_comercial')
        .order('razon_social', { ascending: true })

      if (error) throw error
      return { exito: true, datos: empresas || [] }
    }

    // Generar siguiente código consecutivo (ABC-001, ABC-002, ...)
    if (params?.accion === 'siguiente_codigo' && empresa_id) {
      const { data, error } = await supabaseAdmin
        .from('actividades_abc')
        .select('codigo')
        .eq('empresa_id', empresa_id)

      if (error) throw error

      let maxNum = 0
      if (data && data.length > 0) {
        data.forEach((item: any) => {
          if (item.codigo) {
            const match = item.codigo.match(/\d+$/)
            if (match) {
              const num = parseInt(match[0], 10)
              if (num > maxNum) maxNum = num
            }
          }
        })
      }

      const siguienteNum = maxNum + 1
      const siguienteCodigo = `ABC-${String(siguienteNum).padStart(3, '0')}`
      return { exito: true, siguiente_codigo: siguienteCodigo }
    }

    // Listar actividades ABC de una empresa específica
    if (!empresa_id) {
      return { exito: false, mensaje: 'El parámetro empresa_id es obligatorio o no hay sesión activa.' }
    }

    const { data: actividades, error } = await supabaseAdmin
      .from('actividades_abc')
      .select('*')
      .eq('empresa_id', empresa_id)
      .order('codigo', { ascending: true })

    if (error) throw error

    return { exito: true, datos: actividades || [] }
  } catch (err: any) {
    console.error('Error en getActividadesAbcData:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}

// ==========================================
// 2. CREAR O CLONAR (Equivalente al POST)
// ==========================================
export async function crearOClonarActividadAbc(formData: any) {
  try {
    const cookieStore = await cookies()

    // CASO 1: ACCIÓN CLONAR / COPIAR A OTRAS EMPRESAS
    if (formData.accion === 'clonar_actividades') {
      const { empresa_origen_id, empresas_destino_ids } = formData

      if (!empresa_origen_id || !empresas_destino_ids || empresas_destino_ids.length === 0) {
        return { exito: false, mensaje: 'Debes especificar la empresa de origen y al menos una empresa destino.' }
      }

      // 1. Obtener actividades de origen
      const { data: origen, error: errOrigen } = await supabaseAdmin
        .from('actividades_abc')
        .select('codigo, nombre, descripcion')
        .eq('empresa_id', empresa_origen_id)

      if (errOrigen) throw errOrigen
      if (!origen || origen.length === 0) {
        return { exito: false, mensaje: 'La empresa origen no tiene actividades ABC para copiar.' }
      }

      // 2. Consultar cuáles ya existen en las empresas destino
      const { data: existentes, error: errExistentes } = await supabaseAdmin
        .from('actividades_abc')
        .select('empresa_id, codigo')
        .in('empresa_id', empresas_destino_ids)

      if (errExistentes) throw errExistentes

      const existentesSet = new Set(
        (existentes || []).map((item: any) => `${item.empresa_id}_${item.codigo}`)
      )

      // 3. Filtrar únicamente las que faltan por cada empresa
      const nuevosRegistros = []
      for (const destinoId of empresas_destino_ids) {
        for (const item of origen as any[]) {
          const clave = `${destinoId}_${item.codigo}`
          if (!existentesSet.has(clave)) {
            nuevosRegistros.push({
              empresa_id: destinoId,
              codigo: item.codigo,
              nombre: item.nombre,
              descripcion: item.descripcion || ''
            })
          }
        }
      }

      if (nuevosRegistros.length === 0) {
        return { exito: true, mensaje: 'Todas las empresas seleccionadas ya tienen las actividades creadas.' }
      }

      const { error: errInsert } = await supabaseAdmin
        .from('actividades_abc')
        .insert(nuevosRegistros)

      if (errInsert) throw errInsert

      return {
        exito: true,
        mensaje: `Se copiaron ${nuevosRegistros.length} actividades exitosamente.`
      }
    }

    // CASO 2: CREAR UNA SOLA ACTIVIDAD ABC
    const empresa_id = formData.empresa_id || cookieStore.get('empresa_activa')?.value
    const { codigo, nombre, descripcion } = formData

    if (!empresa_id || !nombre) {
      return { exito: false, mensaje: 'Campos requeridos faltantes: empresa_id (o sesión activa) y nombre son obligatorios.' }
    }

    const nuevaActividad = {
      empresa_id: Number(empresa_id),
      codigo: codigo || 'ABC-001',
      nombre,
      descripcion: descripcion || ''
    }

    const { data, error } = await supabaseAdmin
      .from('actividades_abc')
      .insert([nuevaActividad])
      .select()

    if (error) throw error

    return { exito: true, datos: data ? data[0] : null }
  } catch (err: any) {
    console.error('Error en crearOClonarActividadAbc:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}

// ==========================================
// 3. ACTUALIZAR (Equivalente al PUT)
// ==========================================
export async function actualizarActividadAbc(formData: {
  id: string | number
  nombre: string
  descripcion?: string
}) {
  try {
    const { id, nombre, descripcion } = formData

    if (!id || !nombre) {
      return { exito: false, mensaje: 'ID y Nombre son obligatorios.' }
    }

    const { data, error } = await supabaseAdmin
      .from('actividades_abc')
      .update({ nombre, descripcion })
      .eq('id', id)
      .select()

    if (error) throw error

    return { exito: true, datos: data ? data[0] : null }
  } catch (err: any) {
    console.error('Error en actualizarActividadAbc:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}

// ==========================================
// 4. ELIMINAR (Equivalente al DELETE)
// ==========================================
export async function eliminarActividadAbc(id: string | number) {
  try {
    if (!id) {
      return { exito: false, mensaje: 'El parámetro ID es obligatorio.' }
    }

    const { error } = await supabaseAdmin
      .from('actividades_abc')
      .delete()
      .eq('id', id)

    if (error) throw error

    return { exito: true, mensaje: 'Actividad eliminada correctamente.' }
  } catch (err: any) {
    console.error('Error en eliminarActividadAbc:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}