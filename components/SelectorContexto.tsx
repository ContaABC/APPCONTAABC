"use client";

import { useEmpresaContext } from "@/app/context/EmpresaContext";

export default function SelectorContexto() {
  const {
    empresasPermitidas,
    sucursalesPermitidas,
    empresaActiva,
    sucursalActiva,
    setEmpresaActiva,
    setSucursalActiva,
    bloquearSelectores,
    cargandoContexto,
  } = useEmpresaContext();

  if (cargandoContexto) return <p className="text-xs text-zinc-400">Cargando entorno...</p>;

  // Filtrar sucursales de la empresa activa
  const sucursalesVisibles = sucursalesPermitidas.filter(
    (s) => !empresaActiva || String(s.empresa_id) === empresaActiva
  );

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {/* Selector de Empresa */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Empresa de Trabajo</label>
          <select
            value={empresaActiva}
            disabled={bloquearSelectores}
            onChange={(e) => {
              setEmpresaActiva(e.target.value);
              setSucursalActiva(""); // Resetear sucursal al cambiar empresa
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-medium focus:outline-none focus:border-indigo-600 disabled:opacity-60"
          >
            <option value="" className="dark:bg-zinc-900">Seleccione empresa...</option>
            {empresasPermitidas.map((emp) => (
              <option key={emp.id} value={emp.id} className="dark:bg-zinc-900">
                {emp.razon_social || emp.nombre_comercial}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Sucursal */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Sucursal Activa</label>
          <select
            value={sucursalActiva}
            disabled={bloquearSelectores || !empresaActiva}
            onChange={(e) => setSucursalActiva(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent font-medium focus:outline-none focus:border-indigo-600 disabled:opacity-60"
          >
            <option value="" className="dark:bg-zinc-900">Seleccione sucursal...</option>
            {sucursalesVisibles.map((suc) => (
              <option key={suc.id} value={suc.id} className="dark:bg-zinc-900">
                {suc.nombre} ({suc.codigo_sucursal})
              </option>
            ))}
          </select>
        </div>
      </div>

      {bloquearSelectores && (
        <span className="text-[11px] text-amber-600 font-medium whitespace-nowrap bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900">
          🔒 Entorno fijo por asignación única
        </span>
      )}
    </div>
  );
}