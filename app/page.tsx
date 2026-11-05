import Link from "next/link";
import { 
  Settings, 
  Users, 
  Truck, 
  DollarSign, 
  BarChart3, 
  ShieldCheck,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  FolderKanban
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12 transition-colors duration-300">
      
      {/* Encabezado Principal Estilizado */}
      <header className="max-w-7xl mx-auto mb-12 backdrop-blur-md bg-white/70 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/10 dark:bg-blue-500/10 rounded-2xl border border-blue-600/20 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-900 via-blue-900 to-zinc-700 dark:from-white dark:via-blue-200 dark:to-zinc-400 bg-clip-text text-transparent">
              ContaABC
            </h1>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Portal de Gestión Financiera y Contable NIIF
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="text-right hidden sm:block">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Estado del Sistema</span>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">En Línea / Sincronizado</p>
          </div>
        </div>
      </header>

      {/* Contenedor de Tarjetas de Módulos (Grid) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* GRUPO 1: CONFIGURACIÓN */}
        <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-7 shadow-sm hover:shadow-xl hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Settings className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Configuración</h2>
            </div>
            <ul className="space-y-3 text-sm font-medium">
              {[
                { name: "Nueva Empresa", href: "/api/empresas/nueva" },
                { name: "Terceros", href: "/terceros" },
                { name: "Clases de Documento", href: "/configuracion/clases-documento" },
                { name: "Sucursales", href: "/Sucursales" },
                { name: "Conceptos NIIF", href: "/ConceptosNiif" },
                { name: "Subconceptos NIIF", href: "/subconceptos_niif" },
                { name: "Actividades ABC", href: "/ActividadesABC" },
                { name: "Actividades Auxiliares", href: "/actividades_auxiliares" },
                { name: "Conceptos Auxiliares", href: "/conceptos_auxiliares" },
                { name: "Relación Clases y Conceptos", href: "/clase_documento_conceptos" },
              ].map((item, idx) => (
                <li key={idx}>
                  <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center justify-between py-1">
                    <span className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-blue-600 transition-colors"></span>
                      {item.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-blue-600 dark:text-blue-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs font-semibold text-zinc-400 flex items-center gap-2">
            <FolderKanban className="w-4 h-4" /> Parámetros y Maestros
          </div>
        </div>

        {/* GRUPO 2: PROVEEDORES */}
        <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-7 shadow-sm hover:shadow-xl hover:border-amber-500/30 dark:hover:border-amber-500/30 transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
                <Truck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Proveedores</h2>
            </div>
            <ul className="space-y-3 text-sm font-medium">
              {[
                { name: "Cargar Facturas", href: "/facturas/cargar" },
                { name: "Consultar Facturas", href: "/facturas/consultar" },
                { name: "Notas de Facturas", href: "/facturas/notas" },
              ].map((item, idx) => (
                <li key={idx}>
                  <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition flex items-center justify-between py-1">
                    <span className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-amber-600 transition-colors"></span>
                      {item.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-amber-600 dark:text-amber-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs font-semibold text-zinc-400 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Costos y Cuentas por Pagar
          </div>
        </div>

        {/* GRUPO 3: CLIENTES */}
        <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-7 shadow-sm hover:shadow-xl hover:border-emerald-500/30 dark:hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Clientes</h2>
            </div>
            <ul className="space-y-3 text-sm font-medium">
              {[
                { name: "Emitir Facturas", href: "/facturas/emitir" },
                { name: "Facturas Emitidas", href: "/facturas-emitidas" },
                { name: "Gestión de Ítems", href: "/items" },
                { name: "Notas Emitidas", href: "/notas-emitidas" },
                { name: "Nueva Nota Emitida", href: "/notas-emitidas/nueva" },
              ].map((item, idx) => (
                <li key={idx}>
                  <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center justify-between py-1">
                    <span className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-emerald-600 transition-colors"></span>
                      {item.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-emerald-600 dark:text-emerald-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs font-semibold text-zinc-400 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Ingresos Operacionales
          </div>
        </div>

        {/* GRUPO 4: TESORERÍA */}
        <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-7 shadow-sm hover:shadow-xl hover:border-purple-500/30 dark:hover:border-purple-500/30 transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600 dark:text-purple-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Tesorería</h2>
            </div>
            <ul className="space-y-3 text-sm font-medium">
              {[
                { name: "Nuevo Cobro", href: "/cobros/nuevo" },
                { name: "Pagos", href: "/tesoreria/pagos" },
                { name: "Consignaciones", href: "/tesoreria/consignaciones" },
              ].map((item, idx) => (
                <li key={idx}>
                  <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition flex items-center justify-between py-1">
                    <span className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-purple-600 transition-colors"></span>
                      {item.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-purple-600 dark:text-purple-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs font-semibold text-zinc-400 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Caja y Bancos
          </div>
        </div>

        {/* GRUPO 5: CONTABILIDAD Y REPORTES NIIF (Incluye Nueva Transacción) */}
        <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-7 shadow-sm hover:shadow-xl hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all duration-300 flex flex-col justify-between md:col-span-2 lg:col-span-2">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Contabilidad y Reportes NIIF</h2>
              </div>
              
              {/* Botón de Nueva Transacción integrado aquí */}
              <Link
                href="/transacciones/nueva"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold text-xs transition shadow-sm hover:shadow-blue-500/25 flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Nueva Transacción</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-medium">
              <ul className="space-y-3">
                {[
                  { name: "Consultas Generales", href: "/consultas" },
                  { name: "Movimientos Contables", href: "/consultas/movimientos" },
                  { name: "Reportes Financieros", href: "/consultas/reportes" },
                  { name: "Documentos Contables", href: "/documentos" },
                  { name: "Balance General", href: "/balance_general" },
                  { name: "Estado de Resultados", href: "/estado-resultados" },
                ].map((item, idx) => (
                  <li key={idx}>
                    <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center justify-between py-1">
                      <span className="flex items-center gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-blue-600 transition-colors"></span>
                        {item.name}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-blue-600 dark:text-blue-400" />
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="space-y-3">
                {[
                  { name: "Declaración de Retenciones", href: "/retenciones/declaracion" },
                  { name: "Certificados de Retención", href: "/retenciones/Certificados" },
                  { name: "Conceptos de Retención", href: "/retenciones/conceptos" },
                  { name: "Consultas por Conceptos NIIF", href: "/consultas/conceptos_niif" },
                  { name: "Cierres Contables", href: "/cierres" },
                ].map((item, idx) => (
                  <li key={idx}>
                    <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center justify-between py-1">
                      <span className="flex items-center gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-blue-600 transition-colors"></span>
                        {item.name}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-blue-600 dark:text-blue-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs font-semibold text-zinc-400 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Estructura Oficial NIIF, Retenciones y Cierres
          </div>
        </div>

      </div>
    </main>
  );
}