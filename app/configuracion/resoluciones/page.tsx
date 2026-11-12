'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { obtenerEmpresas, obtenerSucursales } from '@/app/consultas/movimientos/movimientos-actions'

export default function ResolucionesPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false)
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
  const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return
    async function init() {
      const res = await obtenerEmpresas()
      if (res.success && res.data) {
        setEmpresas(res.data)
        if (res.data.length > 0) setEmpresaId(String(res.data[0].id))
      }
    }
    init()
  }, [isMounted])

  useEffect(() => {
    if (!empresaId || !isMounted) return
    async function cargarSucursalesYResoluciones() {
      const sucRes = await obtenerSucursales(Number(empresaId))
      if (sucRes.success) {
        setSucursales(sucRes.data || [])
        if (sucRes.data && sucRes.data.length > 0) {
          setSucursalId(String(sucRes.data[0].id))
        } else {
          setSucursalId('')
        }
      }
      cargarResoluciones(empresaId)
    }
    cargarSucursalesYResoluciones()
  }, [empresaId, isMounted])

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
    setMensajeFeedback(null)

    if (!empresaId || !sucursalId || !numeroResolucion) {
      setMensajeFeedback({ tipo: 'error', texto: 'Complete los campos obligatorios (Empresa, Sucursal y N° Resolución).' })
      return
    }

    if (consecutivoFinal < consecutivoInicial) {
      setMensajeFeedback({ tipo: 'error', texto: 'El consecutivo final no puede ser menor que el consecutivo inicial.' })
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
      consecutivo_actual: Number(consecutivoInicial) - 1,
      fecha_vigencia_hasta: fechaVigenciaHasta,
      activo
    }])

    if (error) {
      setMensajeFeedback({ tipo: 'error', texto: 'Error al guardar resolución: ' + error.message })
    } else {
      setMensajeFeedback({ tipo: 'exito', texto: '¡Resolución DIAN registrada con éxito!' })
      setNumeroResolucion('')
      cargarResoluciones(empresaId)
    }
    setLoading(false)
  }

  if (!isMounted) return <div className="p-4 text-center text-xs text-slate-400">Cargando módulo de resoluciones...</div>

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4 text-xs font-sans">
      <div className="border-b pb-2">
        <h1 className="text-base font-bold text-slate-800">Administración de Resoluciones DIAN</h1>
        <p className="text-[11px] text-slate-500">Configuración de rangos de numeración autorizados por prefijo y sucursal.</p>
      </div>

      {mensajeFeedback && (
        <div className={`p-3 rounded-md font-medium border ${mensajeFeedback.tipo === 'exito' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mensajeFeedback.tipo === 'exito' ? '✔ ' : '⚠ '} {mensajeFeedback.texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Empresa *</label>
          <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className="w-full bg-white border rounded px-2 py-1 font-medium text-slate-800">
            {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social || e.nombre_comercial}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Sucursal *</label>
          <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} className="w-full bg-white border rounded px-2 py-1 font-medium text-slate-800">
            {sucursales.length === 0 ? (
              <option value="">-- Sin sucursales disponibles --</option>
            ) : (
              sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.codigo_sucursal})</option>)
            )}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Prefijo *</label>
          <input type="text" value={prefijo} onChange={e => setPrefijo(e.target.value.toUpperCase())} placeholder="Ej: FE" className="w-full bg-white border rounded px-2 py-1 font-bold uppercase" required />
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
          <input type="number" min="1" value={consecutivoInicial} onChange={e => setConsecutivoInicial(Number(e.target.value))} className="w-full bg-white border rounded px-2 py-1 font-mono" required />
        </div>

        <div>
          <label className="block font-semibold text-slate-600 uppercase mb-0.5 text-[10px]">Consecutivo Final *</label>
          <input type="number" min="1" value={consecutivoFinal} onChange={e => setConsecutivoFinal(Number(e.target.value))} className="w-full bg-white border rounded px-2 py-1 font-mono" required />
        </div>

        <div className="flex items-center pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="rounded accent-indigo-600" />
            <span className="font-bold text-slate-700">Resolución Activa</span>
          </label>
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button type="submit" disabled={loading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow text-xs disabled:opacity-50 transition">
            {loading ? 'Guardando...' : '💾 Guardar Resolución DIAN'}
          </button>
        </div>
      </form>

      {/* Listado de Resoluciones */}
      <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase">
            <tr>
              <th className="p-3">Prefijo</th>
              <th className="p-3">N° Resolución</th>
              <th className="p-3 text-center">Rango Autorizado</th>
              <th className="p-3 text-center">Actual Usado</th>
              <th className="p-3 text-center">Vigencia Hasta</th>
              <th className="p-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y text-[11px]">
            {resoluciones.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                  No hay resoluciones registradas para esta empresa.
                </td>
              </tr>
            ) : (
              resoluciones.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-bold text-indigo-700 font-mono text-xs">{r.prefijo}</td>
                  <td className="p-3 font-medium text-slate-800">{r.numero_resolucion}</td>
                  <td className="p-3 text-center font-mono text-slate-600">{r.consecutivo_inicial} al {r.consecutivo_final}</td>
                  <td className="p-3 text-center font-mono font-bold text-emerald-700">{r.consecutivo_actual}</td>
                  <td className="p-3 text-center font-mono text-slate-600">{r.fecha_vigencia_hasta}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${r.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {r.activo ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}