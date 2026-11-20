'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ==========================================
// 1. LISTAR EMPRESAS
// ==========================================
export async function listarConceptosNiifEmpresas() {
  try {
    const { data: empresas, error } = await supabaseAdmin
      .from('empresas')
      .select('id, razon_social, nombre_comercial')
      .order('razon_social', { ascending: true })

    if (error) {
      return { exito: false, mensaje: `Error al cargar empresas: ${error.message}`, datos: [] }
    }

    return { exito: true, datos: empresas || [] }
  } catch (err) {
    console.error('Error inesperado en listarConceptosNiifEmpresas:', err)
    return {
      exito: false,
      mensaje: err instanceof Error ? err.message : 'Error interno del servidor.',
      datos: []
    }
  }
}

// ==========================================
// 2. OBTENER SIGUIENTE CÓDIGO CONSECUTIVO (ej: NIIF-001)
// ==========================================
export async function obtenerSiguienteCodigoNiif(empresaIdParam?: string | number | null) {
  try {
    const cookieStore = await cookies()
    const empresaId = empresaIdParam || cookieStore.get('empresa_activa')?.value

    if (!empresaId) {
      return {
        exito: false,
        mensaje: 'empresa_id es requerido o no hay sesión activa para generar el consecutivo.'
      }
    }

    const { data: conceptos, error } = await supabaseAdmin
      .from('conceptos_niif')
      .select('codigo_concepto')
      .eq('empresa_id', empresaId)

    if (error) {
      return { exito: false, mensaje: `Error al obtener consecutivo: ${error.message}` }
    }

    let maxNum = 0
    if (conceptos && conceptos.length > 0) {
      conceptos.forEach((c) => {
        if (c.codigo_concepto && c.codigo_concepto.startsWith('NIIF-')) {
          const num = parseInt(c.codigo_concepto.replace('NIIF-', ''), 10)
          if (!isNaN(num) && num > maxNum) {
            maxNum = num
          }
        }
      })
    }

    const siguienteCodigo = `NIIF-${String(maxNum + 1).padStart(3, '0')}`
    return { exito: true, siguiente_codigo: siguienteCodigo }
  } catch (err) {
    console.error('Error inesperado en obtenerSiguienteCodigoNiif:', err)
    return {
      exito: false,
      mensaje: err instanceof Error ? err.message : 'Error interno del servidor.'
    }
  }
}

// ==========================================
// 3. LISTAR CONCEPTOS NIIF POR EMPRESA
// ==========================================
export async function obtenerConceptosNiif(empresaIdParam?: string | number | null) {
  try {
    const cookieStore = await cookies()
    const empresaId = empresaIdParam || cookieStore.get('empresa_activa')?.value

    if (!empresaId) {
      return {
        exito: false,
        mensaje: 'El parámetro empresa_id es requerido o no hay sesión activa.',
        datos: []
      }
    }

    const { data: conceptos, error } = await supabaseAdmin
      .from('conceptos_niif')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('codigo_concepto', { ascending: true })

    if (error) {
      return { exito: false, mensaje: `Error al consultar conceptos NIIF: ${error.message}`, datos: [] }
    }

    return { exito: true, datos: conceptos || [] }
  } catch (err) {
    console.error('Error inesperado en obtenerConceptosNiif:', err)
    return {
      exito: false,
      mensaje: err instanceof Error ? err.message : 'Error interno del servidor.',
      datos: []
    }
  }
}

// ==========================================
// 4. CLONAR CONCEPTOS NIIF MASIVAMENTE
// ==========================================
export async function clonarConceptosNiifMasivo(params: {
  empresa_origen_id: string | number
  empresas_destino_ids: Array<string | number>
}) {
  try {
    const { empresa_origen_id, empresas_destino_ids } = params

    if (!empresa_origen_id || !empresas_destino_ids || empresas_destino_ids.length === 0) {
      return {
        exito: false,
        mensaje: 'Debes especificar la empresa de origen y al menos una empresa de destino.'
      }
    }

    const { data: conceptosOrigen, error: errorOrigen } = await supabaseAdmin
      .from('conceptos_niif')
      .select('codigo_concepto, nombre, elemento, clasificacion_balance')
      .eq('empresa_id', empresa_origen_id)

    if (errorOrigen) {
      console.error('Error al obtener conceptos origen:', errorOrigen)
      return { exito: false, mensaje: `Error al consultar empresa origen: ${errorOrigen.message}` }
    }

    if (!conceptosOrigen || conceptosOrigen.length === 0) {
      return {
        exito: false,
        mensaje: 'La empresa de origen no tiene conceptos NIIF registrados para copiar.'
      }
    }

    const { data: conceptosExistentes, error: errorExistentes } = await supabaseAdmin
      .from('conceptos_niif')
      .select('empresa_id, codigo_concepto')
      .in('empresa_id', empresas_destino_ids)

    if (errorExistentes) {
      console.error('Error al consultar conceptos existentes:', errorExistentes)
      return { exito: false, mensaje: `Error al verificar conceptos existentes: ${errorExistentes.message}` }
    }

    const codigosExistentesSet = new Set(
      (conceptosExistentes || []).map((item) => `${item.empresa_id}_${item.codigo_concepto}`)
    )

    const nuevosConceptosMasivos: Array<{
      empresa_id: string | number
      codigo_concepto: string | null
      nombre: string | null
      elemento: string
      clasificacion_balance: string
    }> = []

    for (const destinoId of empresas_destino_ids) {
      for (const concepto of conceptosOrigen) {
        const claveUnica = `${destinoId}_${concepto.codigo_concepto}`
        if (!codigosExistentesSet.has(claveUnica)) {
          nuevosConceptosMasivos.push({
            empresa_id: destinoId,
            codigo_concepto: concepto.codigo_concepto,
            nombre: concepto.nombre,
            elemento: concepto.elemento || '',
            clasificacion_balance: concepto.clasificacion_balance || ''
          })
        }
      }
    }

    if (nuevosConceptosMasivos.length === 0) {
      return {
        exito: true,
        mensaje: 'Todas las empresas seleccionadas ya cuentan con el catálogo completo de estos conceptos.'
      }
    }

    const { error: errorInsert } = await supabaseAdmin
      .from('conceptos_niif')
      .insert(nuevosConceptosMasivos)

    if (errorInsert) {
      console.error('Error al copiar conceptos masivamente:', errorInsert)
      return { exito: false, mensaje: `Error al guardar en base de datos: ${errorInsert.message}` }
    }

    return {
      exito: true,
      mensaje: `¡Se agregaron ${nuevosConceptosMasivos.length} nuevos conceptos faltantes a las empresas de destino!`
    }
  } catch (err) {
    console.error('Error inesperado en clonarConceptosNiifMasivo:', err)
    return {
      exito: false,
      mensaje: err instanceof Error ? err.message : 'Error interno del servidor.'
    }
  }
}

// ==========================================
// 5. CREAR UN NUEVO CONCEPTO NIIF
// ==========================================
export async function crearConceptoNiif(payload: {
  empresa_id?: string | number | null
  codigo_concepto?: string
  nombre: string
  elemento?: string
  clasificacion_balance?: string
}) {
  try {
    const cookieStore = await cookies()
    const empresa_id = payload.empresa_id || cookieStore.get('empresa_activa')?.value
    const { codigo_concepto, nombre, elemento, clasificacion_balance } = payload

    if (!empresa_id || !nombre) {
      return {
        exito: false,
        mensaje: 'Campos requeridos faltantes: empresa_id (o sesión activa) y nombre son obligatorios.'
      }
    }

    const nuevoConcepto = {
      empresa_id: Number(empresa_id),
      codigo_concepto: codigo_concepto || 'NIIF-001',
      nombre,
      elemento: elemento || '',
      clasificacion_balance: clasificacion_balance || ''
    }

    const { data, error } = await supabaseAdmin
      .from('conceptos_niif')
      .insert([nuevoConcepto])
      .select()

    if (error) {
      console.error('Error al insertar concepto NIIF:', error)
      return { exito: false, mensaje: `Error al guardar en base de datos: ${error.message}` }
    }

    return { exito: true, datos: data ? data[0] : null }
  } catch (err) {
    console.error('Error inesperado en crearConceptoNiif:', err)
    return {
      exito: false,
      mensaje: err instanceof Error ? err.message : 'Error interno del servidor.'
    }
  }
}

// ==========================================
// 6. ACTUALIZAR UN CONCEPTO NIIF EXISTENTE
// ==========================================
export async function actualizarConceptoNiif(payload: {
  id: string | number
  codigo_concepto?: string
  nombre?: string
  elemento?: string
  clasificacion_balance?: string
}) {
  try {
    const { id, nombre, elemento, clasificacion_balance, codigo_concepto } = payload

    if (!id) {
      return {
        exito: false,
        mensaje: 'El ID del concepto NIIF es obligatorio para actualizar.'
      }
    }

    const datosActualizar: Record<string, any> = {}
    if (nombre !== undefined) datosActualizar.nombre = nombre
    if (elemento !== undefined) datosActualizar.elemento = elemento
    if (clasificacion_balance !== undefined) datosActualizar.clasificacion_balance = clasificacion_balance
    if (codigo_concepto !== undefined) datosActualizar.codigo_concepto = codigo_concepto

    const { data, error } = await supabaseAdmin
      .from('conceptos_niif')
      .update(datosActualizar)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error al actualizar concepto NIIF:', error)
      return { exito: false, mensaje: `Error al actualizar en base de datos: ${error.message}` }
    }

    return { exito: true, datos: data ? data[0] : null }
  } catch (err) {
    console.error('Error inesperado en actualizarConceptoNiif:', err)
    return {
      exito: false,
      mensaje: err instanceof Error ? err.message : 'Error interno del servidor.'
    }
  }
}

// ==========================================
// 7. ELIMINAR UN CONCEPTO NIIF
// ==========================================
export async function eliminarConceptoNiif(id: string | number) {
  try {
    if (!id) {
      return {
        exito: false,
        mensaje: 'El ID del concepto NIIF es obligatorio para eliminar.'
      }
    }

    const { error } = await supabaseAdmin
      .from('conceptos_niif')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error al eliminar concepto NIIF:', error)
      return { exito: false, mensaje: `Error al eliminar de la base de datos: ${error.message}` }
    }

    return { exito: true, mensaje: 'Concepto NIIF eliminado correctamente.' }
  } catch (err) {
    console.error('Error inesperado en eliminarConceptoNiif:', err)
    return {
      exito: false,
      mensaje: err instanceof Error ? err.message : 'Error interno del servidor.'
    }
  }
}