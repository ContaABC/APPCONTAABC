import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export async function GET(request) {
  const cookieStore = cookies()
  const { searchParams } = new URL(request.url)
  
  // Captura automática de empresaId: si no viene en la URL, se lee de la cookie activa
  const empresaId = searchParams.get('empresaId') || cookieStore.get('empresa_activa')?.value
  const claseDocumentoId = searchParams.get('claseDocumentoId')
  const fetchEmpresas = searchParams.get('empresas')

  try {
    // 1. Obtener listado de empresas
    if (fetchEmpresas === 'true') {
      const { data, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social')
        .order('razon_social', { ascending: true })

      if (error) {
        console.error('Error Supabase al consultar empresas:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json(data)
    }

    // 2. Obtener los conceptos Débito, Crédito e IVA asignados a una clase de documento específica
    if (claseDocumentoId) {
      const { data, error } = await supabaseAdmin
        .from('clase_documento_conceptos')
        .select('id, clase_documento_id, concepto_auxiliar_debito, concepto_auxiliar_credito, concepto_auxiliar_iva_id')
        .eq('clase_documento_id', claseDocumentoId)
        .maybeSingle()

      if (error) {
        console.error('Error Supabase al consultar conceptos asignados:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Retorna el objeto directo con el mapeo debito, credito e iva
      return NextResponse.json(data || { 
        concepto_auxiliar_debito: null, 
        concepto_auxiliar_credito: null, 
        concepto_auxiliar_iva_id: null 
      })
    }

    // 3. Obtener Clases de Documento y Conceptos Auxiliares por empresa para llenar los selectores
    if (empresaId) {
      const [clasesRes, conceptosRes] = await Promise.all([
        supabaseAdmin
          .from('clases_documento')
          .select('id, codigo_clase, nombre_clase')
          .eq('empresa_id', empresaId)
          .order('codigo_clase', { ascending: true }),
        supabaseAdmin
          .from('conceptos_auxiliares')
          .select('id, codigo_auxiliar, nombre, elemento')
          .eq('empresa_id', empresaId)
          .order('codigo_auxiliar', { ascending: true }),
      ])

      if (clasesRes.error) throw clasesRes.error
      if (conceptosRes.error) throw conceptosRes.error

      return NextResponse.json({
        clases: clasesRes.data,
        conceptos: conceptosRes.data,
      })
    }

    return NextResponse.json({ error: 'Parámetros faltantes en la consulta o no hay sesión de empresa activa' }, { status: 400 })
  } catch (error) {
    console.error('Error en GET /api/clase-documento-conceptos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const cookieStore = cookies()
    const body = await request.json()
    let { empresaId, claseDocumentoId, conceptoDebitoId, conceptoCreditoId, conceptoIvaId } = body

    // Captura automática de empresaId desde el body o la cookie de sesión
    empresaId = empresaId || cookieStore.get('empresa_activa')?.value

    if (!claseDocumentoId || !conceptoDebitoId || !conceptoCreditoId) {
      return NextResponse.json(
        { error: 'Debe seleccionar la Clase de Documento y los conceptos principales (Débito y Crédito).' },
        { status: 400 }
      )
    }

    // Validación correcta usando las variables del servidor
    if (conceptoDebitoId === conceptoCreditoId) {
      return NextResponse.json(
        { error: 'El concepto Débito y el concepto Crédito no pueden ser el mismo.' },
        { status: 400 }
      )
    }

    // Consultar si ya existe una parametrización registrada para esa clase de documento
    const { data: existente, error: errFetch } = await supabaseAdmin
      .from('clase_documento_conceptos')
      .select('id')
      .eq('clase_documento_id', claseDocumentoId)
      .maybeSingle()

    if (errFetch) throw errFetch

    let resultado

    if (existente?.id) {
      // Actualizar registro existente (incluyendo el IVA)
      const { data, error } = await supabaseAdmin
        .from('clase_documento_conceptos')
        .update({
          concepto_auxiliar_debito: conceptoDebitoId,
          concepto_auxiliar_credito: conceptoCreditoId,
          concepto_auxiliar_iva_id: conceptoIvaId || null,
        })
        .eq('id', existente.id)
        .select()

      if (error) throw error
      resultado = data
    } else {
      // Insertar nuevo registro de parametrización (incluyendo el IVA)
      const payload = {
        clase_documento_id: claseDocumentoId,
        concepto_auxiliar_debito: conceptoDebitoId,
        concepto_auxiliar_credito: conceptoCreditoId,
        concepto_auxiliar_iva_id: conceptoIvaId || null,
      }

      if (empresaId) {
        payload.empresa_id = empresaId
      }

      const { data, error } = await supabaseAdmin
        .from('clase_documento_conceptos')
        .insert([payload])
        .select()

      if (error) throw error
      resultado = data
    }

    return NextResponse.json({
      success: true,
      mensaje: 'Parametrización de la Clase de Documento guardada correctamente.',
      data: resultado,
    })
  } catch (error) {
    console.error('Error en POST /api/clase-documento-conceptos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}