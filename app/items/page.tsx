import { cookies } from "next/headers";
import { obtenerEmpresas, obtenerSucursales, obtenerItemsPorEmpresaYSucursal } from "./actions";
import ItemForm from "./item-form";

export default async function ItemsPage() {
  const cookieStore = await cookies();
  const empresaActivaCookie = cookieStore.get("empresa_activa")?.value;

  // 1. Obtener listado de empresas disponibles
  const resEmpresas = await obtenerEmpresas();
  const empresas = resEmpresas.data || [];

  // 2. Determinar la empresa inicial (priorizando la cookie o la primera disponible)
  const empresaInicialId = empresaActivaCookie && empresas.some((e: any) => String(e.id) === empresaActivaCookie)
    ? empresaActivaCookie
    : empresas.length > 0 ? String(empresas[0].id) : "";

  // 3. Obtener sucursales e ítems iniciales para esa empresa si existe
  let sucursalesIniciales: any[] = [];
  let itemsIniciales: any[] = [];

  if (empresaInicialId) {
    const resSucursales = await obtenerSucursales(empresaInicialId);
    sucursalesIniciales = resSucursales.success ? resSucursales.data : [];

    // Si hay sucursales, podemos tomar la primera por defecto o dejarla vacía para que el usuario elija
    const sucursalInicialId = sucursalesIniciales.length > 0 ? String(sucursalesIniciales[0].id) : "";

    if (sucursalInicialId) {
      const resItems = await obtenerItemsPorEmpresaYSucursal(empresaInicialId, sucursalInicialId);
      itemsIniciales = resItems.success ? resItems.data : [];
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800">
          Gestión de Ítems de Facturación
        </h1>
        <p className="text-sm text-slate-500">
          Administre el catálogo de productos y servicios asociados a su empresa y sucursales.
        </p>
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