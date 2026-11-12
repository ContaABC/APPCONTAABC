'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { UserCheck, LogOut, Building2, MapPin } from 'lucide-react';

interface UsuarioPerfil {
  nombres?: string;
  apellidos?: string;
  tipo_usuario?: string;
  empresa_id?: number | string;
  sucursal_id?: number | string;
  [key: string]: unknown;
}

interface ModuloItem {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  activo: boolean;
  ruta: string;
  color: string;
}

export default function ModulosMayoresPage() {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<UsuarioPerfil | null>(null);
  const [verificando, setVerificando] = useState<boolean>(true);
  
  // Estados para empresa y sucursal activa
  const [empresaActivaNombre, setEmpresaActivaNombre] = useState<string>("Seleccione Empresa");
  const [sucursalActivaNombre, setSucursalActivaNombre] = useState<string>("Seleccione Sucursal");

  useEffect(() => {
    async function verificarSesionYContexto() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        router.replace('/login');
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // 1. Consultar sesión activa
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session || !session.user) {
        router.replace('/login');
        return;
      }

      // 2. Cargar perfil del usuario desde Supabase
      const { data: perfil } = await supabase
        .from("usuarios_perfiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      let empresaIdAsignada = perfil?.empresa_id || null;
      let sucursalIdAsignada = perfil?.sucursal_id || null;

      if (perfil) {
        setUsuarioActual(perfil as UsuarioPerfil);
      } else {
        setUsuarioActual({ nombres: session.user.email, tipo_usuario: "Operador" });
      }

      // 3. Obtener nombres desde localStorage (si ya pasó por la pantalla de selección) o consultarlos de la BD
      let nombreEmpresa = typeof window !== 'undefined' ? localStorage.getItem("empresa_activa_nombre") : null;
      let nombreSucursal = typeof window !== 'undefined' ? localStorage.getItem("sucursal_activa_nombre") : null;

      // Si no están en localStorage, consultamos directamente las tablas usando los IDs del perfil o asignaciones
      if (!nombreEmpresa && empresaIdAsignada) {
        const { data: empData } = await supabase
          .from("empresas")
          .select("razon_social, nombre_comercial")
          .eq("id", empresaIdAsignada)
          .single();

        if (empData) {
          nombreEmpresa = empData.razon_social || empData.nombre_comercial;
          localStorage.setItem("empresa_activa_nombre", nombreEmpresa || "");
        }
      }

      if (!nombreSucursal && sucursalIdAsignada) {
        const { data: sucData } = await supabase
          .from("sucursales")
          .select("nombre")
          .eq("id", sucursalIdAsignada)
          .single();

        if (sucData) {
          nombreSucursal = sucData.nombre;
          localStorage.setItem("sucursal_activa_nombre", nombreSucursal || "");
        }
      }

      setEmpresaActivaNombre(nombreEmpresa || "Empresa Principal NIIF");
      setSucursalActivaNombre(nombreSucursal || "Sucursal Principal");
      
      setVerificando(false);
    }

    verificarSesionYContexto();
  }, [router]);

  const handleLogout = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      await supabase.auth.signOut({ scope: 'global' });

      if (typeof window !== 'undefined') {
        window.sessionStorage.clear();
        window.localStorage.clear();
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      }

      window.location.href = "/login";
    }
  };

  const tipoUsuarioLower = usuarioActual?.tipo_usuario?.toLowerCase() || "";
  const esAdministrador = tipoUsuarioLower === 'administrador';

  // Definición base de módulos mayores
  const modulosDisponibles: ModuloItem[] = [
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
      activo: esAdministrador,
      ruta: '/modulos/gestion-financiera',
      color: esAdministrador
        ? 'border-indigo-500 bg-indigo-50/30 text-indigo-900 hover:bg-indigo-50'
        : 'border-zinc-200 bg-zinc-50/50 text-zinc-400'
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

  const handleModuloClick = (modulo: ModuloItem) => {
    if (!modulo.activo) {
      if (!esAdministrador && modulo.id === 'gestion-financiera') {
        alert('Acceso restringido. Su perfil de operador no cuenta con autorización para ingresar a Gestión Financiera.');
      } else {
        alert(`El módulo de ${modulo.titulo} se encuentra en fase de desarrollo próximo.`);
      }
      return;
    }
    router.push(modulo.ruta);
  };

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
        Verificando credenciales de acceso...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* BARRA SUPERIOR ORGANIZADA */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-3xl shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        
        {/* BLOQUE IZQUIERDA: TÍTULO */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-gray-800 dark:text-zinc-100 tracking-tight">Sistema ERP Financiero y Contable</h1>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-200">ContaABC</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            Seleccione un Módulo Mayor para ingresar a sus respectivas operaciones y submódulos.
          </p>
        </div>

        {/* BLOQUE DERECHA: EMPRESA, SUCURSAL Y USUARIO */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
          
          {/* CÁPSULA DE EMPRESA Y SUCURSAL ACTIVA */}
          <div className="flex items-center gap-2.5 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-700 text-xs">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate max-w-[150px]">{empresaActivaNombre}</span>
            </div>
            <span className="text-zinc-300 dark:text-zinc-600">|</span>
            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span className="truncate max-w-[120px]">{sucursalActivaNombre}</span>
            </div>
          </div>

          {/* PERFIL DE USUARIO */}
          {usuarioActual && (
            <div className="flex items-center gap-2.5 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-700 text-xs">
              <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-zinc-800 dark:text-zinc-200 leading-tight">{usuarioActual.nombres || ""} {usuarioActual.apellidos || ""}</p>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{usuarioActual.tipo_usuario}</span>
              </div>
            </div>
          )}

          {/* BOTÓN SALIR */}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl border border-red-200 transition shadow-sm cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>

      </div>

      {/* CUADRÍCULA DE MÓDULOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulosDisponibles.map((mod) => (
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
                  {mod.activo ? 'Operativo' : (mod.id === 'gestion-financiera' ? 'Restringido' : 'Próximamente')}
                </span>
              </div>
              <h2 className="text-base font-bold mb-1">{mod.titulo}</h2>
              <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">{mod.descripcion}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold">
              <span className={mod.activo ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}>
                {mod.activo ? 'Ingresar al módulo →' : (mod.id === 'gestion-financiera' ? '🔒 Acceso Restringido' : 'En desarrollo')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}