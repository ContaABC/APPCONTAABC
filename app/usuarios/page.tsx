"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Users, UserPlus, Shield, CheckCircle2, XCircle, Trash2, Power, Search, Edit3, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js"; 
import { crearUsuarioAdmin } from "./actions"; // Importamos la Server Action

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(true);
  
  const [usuarioSeleccionadoId, setUsuarioSeleccionadoId] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

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

  const seleccionarUsuarioParaEditar = (u: any) => {
    setUsuarioSeleccionadoId(u.id);
    setFormData({
      nombres: u.nombres || "",
      apellidos: u.apellidos || "",
      cedula: u.cedula || "",
      email: u.email || "",
      password: "",
      tipo_usuario: u.tipo_usuario || "Operador",
    });
    setMensaje({ texto: `Editando al usuario: ${u.nombres} ${u.apellidos}`, tipo: "info" });
  };

  const limpiarFormulario = () => {
    setUsuarioSeleccionadoId(null);
    setFormData({ nombres: "", apellidos: "", cedula: "", email: "", password: "", tipo_usuario: "Operador" });
    setMensaje({ texto: "", tipo: "" });
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

      if (usuarioSeleccionadoId) {
        // MODO EDICIÓN (Actualizar perfil)
        const { error: updateError } = await supabase
          .from("usuarios_perfiles")
          .update({
            nombres: formData.nombres,
            apellidos: formData.apellidos,
            cedula: formData.cedula,
            tipo_usuario: formData.tipo_usuario,
          })
          .eq("id", usuarioSeleccionadoId);

        if (updateError) throw updateError;

        setMensaje({ texto: "¡Perfil de usuario actualizado exitosamente!", tipo: "success" });
        limpiarFormulario();
      } else {
        // MODO CREACIÓN (Mediante Server Action de Administrador - ¡Sin cerrar sesión!)
        if (!formData.password) throw new Error("La contraseña es obligatoria para nuevos usuarios.");

        const resultado = await crearUsuarioAdmin(formData);

        if (!resultado.success) {
          throw new Error(resultado.message);
        }

        setMensaje({ texto: resultado.message, tipo: "success" });
        limpiarFormulario();
      }

      cargarUsuarios();
    } catch (error: any) {
      setMensaje({ texto: error.message || "Error al procesar la solicitud.", tipo: "error" });
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
      if (usuarioSeleccionadoId === id) limpiarFormulario();
      cargarUsuarios();
    } else {
      alert("Error al eliminar el usuario.");
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const textoMatch = `${u.nombres} ${u.apellidos} ${u.cedula} ${u.email}`.toLowerCase().includes(busqueda.toLowerCase());
    const tipoMatch = filtroTipo ? u.tipo_usuario === filtroTipo : true;
    const estadoMatch = filtroEstado !== "" ? String(u.activo) === filtroEstado : true;
    return textoMatch && tipoMatch && estadoMatch;
  });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        
        <Link href="/modulos/contabilidad" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Volver al Menú Contable
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
          
          {/* Formulario (Izquierda) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-1 h-fit">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                {usuarioSeleccionadoId ? <Edit3 className="w-5 h-5 text-amber-600" /> : <UserPlus className="w-5 h-5 text-blue-600" />}
                {usuarioSeleccionadoId ? "Editar Usuario" : "Nuevo Usuario"}
              </h2>
              {usuarioSeleccionadoId && (
                <button 
                  onClick={limpiarFormulario}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar edición
                </button>
              )}
            </div>

            {mensaje.texto && (
              <div className={`p-3 mb-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                mensaje.tipo === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 
                mensaje.tipo === 'info' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-red-50 text-red-600 border border-red-200'
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
                  disabled={Boolean(usuarioSeleccionadoId)}
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 disabled:opacity-50"
                  placeholder="correo@empresa.com"
                />
              </div>

              {!usuarioSeleccionadoId && (
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
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Tipo de Usuario</label>
                <select 
                  value={formData.tipo_usuario}
                  onChange={(e) => setFormData({...formData, tipo_usuario: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                >
                  <option value="Operador" className="dark:bg-zinc-900">Operador</option>
                  <option value="Contador" className="dark:bg-zinc-900">Contador</option>
                  <option value="Administrador" className="dark:bg-zinc-900">Administrador</option>
                  <option value="Auditor" className="dark:bg-zinc-900">Auditor</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className={`w-full py-2.5 rounded-xl font-semibold transition shadow-sm text-white ${
                    usuarioSeleccionadoId ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
                  } disabled:opacity-50`}
                >
                  {loading ? "Procesando..." : usuarioSeleccionadoId ? "Actualizar Usuario" : "Guardar Usuario"}
                </button>
              </div>
            </form>
          </div>

          {/* Listado de Usuarios (Derecha) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-2">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" /> Usuarios Registrados ({usuariosFiltrados.length})
              </h2>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-48">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  />
                </div>

                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                >
                  <option value="" className="dark:bg-zinc-900">Todos los Tipos</option>
                  <option value="Operador" className="dark:bg-zinc-900">Operador</option>
                  <option value="Contador" className="dark:bg-zinc-900">Contador</option>
                  <option value="Administrador" className="dark:bg-zinc-900">Administrador</option>
                  <option value="Auditor" className="dark:bg-zinc-900">Auditor</option>
                </select>

                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                >
                  <option value="" className="dark:bg-zinc-900">Todos los Estados</option>
                  <option value="true" className="dark:bg-zinc-900">Activos</option>
                  <option value="false" className="dark:bg-zinc-900">Inactivos</option>
                </select>
              </div>
            </div>

            {cargandoLista ? (
              <p className="text-sm text-zinc-400 py-8 text-center">Cargando usuarios...</p>
            ) : usuariosFiltrados.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center">No se encontraron usuarios con los filtros aplicados.</p>
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
                    {usuariosFiltrados.map((u) => {
                      const esSeleccionado = usuarioSeleccionadoId === u.id;
                      return (
                        <tr 
                          key={u.id}
                          onClick={() => seleccionarUsuarioParaEditar(u)}
                          className={`cursor-pointer transition hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${
                            esSeleccionado ? "bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-600" : ""
                          }`}
                        >
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
                          <td className="py-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
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
                      );
                    })}
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