"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Link2, PlusCircle, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export default function AsignacionesPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  // Formulario de asignación
  const [form, setForm] = useState({
    usuario_id: "",
    empresa_id: "",
    sucursal_id: "",
    rol: "Acceso Estándar",
  });

  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    setCargandoDatos(true);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // 1. Cargar usuarios
      const { data: usuariosData } = await supabase
        .from("usuarios_perfiles")
        .select("id, nombres, apellidos, cedula");

      if (usuariosData) setUsuarios(usuariosData);

      // 2. Cargar asignaciones existentes
      const { data: asignacionesData } = await supabase
        .from("usuario_asignaciones")
        .select(`
          id,
          rol,
          empresa_id,
          sucursal_id,
          usuarios_perfiles (nombres, apellidos, cedula)
        `)
        .order("created_at", { ascending: false });

      if (asignacionesData) setAsignaciones(asignacionesData);
    }

    setCargandoDatos(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje({ texto: "", tipo: "" });

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Faltan variables de entorno de Supabase.");

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { error } = await supabase.from("usuario_asignaciones").insert([
        {
          usuario_id: form.usuario_id,
          empresa_id: form.empresa_id,
          sucursal_id: form.sucursal_id ? form.sucursal_id : null,
          rol: form.rol,
        },
      ]);

      if (error) throw error;

      setMensaje({ texto: "¡Empresa y sucursal asignadas exitosamente!", tipo: "success" });
      setForm({ usuario_id: "", empresa_id: "", sucursal_id: "", rol: "Acceso Estándar" });
      cargarDatosIniciales();
    } catch (error: any) {
      setMensaje({ texto: error.message || "Error al realizar la asignación.", tipo: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        <Link href="/usuarios" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Volver a Gestión de Usuarios
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Asignación de Empresas y Sucursales</h1>
              <p className="text-sm text-zinc-500">Relaciona los permisos de acceso corporativo por usuario</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Formulario de Asignación */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-600" /> Nueva Asignación
            </h2>

            {mensaje.texto && (
              <div className={`p-3 mb-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                mensaje.tipo === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {mensaje.tipo === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{mensaje.texto}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Seleccionar Usuario</label>
                <select 
                  required
                  value={form.usuario_id}
                  onChange={(e) => setForm({...form, usuario_id: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                >
                  <option value="" className="dark:bg-zinc-900">Seleccione un usuario...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id} className="dark:bg-zinc-900">
                      {u.nombres} {u.apellidos} (CC: {u.cedula})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">ID de Empresa (UUID)</label>
                <input 
                  type="text" 
                  required
                  value={form.empresa_id}
                  onChange={(e) => setForm({...form, empresa_id: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                  placeholder="ID de la empresa en tu base de datos"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">ID de Sucursal (Opcional)</label>
                <input 
                  type="text" 
                  value={form.sucursal_id}
                  onChange={(e) => setForm({...form, sucursal_id: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                  placeholder="Dejar en blanco si aplica a toda la empresa"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Rol en esta Empresa</label>
                <input 
                  type="text" 
                  required
                  value={form.rol}
                  onChange={(e) => setForm({...form, rol: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                  placeholder="Ej. Contador, Revisor Fiscal, Auxiliar"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold transition shadow-sm mt-2 disabled:opacity-50"
              >
                {loading ? "Asignando..." : "Guardar Asignación"}
              </button>
            </form>
          </div>

          {/* Listado de Asignaciones Existentes */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-600" /> Permisos y Accesos Asignados
            </h2>

            {cargandoDatos ? (
              <p className="text-sm text-zinc-400 py-4 text-center">Cargando asignaciones...</p>
            ) : asignaciones.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">No hay empresas asignadas a ningún usuario todavía.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs uppercase">
                      <th className="pb-3 font-semibold">Usuario</th>
                      <th className="pb-3 font-semibold">Empresa ID</th>
                      <th className="pb-3 font-semibold">Sucursal ID</th>
                      <th className="pb-3 font-semibold">Rol Asignado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {asignaciones.map((asig) => (
                      <tr key={asig.id}>
                        <td className="py-3 font-medium">
                          {asig.usuarios_perfiles?.nombres} {asig.usuarios_perfiles?.apellidos}
                          <span className="block text-xs text-zinc-400">CC: {asig.usuarios_perfiles?.cedula}</span>
                        </td>
                        <td className="py-3 text-xs font-mono text-zinc-500">{asig.empresa_id}</td>
                        <td className="py-3 text-xs font-mono text-zinc-500">
                          {asig.sucursal_id ? asig.sucursal_id : <span className="text-emerald-600 font-sans font-semibold">Todas (Empresa completa)</span>}
                        </td>
                        <td className="py-3">
                          <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg text-xs font-semibold">
                            {asig.rol}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </main>
  );
}