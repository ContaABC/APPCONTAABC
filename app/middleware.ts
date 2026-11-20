import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 1. Obtener usuario autenticado de forma estricta
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const path = url.pathname

  // 2. Si estás intentando ir al login y YA tienes sesión, te mandamos al inicio (/)
  if (path.startsWith('/login') && user) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 3. Si NO estás logueado y la ruta NO es /login, ¡BLOQUEO TOTAL! Redirigir a /login
  if (!path.startsWith('/login') && !user) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si está logueado y accede a la raíz o rutas generales del sistema, permitimos el paso
  if (user && (path === '/' || path.startsWith('/_next') || path.includes('/api/'))) {
    return supabaseResponse
  }

  // 4. VALIDACIÓN GRANULAR POR TRANSACCIÓN (TX) Y MÓDULO
  if (user && !path.startsWith('/login')) {
    // Obtener la empresa activa de la cookie corporativa
    const empresaActivaCookie = request.cookies.get('empresa_activa')?.value

    // Si intenta entrar al sistema y no ha seleccionado empresa o es una ruta protegida sin empresa, permitimos (o redirigimos a config)
    if (empresaActivaCookie) {
      // Consultar si la ruta actual existe en el catálogo de transacciones
      const { data: txActual } = await supabase
        .from('transacciones_sistema')
        .select('id, modulo, es_modulo_padre')
        .eq('ruta_acceso', path)
        .single()

      // Si la ruta no está registrada en el catálogo de TX, se permite por defecto (ej. páginas secundarias o dinámicas)
      if (txActual) {
        // Consultar los permisos del usuario para esta empresa
        const { data: permisos } = await supabase
          .from('usuario_permisos_tx')
          .select(`
            transacciones_sistema (
              id,
              ruta_acceso,
              modulo,
              es_modulo_padre
            )
          `)
          .eq('usuario_id', user.id)
          .eq('empresa_id', empresaActivaCookie)

        if (!permisos || permisos.length === 0) {
          // Sin ningún permiso en esta empresa -> Redirigir o bloquear
          url.pathname = '/' // O una ruta de acceso denegado
          return NextResponse.redirect(url)
        }

        const txsPermitidasIds = permisos.map((p: any) => p.transacciones_sistema?.id)
        const modulosPermitidosNombres = permisos
          .filter((p: any) => p.transacciones_sistema?.es_modulo_padre)
          .map((p: any) => p.transacciones_sistema?.modulo)

        const tieneAccesoDirecto = txsPermitidasIds.includes(txActual.id)
        const tieneAccesoPorModuloPadre = modulosPermitidosNombres.includes(txActual.modulo)

        // Si no tiene acceso ni a la TX individual ni al Módulo Padre completo, bloquear acceso
        if (!tieneAccesoDirecto && !tieneAccesoPorModuloPadre) {
          url.pathname = '/' // Redirigir al inicio o panel principal
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}

// Matcher absoluto que intercepta toda la aplicación sin excepciones de rutas
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}