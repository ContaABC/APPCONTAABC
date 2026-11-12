// lib/supabaseAdmin.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL en el servidor.');
}

if (!supabaseServiceKey) {
  throw new Error('Falta la clave SUPABASE_SERVICE_ROLE_KEY en el servidor.');
}

// Este cliente opera como el Superusuario Administrador del sistema
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // No requiere mantener sesión en el servidor
    autoRefreshToken: false,
  },
});