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
  empresa_id_inicial?: string | number | null;
  sucursal_id_inicial?: string | number | null;
}

export interface UsuarioPerfilItem {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  tipo_usuario: string;
  activo: boolean;
  es_temporal: boolean;
  fecha_expiracion_password?: string | null;
  created_at?: string;
}

export interface UsuarioActionResultado {
  success: boolean;
  message: string;
  userId?: string;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parsearFechaExpiracion(fechaStr?: string): string | null {
  if (!fechaStr || fechaStr.trim() === "") return null;
  const fecha = new Date(fechaStr.trim());
  if (Number.isNaN(fecha.getTime())) {
    throw new Error("La fecha de expiración no tiene un formato válido.");
  }
  return fecha.toISOString();
}

export async function obtenerUsuariosAdmin(
  usuarioActualId?: string | null
): Promise<{
  success: boolean;
  usuarios: UsuarioPerfilItem[];
  empresasAdminIds: string[];
  error?: string;
}> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    let idsEmpresasAdmin: string[] = [];

    if (usuarioActualId) {
      const { data: permisosAdmin, error: errPermisosAdmin } =
        await supabaseAdmin
          .from("usuario_permisos_tx")
          .select("empresa_id")
          .eq("usuario_id", usuarioActualId);

      if (errPermisosAdmin) throw errPermisosAdmin;

      idsEmpresasAdmin = Array.from(
        new Set(
          (permisosAdmin || [])
            .map((p: { empresa_id?: string | number | null }) =>
              p.empresa_id != null ? String(p.empresa_id).trim() : ""
            )
            .filter(Boolean)
        )
      );
    }

    if (idsEmpresasAdmin.length > 0) {
      const { data: permisosUsuariosEmpresa, error: errPermisosUsuarios } =
        await supabaseAdmin
          .from("usuario_permisos_tx")
          .select("usuario_id")
          .in("empresa_id", idsEmpresasAdmin);

      if (errPermisosUsuarios) throw errPermisosUsuarios;

      const idsUsuariosPermitidos = Array.from(
        new Set(
          [
            ...(permisosUsuariosEmpresa || []).map(
              (p: { usuario_id?: string | null }) =>
                p.usuario_id ? String(p.usuario_id).trim() : ""
            ),
            ...(usuarioActualId ? [String(usuarioActualId).trim()] : []),
          ].filter(Boolean)
        )
      );

      if (idsUsuariosPermitidos.length === 0) {
        return {
          success: true,
          usuarios: [],
          empresasAdminIds: idsEmpresasAdmin,
        };
      }

      const { data, error } = await supabaseAdmin
        .from("usuarios_perfiles")
        .select("*")
        .in("id", idsUsuariosPermitidos)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return {
        success: true,
        usuarios: (data || []) as UsuarioPerfilItem[],
        empresasAdminIds: idsEmpresasAdmin,
      };
    }

    const { data, error } = await supabaseAdmin
      .from("usuarios_perfiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return {
      success: true,
      usuarios: (data || []) as UsuarioPerfilItem[],
      empresasAdminIds: [],
    };
  } catch (error: unknown) {
    console.error("Error obteniendo usuarios:", error);
    const msg =
      error instanceof Error ? error.message : "Error al cargar los usuarios.";
    return {
      success: false,
      usuarios: [],
      empresasAdminIds: [],
      error: msg,
    };
  }
}

export async function crearOActualizarUsuarioAdmin(
  formData: UsuarioFormData
): Promise<UsuarioActionResultado> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const nombres = (formData.nombres || "").trim();
    const apellidos = (formData.apellidos || "").trim();
    const cedula = (formData.cedula || "").trim();
    const email = (formData.email || "").trim().toLowerCase();
    const tipoUsuario = (formData.tipo_usuario || "").trim();
    const password = formData.password ? formData.password.trim() : "";

    if (!nombres || !apellidos || !cedula || !email || !tipoUsuario) {
      throw new Error(
        "Nombres, apellidos, cédula, correo y tipo de usuario son obligatorios."
      );
    }

    const fechaExpiracionIso = parsearFechaExpiracion(
      formData.fecha_expiracion_password
    );

    let userId = formData.id?.trim();

    if (userId) {
      const authUpdatePayload: {
        email?: string;
        password?: string;
        user_metadata?: Record<string, unknown>;
      } = {
        email,
        user_metadata: {
          nombres,
          apellidos,
          cedula,
          tipo_usuario: tipoUsuario,
        },
      };

      if (password !== "") {
        if (password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres.");
        }
        authUpdatePayload.password = password;
      }

      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(
          userId,
          authUpdatePayload
        );
      if (authError) throw authError;

      const updateData: Record<string, unknown> = {
        nombres,
        apellidos,
        cedula,
        email,
        tipo_usuario: tipoUsuario,
        es_temporal: Boolean(formData.es_temporal),
        fecha_expiracion_password: fechaExpiracionIso,
      };

      if (password !== "") {
        updateData.requiere_cambio_password = true;
      }

      const { error: profileError } = await supabaseAdmin
        .from("usuarios_perfiles")
        .update(updateData)
        .eq("id", userId);

      if (profileError) throw profileError;

      return {
        success: true,
        message: "¡Usuario y controles de vigencia actualizados!",
        userId,
      };
    } else {
      if (!password) {
        throw new Error("La contraseña es obligatoria para nuevos usuarios.");
      }
      if (password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
      }

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            nombres,
            apellidos,
            cedula,
            tipo_usuario: tipoUsuario,
          },
        });

      if (authError) throw authError;
      if (!authData.user) {
        throw new Error("No se pudo crear el usuario en Auth.");
      }

      userId = authData.user.id;

      const { error: profileError } = await supabaseAdmin
        .from("usuarios_perfiles")
        .upsert(
          [
            {
              id: userId,
              nombres,
              apellidos,
              cedula,
              email,
              tipo_usuario: tipoUsuario,
              activo: true,
              requiere_cambio_password: true,
              es_temporal: Boolean(formData.es_temporal),
              fecha_expiracion_password: fechaExpiracionIso,
            },
          ],
          { onConflict: "id" }
        );

      if (profileError) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch {
          // Ignorar error de limpieza
        }
        throw profileError;
      }

      const empIdNum = Number(formData.empresa_id_inicial);
      if (!Number.isNaN(empIdNum) && empIdNum > 0) {
        let sucIdNum: number | null =
          formData.sucursal_id_inicial &&
          !Number.isNaN(Number(formData.sucursal_id_inicial))
            ? Number(formData.sucursal_id_inicial)
            : null;

        if (!sucIdNum) {
          const { data: sucursalesEmp } = await supabaseAdmin
            .from("sucursales")
            .select("id")
            .eq("empresa_id", empIdNum)
            .order("id", { ascending: true })
            .limit(1);

          if (sucursalesEmp && sucursalesEmp.length > 0) {
            sucIdNum = Number(sucursalesEmp[0].id);
          }
        }

        const { error: permisoError } = await supabaseAdmin
          .from("usuario_permisos_tx")
          .insert([
            {
              usuario_id: userId,
              empresa_id: empIdNum,
              sucursal_id: sucIdNum,
            },
          ]);

        if (permisoError) {
          console.error(
            "Error asignando permiso inicial en usuario_permisos_tx:",
            permisoError
          );
        }
      }

      return {
        success: true,
        message: "¡Usuario registrado exitosamente!",
        userId,
      };
    }
  } catch (error: unknown) {
    console.error("Error en administración de usuarios:", error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "Error al procesar la solicitud.";
    return {
      success: false,
      message: msg,
    };
  }
}