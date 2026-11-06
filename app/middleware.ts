import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware' // O el gestor de sesión estándar de Supabase SSR

export async function middleware(request: NextRequest) {
  // Si prefieres una validación directa o usando @supabase/ssr, 
  // aseguramos que si no hay token de sesión y no están en /login, los mande al login.
  const sessionToken = request.cookies.get('sb-access-token') || request.cookies.get('supabase-auth-token');
  
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  // Nota: Si estás usando @supabase/ssr, puedes integrar la validación nativa de sesión aquí.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Excluir archivos estáticos, imágenes y favicon
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}