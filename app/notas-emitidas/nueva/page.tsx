import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import NotaEmitidaForm from "./nota-form";
import { validarPeriodoContable } from "@/lib/accounting-validations";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
} from "@/app/actions/accionesEmpresas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseAdminInstance: ReturnType<typeof createClient<any>> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan variables de entorno para Supabase.");
  }

  supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return supabaseAdminInstance;
}

interface PageProps {
  searchParams: Promise<{ empresaId?: string; sucursalId?: string }>;
}

export default async function NuevaNotaEmitidaPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const supabase = getSupabaseAdmin();

  const empresaCookie = cookieStore.get("empresa_activa")?.value;
  const sucursalCookie = cookieStore.get("sucursal_activa")?.value;
  const usuarioCookie = cookieStore.get("usuario_id")?.value || null;

  const empresaIdInicial = resolvedSearchParams.empresaId || empresaCookie || "";
  const sucursalIdInicial =
    resolvedSearchParams.sucursalId || sucursalCookie || "";
  const fechaHoy = new Date().toISOString().split("T")[0];

  let errorPeriodoInicial: string | null = null;
  if (empresaIdInicial && sucursalIdInicial) {
    const resPeriodo = await validarPeriodoContable(
      empresaIdInicial,
      sucursalIdInicial,
      fechaHoy
    );
    if (!resPeriodo.valido) {
      errorPeriodoInicial =
        resPeriodo.mensaje || "El periodo contable actual no está habilitado.";
    }
  }

  const [empresasPermitidas, { data: clasesDocumento }] = await Promise.all([
    getEmpresasPermitidas(usuarioCookie),
    supabase
      .from("clases_documento")
      .select("*")
      .order("codigo_clase", { ascending: true }),
  ]);

  const listaEmpresas = Array.isArray(empresasPermitidas)
    ? empresasPermitidas
    : [];

  const empresaActivaResuelta =
    empresaIdInicial ||
    (listaEmpresas.length > 0 ? String(listaEmpresas[0].id) : "");

  const sucursalesPermitidas = empresaActivaResuelta
    ? await getSucursalesPermitidas(empresaActivaResuelta, usuarioCookie)
    : [];

  const listaSucursales = Array.isArray(sucursalesPermitidas)
    ? sucursalesPermitidas
    : [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {errorPeriodoInicial && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs font-semibold">
          ⚠️ <strong>Advertencia de Periodo Contable:</strong>{" "}
          {errorPeriodoInicial}
        </div>
      )}

      <NotaEmitidaForm
        empresas={listaEmpresas}
        sucursales={listaSucursales}
        clasesDocumento={clasesDocumento || []}
        empresaIdInicial={empresaIdInicial}
        sucursalIdInicial={sucursalIdInicial}
      />
    </div>
  );
}