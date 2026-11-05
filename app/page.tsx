import Link from "next/link";
import { 
  Settings, 
  Users, 
  Truck, 
  DollarSign, 
  BarChart3, 
  Search, 
  ShieldCheck, 
  ArrowRight
} from "lucide-react";

export default function Home() {
  const grupos = [
    {
      nombre: "Configuración",
      ruta: "#",
      icono: Settings,
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50",
      opciones: [
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
      ]
    },
    {
      nombre: "Proveedores",
      ruta: "#",
      icono: Truck,
      color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50",
      opciones: [
        { name: "Facturas de Proveedores", href: "/facturas/cargar" },
        { name: "Consultar Facturas", href: "/facturas/consultar" },
        { name: "Notas de Proveedores", href: "/facturas/notas" },
      ]
    },
    {
      nombre: "Clientes",
      ruta: "#",
      icono: Users,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50-50 dark:bg-emerald-950/50",
      opciones: [
        { name: "Facturas para Clientes", href: "/facturas/emitir" },
        { name: "Consulta Facturas Clientes", href: "/facturas-emitidas" },
        { name: "Recibos de Caja Clientes", href: "/cobros/nuevo" },
        { name: "Items de Facturación", href: "/items" },
        { name: "Notas para Clientes", href: "/notas-emitidas" },
        { name: "Consulta de Notas Clientes", href: "/notas-emitidas/nueva" },
      ]
    },
    {
      nombre: "Tesorería",
      ruta: "#",
      icono: DollarSign,
      color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50",
      opciones: [
        { name: "Egresos", href: "/tesoreria/pagos" },
        { name: "Consignaciones", href: "/tesoreria/consignaciones" },
      ]
    },
    {
      nombre: "Consultas",
      ruta: "#",
      icono: Search,
      color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50",
      opciones: [
        { name: "Consulta y Verificación de Saldos", href: "/consultas" },
        { name: "Consulta de Movimientos", href: "/consultas/movimientos" },
        { name: "Reportes Contables", href: "/consultas/reportes" },
        { name: "Consulta de Conceptos NIIF", href: "/consultas/conceptos_niif" },
      ]
    },
    {
      nombre: "Contabilidad",
      ruta: "#",
      icono: BarChart3,
      color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50",
      opciones: [
        { name: "Reportes Contables", href: "/documentos" },
        { name: "Balance General", href: "/balance_general" },
        { name: "Estado de Resultados", href: "/estado-resultados" },
        { name: "Declaración de Retenciones", href: "/retenciones/declaracion" },
        { name: "Certificados de Retención", href: "/retenciones/Certificados" },
        { name: "Conceptos de Retención", href: "/retenciones/conceptos" },
        { name: "Cierres Contables", href: "/cierres" },
      ]
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-8">
      
      {/* Encabezado ultra compacto */}
      <header className="max-w-7xl mx-auto mb-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-6 py-3 rounded-xl shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight">ContaABC — Menú Principal</h1>
        </div>
        <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">En Línea</span>
      </header>

      {/* Cuadrícula compacta de 3 columnas para que quepa todo sin scroll excesivo */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {grupos.map((grupo, index) => {
          const IconComponent = grupo.icono;
          return (
            <div 
              key={index}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Cabecera de Tarjeta */}
                <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
                  <div className={`p-2 rounded-lg ${grupo.color}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold">{grupo.nombre}</h2>
                </div>

                {/* Lista directa de opciones funcionales */}
                <ul className="space-y-1.5 text-xs font-medium">
                  {grupo.opciones.map((op, i) => (
                    <li key={i}>
                      <Link 
                        href={op.href} 
                        className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="w-1 h-1 rounded-full bg-zinc-400"></span>
                          <span className="truncate">{op.name}</span>
                        </span>
                        <ArrowRight className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}