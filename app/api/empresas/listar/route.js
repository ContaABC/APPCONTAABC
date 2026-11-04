import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request) {
  try {
    // PREPARADO PARA EL FUTURO:
    // const { searchParams } = new URL(request.url)
    // const usuario_id = searchParams.get('usuario_id')

    let query = supabaseAdmin
      .from('empresas')
      .select('id, razon_social, nit_identificacion, dv')
      .order('razon_social', { ascending: true }) // Orden alfabético A-Z

    // FUTURO: Filtrar solo las empresas asignadas al usuario en la tabla 'usuarios_empresas'
    // if (usuario_id) {
    //   query = query.in('id', arrayDeEmpresasDelUsuario)
    // }

    const { data, error } = await query

    if (error) {
      console.error('Error Supabase Empresas:', error)
      return NextResponse.json({ exito: false, mensaje: error.message }, { status: 500 })
    }

    return NextResponse.json({ exito: true, empresas: data || [] })
  } catch (error) {
    console.error('Error Servidor:', error)
    return NextResponse.json({ exito: false, mensaje: error.message }, { status: 500 })
  }
}