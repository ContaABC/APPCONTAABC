'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export interface Empresa {
  id: number | string
  razon_social: string
  nombre_comercial?: string
  nit_identificacion: string
  dv?: string
}

export interface Sucursal {
  id: number | string
  nombre: string
  empresa_id: number | string
  codigo_sucursal?: string
}

export interface ContextoUsuarioActivo {
  usuarioNombre: string
  empresaId: string
  empresaNombre: string
  sucursalId: string
  sucursalNombre: string
}

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

async function resolverUsuarioId(userIdParam?: string | null): Promise<string | null> {
  if (userIdParam && String(userIdParam).trim() !== '') {
    return String(userIdParam).trim()
  }
  try {
    const supabaseClient = await getSupabaseServerClient()
    const { data: { user }, error } = await supabaseClient.auth.getUser()
    if (!error && user?.id) {
      return user.id
    }
  } catch {
    // Si no hay sesión en cookies del servidor, retornamos null
  }
  return null
}

function normalizarValorId(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

export async function getEmpresasPermitidas(userIdParam?: string | null): Promise<Empresa[]> {
  try {
    const userId = await resolverUsuarioId(userIdParam)
    if (!userId) return []

    const { data: permisosTx, error: errPermisos } = await supabaseAdmin
      .from('usuario_permisos_tx')
      .select('empresa_id')
      .eq('usuario_id', userId)

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

export async function getSucursalesPermitidas(
  empresaId: string | number,
  userIdParam?: string | null
): Promise<Sucursal[]> {
  if (!empresaId) return []

  try {
    const userId = await resolverUsuarioId(userIdParam)
    if (!userId) return []

    let query = supabaseAdmin
      .from('sucursales')
      .select('id, nombre, empresa_id, codigo_sucursal')
      .eq('empresa_id', empresaId)
      .eq('estado', 'Activa')
      .order('nombre', { ascending: true })

    const { data: permisosTx } = await supabaseAdmin
      .from('usuario_permisos_tx')
      .select('sucursal_id')
      .eq('usuario_id', userId)
      .eq('empresa_id', empresaId)

    const sucursalIdsPermitidas = Array.from(
      new Set(
        (permisosTx || [])
          .map((p: any) => p.sucursal_id)
          .filter((id: any) => id !== null && id !== undefined)
      )
    )
    const tieneAccesoGlobal = (permisosTx || []).some(
      (p: any) => p.sucursal_id === null
    )

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

export async function getEmpresaActivaUsuario(
  userIdParam?: string | null
): Promise<string | number | null> {
  try {
    const userId = await resolverUsuarioId(userIdParam)
    if (!userId) return null

    const { data: perfil, error } = await supabaseAdmin
      .from('usuarios_perfiles')
      .select('empresa_activa')
      .eq('id', userId)
      .maybeSingle()

    if (error || !perfil) return null
    return perfil.empresa_activa || null
  } catch (error) {
    console.error('Error al obtener empresa activa del usuario:', error)
    return null
  }
}

export async function getSucursalActivaUsuario(
  userIdParam?: string | null
): Promise<string | number | null> {
  try {
    const userId = await resolverUsuarioId(userIdParam)
    if (!userId) return null

    const { data: perfil, error } = await supabaseAdmin
      .from('usuarios_perfiles')
      .select('sucursal_activa')
      .eq('id', userId)
      .maybeSingle()

    if (error || !perfil) return null
    return perfil.sucursal_activa || null
  } catch (error) {
    console.error('Error al obtener sucursal activa del usuario:', error)
    return null
  }
}

export async function setEmpresaActivaUsuario(
  empresaId: string | number,
  userIdParam?: string | null,
  sucursalId: string | number | null = null
): Promise<boolean> {
  try {
    const userId = await resolverUsuarioId(userIdParam)
    if (!userId) return false

    const empNormalizada = normalizarValorId(empresaId)
    if (!empNormalizada) return false

    const valorEmpresa = !Number.isNaN(Number(empNormalizada))
      ? Number(empNormalizada)
      : empNormalizada

    const sucNormalizada = normalizarValorId(sucursalId)
    const valorSucursal = sucNormalizada
      ? !Number.isNaN(Number(sucNormalizada))
        ? Number(sucNormalizada)
        : sucNormalizada
      : null

    const { error } = await supabaseAdmin
      .from('usuarios_perfiles')
      .update({
        empresa_activa: valorEmpresa,
        sucursal_activa: valorSucursal,
      })
      .eq('id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error al actualizar empresa y sucursal activa en BD:', error)
    return false
  }
}

export async function setSucursalActivaUsuario(
  sucursalId: string | number | null,
  userIdParam?: string | null
): Promise<boolean> {
  try {
    const userId = await resolverUsuarioId(userIdParam)
    if (!userId) return false

    const sucNormalizada = normalizarValorId(sucursalId)
    const valorSucursal = sucNormalizada
      ? !Number.isNaN(Number(sucNormalizada))
        ? Number(sucNormalizada)
        : sucNormalizada
      : null

    const { error } = await supabaseAdmin
      .from('usuarios_perfiles')
      .update({ sucursal_activa: valorSucursal })
      .eq('id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error al actualizar sucursal activa en BD:', error)
    return false
  }
}

export async function getContextoActivoUsuario(
  userIdParam?: string | null,
  empIdFallback?: string | null,
  sucIdFallback?: string | null
): Promise<ContextoUsuarioActivo> {
  let usuarioNombre = ''
  let empId = ''
  let sucId = ''

  const userId = await resolverUsuarioId(userIdParam)

  if (userId) {
    const { data: perfil } = await supabaseAdmin
      .from('usuarios_perfiles')
      .select('nombres, apellidos, empresa_activa, sucursal_activa')
      .eq('id', userId)
      .maybeSingle()

    if (perfil) {
      usuarioNombre = `${perfil.nombres || ''} ${perfil.apellidos || ''}`.trim()
      const empPerfil = normalizarValorId(perfil.empresa_activa)
      const sucPerfil = normalizarValorId(perfil.sucursal_activa)
      if (empPerfil) empId = empPerfil
      if (sucPerfil) sucId = sucPerfil
    }
  }

  if (!empId && empIdFallback) {
    empId = normalizarValorId(empIdFallback)
  }
  if (!sucId && sucIdFallback) {
    sucId = normalizarValorId(sucIdFallback)
  }

  let empresaNombre = 'Empresa Principal'
  if (empId) {
    const filtroEmp = !Number.isNaN(Number(empId)) ? Number(empId) : empId
    const { data: empData } = await supabaseAdmin
      .from('empresas')
      .select('razon_social, nombre_comercial, nombre')
      .eq('id', filtroEmp)
      .maybeSingle()

    empresaNombre =
      empData?.razon_social ||
      empData?.nombre_comercial ||
      empData?.nombre ||
      'Empresa Principal'
  }

  let sucursalNombre = 'Sucursal Principal'
  if (sucId) {
    const filtroSuc = !Number.isNaN(Number(sucId)) ? Number(sucId) : sucId
    const { data: sucData } = await supabaseAdmin
      .from('sucursales')
      .select('nombre, nombre_sucursal')
      .eq('id', filtroSuc)
      .maybeSingle()

    sucursalNombre =
      sucData?.nombre || sucData?.nombre_sucursal || 'Sucursal Principal'
  } else if (empId) {
    sucursalNombre = 'Todas las sucursales'
  }

  return {
    usuarioNombre,
    empresaId: empId,
    empresaNombre,
    sucursalId: sucId,
    sucursalNombre,
  }
}