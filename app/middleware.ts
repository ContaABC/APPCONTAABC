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

  // Validar el usuario en Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const path = url.pathname

  // Si intenta ir a login pero ya está autenticado -> mandar a la raíz
  if (path.startsWith('/login') && user) {
    url.pathname = '/'
    const res = NextResponse.redirect(url)
    // Cabeceras anti-caché absolutas
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return res
  }

  // Si NO está logueado y pretende entrar a cualquier parte que no sea /login -> EXPULSAR
  if (!path.startsWith('/login') && !user) {
    url.pathname = '/login'
    const res = NextResponse.redirect(url)
    // Cabeceras anti-caché absolutas
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return res
  }

  // Si está autenticado, agregamos cabeceras para que Vercel NUNCA guarde caché de esta página
  supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}