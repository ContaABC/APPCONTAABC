'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Valores válidos para "Tipo de Auxiliar"
const TIPOS_AUXILIAR_VALIDOS = [
  'Auxiliar_General',
  'Cuentas_Bancarias',
  'Cuentas_Proveedor',
  'Cuentas_Clientes',
  'Cuentas_Inventario',
  'Cuentas_Acreedores',
  'Cuentas_Gastos',
  'Cuentas_Caja',
  'Cuentas_Costos',
  'Cuentas_Ingresos',
  'Cuentas_Patrimonio',
  'Cuentas_Activos_Fijos'
]

// ==========================================
// 1. OBTENER DATOS (Equivalente al GET)
// ==========================================
export async function getConceptosAuxiliaresData(params?: {
  accion?: string
  empresa_id?: string | number
  subconcepto_niif_id?: string | number
}) {
  try {
    const cookieStore = await cookies()
    const empresaId = params?.empresa_id || cookieStore.get('empresa_activa')?.value
    const subconceptoNiifId = params?.subconcepto_niif_id
    const accion = params?.accion

    // 1. Listar empresas activas
    if (accion === 'listar_empresas') {
      const { data: empresas, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social, nombre_comercial')
        .eq('estado', 'Activa')
        .order('razon_social', { ascending: true })

      if (error) throw error

      return { exito: true, datos: empresas || [] }
    }

    // 2. Listar Subconceptos NIIF por empresa
    if (accion === 'listar_subconceptos_niif') {
      if (!empresaId) {
        return { exito: false, mensaje: 'El parámetro empresa_id es obligatorio o no hay sesión activa' }
      }

      const { data: subconceptos, error } = await supabaseAdmin
        .from('subconceptos_niif')
        .select(`
          id,
          codigo,
          nombre,
          elemento,
          empresa_id,
          conceptos_niif (
            id,
            codigo_concepto,
            nombre,
            elemento
          )
        `)
        .eq('empresa_id', empresaId)
        .order('codigo', { ascending: true })

      if (error) throw error

      return { exito: true, datos: subconceptos || [] }
    }

    // 3. Generar nuevo Código Auxiliar autogenerado secuencial
    if (accion === 'generar_codigo_auxiliar') {
      if (!empresaId) {
        return { exito: false, mensaje: 'El parámetro empresa_id es requerido o no hay sesión activa' }
      }

      let query = supabaseAdmin
        .from('conceptos_auxiliares')
        .select('codigo_auxiliar')
        .eq('empresa_id', empresaId)

      if (subconceptoNiifId) {
        query = query.eq('subconcepto_niif_id', subconceptoNiifId)
      }

      const { data: registros, error } = await query
        .order('codigo_auxiliar', { ascending: false })
        .limit(1)

      if (error) throw error

      let siguienteCodigo = '001'
      if (registros && registros.length > 0 && registros[0].codigo_auxiliar) {
        const ultimoCodigoStr = registros[0].codigo_auxiliar
        const numeroLimpio = parseInt(ultimoCodigoStr.replace(/\D/g, ''), 10)
        
        if (!isNaN(numeroLimpio)) {
          siguienteCodigo = String(numeroLimpio + 1).padStart(3, '0')
        }
      }

      return { exito: true, nuevo_codigo: siguienteCodigo }
    }

    // 4. Listar Conceptos Auxiliares por empresa (Por defecto)
    if (!empresaId) {
      return { exito: false, mensaje: 'El parámetro empresa_id es requerido o no hay sesión activa' }
    }

    const { data: conceptos, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .select(`
        *,
        subconceptos_niif (
          id,
          codigo,
          nombre,
          elemento,
          concepto_niif_id,
          conceptos_niif (
            id,
            codigo_concepto,
            nombre,
            elemento
          )
        )
      `)
      .eq('empresa_id', empresaId)
      .order('id', { ascending: false })

    if (error) throw error

    const conceptosFormateados = (conceptos || []).map((item: any) => ({
      ...item,
      codigo_subconcepto_niif: item.subconceptos_niif?.codigo || null,
      nombre_subconcepto_niif: item.subconceptos_niif?.nombre || null,
      codigo_concepto_niif: item.subconceptos_niif?.conceptos_niif?.codigo_concepto || null,
      nombre_concepto_niif: item.subconceptos_niif?.conceptos_niif?.nombre || null,
      elemento_niif: item.elemento || item.subconceptos_niif?.conceptos_niif?.elemento || item.subconceptos_niif?.elemento || null
    }))

    return { exito: true, datos: conceptosFormateados }

  } catch (error: any) {
    console.error('❌ Error en getConceptosAuxiliaresData:', error)
    return { exito: false, mensaje: 'Error interno en el servidor', error: error.message }
  }
}

// ==========================================
// 2. CREAR REGISTRO (Equivalente al POST)
// ==========================================
export async function crearConceptoAuxiliar(formData: any) {
  try {
    const cookieStore = await cookies()
    const empresa_id = formData.empresa_id || formData.empresaId || cookieStore.get('empresa_activa')?.value

    const {
      subconcepto_niif_id,
      codigo_auxiliar,
      nombre,
      tipo_entidad,
      descripcion,
      estado,
      elemento
    } = formData

    if (!empresa_id || !nombre) {
      return { exito: false, mensaje: 'Faltan campos obligatorios o no hay sesión activa (empresa_id, nombre)' }
    }

    const tipoAuxiliarSanitizado = TIPOS_AUXILIAR_VALIDOS.includes(tipo_entidad)
      ? tipo_entidad
      : 'Auxiliar_General'

    const subconceptoUuid = subconcepto_niif_id && String(subconcepto_niif_id).trim() !== '' 
      ? String(subconcepto_niif_id).trim() 
      : null

    let codigoFinal = codigo_auxiliar ? String(codigo_auxiliar).trim() : null

    if (!codigoFinal) {
      let query = supabaseAdmin
        .from('conceptos_auxiliares')
        .select('codigo_auxiliar')
        .eq('empresa_id', Number(empresa_id))

      if (subconceptoUuid) {
        query = query.eq('subconcepto_niif_id', subconceptoUuid)
      }

      const { data: registrosExistentes } = await query
        .order('codigo_auxiliar', { ascending: false })
        .limit(1)

      codigoFinal = '001'
      if (registrosExistentes && registrosExistentes.length > 0 && registrosExistentes[0].codigo_auxiliar) {
        const numActual = parseInt(registrosExistentes[0].codigo_auxiliar.replace(/\D/g, ''), 10)
        if (!isNaN(numActual)) {
          codigoFinal = String(numActual + 1).padStart(3, '0')
        }
      }
    }

    let codigoDuplicado = true
    let intentos = 0
    while (codigoDuplicado && intentos < 15) {
      let queryCheck = supabaseAdmin
        .from('conceptos_auxiliares')
        .select('id')
        .eq('empresa_id', Number(empresa_id))
        .eq('codigo_auxiliar', codigoFinal!) // Aseguramos con ! que no es null aquí

      if (subconceptoUuid) {
        queryCheck = queryCheck.eq('subconcepto_niif_id', subconceptoUuid)
      }

      const { data: existeCodigo } = await queryCheck.maybeSingle()

      if (existeCodigo) {
        const partes: string[] = codigoFinal!.split('-') // Indicamos explícitamente el tipo string[]
        const ultimoSegmento = partes[partes.length - 1]
        const numActual = parseInt(ultimoSegmento, 10)
        
        if (!isNaN(numActual)) {
          partes[partes.length - 1] = String(numActual + 1).padStart(3, '0')
          codigoFinal = partes.join('-')
        } else {
          intentos++
        }
      } else {
        codigoDuplicado = false
      }
      intentos++
    }

    const insertPayload = {
      empresa_id: Number(empresa_id),
      subconcepto_niif_id: subconceptoUuid,
      codigo_auxiliar: codigoFinal,
      nombre: String(nombre).trim(),
      tipo_entidad: tipoAuxiliarSanitizado,
      descripcion: descripcion ? String(descripcion).trim() : null,
      estado: estado || 'Activo',
      elemento: elemento ? String(elemento).trim() : null
    }

    const { data, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .insert([insertPayload])
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
    console.error('❌ Error fatal en crearConceptoAuxiliar:', error)
    return { exito: false, mensaje: 'Error interno del servidor', error: error.message }
  }
}

// ==========================================
// 3. ACTUALIZAR REGISTRO (Equivalente al PUT)
// ==========================================
export async function actualizarConceptoAuxiliar(formData: any) {
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
      estado,
      elemento
    } = formData

    if (!id) {
      return { exito: false, mensaje: 'El id del concepto es obligatorio para actualizar' }
    }

    const tipoAuxiliarSanitizado = TIPOS_AUXILIAR_VALIDOS.includes(tipo_entidad)
      ? tipo_entidad
      : 'Auxiliar_General'

    const subconceptoUuid = subconcepto_niif_id && String(subconcepto_niif_id).trim() !== '' 
      ? String(subconcepto_niif_id).trim() 
      : null

    const updatePayload: any = {
      tipo_entidad: tipoAuxiliarSanitizado,
      descripcion: descripcion ? String(descripcion).trim() : null,
      subconcepto_niif_id: subconceptoUuid,
      elemento: elemento ? String(elemento).trim() : null
    }

    if (empresa_id) updatePayload.empresa_id = Number(empresa_id)
    if (codigo_auxiliar) updatePayload.codigo_auxiliar = String(codigo_auxiliar).trim()
    if (nombre) updatePayload.nombre = String(nombre).trim()
    if (estado) updatePayload.estado = estado

    const { data, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .update(updatePayload)
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
    console.error('❌ Error fatal en actualizarConceptoAuxiliar:', error)
    return { exito: false, mensaje: 'Error interno del servidor', error: error.message }
  }
}

// ==========================================
// 4. ELIMINAR REGISTRO (Equivalente al DELETE)
// ==========================================
export async function eliminarConceptoAuxiliar(id: string | number) {
  try {
    if (!id) {
      return { exito: false, mensaje: 'El id es requerido para eliminar' }
    }

    const { error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ Error al eliminar concepto auxiliar:', error)
      return { exito: false, mensaje: error.message }
    }

    return {
      exito: true,
      mensaje: 'Concepto auxiliar eliminado correctamente'
    }

  } catch (error: any) {
    console.error('❌ Error fatal en eliminarConceptoAuxiliar:', error)
    return { exito: false, mensaje: 'Error interno del servidor', error: error.message }
  }
}