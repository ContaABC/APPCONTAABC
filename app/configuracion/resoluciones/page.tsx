'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { obtenerEmpresas, obtenerSucursales } from '@/app/consultas/movimientos/movimientos-actions'

export default function ResolucionesPage() {
  const [empresas, setEmpresas] = useState<any[]>([])
  const [sucursales, setSucursales] = useState<any[]>([])
  const [resoluciones, setResoluciones] = useState<any[]>([])

  const [empresaId, setEmpresaId] = useState<string>('')
  const [sucursalId, setSucursalId] = useState<string>('')
  const [prefijo, setPrefijo] = useState<string>('FE')
  const [numeroResolucion, setNumeroResolucion] = useState<string>('')
  const [fechaExpedicion, setFechaExpedicion] = useState<string>('')
  const [consecutivoInicial, setConsecutivoInicial] = useState<number>(1)
  const [consecutivoFinal, setConsecutivoFinal] = useState<number>(1000)
  const [fechaVigenciaHasta, setFechaVigenciaHasta] = useState<string>('')
  const [activo, setActivo] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    async function init() {
      const res = await obtenerEmpresas()
      if (res.success && res.data) {
        setEmpresas(res.data)
        if (res.data.length > 0) setEmpresaId(String(res.data[0].id))
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!empresaId) return
    async function cargarSucursalesYResoluciones() {
      const sucRes = await obtenerSucursales(Number(empresaId))
      if (sucRes.success) {
        setSucursales(sucRes.data || [])
        if (sucRes.data && sucRes.data.length > 0) setSucursalId(String(sucRes.data[0].id))
      }
      cargarResoluciones(empresaId)
    }
    cargarSucursalesYResoluciones()
  }, [empresaId])

  async function cargarResoluciones(empId: string) {
    const { data, error } = await supabase
      .from('resoluciones_facturacion')
      .select('*')
      .eq('empresa_id', empId)
      .order('created_at', { ascending: false })

    if (!error) setResoluciones(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId || !sucursalId || !numeroResolucion) {
      alert('Complete los campos obligatorios.')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('resoluciones_facturacion').insert([{
      empresa_id: Number(empresaId),
      sucursal_id: Number(sucursalId),
      prefijo,
      numero_resolucion: numeroResolucion,
      fecha_expedicion: fechaExpedicion,
      consecutivo_inicial: Number(consecutivoInicial),
      consecutivo_final: Number(consecutivoFinal),
      consecutivo_actual: Number(consecutivoInicial) - 1, // Arranca antes del inicial para que el primer incremento sea el inicial exacto
      fecha_vigencia_hasta: fechaVigenciaHasta,
      activo
    }])

    if (error) {
      alert('Error al guardar resolución: ' + error.message)
    } else {
      alert('¡Resolución registrada con éxito!')
      setNumeroResolucion('')
      cargarResoluciones(empresaId)
    }
    setLoading(false)
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4 text-xs font-sans">
      <h1 className="text-base font-bold text-slate-800">Administración de Resoluciones DIAN</h1>

      <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Empresa *</label>
          <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className="w-full bg-white border rounded px-2 py-1">
            {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Sucursal *</label>
          <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} className="w-full bg-white border rounded px-2 py-1">
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Prefijo *</label>
          <input type="text" value={prefijo} onChange={e => setPrefijo(e.target.value)} placeholder="Ej: FE" className="w-full bg-white border rounded px-2 py-1 font-bold" required />
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">N° Resolución DIAN *</label>
          <input type="text" value={numeroResolucion} onChange={e => setNumeroResolucion(e.target.value)} placeholder="Ej: 18760000001" className="w-full bg-white border rounded px-2 py-1" required />
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Fecha Expedición *</label>
          <input type="date" value={fechaExpedicion} onChange={e => setFechaExpedicion(e.target.value)} className="w-full bg-white border rounded px-2 py-1" required />
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Fecha Vigencia Hasta *</label>
          <input type="date" value={fechaVigenciaHasta} onChange={e => setFechaVigenciaHasta(e.target.value)} className="w-full bg-white border rounded px-2 py-1" required />
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Consecutivo Inicial *</label>
          <input type="number" value={consecutivoInicial} onChange={e => setConsecutivoInicial(Number(e.target.value))} className="w-full bg-white border rounded px-2 py-1" required />
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Consecutivo Final *</label>
          <input type="number" value={consecutivoFinal} onChange={e => setConsecutivoFinal(Number(e.target.value))} className="w-full bg-white border rounded px-2 py-1" required />
        </div>

        <div className="flex items-center pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="rounded" />
            <span className="font-bold text-slate-700">Resolución Activa</span>
          </label>
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow text-xs">
            {loading ? 'Guardando...' : '💾 Guardar Resolución DIAN'}
          </button>
        </div>
      </form>

      {/* Listado de Resoluciones */}
      <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
            <tr>
              <th className="p-2">Prefijo</th>
              <th className="p-2">N° Resolución</th>
              <th className="p-2 text-center">Rango Autorizado</th>
              <th className="p-2 text-center">Actual Usado</th>
              <th className="p-2 text-center">Vigencia Hasta</th>
              <th className="p-2 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y text-[10px]">
            {resoluciones.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="p-2 font-bold text-indigo-700">{r.prefijo}</td>
                <td className="p-2 font-medium">{r.numero_resolucion}</td>
                <td className="p-2 text-center font-mono">{r.consecutivo_inicial} al {r.consecutivo_final}</td>
                <td className="p-2 text-center font-mono font-bold text-emerald-700">{r.consecutivo_actual}</td>
                <td className="p-2 text-center">{r.fecha_vigencia_hasta}</td>
                <td className="p-2 text-center">
                  <span className={`px-2 py-0.5 rounded font-bold ${r.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {r.activo ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}