import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function registrarEntradaUsuario(params: {
  usuarioId: string;
  empresaId?: number | string | null;
  sucursalId?: number | string | null;
}) {
  const ahora = new Date().toISOString();
  await supabase.from("auditoria_usuarios_logs").insert({
    usuario_id: params.usuarioId,
    empresa_id: params.empresaId ? Number(params.empresaId) : null,
    sucursal_id: params.sucursalId ? Number(params.sucursalId) : null,
    tipo_evento: "LOGIN",
    tx_nombre: "Inicio de Sesión",
    modulo: "ACCESO",
    accion_sql: "SESSION",
    hora_entrada: ahora,
    creado_en: ahora,
  });
}

export async function registrarSalidaUsuario(params: {
  usuarioId: string;
  empresaId?: number | string | null;
  sucursalId?: number | string | null;
}) {
  const ahora = new Date().toISOString();
  await supabase.from("auditoria_usuarios_logs").insert({
    usuario_id: params.usuarioId,
    empresa_id: params.empresaId ? Number(params.empresaId) : null,
    sucursal_id: params.sucursalId ? Number(params.sucursalId) : null,
    tipo_evento: "LOGOUT",
    tx_nombre: "Cierre de Sesión",
    modulo: "ACCESO",
    accion_sql: "SESSION",
    hora_salida: ahora,
    creado_en: ahora,
  });
}

export async function registrarOperacionAuditoria(params: {
  usuarioId: string;
  empresaId?: number | string | null;
  sucursalId?: number | string | null;
  modulo?: string;
  txNombre: string;
  claseDocumento?: string | null;
  inserciones?: number;
  actualizaciones?: number;
  detalle?: string | null;
}) {
  const ins = Number(params.inserciones || 0);
  const upd = Number(params.actualizaciones || 0);
  await supabase.from("auditoria_usuarios_logs").insert({
    usuario_id: params.usuarioId,
    empresa_id: params.empresaId ? Number(params.empresaId) : null,
    sucursal_id: params.sucursalId ? Number(params.sucursalId) : null,
    tipo_evento: "TX_ACCION",
    modulo: params.modulo || null,
    tx_nombre: params.txNombre,
    clase_documento: params.claseDocumento || null,
    accion_sql: ins > 0 && upd > 0 ? "UPDATE" : ins > 0 ? "INSERT" : "UPDATE",
    cantidad_inserciones: ins,
    cantidad_actualizaciones: upd,
    detalle: params.detalle || null,
    creado_en: new Date().toISOString(),
  });
}