"use client";

import React, { useState, useEffect } from "react";
import NotaEmitidaXmlUploader from "../../../components/nota-emitida-xml-uploader";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

interface NotaEmitida {
  id: string;
  tipo_nota: "CREDITO" | "DEBITO";
  numero_nota: string;
  cude: string | null;
  fecha_emision: string;
  fecha_contable: string;
  subtotal: number;
  impuestos: number;
  monto_total: number;
  motivo: string | null;
  facturas_emitidas?: {
    numero_factura: string;
  } | null;
}

export default function NotasEmitidasPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>("");

  const [notas, setNotas] = useState<NotaEmitida[]>([]);
  const [loadingNotas, setLoadingNotas] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    async function cargarEmpresas() {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .order("razon_social", { ascending: true });

      if (!error && data && data.length > 0) {
        setEmpresas(data);
        setEmpresaId(String(data[0].id));
      }
    }
    cargarEmpresas();
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || !empresaId) return;

    async function cargarSucursales() {
      setSucursalId("");
      const { data, error } = await supabase
        .from("sucursales")
        .select("*")
        .eq("empresa_id", parseInt(empresaId))
        .order("codigo_sucursal", { ascending: true });

      if (!error && data) {
        setSucursales(data);
      }
    }
    cargarSucursales();
  }, [empresaId, isMounted]);

  const cargarNotas = async () => {
    if (!empresaId) return;
    setLoadingNotas(true);

    let query = supabase
      .from("notas_emitidas")
      .select(`
        id,
        tipo_nota,
        numero_nota,
        cude,
        fecha_emision,
        fecha_contable,
        subtotal,
        impuestos,
        monto_total,
        motivo,
        facturas_emitidas (
          numero_factura
        )
      `)
      .eq("empresa_id", parseInt(empresaId))
      .order("fecha_contable", { ascending: false });

    if (sucursalId) {
      query = query.eq("sucursal_id", parseInt(sucursalId));
    }

    const { data, error } = await query;

    if (!error && data) {
      setNotas(data as unknown as NotaEmitida[]);
    }
    setLoadingNotas(false);
  };

  useEffect(() => {
    if (isMounted && empresaId) {
      cargarNotas();
    }
  }, [empresaId, sucursalId, isMounted]);

  if (!isMounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded"></div>
              <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Notas Crédito y Débito Emitidas (Ventas)
          </h1>
          <p className="text-sm text-slate-500">
            Registro y causación contable de notas de ajuste UBL 2.1 sobre facturas de venta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Empresa
          </label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial || emp.nombre} (
                {emp.nit_identificacion || emp.nit || ""})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Sucursal
          </label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.nombre} {suc.codigo_sucursal ? `(${suc.codigo_sucursal})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <NotaEmitidaXmlUploader
            selectedCompanyId={empresaId}
            selectedBranchId={sucursalId}
            onNotaProcesada={cargarNotas}
          />
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-bold text-slate-800">
              Notas Emitidas Registradas ({notas.length})
            </h2>
            <button
              onClick={cargarNotas}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium"
            >
              🔄 Recargar
            </button>
          </div>

          {loadingNotas ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              Cargando notas emitidas...
            </div>
          ) : notas.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No hay notas emitidas registradas para la selección actual.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="p-3">Tipo</th>
                    <th className="p-3">N° Nota</th>
                    <th className="p-3">Factura Venta Ref.</th>
                    <th className="p-3">F. Emisión</th>
                    <th className="p-3">F. Contable</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {notas.map((nota) => (
                    <tr
                      key={nota.id}
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${
                            nota.tipo_nota === "CREDITO"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {nota.tipo_nota}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-900">
                        {nota.numero_nota}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {nota.facturas_emitidas?.numero_factura || "—"}
                      </td>
                      <td className="p-3 text-slate-600">
                        {nota.fecha_emision}
                      </td>
                      <td className="p-3 font-mono text-indigo-900 font-medium">
                        {nota.fecha_contable || nota.fecha_emision}
                      </td>
                      <td
                        className="p-3 text-right font-mono font-bold text-slate-900"
                        suppressHydrationWarning
                      >
                        ${Number(nota.monto_total).toLocaleString("es-CO")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}