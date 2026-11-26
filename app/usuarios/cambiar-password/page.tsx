"use client";

import React, {
  useState,
  useEffect,
  useRef,
  FormEvent,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LogOut,
  ShieldAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  consultarEstadoVigenciaUsuario,
  cambiarPasswordPorVencimiento,
  type EstadoVigenciaUsuario,
} from "./actions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CambiarPasswordVencidaPage() {
  const router = useRouter();

  const [cargandoEstado, setCargandoEstado] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [estadoUsuario, setEstadoUsuario] =
    useState<EstadoVigenciaUsuario | null>(null);

  const [passwordActual, setPasswordActual] = useState<string>("");
  const [nuevaPassword, setNuevaPassword] = useState<string>("");
  const [confirmarPassword, setConfirmarPassword] = useState<string>("");

  const [mostrarActual, setMostrarActual] = useState<boolean>(false);
  const [mostrarNueva, setMostrarNueva] = useState<boolean>(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState<boolean>(false);

  const [mensaje, setMensaje] = useState<{
    texto: string;
    tipo: "success" | "error" | "";
  }>({ texto: "", tipo: "" });

  const cargandoRef = useRef<boolean>(true);

  useEffect(() => {
    cargandoRef.current = cargandoEstado;
  }, [cargandoEstado]);

  useEffect(() => {
    let activo = true;

    async function verificarYConsultar(userId: string, userEmail: string) {
      const res = await consultarEstadoVigenciaUsuario(userId);
      if (!activo) return;

      if (!res.ok) {
        setMensaje({
          texto: res.error || "No se pudo verificar el estado de tu cuenta.",
          tipo: "error",
        });
        setEstadoUsuario({
          ok: false,
          userId,
          email: userEmail,
        });
      } else {
        setEstadoUsuario({
          ...res,
          email: res.email || userEmail,
        });
      }
      cargandoRef.current = false;
      setCargandoEstado(false);
    }

    async function cargarEstado() {
      cargandoRef.current = true;
      setCargandoEstado(true);

      try {
        for (let intento = 0; intento < 6; intento++) {
          if (!activo) return;

          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            await verificarYConsultar(session.user.id, session.user.email || "");
            return;
          }

          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            await verificarYConsultar(user.id, user.email || "");
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (activo && cargandoRef.current) {
          cargandoRef.current = false;
          setCargandoEstado(false);
          router.replace("/login");
        }
      } catch {
        if (activo) {
          cargandoRef.current = false;
          setCargandoEstado(false);
          router.replace("/login");
        }
      }
    }

    cargarEstado();

    return () => {
      activo = false;
    };
  }, [router]);

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensaje({ texto: "", tipo: "" });

    if (!estadoUsuario?.userId || !estadoUsuario?.email) {
      setMensaje({
        texto: "No se encontró una sesión válida para actualizar la clave.",
        tipo: "error",
      });
      return;
    }

    if (nuevaPassword.length < 6) {
      setMensaje({
        texto: "La nueva contraseña debe tener al menos 6 caracteres.",
        tipo: "error",
      });
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setMensaje({
        texto: "La nueva contraseña y su confirmación no coinciden.",
        tipo: "error",
      });
      return;
    }

    setGuardando(true);
    try {
      const res = await cambiarPasswordPorVencimiento({
        userId: estadoUsuario.userId,
        email: estadoUsuario.email,
        passwordActual,
        nuevaPassword,
        diasVigencia: 30,
      });

      if (!res.success) {
        setMensaje({ texto: res.message, tipo: "error" });
        return;
      }

      setMensaje({ texto: res.message, tipo: "success" });
      setPasswordActual("");
      setNuevaPassword("");
      setConfirmarPassword("");

      setTimeout(async () => {
        await supabase.auth.signOut();
        router.replace("/login");
        router.refresh();
      }, 1000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error al actualizar la contraseña.";
      setMensaje({ texto: msg, tipo: "error" });
    } finally {
      setGuardando(false);
    }
  };

  if (cargandoEstado) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6 text-xs text-zinc-500">
        Verificando estado de acceso...
      </main>
    );
  }

  const cuentaBloqueadaPorExpiracion = Boolean(estadoUsuario?.cuentaExpirada);
  const esPorVencimientoFecha = Boolean(estadoUsuario?.passwordVencida);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              {cuentaBloqueadaPorExpiracion ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <KeyRound className="w-6 h-6" />
              )}
            </div>
            <div>
              <h1 className="text-base font-bold">
                {cuentaBloqueadaPorExpiracion
                  ? "Acceso Temporal Expirado"
                  : esPorVencimientoFecha
                  ? "Contraseña Vencida"
                  : "Cambio de Contraseña Obligatorio"}
              </h1>
              <p className="text-xs text-zinc-500 truncate max-w-[240px]">
                {estadoUsuario?.email || "Usuario autenticado"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCerrarSesion}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>

        {estadoUsuario && (
          <div
            className={`p-3 rounded-xl text-xs border flex items-start gap-2.5 ${
              cuentaBloqueadaPorExpiracion
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              {cuentaBloqueadaPorExpiracion ? (
                <p className="font-semibold">
                  Tu acceso temporal ha vencido. Comunícate con el
                  administrador para renovar tu cuenta.
                </p>
              ) : esPorVencimientoFecha ? (
                <p className="font-semibold">
                  Tu contraseña venció
                  {estadoUsuario.fechaExpiracion
                    ? ` el ${new Date(
                        estadoUsuario.fechaExpiracion
                      ).toLocaleDateString()}`
                    : ""}
                  . Crea una nueva contraseña para continuar.
                </p>
              ) : (
                <p className="font-semibold">
                  Por seguridad, debes establecer una nueva contraseña en tu
                  primer ingreso para continuar.
                </p>
              )}
            </div>
          </div>
        )}

        {mensaje.texto && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              mensaje.tipo === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {mensaje.tipo === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{mensaje.texto}</span>
          </div>
        )}

        {!cuentaBloqueadaPorExpiracion && (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Contraseña Actual
              </label>
              <div className="relative">
                <input
                  type={mostrarActual ? "text" : "password"}
                  required
                  value={passwordActual}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setPasswordActual(e.target.value)
                  }
                  className="w-full px-3 py-2 pr-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                  placeholder="Ingresa tu contraseña actual"
                />
                <button
                  type="button"
                  onClick={() => setMostrarActual((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {mostrarActual ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={mostrarNueva ? "text" : "password"}
                  required
                  minLength={6}
                  value={nuevaPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setNuevaPassword(e.target.value)
                  }
                  className="w-full px-3 py-2 pr-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setMostrarNueva((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {mostrarNueva ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={mostrarConfirmar ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmarPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setConfirmarPassword(e.target.value)
                  }
                  className="w-full px-3 py-2 pr-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                  placeholder="Repite la nueva contraseña"
                />
                <button
                  type="button"
                  onClick={() => setMostrarConfirmar((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {mostrarConfirmar ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition shadow-sm cursor-pointer disabled:opacity-50 mt-2"
            >
              {guardando
                ? "Actualizando contraseña..."
                : "Guardar Nueva Contraseña"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}