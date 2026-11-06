import Link from "next/link";
import { Users, ArrowLeft, ArrowRight } from "lucide-react";

export default function ClientesPage() {
  const opciones = [
    { name: "Facturas para Clientes", href: "/facturas/emitir" },
    { name: "Consulta Facturas Clientes", href: "/facturas-emitidas" },
    { name: "Recibos de Caja Clientes", href: "/cobros/nuevo" },
    { name: "Items de Facturación", href: "/items" },
    { name: "Notas para Clientes", href: "/notas-emitidas" },
    { name: "Consulta de Notas Clientes", href: "/notas-emitidas/nueva" },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Volver al Menú Principal
        </Link>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl text-emerald-600">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Clientes</h1>
              <p className="text-sm text-zinc-500">Facturación, ítems, recibos y notas operacionales</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opciones.map((op, idx) => (
              <Link key={idx} href={op.href} className="group p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {op.name}
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}