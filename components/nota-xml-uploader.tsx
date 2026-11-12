"use client";

import React, { useState, useEffect } from "react";
import { registrarNotaDesdeXml, DatosXmlNota } from "@/app/facturas/notas/actions";

interface NotaXmlUploaderProps {
  selectedCompanyId?: string;
  selectedBranchId?: string;
  onNotaProcesada?: () => void;
}

export default function NotaXmlUploader({
  selectedCompanyId: propCompanyId,
  selectedBranchId: propBranchId,
  onNotaProcesada,
}: NotaXmlUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [fechaContable, setFechaContable] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

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

  const parseXmlNota = (content: string): DatosXmlNota => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "application/xml");

    const getFirstValue = (node: Element | Document, tags: string[]) => {
      for (const tag of tags) {
        const el = node.getElementsByTagName(tag)[0];
        if (el && el.textContent?.trim()) return el.textContent.trim();
      }
      return "";
    };

    const esCreditNote =
      xmlDoc.getElementsByTagName("CreditNote").length > 0 ||
      xmlDoc.getElementsByTagName("cac:CreditNoteLine").length > 0;
    const tipoNota: "CREDITO" | "DEBITO" = esCreditNote ? "CREDITO" : "DEBITO";

    const numeroNota = getFirstValue(xmlDoc, ["cbc:ID", "ID"]);
    const cude = getFirstValue(xmlDoc, ["cbc:UUID", "UUID"]);
    const fechaEmision = getFirstValue(xmlDoc, ["cbc:IssueDate", "IssueDate"]);
    const motivo = getFirstValue(xmlDoc, ["cbc:Description", "Description"]);

    const subtotal = parseFloat(getFirstValue(xmlDoc, ["cbc:LineExtensionAmount", "LineExtensionAmount"]) || "0");
    const impuestos = parseFloat(getFirstValue(xmlDoc, ["cbc:TaxAmount", "TaxAmount"]) || "0");
    const montoTotal = parseFloat(getFirstValue(xmlDoc, ["cbc:PayableAmount", "PayableAmount"]) || "0");

    let numeroFacturaReferencia = "";
    let cufeFacturaReferencia = "";

    const billingRefNodes = xmlDoc.getElementsByTagName("cac:BillingReference");
    if (billingRefNodes.length > 0) {
      const refRoot = billingRefNodes[0];
      numeroFacturaReferencia = getFirstValue(refRoot, ["cbc:ID", "ID"]);
      cufeFacturaReferencia = getFirstValue(refRoot, ["cbc:UUID", "UUID"]);
    }

    return {
      tipoNota,
      numeroNota,
      cude,
      fechaEmision,
      subtotal,
      impuestos,
      montoTotal,
      motivo,
      numeroFacturaReferencia,
      cufeFacturaReferencia,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedCompanyId) {
      setMensaje({ tipo: "error", texto: "Debe seleccionar una empresa activa." });
      return;
    }

    setLoading(true);
    setMensaje(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const datosNota = parseXmlNota(content);

          if (!datosNota.numeroFacturaReferencia && !datosNota.cufeFacturaReferencia) {
            throw new Error("El XML no contiene referencia a la factura (<cac:BillingReference>).");
          }

          const res = await registrarNotaDesdeXml(
            datosNota,
            parseInt(selectedCompanyId),
            selectedBranchId ? parseInt(selectedBranchId) : null,
            fechaContable
          );

          if (res.success) {
            setMensaje({
              tipo: "exito",
              texto: `Nota ${datosNota.tipoNota} N° ${datosNota.numeroNota} procesada correctamente.`,
            });
            if (onNotaProcesada) onNotaProcesada();
          } else {
            setMensaje({ tipo: "error", texto: res.error || "Error al procesar la nota." });
          }
        } catch (err: any) {
          setMensaje({ tipo: "error", texto: err.message });
        } finally {
          setLoading(false);
          e.target.value = ""; // Limpiar input file
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: "Error al leer el archivo." });
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm text-xs space-y-4">
      <h3 className="font-bold text-gray-800 text-sm">Cargar Nota Electrónica (XML)</h3>

      {/* Control Fecha Contable */}
      <div>
        <label className="block text-gray-700 font-semibold mb-1">Fecha Contable de Registro:</label>
        <input
          type="date"
          value={fechaContable}
          onChange={(e) => setFechaContable(e.target.value)}
          className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 font-mono text-xs"
        />
        <span className="text-[10px] text-gray-400">
          Fecha en la que afectará la contabilidad (Libro Diario).
        </span>
      </div>

      {mensaje && (
        <div
          className={`p-2.5 rounded font-medium ${
            mensaje.tipo === "exito"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div>
        <label className="block text-gray-700 font-semibold mb-1">Archivo XML:</label>
        <input
          type="file"
          accept=".xml"
          onChange={handleFileUpload}
          disabled={loading || !selectedCompanyId}
          className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
        />
        {!selectedCompanyId && (
          <p className="text-[10px] text-amber-600 mt-1">Seleccione una empresa en la barra superior para habilitar la carga.</p>
        )}
      </div>

      {loading && <p className="text-blue-600 animate-pulse font-medium">Procesando Nota Electrónica...</p>}
    </div>
  );
}