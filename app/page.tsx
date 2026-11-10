'use client';

// FUERZA A VERCEL A NO CACHEAR ESTA PÁGINA Y VALIDAR SIEMPRE
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { UserCheck, LogOut, ShieldCheck } from 'lucide-react';

export default function ModulosMayoresPage() {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<any>(null);

  useEffect(() => {
    async function cargarDatosUsuario() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: perfil } = await supabase
          .from("usuarios_perfiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (perfil) {
          setUsuarioActual(perfil);
        } else {
          setUsuarioActual({ nombres: user.email, tipo_usuario: "Usuario" });
        }
      }
    }
    cargarDatosUsuario();
  }, []);

  const handleLogout = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    }
  };

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
      activo: true,
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
      
      {/* Encabezado General con Identidad, Sesión y Botón Salir */}
      <div className="mb-8 border-b border-gray-200 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Sistema ERP Financiero y Contable</h1>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-200">ContaABC</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Seleccione un Módulo Mayor para ingresar a sus respectivas operaciones y submódulos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {usuarioActual && (
            <div className="flex items-center gap-2.5 bg-white px-4 py-2 rounded-2xl border border-zinc-200 shadow-sm">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <div className="text-xs">
                <p className="font-bold text-zinc-800">{usuarioActual.nombres} {usuarioActual.apellidos}</p>
                <span className="text-[10px] text-blue-600 font-semibold uppercase">{usuarioActual.tipo_usuario}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl border border-red-200 transition shadow-sm"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </div>

      {/* Cuadrícula de Módulos Mayores */}
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