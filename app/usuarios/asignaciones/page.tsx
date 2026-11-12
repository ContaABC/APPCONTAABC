"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Link2, PlusCircle, CheckCircle2, XCircle, Trash2, Search } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// INTERFACES Y TIPOS
// ==========================================
interface UsuarioPerfil {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  tipo_usuario: string;
  activo: boolean;
}

interface Empresa {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
}

interface Sucursal {
  id: number;
  empresa_id: number | string;
  nombre: string;
  codigo_sucursal?: string;
  estado?: string;
}

interface UsuarioAsignacion {
  id: number;
  usuario_id: string;
  empresa_id: number | string;
  sucursal_id: number;
  rol: string;
  usuarios_perfiles?: {
    nombres: string;
    apellidos: string;
    cedula: string;
  } | null;
}

interface MensajeEstado {
  texto: string;
  tipo: "success" | "error" | "";
}

export default function AsignacionesPage() {
  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [asignaciones, setAsignaciones] = useState<UsuarioAsignacion[]>([]);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [cargandoDatos, setCargandoDatos] = useState<boolean>(true);

  // Estados del formulario
  const [usuarioIdSeleccionado, setUsuarioIdSeleccionado] = useState<string>("");
  const [sucursalesSeleccionadas, setSucursalesSeleccionadas] = useState<{ [key: number]: boolean }>({});
  const [rol, setRol] = useState<string>("Operador");
  
  // Filtros panel izquierdo
  const [busquedaUsuarioIzquierda, setBusquedaUsuarioIzquierda] = useState<string>("");
  const [filtroEstadoUsuario, setFiltroEstadoUsuario] = useState<string>("");
  const [busquedaEmpresaIzquierda, setBusquedaEmpresaIzquierda] = useState<string>("");

  // Filtros panel derecho
  const [busquedaAsignacion, setBusquedaAsignacion] = useState<string>("");
  const [filtroEmpresaAsignacion, setFiltroEmpresaAsignacion] = useState<string>("");

  const [mensaje, setMensaje] = useState<MensajeEstado>({ texto: "", tipo: "" });

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    setCargandoDatos(true);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // 1. Usuarios
      const { data: usuariosData } = await supabase.from("usuarios_perfiles").select("id, nombres, apellidos, cedula, tipo_usuario, activo");
      if (usuariosData) setUsuarios(usuariosData as UsuarioPerfil[]);

      // 2. Empresas
      const { data: empresasData } = await supabase.from("empresas").select("*");
      if (empresasData) setEmpresas(empresasData as Empresa[]);

      // 3. Sucursales
      const { data: sucursalesData } = await supabase.from("sucursales").select("*").eq("estado", "Activa");
      if (sucursalesData) setSucursales(sucursalesData as Sucursal[]);

      // 4. Asignaciones con mapeo seguro para aplanar la relación de Supabase
      const { data: asignacionesData } = await supabase
        .from("usuario_asignaciones")
        .select(`
          id,
          usuario_id,
          empresa_id,
          sucursal_id,
          rol,
          usuarios_perfiles (nombres, apellidos, cedula)
        `)
        .order("created_at", { ascending: false });

      if (asignacionesData) {
        const asignacionesMapeadas: UsuarioAsignacion[] = asignacionesData.map((item: any) => ({
          ...item,
          usuarios_perfiles: Array.isArray(item.usuarios_perfiles) 
            ? (item.usuarios_perfiles[0] || null) 
            : item.usuarios_perfiles
        }));
        setAsignaciones(asignacionesMapeadas);
      }
    }
    setCargandoDatos(false);
  };

  const handleUsuarioChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setUsuarioIdSeleccionado(id);
    const usuarioEncontrado = usuarios.find((u) => u.id === id);
    if (usuarioEncontrado && usuarioEncontrado.tipo_usuario) {
      setRol(usuarioEncontrado.tipo_usuario);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!usuarioIdSeleccionado) {
      setMensaje({ texto: "Seleccione un usuario.", tipo: "error" });
      return;
    }

    setLoading(true);
    setMensaje({ texto: "", tipo: "" });

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Faltan variables de entorno.");

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const sucursalesIdsList = Object.keys(sucursalesSeleccionadas)
        .filter((id) => sucursalesSeleccionadas[Number(id)])
        .map((id) => Number(id));

      if (sucursalesIdsList.length === 0) {
        throw new Error("Seleccione al menos una sucursal.");
      }

      // Limpiar asignaciones previas del usuario
      const { error: deleteError } = await supabase
        .from("usuario_asignaciones")
        .delete()
        .eq("usuario_id", usuarioIdSeleccionado);

      if (deleteError) throw deleteError;

      const batchInserts = sucursalesIdsList.map((sucId) => {
        const sucEncontrada = sucursales.find((s) => s.id === sucId);
        return {
          usuario_id: usuarioIdSeleccionado,
          empresa_id: sucEncontrada ? sucEncontrada.empresa_id : null,
          sucursal_id: sucId,
          rol: rol,
        };
      });

      const { error: insertError } = await supabase.from("usuario_asignaciones").insert(batchInserts);
      if (insertError) throw insertError;

      setMensaje({ texto: "¡Asignaciones por sucursal actualizadas exitosamente!", tipo: "success" });
      
      // Limpiar campos correctamente
      setSucursalesSeleccionadas({});
      setUsuarioIdSeleccionado("");
      setBusquedaEmpresaIzquierda("");
      
      cargarDatosIniciales();
    } catch (error: any) {
      setMensaje({ texto: error.message || "Error al guardar las asignaciones.", tipo: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarAsignacion = async (idAsignacion: number) => {
    if (!confirm("¿Está seguro de eliminar esta asignación de acceso?")) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from("usuario_asignaciones").delete().eq("id", idAsignacion);

    if (!error) cargarDatosIniciales();
  };

  const usuariosFiltradosIzquierda = usuarios.filter((u) => {
    const textoMatch = `${u.nombres} ${u.apellidos} ${u.cedula}`.toLowerCase().includes(busquedaUsuarioIzquierda.toLowerCase());
    const estadoMatch = filtroEstadoUsuario !== "" ? String(u.activo) === filtroEstadoUsuario : true;
    return textoMatch && estadoMatch;
  });

  const empresasFiltradasIzquierda = empresas.filter((emp) => {
    const nombre = (emp.razon_social || emp.nombre_comercial || "").toLowerCase();
    return nombre.includes(busquedaEmpresaIzquierda.toLowerCase());
  });

  const asignacionesFiltradasDerecha = asignaciones.filter((asig) => {
    const nombreCompleto = `${asig.usuarios_perfiles?.nombres || ""} ${asig.usuarios_perfiles?.apellidos || ""} ${asig.usuarios_perfiles?.cedula || ""}`.toLowerCase();
    const textoMatch = nombreCompleto.includes(busquedaAsignacion.toLowerCase());
    const empresaMatch = filtroEmpresaAsignacion ? String(asig.empresa_id) === filtroEmpresaAsignacion : true;
    return textoMatch && empresaMatch;
  });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        
        <Link href="/usuarios" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Volver a Gestión de Usuarios
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Asignación por Sucursales y Empresas</h1>
              <p className="text-sm text-zinc-500">Asigne accesos específicos a nivel de sucursal heredando el rol</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* PANEL IZQUIERDO: Formulario */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-5 h-fit">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-600" /> Gestionar Accesos
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
              
              <div className="space-y-2 bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <label className="block text-xs font-semibold text-zinc-500">Filtrar Usuario</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                    <input 
                      type="text"
                      placeholder="Buscar por nombre o cédula..."
                      value={busquedaUsuarioIzquierda}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setBusquedaUsuarioIzquierda(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <select
                    value={filtroEstadoUsuario}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFiltroEstadoUsuario(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="" className="dark:bg-zinc-900">Todos</option>
                    <option value="true" className="dark:bg-zinc-900">Activos</option>
                    <option value="false" className="dark:bg-zinc-900">Inactivos</option>
                  </select>
                </div>

                <div>
                  <select 
                    required
                    value={usuarioIdSeleccionado}
                    onChange={handleUsuarioChange}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600 mt-1 cursor-pointer"
                  >
                    <option value="" className="dark:bg-zinc-900">Seleccione un usuario...</option>
                    {usuariosFiltradosIzquierda.map((u) => (
                      <option key={u.id} value={u.id} className="dark:bg-zinc-900">
                        {u.nombres} {u.apellidos} ({u.tipo_usuario}) {u.activo ? '' : '[Inactivo]'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-zinc-500">Seleccionar Sucursales (Múltiple)</label>
                </div>
                
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                  <input 
                    type="text"
                    placeholder="Filtrar empresas..."
                    value={busquedaEmpresaIzquierda}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBusquedaEmpresaIzquierda(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-3 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl">
                  {empresasFiltradasIzquierda.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-2">No hay empresas que coincidan.</p>
                  ) : (
                    empresasFiltradasIzquierda.map((emp) => {
                      const sucursalesDeEmpresa = sucursales.filter((s) => s.empresa_id === emp.id);
                      if (sucursalesDeEmpresa.length === 0) return null;

                      return (
                        <div key={emp.id} className="space-y-1">
                          <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide border-b border-zinc-100 dark:border-zinc-800 pb-0.5">
                            {emp.razon_social || emp.nombre_comercial}
                          </p>
                          <div className="pl-2 space-y-1 pt-1">
                            {sucursalesDeEmpresa.map((suc) => {
                              const checked = !!sucursalesSeleccionadas[suc.id];
                              return (
                                <label key={suc.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 p-1 rounded-lg">
                                  <input 
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSucursalesSeleccionadas({...sucursalesSeleccionadas, [suc.id]: e.target.checked})}
                                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span>{suc.nombre} <span className="text-zinc-400 text-[10px]">({suc.codigo_sucursal})</span></span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold transition shadow-sm mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Guardando..." : "Actualizar Asignaciones"}
              </button>
            </form>
          </div>

          {/* PANEL DERECHO: Permisos Asignados */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-7">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Link2 className="w-5 h-5 text-indigo-600" /> Permisos Asignados ({asignacionesFiltradasDerecha.length})
              </h2>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar usuario o cédula..."
                    value={busquedaAsignacion}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBusquedaAsignacion(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <select
                  value={filtroEmpresaAsignacion}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFiltroEmpresaAsignacion(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="" className="dark:bg-zinc-900">Todas las Empresas</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id} className="dark:bg-zinc-900">
                      {emp.razon_social || emp.nombre_comercial}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {cargandoDatos ? (
              <p className="text-sm text-zinc-400 py-8 text-center">Cargando asignaciones...</p>
            ) : asignacionesFiltradasDerecha.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center">No se encontraron asignaciones con los filtros aplicados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs uppercase">
                      <th className="pb-3 font-semibold">Usuario</th>
                      <th className="pb-3 font-semibold">Empresa / Sucursal</th>
                      <th className="pb-3 font-semibold">Rol</th>
                      <th className="pb-3 font-semibold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {asignacionesFiltradasDerecha.map((asig) => {
                      const empresaEncontrada = empresas.find((e) => String(e.id) === String(asig.empresa_id));
                      const sucursalEncontrada = sucursales.find((s) => s.id === asig.sucursal_id);

                      return (
                        <tr key={asig.id}>
                          <td className="py-3 font-medium">
                            {asig.usuarios_perfiles?.nombres} {asig.usuarios_perfiles?.apellidos}
                            <span className="block text-xs text-zinc-400">CC: {asig.usuarios_perfiles?.cedula}</span>
                          </td>
                          <td className="py-3">
                            <p className="font-medium text-xs">{empresaEncontrada?.razon_social || empresaEncontrada?.nombre_comercial || `Empresa ID: ${asig.empresa_id}`}</p>
                            <span className="text-[11px] text-indigo-600 font-semibold">
                              Sucursal: {sucursalEncontrada?.nombre || 'General'} {sucursalEncontrada?.codigo_sucursal ? `(${sucursalEncontrada.codigo_sucursal})` : ''}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg text-xs font-semibold">
                              {asig.rol}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleEliminarAsignacion(asig.id)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition cursor-pointer"
                              title="Eliminar asignación"
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