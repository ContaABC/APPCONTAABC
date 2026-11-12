"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  procesarFacturasXmlMasivoAdmin,
  DatosXmlItem,
  ResultadoFacturaItem,
} from "@/app/facturas/cargar/actions";
import { supabase } from "@/lib/supabaseClient";

interface XmlUploaderMasivoProps {
  selectedCompanyId?: string;
  selectedBranchId?: string;
  selectedDocumentClassId?: string;
  fechaContabilizacion?: string;
}

interface ConceptoRetencion {
  id: number | string;
  empresa_id: number;
  tipo_retencion: string;
  codigo?: string;
  concepto?: string;
  tarifa: number;
  activo?: boolean;
}

export default function XmlUploaderMasivo({
  selectedCompanyId: propCompanyId,
  selectedBranchId: propBranchId,
  selectedDocumentClassId: propDocumentClassId,
  fechaContabilizacion: propFechaContabilizacion,
}: XmlUploaderMasivoProps) {
  const [archivosXml, setArchivosXml] = useState<File[]>([]);
  const [itemsPrevios, setItemsPrevios] = useState<DatosXmlItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progresoTexto, setProgresoTexto] = useState<string>("");
  const [resumen, setResumen] = useState<{
    total: number;
    exitosos: number;
    fallidos: number;
  } | null>(null);
  const [resultados, setResultados] = useState<ResultadoFacturaItem[]>([]);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  // Sincronización corporativa automática con localStorage / Cookies si no se pasa por props
  const [empresaActivaId, setEmpresaActivaId] = useState<string>(propCompanyId || "");

  useEffect(() => {
    if (propCompanyId) {
      setEmpresaActivaId(propCompanyId);
    } else {
      const cookieEmpresa = document.cookie
        .split("; ")
        .find((row) => row.startsWith("empresa_activa="));
      const empresaCookie = cookieEmpresa ? cookieEmpresa.split("=")[1] : null;
      const empresaLocal = localStorage.getItem("empresa_activa");
      
      if (empresaCookie || empresaLocal) {
        setEmpresaActivaId(empresaCookie || empresaLocal || "");
      }
    }
  }, [propCompanyId]);

  const selectedCompanyId = propCompanyId || empresaActivaId;
  const selectedBranchId = propBranchId || "";
  const selectedDocumentClassId = propDocumentClassId || "";
  const fechaContabilizacion = propFechaContabilizacion || new Date().toISOString().split("T")[0];

  // Conceptos de retención para la empresa activa
  const [conceptosRetencion, setConceptosRetencion] = useState<ConceptoRetencion[]>([]);

  // Cargar conceptos de retención consumiendo la API interna /api/conceptos-retencion
  useEffect(() => {
    if (!selectedCompanyId) {
      setConceptosRetencion([]);
      return;
    }

    const cargarConceptos = async () => {
      try {
        const response = await fetch(`/api/conceptos-retencion?empresa_id=${selectedCompanyId}`);
        const result = await response.json();

        if (result.exito && result.conceptos) {
          setConceptosRetencion(result.conceptos);
        } else {
          setConceptosRetencion([]);
          console.error("Error al cargar conceptos de retención masivos:", result.mensaje);
        }
      } catch (err) {
        console.error("Error al cargar conceptos de retención:", err);
        setConceptosRetencion([]);
      }
    };

    cargarConceptos();
  }, [selectedCompanyId]);

  // Listas de retenciones filtradas por tipo exacto y activo
  const conceptosRenta = useMemo(() => {
    return conceptosRetencion.filter(
      (c) => c.tipo_retencion === "RENTA" && c.activo !== false
    );
  }, [conceptosRetencion]);

  const conceptosIva = useMemo(() => {
    return conceptosRetencion.filter(
      (c) => c.tipo_retencion === "IVA" && c.activo !== false
    );
  }, [conceptosRetencion]);

  const conceptosIca = useMemo(() => {
    return conceptosRetencion.filter(
      (c) => c.tipo_retencion === "ICA" && c.activo !== false
    );
  }, [conceptosRetencion]);

  const parseMontoSafe = (valStr?: string | null): number => {
    if (!valStr) return 0;
    const cleanStr = valStr.trim().replace(/\s/g, "").replace(/,/g, ".");
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  const getDeepText = (root: Element | Document, localName: string): string => {
    const allElements = root.getElementsByTagName("*");
    for (let i = 0; i < allElements.length; i++) {
      if (allElements[i].localName === localName) {
        const text = allElements[i].textContent?.trim();
        if (text) return text;
      }
    }
    return "";
  };

  const getDeepTextFirst = (
    root: Element | Document,
    localNames: string[]
  ): string => {
    for (const name of localNames) {
      const val = getDeepText(root, name);
      if (val) return val;
    }
    return "";
  };

  const normalizarNit = (nit?: string): string => {
    if (!nit) return "";
    return nit.replace(/[\.\-\s]/g, "").trim();
  };

  // Extractor principal DIAN
  const parseXmlFile = (file: File): Promise<DatosXmlItem> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          let content = event.target?.result as string;
          const parser = new DOMParser();
          let xmlDoc = parser.parseFromString(content, "application/xml");

          const rootLocalName = xmlDoc.documentElement.localName;
          if (rootLocalName === "AttachedDocument") {
            const innerXmlText = getDeepText(xmlDoc, "Description");
            if (innerXmlText && innerXmlText.includes("<")) {
              xmlDoc = parser.parseFromString(innerXmlText, "application/xml");
            }
          }

          const numeroFactura =
            getDeepTextFirst(xmlDoc, ["ID"]) || file.name.replace(/\.xml$/i, "");
          const cufe = getDeepTextFirst(xmlDoc, ["UUID"]);
          const fechaEmision =
            getDeepTextFirst(xmlDoc, ["IssueDate"]) ||
            new Date().toISOString().split("T")[0];
          const fechaVencimiento =
            getDeepTextFirst(xmlDoc, ["DueDate"]) || fechaEmision;

          let subtotalVal = 0;
          let totalVal = 0;
          let ivaVal = 0;

          const allNodes = xmlDoc.getElementsByTagName("*");

          for (let i = 0; i < allNodes.length; i++) {
            const node = allNodes[i];
            if (
              node.localName === "LegalMonetaryTotal" ||
              node.localName === "RequestedMonetaryTotal"
            ) {
              subtotalVal = parseMontoSafe(
                getDeepTextFirst(node, [
                  "LineExtensionAmount",
                  "TaxExclusiveAmount",
                ])
              );
              totalVal = parseMontoSafe(
                getDeepTextFirst(node, [
                  "PayableAmount",
                  "TaxInclusiveAmount",
                ])
              );
            }
            if (node.localName === "TaxTotal") {
              const taxAmount = parseMontoSafe(getDeepText(node, "TaxAmount"));
              if (taxAmount > 0) ivaVal = taxAmount;
            }
          }

          if (totalVal === 0) {
            totalVal = parseMontoSafe(
              getDeepTextFirst(xmlDoc, [
                "PayableAmount",
                "TaxInclusiveAmount",
                "LineExtensionAmount",
              ])
            );
          }
          if (subtotalVal === 0) {
            subtotalVal = parseMontoSafe(
              getDeepTextFirst(xmlDoc, [
                "LineExtensionAmount",
                "TaxExclusiveAmount",
              ])
            );
          }
          if (ivaVal === 0) {
            ivaVal = parseMontoSafe(getDeepText(xmlDoc, "TaxAmount"));
          }

          let emisorNit = "";
          let emisorNombre = "";

          for (let i = 0; i < allNodes.length; i++) {
            if (allNodes[i].localName === "AccountingSupplierParty") {
              const supplierNode = allNodes[i];
              emisorNit = getDeepTextFirst(supplierNode, ["CompanyID", "ID"]);
              emisorNombre = getDeepTextFirst(supplierNode, [
                "RegistrationName",
                "Name",
              ]);
              break;
            }
          }

          if (!emisorNit) emisorNit = getDeepTextFirst(xmlDoc, ["CompanyID"]);
          if (!emisorNombre)
            emisorNombre = getDeepTextFirst(xmlDoc, ["RegistrationName"]);

          let receptorNit = "";
          let receptorNombre = "";

          for (let i = 0; i < allNodes.length; i++) {
            if (allNodes[i].localName === "AccountingCustomerParty") {
              const customerNode = allNodes[i];
              receptorNit = getDeepTextFirst(customerNode, ["CompanyID", "ID"]);
              receptorNombre = getDeepTextFirst(customerNode, [
                "RegistrationName",
                "Name",
              ]);
              break;
            }
          }

          resolve({
            numero_factura: numeroFactura,
            cufe: cufe,
            fecha_emision: fechaEmision,
            fecha_vencimiento: fechaVencimiento,
            subtotal: subtotalVal,
            iva: ivaVal,
            total: totalVal,
            emisor_nit: emisorNit,
            emisor_nombre: emisorNombre,
            receptor_nit: receptorNit,
            receptor_nombre: receptorNombre,
            contenidoXml: content,
          });
        } catch (err: any) {
          reject(
            new Error(`Error al leer archivo ${file.name}: ${err.message}`)
          );
        }
      };
      reader.onerror = () =>
        reject(new Error(`Error de lectura en ${file.name}`));
      reader.readAsText(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).filter((file) =>
        file.name.toLowerCase().endsWith(".xml")
      );
      setArchivosXml(filesArray);
      setResumen(null);
      setResultados([]);
      setErrorGlobal(null);

      if (filesArray.length > 0) {
        setLoading(true);
        setProgresoTexto("Procesando estructura y buscando retenciones por proveedor...");
        try {
          let tercerosMap: Record<
            string,
            {
              retencion_renta_id?: string | number;
              retencion_iva_id?: string | number;
              retencion_ica_id?: string | number;
            }
          > = {};

          if (selectedCompanyId) {
            const empresaIdNum = Number(selectedCompanyId);
            const { data: terceros } = await supabase
              .from("terceros")
              .select("numero_identificacion, retencion_renta_id, retencion_iva_id, retencion_ica_id")
              .eq("empresa_id", empresaIdNum);

            if (terceros) {
              terceros.forEach((t) => {
                const nitNorm = normalizarNit(t.numero_identificacion);
                if (nitNorm) {
                  tercerosMap[nitNorm] = {
                    retencion_renta_id: t.retencion_renta_id || "",
                    retencion_iva_id: t.retencion_iva_id || "",
                    retencion_ica_id: t.retencion_ica_id || "",
                  };
                }
              });
            }
          }

          const parsedList: DatosXmlItem[] = [];
          for (const file of filesArray) {
            const parsed = await parseXmlFile(file);
            const nitEmisorNorm = normalizarNit(parsed.emisor_nit);
            const retTercero = tercerosMap[nitEmisorNorm] || {};

            parsedList.push({
              ...parsed,
              retencion_renta_id: retTercero.retencion_renta_id || "",
              retencion_iva_id: retTercero.retencion_iva_id || "",
              retencion_ica_id: retTercero.retencion_ica_id || "",
            });
          }
          setItemsPrevios(parsedList);
        } catch (err: any) {
          setErrorGlobal(`Error en vista previa: ${err.message}`);
        } finally {
          setLoading(false);
          setProgresoTexto("");
        }
      } else {
        setItemsPrevios([]);
      }
    }
  };

  const handleRetencionChangeInRow = (
    index: number,
    campo: "retencion_renta_id" | "retencion_iva_id" | "retencion_ica_id",
    valor: string
  ) => {
    setItemsPrevios((prev) => {
      const actualizados = [...prev];
      actualizados[index] = {
        ...actualizados[index],
        [campo]: valor,
      };
      return actualizados;
    });
  };

  const handleProcesarMasivo = async () => {
    if (!selectedCompanyId || !selectedBranchId || !selectedDocumentClassId) {
      setErrorGlobal(
        "Por favor complete los parámetros de Empresa, Sucursal y Clase."
      );
      return;
    }

    if (itemsPrevios.length === 0) {
      setErrorGlobal("Debe seleccionar al menos una factura XML válida.");
      return;
    }

    setLoading(true);
    setErrorGlobal(null);
    setResumen(null);
    setResultados([]);
    setProgresoTexto(`Contabilizando ${itemsPrevios.length} factura(s)...`);

    try {
      const respuesta = await procesarFacturasXmlMasivoAdmin(
        itemsPrevios,
        selectedCompanyId,
        selectedBranchId,
        selectedDocumentClassId,
        fechaContabilizacion
      );

      if (respuesta.resumen) {
        setResumen(respuesta.resumen);
      }

      if (respuesta.detalle && respuesta.detalle.length > 0) {
        setResultados(respuesta.detalle);
      }

      if (!respuesta.success) {
        setErrorGlobal(
          respuesta.error || "Se presentaron fallas al procesar las facturas."
        );
      }
    } catch (err: any) {
      console.error("Error al procesar lote:", err);
      setErrorGlobal(
        `Error durante la ejecución: ${err.message || String(err)}`
      );
    } finally {
      setLoading(false);
      setProgresoTexto("");
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-4 text-xs">
      <div>
        <h2 className="text-sm font-bold text-gray-800">
          Carga Masiva de Facturas XML con Retenciones Automáticas
        </h2>
        <p className="text-[11px] text-gray-500">
          Procesamiento automático de lotes para DIAN (UBL 2.1 / AttachedDocument) aplicando retenciones por proveedor.
        </p>
      </div>

      {!selectedCompanyId && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded font-medium">
          ⚠ Seleccione una empresa activa en la barra superior para habilitar la carga masiva y vinculación de retenciones.
        </div>
      )}

      {errorGlobal && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded font-medium space-y-1">
          <div className="font-bold">⚠ Advertencia / Error:</div>
          <div className="text-[11px] font-mono break-all">{errorGlobal}</div>
        </div>
      )}

      {/* Input de Archivos */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
        <input
          type="file"
          accept=".xml"
          multiple
          onChange={handleFileChange}
          disabled={loading || !selectedCompanyId}
          className="hidden"
          id="masivo-xml-input"
        />
        <label
          htmlFor="masivo-xml-input"
          className={`cursor-pointer flex flex-col items-center justify-center space-y-1 ${!selectedCompanyId ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="text-xl">📁</span>
          <span className="font-semibold text-blue-600 hover:underline">
            Haz clic aquí para seleccionar los archivos XML
          </span>
          <span className="text-[10px] text-gray-400">
            Formatos .xml o AttachedDocument de la DIAN
          </span>
        </label>
      </div>

      {/* Carga e indicador */}
      {loading && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-center font-medium animate-pulse">
          ⏳ {progresoTexto}
        </div>
      )}

      {/* Tabla Previa */}
      {itemsPrevios.length > 0 && !resumen && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700">
              Vista previa ({itemsPrevios.length} facturas):
            </h3>
            <button
              onClick={handleProcesarMasivo}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-4 rounded disabled:bg-blue-300 transition-colors cursor-pointer"
            >
              {loading ? "Procesando..." : "Procesar y Contabilizar Lote"}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="p-1.5 font-bold text-gray-600">N° Factura</th>
                  <th className="p-1.5 font-bold text-gray-600">Emisor / NIT</th>
                  <th className="p-1.5 font-bold text-gray-600 text-right">Total</th>
                  <th className="p-1.5 font-bold text-blue-900 w-36">Ret. Renta</th>
                  <th className="p-1.5 font-bold text-blue-900 w-36">Ret. IVA</th>
                  <th className="p-1.5 font-bold text-blue-900 w-36">Ret. ICA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itemsPrevios.map((item, idx) => {
                  const totalNum = item.total || 0;
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-1.5 font-mono font-medium text-gray-800 whitespace-nowrap">
                        {item.numero_factura || (
                          <span className="text-red-500">Sin ID</span>
                        )}
                        <div className="text-[9px] text-gray-400">{item.fecha_emision || ""}</div>
                      </td>
                      <td className="p-1.5">
                        <div className="font-semibold text-gray-800 truncate max-w-[150px]" title={item.emisor_nombre}>
                          {item.emisor_nombre || "Sin Nombre"}
                        </div>
                        <div className="font-mono text-[10px] text-gray-500">
                          {item.emisor_nit || "Sin NIT"}
                        </div>
                      </td>
                      <td className="p-1.5 text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                        ${totalNum > 0 ? totalNum.toLocaleString("es-CO") : "0"}
                      </td>

                      {/* SELECTOR RENTA */}
                      <td className="p-1">
                        <select
                          value={String(item.retencion_renta_id || "")}
                          onChange={(e) =>
                            handleRetencionChangeInRow(idx, "retencion_renta_id", e.target.value)
                          }
                          className="w-full border border-blue-200 rounded text-[10px] bg-white h-6 px-1 truncate"
                        >
                          <option value="">-- Sin Ret --</option>
                          {conceptosRenta.map((c) => {
                            const tarifaPorcentaje = (Number(c.tarifa || 0) * 100).toFixed(2);
                            const textoConcepto = c.concepto || "";
                            const conceptoCorto =
                              textoConcepto.length > 45
                                ? `${textoConcepto.substring(0, 45)}...`
                                : textoConcepto;
                            return (
                              <option
                                key={c.id}
                                value={c.id}
                                title={`${textoConcepto} (${tarifaPorcentaje}%)`}
                              >
                                {`${c.codigo ? c.codigo + " - " : ""}${conceptoCorto} (${tarifaPorcentaje}%)`}
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      {/* SELECTOR IVA */}
                      <td className="p-1">
                        <select
                          value={String(item.retencion_iva_id || "")}
                          onChange={(e) =>
                            handleRetencionChangeInRow(idx, "retencion_iva_id", e.target.value)
                          }
                          className="w-full border border-blue-200 rounded text-[10px] bg-white h-6 px-1 truncate"
                        >
                          <option value="">-- Sin Ret --</option>
                          {conceptosIva.map((c) => {
                            const tarifaPorcentaje = (Number(c.tarifa || 0) * 100).toFixed(2);
                            const textoConcepto = c.concepto || "";
                            const conceptoCorto =
                              textoConcepto.length > 45
                                ? `${textoConcepto.substring(0, 45)}...`
                                : textoConcepto;
                            return (
                              <option
                                key={c.id}
                                value={c.id}
                                title={`${textoConcepto} (${tarifaPorcentaje}%)`}
                              >
                                {`${c.codigo ? c.codigo + " - " : ""}${conceptoCorto} (${tarifaPorcentaje}%)`}
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      {/* SELECTOR ICA */}
                      <td className="p-1">
                        <select
                          value={String(item.retencion_ica_id || "")}
                          onChange={(e) =>
                            handleRetencionChangeInRow(idx, "retencion_ica_id", e.target.value)
                          }
                          className="w-full border border-blue-200 rounded text-[10px] bg-white h-6 px-1 truncate"
                        >
                          <option value="">-- Sin Ret --</option>
                          {conceptosIca.map((c) => {
                            const tarifaPorMil = (Number(c.tarifa || 0) * 1000).toFixed(2);
                            const textoConcepto = c.concepto || "";
                            const conceptoCorto =
                              textoConcepto.length > 45
                                ? `${textoConcepto.substring(0, 45)}...`
                                : textoConcepto;
                            return (
                              <option
                                key={c.id}
                                value={c.id}
                                title={`${textoConcepto} (${tarifaPorMil}‰)`}
                              >
                                {`${c.codigo ? c.codigo + " - " : ""}${conceptoCorto} (${tarifaPorMil}‰)`}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen Final */}
      {resumen && (
        <div className="grid grid-cols-3 gap-2 text-center p-3 bg-gray-50 rounded border border-gray-200">
          <div className="p-1.5 bg-white rounded border border-gray-200">
            <span className="block text-[10px] text-gray-500 uppercase">
              Total
            </span>
            <span className="text-sm font-bold text-gray-800">
              {resumen.total}
            </span>
          </div>
          <div className="p-1.5 bg-green-50 rounded border border-green-200">
            <span className="block text-[10px] text-green-700 uppercase">
              Exitosas
            </span>
            <span className="text-sm font-bold text-green-800">
              {resumen.exitosos}
            </span>
          </div>
          <div className="p-1.5 bg-red-50 rounded border border-red-200">
            <span className="block text-[10px] text-red-700 uppercase">
              Fallidas
            </span>
            <span className="text-sm font-bold text-red-800">
              {resumen.fallidos}
            </span>
          </div>
        </div>
      )}

      {/* Detalle Post Procesamiento */}
      {resultados.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="font-bold text-gray-700">
            Resultado detallado por factura:
          </h3>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="p-1.5 font-bold text-gray-600">N° Factura</th>
                  <th className="p-1.5 font-bold text-gray-600">Estado</th>
                  <th className="p-1.5 font-bold text-gray-600">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resultados.map((item, idx) => (
                  <tr
                    key={idx}
                    className={item.exito ? "bg-green-50/30" : "bg-red-50/30"}
                  >
                    <td className="p-1.5 font-mono font-medium text-gray-800">
                      {item.numeroFactura}
                    </td>
                    <td className="p-1.5 whitespace-nowrap">
                      {item.exito ? (
                        <span className="text-green-700 font-bold">✔ Éxito</span>
                      ) : (
                        <span className="text-red-700 font-bold">❌ Error</span>
                      )}
                    </td>
                    <td className="p-1.5 text-gray-600 font-mono text-[10px] break-all">
                      {item.exito
                        ? `Factura creada (ID #${item.facturaId})`
                        : item.error || "Error al procesar."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}