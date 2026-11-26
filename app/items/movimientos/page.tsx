import { cookies } from "next/headers";
import {
  getEmpresasPermitidas,
  getSucursalesPermitidas,
  getEmpresaActivaUsuario,
  getSucursalActivaUsuario,
  type Sucursal,
} from "@/app/actions/accionesEmpresas";
import { obtenerCatalogoItemsFiltro, type ItemFiltro } from "./actions";
import BotonAtras from "./boton-atras";
import MovimientosItemsForm from "./movimientos-items-form";

export default async function MovimientosItemsPage() {
  const cookieStore = await cookies();
  const empresaActivaCookie = cookieStore.get("empresa_activa")?.value || "";
  const sucursalActivaCookie = cookieStore.get("sucursal_activa")?.value || "";

  const empresasPermitidas = await getEmpresasPermitidas();
  const empresas = Array.isArray(empresasPermitidas) ? empresasPermitidas : [];

  const empresaActivaBD = await getEmpresaActivaUsuario();
  const candidataEmpresa =
    empresaActivaBD !== null &&
    empresaActivaBD !== undefined &&
    String(empresaActivaBD).trim() !== ""
      ? String(empresaActivaBD).trim()
      : empresaActivaCookie;

  const empresaInicialId =
    candidataEmpresa && empresas.some((e) => String(e.id) === candidataEmpresa)
      ? candidataEmpresa
      : empresas.length > 0
      ? String(empresas[0].id)
      : "";

  let sucursalesIniciales: Sucursal[] = [];
  let sucursalInicialId = "";
  let itemsCatalogoIniciales: ItemFiltro[] = [];

  if (empresaInicialId) {
    const sucursalesPermitidas =
      await getSucursalesPermitidas(empresaInicialId);
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
      ? sucursalesIniciales.some((s) => String(s.id) === candidataSucursal)
      : false;

    sucursalInicialId = sucCoincide
      ? candidataSucursal
      : sucursalesIniciales.length > 0
      ? String(sucursalesIniciales[0].id)
      : "";

    const catRes = await obtenerCatalogoItemsFiltro(
      empresaInicialId,
      sucursalInicialId || null
    );
    if (catRes.success && Array.isArray(catRes.data)) {
      itemsCatalogoIniciales = (catRes.data as Array<Partial<ItemFiltro>>).map(
        (item) => ({
          id: item.id ?? "",
          codigo: item.codigo,
          nombre: String(item.nombre || ""),
        })
      );
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="border-b pb-4 flex items-center gap-3">
        <BotonAtras />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Movimientos Acumulados por Ítems
          </h1>
          <p className="text-sm text-slate-500">
            Consulte los acumulados y realice verificaciones de movimientos en
            detalle de facturas emitidas.
          </p>
        </div>
      </div>

      <MovimientosItemsForm
        empresasIniciales={empresas}
        empresaActivaCookie={empresaInicialId}
        sucursalesIniciales={sucursalesIniciales}
        sucursalActivaInicial={sucursalInicialId}
        itemsCatalogoIniciales={itemsCatalogoIniciales}
      />
    </div>
  );
}