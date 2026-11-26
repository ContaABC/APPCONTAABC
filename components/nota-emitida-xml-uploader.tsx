"use client";

import React, { useState } from "react";
import {
  registrarNotaEmitidaDesdeXml,
  DatosXmlNotaEmitida,
} from "@/app/facturas/notas/actions";

interface NotaEmitidaXmlUploaderProps {
  selectedCompanyId: string | number;
  selectedBranchId: string | number;
  onNotaProcesada: () => void;
}

function textoLocalTag(
  parent: Element | Document,
  localName: string
): string | undefined {
  const els = parent.getElementsByTagNameNS("*", localName);
  if (els && els.length > 0) {
    const txt = els[0].textContent?.trim();
    if (txt) return txt;
  }
  return undefined;
}

function extraerDocumentoNota(xmlDoc: Document): Document {
  const rootName = xmlDoc.documentElement?.nodeName?.toUpperCase() || "";
  if (!rootName.includes("ATTACHEDDOCUMENT")) {
    return xmlDoc;
  }

  // En AttachedDocument DIAN, el CreditNote / DebitNote suele venir dentro de Description
  const descriptions = xmlDoc.getElementsByTagNameNS("*", "Description");
  for (let i = 0; i < descriptions.length; i++) {
    const raw = descriptions[i].textContent?.trim() || "";
    if (
      raw.includes("<CreditNote") ||
      raw.includes(":CreditNote") ||
      raw.includes("<DebitNote") ||
      raw.includes(":DebitNote")
    ) {
      const parser = new DOMParser();
      const innerDoc = parser.parseFromString(raw, "text/xml");
      if (innerDoc.documentElement && !innerDoc.getElementsByTagName("parsererror").length) {
        return innerDoc;
      }
    }
  }

  return xmlDoc;
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
  const [mensaje, setMensaje] = useState<{
    tipo: "ok" | "error";
    texto: string;
  } | null>(null);

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
    const detalleErrores: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const xmlText = await file.text();
        const parser = new DOMParser();
        const outerDoc = parser.parseFromString(xmlText, "text/xml");

        if (outerDoc.getElementsByTagName("parsererror").length > 0) {
          errores++;
          detalleErrores.push(`${file.name}: XML mal formado.`);
          continue;
        }

        const docNota = extraerDocumentoNota(outerDoc);
        const rootNodeName =
          docNota.documentElement?.nodeName?.toUpperCase() || "";

        let tipoNota: "CREDITO" | "DEBITO" = "CREDITO";
        if (
          rootNodeName.includes("DEBIT") ||
          docNota.getElementsByTagNameNS("*", "DebitNote").length > 0
        ) {
          tipoNota = "DEBITO";
        }

        const numeroNota =
          textoLocalTag(docNota, "ID") || `NOTA-${Date.now()}`;

        const cude = textoLocalTag(docNota, "UUID");

        const fechaEmision =
          textoLocalTag(docNota, "IssueDate") ||
          new Date().toISOString().split("T")[0];

        const subtotal = Number(
          textoLocalTag(docNota, "LineExtensionAmount") || 0
        );

        const impuestos = Number(textoLocalTag(docNota, "TaxAmount") || 0);

        const montoTotal = Number(
          textoLocalTag(docNota, "TaxInclusiveAmount") ||
            textoLocalTag(docNota, "PayableAmount") ||
            subtotal + impuestos
        );

        const motivo =
          textoLocalTag(docNota, "Note") ||
          "Nota de ajuste electrónico UBL 2.1";

        // Extraer BillingReference -> InvoiceDocumentReference (ID y UUID)
        let numeroFacturaReferencia: string | undefined;
        let cufeFacturaReferencia: string | undefined;

        const billingRefs = docNota.getElementsByTagNameNS(
          "*",
          "BillingReference"
        );
        for (let b = 0; b < billingRefs.length; b++) {
          const invDocRefs = billingRefs[b].getElementsByTagNameNS(
            "*",
            "InvoiceDocumentReference"
          );
          for (let r = 0; r < invDocRefs.length; r++) {
            if (!numeroFacturaReferencia) {
              numeroFacturaReferencia = textoLocalTag(invDocRefs[r], "ID");
            }
            if (!cufeFacturaReferencia) {
              cufeFacturaReferencia = textoLocalTag(invDocRefs[r], "UUID");
            }
          }
        }

        // Respaldo si no vino dentro de BillingReference
        if (!numeroFacturaReferencia) {
          numeroFacturaReferencia =
            textoLocalTag(docNota, "ParentDocumentID") ||
            textoLocalTag(outerDoc, "ParentDocumentID");
        }

        const datosNota: DatosXmlNotaEmitida = {
          tipoNota,
          numeroNota,
          cude,
          fechaEmision,
          subtotal: Number.isNaN(subtotal) ? 0 : subtotal,
          impuestos: Number.isNaN(impuestos) ? 0 : impuestos,
          montoTotal: Number.isNaN(montoTotal) ? 0 : montoTotal,
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
          detalleErrores.push(`${file.name}: ${res.error}`);
          console.error(`Error procesando ${file.name}:`, res.error);
        }
      } catch (err) {
        errores++;
        const msg = err instanceof Error ? err.message : String(err);
        detalleErrores.push(`${file.name}: ${msg}`);
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
        texto: `Proceso finalizado: ${procesadas} exitosas, ${errores} con error. ${detalleErrores.join(
          " | "
        )}`,
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
              {cargando
                ? "Procesando notas..."
                : "Haga clic para seleccionar XMLs"}
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