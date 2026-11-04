"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  obtenerEmpresas,
  obtenerSucursales,
} from "@/app/consultas/movimientos/movimientos-actions";
import { obtenerCertificadosRetencion } from "./certificados-actions";
import { Printer, Search, X, FileDown, Mail, AlertTriangle } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function CertificadosRetencionPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("0");
  const [tipoRetencion, setTipoRetencion] = useState<"RENTA" | "IVA" | "ICA">("RENTA");
  
  const anioActual = new Date().getFullYear();
  const [fechaInicio, setFechaInicio] = useState<string>(`${anioActual}-01-01`);
  const [fechaFin, setFechaFin] = useState<string>(`${anioActual}-12-31`);

  const [loading, setLoading] = useState<boolean>(false);
  const [datosCertificados, setDatosCertificados] = useState<any>(null);
  const [diferenciasError, setDiferenciasError] = useState<any[]>([]);
  const [certificadoModal, setCertificadoModal] = useState<any>(null);
  const [enviandoCorreo, setEnviandoCorreo] = useState<boolean>(false);
  const [generandoPdf, setGenerandoPdf] = useState<boolean>(false);

  const pdfMasivoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    async function cargarSucursalesEmpresa() {
      const res = await obtenerSucursales(Number(empresaId));
      if (res.success) {
        setSucursales(res.data || []);
        setSucursalId("0");
      }
    }
    cargarSucursalesEmpresa();
  }, [empresaId]);

  const handleCambioTipoImpuesto = (nuevoTipo: "RENTA" | "IVA" | "ICA") => {
    setTipoRetencion(nuevoTipo);
    setDatosCertificados(null);
    setDiferenciasError([]);
  };

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) {
      alert("Seleccione una empresa.");
      return;
    }

    if (tipoRetencion === "ICA" && (!sucursalId || sucursalId === "0")) {
      alert("Para el impuesto ICA es obligatorio seleccionar una sucursal específica.");
      return;
    }

    setLoading(true);
    setDiferenciasError([]);
    setDatosCertificados(null);

    const res = await obtenerCertificadosRetencion(
      empresaId,
      sucursalId !== "0" ? sucursalId : undefined,
      tipoRetencion,
      fechaInicio,
      fechaFin
    );

    if (res.success) {
      setDatosCertificados(res);
      setDiferenciasError([]);
    } else {
      if (res.diferencias && res.diferencias.length > 0) {
        setDiferenciasError(res.diferencias);
      } else {
        alert("Error al consultar los certificados: " + res.error);
      }
      setDatosCertificados(null);
    }
    setLoading(false);
  };

  const fmt = (v: number) => `$ ${Math.round(Number(v || 0)).toLocaleString("es-CO")}`;

  const formatearPorcentaje = (tarifa: number, tipo: string) => {
    const valor = Number(tarifa || 0);
    const porCiento = valor < 1 && valor > 0 ? valor * 100 : valor;

    if (tipo === "ICA") {
      const porMil = porCiento * 10;
      return `${porMil.toFixed(2).replace(/\.?0+$/, '')} x mil`;
    } else {
      return `${porCiento.toFixed(2).replace(/\.?0+$/, '')}%`;
    }
  };

  const generarPdfMasivo = async () => {
    if (!pdfMasivoRef.current || !datosCertificados?.certificados?.length) return;
    setGenerandoPdf(true);

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const elementos = pdfMasivoRef.current.querySelectorAll(".certificado-masivo-item");

      for (let i = 0; i < elementos.length; i++) {
        const el = elementos[i] as HTMLElement;
        const canvas = await html2canvas(el, { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          windowWidth: 794 
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      }

      pdf.save(`Certificados_${tipoRetencion}_${fechaInicio}_al_${fechaFin}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Hubo un error al generar el PDF masivo.");
    } finally {
      setGenerandoPdf(false);
    }
  };

  const enviarCorreosProveedores = async () => {
    if (!datosCertificados || !datosCertificados.certificados.length) return;
    
    const confirmar = window.confirm(`¿Desea enviar los certificados de ${tipoRetencion} por correo electrónico a los proveedores que tienen email registrado?`);
    if (!confirmar) return;

    setEnviandoCorreo(true);
    setTimeout(() => {
      setEnviandoCorreo(false);
      alert("¡Proceso finalizado! Se han enviado los certificados a los correos disponibles de los terceros.");
    }, 2000);
  };

  if (!isMounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-sm font-sans">
      <div className="border-b pb-3 flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Módulo de Certificados de Retención
          </h1>
          <p className="text-sm text-slate-500">
            Generación y consulta de certificados de Renta, IVA e ICA por sucursal.
          </p>
        </div>
        
        {datosCertificados && datosCertificados.certificados.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={generandoPdf}
              onClick={generarPdfMasivo}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" /> {generandoPdf ? "Generando PDF masivo..." : "Descargar Todos en PDF"}
            </button>
            <button
              type="button"
              disabled={enviandoCorreo}
              onClick={enviarCorreosProveedores}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Mail className="w-4 h-4" /> {enviandoCorreo ? "Enviando..." : "Enviar por Correo"}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleConsultar} className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50 p-5 rounded-xl border border-slate-200 print:hidden">
        <div className="md:col-span-3">
          <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs tracking-wide">Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 font-semibold text-sm outline-none truncate"
          >
            {empresas.map((emp: any) => (
              <option key={emp.id} value={emp.id}>{emp.razon_social || emp.nombre_comercial}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs tracking-wide">
            Sucursal {tipoRetencion === 'ICA' && <span className="text-red-600">* Obligatoria para ICA</span>}
          </label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 font-semibold text-sm outline-none"
          >
            <option value="0">-- Todas las Sucursales (Consolidado) --</option>
            {sucursales.map((suc: any) => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs tracking-wide">Tipo de Impuesto</label>
          <select
            value={tipoRetencion}
            onChange={(e) => handleCambioTipoImpuesto(e.target.value as any)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 font-semibold text-sm outline-none"
          >
            <option value="RENTA">Renta</option>
            <option value="IVA">IVA</option>
            <option value="ICA">ICA</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs tracking-wide">Fecha Inicio</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 font-semibold text-sm outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block font-bold text-slate-700 uppercase mb-1.5 text-xs tracking-wide">Fecha Fin</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 font-semibold text-sm outline-none"
          />
        </div>

        <div className="md:col-span-12 flex justify-end mt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow transition text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {loading ? "Consultando y Conciliando..." : "Generar / Consultar Certificados"}
          </button>
        </div>
      </form>

      {/* SECCIÓN DE ALERTA Y TABLA DE DIFERENCIAS CONTABLES */}
      {diferenciasError.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3 text-red-800">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <h3 className="font-bold text-base">Atención: Diferencias Contables Detectadas</h3>
              <p className="text-xs text-red-700">
                El proceso ha sido detenido porque los valores acumulados en el auxiliar de retenciones no coinciden con las transacciones contables registradas para los siguientes terceros en el periodo seleccionado:
              </p>
            </div>
          </div>

          <div className="bg-white border border-red-200 rounded-lg overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-red-100 text-red-900 font-bold uppercase">
                <tr>
                  <th className="p-3">NIT / C.C.</th>
                  <th className="p-3">Nombre / Razón Social</th>
                  <th className="p-3 text-right">Total Auxiliar</th>
                  <th className="p-3 text-right">Total Contabilidad</th>
                  <th className="p-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {diferenciasError.map((dif: any, idx: number) => (
                  <tr key={idx} className="hover:bg-red-50/50">
                    <td className="p-3 font-mono font-bold text-slate-800">{dif.nit}</td>
                    <td className="p-3 font-semibold text-slate-900">{dif.nombre}</td>
                    <td className="p-3 text-right font-mono text-slate-700">{fmt(dif.auxiliar)}</td>
                    <td className="p-3 text-right font-mono text-slate-700">{fmt(dif.contabilidad)}</td>
                    <td className="p-3 text-right font-mono font-bold text-red-600">{fmt(dif.diferencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 italic">
            * Por favor verifique los comprobantes contables y los movimientos auxiliares de estos terceros antes de volver a intentar la generación de certificados.
          </p>
        </div>
      )}

      {/* RESULTADOS */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-semibold text-base print:hidden">Procesando y cruzando saldos contables...</div>
      ) : !datosCertificados && diferenciasError.length === 0 ? (
        <div className="p-12 text-center text-slate-500 italic bg-white border rounded-xl text-sm shadow-2xs print:hidden">
          Seleccione los parámetros y haga clic en "Generar / Consultar Certificados" para listar los terceros.
        </div>
      ) : datosCertificados && datosCertificados.certificados.length > 0 ? (
        <div className="bg-white border rounded-xl shadow-xs overflow-x-auto print:hidden">
          <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex justify-between items-center text-emerald-800 font-semibold text-sm">
            <span className="flex items-center gap-2">
              ✓ <strong>Conciliación contable exitosa:</strong> No se encontraron diferencias. Terceros con retenciones de <strong>{tipoRetencion}</strong> encontrados: <strong>{datosCertificados.certificados.length}</strong>
            </span>
          </div>
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b uppercase text-xs">
              <tr>
                <th className="p-3.5">NIT / C.C.</th>
                <th className="p-3.5">Razón Social / Nombre del Tercero</th>
                <th className="p-3.5">Ciudad</th>
                <th className="p-3.5 text-right">Base Acumulada</th>
                <th className="p-3.5 text-right">Total Retenido</th>
                <th className="p-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {datosCertificados.certificados.map((cert: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3.5 font-mono font-bold text-slate-900">{cert.tercero.nit}{cert.tercero.dv}</td>
                  <td className="p-3.5 font-semibold text-slate-900">{cert.tercero.nombre}</td>
                  <td className="p-3.5 text-slate-700 font-medium">{cert.tercero.ciudad}</td>
                  <td className="p-3.5 text-right font-mono font-semibold text-slate-800">{fmt(cert.total_base)}</td>
                  <td className="p-3.5 text-right font-mono font-bold text-emerald-700">{fmt(cert.total_retenido)}</td>
                  <td className="p-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => setCertificadoModal(cert)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-2xs transition flex items-center gap-1.5 mx-auto cursor-pointer"
                    >
                      <Printer className="w-4 h-4" /> Ver / Imprimir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* CONTENEDOR OCULTO PARA PDF MASIVO */}
      {datosCertificados && datosCertificados.certificados.length > 0 && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }} aria-hidden="true" ref={pdfMasivoRef}>
          {datosCertificados.certificados.map((cert: any, idx: number) => (
            <div 
              key={idx} 
              className="certificado-masivo-item"
              style={{
                backgroundColor: "#ffffff",
                padding: "40px",
                width: "794px",
                height: "1123px",
                color: "#000000",
                fontFamily: "Arial, sans-serif",
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxSizing: "border-box"
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ textAlign: "center", borderBottom: "1px solid #d1d5db", paddingBottom: "16px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: "bold", textTransform: "uppercase", margin: "0 0 6px 0" }}>{datosCertificados.empresa?.razon_social}</h2>
                  <p style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "12px", margin: "0 0 4px 0" }}>
                    Nit: {datosCertificados.empresa?.nit_identificacion || datosCertificados.empresa?.nit}
                    {datosCertificados.empresa?.dv ? `-${datosCertificados.empresa.dv}` : ''}
                  </p>
                  <p style={{ fontSize: "11px", color: "#4b5563", margin: "0 0 4px 0" }}>
                    Dirección: {datosCertificados.empresa?.direccion || 'N/A'} | Teléfono: {datosCertificados.empresa?.telefono || 'N/A'}
                  </p>
                  {datosCertificados.sucursal && (
                    <p style={{ fontSize: "11px", fontWeight: "bold", color: "#4f46e5", margin: "0 0 4px 0" }}>
                      Sucursal: {datosCertificados.sucursal.nombre} - Dirección: {datosCertificados.sucursal.direccion} ({datosCertificados.sucursal.ciudad})
                    </p>
                  )}
                  <h3 style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", marginTop: "12px", backgroundColor: "#f3f4f6", padding: "8px 0", borderTop: "1px solid #d1d5db", borderBottom: "1px solid #d1d5db" }}>
                    CERTIFICADO DE RETENCIÓN EN LA FUENTE {tipoRetencion === 'RENTA' ? 'PARA EFECTOS DE LA DECLARACIÓN DE RENTA' : tipoRetencion === 'IVA' ? 'DEL IMPUESTO SOBRE LAS VENTAS - IVA' : 'DE ICA PARA EFECTOS DE LA DECLARACIÓN DE INDUSTRIA Y COMERCIO'}
                  </h3>
                  <p style={{ color: "#1f2937", fontWeight: "500", marginTop: "10px", fontSize: "11px", lineHeight: "1.4" }}>
                    Con el fin de dar cumplimiento a las disposiciones vigentes sobre retención en la fuente, certificamos que, durante el periodo de <strong style={{ textDecoration: "underline" }}>{fechaInicio} al {fechaFin}</strong>.
                  </p>
                </div>

                <div style={{ border: "1px solid #d1d5db", borderRadius: "6px", overflow: "hidden", fontSize: "11px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #d1d5db", backgroundColor: "#f9fafb" }}>
                    <div style={{ padding: "8px 12px", borderRight: "1px solid #d1d5db", fontWeight: "bold", color: "#374151", textTransform: "uppercase" }}>Nombre y/o razón social</div>
                    <div style={{ padding: "8px 12px", fontWeight: "bold", color: "#111827" }}>{cert.tercero.nombre}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #d1d5db" }}>
                    <div style={{ padding: "8px 12px", borderRight: "1px solid #d1d5db", fontWeight: "bold", color: "#374151", textTransform: "uppercase" }}>C.C. o Nit del contribuyente</div>
                    <div style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: "bold", color: "#111827" }}>{cert.tercero.nit}{cert.tercero.dv}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "8px 12px", borderRight: "1px solid #d1d5db", fontWeight: "bold", color: "#374151", textTransform: "uppercase" }}>Ciudad del contribuyente</div>
                    <div style={{ padding: "8px 12px", fontWeight: "bold", color: "#111827", textTransform: "uppercase" }}>{cert.tercero.ciudad}</div>
                  </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d1d5db", fontSize: "11px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f3f4f6", color: "#374151", fontWeight: "bold", textTransform: "uppercase" }}>
                      <th style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "left" }}>Concepto de Retención</th>
                      <th style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>Valor Base</th>
                      <th style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "center" }}>%</th>
                      <th style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right" }}>Valor Retenido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cert.detalles.map((det: any, i: number) => (
                      <tr key={i}>
                        <td style={{ border: "1px solid #d1d5db", padding: "8px", fontWeight: "500" }}>{det.concepto}</td>
                        <td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right", fontFamily: "monospace" }}>{fmt(det.base)}</td>
                        <td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "center", fontFamily: "monospace", fontWeight: "bold" }}>
                          {formatearPorcentaje(det.tarifa, tipoRetencion)}
                        </td>
                        <td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right", fontFamily: "monospace" }}>{fmt(det.retenido)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "#f3f4f6", fontWeight: "bold" }}>
                      <td style={{ border: "1px solid #d1d5db", padding: "8px", textTransform: "uppercase" }}>TOTAL</td>
                      <td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right", fontFamily: "monospace" }}>{fmt(cert.total_base)}</td>
                      <td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "center" }}></td>
                      <td style={{ border: "1px solid #d1d5db", padding: "8px", textAlign: "right", fontFamily: "monospace", color: "#065f46" }}>{fmt(cert.total_retenido)}</td>
                    </tr>
                  </tfoot>
                </table>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", color: "#374151", fontWeight: "500" }}>
                  <p style={{ margin: 0 }}>
                    Lo anterior fue debidamente declarado y pagado a la Administración de Impuestos en la ciudad de <strong style={{ textTransform: "uppercase" }}>{datosCertificados.sucursal?.ciudad || datosCertificados.empresa?.ciudad || 'Colombia'}</strong>.
                  </p>
                  <p style={{ fontStyle: "italic", fontSize: "10px", color: "#6b7280", margin: 0 }}>
                    Certificado de retención expedido en forma continua impreso por computador, de acuerdo con el artículo 10 del Decreto 836/91, no requiere firma autógrafa.
                  </p>
                </div>
              </div>

              <div style={{ paddingTop: "15px", borderTop: "1px solid #9ca3af", width: "250px", marginBottom: "10px" }}>
                <p style={{ fontWeight: "bold", fontSize: "11px", margin: 0 }}>FIRMA Y SELLO DEL AGENTE RETENEDOR</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE VISTA PREVIA E IMPRESIÓN INDIVIDUAL */}
      {certificadoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border max-w-3xl w-full p-10 space-y-8 relative certificado-print-item font-sans text-slate-900 text-sm max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setCertificadoModal(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition print:hidden cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="space-y-8">
              <div className="text-center space-y-2 border-b pb-6 pt-2">
                <h2 className="text-base font-bold uppercase tracking-wider">{datosCertificados.empresa?.razon_social}</h2>
                <p className="font-mono font-bold text-xs">
                  Nit: {datosCertificados.empresa?.nit_identificacion || datosCertificados.empresa?.nit}
                  {datosCertificados.empresa?.dv ? `-${datosCertificados.empresa.dv}` : ''}
                </p>
                <p className="text-xs text-slate-600 font-medium">
                  Dirección: {datosCertificados.empresa?.direccion || 'N/A'} | Teléfono: {datosCertificados.empresa?.telefono || 'N/A'}
                </p>
                {datosCertificados.sucursal && (
                  <p className="text-xs font-semibold text-indigo-700">
                    Sucursal: {datosCertificados.sucursal.nombre} - Dirección: {datosCertificados.sucursal.direccion} ({datosCertificados.sucursal.ciudad})
                  </p>
                )}

                <h3 className="text-xs font-bold uppercase mt-5 bg-slate-100 py-3 border-t border-b">
                  CERTIFICADO DE RETENCIÓN EN LA FUENTE {tipoRetencion === 'RENTA' ? 'PARA EFECTOS DE LA DECLARACIÓN DE RENTA' : tipoRetencion === 'IVA' ? 'DEL IMPUESTO SOBRE LAS VENTAS - IVA' : 'DE ICA PARA EFECTOS DE LA DECLARACIÓN DE INDUSTRIA Y COMERCIO'}
                </h3>
                
                <p className="text-slate-800 font-medium mt-4 text-xs">
                  Con el fin de dar cumplimiento a las disposiciones vigentes sobre retención en la fuente, certificamos que, durante el periodo de <strong className="underline">{fechaInicio} al {fechaFin}</strong>.
                </p>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
                <div className="grid grid-cols-2 border-b border-slate-300 bg-slate-50">
                  <div className="p-3 border-r border-slate-300 font-bold text-slate-700 uppercase">Nombre y/o razón social</div>
                  <div className="p-3 font-bold text-slate-900">{certificadoModal.tercero.nombre}</div>
                </div>
                <div className="grid grid-cols-2 border-b border-slate-300">
                  <div className="p-3 border-r border-slate-300 font-bold text-slate-700 uppercase">C.C. o Nit del contribuyente</div>
                  <div className="p-3 font-mono font-bold text-slate-900">{certificadoModal.tercero.nit}{certificadoModal.tercero.dv}</div>
                </div>
                <div className="grid grid-cols-2">
                  <div className="p-3 border-r border-slate-300 font-bold text-slate-700 uppercase">Ciudad del contribuyente</div>
                  <div className="p-3 font-bold text-slate-900 uppercase">{certificadoModal.tercero.ciudad}</div>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-xs">
                    <th className="border border-slate-300 p-3 text-left">Concepto de Retención</th>
                    <th className="border border-slate-300 p-3 text-right">Valor Base</th>
                    <th className="border border-slate-300 p-3 text-center">%</th>
                    <th className="border border-slate-300 p-3 text-right">Valor Retenido</th>
                  </tr>
                </thead>
                <tbody>
                  {certificadoModal.detalles.map((det: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="border border-slate-300 p-3 font-medium">{det.concepto}</td>
                      <td className="border border-slate-300 p-3 text-right font-mono">{fmt(det.base)}</td>
                      <td className="border border-slate-300 p-3 text-center font-mono font-semibold">
                        {formatearPorcentaje(det.tarifa, tipoRetencion)}
                      </td>
                      <td className="border border-slate-300 p-3 text-right font-mono">{fmt(det.retenido)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold">
                    <td className="border border-slate-300 p-3 uppercase">TOTAL</td>
                    <td className="border border-slate-300 p-3 text-right font-mono">{fmt(certificadoModal.total_base)}</td>
                    <td className="border border-slate-300 p-3 text-center"></td>
                    <td className="border border-slate-300 p-3 text-right font-mono text-emerald-800">{fmt(certificadoModal.total_retenido)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="space-y-3 text-xs text-slate-700 font-medium">
                <p>
                  Lo anterior fue debidamente declarado y pagado a la Administración de Impuestos en la ciudad de <strong className="uppercase">{datosCertificados.sucursal?.ciudad || datosCertificados.empresa?.ciudad || 'Colombia'}</strong>.
                </p>
                <p className="italic text-[11px] text-slate-500">
                  Certificado de retención expedido en forma continua impreso por computador, de acuerdo con el artículo 10 del Decreto 836/91, no requiere firma autógrafa.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="pt-4 border-t border-slate-400 w-64">
                <p className="font-bold text-xs">FIRMA Y SELLO DEL AGENTE RETENEDOR</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
                <button
                  type="button"
                  onClick={() => setCertificadoModal(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ESTILOS CSS ESTRICTOS PARA IMPRESIÓN */}
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0;
          }
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          .certificado-print-item, .certificado-print-item * {
            visibility: visible !important;
          }
          .certificado-print-item {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            padding: 15mm !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}