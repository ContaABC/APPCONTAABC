import { createClient } from "@supabase/supabase-js";
import NotaEmitidaForm from "./nota-form";
import { validarPeriodoContable } from "@/lib/accounting-validations"; // <--- Importar validación centralizada

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan variables de entorno para Supabase.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function NuevaNotaEmitidaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresaId?: string; sucursalId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = getSupabaseAdmin();

  const empresaIdInicial = resolvedSearchParams.empresaId || "";
  const sucursalIdInicial = resolvedSearchParams.sucursalId || "";
  const fechaHoy = new Date().toISOString().split("T")[0];

  // Validación inicial de servidor por si los parámetros ya vienen definidos en la URL
  let errorPeriodoInicial: string | null = null;
  if (empresaIdInicial && sucursalIdInicial) {
    const resPeriodo = await validarPeriodoContable(empresaIdInicial, sucursalIdInicial, fechaHoy);
    if (!resPeriodo.valido) {
      errorPeriodoInicial = resPeriodo.mensaje || "El periodo contable actual no está habilitado.";
    }
  }

  // Consultas idénticas al módulo de emisión de facturas
  const [
    { data: empresas },
    { data: sucursales },
    { data: clasesDocumento }
  ] = await Promise.all([
    supabase.from("empresas").select("*").order("razon_social", { ascending: true }),
    supabase.from("sucursales").select("*").order("codigo_sucursal", { ascending: true }),
    supabase.from("clases_documento").select("*").order("codigo_clase", { ascending: true })
  ]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Emisión de Notas</h1>
        <p className="text-sm text-slate-500">Generación de notas crédito y débito asociadas a facturas electrónicas emitidas.</p>
      </div>
      
      {errorPeriodoInicial && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs font-semibold">
          ⚠️ <strong>Advertencia de Periodo Contable:</strong> {errorPeriodoInicial}
        </div>
      )}
      
      <NotaEmitidaForm
        empresas={empresas || []}
        sucursales={sucursales || []}
        clasesDocumento={clasesDocumento || []}
        empresaIdInicial={empresaIdInicial}
        sucursalIdInicial={sucursalIdInicial}
      />
    </div>
  );
}