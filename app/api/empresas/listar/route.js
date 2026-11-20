import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerClient } from '@supabase/ssr'

export async function GET(request) {
  try {
    const cookieStore = await cookies()

    // 1. Crear cliente de Supabase SSR para leer la sesión actual de forma segura
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    let query = supabaseAdmin
      .from('empresas')
      .select('id, razon_social, nombre_comercial, nit_identificacion, dv')
      .eq('estado', 'Activa')
      .order('razon_social', { ascending: true })

    // 2. Si hay un usuario autenticado, verificamos su tipo y restricciones granulares
    if (user && !authError) {
      const { data: perfil } = await supabaseAdmin
        .from('usuarios_perfiles')
        .select('tipo_usuario')
        .eq('id', user.id)
        .single()

      const esAdmin = perfil?.tipo_usuario?.toLowerCase() === 'administrador'

      // Si NO es administrador, filtramos estrictamente solo las empresas con permisos en usuario_permisos_tx
      if (!esAdmin) {
        const { data: permisosTx, error: errPermisos } = await supabaseAdmin
          .from('usuario_permisos_tx')
          .select('empresa_id')
          .eq('usuario_id', user.id)

        if (errPermisos) throw errPermisos

        const idsEmpresasPermitidas = Array.from(new Set((permisosTx || []).map((item) => item.empresa_id).filter(Boolean)))

        if (idsEmpresasPermitidas.length === 0) {
          return NextResponse.json({ exito: true, empresas: [] })
        }

        query = query.in('id', idsEmpresasPermitidas)
      }
    }

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