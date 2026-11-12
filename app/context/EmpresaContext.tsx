"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";

interface EmpresaContextType {
  empresasPermitidas: any[];
  sucursalesPermitidas: any[];
  empresaActiva: string;
  sucursalActiva: string;
  setEmpresaActiva: (id: string) => void;
  setSucursalActiva: (id: string) => void;
  bloquearSelectores: boolean;
  cargandoContexto: boolean;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresasPermitidas, setEmpresasPermitidas] = useState<any[]>([]);
  const [sucursalesPermitidas, setSucursalesPermitidas] = useState<any[]>([]);
  const [empresaActiva, setEmpresaActivaState] = useState("");
  const [sucursalActiva, setSucursalActivaState] = useState("");
  const [bloquearSelectores, setBloquearSelectores] = useState(false);
  const [cargandoContexto, setCargandoContexto] = useState(true);

  useEffect(() => {
    cargarPermisosGlobales();
  }, []);

  const cargarPermisosGlobales = async () => {
    setCargandoContexto(true);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCargandoContexto(false);
      return;
    }

    // 1. Verificar si es Administrador
    const { data: perfil } = await supabase
      .from("usuarios_perfiles")
      .select("tipo_usuario")
      .eq("id", user.id)
      .single();

    let empIds: number[] = [];
    let sucIds: number[] = [];

    if (perfil?.tipo_usuario === 'Administrador') {
      const { data: eData } = await supabase.from("empresas").select("*");
      const { data: sData } = await supabase.from("sucursales").select("*").eq("estado", "Activa");
      
      setEmpresasPermitidas(eData || []);
      setSucursalesPermitidas(sData || []);
    } else {
      // 2. Traer asignaciones estrictas del usuario
      const { data: asignaciones } = await supabase
        .from("usuario_asignaciones")
        .select("empresa_id, sucursal_id")
        .eq("usuario_id", user.id);

      if (asignaciones && asignaciones.length > 0) {
        empIds = Array.from(new Set(asignaciones.map(a => a.empresa_id).filter(Boolean)));
        sucIds = Array.from(new Set(asignaciones.map(a => a.sucursal_id).filter(Boolean)));

        const { data: eData } = await supabase.from("empresas").select("*").in("id", empIds);
        const { data: sData } = await supabase.from("sucursales").select("*").in("id", sucIds).eq("estado", "Activa");

        setEmpresasPermitidas(eData || []);
        setSucursalesPermitidas(sData || []);
      }
    }

    // 3. Cargar lo que se seleccionó en el login
    const empresaLogin = localStorage.getItem("empresa_activa") || "";
    const sucursalLogin = localStorage.getItem("sucursal_activa") || "";

    setEmpresaActivaState(empresaLogin);
    setSucursalActivaState(sucursalLogin);

    // 4. Regla de bloqueo masivo si solo tiene 1 sucursal
    if (perfil?.tipo_usuario !== 'Administrador' && sucIds.length <= 1) {
      setBloquearSelectores(true);
    }

    setCargandoContexto(false);
  };

  const setEmpresaActiva = (id: string) => {
    setEmpresaActivaState(id);
    localStorage.setItem("empresa_activa", id);
  };

  const setSucursalActiva = (id: string) => {
    setSucursalActivaState(id);
    localStorage.setItem("sucursal_activa", id);
  };

  return (
    <EmpresaContext.Provider
      value={{
        empresasPermitidas,
        sucursalesPermitidas,
        empresaActiva,
        sucursalActiva,
        setEmpresaActiva,
        setSucursalActiva,
        bloquearSelectores,
        cargandoContexto,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresaContext() {
  const context = useContext(EmpresaContext);
  if (!context) throw new Error("useEmpresaContext debe usarse dentro de un EmpresaProvider");
  return context;
}