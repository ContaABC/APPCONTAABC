"use server";

import { createClient } from "@supabase/supabase-js";

// ==========================================
// INTERFACES Y TIPOS
// ==========================================
export interface UsuarioFormData {
  id?: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  password?: string;
  tipo_usuario: string;
  es_temporal: boolean; // true = Usuario temporal que expira; false = Usuario permanente
  fecha_expiracion_password: string; // Fecha límite de la cuenta o de la clave
}

export interface UsuarioActionResultado {
  success: boolean;
  message: string;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function crearOActualizarUsuarioAdmin(
  formData: UsuarioFormData
): Promise<UsuarioActionResultado> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    let userId = formData.id;

    if (userId) {
      const updateData: Record<string, any> = {
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        cedula: formData.cedula,
        tipo_usuario: formData.tipo_usuario,
        es_temporal: formData.es_temporal,
        fecha_expiracion_password: formData.fecha_expiracion_password
          ? new Date(formData.fecha_expiracion_password).toISOString()
          : null,
      };

      if (formData.password && formData.password.trim() !== "") {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: formData.password,
        });
        if (authError) throw authError;
        updateData.requiere_cambio_password = true;
      }

      const { error: profileError } = await supabaseAdmin
        .from("usuarios_perfiles")
        .update(updateData)
        .eq("id", userId);

      if (profileError) throw profileError;

      return { success: true, message: "¡Usuario y controles de vigencia actualizados!" };
    } else {
      if (!formData.password) {
        throw new Error("La contraseña es obligatoria para nuevos usuarios.");
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
      });

      if (authError) throw authError;
      if (!authData.user) {
        throw new Error("No se pudo crear el usuario en Auth.");
      }

      userId = authData.user.id;

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
            requiere_cambio_password: true,
            es_temporal: formData.es_temporal,
            fecha_expiracion_password: formData.fecha_expiracion_password
              ? new Date(formData.fecha_expiracion_password).toISOString()
              : null,
          },
        ]);

      if (profileError) throw profileError;

      return { success: true, message: "¡Usuario registrado exitosamente!" };
    }
  } catch (error: any) {
    console.error("Error en administración de usuarios:", error);
    return { success: false, message: error.message || "Error al procesar la solicitud." };
  }
}