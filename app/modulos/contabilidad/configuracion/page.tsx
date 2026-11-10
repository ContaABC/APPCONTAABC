"use client";

import Link from "next/link";
import { Settings, ArrowLeft, ArrowRight, Users, ShieldCheck } from "lucide-react";

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
    // Opciones de Usuarios y Seguridad integradas en la grilla maestra
    { name: "Gestión de Usuarios", href: "/usuarios", isSecurity: true },
    { name: "Asignación de Empresas y Sucursales", href: "/usuarios/asignaciones", isSecurity: true },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/modulos/contabilidad" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Volver al Menú Contable
        </Link>
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600">
              <Settings className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Configuración</h1>
              <p className="text-sm text-zinc-500">Parámetros generales, catálogos maestros y control de accesos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op, idx) => (
              <Link 
                key={idx} 
                href={op.href} 
                className={`group p-4 rounded-xl border transition flex items-center justify-between ${
                  op.isSecurity 
                    ? "border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30" 
                    : "border-zinc-200/70 dark:border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${op.isSecurity ? "bg-blue-600" : "bg-indigo-500"}`}></span> 
                  {op.name}
                </span>
                <ArrowRight className={`w-4 h-4 transition-all ${op.isSecurity ? "text-blue-500 group-hover:translate-x-1" : "text-zinc-400 group-hover:text-indigo-600 group-hover:translate-x-1"}`} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}