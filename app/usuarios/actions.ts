"use server";

import { createClient } from "@supabase/supabase-js";

export async function crearUsuarioAdmin(formData: {
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  password: string;
  tipo_usuario: string;
}) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Llave administrativa

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Faltan las credenciales administrativas de Supabase (SERVICE_ROLE_KEY).");
    }

    // Cliente con privilegios de administrador (ignora políticas de sesión y RLS del cliente)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 1. Crear el usuario en Supabase Auth directamente (sin desloguear al admin actual)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: formData.email,
      password: formData.password,
      email_confirm: true, // Auto-confirma el correo para que pueda ingresar de inmediato
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("No se pudo crear el usuario en el sistema de autenticación.");

    const userId = authData.user.id;

    // 2. Insertar o actualizar el perfil en la tabla usuarios_perfiles
    const { error: profileError } = await supabaseAdmin
      .from("usuarios_perfiles")
      .upsert([
        {
          id: userId,
          nombres: formData.nombres,
          apellidos: formData.apellidos,
          cedula: formData.cedula,
          email: formData.email,
          tipo_usuario: formData.tipo_usuario,
          activo: true,
        },
      ]);

    if (profileError) throw profileError;

    return { success: true, message: "¡Usuario registrado exitosamente!" };
  } catch (error: any) {
    console.error("Error al crear usuario:", error);
    return { success: false, message: error.message || "Error al registrar el usuario." };
  }
}