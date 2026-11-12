// lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL en el archivo .env.local');
}

if (!supabaseAnonKey) {
  throw new Error('Falta la variable de entorno NEXT_PUBLIC_SUPABASE_ANON_KEY en el archivo .env.local');
}

// Cliente de Supabase para el lado del cliente (Client Components / Navegador)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    // Configuramos sessionStorage para que la sesión muera al cerrar la pestaña o navegador
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
  },
});