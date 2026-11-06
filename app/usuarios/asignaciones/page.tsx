"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Link2, PlusCircle, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export default function AsignacionesPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  // Estados del formulario
  const [usuarioIdSeleccionado, setUsuarioIdSeleccionado] = useState("");
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<{ [key: number]: boolean }>({});
  const [rol, setRol] = useState("Operador");

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

      // 1. Usuarios (traemos también el tipo_usuario para heredar el rol)
      const { data: usuariosData } = await supabase.from("usuarios_perfiles").select("id, nombres, apellidos, cedula, tipo_usuario");
      if (usuariosData) setUsuarios(usuariosData);

      // 2. Empresas
      const { data: empresasData } = await supabase.from("empresas").select("*");
      if (empresasData) setEmpresas(empresasData);

      // 3. Asignaciones con nombres de usuario y empresas
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

      if (asignacionesData) setAsignaciones(asignacionesData);
    }
    setCargandoDatos(false);
  };

  // Cuando se selecciona un usuario, heredamos su tipo como rol predeterminado
  const handleUsuarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setUsuarioIdSeleccionado(id);
    const usuarioEncontrado = usuarios.find((u) => u.id === id);
    if (usuarioEncontrado && usuarioEncontrado.tipo_usuario) {
      setRol(usuarioEncontrado.tipo_usuario);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

      const empresasIdsList = Object.keys(empresasSeleccionadas)
        .filter((id) => empresasSeleccionadas[Number(id)])
        .map((id) => Number(id));

      if (empresasIdsList.length === 0) {
        throw new Error("Seleccione al menos una empresa.");
      }

      // Limpiamos asignaciones previas para actualizar limpiamente
      const { error: deleteError } = await supabase
        .from("usuario_asignaciones")
        .delete()
        .eq("usuario_id", usuarioIdSeleccionado);

      if (deleteError) throw deleteError;

      const batchInserts = empresasIdsList.map((empId) => ({
        usuario_id: usuarioIdSeleccionado,
        empresa_id: empId,
        sucursal_id: null,
        rol: rol,
      }));

      const { error: insertError } = await supabase.from("usuario_asignaciones").insert(batchInserts);
      if (insertError) throw insertError;

      setMensaje({ texto: "¡Asignaciones actualizadas exitosamente!", tipo: "success" });
      setEmpresasSeleccionadas({});
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
              <h1 className="text-2xl font-bold">Asignación Múltiple de Empresas</h1>
              <p className="text-sm text-zinc-500">Selecciona múltiples empresas heredando el rol del usuario</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-1">
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
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Seleccionar Usuario</label>
                <select 
                  required
                  value={usuarioIdSeleccionado}
                  onChange={handleUsuarioChange}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600"
                >
                  <option value="" className="dark:bg-zinc-900">Seleccione un usuario...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id} className="dark:bg-zinc-900">
                      {u.nombres} {u.apellidos} ({u.tipo_usuario})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-2">Seleccionar Empresas (Múltiple)</label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl">
                  {empresas.map((emp) => {
                    const checked = !!empresasSeleccionadas[emp.id];
                    return (
                      <label key={emp.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 p-1.5 rounded-lg">
                        <input 
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setEmpresasSeleccionadas({...empresasSeleccionadas, [emp.id]: e.target.checked})}
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="font-medium">{emp.razon_social || emp.nombre_comercial}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Rol Asignado (Heredado del Tipo de Usuario)</label>
                <select 
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-indigo-600 font-semibold text-indigo-600"
                >
                  <option value="Administrador" className="dark:bg-zinc-900">Administrador</option>
                  <option value="Operador" className="dark:bg-zinc-900">Operador</option>
                  <option value="Auditor" className="dark:bg-zinc-900">Auditor</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold transition shadow-sm mt-2 disabled:opacity-50"
              >
                {loading ? "Guardando..." : "Actualizar Asignaciones"}
              </button>
            </form>
          </div>

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
                      <th className="pb-3 font-semibold">Rol</th>
                      <th className="pb-3 font-semibold text-right">Acción</th>
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
                        <td className="py-3">
                          <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg text-xs font-semibold">
                            {asig.rol}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleEliminarAsignacion(asig.id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                            title="Eliminar asignación"
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