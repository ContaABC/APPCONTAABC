import Link from "next/link";
import { BarChart3, ArrowLeft, ArrowRight, PlusCircle } from "lucide-react";

export default function ContabilidadPage() {
  const opciones = [
    { name: "Documentos Contables", href: "/documentos" },
    { name: "Balance General", href: "/balance_general" },
    { name: "Estado de Resultados", href: "/estado-resultados" },
    { name: "Declaración de Retenciones", href: "/retenciones/declaracion" },
    { name: "Certificados de Retención", href: "/retenciones/Certificados" },
    { name: "Conceptos de Retención", href: "/retenciones/conceptos" },
    { name: "Cierres Contables", href: "/cierres" },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 transition">
            <ArrowLeft className="w-4 h-4" /> Volver al Menú Principal
          </Link>
          <Link
            href="/transacciones/nueva"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold text-xs transition shadow-sm flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Nueva Transacción</span>
          </Link>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-blue-600">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Contabilidad</h1>
              <p className="text-sm text-zinc-500">Estructura oficial NIIF, estados financieros, retenciones y cierres</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op, idx) => (
              <Link key={idx} href={op.href} className="group p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 hover:border-blue-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {op.name}
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}