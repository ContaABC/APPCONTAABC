"use server";

import { createClient } from "@supabase/supabase-js";

export interface EstadoVigenciaUsuario {
  ok: boolean;
  userId?: string;
  email?: string;
  nombres?: string;
  apellidos?: string;
  esTemporal?: boolean;
  cuentaExpirada?: boolean;
  passwordVencida?: boolean;
  requiereCambioPassword?: boolean;
  fechaExpiracion?: string | null;
  error?: string;
}

export interface CambiarPasswordVencidaPayload {
  userId: string;
  email: string;
  passwordActual: string;
  nuevaPassword: string;
  diasVigencia?: number;
}

export interface CambiarPasswordResultado {
  success: boolean;
  message: string;
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

function getSupabaseAnon() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function consultarEstadoVigenciaUsuario(
  userId: string
): Promise<EstadoVigenciaUsuario> {
  try {
    if (!userId) {
      return { ok: false, error: "Usuario no identificado." };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: perfil, error } = await supabaseAdmin
      .from("usuarios_perfiles")
      .select(
        "id, email, nombres, apellidos, activo, es_temporal, fecha_expiracion_password, requiere_cambio_password"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!perfil) {
      return { ok: false, error: "No se encontró el perfil del usuario." };
    }

    if (perfil.activo === false) {
      return {
        ok: true,
        userId: perfil.id,
        email: perfil.email,
        nombres: perfil.nombres,
        apellidos: perfil.apellidos,
        esTemporal: Boolean(perfil.es_temporal),
        cuentaExpirada: true,
        passwordVencida: false,
        requiereCambioPassword: Boolean(perfil.requiere_cambio_password),
        fechaExpiracion: perfil.fecha_expiracion_password,
      };
    }

    const ahora = new Date();
    const fechaExp = perfil.fecha_expiracion_password
      ? new Date(perfil.fecha_expiracion_password)
      : null;

    const estaVencidaPorFecha =
      fechaExp !== null && !Number.isNaN(fechaExp.getTime()) && fechaExp <= ahora;

    const esTemporal = Boolean(perfil.es_temporal);
    const cuentaExpirada = esTemporal && estaVencidaPorFecha;
    const passwordVencida = !esTemporal && estaVencidaPorFecha;
    const requiereCambioPassword = Boolean(perfil.requiere_cambio_password);

    return {
      ok: true,
      userId: perfil.id,
      email: perfil.email,
      nombres: perfil.nombres,
      apellidos: perfil.apellidos,
      esTemporal,
      cuentaExpirada,
      passwordVencida,
      requiereCambioPassword,
      fechaExpiracion: perfil.fecha_expiracion_password,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Error al consultar el estado de vigencia.";
    return { ok: false, error: msg };
  }
}

export async function cambiarPasswordPorVencimiento(
  payload: CambiarPasswordVencidaPayload
): Promise<CambiarPasswordResultado> {
  try {
    const userId = (payload.userId || "").trim();
    const email = (payload.email || "").trim().toLowerCase();
    const passwordActual = (payload.passwordActual || "").trim();
    const nuevaPassword = (payload.nuevaPassword || "").trim();
    const diasVigencia = Number(payload.diasVigencia) > 0 ? Number(payload.diasVigencia) : 30;

    if (!userId || !email) {
      throw new Error("Sesión de usuario inválida.");
    }
    if (!passwordActual) {
      throw new Error("Debes ingresar tu contraseña actual.");
    }
    if (nuevaPassword.length < 6) {
      throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
    }
    if (passwordActual === nuevaPassword) {
      throw new Error("La nueva contraseña debe ser diferente a la contraseña actual.");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Verificar perfil y confirmar que no sea una cuenta temporal expirada
    const { data: perfil, error: errPerfil } = await supabaseAdmin
      .from("usuarios_perfiles")
      .select("id, activo, es_temporal, fecha_expiracion_password")
      .eq("id", userId)
      .maybeSingle();

    if (errPerfil) throw errPerfil;
    if (!perfil) {
      throw new Error("Perfil de usuario no encontrado.");
    }
    if (perfil.activo === false) {
      throw new Error("Tu usuario está inactivo. Contacta al administrador.");
    }

    const ahora = new Date();
    const fechaExp = perfil.fecha_expiracion_password
      ? new Date(perfil.fecha_expiracion_password)
      : null;
    const vencidaPorFecha =
      fechaExp !== null && !Number.isNaN(fechaExp.getTime()) && fechaExp <= ahora;

    if (Boolean(perfil.es_temporal) && vencidaPorFecha) {
      throw new Error(
        "Tu cuenta temporal ha expirado. Contacta al administrador para renovar la vigencia."
      );
    }

    // 2. Validar contraseña actual iniciando sesión con cliente anónimo temporal
    const supabaseAnon = getSupabaseAnon();
    const { error: errLogin } = await supabaseAnon.auth.signInWithPassword({
      email,
      password: passwordActual,
    });

    if (errLogin) {
      throw new Error("La contraseña actual ingresada es incorrecta.");
    }

    // 3. Actualizar contraseña en Supabase Auth
    const { error: errUpdateAuth } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: nuevaPassword,
      });

    if (errUpdateAuth) {
      throw errUpdateAuth;
    }

    // 4. Calcular nueva fecha de vencimiento y limpiar requiere_cambio_password
    const nuevaFechaVencimiento = new Date(
      Date.now() + diasVigencia * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: errUpdatePerfil } = await supabaseAdmin
      .from("usuarios_perfiles")
      .update({
        requiere_cambio_password: false,
        fecha_expiracion_password: nuevaFechaVencimiento,
      })
      .eq("id", userId);

    if (errUpdatePerfil) {
      throw errUpdatePerfil;
    }

    return {
      success: true,
      message: `¡Contraseña actualizada! Nueva vigencia hasta ${new Date(
        nuevaFechaVencimiento
      ).toLocaleDateString()}.`,
    };
  } catch (err: unknown) {
    console.error("Error en cambio de contraseña por vencimiento:", err);
    const msg =
      err instanceof Error
        ? err.message
        : "No se pudo actualizar la contraseña.";
    return { success: false, message: msg };
  }
}