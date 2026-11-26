"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Lock, Mail, Building2, MapPin, XCircle, RefreshCw } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [requiereSeleccion, setRequiereSeleccion] = useState(false);
  const [empresasDisponibles, setEmpresasDisponibles] = useState<any[]>([]);
  const [sucursalesDisponibles, setSucursalesDisponibles] = useState<any[]>([]);

  const [empresaIdSeleccionada, setEmpresaIdSeleccionada] = useState("");
  const [sucursalIdSeleccionada, setSucursalIdSeleccionada] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const handleLoginUnificado = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Autenticar credenciales en Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) throw authError;
      const userId = authData.user.id;

      // 2. Consultar perfil y estado de vigencia del usuario
      const { data: perfil, error: perfilError } = await supabase
        .from("usuarios_perfiles")
        .select(
          "tipo_usuario, empresa_activa, activo, es_temporal, fecha_expiracion_password, requiere_cambio_password"
        )
        .eq("id", userId)
        .single();

      if (perfilError) throw perfilError;

      if (perfil?.activo === false) {
        await supabase.auth.signOut();
        throw new Error(
          "Su usuario se encuentra inactivo. Contacte al administrador."
        );
      }

      const ahora = new Date();
      const fechaExp = perfil?.fecha_expiracion_password
        ? new Date(perfil.fecha_expiracion_password)
        : null;
      const estaVencidaPorFecha =
        fechaExp !== null &&
        !Number.isNaN(fechaExp.getTime()) &&
        fechaExp <= ahora;

      const esTemporal = Boolean(perfil?.es_temporal);
      const requiereCambio = Boolean(perfil?.requiere_cambio_password);

      // Si es usuario temporal y ya expiró la fecha límite -> bloquear acceso
      if (esTemporal && estaVencidaPorFecha) {
        await supabase.auth.signOut();
        throw new Error(
          `Su acceso temporal venció el ${fechaExp?.toLocaleDateString()}. Contacte al administrador para renovar su vigencia.`
        );
      }

      // Si es usuario permanente con contraseña vencida o requiere cambio -> ir a /usuarios/cambiar-password
      if ((!esTemporal && estaVencidaPorFecha) || requiereCambio) {
        router.replace("/usuarios/cambiar-password");
        router.refresh();
        return;
      }

      // 3. Consultar permisos desde la tabla usuario_permisos_tx
      const { data: permisosTx, error: permError } = await supabase
        .from("usuario_permisos_tx")
        .select("empresa_id, sucursal_id")
        .eq("usuario_id", userId);

      if (permError) throw permError;

      if (!permisosTx || permisosTx.length === 0) {
        if (perfil?.tipo_usuario === "Administrador") {
          const { data: allEmp } = await supabase
            .from("empresas")
            .select("id, razon_social, nombre_comercial")
            .eq("estado", "Activa")
            .order("razon_social");
          const { data: allSuc } = await supabase
            .from("sucursales")
            .select("id, nombre, empresa_id")
            .eq("estado", "Activa");

          if (allEmp && allEmp.length === 1 && allSuc && allSuc.length === 1) {
            await finalizarIngreso(
              String(allEmp[0].id),
              String(allSuc[0].id),
              allEmp,
              allSuc,
              userId
            );
            return;
          }
          setEmpresasDisponibles(allEmp || []);
          setSucursalesDisponibles(allSuc || []);
          setRequiereSeleccion(true);
          setLoading(false);
          return;
        }
        throw new Error(
          "Su usuario no tiene empresas o permisos asignados en el sistema."
        );
      }

      // 4. Extraer IDs únicos permitidos
      const empresaIds = Array.from(
        new Set(permisosTx.map((p: any) => p.empresa_id).filter(Boolean))
      );

      const sucursalIdsPermitidas = Array.from(
        new Set(
          permisosTx
            .map((p: any) => p.sucursal_id)
            .filter(
              (id: any) => id !== null && id !== undefined && id !== 0
            )
        )
      );

      // 5. Consultar empresas permitidas
      let listaEmpresas: any[] = [];
      if (empresaIds.length > 0) {
        const { data: empData } = await supabase
          .from("empresas")
          .select("id, razon_social, nombre_comercial")
          .in("id", empresaIds)
          .eq("estado", "Activa")
          .order("razon_social", { ascending: true });
        listaEmpresas = empData || [];
      }

      // 6. Consultar SUCURSALES
      let listaSucursales: any[] = [];
      if (sucursalIdsPermitidas.length > 0) {
        const { data: sucEspecificas } = await supabase
          .from("sucursales")
          .select("id, nombre, empresa_id")
          .in("id", sucursalIdsPermitidas)
          .eq("estado", "Activa");

        if (sucEspecificas) {
          listaSucursales.push(...sucEspecificas);
        }
      }

      const empresasGlobalesIds = permisosTx
        .filter((p: any) => p.sucursal_id === null)
        .map((p: any) => p.empresa_id);
      if (empresasGlobalesIds.length > 0) {
        const { data: sucGlobalData } = await supabase
          .from("sucursales")
          .select("id, nombre, empresa_id")
          .in("empresa_id", empresasGlobalesIds)
          .eq("estado", "Activa");

        if (sucGlobalData) {
          const idsExistentes = new Set(listaSucursales.map((s) => s.id));
          sucGlobalData.forEach((s) => {
            if (!idsExistentes.has(s.id)) {
              listaSucursales.push(s);
            }
          });
        }
      }

      setEmpresasDisponibles(listaEmpresas);
      setSucursalesDisponibles(listaSucursales);

      if (listaEmpresas.length === 1 && listaSucursales.length === 1) {
        await finalizarIngreso(
          String(listaEmpresas[0].id),
          String(listaSucursales[0].id),
          listaEmpresas,
          listaSucursales,
          userId
        );
        return;
      }

      const empresaActivaBD = perfil?.empresa_activa;
      const empresaValidaEnPermisos = listaEmpresas.find(
        (e) => String(e.id) === String(empresaActivaBD)
      );

      if (empresaValidaEnPermisos) {
        setEmpresaIdSeleccionada(String(empresaActivaBD));
        const sucursalesDeEstaEmpresa = listaSucursales.filter(
          (s) => String(s.empresa_id) === String(empresaActivaBD)
        );
        if (sucursalesDeEstaEmpresa.length === 1) {
          setSucursalIdSeleccionada(String(sucursalesDeEstaEmpresa[0].id));
        }
      }

      setRequiereSeleccion(true);
    } catch (err: any) {
      setError(
        err.message || "Credenciales incorrectas o error al iniciar sesión."
      );
    } finally {
      setLoading(false);
    }
  };

  const finalizarIngreso = async (
    empId: string,
    sucId: string,
    empList: any[],
    sucList: any[],
    userId: string
  ) => {
    try {
      const { error: updateError } = await supabase
        .from("usuarios_perfiles")
        .update({ empresa_activa: empId })
        .eq("id", userId);

      if (updateError) {
        console.error("Error al actualizar empresa activa en BD:", updateError);
      }
    } catch (dbErr) {
      console.error("Excepción al actualizar empresa activa:", dbErr);
    }

    const empresaObj = empList.find((e) => String(e.id) === String(empId));
    const sucursalObj = sucList.find((s) => String(s.id) === String(sucId));

    const nombreEmpresaVal =
      empresaObj?.razon_social ||
      empresaObj?.nombre_comercial ||
      "Empresa Principal";
    const nombreSucursalVal = sucursalObj?.nombre || "Sucursal Principal";

    localStorage.setItem("empresa_activa", empId);
    localStorage.setItem("sucursal_activa", sucId);
    localStorage.setItem("empresa_activa_nombre", nombreEmpresaVal);
    localStorage.setItem("sucursal_activa_nombre", nombreSucursalVal);

    document.cookie = `empresa_activa=${empId}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `sucursal_activa=${sucId}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `empresa_activa_nombre=${encodeURIComponent(
      nombreEmpresaVal
    )}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `sucursal_activa_nombre=${encodeURIComponent(
      nombreSucursalVal
    )}; path=/; max-age=86400; SameSite=Lax`;

    router.push("/");
    router.refresh();
  };

  const sucursalesFiltradas = sucursalesDisponibles.filter(
    (s) => !empresaIdSeleccionada || String(s.empresa_id) === empresaIdSeleccionada
  );

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-blue-600 mb-3">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            ContaABC
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {requiereSeleccion
              ? "Seleccione su entorno de trabajo"
              : "Ingresa tus datos para acceder al sistema"}
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl text-xs font-semibold flex items-center gap-2 bg-red-50 text-red-600 border border-red-200">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              requiereSeleccion &&
              (!empresaIdSeleccionada || !sucursalIdSeleccionada)
            ) {
              setError("Debe seleccionar una empresa y una sucursal.");
              return;
            }
            if (requiereSeleccion) {
              setLoading(true);
              const {
                data: { user },
              } = await supabase.auth.getUser();
              await finalizarIngreso(
                empresaIdSeleccionada,
                sucursalIdSeleccionada,
                empresasDisponibles,
                sucursalesDisponibles,
                user?.id || ""
              );
              setLoading(false);
            } else {
              handleLoginUnificado(e);
            }
          }}
          className="space-y-4 text-sm"
        >
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                disabled={requiereSeleccion}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 disabled:opacity-50"
                placeholder="correo@empresa.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                disabled={requiereSeleccion}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>
          </div>

          {requiereSeleccion && (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">
                  Empresa Autorizada
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                    <Building2 className="w-4 h-4" />
                  </span>
                  <select
                    required
                    value={empresaIdSeleccionada}
                    onChange={(e) => {
                      const nuevaEmpresaId = e.target.value;
                      setEmpresaIdSeleccionada(nuevaEmpresaId);
                      const sucursalesDeEstaEmpresa = sucursalesDisponibles.filter(
                        (s) => String(s.empresa_id) === nuevaEmpresaId
                      );
                      if (sucursalesDeEstaEmpresa.length === 1) {
                        setSucursalIdSeleccionada(
                          String(sucursalesDeEstaEmpresa[0].id)
                        );
                      } else {
                        setSucursalIdSeleccionada("");
                      }
                    }}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="" className="dark:bg-zinc-900">
                      Seleccione una empresa...
                    </option>
                    {empresasDisponibles.map((emp) => (
                      <option
                        key={emp.id}
                        value={emp.id}
                        className="dark:bg-zinc-900"
                      >
                        {emp.razon_social || emp.nombre_comercial}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">
                  Sucursal de Trabajo
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <select
                    required
                    disabled={!empresaIdSeleccionada}
                    value={sucursalIdSeleccionada}
                    onChange={(e) => setSucursalIdSeleccionada(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="" className="dark:bg-zinc-900">
                      {empresaIdSeleccionada
                        ? "Seleccione una sucursal..."
                        : "Primero seleccione una empresa"}
                    </option>
                    {sucursalesFiltradas.map((suc) => (
                      <option
                        key={suc.id}
                        value={suc.id}
                        className="dark:bg-zinc-900"
                      >
                        {suc.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition shadow-sm mt-4 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            {loading
              ? "Verificando acceso..."
              : requiereSeleccion
              ? "Entrar al Sistema"
              : "Validar y Continuar"}
          </button>

          {requiereSeleccion && (
            <button
              type="button"
              onClick={() => {
                setRequiereSeleccion(false);
                setPassword("");
              }}
              className="w-full text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 text-center mt-2 underline cursor-pointer"
            >
              ← Volver a ingresar credenciales
            </button>
          )}
        </form>
      </div>
    </main>
  );
}