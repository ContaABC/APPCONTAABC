"use client";

import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  obtenerEmpresas,
  obtenerSucursales,
} from "@/app/consultas/movimientos/movimientos-actions";
import {
  obtenerFacturasPendientes,
  obtenerProveedoresConSaldo,
  obtenerDatosAuxiliaresPago,
  ejecutarPagoFacturas,
  obtenerConceptosAuxiliaresPorFormaPago,
} from "./pagos-actions";
import { validarPeriodoContable } from "@/lib/accounting-validations"; // <--- 1. Importar la validación centralizada

export default function PagosProveedoresPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  const [proveedores, setProveedores] = useState<any[]>([]);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Listas Auxiliares
  const [clasesDoc, setClasesDoc] = useState<any[]>([]);
  const [cuentasBancos, setCuentasBancos] = useState<any[]>([]);
  const [conceptosRet, setConceptosRet] = useState<any[]>([]);
  const [conceptosAuxiliares, setConceptosAuxiliares] = useState<any[]>([]);

  // Filtro de proveedor seleccionado
  const [filtroProveedorId, setFiltroProveedorId] = useState<string>("");

  // Selectores Globales de Retención
  const [retencionRentaId, setRetencionRentaId] = useState<string>("");
  const [retencionIvaId, setRetencionIvaId] = useState<string>("");
  const [retencionIcaId, setRetencionIcaId] = useState<string>("");

  // Tipos de Pago Masivo
  const [tipoPagoMasivo, setTipoPagoMasivo] = useState<"MANUAL_INDIVIDUAL" | "EXCEL" | "AUTOMATICO_VALOR">("MANUAL_INDIVIDUAL");

  // Estados para Pago Automático por Valor y Excel
  const [valorNetoObjetivo, setValorNetoObjetivo] = useState<number>(0);
  const [excelCargado, setExcelCargado] = useState<boolean>(false);

  // Estados para Selección y Retenciones
  const [facturasSeleccionadas, setFacturasSeleccionadas] = useState<{ [key: string]: boolean }>({});
  const [retencionesFactura, setRetencionesFactura] = useState<{ [key: string]: { [key: string]: number } }>({});
  const [valoresPersonalizadosPago, setValoresPersonalizadosPago] = useState<{ [key: string]: number }>({});

  const [claseDocId, setClaseDocId] = useState<string>("");
  const [formaPago, setFormaPago] = useState<string>("Transferencia / Consignación");
  const [cuentaBancoId, setCuentaBancoId] = useState<string>("");
  const [conceptoAuxiliarId, setConceptoAuxiliarId] = useState<string>("");
  const [fechaContable, setFechaContable] = useState<string>("");
  const [glosa, setGlosa] = useState<string>("Pago masivo de facturas a proveedores");
  const [procesando, setProcesando] = useState<boolean>(false);

  // Estados para Control de Periodo Contable (NUEVO)
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    setFechaContable(new Date().toISOString().split("T")[0]);
  }, []);

  // Función de validación de periodo en tiempo real (NUEVO)
  const verificarPeriodo = async (fecha: string) => {
    if (!empresaId || !sucursalId || !fecha) {
      setErrorPeriodo(null);
      return;
    }

    setValidandoPeriodo(true);
    setErrorPeriodo(null);

    const res = await validarPeriodoContable(empresaId, sucursalId, fecha);
    if (!res.valido) {
      setErrorPeriodo(res.mensaje || "Periodo no habilitado para transacciones.");
    }

    setValidandoPeriodo(false);
  };

  // Validar automáticamente al cambiar empresa, sucursal o fecha contable
  useEffect(() => {
    if (empresaId && sucursalId && fechaContable) {
      verificarPeriodo(fechaContable);
    }
  }, [empresaId, sucursalId]);

  useEffect(() => {
    async function init() {
      const res = await obtenerEmpresas();
      if (res.success && res.data && res.data.length > 0) {
        setEmpresas(res.data);
        setEmpresaId(String(res.data[0].id));
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!empresaId) return;
    async function cargarDatosBase() {
      const parsedEmpresaId = Number(empresaId);
      const parsedSucursalId = sucursalId ? Number(sucursalId) : undefined;

      const [sucRes, auxRes, provRes] = await Promise.all([
        obtenerSucursales(parsedEmpresaId),
        obtenerDatosAuxiliaresPago(parsedEmpresaId),
        obtenerProveedoresConSaldo(parsedEmpresaId, parsedSucursalId),
      ]);

      if (sucRes.success) {
        setSucursales(sucRes.data || []);
        if (sucRes.data && (sucRes.data as any[]).length > 0 && !sucursalId) {
          setSucursalId(String((sucRes.data as any[])[0].id));
        }
      }
      if (auxRes.success) {
        setClasesDoc(auxRes.clasesDocumento || []);
        setCuentasBancos(auxRes.cuentasFinancieras || []);
        setConceptosRet(auxRes.conceptosRetencion || []);
        setConceptosAuxiliares(auxRes.conceptosAuxiliares || []);

        if (auxRes.clasesDocumento && (auxRes.clasesDocumento as any[]).length > 0) {
          setClaseDocId(String((auxRes.clasesDocumento as any[])[0].id));
        }
        if (auxRes.cuentasFinancieras && (auxRes.cuentasFinancieras as any[]).length > 0) {
          setCuentaBancoId(String((auxRes.cuentasFinancieras as any[])[0].id));
        }
        if (auxRes.conceptosAuxiliares && (auxRes.conceptosAuxiliares as any[]).length > 0) {
          setConceptoAuxiliarId(String((auxRes.conceptosAuxiliares as any[])[0].id));
        }
      }
      if (provRes.success) {
        setProveedores(provRes.data || []);
      }
    }
    cargarDatosBase();
    setFiltroProveedorId("");
    setFacturas([]);
    setFacturasSeleccionadas({});
    setRetencionesFactura({});
    setValoresPersonalizadosPago({});
    setValorNetoObjetivo(0);
    setExcelCargado(false);
  }, [empresaId, sucursalId]);

  // EFECTO: Actualizar conceptos auxiliares según la Forma de Pago seleccionada
  useEffect(() => {
    if (!empresaId) return;
    async function actualizarConceptosPorFormaPago() {
      const res = await obtenerConceptosAuxiliaresPorFormaPago(empresaId, formaPago);
      if (res.success) {
        setConceptosAuxiliares(res.conceptosAuxiliares || []);
        if (res.conceptosAuxiliares && res.conceptosAuxiliares.length > 0) {
          setConceptoAuxiliarId(String(res.conceptosAuxiliares[0].id));
        } else {
          setConceptoAuxiliarId("");
        }
      }
    }
    actualizarConceptosPorFormaPago();
  }, [formaPago, empresaId]);

  useEffect(() => {
    if (!empresaId || !filtroProveedorId) {
      setFacturas([]);
      setFacturasSeleccionadas({});
      setRetencionesFactura({});
      setValoresPersonalizadosPago({});
      setValorNetoObjetivo(0);
      setExcelCargado(false);
      return;
    }

    async function cargarFacturasProveedor() {
      setLoading(true);
      const res = await obtenerFacturasPendientes(
        Number(empresaId),
        sucursalId ? Number(sucursalId) : undefined,
        Number(filtroProveedorId)
      );
      if (res.success) {
        setFacturas(res.data || []);
      } else {
        setFacturas([]);
      }
      setFacturasSeleccionadas({});
      setRetencionesFactura({});
      setValoresPersonalizadosPago({});
      setValorNetoObjetivo(0);
      setExcelCargado(false);
      setLoading(false);
    }
    cargarFacturasProveedor();
  }, [empresaId, sucursalId, filtroProveedorId]);

  const handleCambioModo = (modo: "MANUAL_INDIVIDUAL" | "EXCEL" | "AUTOMATICO_VALOR") => {
    setTipoPagoMasivo(modo);
    setFacturasSeleccionadas({});
    setRetencionesFactura({});
    setValoresPersonalizadosPago({});
    setValorNetoObjetivo(0);
    setExcelCargado(false);
  };

  const fmt = (v: number) =>
    `$ ${Math.round(Number(v || 0)).toLocaleString("es-CO")}`;

  const saldoMaximoProveedor = useMemo(() => {
    return facturas.reduce((acc: number, fac: any) => acc + Number(fac.saldo_pendiente || 0), 0);
  }, [facturas]);

  useEffect(() => {
    if (tipoPagoMasivo !== "MANUAL_INDIVIDUAL") return;
    const idsActivos = Object.keys(facturasSeleccionadas).filter((id) => facturasSeleccionadas[id]);
    if (idsActivos.length === 0) return;

    const nuevasRetenciones = { ...retencionesFactura };

    idsActivos.forEach((facId) => {
      const fac = facturas.find((f: any) => f.id === facId);
      if (!fac) return;
      
      const subtotalFac = Number(fac.subtotal || 0);
      const ivaFac = Number(fac.impuestos || 0);
      const retsObj: { [key: string]: number } = {};

      if (retencionRentaId) {
        const concepto = conceptosRet.find((c: any) => String(c.id) === retencionRentaId);
        if (concepto && subtotalFac >= Number(concepto.base_minima || 0)) {
          retsObj[retencionRentaId] = Math.round(subtotalFac * Number(concepto.porcentaje || 0));
        } else {
          retsObj[retencionRentaId] = 0;
        }
      }

      if (retencionIvaId) {
        const concepto = conceptosRet.find((c: any) => String(c.id) === retencionIvaId);
        if (concepto && ivaFac >= Number(concepto.base_minima || 0)) {
          retsObj[retencionIvaId] = Math.round(ivaFac * Number(concepto.porcentaje || 0));
        } else {
          retsObj[retencionIvaId] = 0;
        }
      }

      if (retencionIcaId) {
        const concepto = conceptosRet.find((c: any) => String(c.id) === retencionIcaId);
        if (concepto && subtotalFac >= Number(concepto.base_minima || 0)) {
          retsObj[retencionIcaId] = Math.round(subtotalFac * Number(concepto.porcentaje || 0));
        } else {
          retsObj[retencionIcaId] = 0;
        }
      }

      nuevasRetenciones[facId] = retsObj;
    });

    setRetencionesFactura(nuevasRetenciones);
  }, [retencionRentaId, retencionIvaId, retencionIcaId, facturasSeleccionadas, facturas, conceptosRet, tipoPagoMasivo]);

  useEffect(() => {
    if (tipoPagoMasivo !== "AUTOMATICO_VALOR" || valorNetoObjetivo <= 0 || facturas.length === 0) {
      if (tipoPagoMasivo !== "AUTOMATICO_VALOR") return;
      setFacturasSeleccionadas({});
      setRetencionesFactura({});
      setValoresPersonalizadosPago({});
      return;
    }

    let acumuladorRestante = valorNetoObjetivo;
    const nuevasSelecciones: { [key: string]: boolean } = {};
    const nuevasRetenciones: { [key: string]: { [key: string]: number } } = {};
    const nuevosValoresPago: { [key: string]: number } = {};

    for (const fac of facturas) {
      if (acumuladorRestante <= 0) break;

      const subtotalFac = Number(fac.subtotal || 0);
      const ivaFac = Number(fac.impuestos || 0);
      const saldoPendienteFac = Number(fac.saldo_pendiente || 0);

      let retRentaVal = 0;
      let retIvaVal = 0;
      let retIcaVal = 0;
      const retsObj: { [key: string]: number } = {};

      if (retencionRentaId) {
        const c = conceptosRet.find((item: any) => String(item.id) === retencionRentaId);
        if (c && subtotalFac >= Number(c.base_minima || 0)) {
          retRentaVal = Math.round(subtotalFac * Number(c.porcentaje || 0));
          retsObj[retencionRentaId] = retRentaVal;
        }
      }
      if (retencionIvaId) {
        const c = conceptosRet.find((item: any) => String(item.id) === retencionIvaId);
        if (c && ivaFac >= Number(c.base_minima || 0)) {
          retIvaVal = Math.round(ivaFac * Number(c.porcentaje || 0));
          retsObj[retencionIvaId] = retIvaVal;
        }
      }
      if (retencionIcaId) {
        const c = conceptosRet.find((item: any) => String(item.id) === retencionIcaId);
        if (c && subtotalFac >= Number(c.base_minima || 0)) {
          retIcaVal = Math.round(subtotalFac * Number(c.porcentaje || 0));
          retsObj[retencionIcaId] = retIcaVal;
        }
      }

      const totalRetFac = retRentaVal + retIvaVal + retIcaVal;
      const netoFacturaCompleta = Math.max(0, saldoPendienteFac - totalRetFac);

      nuevasSelecciones[fac.id] = true;
      nuevasRetenciones[fac.id] = retsObj;

      if (acumuladorRestante >= netoFacturaCompleta) {
        nuevosValoresPago[fac.id] = netoFacturaCompleta;
        acumuladorRestante -= netoFacturaCompleta;
      } else {
        nuevosValoresPago[fac.id] = Math.min(netoFacturaCompleta, acumuladorRestante);
        acumuladorRestante = 0;
      }
    }

    setFacturasSeleccionadas(nuevasSelecciones);
    setRetencionesFactura(nuevasRetenciones);
    setValoresPersonalizadosPago(nuevosValoresPago);
  }, [valorNetoObjetivo, tipoPagoMasivo, facturas, retencionRentaId, retencionIvaId, retencionIcaId, conceptosRet]);

  const handleFileUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (!data || data.length === 0) {
          alert("El archivo Excel está vacío o no tiene un formato válido.");
          return;
        }

        const nuevasSelecciones: { [key: string]: boolean } = {};
        const nuevosValoresPago: { [key: string]: number } = {};
        const nuevasRetenciones: { [key: string]: { [key: string]: number } } = {};

        let encontradas = 0;

        data.forEach((row) => {
          const rowNormalizada: { [key: string]: any } = {};
          Object.keys(row).forEach((k) => {
            const keyClean = k.toLowerCase().trim().replace(/[\s_-]+/g, "");
            rowNormalizada[keyClean] = row[k];
          });

          const numFacRaw = 
            rowNormalizada["numerofactura"] || 
            rowNormalizada["factura"] || 
            rowNormalizada["nrofactura"] || 
            rowNormalizada["numfactura"] ||
            rowNormalizada["documento"] || "";

          const valPagoRaw = 
            rowNormalizada["valorpagado"] || 
            rowNormalizada["valor"] || 
            rowNormalizada["totalapagar"] || 
            rowNormalizada["netopagar"] || 
            rowNormalizada["monto"] || 0;

          const numFac = String(numFacRaw).trim();
          const valPago = Number(valPagoRaw) || 0;

          if (numFac) {
            const facEncontrada = facturas.find(
              (f: any) => String(f.numero_factura).trim().toLowerCase() === numFac.toLowerCase()
            );

            if (facEncontrada) {
              nuevasSelecciones[facEncontrada.id] = true;
              nuevosValoresPago[facEncontrada.id] = valPago > 0 ? valPago : Number(facEncontrada.saldo_pendiente || 0);
              encontradas++;
            }
          }
        });

        if (encontradas === 0) {
          alert("No se pudo asociar ninguna factura. Verifique que los números de factura en el Excel coincidan exactamente con las pendientes del proveedor seleccionado.");
          return;
        }

        setFacturasSeleccionadas(nuevasSelecciones);
        setValoresPersonalizadosPago(nuevosValoresPago);
        setRetencionesFactura(nuevasRetenciones);
        setExcelCargado(true);
        alert(`¡Archivo procesado con éxito! Se asociaron y validaron ${encontradas} facturas desde el Excel.`);
      } catch (err: any) {
        alert("Error al leer el archivo Excel: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleToggleSelect = (facId: string) => {
    if (tipoPagoMasivo !== "MANUAL_INDIVIDUAL") return;
    const newState = { ...facturasSeleccionadas, [facId]: !facturasSeleccionadas[facId] };
    setFacturasSeleccionadas(newState);

    if (newState[facId]) {
      const fac = facturas.find((f: any) => f.id === facId);
      if (!fac) return;
      const subtotalFac = Number(fac.subtotal || 0);
      const ivaFac = Number(fac.impuestos || 0);
      const retsObj: { [key: string]: number } = {};

      if (retencionRentaId) {
        const c = conceptosRet.find((item: any) => String(item.id) === retencionRentaId);
        if (c && subtotalFac >= Number(c.base_minima || 0)) {
          retsObj[retencionRentaId] = Math.round(subtotalFac * Number(c.porcentaje || 0));
        }
      }
      if (retencionIvaId) {
        const c = conceptosRet.find((item: any) => String(item.id) === retencionIvaId);
        if (c && ivaFac >= Number(c.base_minima || 0)) {
          retsObj[retencionIvaId] = Math.round(ivaFac * Number(c.porcentaje || 0));
        }
      }
      if (retencionIcaId) {
        const c = conceptosRet.find((item: any) => String(item.id) === retencionIcaId);
        if (c && subtotalFac >= Number(c.base_minima || 0)) {
          retsObj[retencionIcaId] = Math.round(subtotalFac * Number(c.porcentaje || 0));
        }
      }

      setRetencionesFactura((prev) => ({ ...prev, [facId]: retsObj }));
    } else {
      setRetencionesFactura((prev) => {
        const copy = { ...prev };
        delete copy[facId];
        return copy;
      });
      setValoresPersonalizadosPago((prev) => {
        const copy = { ...prev };
        delete copy[facId];
        return copy;
      });
    }
  };

  const calcularTotalRetencionesFactura = (facId: string) => {
    const rets = retencionesFactura[facId] || {};
    return Object.values(rets).reduce((acc: number, v: any) => acc + Number(v || 0), 0);
  };

  const obtenerValorAPagar = (fac: any) => {
    if (tipoPagoMasivo === "EXCEL" || tipoPagoMasivo === "AUTOMATICO_VALOR") {
      return Number(valoresPersonalizadosPago[fac.id] || 0);
    }
    const saldoReal = Number(fac.saldo_pendiente || 0);
    const totalRet = calcularTotalRetencionesFactura(fac.id);
    return Math.max(0, saldoReal - totalRet);
  };

  const totalGeneralPago = useMemo(() => {
    if (tipoPagoMasivo === "AUTOMATICO_VALOR") {
      return valorNetoObjetivo;
    }
    return Object.keys(facturasSeleccionadas)
      .filter((id) => facturasSeleccionadas[id])
      .reduce((acc: number, id: string) => {
        const fac = facturas.find((f: any) => f.id === id);
        if (!fac) return acc;
        return acc + obtenerValorAPagar(fac);
      }, 0);
  }, [facturasSeleccionadas, facturas, retencionesFactura, valoresPersonalizadosPago, tipoPagoMasivo, valorNetoObjetivo]);

  const handleSubmitPago = async (e: React.FormEvent) => {
    e.preventDefault();

    if (errorPeriodo) {
      alert("No se puede procesar el pago porque el periodo contable no es válido o está cerrado.");
      return;
    }

    const idsActivos = Object.keys(facturasSeleccionadas).filter((id) => facturasSeleccionadas[id]);

    if (idsActivos.length === 0) {
      alert("Seleccione o cargue al menos una factura para pagar.");
      return;
    }
    if (!claseDocId) {
      alert("Seleccione la clase de documento.");
      return;
    }
    if (formaPago === "Efectivo" && !conceptoAuxiliarId) {
      alert("Seleccione el concepto auxiliar contable para el pago en efectivo.");
      return;
    }
    if (formaPago !== "Efectivo" && !cuentaBancoId) {
      alert("Seleccione la cuenta financiera (bancos).");
      return;
    }

    setProcesando(true);
    const pagosJson = idsActivos.map((id) => {
      const fac = facturas.find((f: any) => f.id === id);
      const valorNetoPagar = fac ? obtenerValorAPagar(fac) : 0;
      const retsObj = retencionesFactura[id] || {};
      const retsArray = Object.keys(retsObj)
        .filter((retId) => Number(retsObj[retId]) > 0)
        .map((retId) => ({
          concepto_retencion_id: Number(retId),
          valor: Number(retsObj[retId]),
        }));

      return {
        factura_id: id,
        valor_pagado: valorNetoPagar,
        retenciones: retsArray,
      };
    });

    const res = await ejecutarPagoFacturas({
      empresa_id: Number(empresaId),
      sucursal_id: Number(sucursalId || (sucursales[0] as any)?.id || 1),
      clase_documento_id: Number(claseDocId),
      fecha_contable: fechaContable,
      glosa_concepto: glosa,
      cuenta_financiera_id: formaPago !== "Efectivo" ? Number(cuentaBancoId) : null,
      forma_pago: formaPago,
      concepto_auxiliar_id: formaPago === "Efectivo" ? Number(conceptoAuxiliarId) : null,
      pagos_json: pagosJson,
    });

    if (res.success) {
      alert(`¡Pago procesado con éxito! Comprobante N°: ${res.data.numero_documento}`);
      window.location.reload();
    } else {
      alert("Error al procesar el pago: " + res.error);
    }
    setProcesando(false);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 text-xs font-sans">
      <div className="border-b pb-2 flex justify-between items-center">
        <div>
          <h1 className="text-base font-bold text-slate-800">
            Módulo de Pagos a Proveedores (Egresos Masivos)
          </h1>
          <p className="text-[11px] text-slate-500">
            Gestión de pagos manuales por Excel y asignación automática FIFO por valor neto.
          </p>
        </div>

        {/* SELECTOR DE TIPO DE PAGO MASIVO */}
        <div className="flex gap-1 bg-slate-200 p-1 rounded">
          <button
            type="button"
            onClick={() => handleCambioModo("MANUAL_INDIVIDUAL")}
            className={`px-3 py-1 font-bold rounded text-[11px] transition ${
              tipoPagoMasivo === "MANUAL_INDIVIDUAL" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300"
            }`}
          >
            Manual / Selectivo
          </button>
          <button
            type="button"
            onClick={() => handleCambioModo("EXCEL")}
            className={`px-3 py-1 font-bold rounded text-[11px] transition ${
              tipoPagoMasivo === "EXCEL" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300"
            }`}
          >
            📁 Carga por Excel
          </button>
          <button
            type="button"
            onClick={() => handleCambioModo("AUTOMATICO_VALOR")}
            className={`px-3 py-1 font-bold rounded text-[11px] transition ${
              tipoPagoMasivo === "AUTOMATICO_VALOR" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300"
            }`}
          >
            ⚡ Automático por Valor
          </button>
        </div>
      </div>

      {/* CONTROLES / FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            {empresas.map((emp: any) => (
              <option key={emp.id} value={emp.id}>{emp.razon_social || emp.nombre_comercial}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Sucursal</label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            {sucursales.map((suc: any) => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Clase de Documento</label>
          <select
            value={claseDocId}
            onChange={(e) => setClaseDocId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            {clasesDoc.map((cd: any) => (
              <option key={cd.id} value={cd.id}>{cd.nombre_clase}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Forma de Pago</label>
          <select
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none"
          >
            <option value="Transferencia / Consignación">Transferencia / Consignación</option>
            <option value="Cheque">Cheque</option>
            <option value="Efectivo">Efectivo</option>
          </select>
        </div>

        {/* Fecha del Pago con Validación en Tiempo Real (MODIFICADO) */}
        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Fecha del Pago *</label>
          <input
            type="date"
            value={fechaContable}
            onChange={(e) => {
              setFechaContable(e.target.value);
              if (errorPeriodo) setErrorPeriodo(null);
            }}
            onBlur={() => verificarPeriodo(fechaContable)}
            required
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
          />
          {validandoPeriodo && (
            <p className="text-[9px] text-blue-600 mt-0.5 animate-pulse">Verificando periodo...</p>
          )}
          {errorPeriodo && (
            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1 rounded mt-0.5">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>

        {formaPago !== "Efectivo" ? (
          <div className="md:col-span-4">
            <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Cuenta Financiera (Bancos)</label>
            <select
              value={cuentaBancoId}
              onChange={(e) => setCuentaBancoId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
            >
              {cuentasBancos.map((cta: any) => (
                <option key={cta.id} value={cta.id}>{cta.nombre_cuenta} ({cta.numero_cuenta})</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="md:col-span-4">
            <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Concepto Auxiliar Contable (Egreso / Caja)</label>
            <select
              value={conceptoAuxiliarId}
              onChange={(e) => setConceptoAuxiliarId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
            >
              {conceptosAuxiliares.map((ca: any) => (
                <option key={ca.id} value={ca.id}>[{ca.codigo_auxiliar}] {ca.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div className="md:col-span-8">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Seleccionar Proveedor (Carga Facturas por Vencimiento)</label>
          <select
            value={filtroProveedorId}
            onChange={(e) => setFiltroProveedorId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="">-- Seleccione un Proveedor para ver sus facturas --</option>
            {proveedores.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.razon_social} [{p.numero_identificacion}]
              </option>
            ))}
          </select>
        </div>

        {tipoPagoMasivo === "EXCEL" && (
          <div className="md:col-span-12 bg-indigo-50 p-3 rounded border border-indigo-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-indigo-900 block">Carga Masiva por Excel:</span>
              <span className="text-[10px] text-indigo-700">Seleccione el archivo con columnas `numero_factura` y `valor_pagado` para cruzar y procesar.</span>
            </div>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUploadExcel}
              className="text-xs bg-white border border-indigo-300 rounded px-2 py-1"
            />
          </div>
        )}

        {tipoPagoMasivo === "AUTOMATICO_VALOR" && (
          <div className="md:col-span-12 bg-emerald-50 p-3 rounded border border-emerald-200 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-900 block">Pago Automático por Valor Neto (FIFO):</span>
                <span className="text-[10px] text-emerald-700">Digite el valor total a desembolsar. Máximo adeudado: <strong className="font-mono">{fmt(saldoMaximoProveedor)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-900 text-xs">Valor Neto a Pagar:</span>
                <input
                  type="number"
                  placeholder="Ej: 5500000"
                  value={valorNetoObjetivo || ""}
                  onChange={(e) => setValorNetoObjetivo(Number(e.target.value))}
                  className="bg-white border border-emerald-400 rounded px-2 py-1 text-right font-mono font-bold text-xs outline-none w-36"
                />
              </div>
            </div>
            {valorNetoObjetivo > saldoMaximoProveedor && saldoMaximoProveedor > 0 && (
              <div className="text-[10px] text-red-600 font-bold bg-red-50 p-1 rounded border border-red-200 mt-1">
                ⚠️ El valor digitado ({fmt(valorNetoObjetivo)}) excede lo adeudado al proveedor. El saldo máximo pendiente es {fmt(saldoMaximoProveedor)}.
              </div>
            )}
          </div>
        )}

        {/* SELECTORES GLOBALES DE RETENCIÓN */}
        <div className="md:col-span-4">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Retención Renta (Global)</label>
          <select
            value={retencionRentaId}
            onChange={(e) => setRetencionRentaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="">-- Sin Retención Renta --</option>
            {conceptosRet
              .filter((cr: any) => cr.tipo_retencion === "RENTA")
              .map((cr: any) => {
                const textoCorto = cr.nombre.length > 55 ? cr.nombre.substring(0, 55) + "..." : cr.nombre;
                const porcentajeMostrado = Number(cr.porcentaje || 0) * 100;
                return (
                  <option key={cr.id} value={cr.id}>
                    {textoCorto} ({porcentajeMostrado}%)
                  </option>
                );
              })}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Retención IVA (Global)</label>
          <select
            value={retencionIvaId}
            onChange={(e) => setRetencionIvaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="">-- Sin Retención IVA --</option>
            {conceptosRet
              .filter((cr: any) => cr.tipo_retencion === "IVA")
              .map((cr: any) => {
                const textoCorto = cr.nombre.length > 55 ? cr.nombre.substring(0, 55) + "..." : cr.nombre;
                const porcentajeMostrado = Number(cr.porcentaje || 0) * 100;
                return (
                  <option key={cr.id} value={cr.id}>
                    {textoCorto} ({porcentajeMostrado}%)
                  </option>
                );
              })}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Retención ICA (Global)</label>
          <select
            value={retencionIcaId}
            onChange={(e) => setRetencionIcaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none truncate"
          >
            <option value="">-- Sin Retención ICA --</option>
            {conceptosRet
              .filter((cr: any) => cr.tipo_retencion === "ICA")
              .map((cr: any) => {
                const textoCorto = cr.nombre.length > 55 ? cr.nombre.substring(0, 55) + "..." : cr.nombre;
                const porMilMostrado = Number(cr.porcentaje || 0) * 1000;
                return (
                  <option key={cr.id} value={cr.id}>
                    {textoCorto} ({porMilMostrado} x mil)
                  </option>
                );
              })}
          </select>
        </div>
      </div>

      {/* BARRA DE GLOSA Y EJECUCIÓN */}
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-1/2">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Glosa / Concepto General</label>
          <input
            type="text"
            value={glosa}
            onChange={(e) => setGlosa(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-slate-500 uppercase text-[10px] block font-bold">Total Neto a Pagar:</span>
            <span className="font-mono font-bold text-emerald-700 text-base">{fmt(totalGeneralPago)}</span>
          </div>

          {/* Botón de Ejecución bloqueado si hay error de periodo (MODIFICADO) */}
          <button
            type="button"
            onClick={handleSubmitPago}
            disabled={!isMounted || procesando || totalGeneralPago <= 0 || (tipoPagoMasivo === "AUTOMATICO_VALOR" && valorNetoObjetivo > saldoMaximoProveedor) || Boolean(errorPeriodo)}
            suppressHydrationWarning
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded shadow transition text-xs"
          >
            {procesando ? "Procesando Egreso..." : "💾 Ejecutar Pago y Contabilizar"}
          </button>
        </div>
      </div>

      {/* TABLA DE FACTURAS PENDIENTES */}
      {loading ? (
        <div className="p-8 text-center text-slate-400">Cargando facturas pendientes del proveedor...</div>
      ) : !filtroProveedorId ? (
        <div className="p-8 text-center text-slate-400 italic bg-white border rounded-lg">
          Seleccione un proveedor en el filtro superior para visualizar sus facturas pendientes.
        </div>
      ) : tipoPagoMasivo === "EXCEL" && !excelCargado ? (
        <div className="p-8 text-center text-indigo-600 italic bg-indigo-50/50 border border-indigo-200 rounded-lg font-medium">
          📁 Por favor cargue el archivo Excel en la barra superior para procesar y validar las facturas correspondientes.
        </div>
      ) : facturas.length === 0 ? (
        <div className="p-8 text-center text-slate-400 italic bg-white border rounded-lg">
          El proveedor seleccionado no tiene facturas con saldo pendiente.
        </div>
      ) : (
        <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
              <tr>
                <th className="p-2 text-center w-10">Sel.</th>
                <th className="p-2">Factura # / Notas</th>
                <th className="p-2">Vencimiento</th>
                <th className="p-2 text-right">Subtotal</th>
                <th className="p-2 text-right">IVA</th>
                <th className="p-2 text-right">Saldo Pendiente</th>
                <th className="p-2 text-right">ReteRenta</th>
                <th className="p-2 text-right">ReteIVA</th>
                <th className="p-2 text-right">ReteICA</th>
                <th className="p-2 text-right w-28 font-bold text-emerald-800">Valor a Pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[10px]">
              {facturas.map((fac: any) => {
                const seleccionada = !!facturasSeleccionadas[fac.id];
                if ((tipoPagoMasivo === "EXCEL" || tipoPagoMasivo === "AUTOMATICO_VALOR") && !seleccionada) {
                  return null;
                }

                const subtotalFac = Number(fac.subtotal || 0);
                const ivaFac = Number(fac.impuestos || 0);
                const saldoReal = Number(fac.saldo_pendiente || 0);
                const valorNetoPagar = obtenerValorAPagar(fac);
                const notas = fac.notas || [];

                const rets = retencionesFactura[fac.id] || {};
                const valRenta = retencionRentaId ? Number(rets[retencionRentaId] || 0) : 0;
                const valIva = retencionIvaId ? Number(rets[retencionIvaId] || 0) : 0;
                const valIca = retencionIcaId ? Number(rets[retencionIcaId] || 0) : 0;

                return (
                  <tr key={fac.id} className={seleccionada ? "bg-indigo-50/40" : "hover:bg-slate-50"}>
                    <td className="p-2 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={seleccionada}
                        disabled={tipoPagoMasivo !== "MANUAL_INDIVIDUAL"}
                        onChange={() => handleToggleSelect(fac.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                      />
                    </td>
                    <td className="p-2 align-middle">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{fac.numero_factura}</span>
                        {notas.map((n: any) => (
                          <span 
                            key={n.id} 
                            className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                              n.tipo_nota === 'CREDITO' 
                                ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                            title={`Motivo: ${n.motivo || 'Sin motivo'}`}
                          >
                            {n.tipo_nota}: {n.numero_nota} ({fmt(n.monto_total)})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 text-slate-600 align-middle">{fac.fecha_vencimiento || "N/A"}</td>
                    <td className="p-2 text-right font-mono text-slate-700 align-middle">{fmt(subtotalFac)}</td>
                    <td className="p-2 text-right font-mono text-slate-700 align-middle">{fmt(ivaFac)}</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900 align-middle">{fmt(saldoReal)}</td>
                    
                    <td className="p-2 text-right font-mono text-slate-600 align-middle">
                      {retencionRentaId && seleccionada ? fmt(valRenta) : "—"}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-600 align-middle">
                      {retencionIvaId && seleccionada ? fmt(valIva) : "—"}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-600 align-middle">
                      {retencionIcaId && seleccionada ? fmt(valIca) : "—"}
                    </td>

                    <td className="p-2 text-right font-mono font-bold text-emerald-700 align-middle">
                      {seleccionada ? fmt(valorNetoPagar) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}