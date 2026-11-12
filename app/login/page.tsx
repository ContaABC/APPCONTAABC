"use client";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Lock, Mail, Building2, MapPin, XCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Estados para el flujo de selección post-credenciales
  const [pasoSeleccion, setPasoSeleccion] = useState(false);
  const [empresasDisponibles, setEmpresasDisponibles] = useState<any[]>([]);
  const [sucursalesDisponibles, setSucursalesDisponibles] = useState<any[]>([]);

  // Selección elegida por el usuario
  const [empresaIdSeleccionada, setEmpresaIdSeleccionada] = useState("");
  const [sucursalIdSeleccionada, setSucursalIdSeleccionada] = useState("");

  const handleValidarCredenciales = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Faltan variables de entorno de Supabase.");

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // 1. Autenticar con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      const userId = authData.user.id;

      // 2. Consultar perfil del usuario
      const { data: perfil } = await supabase
        .from("usuarios_perfiles")
        .select("tipo_usuario")
        .eq("id", userId)
        .single();

      // 3. Consultar las asignaciones del usuario
      const { data: asignaciones, error: asigError } = await supabase
        .from("usuario_asignaciones")
        .select("empresa_id, sucursal_id")
        .eq("usuario_id", userId);

      if (asigError) throw asigError;

      if (!asignaciones || asignaciones.length === 0) {
        if (perfil?.tipo_usuario === 'Administrador') {
          router.push("/");
          router.refresh();
          return;
        } else {
          throw new Error("Su usuario no tiene empresas o sucursales asignadas. Contacte al administrador.");
        }
      }

      // Extraer IDs únicos de empresas y sucursales asignadas
      const empresaIds = Array.from(new Set(asignaciones.map((a: any) => a.empresa_id).filter(Boolean)));
      const sucursalIds = Array.from(new Set(asignaciones.map((a: any) => a.sucursal_id).filter(Boolean)));

      // 4. Consultar los datos reales de las empresas permitidas
      let listaEmpresas: any[] = [];
      if (empresaIds.length > 0) {
        const { data: empData } = await supabase
          .from("empresas")
          .select("id, razon_social, nombre_comercial")
          .in("id", empresaIds)
          .order("razon_social", { ascending: true });
        listaEmpresas = empData || [];
      }

      // 5. Consultar los datos reales de las sucursales permitidas
      let listaSucursales: any[] = [];
      if (sucursalIds.length > 0) {
        const { data: sucData } = await supabase
          .from("sucursales")
          .select("id, nombre, codigo_sucursal, empresa_id")
          .in("id", sucursalIds)
          .eq("estado", "Activa");
        listaSucursales = sucData || [];
      }

      setEmpresasDisponibles(listaEmpresas);
      setSucursalesDisponibles(listaSucursales);

      // REGLA INTELIGENTE: Si solo tiene asignada 1 sola sucursal en total, la autoseleccionamos y entramos directo
      if (listaSucursales.length === 1) {
        const unicaSucursal = listaSucursales[0];
        const unicaEmpresa = listaEmpresas.find((e) => String(e.id) === String(unicaSucursal.empresa_id));

        const nombreEmpresaVal = unicaEmpresa?.razon_social || unicaEmpresa?.nombre_comercial || "Empresa Principal";
        const nombreSucursalVal = unicaSucursal?.nombre || "Sucursal Principal";

        // Guardar IDs y Nombres en localStorage
        localStorage.setItem("empresa_activa", String(unicaSucursal.empresa_id));
        localStorage.setItem("sucursal_activa", String(unicaSucursal.id));
        localStorage.setItem("empresa_activa_nombre", nombreEmpresaVal);
        localStorage.setItem("sucursal_activa_nombre", nombreSucursalVal);

        // Guardar en Cookies HTTP
        document.cookie = `empresa_activa=${unicaSucursal.empresa_id}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `sucursal_activa=${unicaSucursal.id}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `empresa_activa_nombre=${encodeURIComponent(nombreEmpresaVal)}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `sucursal_activa_nombre=${encodeURIComponent(nombreSucursalVal)}; path=/; max-age=86400; SameSite=Lax`;

        router.push("/");
        router.refresh();
        return;
      }

      // Si tiene múltiples opciones, abrimos la fase de selección
      setPasoSeleccion(true);

    } catch (err: any) {
      setError(err.message || "Credenciales incorrectas o error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  // Filtrar sucursales en base a la empresa elegida en el selector
  const sucursalesFiltradasParaSeleccion = sucursalesDisponibles.filter(
    (s) => !empresaIdSeleccionada || String(s.empresa_id) === empresaIdSeleccionada
  );

  const handleEntrarAlSistema = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaIdSeleccionada || !sucursalIdSeleccionada) {
      setError("Debe seleccionar una empresa y una sucursal para continuar.");
      return;
    }

    // Buscar los objetos completos seleccionados para extraer sus nombres reales
    const empresaObj = empresasDisponibles.find((e) => String(e.id) === String(empresaIdSeleccionada));
    const sucursalObj = sucursalesDisponibles.find((s) => String(s.id) === String(sucursalIdSeleccionada));

    const nombreEmpresaVal = empresaObj?.razon_social || empresaObj?.nombre_comercial || "Empresa Principal";
    const nombreSucursalVal = sucursalObj?.nombre || "Sucursal Principal";

    // Guardar contexto activo y nombres en almacenamiento local
    localStorage.setItem("empresa_activa", empresaIdSeleccionada);
    localStorage.setItem("sucursal_activa", sucursalIdSeleccionada);
    localStorage.setItem("empresa_activa_nombre", nombreEmpresaVal);
    localStorage.setItem("sucursal_activa_nombre", nombreSucursalVal);

    // Guardar en cookies HTTP para el servidor
    document.cookie = `empresa_activa=${empresaIdSeleccionada}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `sucursal_activa=${sucursalIdSeleccionada}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `empresa_activa_nombre=${encodeURIComponent(nombreEmpresaVal)}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `sucursal_activa_nombre=${encodeURIComponent(nombreSucursalVal)}; path=/; max-age=86400; SameSite=Lax`;

    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
        
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-blue-600 mb-3">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">ContaABC</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {pasoSeleccion ? "Seleccione el entorno de trabajo" : "Ingresa tus datos para acceder al sistema"}
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl text-xs font-semibold flex items-center gap-2 bg-red-50 text-red-600 border border-red-200">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!pasoSeleccion ? (
          /* FASE 1: Credenciales */
          <form onSubmit={handleValidarCredenciales} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Correo Electrónico</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  placeholder="correo@empresa.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Contraseña</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition shadow-sm mt-4 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Validando acceso..." : "Validar Credenciales"}
            </button>
          </form>
        ) : (
          /* FASE 2: Selección de Empresa y Sucursal */
          <form onSubmit={handleEntrarAlSistema} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Empresa Autorizada</label>
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

    // FILTRAR LAS SUCURSALES DE ESTA EMPRESA ESPECÍFICA
    const sucursalesDeEstaEmpresa = sucursalesDisponibles.filter(
      (s) => String(s.empresa_id) === nuevaEmpresaId
    );

    // REGLA AUTOMÁTICA: Si la empresa seleccionada tiene exactamente 1 sucursal, tómala de inmediato
    if (sucursalesDeEstaEmpresa.length === 1) {
      setSucursalIdSeleccionada(String(sucursalesDeEstaEmpresa[0].id));
    } else {
      setSucursalIdSeleccionada(""); // Si tiene varias, reseteamos para que el usuario elija
    }
  }}
  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 cursor-pointer"
>
  <option value="" className="dark:bg-zinc-900">Seleccione una empresa...</option>
  {empresasDisponibles.map((emp) => (
    <option key={emp.id} value={emp.id} className="dark:bg-zinc-900">
      {emp.razon_social || emp.nombre_comercial}
    </option>
  ))}
</select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Sucursal de Trabajo</label>
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
                    {empresaIdSeleccionada ? "Seleccione una sucursal..." : "Primero seleccione una empresa"}
                  </option>
                  {sucursalesFiltradasParaSeleccion.map((suc) => (
                    <option key={suc.id} value={suc.id} className="dark:bg-zinc-900">
                      {suc.nombre} ({suc.codigo_sucursal})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition shadow-sm mt-4 cursor-pointer"
            >
              Entrar al Sistema
            </button>

            <button
              type="button"
              onClick={() => setPasoSeleccion(false)}
              className="w-full text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 text-center mt-2 underline cursor-pointer"
            >
              ← Volver atrás / Cambiar de cuenta
            </button>
          </form>
        )}

      </div>
    </main>
  );
}