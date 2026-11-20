import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// -----------------------------------------------------------------------------
// GET: Listar conceptos de retención filtrados por empresa_id y anio
// -----------------------------------------------------------------------------
export async function GET(request) {
  try {
    const cookieStore = await cookies()
    const { searchParams } = new URL(request.url)

    const rawEmpresaId =
      searchParams.get('empresa_id') || cookieStore.get('empresa_activa')?.value || ''

    const empNum = Number(rawEmpresaId)

    if (!rawEmpresaId || Number.isNaN(empNum) || !Number.isInteger(empNum) || empNum <= 0) {
      return NextResponse.json({
        exito: true,
        conceptos: [],
        mensaje: 'empresa_id no especificado o inválido; se retorna lista vacía.',
      })
    }

    const rawAnio = searchParams.get('anio')
    const anioNum = rawAnio ? Number(rawAnio) : NaN

    let query = supabase
      .from('conceptos_retencion')
      .select('*')
      .eq('empresa_id', empNum)

    if (!Number.isNaN(anioNum) && Number.isInteger(anioNum) && anioNum > 1900) {
      query = query.eq('anio', anioNum)
    }

    const { data, error } = await query.order('concepto', { ascending: true })

    if (error) {
      console.error('Error al consultar conceptos de retención:', error)
      return NextResponse.json(
        {
          exito: false,
          mensaje: 'Error al obtener los conceptos de retención.',
          error: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, conceptos: data || [] })
  } catch (error) {
    console.error('Error interno en API conceptos-retencion:', error)
    return NextResponse.json(
      {
        exito: false,
        mensaje: 'Error interno del servidor.',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}