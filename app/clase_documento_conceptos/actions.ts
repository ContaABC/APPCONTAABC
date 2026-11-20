'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ==========================================
// 1. OBTENER DATOS (Equivalente al GET)
// ==========================================
export async function getClaseDocumentoConceptosData(params?: {
  empresaId?: string | number
  claseDocumentoId?: string | number
  empresas?: string
}) {
  try {
    const cookieStore = await cookies()
    const empresaId = params?.empresaId || cookieStore.get('empresa_activa')?.value

    // 1. Obtener listado de empresas
    if (params?.empresas === 'true') {
      const { data, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social')
        .order('razon_social', { ascending: true })

      if (error) {
        console.error('Error Supabase al consultar empresas:', error)
        return { error: error.message }
      }

      return data || []
    }

    // 2. Obtener los conceptos Débito, Crédito e IVA asignados a una clase de documento específica
    if (params?.claseDocumentoId) {
      let query = supabaseAdmin
        .from('clase_documento_conceptos')
        .select('id, empresa_id, clase_documento_id, concepto_auxiliar_debito, concepto_auxiliar_credito, concepto_auxiliar_iva_id')
        .eq('clase_documento_id', params.claseDocumentoId)

      if (empresaId) {
        query = query.eq('empresa_id', Number(empresaId))
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        console.error('Error Supabase al consultar conceptos asignados:', error)
        return { error: error.message }
      }

      return data || {
        concepto_auxiliar_debito: null,
        concepto_auxiliar_credito: null,
        concepto_auxiliar_iva_id: null
      }
    }

    // 3. Obtener Clases de Documento y Conceptos Auxiliares por empresa para llenar los selectores
    if (empresaId) {
      const [clasesRes, conceptosRes] = await Promise.all([
        supabaseAdmin
          .from('clases_documento')
          .select('id, codigo_clase, nombre_clase')
          .eq('empresa_id', Number(empresaId))
          .order('codigo_clase', { ascending: true }),
        supabaseAdmin
          .from('conceptos_auxiliares')
          .select('id, codigo_auxiliar, nombre, elemento')
          .eq('empresa_id', Number(empresaId))
          .order('codigo_auxiliar', { ascending: true }),
      ])

      if (clasesRes.error) throw clasesRes.error
      if (conceptosRes.error) throw conceptosRes.error

      return {
        clases: clasesRes.data || [],
        conceptos: conceptosRes.data || [],
      }
    }

    return { error: 'Parámetros faltantes en la consulta o no hay sesión de empresa activa' }
  } catch (error: any) {
    console.error('Error en getClaseDocumentoConceptosData:', error)
    return { error: error.message || 'Error interno del servidor.' }
  }
}

// ==========================================
// 2. GUARDAR / ACTUALIZAR (Equivalente al POST)
// ==========================================
export async function guardarClaseDocumentoConceptos(formData: {
  empresaId?: string | number
  claseDocumentoId: string | number
  conceptoDebitoId: string | number
  conceptoCreditoId: string | number
  conceptoIvaId?: string | number | null
}) {
  try {
    const cookieStore = await cookies()
    let { empresaId, claseDocumentoId, conceptoDebitoId, conceptoCreditoId, conceptoIvaId } = formData

    // Captura automática de empresaId desde el parámetro o la cookie de sesión
    empresaId = empresaId || cookieStore.get('empresa_activa')?.value

    if (!claseDocumentoId || !conceptoDebitoId || !conceptoCreditoId) {
      return {
        error: 'Debe seleccionar la Clase de Documento y los conceptos principales (Débito y Crédito).'
      }
    }

    if (String(conceptoDebitoId) === String(conceptoCreditoId)) {
      return {
        error: 'El concepto Débito y el concepto Crédito no pueden ser el mismo.'
      }
    }

    let queryExistente = supabaseAdmin
      .from('clase_documento_conceptos')
      .select('id')
      .eq('clase_documento_id', claseDocumentoId)

    if (empresaId) {
      queryExistente = queryExistente.eq('empresa_id', Number(empresaId))
    }

    const { data: existente, error: errFetch } = await queryExistente.maybeSingle()

    if (errFetch) throw errFetch

    let resultado

    if (existente?.id) {
      const updatePayload: any = {
        concepto_auxiliar_debito: conceptoDebitoId,
        concepto_auxiliar_credito: conceptoCreditoId,
        concepto_auxiliar_iva_id: conceptoIvaId || null,
      }
      if (empresaId) {
        updatePayload.empresa_id = Number(empresaId)
      }

      const { data, error } = await supabaseAdmin
        .from('clase_documento_conceptos')
        .update(updatePayload)
        .eq('id', existente.id)
        .select()

      if (error) throw error
      resultado = data
    } else {
      const payload: any = {
        clase_documento_id: claseDocumentoId,
        concepto_auxiliar_debito: conceptoDebitoId,
        concepto_auxiliar_credito: conceptoCreditoId,
        concepto_auxiliar_iva_id: conceptoIvaId || null,
      }

      if (empresaId) {
        payload.empresa_id = Number(empresaId)
      }

      const { data, error } = await supabaseAdmin
        .from('clase_documento_conceptos')
        .insert([payload])
        .select()

      if (error) throw error
      resultado = data
    }

    return {
      success: true,
      mensaje: 'Parametrización de la Clase de Documento guardada correctamente.',
      data: resultado,
    }
  } catch (error: any) {
    console.error('Error en guardarClaseDocumentoConceptos:', error)
    return { error: error.message || 'Error interno del servidor.' }
  }
}