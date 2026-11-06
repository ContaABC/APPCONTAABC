import Link from "next/link";
import { Settings, ArrowLeft, ArrowRight, Users } from "lucide-react";

export default function ConfiguracionPage() {
  const opciones = [
    { name: "Empresas", href: "/api/empresas/nueva" },
    { name: "Terceros", href: "/terceros" },
    { name: "Clases de Documentos", href: "/configuracion/clases-documento" },
    { name: "Sucursales", href: "/Sucursales" },
    { name: "Conceptos NIIF", href: "/ConceptosNiif" },
    { name: "Subconceptos NIIF", href: "/subconceptos_niif" },
    { name: "Actividades ABC", href: "/ActividadesABC" },
    { name: "Actividades Auxiliares", href: "/actividades_auxiliares" },
    { name: "Conceptos Auxiliares", href: "/conceptos_auxiliares" },
    { name: "Enlace Clases y Conceptos", href: "/clase_documento_conceptos" },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Volver al Menú Principal
        </Link>
        
        {/* Enlace rápido a Gestión de Usuarios */}
        <div className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold">Control de Acceso y Usuarios</h2>
              <p className="text-xs text-blue-100">Administra perfiles, contraseñas y asignación de empresas.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/usuarios" className="bg-white text-blue-600 px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-50 transition">
              Usuarios
            </Link>
            <Link href="/usuarios/asignaciones" className="bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-800 transition">
              Asignaciones
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600">
              <Settings className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Configuración</h1>
              <p className="text-sm text-zinc-500">Parámetros generales y catálogos maestros del sistema</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op, idx) => (
              <Link key={idx} href={op.href} className="group p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> {op.name}
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}