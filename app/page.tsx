'use client';

import { useRouter } from 'next/navigation';

export default function ModulosMayoresPage() {
  const router = useRouter();

  // Definición de los Módulos Mayores basados en tu estructura de directorios
  const modulosMayores = [
    {
      id: 'contabilidad',
      titulo: 'Contabilidad y Finanzas',
      descripcion: 'Gestión de NIIF, PUC, clientes, proveedores, transacciones contables y tesorería.',
      icono: '📊',
      activo: true,
      ruta: '/modulos/contabilidad',
      color: 'border-blue-500 bg-blue-50/30 text-blue-900 hover:bg-blue-50'
    },
    {
      id: 'gestion-financiera',
      titulo: 'Gestión Financiera',
      descripcion: 'Módulo especializado e independiente de análisis y control financiero.',
      icono: '💼',
      activo: true, // Ya lo separaste e independizaste
      ruta: '/modulos/gestion-financiera',
      color: 'border-indigo-500 bg-indigo-50/30 text-indigo-900 hover:bg-indigo-50'
    },
    {
      id: 'presupuesto',
      titulo: 'Presupuesto',
      descripcion: 'Control presupuestal, ejecución de gastos, ingresos y proyecciones.',
      icono: '📈',
      activo: false,
      ruta: '/modulos/presupuesto',
      color: 'border-gray-200 bg-gray-50/50 text-gray-400'
    },
    {
      id: 'inventarios',
      titulo: 'Inventarios y Bodegas',
      descripcion: 'Control de stock, entradas, salidas, costos ponderados y almacenes.',
      icono: '📦',
      activo: false,
      ruta: '/modulos/inventarios',
      color: 'border-gray-200 bg-gray-50/50 text-gray-400'
    },
    {
      id: 'activos-fijos',
      titulo: 'Activos Fijos',
      descripcion: 'Depreciaciones, fichas de bienes, placas de control y trazabilidad.',
      icono: '🏢',
      activo: false,
      ruta: '/modulos/activos-fijos',
      color: 'border-gray-200 bg-gray-50/50 text-gray-400'
    },
    {
      id: 'nomina',
      titulo: 'Nómina y RRHH',
      descripcion: 'Liquidación de haberes, seguridad social, prestaciones y parafiscales.',
      icono: '👥',
      activo: false,
      ruta: '/modulos/nomina',
      color: 'border-gray-200 bg-gray-50/50 text-gray-400'
    },
    {
      id: 'cartera',
      titulo: 'Cartera y Cobranza',
      descripcion: 'Gestión de cuentas por cobrar, edades de cartera y recaudo.',
      icono: '💳',
      activo: false,
      ruta: '/modulos/cartera',
      color: 'border-gray-200 bg-gray-50/50 text-gray-400'
    }
  ];

  const handleModuloClick = (modulo: typeof modulosMayores[0]) => {
    if (modulo.activo) {
      router.push(modulo.ruta);
    } else {
      alert(`El módulo de ${modulo.titulo} se encuentra en fase de desarrollo próximo.`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Encabezado Principal compacto */}
      <div className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-black text-gray-800 tracking-tight">
          ContaABC: Sistema ERP Financiero y Contable
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Seleccione un Módulo para ingresar a sus respectivas operaciones y submódulos.
        </p>
      </div>

      {/* Cuadrícula de Módulos Mayores con marcos compactos y organizados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulosMayores.map((mod) => (
          <div
            key={mod.id}
            onClick={() => handleModuloClick(mod)}
            className={`p-5 rounded-lg border transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm ${mod.color} ${
              mod.activo ? 'hover:shadow-md hover:scale-[1.01]' : 'opacity-75 cursor-not-allowed'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">{mod.icono}</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  mod.activo ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {mod.activo ? 'Operativo' : 'Próximamente'}
                </span>
              </div>
              <h2 className="text-base font-bold mb-1">{mod.titulo}</h2>
              <p className="text-xs text-gray-600 leading-relaxed">{mod.descripcion}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-xs font-semibold">
              <span className={mod.activo ? 'text-blue-600' : 'text-gray-400'}>
                {mod.activo ? 'Ingresar al módulo →' : 'En desarrollo'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}