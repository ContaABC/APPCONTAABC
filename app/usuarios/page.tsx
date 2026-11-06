"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Users, UserPlus, Shield, CheckCircle2, XCircle, Trash2, Power } from "lucide-react";
import { createClient } from "@supabase/supabase-js"; 

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(true);
  
  const [formData, setFormData] = useState({
    nombres: "",
    apellidos: "",
    cedula: "",
    email: "",
    password: "",
    tipo_usuario: "Operador",
  });

  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    setCargandoLista(true);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase
        .from("usuarios_perfiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setUsuarios(data);
      }
    }
    setCargandoLista(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje({ texto: "", tipo: "" });

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Faltan variables de entorno.");

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // 1. Crear el usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario.");

      // 2. Insertar perfil
      const { error: profileError } = await supabase.from("usuarios_perfiles").insert([
        {
          id: authData.user.id,
          nombres: formData.nombres,
          apellidos: formData.apellidos,
          cedula: formData.cedula,
          email: formData.email,
          tipo_usuario: formData.tipo_usuario,
          activo: true,
        },
      ]);

      if (profileError) throw profileError;

      setMensaje({ texto: "¡Usuario registrado exitosamente!", tipo: "success" });
      // Limpiamos totalmente el formulario, incluyendo correo y contraseña
      setFormData({ nombres: "", apellidos: "", cedula: "", email: "", password: "", tipo_usuario: "Operador" });
      cargarUsuarios();
    } catch (error: any) {
      setMensaje({ texto: error.message || "Error al registrar el usuario.", tipo: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEstado = async (id: string, estadoActual: boolean) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase
      .from("usuarios_perfiles")
      .update({ activo: !estadoActual })
      .eq("id", id);

    if (!error) cargarUsuarios();
  };

  const handleEliminarUsuario = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar este perfil de usuario?")) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from("usuarios_perfiles").delete().eq("id", id);

    if (!error) {
      cargarUsuarios();
    } else {
      alert("Error al eliminar el usuario.");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Volver al Menú Principal
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Gestión de Usuarios y Accesos</h1>
              <p className="text-sm text-zinc-500">Control de perfiles, estados y credenciales</p>
            </div>
          </div>
          <Link
            href="/usuarios/asignaciones"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm flex items-center gap-2"
          >
            <span>Ir a Asignaciones de Empresas</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Formulario */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" /> Nuevo Usuario
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
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Nombres</label>
                <input 
                  type="text" 
                  required
                  value={formData.nombres}
                  onChange={(e) => setFormData({...formData, nombres: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  placeholder="Ej. Juan Carlos"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Apellidos</label>
                <input 
                  type="text" 
                  required
                  value={formData.apellidos}
                  onChange={(e) => setFormData({...formData, apellidos: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  placeholder="Ej. Pérez Gómez"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Cédula</label>
                <input 
                  type="text" 
                  required
                  value={formData.cedula}
                  onChange={(e) => setFormData({...formData, cedula: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  placeholder="Número de identificación"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  placeholder="correo@empresa.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Contraseña</label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Tipo de Usuario</label>
                <select 
                  value={formData.tipo_usuario}
                  onChange={(e) => setFormData({...formData, tipo_usuario: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                >
                  <option value="Operador" className="dark:bg-zinc-900">Operador</option>
                  <option value="Administrador" className="dark:bg-zinc-900">Administrador</option>
                  <option value="Auditor" className="dark:bg-zinc-900">Auditor</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold transition shadow-sm mt-2 disabled:opacity-50"
              >
                {loading ? "Registrando..." : "Guardar Usuario"}
              </button>
            </form>
          </div>

          {/* Listado de Usuarios */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" /> Usuarios Registrados
            </h2>

            {cargandoLista ? (
              <p className="text-sm text-zinc-400 py-4 text-center">Cargando usuarios...</p>
            ) : usuarios.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">No hay usuarios registrados todavía.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs uppercase">
                      <th className="pb-3 font-semibold">Nombre / Cédula</th>
                      <th className="pb-3 font-semibold">Correo</th>
                      <th className="pb-3 font-semibold">Tipo</th>
                      <th className="pb-3 font-semibold">Estado</th>
                      <th className="pb-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {usuarios.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3">
                          <p className="font-medium">{u.nombres} {u.apellidos}</p>
                          <span className="text-xs text-zinc-400">CC: {u.cedula}</span>
                        </td>
                        <td className="py-3 text-zinc-500">{u.email}</td>
                        <td className="py-3">
                          <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg text-xs font-semibold">
                            {u.tipo_usuario}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            u.activo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                          }`}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button
                            onClick={() => handleToggleEstado(u.id, u.activo)}
                            className={`p-1.5 rounded-lg transition ${u.activo ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                            title={u.activo ? "Deshabilitar usuario" : "Activar usuario"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEliminarUsuario(u.id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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