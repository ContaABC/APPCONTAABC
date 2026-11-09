"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { validarPeriodoContable } from "@/lib/accounting-validations"; // <--- 1. Importar la validación centralizada
import {
  obtenerEmpresas,
  obtenerSucursales,
  obtenerClientesConSaldo,
  obtenerConceptosYBancos,
  obtenerClasesDocumento,
  obtenerConceptosRetencion,
  crearBancoNacional,
  procesarCobroMasivoConRetenciones,
} from "./cobrar-actions";

interface DetalleCobroIndividual {
  seleccionado: boolean;
  abonoBruto: string;
  valorIva: string;
  reteRenta: string;
  reteIva: string;
  reteIca: string;
}

export default function NuevoCobroPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  // Modo: "INDIVIDUAL" o "MASIVO"
  const [modo, setModo] = useState<"INDIVIDUAL" | "MASIVO">("INDIVIDUAL");

  // Selector de Empresa y Sucursal
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<any>("");
  const [sucursalId, setSucursalId] = useState<any>("");

  // Datos de negocio
  const [facturasPendientes, setFacturasPendientes] = useState<any[]>([]);
  const [conceptos, setConceptos] = useState<any[]>([]);
  const [cuentasFinancieras, setCuentasFinancieras] = useState<any[]>([]);
  const [bancosNacionales, setBancosNacionales] = useState<any[]>([]);
  const [clasesDocumento, setClasesDocumento] = useState<any[]>([]);
  
  // Conceptos de Retención separados por tipo
  const [conceptosRenta, setConceptosRenta] = useState<any[]>([]);
  const [conceptosIva, setConceptosIva] = useState<any[]>([]);
  const [conceptosIca, setConceptosIca] = useState<any[]>([]);

  const [conceptoRentaId, setConceptoRentaId] = useState<string>("");
  const [conceptoIvaId, setConceptoIvaId] = useState<string>("");
  const [conceptoIcaId, setConceptoIcaId] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados para Control de Periodo Contable (NUEVO)
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  // Formulario del Recibo de Caja
  const [fechaPago, setFechaPago] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [fechaContable, setFechaContable] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [claseDocumento, setClaseDocumento] = useState<string>("");
  const [formaPago, setFormaPago] = useState<"EFECTIVO" | "TRANSFERENCIA" | "CHEQUE">("EFECTIVO");
  const [conceptoAuxiliarId, setConceptoAuxiliarId] = useState<string>("");
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");

  // Selección de Cliente y sus Abonos Individuales
  const [clienteSeleccionadoNit, setClienteSeleccionadoNit] = useState<string>("");
  const [cobrosIndividuales, setCobrosIndividuales] = useState<{ [facturaId: string]: DetalleCobroIndividual }>({});
  const [valorRecibido, setValorRecibido] = useState<string>("");

  // Estados para Carga Masiva (Excel)
  const [excelData, setExcelData] = useState<any[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState<string>("");

  // Datos específicos para Cheque
  const [bancoNacionalId, setBancoNacionalId] = useState<string>("");
  const [numeroCheque, setNumeroCheque] = useState<string>("");
  const [fechaVencimientoCheque, setFechaVencimientoCheque] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Modal para Nuevo Banco Nacional
  const [modalBancoOpen, setModalBancoOpen] = useState<boolean>(false);
  const [nuevoBancoCodigo, setNuevoBancoCodigo] = useState<string>("");
  const [nuevoBancoNombre, setNuevoBancoNombre] = useState<string>("");

  // Formateadores numéricos de Moneda
  const formatCOP = (val: number | string) => {
    const num = typeof val === "number" ? val : Number(String(val).replace(/\D/g, "")) || 0;
    if (num === 0) return "$ 0";
    return `$ ${num.toLocaleString("es-CO")}`;
  };

  const parseNumber = (val: string) => {
    return Number(String(val).replace(/\D/g, "")) || 0;
  };

  const recortarTexto = (texto: string, maxLargo: number = 60) => {
    if (!texto) return "";
    return texto.length > maxLargo ? texto.substring(0, maxLargo) + "..." : texto;
  };

  useEffect(() => {
    setIsMounted(true);
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

  // Validar automáticamente al cambiar empresa, sucursal o si ya hay fecha contable cargada
  useEffect(() => {
    if (empresaId && sucursalId && fechaContable) {
      verificarPeriodo(fechaContable);
    }
  }, [empresaId, sucursalId]);

  useEffect(() => {
    if (!isMounted) return;
    async function initEmpresas() {
      try {
        const res = await obtenerEmpresas();
        if (res && res.success && res.data && res.data.length > 0) {
          setEmpresas(res.data);
          setEmpresaId(res.data[0].id);
        } else {
          setErrorMsg(res?.error || "No se encontraron empresas registradas.");
        }
      } catch (err: any) {
        setErrorMsg("Error de conexión al cargar empresas: " + err.message);
      }
    }
    initEmpresas();
  }, [isMounted]);

  useEffect(() => {
    if (empresaId === "" || !isMounted) return;

    async function cargarDatosEmpresaYRetenciones() {
      setSucursalId("");
      setClaseDocumento("");
      setConceptoRentaId("");
      setConceptoIvaId("");
      setConceptoIcaId("");
      
      const [resSuc, resDoc, resRenta, resIva, resIca] = await Promise.all([
        obtenerSucursales(empresaId),
        obtenerClasesDocumento(empresaId),
        obtenerConceptosRetencion(Number(empresaId), "RENTA", fechaContable),
        obtenerConceptosRetencion(Number(empresaId), "IVA", fechaContable),
        obtenerConceptosRetencion(Number(empresaId), "ICA", fechaContable),
      ]);

      if (resSuc && resSuc.success && resSuc.data && resSuc.data.length > 0) {
        setSucursales(resSuc.data);
        setSucursalId(resSuc.data[0].id);
      } else {
        setSucursales([]);
      }

      if (resDoc && resDoc.success && resDoc.data && resDoc.data.length > 0) {
        setClasesDocumento(resDoc.data);
        setClaseDocumento(String(resDoc.data[0].id));
      } else {
        setClasesDocumento([]);
      }

      setConceptosRenta(resRenta && resRenta.success && resRenta.data ? resRenta.data : []);
      setConceptosIva(resIva && resIva.success && resIva.data ? resIva.data : []);
      setConceptosIca(resIca && resIca.success && resIca.data ? resIca.data : []);
    }
    cargarDatosEmpresaYRetenciones();
  }, [empresaId, fechaContable, isMounted]);

  useEffect(() => {
    if (!conceptoRentaId) {
      setConceptoIvaId("");
      return;
    }

    const rentaObj = conceptosRenta.find((r) => String(r.id) === String(conceptoRentaId));
    if (!rentaObj) return;

    const textoRenta = String(rentaObj.concepto || rentaObj.nombre || "").toLowerCase();
    const esCompras = textoRenta.includes("compra") || textoRenta.includes("enajenacion") || textoRenta.includes("enajenación");

    if (conceptosIva.length > 0) {
      const matchIva = conceptosIva.find((item) => {
        const txt = String(item.concepto || item.nombre || "").toLowerCase();
        return esCompras ? txt.includes("compra") : txt.includes("servicio");
      });
      setConceptoIvaId(matchIva ? String(matchIva.id) : String(conceptosIva[0].id));
    }
  }, [conceptoRentaId, conceptosRenta, conceptosIva]);

  useEffect(() => {
    if (empresaId === "" || !isMounted) return;
    async function cargarDatosNegocio() {
      setLoading(true);
      setClienteSeleccionadoNit("");
      setCobrosIndividuales({});
      setConceptoAuxiliarId("");
      setCuentaFinancieraId("");
      setValorRecibido("");
      setExcelData([]);
      setNombreArchivo("");

      try {
        const [dataRes, cliRes] = await Promise.all([
          obtenerConceptosYBancos(empresaId, sucursalId),
          obtenerClientesConSaldo(empresaId),
        ]);

        if (dataRes && dataRes.success && dataRes.data) {
          setConceptos(dataRes.data.conceptos || []);
          setCuentasFinancieras(dataRes.data.cuentasFinancieras || []);
          setBancosNacionales(dataRes.data.bancosNacionales || []);
        }
        if (cliRes && cliRes.success) {
          const facturasMapeadas = (cliRes.data || []).map((f: any) => ({
            ...f,
            saldo_pendiente: Number(f.saldo_pendiente ?? f.saldoPendiente ?? f.total_factura ?? 0),
            iva: Number(f.iva ?? 0),
            total_abonos: Number(f.total_abonos ?? 0),
          }));
          setFacturasPendientes(facturasMapeadas);
        }
      } catch (err: any) {
        console.error("Error cargando datos de negocio:", err);
      }
      setLoading(false);
    }
    cargarDatosNegocio();
  }, [empresaId, sucursalId, isMounted]);

  const clientesDisponibles = useMemo(() => {
    const map = new Map();
    facturasPendientes.forEach((f) => {
      if (f.cliente_nit && !map.has(f.cliente_nit)) {
        map.set(f.cliente_nit, {
          nombre: f.cliente_nombre || "Sin Nombre",
          nit: f.cliente_nit,
          clienteId: f.cliente_id,
        });
      }
    });
    return Array.from(map.values());
  }, [facturasPendientes]);

  const facturasClienteActual = useMemo(() => {
    if (!clienteSeleccionadoNit) return [];
    return facturasPendientes.filter((f) => f.cliente_nit === clienteSeleccionadoNit);
  }, [facturasPendientes, clienteSeleccionadoNit]);

  useEffect(() => {
    if (!clienteSeleccionadoNit || facturasClienteActual.length === 0) return;

    const nuevosCobros: { [facturaId: string]: DetalleCobroIndividual } = {};
    facturasClienteActual.forEach((f) => {
      const ivaFactura = Number(f.iva || 0);
      
      nuevosCobros[String(f.id)] = {
        seleccionado: false,
        abonoBruto: "",
        valorIva: formatCOP(ivaFactura),
        reteRenta: "$ 0",
        reteIva: "$ 0",
        reteIca: "$ 0",
      };
    });
    setCobrosIndividuales(nuevosCobros);
  }, [clienteSeleccionadoNit, facturasClienteActual]);

  const clienteActualObj = useMemo(() => {
    if (!clienteSeleccionadoNit) return null;
    return clientesDisponibles.find((c) => c.nit === clienteSeleccionadoNit) || null;
  }, [clienteSeleccionadoNit, clientesDisponibles]);

  const conceptosFiltrados = useMemo(() => {
    if (!conceptos || conceptos.length === 0) return [];
    return conceptos.filter((c) => {
      const tipo = String(c.tipo_entidad || "").trim();
      if (formaPago === "EFECTIVO" || formaPago === "CHEQUE") {
        return tipo === "Cuentas_Caja" || tipo.toLowerCase().includes("ingresos");
      } else {
        return tipo === "Cuentas_Bancarias" || tipo.toLowerCase().includes("bancarias");
      }
    });
  }, [conceptos, formaPago]);

  const cuentasFinancierasFiltradas = useMemo(() => {
    if (!conceptoAuxiliarId) return [];
    return cuentasFinancieras.filter((cf) => Number(cf.concepto_auxiliar_id) === Number(conceptoAuxiliarId));
  }, [cuentasFinancieras, conceptoAuxiliarId]);

  const calcularRetencionesAutomaticas = (abonoBrutoTotal: number, valorIvaInput: number) => {
    const baseSinIva = Math.max(0, abonoBrutoTotal - valorIvaInput);

    let rentaVal = 0;
    let ivaVal = 0;
    let icaVal = 0;

    if (conceptoRentaId) {
      const rObj = conceptosRenta.find((r) => String(r.id) === String(conceptoRentaId));
      if (rObj && rObj.tarifa !== undefined && rObj.tarifa !== null) {
        const tarifaNum = Number(rObj.tarifa);
        const porc = tarifaNum > 1 ? tarifaNum / 100 : tarifaNum;
        rentaVal = Math.round(baseSinIva * porc);
      }
    }

    if (conceptoIvaId) {
      const iObj = conceptosIva.find((i) => String(i.id) === String(conceptoIvaId));
      if (iObj && iObj.tarifa !== undefined && iObj.tarifa !== null) {
        const tarifaNum = Number(iObj.tarifa);
        const porc = tarifaNum > 1 ? tarifaNum / 100 : tarifaNum;
        ivaVal = Math.round(valorIvaInput * porc);
      }
    }

    if (conceptoIcaId) {
      const icObj = conceptosIca.find((ic) => String(ic.id) === String(conceptoIcaId));
      if (icObj && icObj.tarifa !== undefined && icObj.tarifa !== null) {
        const tarifaNum = Number(icObj.tarifa);
        const porc = tarifaNum > 1 ? tarifaNum / 1000 : tarifaNum;
        icaVal = Math.round(baseSinIva * porc);
      }
    }

    return {
      reteRenta: rentaVal > 0 ? formatCOP(rentaVal) : "$ 0",
      reteIva: ivaVal > 0 ? formatCOP(ivaVal) : "$ 0",
      reteIca: icaVal > 0 ? formatCOP(icaVal) : "$ 0",
    };
  };

  useEffect(() => {
    if (!clienteSeleccionadoNit || Object.keys(cobrosIndividuales).length === 0) return;

    setCobrosIndividuales((prev) => {
      const actualizados = { ...prev };
      let huboCambios = false;

      Object.keys(actualizados).forEach((factId) => {
        const item = actualizados[factId];
        if (item && item.seleccionado) {
          const brutoNum = parseNumber(item.abonoBruto);
          const ivaNum = parseNumber(item.valorIva);
          if (brutoNum > 0) {
            const nuevasRetenciones = calcularRetencionesAutomaticas(brutoNum, ivaNum);
            actualizados[factId] = {
              ...item,
              ...nuevasRetenciones,
            };
            huboCambios = true;
          }
        }
      });

      return huboCambios ? actualizados : prev;
    });
  }, [conceptoRentaId, conceptoIvaId, conceptoIcaId]);

  const handleCampoIndividualChange = (
    facturaId: string | number,
    campo: keyof DetalleCobroIndividual,
    valorRaw: string
  ) => {
    setCobrosIndividuales((prev) => {
      const actual = prev[String(facturaId)] || {
        seleccionado: false,
        abonoBruto: "",
        valorIva: "$ 0",
        reteRenta: "$ 0",
        reteIva: "$ 0",
        reteIca: "$ 0",
      };

      if (campo === "abonoBruto") {
        const num = parseNumber(valorRaw);
        const valorFormateado = num === 0 ? "" : formatCOP(num);
        const actualIvaNum = parseNumber(actual.valorIva);
        const retencionesAuto = calcularRetencionesAutomaticas(num, actualIvaNum);

        return {
          ...prev,
          [String(facturaId)]: {
            ...actual,
            abonoBruto: valorFormateado,
            seleccionado: num > 0 ? true : actual.seleccionado,
            ...retencionesAuto,
          },
        };
      }

      if (campo === "valorIva") {
        const numIva = parseNumber(valorRaw);
        const valorIvaFormateado = numIva === 0 ? "$ 0" : formatCOP(numIva);
        const actualBrutoNum = parseNumber(actual.abonoBruto);
        const retencionesAuto = calcularRetencionesAutomaticas(actualBrutoNum, numIva);

        return {
          ...prev,
          [String(facturaId)]: {
            ...actual,
            valorIva: valorIvaFormateado,
            ...retencionesAuto,
          },
        };
      }

      if (campo === "seleccionado") {
        const nuevoCheck = !actual.seleccionado;
        let abonoFinal = actual.abonoBruto;
        let ivaFinal = actual.valorIva;
        let retencionesAuto = { reteRenta: actual.reteRenta, reteIva: actual.reteIva, reteIca: actual.reteIca };
        
        if (nuevoCheck) {
          const facturaObj = facturasPendientes.find((f) => String(f.id) === String(facturaId));
          const saldo = facturaObj ? Number(facturaObj.saldo_pendiente || 0) : 0;
          const ivaFactura = facturaObj ? Number(facturaObj.iva || 0) : 0;
          abonoFinal = formatCOP(saldo);
          ivaFinal = formatCOP(ivaFactura);
          retencionesAuto = calcularRetencionesAutomaticas(saldo, ivaFactura);
        } else {
          abonoFinal = "";
          ivaFinal = "$ 0";
          retencionesAuto = { reteRenta: "$ 0", reteIva: "$ 0", reteIca: "$ 0" };
        }

        return {
          ...prev,
          [String(facturaId)]: {
            ...actual,
            seleccionado: nuevoCheck,
            abonoBruto: abonoFinal,
            valorIva: ivaFinal,
            ...retencionesAuto,
          },
        };
      }

      const num = parseNumber(valorRaw);
      const valorFormateado = num === 0 ? "$ 0" : formatCOP(num);
      return {
        ...prev,
        [String(facturaId)]: {
          ...actual,
          [campo]: valorFormateado,
        },
      };
    });
  };

  const todasSeleccionadas = useMemo(() => {
    if (facturasClienteActual.length === 0) return false;
    return facturasClienteActual.every((f) => cobrosIndividuales[f.id]?.seleccionado);
  }, [facturasClienteActual, cobrosIndividuales]);

  const handleAlternarSeleccionarTodas = () => {
    const nuevosCobros: { [facturaId: string]: DetalleCobroIndividual } = {};
    const marcarComo = !todasSeleccionadas;

    facturasClienteActual.forEach((f) => {
      const saldo = Number(f.saldo_pendiente || 0);
      const ivaFactura = Number(f.iva || 0);
      const retencionesAuto = calcularRetencionesAutomaticas(saldo, ivaFactura);

      nuevosCobros[String(f.id)] = {
        seleccionado: marcarComo,
        abonoBruto: marcarComo ? formatCOP(saldo) : "",
        valorIva: formatCOP(ivaFactura),
        ...(marcarComo ? retencionesAuto : { reteRenta: "$ 0", reteIva: "$ 0", reteIca: "$ 0" }),
      };
    });
    setCobrosIndividuales(nuevosCobros);
  };

  const calcularTotalCobro = () => {
    if (modo === "INDIVIDUAL") {
      return Object.values(cobrosIndividuales).reduce((sum, item) => {
        if (!item.seleccionado) return sum;
        const bruto = parseNumber(item.abonoBruto);
        const renta = parseNumber(item.reteRenta);
        const iva = parseNumber(item.reteIva);
        const ica = parseNumber(item.reteIca);
        const neto = Math.max(0, bruto - (renta + iva + ica));
        return sum + neto;
      }, 0);
    } else {
      return excelData
        .filter((row) => row.seleccionado && row.valida)
        .reduce((sum, row) => sum + (Number(row.valorNeto || 0)), 0);
    }
  };

  const handleValorRecibidoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    setValorRecibido(rawValue);
  };

  const valorSeleccionado = calcularTotalCobro();
  const numValorRecibido = Number(valorRecibido) || 0;
  const diferenciaRecibidoSeleccionado = numValorRecibido - valorSeleccionado;

  const handleToggleSeleccionFila = (idFila: number) => {
    setExcelData((prev) =>
      prev.map((row) =>
        row.idFila === idFila && row.valida ? { ...row, seleccionado: !row.seleccionado } : row
      )
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!clienteSeleccionadoNit) {
      setErrorMsg("Por favor, seleccione primero el cliente al que pertenecen las facturas del archivo.");
      e.target.value = "";
      return;
    }

    setNombreArchivo(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const formattedData = rawData.map((row: any, idx: number) => {
          const normalizedRow: any = {};
          Object.keys(row).forEach((key) => {
            const cleanKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
            normalizedRow[cleanKey] = row[key];
          });

          const numeroFactura = String(
            normalizedRow["factura"] ||
            normalizedRow["numerofactura"] ||
            normalizedRow["nfactura"] ||
            normalizedRow["doc"] ||
            normalizedRow["documento"] ||
            ""
          ).trim();

          const valorAbonado = Number(
            normalizedRow["valor"] ||
            normalizedRow["abono"] ||
            normalizedRow["valorabono"] ||
            normalizedRow["monto"] ||
            0
          );

          const valorIvaExcel = Number(
            normalizedRow["valoriva"] ||
            normalizedRow["iva"] ||
            0
          );

          const reteRenta = Number(
            normalizedRow["retencionrenta"] ||
            normalizedRow["reterenta"] ||
            normalizedRow["rentarete"] ||
            0
          );

          const reteIva = Number(
            normalizedRow["retencioniva"] ||
            normalizedRow["reteiva"] ||
            0
          );

          const reteIca = Number(
            normalizedRow["retencionica"] ||
            normalizedRow["reteica"] ||
            normalizedRow["ica"] ||
            0
          );

          const retencionTotal = reteRenta + reteIva + reteIca;
          const valorNeto = Math.max(0, valorAbonado - retencionTotal);

          const facturaEncontrada = facturasPendientes.find(
            (f) => String(f.numero_factura).trim() === numeroFactura
          );

          const existe = !!facturaEncontrada;
          const perteneceAlCliente = existe && facturaEncontrada.cliente_nit === clienteSeleccionadoNit;
          const saldoReal = existe ? Number(facturaEncontrada.saldo_pendiente || 0) : 0;
          const abonoValido = valorAbonado > 0 && valorNeto <= (saldoReal + 0.01);

          const valida = Boolean(existe && perteneceAlCliente && abonoValido);

          return {
            idFila: idx + 1,
            numeroFactura: numeroFactura || "VACÍO",
            facturaId: existe ? facturaEncontrada.id : null,
            nitFactura: existe ? facturaEncontrada.cliente_nit : "No encontrada",
            nombreClienteFactura: existe ? facturaEncontrada.cliente_nombre : "Desconocido",
            saldoPendiente: saldoReal,
            valorAbonado,
            valorIvaExcel,
            reteRenta,
            reteIva,
            reteIca,
            retencionTotal,
            valorNeto,
            valida,
            existe,
            perteneceAlCliente,
            seleccionado: valida,
            motivoError: !existe 
              ? "Factura no existe" 
              : !perteneceAlCliente 
              ? "Pertenece a otro cliente" 
              : !abonoValido 
              ? "Abono neto en 0 o excede saldo" 
              : "",
            documento_origen: numeroFactura,
            fecha_contable: fechaContable,
            tercero_nit: clienteSeleccionadoNit,
          };
        });

        const filasValidasExcel = formattedData.filter(r => r.numeroFactura !== "VACÍO" || r.valorAbonado > 0);

        setExcelData(filasValidasExcel);
        setErrorMsg(null);
      } catch (err) {
        console.error(err);
        setErrorMsg("Error al leer el archivo de Excel. Verifique el formato.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportarErrores = () => {
    const invalidos = excelData.filter((r) => !r.valida);
    if (invalidos.length === 0) {
      alert("¡No hay registros con errores para exportar!");
      return;
    }

    const dataExport = invalidos.map((r) => ({
      "Fila N°": r.idFila,
      "N° Factura": r.numeroFactura,
      "NIT Factura": r.nitFactura,
      "Valor Abono": r.valorAbonado,
      "Motivo del Error": r.motivoError
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas Invalidas");
    XLSX.writeFile(workbook, "facturas_con_errores_cargue.xlsx");
  };

  async function handleCrearBancoNacional(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoBancoCodigo || !nuevoBancoNombre) {
      alert("Ingrese código y nombre del banco nacional.");
      return;
    }
    const res = await crearBancoNacional(nuevoBancoCodigo, nuevoBancoNombre);
    if (res && res.success && res.data) {
      setBancosNacionales((prev) => [...prev, res.data]);
      setBancoNacionalId(String(res.data.id));
      setModalBancoOpen(false);
      setNuevoBancoCodigo("");
      setNuevoBancoNombre("");
    } else {
      alert(`Error creando banco: ${res?.error || "Desconocido"}`);
    }
  }

  const resetFormulario = () => {
    setClienteSeleccionadoNit("");
    setCobrosIndividuales({});
    setFormaPago("EFECTIVO");
    setConceptoAuxiliarId("");
    setCuentaFinancieraId("");
    setConceptoRentaId("");
    setConceptoIvaId("");
    setConceptoIcaId("");
    setObservaciones("");
    setValorRecibido("");
    setExcelData([]);
    setNombreArchivo("");
    setBancoNacionalId("");
    setNumeroCheque("");
    setFechaVencimientoCheque(new Date().toISOString().split("T")[0]);
    setFechaPago(new Date().toISOString().split("T")[0]);
    setFechaContable(new Date().toISOString().split("T")[0]);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // Doble control de seguridad para impedir envíos si el periodo tiene errores
    if (errorPeriodo) {
      setErrorMsg("No se puede procesar el documento porque el periodo contable no es válido.");
      return;
    }

    if (empresaId === "") {
      setErrorMsg("Debe seleccionar una empresa.");
      return;
    }
    if (!claseDocumento) {
      setErrorMsg("Debe seleccionar una clase de documento.");
      return;
    }
    if (!conceptoAuxiliarId) {
      setErrorMsg("Debe seleccionar la cuenta contable (Concepto Auxiliar) contrapartida.");
      return;
    }
    if (formaPago === "TRANSFERENCIA" && !cuentaFinancieraId) {
      setErrorMsg("Debe seleccionar una Cuenta Financiera para los pagos por transferencia.");
      return;
    }

    setGuardando(true);

    try {
      const cuentaFinancieraObj = cuentasFinancieras.find(
        (cf: any) => Number(cf.id) === Number(cuentaFinancieraId)
      );

      const conceptoAuxiliarFinalId = cuentaFinancieraObj
        ? Number(cuentaFinancieraObj.concepto_auxiliar_id)
        : conceptoAuxiliarId
        ? Number(conceptoAuxiliarId)
        : null;

      const cuentaFinancieraFinalId = cuentaFinancieraId ? Number(cuentaFinancieraId) : null;

      if (!conceptoAuxiliarFinalId) {
        throw new Error("Debe seleccionar un Concepto Auxiliar Contable válido.");
      }

      const rentaObj = conceptosRenta.find((r: any) => Number(r.id) === Number(conceptoRentaId));
      const ivaObj = conceptosIva.find((r: any) => Number(r.id) === Number(conceptoIvaId));
      const icaObj = conceptosIca.find((r: any) => Number(r.id) === Number(conceptoIcaId));

      const conceptoRentaAuxiliarId = rentaObj
        ? Number(rentaObj.concepto_auxiliar_id || rentaObj.cuenta_id)
        : null;

      const conceptoIvaAuxiliarId = ivaObj
        ? Number(ivaObj.concepto_auxiliar_id || ivaObj.cuenta_id)
        : null;

      const conceptoIcaAuxiliarId = icaObj
        ? Number(icaObj.concepto_auxiliar_id || icaObj.cuenta_id)
        : null;

      const sucursalSeleccionadaObj = sucursales.find((s: any) => String(s.id) === String(sucursalId));
      const codigoDane = sucursalSeleccionadaObj?.codigo_dane || sucursalSeleccionadaObj?.codigo_sucursal || "00000";

      if (modo === "MASIVO") {
        const seleccionados = excelData.filter((r: any) => r.seleccionado && r.valida);
        if (seleccionados.length === 0) {
          throw new Error("Debe marcar al menos una fila válida en el listado de Excel para procesar el cobro masivo.");
        }

        const payloadMasivo = {
          empresaId: Number(empresaId),
          sucursalId: sucursalId !== "" ? Number(sucursalId) : 0,
          codigoDaneSucursal: String(codigoDane),
          claseDocumentoId: Number(claseDocumento),
          conceptoAuxiliarId: conceptoAuxiliarFinalId,
          cuentaFinancieraId: cuentaFinancieraFinalId,
          conceptoRentaId: conceptoRentaAuxiliarId,
          conceptoIvaId: conceptoIvaAuxiliarId,
          conceptoIcaId: conceptoIcaAuxiliarId,
          formaPago,
          filas: seleccionados.map((r: any) => {
            const bruto = Number(r.valorAbonado || 0);
            const vIva = Number(r.valorIvaExcel || 0);
            const baseSinIva = Math.max(0, bruto - vIva);

            const tieneRenta = Number(r.reteRenta || 0) > 0;
            const tieneIva = Number(r.reteIva || 0) > 0;
            const tieneIca = Number(r.reteIca || 0) > 0;

            return {
              documento_origen: String(r.documento_origen || r.numeroFactura),
              fecha_contable: fechaContable,
              valor_abono: bruto,
              tercero_nit: String(r.tercero_nit || clienteSeleccionadoNit),
              retencion_renta: Number(r.reteRenta || 0),
              retencion_iva: Number(r.reteIva || 0),
              retencion_ica: Number(r.reteIca || 0),
              cuenta_financiera_id: cuentaFinancieraFinalId,
              concepto_auxiliar_id: conceptoAuxiliarFinalId,
              tipo_operacion: "EFECTUADA_POR_CLIENTE",
              concepto_renta_id: tieneRenta ? conceptoRentaAuxiliarId : null,
              concepto_iva_id: tieneIva ? conceptoIvaAuxiliarId : null,
              concepto_ica_id: tieneIca ? conceptoIcaAuxiliarId : null,
              base_renta: tieneRenta ? baseSinIva : 0,
              base_iva: tieneIva ? vIva : 0,
              base_ica: tieneIca ? baseSinIva : 0,
              forma_pago: formaPago,
            };
          }),
          observaciones,
        };

        const resMasivo: any = await procesarCobroMasivoConRetenciones(payloadMasivo);

        if (!resMasivo || resMasivo.success === false) {
          throw new Error(resMasivo?.error || resMasivo?.message || "Error al procesar el cobro masivo.");
        }

        const registrosProcesados = resMasivo.data?.registros_procesados ?? resMasivo.registros_procesados ?? 0;
        const numeroDocumentoGenerado = resMasivo.data?.numero_documento ?? resMasivo.numero_documento ?? "N/A";

        alert(
          `¡Cobro masivo procesado con éxito!\n\n` +
          `• Documento Generado: ${numeroDocumentoGenerado}\n` +
          `• Registros Procesados: ${registrosProcesados}`
        );

        resetFormulario();
        router.refresh();

      } else {
        // MODO INDIVIDUAL
        if (!clienteSeleccionadoNit) {
          setErrorMsg("Debe seleccionar un cliente.");
          setGuardando(false);
          return;
        }

        const filasIndividualesValidas = Object.entries(cobrosIndividuales)
          .filter(([_, detalle]) => detalle.seleccionado)
          .map(([facId, detalle]) => {
            const facturaObj = facturasPendientes.find((f: any) => String(f.id) === String(facId));
            const numeroDoc = facturaObj ? String(facturaObj.numero_factura || facId) : String(facId);
            
            const bruto = parseNumber(detalle.abonoBruto);
            const vIva = parseNumber(detalle.valorIva);
            const baseSinIva = Math.max(0, bruto - vIva);

            const renta = parseNumber(detalle.reteRenta);
            const iva = parseNumber(detalle.reteIva);
            const ica = parseNumber(detalle.reteIca);
            const neto = Math.max(0, bruto - (renta + iva + ica));

            return {
              documento_origen: numeroDoc,
              fecha_contable: fechaContable,
              valor_abono: neto,
              abono_bruto: bruto,
              tercero_nit: clienteSeleccionadoNit,
              retencion_renta: renta,
              retencion_iva: iva,
              retencion_ica: ica,
              cuenta_financiera_id: cuentaFinancieraFinalId,
              concepto_auxiliar_id: conceptoAuxiliarFinalId,
              tipo_operacion: "EFECTUADA_POR_CLIENTE",
              concepto_renta_id: renta > 0 ? conceptoRentaAuxiliarId : null,
              concepto_iva_id: iva > 0 ? conceptoIvaAuxiliarId : null,
              concepto_ica_id: ica > 0 ? conceptoIcaAuxiliarId : null,
              base_renta: renta > 0 ? baseSinIva : 0,
              base_iva: iva > 0 ? vIva : 0,
              base_ica: ica > 0 ? baseSinIva : 0,
              forma_pago: formaPago,
              numero_cheque: numeroCheque,
              fecha_vencimiento_cheque: fechaVencimientoCheque,
            };
          })
          .filter((p) => p.abono_bruto > 0);

        if (filasIndividualesValidas.length === 0) {
          setErrorMsg("Debe marcar al menos una factura con el checkbox y registrar un abono válido.");
          setGuardando(false);
          return;
        }

        const payloadIndividual = {
          empresaId: Number(empresaId),
          sucursalId: sucursalId !== "" ? Number(sucursalId) : 0,
          codigoDaneSucursal: String(codigoDane),
          claseDocumentoId: Number(claseDocumento),
          conceptoAuxiliarId: conceptoAuxiliarFinalId,
          cuentaFinancieraId: cuentaFinancieraFinalId,
          conceptoRentaId: conceptoRentaAuxiliarId,
          conceptoIvaId: conceptoIvaAuxiliarId,
          conceptoIcaId: conceptoIcaAuxiliarId,
          formaPago,
          filas: filasIndividualesValidas,
          observaciones,
        };

        const resInd: any = await procesarCobroMasivoConRetenciones(payloadIndividual);

        if (!resInd || resInd.success === false) {
          throw new Error(resInd?.error || resInd?.message || "Error al procesar el cobro individual.");
        }

        const regProc = resInd.data?.registros_procesados ?? resInd.registros_procesados ?? 0;
        const docGen = resInd.data?.numero_documento ?? resInd.numero_documento ?? "N/A";

        alert(
          `¡Recibo de caja registrado con éxito!\n\n` +
          `• Documento Generado: ${docGen}\n` +
          `• Facturas Aplicadas: ${regProc}`
        );

        resetFormulario();
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error inesperado al procesar la solicitud.");
    } finally {
      setGuardando(false);
    }
  }

  if (!isMounted) return <div className="p-4 text-center text-slate-400 text-xs">Cargando formulario...</div>;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-2.5 text-xs">
      <div className="border-b pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-800">Registrar Recibo de Caja (Cobro de Facturas)</h1>
          <p className="text-[11px] text-slate-500">
            Aplica pagos con retenciones de forma individual o masiva mediante archivo Excel.
          </p>
        </div>

        <div className="flex bg-slate-200 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setModo("INDIVIDUAL");
              setExcelData([]);
              setNombreArchivo("");
            }}
            className={`px-3 py-1 font-semibold rounded-md transition ${modo === "INDIVIDUAL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            👤 Cobro Individual
          </button>
          <button
            type="button"
            onClick={() => {
              setModo("MASIVO");
              setCobrosIndividuales({});
            }}
            className={`px-3 py-1 font-semibold rounded-md transition ${modo === "MASIVO" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            📊 Carga Masiva Excel
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-md font-medium">
          ⚠ {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="sticky top-2 z-20 bg-slate-900 text-white p-3 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-center gap-3 border border-slate-700">
          <div className="flex flex-wrap items-center justify-start gap-6 w-full md:w-auto">
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Valor Neto Seleccionado:</span>
              <span className="text-base font-mono font-bold text-emerald-400">
                {formatCOP(valorSeleccionado)}
              </span>
            </div>

            <div className="text-left">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider mb-0.5">Valor Recibido:</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="$ 0"
                value={valorRecibido ? formatCOP(valorRecibido) : ""}
                onChange={handleValorRecibidoChange}
                className="w-32 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-white text-right font-mono text-xs outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div className="text-left">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Diferencia (Recibido - Sel.):</span>
              <span className={`text-base font-mono font-bold ${diferenciaRecibidoSeleccionado < 0 ? "text-rose-400" : diferenciaRecibidoSeleccionado > 0 ? "text-amber-400" : "text-slate-200"}`}>
                {formatCOP(diferenciaRecibidoSeleccionado)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
            <button
              type="button"
              onClick={() => router.push("/cobros/nuevo")}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded text-xs transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || valorSeleccionado <= 0 || Boolean(errorPeriodo)}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded shadow text-xs transition flex items-center gap-1"
            >
              {guardando ? "Procesando..." : modo === "MASIVO" ? "💾 Procesar Cobro Masivo" : "💾 Guardar Recibo de Caja"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Empresa</label>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
            >
              {empresas.length === 0 ? (
                <option value="">Cargando empresas...</option>
              ) : (
                empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.razon_social || emp.nombre_comercial} ({emp.numero_identificacion || ""})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Sucursal</label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Seleccione Sucursal --</option>
              {sucursales.map((suc) => (
                <option key={suc.id} value={suc.id}>
                  {suc.nombre_sucursal || suc.nombre} {suc.codigo_sucursal ? `(${suc.codigo_sucursal})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <h2 className="font-bold text-slate-800 uppercase tracking-wider border-b pb-1 text-[11px]">
            1. Información General del Pago
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Clase de Documento</label>
              <select
                value={claseDocumento}
                onChange={(e) => setClaseDocumento(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">-- Seleccione Clase --</option>
                {clasesDocumento.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.nombre_clase} ({doc.codigo_clase})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Fecha de Pago</label>
              <input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Fecha Contable</label>
              <input
                type="date"
                value={fechaContable}
                onChange={(e) => {
                  const nuevaFecha = e.target.value;
                  setFechaContable(nuevaFecha);
                  if (errorPeriodo) setErrorPeriodo(null);
                }}
                onBlur={() => verificarPeriodo(fechaContable)} // <--- Validación al perder el foco
                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              {validandoPeriodo && (
                <p className="text-[10px] text-blue-500 mt-1 animate-pulse">Verificando estado del periodo...</p>
              )}
              {errorPeriodo && (
                <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1.5 rounded mt-1">
                  ⚠️ {errorPeriodo}
                </p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Forma de Pago</label>
              <select
                value={formaPago}
                onChange={(e) => {
                  setFormaPago(e.target.value as any);
                  setConceptoAuxiliarId("");
                  setCuentaFinancieraId("");
                }}
                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia / Consignación</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
            <div>
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">
                {modo === "MASIVO" ? "Filtrar / Verificar por Cliente" : "Cliente con Saldo Pendiente"}
              </label>
              <select
                value={clienteSeleccionadoNit}
                onChange={(e) => {
                  setClienteSeleccionadoNit(e.target.value);
                  setCobrosIndividuales({});
                  setExcelData([]);
                  setNombreArchivo("");
                }}
                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">-- Seleccione Cliente --</option>
                {clientesDisponibles.map((cli) => (
                  <option key={cli.nit} value={cli.nit}>
                    {cli.nombre} (NIT: {cli.nit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">
                Concepto Auxiliar Contable ({formaPago === "TRANSFERENCIA" ? "Cuentas_Bancarias" : "Cuentas_Caja"})
              </label>
              <select
                value={conceptoAuxiliarId}
                onChange={(e) => {
                  setConceptoAuxiliarId(e.target.value);
                  setCuentaFinancieraId("");
                }}
                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">
                  {conceptosFiltrados.length === 0 ? "⚠ No hay conceptos con este tipo" : "-- Seleccione Cuenta Contable --"}
                </option>
                {conceptosFiltrados.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.codigo_auxiliar}] {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {formaPago === "TRANSFERENCIA" && (
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">
                  Cuenta Financiera Empresa (Filtrada por Concepto)
                </label>
                <select
                  value={cuentaFinancieraId}
                  onChange={(e) => setCuentaFinancieraId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">
                    {!conceptoAuxiliarId
                      ? "Primero seleccione un Concepto Contable"
                      : cuentasFinancierasFiltradas.length === 0
                      ? "⚠️ Sin cuentas financieras asociadas a este concepto"
                      : "Seleccione cuenta financiera..."}
                  </option>
                  {cuentasFinancierasFiltradas.map((cf) => (
                    <option key={cf.id} value={cf.id}>
                      {cf.nombre_cuenta} ({cf.numero_cuenta})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">
                Concepto Retención RENTA
              </label>
              <select
                value={conceptoRentaId}
                onChange={(e) => setConceptoRentaId(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500 text-xs truncate"
              >
                <option value="">-- Seleccionar Renta --</option>
                {[...conceptosRenta]
                  .sort((a, b) => (a.concepto || a.nombre || "").localeCompare(b.concepto || b.nombre || ""))
                  .map((r) => {
                    const desc = r.concepto || r.nombre || "";
                    const tNum = Number(r.tarifa || 0);
                    const tarifaFormateada = tNum > 0 ? ` - ${(tNum > 1 ? tNum : tNum * 100).toFixed(2)}%` : "";
                    const textoCompleto = `${desc}${tarifaFormateada}`;
                    return (
                      <option key={r.id} value={r.id} title={textoCompleto}>
                        {recortarTexto(textoCompleto, 55)}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">
                Concepto Retención IVA
              </label>
              <select
                value={conceptoIvaId}
                onChange={(e) => setConceptoIvaId(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500 text-xs truncate"
              >
                <option value="">-- Seleccionar IVA --</option>
                {[...conceptosIva]
                  .sort((a, b) => (a.concepto || a.nombre || "").localeCompare(b.concepto || b.nombre || ""))
                  .map((r) => {
                    const desc = r.concepto || r.nombre || "";
                    const tNum = Number(r.tarifa || 0);
                    const tarifaFormateada = tNum > 0 ? ` - ${(tNum > 1 ? tNum : tNum * 100).toFixed(2)}%` : "";
                    const textoCompleto = `${desc}${tarifaFormateada}`;
                    return (
                      <option key={r.id} value={r.id} title={textoCompleto}>
                        {recortarTexto(textoCompleto, 55)}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">
                Concepto Retención ICA
              </label>
              <select
                value={conceptoIcaId}
                onChange={(e) => setConceptoIcaId(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500 text-xs truncate"
              >
                <option value="">-- Seleccionar ICA --</option>
                {[...conceptosIca]
                  .sort((a, b) => (a.concepto || a.nombre || "").localeCompare(b.concepto || b.nombre || ""))
                  .map((r) => {
                    const desc = r.concepto || r.nombre || "";
                    const tNum = Number(r.tarifa || 0);
                    const tarifaFormateada = tNum > 0 ? ` - ${(tNum > 1 ? tNum : tNum * 1000).toFixed(2)}‰` : "";
                    const textoCompleto = `${desc}${tarifaFormateada}`;
                    return (
                      <option key={r.id} value={r.id} title={textoCompleto}>
                        {recortarTexto(textoCompleto, 55)}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>
        </div>

        {modo === "MASIVO" && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b pb-1">
              <h2 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                2. Carga de Facturas y Retenciones (Excel - Solo Lectura)
              </h2>
              {excelData.filter(r => !r.valida).length > 0 && (
                <button
                  type="button"
                  onClick={handleExportarErrores}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded text-[11px] shadow transition flex items-center gap-1"
                >
                  📥 Exportar Errores a Excel
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Los valores se cargan directamente desde el archivo y no son editables en pantalla.
            </p>

            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                disabled={!clienteSeleccionadoNit}
                className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              {nombreArchivo && <span className="text-slate-600 font-medium">Archivo cargado: {nombreArchivo} ({excelData.length} registros)</span>}
            </div>
            {!clienteSeleccionadoNit && (
              <p className="text-[11px] text-amber-600 font-medium">⚠ Seleccione un cliente arriba para habilitar la carga del archivo.</p>
            )}

            {excelData.length > 0 && (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-slate-600 border-collapse bg-white rounded shadow-sm">
                  <thead className="bg-slate-100 border-b text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-1.5 text-center w-8">✔</th>
                      <th className="p-1.5">#</th>
                      <th className="p-1.5">Factura</th>
                      <th className="p-1.5 text-right">Saldo (BD)</th>
                      <th className="p-1.5 text-right">Abono Bruto</th>
                      <th className="p-1.5 text-right">Valor IVA</th>
                      <th className="p-1.5 text-right">R. Renta</th>
                      <th className="p-1.5 text-right">R. IVA</th>
                      <th className="p-1.5 text-right">R. ICA</th>
                      <th className="p-1.5 text-right">Neto Pagado</th>
                      <th className="p-1.5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {excelData.map((row) => (
                      <tr key={row.idFila} className={row.valida ? "hover:bg-slate-50" : "bg-red-50 hover:bg-red-100"}>
                        <td className="p-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(row.seleccionado)}
                            disabled={!row.valida}
                            onChange={() => handleToggleSeleccionFila(row.idFila)}
                            className="cursor-pointer accent-blue-600 disabled:opacity-30"
                          />
                        </td>
                        <td className="p-1.5">{row.idFila}</td>
                        <td className="p-1.5 font-bold">{row.numeroFactura}</td>
                        <td className="p-1.5 text-right font-mono">{formatCOP(row.saldoPendiente || 0)}</td>
                        <td className="p-1.5 text-right font-mono">{formatCOP(row.valorAbonado || 0)}</td>
                        <td className="p-1.5 text-right font-mono text-blue-600">{formatCOP(row.valorIvaExcel || 0)}</td>
                        <td className="p-1.5 text-right font-mono text-rose-600">{formatCOP(row.reteRenta || 0)}</td>
                        <td className="p-1.5 text-right font-mono text-rose-600">{formatCOP(row.reteIva || 0)}</td>
                        <td className="p-1.5 text-right font-mono text-rose-600">{formatCOP(row.reteIca || 0)}</td>
                        <td className="p-1.5 text-right font-mono font-bold text-emerald-700">{formatCOP(row.valorNeto || 0)}</td>
                        <td className="p-1.5 text-center">
                          {row.valida ? (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[9px]">Válido</span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold text-[9px]" title={row.motivoError}>
                              {row.motivoError || "Error"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {modo === "INDIVIDUAL" && formaPago === "CHEQUE" && (
          <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 space-y-2">
            <div className="flex items-center justify-between border-b border-amber-200 pb-1">
              <h2 className="font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                Información del Título Valor (Cheque)
              </h2>
              <button
                type="button"
                onClick={() => setModalBancoOpen(true)}
                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded shadow-sm transition text-[11px]"
              >
                ➕ Registrar Banco
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-amber-800 uppercase mb-0.5 text-[11px]">Banco Emisor</label>
                <select
                  value={bancoNacionalId}
                  onChange={(e) => setBancoNacionalId(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-amber-500"
                  required
                >
                  <option value="">
                    {bancosNacionales.length === 0 ? "⚠ Sin bancos nacionales" : "-- Seleccione Banco --"}
                  </option>
                  {bancosNacionales.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre} ({b.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-amber-800 uppercase mb-0.5 text-[11px]">N° de Cheque</label>
                <input
                  type="text"
                  placeholder="Ej. 00012345"
                  value={numeroCheque}
                  onChange={(e) => setNumeroCheque(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-slate-800 outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-amber-800 uppercase mb-0.5 text-[11px]">Fecha Vencimiento</label>
                <input
                  type="date"
                  value={fechaVencimientoCheque}
                  onChange={(e) => setFechaVencimientoCheque(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-slate-800 outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-amber-800 uppercase mb-0.5 text-[11px]">Girador / Tercero</label>
                <input
                  type="text"
                  value={clienteActualObj?.nombre || ""}
                  disabled
                  className="w-full bg-slate-100 border border-amber-300 rounded px-2 py-1 text-slate-700 font-medium cursor-not-allowed outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* MODO INDIVIDUAL */}
        {modo === "INDIVIDUAL" && (
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <h2 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                2. Facturas Activas con Saldo Pendiente
              </h2>
              {facturasClienteActual.length > 0 && (
                <button
                  type="button"
                  onClick={handleAlternarSeleccionarTodas}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded text-[11px] shadow transition"
                >
                  {todasSeleccionadas ? "⚡ Deseleccionar Todas" : "⚡ Seleccionar y Recibir Todas las Facturas"}
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-4 text-center text-slate-400 text-xs">Cargando facturas pendientes...</div>
            ) : !clienteSeleccionadoNit ? (
              <div className="p-4 text-center text-slate-400 text-xs italic">
                Seleccione un cliente arriba para ver sus facturas pendientes de pago.
              </div>
            ) : facturasClienteActual.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs italic">
                Este cliente no tiene facturas con saldo pendiente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-slate-600 border-collapse bg-white rounded shadow-sm">
                  <thead className="bg-slate-100 border-b text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-1.5 text-center w-8">✔</th>
                      <th className="p-1.5">Factura</th>
                      <th className="p-1.5 text-right">Saldo (BD)</th>
                      <th className="p-1.5 text-right">Total Abonos</th>
                      <th className="p-1.5">Notas / Cruces</th>
                      <th className="p-1.5 text-right w-24 text-blue-700">Valor IVA</th>
                      <th className="p-1.5 text-right w-24">R. Renta</th>
                      <th className="p-1.5 text-right w-24">R. IVA</th>
                      <th className="p-1.5 text-right w-24">R. ICA</th>
                      <th className="p-1.5 text-right w-28">Abono Bruto</th>
                      <th className="p-1.5 text-right">Neto Pagado</th>
                      <th className="p-1.5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {facturasClienteActual.map((f) => {
                      const saldoNum = Number(f.saldo_pendiente || 0);
                      const totalAbonosPrevios = Number(f.total_abonos || 0);
                      const cobroActual = cobrosIndividuales[f.id] || {
                        seleccionado: false,
                        abonoBruto: "",
                        valorIva: formatCOP(Number(f.iva || 0)),
                        reteRenta: "$ 0",
                        reteIva: "$ 0",
                        reteIca: "$ 0",
                      };

                      const brutoNum = parseNumber(cobroActual.abonoBruto);
                      const rentaNum = parseNumber(cobroActual.reteRenta);
                      const ivaNum = parseNumber(cobroActual.reteIva);
                      const icaNum = parseNumber(cobroActual.reteIca);

                      const totalRetes = rentaNum + ivaNum + icaNum;
                      const netoPagado = Math.max(0, brutoNum - totalRetes);

                      const estaSeleccionado = Boolean(cobroActual.seleccionado);
                      const esPagada = estaSeleccionado && brutoNum > 0 && (saldoNum - brutoNum) <= 0.01;
                      const esParcial = estaSeleccionado && brutoNum > 0 && (saldoNum - brutoNum) > 0.01;

                      return (
                        <tr key={f.id} className={estaSeleccionado ? "bg-blue-50/40 hover:bg-blue-50/70" : "bg-slate-100/50 opacity-60 hover:bg-slate-100"}>
                          <td className="p-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={estaSeleccionado}
                              onChange={() => handleCampoIndividualChange(f.id, "seleccionado", "")}
                              className="cursor-pointer accent-blue-600 w-3.5 h-3.5"
                            />
                          </td>

                          <td className="p-1.5 font-bold text-slate-900">{f.numero_factura}</td>

                          <td className="p-1.5 text-right font-mono font-bold text-rose-600">
                            {formatCOP(saldoNum)}
                          </td>

                          <td className="p-1.5 text-right font-mono text-slate-500">
                            {formatCOP(totalAbonosPrevios)}
                          </td>

                          <td className="p-1.5 text-slate-500 italic max-w-xs truncate" title={f.notas_asociadas}>
                            {f.notas_asociadas}
                          </td>

                          <td className="p-1.5 text-right">
                            <input
                              type="text"
                              disabled={!estaSeleccionado}
                              placeholder="$ 0"
                              value={cobroActual.valorIva}
                              onChange={(e) => handleCampoIndividualChange(f.id, "valorIva", e.target.value)}
                              className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-right font-mono text-xs text-blue-700 outline-none focus:ring-1 focus:ring-blue-500 font-medium disabled:bg-slate-100"
                            />
                          </td>

                          <td className="p-1.5 text-right">
                            <input
                              type="text"
                              disabled={!estaSeleccionado}
                              placeholder="$ 0"
                              value={cobroActual.reteRenta}
                              onChange={(e) => handleCampoIndividualChange(f.id, "reteRenta", e.target.value)}
                              className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono text-xs text-rose-600 outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                            />
                          </td>

                          <td className="p-1.5 text-right">
                            <input
                              type="text"
                              disabled={!estaSeleccionado}
                              placeholder="$ 0"
                              value={cobroActual.reteIva}
                              onChange={(e) => handleCampoIndividualChange(f.id, "reteIva", e.target.value)}
                              className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono text-xs text-rose-600 outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                            />
                          </td>

                          <td className="p-1.5 text-right">
                            <input
                              type="text"
                              disabled={!estaSeleccionado}
                              placeholder="$ 0"
                              value={cobroActual.reteIca}
                              onChange={(e) => handleCampoIndividualChange(f.id, "reteIca", e.target.value)}
                              className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono text-xs text-rose-600 outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                            />
                          </td>

                          <td className="p-1.5 text-right">
                            <input
                              type="text"
                              disabled={!estaSeleccionado}
                              placeholder="$ 0"
                              value={cobroActual.abonoBruto}
                              onChange={(e) => handleCampoIndividualChange(f.id, "abonoBruto", e.target.value)}
                              className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono text-xs outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                            />
                          </td>

                          <td className="p-1.5 text-right font-mono font-bold text-emerald-700">
                            {formatCOP(estaSeleccionado ? netoPagado : 0)}
                          </td>

                          <td className="p-1.5 text-center">
                            {!estaSeleccionado ? (
                              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-semibold text-[9px]">
                                Omitida
                              </span>
                            ) : esPagada ? (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[9px]">
                                Pagada
                              </span>
                            ) : esParcial ? (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[9px]">
                                Pagado_Parcial
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-semibold text-[9px]">
                                Pendiente
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[11px]">Observaciones / Glosa</label>
          <textarea
            rows={2}
            placeholder="Detalle o notas adicionales del recibo de caja..."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full border border-slate-300 rounded p-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 text-xs"
          ></textarea>
        </div>
      </form>

      {modalBancoOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border rounded-xl shadow-2xl max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-800 text-sm">Registrar Banco Nacional</h3>
              <button
                type="button"
                onClick={() => setModalBancoOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearBancoNacional} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 uppercase mb-0.5">Código del Banco</label>
                <input
                  type="text"
                  placeholder="Ej. 001"
                  value={nuevoBancoCodigo}
                  onChange={(e) => setNuevoBancoCodigo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1 text-slate-800 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 uppercase mb-0.5">Nombre de la Entidad</label>
                <input
                  type="text"
                  placeholder="Ej. Bancolombia"
                  value={nuevoBancoNombre}
                  onChange={(e) => setNuevoBancoNombre(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1 text-slate-800 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setModalBancoOpen(false)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}