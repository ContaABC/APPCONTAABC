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
  empresa_id: number | string;
  anio?: number | string;
  tipo_retencion: string;
  codigo?: string;
  concepto?: string;
  tarifa: number | string;
  activo?: boolean;
}

interface ItemPrevioExtendido extends DatosXmlItem {
  sinParametrizacion?: boolean;
  motivoBloqueo?: string;
}

function extraerAnioFecha(fechaStr?: string): number {
  if (fechaStr) {
    const match = /^(\d{4})/.exec(fechaStr.trim());
    if (match) {
      const anioNum = Number(match[1]);
      if (!Number.isNaN(anioNum) && anioNum > 1900) return anioNum;
    }
    const d = new Date(fechaStr);
    if (!Number.isNaN(d.getTime())) return d.getUTCFullYear();
  }
  return new Date().getFullYear();
}

function deduplicarConceptos(
  lista: ConceptoRetencion[],
  empresaIdNum: number,
  anioNum: number
): ConceptoRetencion[] {
  const porId = new Map<string, ConceptoRetencion>();

  for (const item of lista) {
    if (Number(item.empresa_id) !== empresaIdNum) continue;
    if (item.activo === false) continue;
    if (
      item.anio !== undefined &&
      item.anio !== null &&
      Number(item.anio) !== anioNum
    ) {
      continue;
    }

    const idKey = String(item.id);
    if (!porId.has(idKey)) {
      porId.set(idKey, item);
    }
  }

  const vistosEtiqueta = new Set<string>();
  const resultado: ConceptoRetencion[] = [];

  for (const item of porId.values()) {
    const tipoNorm = String(item.tipo_retencion || "").trim().toUpperCase();
    const texto = String(item.concepto || "").trim();
    const tarifaNum = Number(item.tarifa || 0);
    const etiquetaKey = `${anioNum}::${tipoNorm}::${texto.toLowerCase()}::${tarifaNum}`;

    if (!vistosEtiqueta.has(etiquetaKey)) {
      vistosEtiqueta.add(etiquetaKey);
      resultado.push(item);
    }
  }

  return resultado;
}

export default function XmlUploaderMasivo({
  selectedCompanyId: propCompanyId,
  selectedBranchId: propBranchId,
  selectedDocumentClassId: propDocumentClassId,
  fechaContabilizacion: propFechaContabilizacion,
}: XmlUploaderMasivoProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [archivosXml, setArchivosXml] = useState<File[]>([]);
  const [itemsPrevios, setItemsPrevios] = useState<ItemPrevioExtendido[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progresoTexto, setProgresoTexto] = useState<string>("");
  const [resumen, setResumen] = useState<{
    total: number;
    exitosos: number;
    fallidos: number;
  } | null>(null);
  const [resultados, setResultados] = useState<ResultadoFacturaItem[]>([]);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  const [empresaLocalId, setEmpresaLocalId] = useState<string>(propCompanyId || "");

  useEffect(() => {
    setIsMounted(true);
    if (propCompanyId) {
      setEmpresaLocalId(propCompanyId);
      return;
    }
    if (typeof window !== "undefined") {
      const cookieEmpresa = document.cookie
        .split("; ")
        .find((row) => row.startsWith("empresa_activa="));
      const empresaCookie = cookieEmpresa
        ? decodeURIComponent(cookieEmpresa.split("=")[1])
        : "";
      const empresaStorage = localStorage.getItem("empresa_activa") || "";
      setEmpresaLocalId(empresaStorage || empresaCookie || "");
    }
  }, [propCompanyId]);

  const activeCompanyId = propCompanyId || empresaLocalId;
  const selectedBranchId = propBranchId || "";
  const selectedDocumentClassId = propDocumentClassId || "";
  const fechaContabilizacion =
    propFechaContabilizacion || new Date().toISOString().split("T")[0];
  const anioContabilidad = useMemo(
    () => extraerAnioFecha(fechaContabilizacion),
    [fechaContabilizacion]
  );

  const [conceptosRetencion, setConceptosRetencion] = useState<ConceptoRetencion[]>([]);

  useEffect(() => {
    if (!isMounted) return;

    setConceptosRetencion([]);

    const empNum = Number(activeCompanyId);
    if (!activeCompanyId || Number.isNaN(empNum) || empNum <= 0) {
      return;
    }

    let cancelado = false;

    const cargarConceptos = async () => {
      try {
        const response = await fetch(
          `/api/conceptos-retencion?empresa_id=${empNum}&anio=${anioContabilidad}&_t=${Date.now()}`,
          { cache: "no-store" }
        );
        const result = await response.json();

        if (cancelado) return;

        const listaRaw: ConceptoRetencion[] =
          result?.exito && Array.isArray(result?.conceptos)
            ? result.conceptos
            : Array.isArray(result?.data)
            ? result.data
            : [];

        setConceptosRetencion(
          deduplicarConceptos(listaRaw, empNum, anioContabilidad)
        );
      } catch (err) {
        if (!cancelado) {
          console.error("Error al cargar conceptos de retención:", err);
          setConceptosRetencion([]);
        }
      }
    };

    cargarConceptos();

    return () => {
      cancelado = true;
    };
  }, [isMounted, activeCompanyId, anioContabilidad]);

  const conceptosRenta = useMemo(() => {
    const empNum = Number(activeCompanyId);
    return conceptosRetencion.filter(
      (c) =>
        Number(c.empresa_id) === empNum &&
        (c.anio === undefined || c.anio === null || Number(c.anio) === anioContabilidad) &&
        String(c.tipo_retencion || "").trim().toUpperCase() === "RENTA" &&
        c.activo !== false
    );
  }, [conceptosRetencion, activeCompanyId, anioContabilidad]);

  const conceptosIva = useMemo(() => {
    const empNum = Number(activeCompanyId);
    return conceptosRetencion.filter(
      (c) =>
        Number(c.empresa_id) === empNum &&
        (c.anio === undefined || c.anio === null || Number(c.anio) === anioContabilidad) &&
        String(c.tipo_retencion || "").trim().toUpperCase() === "IVA" &&
        c.activo !== false
    );
  }, [conceptosRetencion, activeCompanyId, anioContabilidad]);

  const conceptosIca = useMemo(() => {
    const empNum = Number(activeCompanyId);
    return conceptosRetencion.filter(
      (c) =>
        Number(c.empresa_id) === empNum &&
        (c.anio === undefined || c.anio === null || Number(c.anio) === anioContabilidad) &&
        String(c.tipo_retencion || "").trim().toUpperCase() === "ICA" &&
        c.activo !== false
    );
  }, [conceptosRetencion, activeCompanyId, anioContabilidad]);

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

  const parseXmlFile = (file: File): Promise<DatosXmlItem> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
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
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          reject(new Error(`Error al leer archivo ${file.name}: ${msg}`));
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
        setProgresoTexto(
          "Procesando estructura y verificando retenciones por proveedor..."
        );
        try {
          let tercerosMap: Record<
            string,
            {
              existe: boolean;
              retencion_renta_id?: string | number | null;
              retencion_iva_id?: string | number | null;
              retencion_ica_id?: string | number | null;
            }
          > = {};

          if (activeCompanyId) {
            const empresaIdNum = Number(activeCompanyId);
            const { data: terceros } = await supabase
              .from("terceros")
              .select(
                "numero_identificacion, retencion_renta_id, retencion_iva_id, retencion_ica_id"
              )
              .eq("empresa_id", empresaIdNum);

            if (terceros) {
              terceros.forEach((t) => {
                const nitNorm = normalizarNit(t.numero_identificacion);
                if (nitNorm) {
                  tercerosMap[nitNorm] = {
                    existe: true,
                    retencion_renta_id: t.retencion_renta_id ?? null,
                    retencion_iva_id: t.retencion_iva_id ?? null,
                    retencion_ica_id: t.retencion_ica_id ?? null,
                  };
                }
              });
            }
          }

          const parsedList: ItemPrevioExtendido[] = [];
          for (const file of filesArray) {
            const parsed = await parseXmlFile(file);
            const nitEmisorNorm = normalizarNit(parsed.emisor_nit);
            const retTercero = tercerosMap[nitEmisorNorm];

            const tieneRetencion =
              retTercero?.existe &&
              (Boolean(retTercero.retencion_renta_id) ||
                Boolean(retTercero.retencion_iva_id) ||
                Boolean(retTercero.retencion_ica_id));

            parsedList.push({
              ...parsed,
              retencion_renta_id: retTercero?.retencion_renta_id
                ? String(retTercero.retencion_renta_id)
                : "",
              retencion_iva_id: retTercero?.retencion_iva_id
                ? String(retTercero.retencion_iva_id)
                : "",
              retencion_ica_id: retTercero?.retencion_ica_id
                ? String(retTercero.retencion_ica_id)
                : "",
              sinParametrizacion: !tieneRetencion,
              motivoBloqueo: !retTercero?.existe
                ? `Proveedor NIT ${parsed.emisor_nit || "N/A"} no registrado.`
                : !tieneRetencion
                ? "Sin retenciones parametrizadas en terceros. Cargue bloqueado."
                : undefined,
            });
          }
          setItemsPrevios(parsedList);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorGlobal(`Error en vista previa: ${msg}`);
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

  const itemsHabilitados = useMemo(
    () => itemsPrevios.filter((it) => !it.sinParametrizacion),
    [itemsPrevios]
  );

  const itemsBloqueados = useMemo(
    () => itemsPrevios.filter((it) => it.sinParametrizacion),
    [itemsPrevios]
  );

  const handleProcesarMasivo = async () => {
    if (!activeCompanyId || !selectedBranchId || !selectedDocumentClassId) {
      setErrorGlobal(
        "Por favor complete los parámetros de Empresa, Sucursal y Clase."
      );
      return;
    }

    if (itemsHabilitados.length === 0) {
      setErrorGlobal(
        "No hay facturas habilitadas para procesar. Verifica que los proveedores tengan retenciones parametrizadas en terceros."
      );
      return;
    }

    setLoading(true);
    setErrorGlobal(null);
    setResumen(null);
    setResultados([]);
    setProgresoTexto(
      `Contabilizando ${itemsHabilitados.length} factura(s) habilitada(s)...`
    );

    try {
      const respuesta = await procesarFacturasXmlMasivoAdmin(
        itemsHabilitados,
        activeCompanyId,
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
    } catch (err: unknown) {
      console.error("Error al procesar lote:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorGlobal(`Error durante la ejecución: ${msg}`);
    } finally {
      setLoading(false);
      setProgresoTexto("");
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-4 text-xs">
      <div>
        <h2 className="text-sm font-bold text-gray-800">
          Carga Masiva de Facturas XML con Retenciones Automáticas ({anioContabilidad})
        </h2>
        <p className="text-[11px] text-gray-500">
          Procesamiento automático de lotes para DIAN (UBL 2.1 / AttachedDocument) mostrando Subtotal, IVA y Total y aplicando retenciones por proveedor para el año {anioContabilidad}.
        </p>
      </div>

      {!activeCompanyId && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded font-medium">
          ⚠ Seleccione una empresa activa en la barra superior para habilitar la carga masiva y vinculación de retenciones.
        </div>
      )}

      {itemsBloqueados.length > 0 && !resumen && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded font-medium text-[11px]">
          🛑 <strong>{itemsBloqueados.length}</strong> factura(s) tienen proveedores sin retenciones parametrizadas en <strong>terceros</strong> y están bloqueadas para el cargue.
        </div>
      )}

      {errorGlobal && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded font-medium space-y-1">
          <div className="font-bold">⚠ Advertencia / Error:</div>
          <div className="text-[11px] font-mono break-all">{errorGlobal}</div>
        </div>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
        <input
          type="file"
          accept=".xml"
          multiple
          onChange={handleFileChange}
          disabled={loading || !activeCompanyId}
          className="hidden"
          id="masivo-xml-input"
        />
        <label
          htmlFor="masivo-xml-input"
          className={`cursor-pointer flex flex-col items-center justify-center space-y-1 ${
            !activeCompanyId ? "opacity-50 cursor-not-allowed" : ""
          }`}
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

      {loading && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-center font-medium animate-pulse">
          ⏳ {progresoTexto}
        </div>
      )}

      {itemsPrevios.length > 0 && !resumen && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700">
              Vista previa ({itemsPrevios.length} facturas — {itemsHabilitados.length} habilitadas):
            </h3>
            <button
              type="button"
              onClick={handleProcesarMasivo}
              disabled={loading || itemsHabilitados.length === 0}
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
                  <th className="p-1.5 font-bold text-gray-600 text-right">Subtotal</th>
                  <th className="p-1.5 font-bold text-gray-600 text-right">IVA</th>
                  <th className="p-1.5 font-bold text-gray-600 text-right">Total</th>
                  <th className="p-1.5 font-bold text-blue-900 w-36">Ret. Renta</th>
                  <th className="p-1.5 font-bold text-blue-900 w-36">Ret. IVA</th>
                  <th className="p-1.5 font-bold text-blue-900 w-36">Ret. ICA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itemsPrevios.map((item, idx) => {
                  const subtotalNum = item.subtotal || 0;
                  const ivaNum = item.iva || 0;
                  const totalNum = item.total || 0;
                  const bloqueada = Boolean(item.sinParametrizacion);

                  return (
                    <tr
                      key={idx}
                      className={bloqueada ? "bg-rose-50/50" : "hover:bg-gray-50"}
                    >
                      <td className="p-1.5 font-mono font-medium text-gray-800 whitespace-nowrap">
                        {item.numero_factura || (
                          <span className="text-red-500">Sin ID</span>
                        )}
                        <div className="text-[9px] text-gray-400">
                          {item.fecha_emision || ""}
                        </div>
                        {bloqueada && (
                          <div className="text-[9px] font-sans font-semibold text-rose-600 mt-0.5">
                            {item.motivoBloqueo}
                          </div>
                        )}
                      </td>
                      <td className="p-1.5">
                        <div
                          className="font-semibold text-gray-800 truncate max-w-[150px]"
                          title={item.emisor_nombre}
                        >
                          {item.emisor_nombre || "Sin Nombre"}
                        </div>
                        <div className="font-mono text-[10px] text-gray-500">
                          {item.emisor_nit || "Sin NIT"}
                        </div>
                      </td>
                      <td className="p-1.5 text-right font-mono text-gray-700 whitespace-nowrap">
                        ${subtotalNum > 0 ? subtotalNum.toLocaleString("es-CO") : "0"}
                      </td>
                      <td className="p-1.5 text-right font-mono text-gray-700 whitespace-nowrap">
                        ${ivaNum > 0 ? ivaNum.toLocaleString("es-CO") : "0"}
                      </td>
                      <td className="p-1.5 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                        ${totalNum > 0 ? totalNum.toLocaleString("es-CO") : "0"}
                      </td>

                      {/* SELECTOR RENTA */}
                      <td className="p-1">
                        <select
                          disabled={bloqueada || conceptosRenta.length === 0}
                          value={String(item.retencion_renta_id || "")}
                          onChange={(e) =>
                            handleRetencionChangeInRow(
                              idx,
                              "retencion_renta_id",
                              e.target.value
                            )
                          }
                          className="w-full border border-blue-200 rounded text-[10px] bg-white h-6 px-1 truncate disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="">-- Sin Ret --</option>
                          {conceptosRenta.map((c) => {
                            const tarifaPorcentaje = (
                              Number(c.tarifa || 0) * 100
                            ).toFixed(2);
                            const textoConcepto = c.concepto || "";
                            const conceptoCorto =
                              textoConcepto.length > 45
                                ? `${textoConcepto.substring(0, 45)}...`
                                : textoConcepto;
                            return (
                              <option
                                key={`${activeCompanyId}_${anioContabilidad}_renta_${idx}_${c.id}`}
                                value={String(c.id)}
                                title={`${textoConcepto} (${tarifaPorcentaje}%)`}
                              >
                                {`${
                                  c.codigo ? c.codigo + " - " : ""
                                }${conceptoCorto} (${tarifaPorcentaje}%)`}
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      {/* SELECTOR IVA */}
                      <td className="p-1">
                        <select
                          disabled={bloqueada || conceptosIva.length === 0}
                          value={String(item.retencion_iva_id || "")}
                          onChange={(e) =>
                            handleRetencionChangeInRow(
                              idx,
                              "retencion_iva_id",
                              e.target.value
                            )
                          }
                          className="w-full border border-blue-200 rounded text-[10px] bg-white h-6 px-1 truncate disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="">-- Sin Ret --</option>
                          {conceptosIva.map((c) => {
                            const tarifaPorcentaje = (
                              Number(c.tarifa || 0) * 100
                            ).toFixed(2);
                            const textoConcepto = c.concepto || "";
                            const conceptoCorto =
                              textoConcepto.length > 45
                                ? `${textoConcepto.substring(0, 45)}...`
                                : textoConcepto;
                            return (
                              <option
                                key={`${activeCompanyId}_${anioContabilidad}_iva_${idx}_${c.id}`}
                                value={String(c.id)}
                                title={`${textoConcepto} (${tarifaPorcentaje}%)`}
                              >
                                {`${
                                  c.codigo ? c.codigo + " - " : ""
                                }${conceptoCorto} (${tarifaPorcentaje}%)`}
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      {/* SELECTOR ICA */}
                      <td className="p-1">
                        <select
                          disabled={bloqueada || conceptosIca.length === 0}
                          value={String(item.retencion_ica_id || "")}
                          onChange={(e) =>
                            handleRetencionChangeInRow(
                              idx,
                              "retencion_ica_id",
                              e.target.value
                            )
                          }
                          className="w-full border border-blue-200 rounded text-[10px] bg-white h-6 px-1 truncate disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="">-- Sin Ret --</option>
                          {conceptosIca.map((c) => {
                            const tarifaPorMil = (
                              Number(c.tarifa || 0) * 1000
                            ).toFixed(2);
                            const textoConcepto = c.concepto || "";
                            const conceptoCorto =
                              textoConcepto.length > 45
                                ? `${textoConcepto.substring(0, 45)}...`
                                : textoConcepto;
                            return (
                              <option
                                key={`${activeCompanyId}_${anioContabilidad}_ica_${idx}_${c.id}`}
                                value={String(c.id)}
                                title={`${textoConcepto} (${tarifaPorMil}‰)`}
                              >
                                {`${
                                  c.codigo ? c.codigo + " - " : ""
                                }${conceptoCorto} (${tarifaPorMil}‰)`}
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
                    className={
                      item.exito ? "bg-green-50/30" : "bg-red-50/30"
                    }
                  >
                    <td className="p-1.5 font-mono font-medium text-gray-800">
                      {item.numeroFactura}
                    </td>
                    <td className="p-1.5 whitespace-nowrap">
                      {item.exito ? (
                        <span className="text-green-700 font-bold">
                          ✔ Éxito
                        </span>
                      ) : (
                        <span className="text-red-700 font-bold">
                          ❌ Error
                        </span>
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