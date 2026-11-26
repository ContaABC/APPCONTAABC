import { cookies } from "next/headers";
import { obtenerItemsPorEmpresaYSucursal } from "./actions";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
} from "@/app/actions/accionesEmpresas";
import BotonAtras from "./boton-atras";
import ItemForm from "./item-form";

export default async function ItemsPage() {
  const cookieStore = await cookies();
  const empresaActivaCookie = cookieStore.get("empresa_activa")?.value || "";
  const sucursalActivaCookie = cookieStore.get("sucursal_activa")?.value || "";

  // 1. Obtener únicamente las empresas asignadas al usuario en sesión
  const empresasPermitidas = await getEmpresasPermitidas();
  const empresas = Array.isArray(empresasPermitidas) ? empresasPermitidas : [];

  // 2. Determinar empresa activa priorizando usuarios_perfiles.empresa_activa -> cookie -> primera asignada
  const empresaActivaBD = await getEmpresaActivaUsuario();
  const candidataEmpresa =
    empresaActivaBD !== null &&
    empresaActivaBD !== undefined &&
    String(empresaActivaBD).trim() !== ""
      ? String(empresaActivaBD).trim()
      : empresaActivaCookie;

  const empresaInicialId =
    candidataEmpresa &&
    empresas.some((e) => String(e.id) === candidataEmpresa)
      ? candidataEmpresa
      : empresas.length > 0
      ? String(empresas[0].id)
      : "";

  // 3. Obtener sucursales permitidas e ítems iniciales para la empresa activa
  let sucursalesIniciales: any[] = [];
  let itemsIniciales: any[] = [];
  let sucursalInicialId = "";

  if (empresaInicialId) {
    const sucursalesPermitidas = await getSucursalesPermitidas(empresaInicialId);
    sucursalesIniciales = Array.isArray(sucursalesPermitidas)
      ? sucursalesPermitidas
      : [];

    const sucursalActivaBD = await getSucursalActivaUsuario();
    const candidataSucursal =
      sucursalActivaBD !== null &&
      sucursalActivaBD !== undefined &&
      String(sucursalActivaBD).trim() !== ""
        ? String(sucursalActivaBD).trim()
        : sucursalActivaCookie;

    const sucCoincide = candidataSucursal
      ? sucursalesIniciales.some((s: any) => String(s.id) === candidataSucursal)
      : false;

    sucursalInicialId = sucCoincide
      ? candidataSucursal
      : sucursalesIniciales.length > 0
      ? String(sucursalesIniciales[0].id)
      : "";

    if (sucursalInicialId) {
      const resItems = await obtenerItemsPorEmpresaYSucursal(
        empresaInicialId,
        sucursalInicialId
      );
      itemsIniciales = resItems.success ? resItems.data || [] : [];
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="border-b pb-4 flex items-center gap-3">
        <BotonAtras />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Gestión de Ítems de Facturación
          </h1>
          <p className="text-sm text-slate-500">
            Administre el catálogo de productos y servicios asociados a su empresa y sucursales.
          </p>
        </div>
      </div>

      <ItemForm
        empresasIniciales={empresas}
        empresaActivaCookie={empresaInicialId}
        sucursalesIniciales={sucursalesIniciales}
        itemsIniciales={itemsIniciales}
      />
    </div>
  );
}