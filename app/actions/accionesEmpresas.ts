'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerClient } from '@supabase/ssr'

interface Empresa {
  id: number | string
  razon_social: string
  nombre_comercial?: string
  nit_identificacion: string
  dv?: string
}

interface Sucursal {
  id: number | string
  nombre: string
  empresa_id: number | string
  codigo_sucursal?: string
}

// 1. Obtener el cliente de Supabase con la sesión del usuario actual
async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

// 2. Acción para listar las empresas autorizadas del usuario en sesión (ESTRICTAMENTE por permisos)
export async function getEmpresasPermitidas(): Promise<Empresa[]> {
  try {
    const supabaseClient = await getSupabaseServerClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (!user || authError) return []

    // Consultar SIEMPRE los permisos del usuario en usuario_permisos_tx (sin excepciones de rol)
    const { data: permisosTx, error: errPermisos } = await supabaseAdmin
      .from('usuario_permisos_tx')
      .select('empresa_id')
      .eq('usuario_id', user.id)

    if (errPermisos) throw errPermisos

    const idsEmpresasPermitidas = Array.from(
      new Set((permisosTx || []).map((item: any) => item.empresa_id).filter(Boolean))
    )

    if (idsEmpresasPermitidas.length === 0) {
      return []
    }

    const { data, error } = await supabaseAdmin
      .from('empresas')
      .select('id, razon_social, nombre_comercial, nit_identificacion, dv')
      .in('id', idsEmpresasPermitidas)
      .eq('estado', 'Activa')
      .order('razon_social', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error en Server Action getEmpresasPermitidas:', error)
    return []
  }
}

// 3. Acción para listar las sucursales autorizadas de una empresa para el usuario en sesión
export async function getSucursalesPermitidas(empresaId: string | number): Promise<Sucursal[]> {
  if (!empresaId) return []

  try {
    const supabaseClient = await getSupabaseServerClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (!user || authError) return []

    let query = supabaseAdmin
      .from('sucursales')
      .select('id, nombre, empresa_id, codigo_sucursal')
      .eq('empresa_id', empresaId)
      .eq('estado', 'Activa')
      .order('nombre', { ascending: true })

    // Consultar estrictamente los permisos de sucursales para esta empresa y usuario
    const { data: permisosTx } = await supabaseAdmin
      .from('usuario_permisos_tx')
      .select('sucursal_id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)

    const sucursalIdsPermitidas = Array.from(
      new Set((permisosTx || []).map((p: any) => p.sucursal_id).filter((id: any) => id !== null && id !== undefined))
    )
    const tieneAccesoGlobal = (permisosTx || []).some((p: any) => p.sucursal_id === null)

    if (!tieneAccesoGlobal && sucursalIdsPermitidas.length === 0) {
      return []
    }

    if (!tieneAccesoGlobal) {
      query = query.in('id', sucursalIdsPermitidas)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error en Server Action getSucursalesPermitidas:', error)
    return []
  }
}

// 4. Obtener la empresa activa actual desde la BD (perfil del usuario)
export async function getEmpresaActivaUsuario(): Promise<string | number | null> {
  try {
    const supabaseClient = await getSupabaseServerClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (!user || authError) return null

    const { data: perfil, error } = await supabaseAdmin
      .from('usuarios_perfiles')
      .select('empresa_activa')
      .eq('id', user.id)
      .single()

    if (error || !perfil) return null
    return perfil.empresa_activa || null
  } catch (error) {
    console.error('Error al obtener empresa activa del usuario:', error)
    return null
  }
}

// 5. Actualizar la empresa activa del usuario en la BD cuando se use el selector
export async function setEmpresaActivaUsuario(empresaId: string | number): Promise<boolean> {
  try {
    const supabaseClient = await getSupabaseServerClient()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (!user || authError) return false

    const { error } = await supabaseAdmin
      .from('usuarios_perfiles')
      .update({ empresa_activa: empresaId })
      .eq('id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error al actualizar empresa activa en BD:', error)
    return false
  }
}