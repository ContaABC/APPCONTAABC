"use client";

import { useState, useEffect, FormEvent, ChangeEvent, MouseEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Users, UserPlus, Shield, CheckCircle2, XCircle, Trash2, Power, Search, Edit3, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js"; 
import { crearOActualizarUsuarioAdmin, UsuarioFormData } from "./actions";

// ==========================================
// INTERFACES Y TIPOS
// ==========================================
interface UsuarioPerfil {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  tipo_usuario: string;
  activo: boolean;
  es_temporal: boolean;
  fecha_expiracion_password?: string | null;
  created_at?: string;
}

interface MensajeEstado {
  texto: string;
  tipo: "success" | "info" | "error" | "";
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [cargandoLista, setCargandoLista] = useState<boolean>(true);
  
  const [usuarioSeleccionadoId, setUsuarioSeleccionadoId] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");

  const [formData, setFormData] = useState<UsuarioFormData>({
    nombres: "",
    apellidos: "",
    cedula: "",
    email: "",
    password: "",
    tipo_usuario: "Operador",
    es_temporal: true,
    fecha_expiracion_password: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [mensaje, setMensaje] = useState<MensajeEstado>({ texto: "", tipo: "" });

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
        setUsuarios(data as UsuarioPerfil[]);
      }
    }
    setCargandoLista(false);
  };

  const seleccionarUsuarioParaEditar = (u: UsuarioPerfil) => {
    setUsuarioSeleccionadoId(u.id);
    setFormData({
      nombres: u.nombres || "",
      apellidos: u.apellidos || "",
      cedula: u.cedula || "",
      email: u.email || "",
      password: "",
      tipo_usuario: u.tipo_usuario || "Operador",
      es_temporal: u.es_temporal ?? true,
      fecha_expiracion_password: u.fecha_expiracion_password ? u.fecha_expiracion_password.split('T')[0] : "",
    });
    setMensaje({ texto: `Editando al usuario: ${u.nombres} ${u.apellidos}`, tipo: "info" });
  };

  const limpiarFormulario = () => {
    setUsuarioSeleccionadoId(null);
    setFormData({ 
      nombres: "", 
      apellidos: "", 
      cedula: "", 
      email: "", 
      password: "", 
      tipo_usuario: "Operador",
      es_temporal: true,
      fecha_expiracion_password: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setMensaje({ texto: "", tipo: "" });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMensaje({ texto: "", tipo: "" });

    try {
      const resultado = await crearOActualizarUsuarioAdmin({
        id: usuarioSeleccionadoId || undefined,
        ...formData,
      });

      if (!resultado.success) {
        throw new Error(resultado.message);
      }

      setMensaje({ texto: resultado.message, tipo: "success" });
      limpiarFormulario();
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
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        
        <Link href="/modulos/contabilidad" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 mb-4 transition">
          <ArrowLeft className="w-4 h-4" /> Volver al Menú Contable
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Gestión de Usuarios y Accesos</h1>
              <p className="text-xs text-zinc-500">Control de perfiles, clasificaciones temporales/permanentes y vigencias</p>
            </div>
          </div>
          <Link
            href="/usuarios/asignaciones"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-xs transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>Ir a Asignaciones de Empresas</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Formulario Compacto en 2 Columnas (Izquierda - 5 columnas) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm lg:col-span-5 h-fit">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2">
                {usuarioSeleccionadoId ? <Edit3 className="w-4 h-4 text-amber-600" /> : <UserPlus className="w-4 h-4 text-blue-600" />}
                {usuarioSeleccionadoId ? "Editar Usuario" : "Nuevo Usuario"}
              </h2>
              {usuarioSeleccionadoId && (
                <button 
                  type="button"
                  onClick={limpiarFormulario}
                  className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Cancelar
                </button>
              )}
            </div>

            {mensaje.texto && (
              <div className={`p-2.5 mb-3 rounded-xl text-[11px] font-semibold flex items-center gap-2 ${
                mensaje.tipo === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 
                mensaje.tipo === 'info' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {mensaje.tipo === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                <span>{mensaje.texto}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-zinc-500 mb-1">Nombres</label>
                  <input 
                    type="text" 
                    required
                    value={formData.nombres}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({...formData, nombres: e.target.value})}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                    placeholder="Ej. Juan"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-500 mb-1">Apellidos</label>
                  <input 
                    type="text" 
                    required
                    value={formData.apellidos}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({...formData, apellidos: e.target.value})}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                    placeholder="Ej. Pérez"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-zinc-500 mb-1">Cédula</label>
                  <input 
                    type="text" 
                    required
                    value={formData.cedula}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({...formData, cedula: e.target.value})}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                    placeholder="Nro documento"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-500 mb-1">Tipo Usuario</label>
                  <select 
                    value={formData.tipo_usuario}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({...formData, tipo_usuario: e.target.value})}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="Operador" className="dark:bg-zinc-900">Operador</option>
                    <option value="Contador" className="dark:bg-zinc-900">Contador</option>
                    <option value="Administrador" className="dark:bg-zinc-900">Administrador</option>
                    <option value="Auditor" className="dark:bg-zinc-900">Auditor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-500 mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  required
                  disabled={Boolean(usuarioSeleccionadoId)}
                  value={formData.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 disabled:opacity-50"
                  placeholder="correo@empresa.com"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-500 mb-1">
                  {usuarioSeleccionadoId ? "Nueva Contraseña (Opcional)" : "Contraseña Temporal"}
                </label>
                <input 
                  type="password" 
                  required={!usuarioSeleccionadoId}
                  minLength={6}
                  value={formData.password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  placeholder={usuarioSeleccionadoId ? "Mantener actual (en blanco)" : "Mínimo 6 caracteres"}
                />
              </div>

              {/* BLOQUE DE CONTROL DE SEGURIDAD Y VIGENCIA */}
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2.5 mt-2 space-y-2.5">
                <h3 className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">Seguridad y Vigencia</h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-zinc-500 mb-1">Clasificación</label>
                    <select 
                      value={formData.es_temporal ? "temporal" : "permanente"}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({...formData, es_temporal: e.target.value === "temporal"})}
                      className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 text-[11px] cursor-pointer"
                    >
                      <option value="temporal" className="dark:bg-zinc-900">Temporal (Expira cuenta)</option>
                      <option value="permanente" className="dark:bg-zinc-900">Permanente (Renueva clave)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-500 mb-1">Fecha Vencimiento</label>
                    <input 
                      type="date"
                      required
                      value={formData.fecha_expiracion_password}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({...formData, fecha_expiracion_password: e.target.value})}
                      className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <button 
                  type="submit" 
                  disabled={loading}
                  className={`w-full py-2 rounded-xl font-semibold transition shadow-sm text-white cursor-pointer ${
                    usuarioSeleccionadoId ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
                  } disabled:opacity-50`}
                >
                  {loading ? "Procesando..." : usuarioSeleccionadoId ? "Actualizar Usuario" : "Guardar Usuario"}
                </button>
              </div>
            </form>
          </div>

          {/* Listado de Usuarios (Derecha - 7 columnas) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm lg:col-span-7">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" /> Usuarios Registrados ({usuariosFiltrados.length})
              </h2>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-36">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={busqueda}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600"
                  />
                </div>

                <select
                  value={filtroTipo}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFiltroTipo(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="" className="dark:bg-zinc-900">Tipos</option>
                  <option value="Operador" className="dark:bg-zinc-900">Operador</option>
                  <option value="Contador" className="dark:bg-zinc-900">Contador</option>
                  <option value="Administrador" className="dark:bg-zinc-900">Administrador</option>
                  <option value="Auditor" className="dark:bg-zinc-900">Auditor</option>
                </select>

                <select
                  value={filtroEstado}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFiltroEstado(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="" className="dark:bg-zinc-900">Estados</option>
                  <option value="true" className="dark:bg-zinc-900">Activos</option>
                  <option value="false" className="dark:bg-zinc-900">Inactivos</option>
                </select>
              </div>
            </div>

            {cargandoLista ? (
              <p className="text-xs text-zinc-400 py-6 text-center">Cargando usuarios...</p>
            ) : usuariosFiltrados.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center">No se encontraron usuarios con los filtros aplicados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase">
                      <th className="pb-2.5 font-semibold">Nombre / Cédula</th>
                      <th className="pb-2.5 font-semibold">Correo</th>
                      <th className="pb-2.5 font-semibold">Tipo</th>
                      <th className="pb-2.5 font-semibold">Vigencia</th>
                      <th className="pb-2.5 font-semibold">Estado</th>
                      <th className="pb-2.5 font-semibold text-right">Acciones</th>
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
                          <td className="py-2.5">
                            <p className="font-medium">{u.nombres} {u.apellidos}</p>
                            <span className="text-[11px] text-zinc-400">CC: {u.cedula}</span>
                          </td>
                          <td className="py-2.5 text-zinc-500 truncate max-w-[120px]">{u.email}</td>
                          <td className="py-2.5">
                            <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                              {u.tipo_usuario}
                            </span>
                          </td>
                          <td className="py-2.5 text-[11px]">
                            {u.es_temporal ? (
                              <span className="text-amber-600 font-medium">
                                Temp ({u.fecha_expiracion_password ? new Date(u.fecha_expiracion_password).toLocaleDateString() : 'N/A'})
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium">
                                Perm ({u.fecha_expiracion_password ? new Date(u.fecha_expiracion_password).toLocaleDateString() : 'N/A'})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                              u.activo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                            }`}>
                              {u.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right space-x-1" onClick={(e: MouseEvent<HTMLTableCellElement>) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleEstado(u.id, u.activo)}
                              className={`p-1 rounded-md transition cursor-pointer ${u.activo ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                              title={u.activo ? "Deshabilitar usuario" : "Activar usuario"}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminarUsuario(u.id)}
                              className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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