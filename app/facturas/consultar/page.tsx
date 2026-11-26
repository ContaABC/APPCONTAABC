"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
  setEmpresaActivaUsuario,
  setSucursalActivaUsuario,
} from "@/app/actions/accionesEmpresas";
import {
  obtenerSucursales,
  obtenerFacturasRecibidas,
  obtenerAsientoPorFactura,
} from "./actions-facturas";

interface Empresa {
  id: number | string;
  empresa_id?: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
  nit?: string;
  nit_identificacion?: string;
  numero_identificacion?: string;
  dv?: string;
}

interface Sucursal {
  id: number | string;
  nombre: string;
  codigo?: string;
  codigo_sucursal?: string;
}

interface FacturaItem {
  id: string | number;
  numero_factura?: string;
  tercero_nit?: string;
  tercero_nombre?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  subtotal?: number;
  impuestos?: number;
  valor_retencion_renta?: number;
  retencion_renta?: number;
  valor_retencion_iva?: number;
  retencion_iva?: number;
  valor_retencion_ica?: number;
  retencion_ica?: number;
  total_factura?: number;
  saldo_pendiente?: number;
  estado_pago?: string;
  estado_dian?: string;
  cufe_cude?: string;
}

interface GrupoProveedor {
  proveedor: string;
  nit: string;
  items: FacturaItem[];
  subtotalBase: number;
  subtotalIva: number;
  subtotalRenta: number;
  subtotalIvaRet: number;
  subtotalIca: number;
  subtotalTotal: number;
}

interface ConceptoAuxiliar {
  codigo_auxiliar?: string;
  nombre?: string;
}

interface AsientoDetalle {
  id: number | string;
  concepto_auxiliar_id: number | string;
  debito: number;
  credito: number;
  conceptos_auxiliares?: ConceptoAuxiliar[] | ConceptoAuxiliar | null;
}

interface AsientoData {
  transaccion: {
    numero_documento: string;
    fecha_emision: string;
    fecha_contable?: string;
    fecha?: string;
    glosa_concepto: string;
  };
  detalles: AsientoDetalle[];
}

interface FilaExcelFactura {
  Proveedor?: string;
  NIT?: string;
  "N° Factura"?: string;
  "Fecha Emisión"?: string;
  "Estado Pago"?: string;
  Subtotal?: number;
  IVA?: number;
  "Ret. Renta"?: number;
  "Ret. IVA"?: number;
  "Ret. ICA"?: number;
  "Total Factura"?: number;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function setCookieValue(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=86400; SameSite=Lax`;
}

function clearCookieValue(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function getNitEmpresa(emp: Empresa): string {
  const baseNit =
    emp.nit_identificacion || emp.nit || emp.numero_identificacion || "";
  if (!baseNit) return "";
  return emp.dv ? `${baseNit}-${emp.dv}` : String(baseNit);
}

function getNombreEmpresa(emp: Empresa): string {
  return emp.razon_social || emp.nombre_comercial || emp.nombre || "";
}

function obtenerUsuarioIdDesdeLocalStorage(): string | null {
  if (typeof window === "undefined") return null;

  const clavesDirectas = ["usuario_id", "user_id", "uid"];
  for (const clave of clavesDirectas) {
    const val = localStorage.getItem(clave);
    if (val && val.trim()) return val.trim();
  }

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.includes("auth-token") || k.includes("supabase")) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const idEncontrado =
          parsed?.user?.id ||
          parsed?.currentSession?.user?.id ||
          parsed?.session?.user?.id ||
          null;
        if (idEncontrado && typeof idEncontrado === "string") {
          return idEncontrado;
        }
      } catch {
        // Ignorar entradas no JSON
      }
    }
  }
  return null;
}

export default function ConsultarFacturasPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);

  const [empresaId, setEmpresaId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("empresa_activa") ||
        localStorage.getItem("empresa_id") ||
        ""
      );
    }
    return "";
  });
  const [sucursalId, setSucursalId] = useState<string>("");

  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true);
  const [facturas, setFacturas] = useState<FacturaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState<string>("");
  const [estadoPago, setEstadoPago] = useState<string>("todos");
  const [mostrarSubtotales, setMostrarSubtotales] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [proveedoresExpandidos, setProveedoresExpandidos] = useState<{
    [key: string]: boolean;
  }>({});

  const [facturaSeleccionada, setFacturaSeleccionada] =
    useState<FacturaItem | null>(null);
  const [asiento, setAsiento] = useState<AsientoData | null>(null);
  const [loadingAsiento, setLoadingAsiento] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const cargarEmpresas = useCallback(async () => {
    setLoadingEmpresas(true);
    try {
      let uid: string | null = null;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) uid = user.id;
      } catch {
        // Continuar con getSession
      }

      if (!uid) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user?.id) uid = session.user.id;
        } catch {
          // Continuar con localStorage
        }
      }

      if (!uid) {
        uid = obtenerUsuarioIdDesdeLocalStorage();
      }

      setUsuarioId(uid);

      const permitidas = await getEmpresasPermitidas(uid);
      const listaEmpresas: Empresa[] = Array.isArray(permitidas)
        ? permitidas
        : [];

      if (listaEmpresas.length > 0) {
        const ordenadas = [...listaEmpresas].sort((a, b) =>
          getNombreEmpresa(a).localeCompare(getNombreEmpresa(b), "es", {
            sensitivity: "base",
          })
        );
        setEmpresas(ordenadas);

        let empresaActivaBD: string | null = null;
        try {
          const bdVal = await getEmpresaActivaUsuario(uid);
          if (bdVal !== null && bdVal !== undefined && String(bdVal).trim() !== "") {
            empresaActivaBD = String(bdVal).trim();
          }
        } catch {
          // Ignorar
        }

        const localEmp =
          typeof window !== "undefined"
            ? localStorage.getItem("empresa_activa") ||
              localStorage.getItem("empresa_id")
            : null;
        const cookieEmp = getCookieValue("empresa_activa");

        const candidata = empresaActivaBD || localEmp || cookieEmp;
        const existe = ordenadas.some(
          (e) => String(e.id || e.empresa_id) === String(candidata)
        );

        const empElegida =
          existe && candidata
            ? ordenadas.find(
                (e) => String(e.id || e.empresa_id) === String(candidata)
              ) || ordenadas[0]
            : ordenadas[0];

        const idFinal = String(empElegida.id || empElegida.empresa_id);
        const nombreFinal = getNombreEmpresa(empElegida);

        setEmpresaId(idFinal);
        if (typeof window !== "undefined") {
          localStorage.setItem("empresa_activa", idFinal);
          localStorage.setItem("empresa_id", idFinal);
          if (nombreFinal) {
            localStorage.setItem("empresa_activa_nombre", nombreFinal);
          }
        }
        setCookieValue("empresa_activa", idFinal);
      } else {
        setEmpresas([]);
        setEmpresaId("");
      }
    } catch (error) {
      console.error("Error al cargar empresas asignadas:", error);
      setErrorMsg("Error al cargar las empresas asignadas.");
      setEmpresas([]);
      setEmpresaId("");
    } finally {
      setLoadingEmpresas(false);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    cargarEmpresas();
  }, [isMounted, cargarEmpresas]);

  const handleCambioEmpresa = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const nuevaEmpresa = e.target.value;
    setErrorMsg(null);
    setEmpresaId(nuevaEmpresa);
    setSucursalId("");
    setSucursales([]);
    setFacturas([]);
    setBusqueda("");

    if (typeof window !== "undefined") {
      if (nuevaEmpresa) {
        const empSel = empresas.find(
          (item) => String(item.id || item.empresa_id) === String(nuevaEmpresa)
        );
        const nombreSel = empSel ? getNombreEmpresa(empSel) : "";

        localStorage.setItem("empresa_activa", nuevaEmpresa);
        localStorage.setItem("empresa_id", nuevaEmpresa);
        if (nombreSel) {
          localStorage.setItem("empresa_activa_nombre", nombreSel);
        }
        setCookieValue("empresa_activa", nuevaEmpresa);
      } else {
        localStorage.removeItem("empresa_activa");
        localStorage.removeItem("empresa_id");
        localStorage.removeItem("empresa_activa_nombre");
        clearCookieValue("empresa_activa");
      }

      localStorage.removeItem("sucursal_activa");
      localStorage.removeItem("sucursal_id");
      localStorage.removeItem("sucursal_activa_nombre");
      clearCookieValue("sucursal_activa");
    }

    if (nuevaEmpresa) {
      try {
        await setEmpresaActivaUsuario(nuevaEmpresa, usuarioId, null);
      } catch {
        // Ignorar si no aplica
      }
    }
  };

  const handleCambioSucursal = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const nuevaSucursal = e.target.value;
    setSucursalId(nuevaSucursal);
    setFacturas([]);
    setBusqueda("");

    if (typeof window !== "undefined") {
      if (nuevaSucursal) {
        const sucSel = sucursales.find(
          (item) => String(item.id) === String(nuevaSucursal)
        );
        localStorage.setItem("sucursal_activa", nuevaSucursal);
        localStorage.setItem("sucursal_id", nuevaSucursal);
        if (sucSel?.nombre) {
          localStorage.setItem("sucursal_activa_nombre", sucSel.nombre);
        }
        setCookieValue("sucursal_activa", nuevaSucursal);
      } else {
        localStorage.removeItem("sucursal_activa");
        localStorage.removeItem("sucursal_id");
        localStorage.removeItem("sucursal_activa_nombre");
        clearCookieValue("sucursal_activa");
      }
    }

    try {
      await setSucursalActivaUsuario(nuevaSucursal || null, usuarioId);
    } catch {
      // Ignorar si no aplica
    }
  };

  // Cargar Sucursales cuando cambia Empresa y validar sucursal activa
  useEffect(() => {
    if (!isMounted || !empresaId) {
      setSucursales([]);
      setSucursalId("");
      return;
    }

    let cancelado = false;

    async function cargarSucursales() {
      setSucursalId("");
      const res = await obtenerSucursales(empresaId);
      if (cancelado) return;

      if (res.success && Array.isArray(res.data)) {
        const listaSuc = res.data as Sucursal[];
        setSucursales(listaSuc);

        let sucActivaBD: string | null = null;
        try {
          const bdSuc = await getSucursalActivaUsuario(usuarioId);
          if (bdSuc !== null && bdSuc !== undefined && String(bdSuc).trim() !== "") {
            sucActivaBD = String(bdSuc).trim();
          }
        } catch {
          // Ignorar
        }

        const sucLocal =
          typeof window !== "undefined"
            ? localStorage.getItem("sucursal_activa") ||
              localStorage.getItem("sucursal_id")
            : null;
        const sucCookie = getCookieValue("sucursal_activa");

        const candidataSuc = sucActivaBD || sucLocal || sucCookie;
        const sucEncontrada = candidataSuc
          ? listaSuc.find((s) => String(s.id) === String(candidataSuc))
          : undefined;

        if (sucEncontrada) {
          const idSucFinal = String(sucEncontrada.id);
          setSucursalId(idSucFinal);
          if (typeof window !== "undefined") {
            localStorage.setItem("sucursal_activa", idSucFinal);
            localStorage.setItem("sucursal_id", idSucFinal);
            if (sucEncontrada.nombre) {
              localStorage.setItem("sucursal_activa_nombre", sucEncontrada.nombre);
            }
          }
          setCookieValue("sucursal_activa", idSucFinal);
        } else {
          // Si la sucursal guardada no pertenece a esta empresa, limpiarla para evitar cruces
          setSucursalId("");
          if (typeof window !== "undefined") {
            localStorage.removeItem("sucursal_activa");
            localStorage.removeItem("sucursal_id");
            localStorage.removeItem("sucursal_activa_nombre");
            clearCookieValue("sucursal_activa");
          }
          try {
            await setSucursalActivaUsuario(null, usuarioId);
          } catch {
            // Ignorar
          }
        }
      } else {
        setSucursales([]);
        setSucursalId("");
      }
    }

    cargarSucursales();

    return () => {
      cancelado = true;
    };
  }, [isMounted, empresaId, usuarioId]);

  // Cargar Facturas de Empresa/Sucursal
  const cargarFacturas = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setErrorMsg(null);
    const res = await obtenerFacturasRecibidas(empresaId, sucursalId);
    if (res.success && res.data) {
      setFacturas(res.data as FacturaItem[]);
      const initialExpanded: { [key: string]: boolean } = {};
      (res.data as FacturaItem[]).forEach((f: FacturaItem) => {
        const clave = f.tercero_nombre || f.tercero_nit || "Sin Proveedor";
        initialExpanded[clave] = true;
      });
      setProveedoresExpandidos(initialExpanded);
    } else {
      setErrorMsg(res.error || "Error al cargar facturas.");
    }
    setLoading(false);
  }, [empresaId, sucursalId]);

  async function abrirAsiento(factura: FacturaItem) {
    setFacturaSeleccionada(factura);
    setLoadingAsiento(true);
    setAsiento(null);

    const res = await obtenerAsientoPorFactura(factura.id);
    if (res.success && res.data) {
      setAsiento(res.data as AsientoData);
    } else {
      alert(res.error || "No se pudo cargar el asiento contable.");
    }
    setLoadingAsiento(false);
  }

  // Filtrado
  const facturasFiltradas = useMemo(() => {
    if (facturas.length === 0) return [];

    return facturas.filter((f) => {
      const estadoF = (f.estado_pago || "pendiente").toLowerCase();

      if (estadoPago !== "todos") {
        if (estadoPago === "pendiente" && !estadoF.includes("pendiente"))
          return false;
        if (estadoPago === "parcial" && !estadoF.includes("parcial"))
          return false;
        if (
          estadoPago === "pagado" &&
          estadoF !== "pagado" &&
          estadoF !== "pagada"
        )
          return false;
      }

      const term = busqueda.toLowerCase().trim();
      if (!term) return true;

      return (
        f.numero_factura?.toLowerCase().includes(term) ||
        f.tercero_nombre?.toLowerCase().includes(term) ||
        f.tercero_nit?.includes(term) ||
        f.cufe_cude?.toLowerCase().includes(term)
      );
    });
  }, [facturas, busqueda, estadoPago]);

  // Agrupar, Ordenar por Proveedor y Subtotalizar
  const { gruposPorProveedor, totalesGenerales } = useMemo(() => {
    const grupos: { [key: string]: GrupoProveedor } = {};

    let totalBaseGen = 0;
    let totalIvaGen = 0;
    let totalRentaGen = 0;
    let totalIvaRetGen = 0;
    let totalIcaGen = 0;
    let totalTotalGen = 0;

    facturasFiltradas.forEach((f) => {
      const clave = f.tercero_nombre || f.tercero_nit || "Sin Proveedor";
      if (!grupos[clave]) {
        grupos[clave] = {
          proveedor: clave,
          nit: f.tercero_nit || "",
          items: [],
          subtotalBase: 0,
          subtotalIva: 0,
          subtotalRenta: 0,
          subtotalIvaRet: 0,
          subtotalIca: 0,
          subtotalTotal: 0,
        };
      }

      const base = Number(f.subtotal || 0);
      const iva = Number(f.impuestos || 0);
      const renta = Number(f.valor_retencion_renta || f.retencion_renta || 0);
      const ivaRet = Number(f.valor_retencion_iva || f.retencion_iva || 0);
      const ica = Number(f.valor_retencion_ica || f.retencion_ica || 0);
      const total = Number(f.total_factura || 0);

      grupos[clave].items.push(f);
      grupos[clave].subtotalBase += base;
      grupos[clave].subtotalIva += iva;
      grupos[clave].subtotalRenta += renta;
      grupos[clave].subtotalIvaRet += ivaRet;
      grupos[clave].subtotalIca += ica;
      grupos[clave].subtotalTotal += total;

      totalBaseGen += base;
      totalIvaGen += iva;
      totalRentaGen += renta;
      totalIvaRetGen += ivaRet;
      totalIcaGen += ica;
      totalTotalGen += total;
    });

    const gruposOrdenados = Object.values(grupos).sort((a, b) =>
      a.proveedor.localeCompare(b.proveedor)
    );

    return {
      gruposPorProveedor: gruposOrdenados,
      totalesGenerales: {
        base: totalBaseGen,
        iva: totalIvaGen,
        renta: totalRentaGen,
        ivaRet: totalIvaRetGen,
        ica: totalIcaGen,
        total: totalTotalGen,
      },
    };
  }, [facturasFiltradas]);

  const toggleProveedor = (proveedor: string) => {
    setProveedoresExpandidos((prev) => ({
      ...prev,
      [proveedor]: !prev[proveedor],
    }));
  };

  const expandirTodo = (estado: boolean) => {
    const nuevoEstado: { [key: string]: boolean } = {};
    gruposPorProveedor.forEach((g) => {
      nuevoEstado[g.proveedor] = estado;
    });
    setProveedoresExpandidos(nuevoEstado);
  };

  // Exportación a Excel
  const exportarAExcel = () => {
    const filasExcel: FilaExcelFactura[] = [];

    gruposPorProveedor.forEach((grupo) => {
      grupo.items.forEach((f) => {
        filasExcel.push({
          Proveedor: grupo.proveedor,
          NIT: grupo.nit,
          "N° Factura": f.numero_factura,
          "Fecha Emisión": f.fecha_emision,
          "Estado Pago": (f.estado_pago || "pendiente").toUpperCase(),
          Subtotal: Number(f.subtotal || 0),
          IVA: Number(f.impuestos || 0),
          "Ret. Renta": Number(f.valor_retencion_renta || f.retencion_renta || 0),
          "Ret. IVA": Number(f.valor_retencion_iva || f.retencion_iva || 0),
          "Ret. ICA": Number(f.valor_retencion_ica || f.retencion_ica || 0),
          "Total Factura": Number(f.total_factura || 0),
        });
      });

      if (mostrarSubtotales) {
        filasExcel.push({
          Proveedor: `SUBTOTAL (${grupo.proveedor})`,
          NIT: "",
          "N° Factura": "",
          "Fecha Emisión": "",
          "Estado Pago": "",
          Subtotal: grupo.subtotalBase,
          IVA: grupo.subtotalIva,
          "Ret. Renta": grupo.subtotalRenta,
          "Ret. IVA": grupo.subtotalIvaRet,
          "Ret. ICA": grupo.subtotalIca,
          "Total Factura": grupo.subtotalTotal,
        });
        filasExcel.push({});
      }
    });

    filasExcel.push({
      Proveedor: "TOTAL GENERAL",
      NIT: "",
      "N° Factura": "",
      "Fecha Emisión": "",
      "Estado Pago": "",
      Subtotal: totalesGenerales.base,
      IVA: totalesGenerales.iva,
      "Ret. Renta": totalesGenerales.renta,
      "Ret. IVA": totalesGenerales.ivaRet,
      "Ret. ICA": totalesGenerales.ica,
      "Total Factura": totalesGenerales.total,
    });

    const hoja = XLSX.utils.json_to_sheet(filasExcel);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Facturas");
    XLSX.writeFile(
      libro,
      `Reporte_Facturas_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  if (!isMounted) {
    return (
      <div className="p-6 text-center text-sm text-slate-400">
        Cargando facturas recibidas...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-5 text-sm bg-slate-50/50 min-h-screen">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs md:text-sm transition cursor-pointer border border-slate-200 shrink-0 flex items-center gap-1.5"
            title="Volver atrás"
          >
            <span>←</span>
            <span>Atrás</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight truncate">
              Facturas Recibidas — Vista de Tarjetas Plegables
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5 truncate">
              Gestión y control de facturas de proveedores por empresa y sucursal.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {facturas.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => expandirTodo(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs md:text-sm transition cursor-pointer"
              >
                📂 Expandir Todo
              </button>
              <button
                type="button"
                onClick={() => expandirTodo(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs md:text-sm transition cursor-pointer"
              >
                📁 Contraer Todo
              </button>
            </>
          )}
          {facturas.length === 0 ? (
            <button
              type="button"
              onClick={cargarFacturas}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs md:text-sm shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Cargando..." : "📥 Cargar Facturas"}
            </button>
          ) : (
            <button
              type="button"
              onClick={exportarAExcel}
              disabled={facturasFiltradas.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs md:text-sm shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              📊 Exportar Excel
            </button>
          )}
          <button
            type="button"
            onClick={cargarFacturas}
            disabled={loading}
            className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs md:text-sm transition cursor-pointer shadow-sm"
          >
            🔄 Recargar
          </button>
        </div>
      </div>

      {/* Selectores Contextuales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Empresa Activa:
          </label>
          <select
            value={empresaId}
            onChange={handleCambioEmpresa}
            suppressHydrationWarning
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition cursor-pointer"
          >
            {loadingEmpresas ? (
              <option value="">Cargando empresas...</option>
            ) : empresas.length === 0 ? (
              <option value="">Sin empresas asignadas</option>
            ) : (
              <>
                {empresas.length !== 1 && (
                  <option value="">-- Seleccione Empresa --</option>
                )}
                {empresas.map((emp) => {
                  const id = String(emp.id || emp.empresa_id);
                  const nitTexto = getNitEmpresa(emp);
                  return (
                    <option key={id} value={id}>
                      {getNombreEmpresa(emp)}
                      {nitTexto ? ` (${nitTexto})` : ""}
                    </option>
                  );
                })}
              </>
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Sucursal:
          </label>
          <select
            value={sucursalId}
            disabled={!empresaId}
            onChange={handleCambioSucursal}
            suppressHydrationWarning
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition cursor-pointer disabled:bg-slate-100 disabled:opacity-60"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={String(suc.id)}>
                {suc.nombre}{" "}
                {suc.codigo || suc.codigo_sucursal
                  ? `(${suc.codigo || suc.codigo_sucursal})`
                  : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Búsqueda, Filtro y Subtotales */}
      <div className="flex flex-col lg:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full flex-1 px-3.5 bg-slate-50 border border-slate-200 rounded-xl py-2">
          <span className="text-slate-400 text-base">🔍</span>
          <input
            type="text"
            placeholder="Buscar por Proveedor, NIT, N° Factura..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full text-sm outline-none bg-transparent text-slate-800 placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Estado:
            </span>
            <select
              value={estadoPago}
              onChange={(e) => setEstadoPago(e.target.value)}
              className="bg-transparent text-sm text-slate-800 font-semibold outline-none cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente por Pagar</option>
              <option value="parcial">Pagadas Parcial</option>
              <option value="pagado">Pagadas</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 text-xs md:text-sm font-semibold text-slate-700 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200 transition">
            <input
              type="checkbox"
              checked={mostrarSubtotales}
              onChange={(e) => setMostrarSubtotales(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
            />
            <span>Ver Subtotales</span>
          </label>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* Contenedor de Tarjetas / Acordeones por Proveedor */}
      <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="p-16 text-center text-slate-500 text-base font-medium bg-white rounded-2xl border border-slate-200 shadow-sm">
            Cargando facturas...
          </div>
        ) : facturas.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm md:text-base bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <p className="font-medium text-slate-600">
              Haz clic en el botón de carga para listar las facturas de la
              empresa activa.
            </p>
            <button
              type="button"
              onClick={cargarFacturas}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm cursor-pointer shadow-md transition"
            >
              Cargar Facturas Ahora
            </button>
          </div>
        ) : gruposPorProveedor.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200 shadow-sm">
            No se encontraron facturas con los filtros aplicados.
          </div>
        ) : (
          gruposPorProveedor.map((grupo) => {
            const isExpanded = !!proveedoresExpandidos[grupo.proveedor];

            return (
              <div
                key={grupo.proveedor}
                className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden"
              >
                {/* Cabecera Tarjeta / Acordeón */}
                <div
                  onClick={() => toggleProveedor(grupo.proveedor)}
                  className="bg-slate-100 hover:bg-slate-100/80 px-5 py-3.5 flex items-center justify-between cursor-pointer select-none transition border-b border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-bold text-sm">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    <span className="font-bold text-slate-900 text-sm md:text-base">
                      🏢 {grupo.proveedor}
                    </span>
                    {grupo.nit && (
                      <span className="text-slate-500 text-xs md:text-sm font-mono">
                        ({grupo.nit})
                      </span>
                    )}
                    <span className="ml-2 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                      {grupo.items.length}{" "}
                      {grupo.items.length === 1 ? "factura" : "facturas"}
                    </span>
                  </div>

                  <div className="flex items-center gap-5 font-mono text-xs md:text-sm">
                    <span className="text-slate-500 hidden sm:inline">
                      Subtotal:{" "}
                      <strong className="text-slate-800">
                        ${grupo.subtotalBase.toLocaleString("es-CO")}
                      </strong>
                    </span>
                    <span className="text-slate-600">
                      Total:{" "}
                      <strong className="text-emerald-700 font-bold text-base">
                        ${grupo.subtotalTotal.toLocaleString("es-CO")}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Contenido / Tabla interna colapsable */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm text-slate-700 border-collapse whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-xs">
                        <tr>
                          <th className="py-3.5 px-5">N° Factura</th>
                          <th className="py-3.5 px-5">Emisión</th>
                          <th className="py-3.5 px-5 text-right">Subtotal</th>
                          <th className="py-3.5 px-5 text-right">IVA</th>
                          <th className="py-3.5 px-5 text-right">Ret. Renta</th>
                          <th className="py-3.5 px-5 text-right">Ret. IVA</th>
                          <th className="py-3.5 px-5 text-right">Ret. ICA</th>
                          <th className="py-3.5 px-5 text-right">Total</th>
                          <th className="py-3.5 px-5 text-center">Estado</th>
                          <th className="py-3.5 px-5 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {grupo.items.map((f) => {
                          const rentaVal = Number(
                            f.valor_retencion_renta || f.retencion_renta || 0
                          );
                          const ivaRetVal = Number(
                            f.valor_retencion_iva || f.retencion_iva || 0
                          );
                          const icaVal = Number(
                            f.valor_retencion_ica || f.retencion_ica || 0
                          );

                          return (
                            <tr
                              key={f.id}
                              className="hover:bg-slate-50/80 transition"
                            >
                              <td className="py-3.5 px-5 font-mono font-semibold text-slate-900">
                                {f.numero_factura}
                              </td>
                              <td className="py-3.5 px-5 font-mono text-slate-500">
                                {f.fecha_emision}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono text-slate-800">
                                $
                                {Number(f.subtotal || 0).toLocaleString(
                                  "es-CO"
                                )}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono text-slate-800">
                                $
                                {Number(f.impuestos || 0).toLocaleString(
                                  "es-CO"
                                )}
                              </td>
                              <td
                                className={`py-3.5 px-5 text-right font-mono ${
                                  rentaVal > 0
                                    ? "text-slate-800"
                                    : "text-slate-300"
                                }`}
                              >
                                ${rentaVal.toLocaleString("es-CO")}
                              </td>
                              <td
                                className={`py-3.5 px-5 text-right font-mono ${
                                  ivaRetVal > 0
                                    ? "text-slate-800"
                                    : "text-slate-300"
                                }`}
                              >
                                ${ivaRetVal.toLocaleString("es-CO")}
                              </td>
                              <td
                                className={`py-3.5 px-5 text-right font-mono ${
                                  icaVal > 0
                                    ? "text-slate-800"
                                    : "text-slate-300"
                                }`}
                              >
                                ${icaVal.toLocaleString("es-CO")}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900">
                                $
                                {Number(f.total_factura || 0).toLocaleString(
                                  "es-CO"
                                )}
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <span
                                  className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                                    (f.estado_pago || "")
                                      .toLowerCase()
                                      .includes("pagado") ||
                                    (f.estado_pago || "").toLowerCase() ===
                                      "pagada"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : (f.estado_pago || "")
                                            .toLowerCase()
                                            .includes("parcial")
                                      ? "bg-sky-50 text-sky-700 border-sky-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {(f.estado_pago || "Pendiente").toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <button
                                  type="button"
                                  onClick={() => abrirAsiento(f)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs transition border border-slate-300 cursor-pointer shadow-2xs"
                                >
                                  📖 Asiento
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {mostrarSubtotales && (
                          <tr className="bg-slate-50/90 font-semibold text-slate-800 border-t border-slate-200">
                            <td colSpan={2} className="py-2.5 px-5 text-xs">
                              Subtotal {grupo.proveedor}
                            </td>
                            <td className="py-2.5 px-5 text-right font-mono text-xs">
                              ${grupo.subtotalBase.toLocaleString("es-CO")}
                            </td>
                            <td className="py-2.5 px-5 text-right font-mono text-xs">
                              ${grupo.subtotalIva.toLocaleString("es-CO")}
                            </td>
                            <td className="py-2.5 px-5 text-right font-mono text-xs">
                              ${grupo.subtotalRenta.toLocaleString("es-CO")}
                            </td>
                            <td className="py-2.5 px-5 text-right font-mono text-xs">
                              ${grupo.subtotalIvaRet.toLocaleString("es-CO")}
                            </td>
                            <td className="py-2.5 px-5 text-right font-mono text-xs">
                              ${grupo.subtotalIca.toLocaleString("es-CO")}
                            </td>
                            <td className="py-2.5 px-5 text-right font-mono text-xs font-bold text-slate-900">
                              ${grupo.subtotalTotal.toLocaleString("es-CO")}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Barra Inferior Fija */}
      {gruposPorProveedor.length > 0 && (
        <div className="bg-slate-900 text-white px-5 py-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <span className="uppercase tracking-wider text-xs md:text-sm font-bold text-slate-300">
            Total General:
          </span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs md:text-sm">
            <span>
              Base:{" "}
              <strong className="text-slate-100">
                ${totalesGenerales.base.toLocaleString("es-CO")}
              </strong>
            </span>
            <span>
              IVA:{" "}
              <strong className="text-slate-100">
                ${totalesGenerales.iva.toLocaleString("es-CO")}
              </strong>
            </span>
            <span>
              Renta:{" "}
              <strong className="text-slate-200">
                ${totalesGenerales.renta.toLocaleString("es-CO")}
              </strong>
            </span>
            <span>
              Ret.IVA:{" "}
              <strong className="text-slate-200">
                ${totalesGenerales.ivaRet.toLocaleString("es-CO")}
              </strong>
            </span>
            <span>
              ICA:{" "}
              <strong className="text-slate-200">
                ${totalesGenerales.ica.toLocaleString("es-CO")}
              </strong>
            </span>
            <span className="bg-slate-800 px-4 py-1.5 rounded-xl border border-slate-700 shadow-inner">
              Total:{" "}
              <strong className="text-emerald-400 text-base">
                ${totalesGenerales.total.toLocaleString("es-CO")}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Modal de Asiento Contable */}
      {facturaSeleccionada && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base md:text-lg">
                  Asiento Contable — Factura N°{" "}
                  {facturaSeleccionada.numero_factura}
                </h3>
                <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                  Proveedor: {facturaSeleccionada.tercero_nombre} (NIT:{" "}
                  {facturaSeleccionada.tercero_nit})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFacturaSeleccionada(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {loadingAsiento ? (
              <div className="py-10 text-center text-slate-500 text-sm font-medium">
                Cargando partida doble...
              </div>
            ) : asiento ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs md:text-sm">
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-semibold">
                      Documento Interno:
                    </span>
                    <strong className="text-indigo-600 text-sm">
                      {asiento.transaccion.numero_documento}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-semibold">
                      Fecha Contable:
                    </span>
                    <strong className="text-slate-800 text-sm">
                      {asiento.transaccion.fecha_contable ||
                        asiento.transaccion.fecha_emision}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px] uppercase font-semibold">
                      Glosa / Concepto:
                    </span>
                    <span className="text-slate-800 italic">
                      {asiento.transaccion.glosa_concepto}
                    </span>
                  </div>
                </div>

                <table className="w-full text-left text-xs md:text-sm border-collapse border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 border-r border-slate-200">
                        Cuenta Auxiliar
                      </th>
                      <th className="p-3 text-right border-r border-slate-200 w-32">
                        Débito
                      </th>
                      <th className="p-3 text-right w-32">Crédito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {asiento.detalles.map((d) => {
                      const conceptoAux = Array.isArray(d.conceptos_auxiliares)
                        ? d.conceptos_auxiliares[0]
                        : d.conceptos_auxiliares;

                      return (
                        <tr key={d.id}>
                          <td className="p-3 border-r border-slate-200">
                            <span className="font-mono text-slate-600 font-semibold mr-2">
                              {conceptoAux?.codigo_auxiliar ||
                                `#${d.concepto_auxiliar_id}`}
                            </span>
                            <span className="font-medium text-slate-900">
                              {conceptoAux?.nombre || "Concepto Auxiliar"}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono border-r border-slate-200 font-medium">
                            {d.debito > 0
                              ? `$${d.debito.toLocaleString("es-CO")}`
                              : "-"}
                          </td>
                          <td className="p-3 text-right font-mono font-medium">
                            {d.credito > 0
                              ? `$${d.credito.toLocaleString("es-CO")}`
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">
                No se encontró asiento contable.
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFacturaSeleccionada(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs md:text-sm font-semibold hover:bg-slate-800 cursor-pointer shadow-md transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}