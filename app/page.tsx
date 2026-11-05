import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12">
      {/* Encabezado principal del sistema */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b pb-6 border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ContaABC - Panel Contable NIIF</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Sistema central de gestión financiera y transacciones automatizadas
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/transacciones/nueva"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition shadow-sm"
          >
            + Nueva Transacción
          </Link>
          <Link
            href="/terceros"
            className="border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-4 py-2 rounded-lg font-medium text-sm transition"
          >
            Gestión de Terceros
          </Link>
        </div>
      </header>

      {/* Tarjetas de Resumen General */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Transacciones</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Ingresos del Periodo</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">$0.00</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Gastos y Costos</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">$0.00</p>
        </div>
      </section>

      {/* Secciones de Transacciones Organizadas por Grupos */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Transacciones Efectuadas por Grupos</h2>
          <span className="text-xs text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
            Estructura NIIF
          </span>
        </div>

        {/* Grupo 1: Ingresos */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="bg-zinc-100 dark:bg-zinc-800/60 px-6 py-3 border-b border-zinc-200 dark:border-zinc-700 font-semibold text-sm flex justify-between items-center">
            <span>Grupo 4: Ingresos Operacionales</span>
            <span className="text-xs font-normal text-zinc-500">0 Registros</span>
          </div>
          <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
            No hay transacciones registradas en este grupo. Las nuevas operaciones aparecerán aquí automáticamente.
          </div>
        </div>

        {/* Grupo 2: Gastos / Costos */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="bg-zinc-100 dark:bg-zinc-800/60 px-6 py-3 border-b border-zinc-200 dark:border-zinc-700 font-semibold text-sm flex justify-between items-center">
            <span>Grupo 5 y 6: Costos y Gastos</span>
            <span className="text-xs font-normal text-zinc-500">0 Registros</span>
          </div>
          <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
            No hay transacciones registradas en este grupo.
          </div>
        </div>
      </section>
    </main>
  );
}