import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { usuarioId, empresaId, sucursalId } = body || {};

    if (!usuarioId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const ahora = new Date().toISOString();

    await supabase.from("auditoria_usuarios_logs").insert({
      usuario_id: usuarioId,
      empresa_id: empresaId ? Number(empresaId) : null,
      sucursal_id: sucursalId ? Number(sucursalId) : null,
      tipo_evento: "LOGOUT",
      tx_nombre: "Cierre de Página / App",
      modulo: "ACCESO",
      accion_sql: "SESSION",
      hora_salida: ahora,
      creado_en: ahora,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}