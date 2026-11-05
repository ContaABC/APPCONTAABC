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
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8 transition-colors duration-300">
      
      {/* Encabezado Principal Compacto */}
      <header className="max-w-7xl mx-auto mb-6 backdrop-blur-md bg-white/70 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 px-6 py-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/10 dark:bg-blue-500/10 rounded-xl border border-blue-600/20 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-900 via-blue-900 to-zinc-700 dark:from-white dark:via-blue-200 dark:to-zinc-400 bg-clip-text text-transparent">
              ContaABC
            </h1>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Portal de Gestión Financiera y Contable NIIF
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold hidden sm:inline">Estado:</span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">En Línea</span>
        </div>
      </header>

      {/* Cuadrícula optimizada: 4 columnas en pantallas grandes para evitar scroll */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* GRUPO 1: CONFIGURACIÓN (Compacto) */}
        <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Settings className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold tracking-tight">Configuración</h2>
            </div>
            <ul className="space-y-2 text-xs font-medium">
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
                  <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center justify-between py-0.5">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-indigo-600 transition-colors"></span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5" /> Parámetros
          </div>
        </div>

        {/* GRUPO 2 & 3 UNIDOS / COMPACTOS: PROVEEDORES Y TESORERÍA */}
        <div className="space-y-5 flex flex-col justify-between">
          
          {/* Proveedores */}
          <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md hover:border-amber-500/30 transition-all duration-300">
            <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400">
                <Truck className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold tracking-tight">Proveedores</h2>
            </div>
            <ul className="space-y-2 text-xs font-medium">
              {[
                { name: "Cargar Facturas", href: "/facturas/cargar" },
                { name: "Consultar Facturas", href: "/facturas/consultar" },
                { name: "Notas de Facturas", href: "/facturas/notas" },
              ].map((item, idx) => (
                <li key={idx}>
                  <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition flex items-center justify-between py-0.5">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-amber-600 transition-colors"></span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tesorería */}
          <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md hover:border-purple-500/30 transition-all duration-300">
            <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-lg text-purple-600 dark:text-purple-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold tracking-tight">Tesorería</h2>
            </div>
            <ul className="space-y-2 text-xs font-medium">
              {[
                { name: "Nuevo Cobro", href: "/cobros/nuevo" },
                { name: "Pagos", href: "/tesoreria/pagos" },
                { name: "Consignaciones", href: "/tesoreria/consignaciones" },
              ].map((item, idx) => (
                <li key={idx}>
                  <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition flex items-center justify-between py-0.5">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-purple-600 transition-colors"></span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* GRUPO 4: CLIENTES */}
        <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold tracking-tight">Clientes</h2>
            </div>
            <ul className="space-y-2 text-xs font-medium">
              {[
                { name: "Emitir Facturas", href: "/facturas/emitir" },
                { name: "Facturas Emitidas", href: "/facturas-emitidas" },
                { name: "Gestión de Ítems", href: "/items" },
                { name: "Notas Emitidas", href: "/notas-emitidas" },
                { name: "Nueva Nota Emitida", href: "/notas-emitidas/nueva" },
              ].map((item, idx) => (
                <li key={idx}>
                  <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center justify-between py-0.5">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-emerald-600 transition-colors"></span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Ingresos
          </div>
        </div>

        {/* GRUPO 5: CONTABILIDAD Y REPORTES NIIF (Ocupa 2 columnas en pantallas grandes para equilibrar) */}
        <div className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all duration-300 flex flex-col justify-between lg:col-span-2">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold tracking-tight">Contabilidad y Reportes NIIF</h2>
              </div>
              
              {/* Botón de Nueva Transacción integrado de manera compacta */}
              <Link
                href="/transacciones/nueva"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition shadow-sm hover:shadow-blue-500/25 flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Nueva Transacción</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs font-medium">
              <ul className="space-y-2">
                {[
                  { name: "Consultas Generales", href: "/consultas" },
                  { name: "Movimientos Contables", href: "/consultas/movimientos" },
                  { name: "Reportes Financieros", href: "/consultas/reportes" },
                  { name: "Documentos Contables", href: "/documentos" },
                  { name: "Balance General", href: "/balance_general" },
                  { name: "Estado de Resultados", href: "/estado-resultados" },
                ].map((item, idx) => (
                  <li key={idx}>
                    <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center justify-between py-0.5">
                      <span className="flex items-center gap-2 truncate">
                        <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-blue-600 transition-colors"></span>
                        <span className="truncate">{item.name}</span>
                      </span>
                      <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="space-y-2">
                {[
                  { name: "Declaración de Retenciones", href: "/retenciones/declaracion" },
                  { name: "Certificados de Retención", href: "/retenciones/Certificados" },
                  { name: "Conceptos de Retención", href: "/retenciones/conceptos" },
                  { name: "Consultas por Conceptos NIIF", href: "/consultas/conceptos_niif" },
                  { name: "Cierres Contables", href: "/cierres" },
                ].map((item, idx) => (
                  <li key={idx}>
                    <Link href={item.href} className="group/link text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center justify-between py-0.5">
                      <span className="flex items-center gap-2 truncate">
                        <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/link:bg-blue-600 transition-colors"></span>
                        <span className="truncate">{item.name}</span>
                      </span>
                      <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Estructura Oficial NIIF, Retenciones y Cierres
          </div>
        </div>

      </div>
    </main>
  );
}