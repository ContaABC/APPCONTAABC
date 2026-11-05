export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-50 dark:bg-black">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">
          ContaABC - Sistema Contable NIIF
        </h1>
      </div>
      <div className="mt-8 flex gap-4">
        <a
          href="/transacciones/nueva"
          className="rounded-full bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
        >
          Nueva Transacción
        </a>
        <a
          href="/terceros"
          className="rounded-full border border-gray-300 px-6 py-3 font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
        >
          Ver Terceros
        </a>
      </div>
    </main>
  );
}