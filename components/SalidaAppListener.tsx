"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function SalidaAppListener() {
  useEffect(() => {
    let enviada = false;

    const handlePageHide = async () => {
      if (enviada || typeof window === "undefined") return;

      const empresaId =
        localStorage.getItem("empresa_activa") ||
        localStorage.getItem("empresa_id");
      const sucursalId =
        localStorage.getItem("sucursal_activa") ||
        localStorage.getItem("sucursal_id");

      // Intentar leer usuario desde sesión en localStorage de Supabase o getSession
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const usuarioId = session?.user?.id;

      if (!usuarioId) return;

      enviada = true;
      const payload = JSON.stringify({
        usuarioId,
        empresaId: empresaId ? Number(empresaId) : null,
        sucursalId: sucursalId ? Number(sucursalId) : null,
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/auditoria/salida", blob);
      } else {
        fetch("/api/auditoria/salida", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return null;
}