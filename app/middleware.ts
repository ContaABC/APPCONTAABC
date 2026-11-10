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

  // Consultar sesión en el servidor
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const path = url.pathname

  // RUTAS PÚBLICAS (solo login)
  if (path.startsWith('/login')) {
    if (user) {
      // Si ya está logueado y va a login, mandarlo al inicio
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // SI NO HAY USUARIO Y PRETENDE ENTRAR A LA RAIZ (/) O CUALQUIER MODULO -> BLOQUEAR Y MANDAR A LOGIN
  if (!user) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Configuración estricta del Matcher
export const config = {
  matcher: [
    '/',
    '/modulos/:path*',
    '/usuarios/:path*',
  ],
}