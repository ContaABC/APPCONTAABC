import Link from "next/link";
import { 
  Settings, 
  Users, 
  Truck, 
  DollarSign, 
  BarChart3, 
  Search, 
  ShieldCheck, 
  ArrowRight,
  FolderTree
} from "lucide-react";

export default function Home() {
  // Definición de los 6 grupos principales con sus rutas y descripciones basadas en tu menú
  const grupos = [
    {
      nombre: "Configuración",
      descripcion: "Empresas, terceros, clases de documentos, sucursales y conceptos NIIF.",
      ruta: "#configuracion", // O puedes crear una ruta dedicada como /modulos/configuracion
      icono: Settings,
      color: "from-indigo-500/20 to-indigo-600/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
      elementos: ["Empresas", "Terceros", "Clases de Documentos", "Sucursales", "Conceptos NIIF", "Y más..."]
    },
    {
      nombre: "Proveedores",
      descripcion: "Carga y consulta de facturas de proveedores y sus respectivas notas.",
      ruta: "#proveedores",
      icono: Truck,
      color: "from-amber-500/20 to-amber-600/5 text-amber-600 dark:text-amber-400 border-amber-500/30",
      elementos: ["Facturas de Proveedores", "Consultar Facturas", "Notas de Proveedores"]
    },
    {
      nombre: "Clientes",
      descripcion: "Gestión de facturación a clientes, ítems, recibos y notas emitidas.",
      ruta: "#clientes",
      icono: Users,
      color: "from-emerald-500/20 to-emerald-600/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      elementos: ["Facturas para Clientes", "Recibos de Caja", "Items de Facturación", "Notas Clientes"]
    },
    {
      nombre: "Tesorería",
      descripcion: "Control de flujo de caja, egresos, pagos y consignaciones bancarias.",
      ruta: "#tesoreria",
      icono: DollarSign,
      color: "from-purple-500/20 to-purple-600/5 text-purple-600 dark:text-purple-400 border-purple-500/30",
      elementos: ["Egresos", "Consignaciones", "Pagos"]
    },
    {
      nombre: "Consultas",
      descripcion: "Verificación de saldos, movimientos contables y reportes detallados.",
      ruta: "#consultas",
      icono: Search,
      color: "from-cyan-500/20 to-cyan-600/5 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
      elementos: ["Consulta de Saldos", "Movimientos", "Reportes Contables", "Conceptos NIIF"]
    },
    {
      nombre: "Contabilidad",
      descripcion: "Balance general, estado de resultados, retenciones y cierres contables.",
      ruta: "#contabilidad",
      icono: BarChart3,
      color: "from-blue-500/20 to-blue-600/5 text-blue-600 dark:text-blue-400 border-blue-500/30",
      elementos: ["Balance General", "Estado de Resultados", "Declaración Retenciones", "Cierres"]
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12 transition-colors duration-300">
      
      {/* Encabezado Principal */}
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
              Portal de Gestión Financiera y Contable NIIF — Seleccione un grupo
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Estado:</span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">En Línea</span>
        </div>
      </header>

      {/* Cuadrícula de Grupos Principales */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {grupos.map((grupo, index) => {
          const IconComponent = grupo.icono;
          return (
            <div 
              key={index}
              className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-8 shadow-sm hover:shadow-xl hover:border-blue-500/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Icono y Título */}
                <div className="flex items-center gap-4 mb-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div className={`p-3.5 rounded-2xl border bg-gradient-to-br ${grupo.color}`}>
                    <IconComponent className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{grupo.nombre}</h2>
                  </div>
                </div>

                {/* Descripción */}
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                  {grupo.descripcion}
                </p>

                {/* Vista previa de opciones */}
                <div className="space-y-1.5 mb-6">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Incluye:</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {grupo.elementos.map((el, i) => (
                      <span key={i} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2.5 py-1 rounded-lg">
                        {el}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botón de Acceso */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Link
                  href={grupo.ruta}
                  className="w-full bg-zinc-900 hover:bg-blue-600 dark:bg-zinc-800 dark:hover:bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-between group-hover:shadow-md"
                >
                  <span>Ingresar a {grupo.nombre}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}