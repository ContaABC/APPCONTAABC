"use client";

import React, { useState } from "react";
// Asegúrate de que esta ruta apunte exactamente a donde tienes tu archivo actions.ts de notas emitidas
import { registrarNotaEmitidaDesdeXml, DatosXmlNotaEmitida } from "@/app/facturas/notas/actions"; 

interface NotaEmitidaXmlUploaderProps {
  selectedCompanyId: string | number;
  selectedBranchId: string | number;
  onNotaProcesada: () => void;
}

export default function NotaEmitidaXmlUploader({
  selectedCompanyId,
  selectedBranchId,
  onNotaProcesada,
}: NotaEmitidaXmlUploaderProps) {
  const [fechaContable, setFechaContable] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [cargando, setCargando] = useState<boolean>(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!selectedCompanyId) {
      setMensaje({
        tipo: "error",
        texto: "Por favor seleccione una empresa antes de importar el XML.",
      });
      e.target.value = "";
      return;
    }

    setCargando(true);
    setMensaje(null);

    let procesadas = 0;
    let errores = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const xmlText = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const rootNodeName = xmlDoc.documentElement.nodeName.toUpperCase();
        let tipoNota: "CREDITO" | "DEBITO" = "CREDITO";
        if (rootNodeName.includes("DEBIT") || xmlDoc.getElementsByTagNameNS("*", "DebitNote").length > 0) {
          tipoNota = "DEBITO";
        }

        const numeroNota =
          xmlDoc.querySelector("ID")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "ID")[0]?.textContent ||
          `NOTA-${Date.now()}`;

        const cude =
          xmlDoc.querySelector("UUID")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "UUID")[0]?.textContent ||
          undefined;

        const fechaEmision =
          xmlDoc.querySelector("IssueDate")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "IssueDate")[0]?.textContent ||
          new Date().toISOString().split("T")[0];

        const subtotal = Number(
          xmlDoc.querySelector("LegalMonetaryTotal LineExtensionAmount")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "LineExtensionAmount")[0]?.textContent ||
          0
        );

        const impuestos = Number(
          xmlDoc.querySelector("TaxTotal TaxAmount")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "TaxAmount")[0]?.textContent ||
          0
        );

        const montoTotal = Number(
          xmlDoc.querySelector("LegalMonetaryTotal TaxInclusiveAmount")?.textContent ||
          xmlDoc.querySelector("LegalMonetaryTotal PayableAmount")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "TaxInclusiveAmount")[0]?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "PayableAmount")[0]?.textContent ||
          (subtotal + impuestos)
        );

        const motivo =
          xmlDoc.querySelector("Note")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "Note")[0]?.textContent ||
          "Nota de ajuste electrónico UBL 2.1";

        const numeroFacturaReferencia =
          xmlDoc.querySelector("BillingReference InvoiceDocumentReference ID")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "InvoiceDocumentReference")[0]?.querySelector("ID")?.textContent ||
          undefined;

        const cufeFacturaReferencia =
          xmlDoc.querySelector("BillingReference InvoiceDocumentReference UUID")?.textContent ||
          xmlDoc.getElementsByTagNameNS("*", "InvoiceDocumentReference")[0]?.querySelector("UUID")?.textContent ||
          undefined;

        const datosNota: DatosXmlNotaEmitida = {
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

        const res = await registrarNotaEmitidaDesdeXml(
          datosNota,
          Number(selectedCompanyId),
          selectedBranchId ? Number(selectedBranchId) : null,
          fechaContable
        );

        if (res.success) {
          procesadas++;
        } else {
          errores++;
          console.error(`Error procesando ${file.name}:`, res.error);
        }
      } catch (err) {
        errores++;
        console.error(`Excepción leyendo archivo ${file.name}:`, err);
      }
    }

    setCargando(false);
    e.target.value = "";

    if (errores === 0) {
      setMensaje({
        tipo: "ok",
        texto: `¡Se importaron y registraron ${procesadas} nota(s) emitida(s) con éxito!`,
      });
      onNotaProcesada();
    } else {
      setMensaje({
        tipo: "error",
        texto: `Proceso finalizado con observaciones: ${procesadas} exitosas, ${errores} con errores. Verifique que la factura original exista en el sistema.`,
      });
      onNotaProcesada();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
      <h2 className="text-sm font-bold text-slate-800 border-b pb-2">
        📥 Importar XML Nota Crédito / Débito Emitida
      </h2>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Fecha Contable para el Asiento *
          </label>
          <input
            type="date"
            value={fechaContable}
            onChange={(e) => setFechaContable(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Archivo(s) XML UBL 2.1
          </label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer bg-slate-50 hover:bg-slate-100 transition">
            <span className="text-2xl mb-1">📄</span>
            <span className="text-xs font-bold text-slate-700">
              {cargando ? "Procesando notas..." : "Haga clic para seleccionar XMLs"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Soporta selección múltiple
            </span>
            <input
              type="file"
              accept=".xml"
              multiple
              disabled={cargando || !selectedCompanyId}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {mensaje && (
          <div
            className={`p-3 rounded-lg text-xs font-medium ${
              mensaje.tipo === "ok"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {mensaje.texto}
          </div>
        )}
      </div>
    </div>
  );
}