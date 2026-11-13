import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerClient } from '@supabase/ssr'

 
    // 1. Crear cliente de Supabexport async function GET(req) {
  try {
    const cookieStore = await cookies() // <-- EL AWAIT ES OBLIGATORIO AQUÍ
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')
    const empresa_id = searchParams.get('empresa_id') || cookieStore.get('empresa_activa')?.value
    const concepto_niif_id = searchParams.get('concepto_niif_id')

    // 1. Listar empresas para los dropdowns
    if (accion === 'listar_empresas') {
      const { data, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social, nombre_comercial')
        .order('razon_social', { ascending: true })

      if (error) {
        console.error('Error al listar empresas:', error)
        return NextResponse.json({ exito: false, mensaje: error.message }, { status: 500 })
      }

      return NextResponse.json({ exito: true, datos: data || [] })
    }

    // ... resto de tu código GET ...ase SSR para leer la sesión actual del usuario de forma segura
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
      .select('id, razon_social, nit_identificacion, dv')
      .order('razon_social', { ascending: true })

    // 2. Si hay un usuario autenticado, verificamos su rol y restricciones
    if (user && !authError) {
      const { data: perfil } = await supabaseAdmin
        .from('usuarios_perfiles')
        .select('tipo_usuario')
        .eq('id', user.id)
        .single()

      const esAdmin = perfil?.tipo_usuario?.toLowerCase() === 'administrador'

      // Si NO es administrador, filtramos estrictamente solo las empresas asignadas en la tabla de relación
      if (!esAdmin) {
        const { data: asignaciones, error: errAsig } = await supabaseAdmin
          .from('usuarios_empresas')
          .select('empresa_id')
          .eq('usuario_id', user.id)

        if (errAsig) throw errAsig

        const idsEmpresasPermitidas = (asignaciones || []).map((item) => item.empresa_id)

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