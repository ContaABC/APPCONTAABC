import { obtenerEmpresas } from "./actions";
import ItemForm from "./item-form";

export default async function ItemsPage() {
  const res = await obtenerEmpresas();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">
        Gestión de Ítems de Facturación
      </h1>

      <ItemForm empresasIniciales={res.data || []} />
    </div>
  );
}