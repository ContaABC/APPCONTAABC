import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// -----------------------------------------------------------------------------
// GET: Listar conceptos de retención filtrados por empresa_id
// -----------------------------------------------------------------------------
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const empresaId = searchParams.get('empresa_id')

    let query = supabase.from('conceptos_retencion').select('*')

    if (empresaId) {
      query = query.eq('empresa_id', empresaId)
    }

    const { data, error } = await query.order('concepto', { ascending: true })

    if (error) {
      console.error('Error al consultar conceptos de retención:', error)
      return NextResponse.json(
        { exito: false, mensaje: 'Error al obtener los conceptos de retención.', error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, conceptos: data || [] })

  } catch (error) {
    console.error('Error interno en API conceptos-retencion:', error)
    return NextResponse.json(
      { exito: false, mensaje: 'Error interno del servidor.', error: error.message },
      { status: 500 }
    )
  }
}