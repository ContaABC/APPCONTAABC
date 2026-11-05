import Link from "next/link";
import { 
  Settings, 
  Users, 
  Truck, 
  DollarSign, 
  BarChart3, 
  ShieldCheck 
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-10">
      {/* Encabezado del Sistema */}
      <header className="max-w-7xl mx-auto mb-10 border-b pb-6 border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            ContaABC — Portal de Gestión Contable NIIF
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Selecciona un módulo o transacción para comenzar a operar en el sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/transacciones/nueva"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm flex items-center gap-2"
          >
            <span>+ Nueva Transacción</span>
          </Link>
        </div>
      </header>

      {/* Contenedor de Grupos de Enlaces */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* GRUPO 1: CONFIGURACIÓN */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <Settings className="w-6 h-6 text-indigo-500" />
              <h2 className="text-lg font-bold">Configuración</h2>
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/api/empresas/nueva" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Nueva Empresa
                </Link>
              </li>
              <li>
                <Link href="/terceros" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Terceros
                </Link>
              </li>
              <li>
                <Link href="/configuracion/clases-documento" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Clases de Documento
                </Link>
              </li>
              <li>
                <Link href="/Sucursales" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Sucursales
                </Link>
              </li>
              <li>
                <Link href="/ConceptosNiif" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Conceptos NIIF
                </Link>
              </li>
              <li>
                <Link href="/subconceptos_niif" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Subconceptos NIIF
                </Link>
              </li>
              <li>
                <Link href="/ActividadesABC" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Actividades ABC
                </Link>
              </li>
              <li>
                <Link href="/actividades_auxiliares" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Actividades Auxiliares
                </Link>
              </li>
              <li>
                <Link href="/conceptos_auxiliares" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Conceptos Auxiliares
                </Link>
              </li>
              <li>
                <Link href="/clase_documento_conceptos" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Relación Clases y Conceptos
                </Link>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
            Módulo de Parámetros Generales
          </div>
        </div>

        {/* GRUPO 2: PROVEEDORES */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <Truck className="w-6 h-6 text-amber-500" />
              <h2 className="text-lg font-bold">Proveedores</h2>
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/facturas/cargar" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Cargar Facturas
                </Link>
              </li>
              <li>
                <Link href="/facturas/consultar" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Consultar Facturas
                </Link>
              </li>
              <li>
                <Link href="/facturas/notas" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Notas de Facturas
                </Link>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
            Gestión de Costos y Cuentas por Pagar
          </div>
        </div>

        {/* GRUPO 3: CLIENTES */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <Users className="w-6 h-6 text-emerald-500" />
              <h2 className="text-lg font-bold">Clientes</h2>
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/facturas/emitir" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Emitir Facturas
                </Link>
              </li>
              <li>
                <Link href="/facturas-emitidas" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Facturas Emitidas
                </Link>
              </li>
              <li>
                <Link href="/items" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Gestión de Ítems
                </Link>
              </li>
              <li>
                <Link href="/notas-emitidas" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Notas Emitidas
                </Link>
              </li>
              <li>
                <Link href="/notas-emitidas/nueva" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Nueva Nota Emitida
                </Link>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
            Facturación e Ingresos Operacionales
          </div>
        </div>

        {/* GRUPO 4: TESORERÍA */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <DollarSign className="w-6 h-6 text-purple-500" />
              <h2 className="text-lg font-bold">Tesorería</h2>
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/cobros/nuevo" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Nuevo Cobro
                </Link>
              </li>
              <li>
                <Link href="/tesoreria/pagos" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Pagos
                </Link>
              </li>
              <li>
                <Link href="/tesoreria/consignaciones" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Consignaciones
                </Link>
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
            Control de Flujo de Caja y Bancos
          </div>
        </div>

        {/* GRUPO 5: CONTABILIDAD */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between md:col-span-2 lg:col-span-2">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              <h2 className="text-lg font-bold">Contabilidad y Reportes NIIF</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <ul className="space-y-2.5">
                <li>
                  <Link href="/consultas" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Consultas Generales
                  </Link>
                </li>
                <li>
                  <Link href="/consultas/movimientos" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Movimientos Contables
                  </Link>
                </li>
                <li>
                  <Link href="/consultas/reportes" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Reportes Financieros
                  </Link>
                </li>
                <li>
                  <Link href="/documentos" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Documentos Contables
                  </Link>
                </li>
                <li>
                  <Link href="/balance_general" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Balance General
                  </Link>
                </li>
                <li>
                  <Link href="/estado-resultados" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Estado de Resultados
                  </Link>
                </li>
              </ul>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/retenciones/declaracion" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Declaración de Retenciones
                  </Link>
                </li>
                <li>
                  <Link href="/retenciones/Certificados" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Certificados de Retención
                  </Link>
                </li>
                <li>
                  <Link href="/retenciones/conceptos" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Conceptos de Retención
                  </Link>
                </li>
                <li>
                  <Link href="/consultas/conceptos_niif" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Consultas por Conceptos NIIF
                  </Link>
                </li>
                <li>
                  <Link href="/cierres" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Cierres Contables
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
            Estructura Financiera Oficial, Retenciones y Cierres
          </div>
        </div>

      </div>
    </main>
  );
}