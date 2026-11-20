'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getEmpresasPermitidas } from '@/app/actions/accionesEmpresas'
import {
  getActividadesAbcData,
  crearOClonarActividadAbc,
  actualizarActividadAbc,
  eliminarActividadAbc
} from './actions'
import { ArrowLeft, Search, X } from 'lucide-react'

// ==========================================
// INTERFACES Y TIPOS
// ==========================================
interface Empresa {
  id: string | number;
  empresa_id?: string | number;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
  nit?: string;
  nit_identificacion?: string;
  numero_identificacion?: string;
}

interface ActividadABC {
  id: number | string;
  empresa_id: number | string;
  codigo: string;
  nombre: string;
  descripcion?: string;
}

interface ActividadFormData {
  id?: string | number;
  empresa_id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
}

interface ModalClonarProps {
  empresas: Empresa[];
  empresaOrigenInicial: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface SubformularioProps {
  empresas: Empresa[];
  empresaIdSeleccionada: string;
  actividadEditar: ActividadABC | null;
  onClose: () => void;
  onSave: () => void;
}

// ==========================================
// MODAL CLONAR ACTIVIDADES ABC
// ==========================================
function ModalClonarActividades({ empresas, empresaOrigenInicial, onClose, onSuccess }: ModalClonarProps) {
  const [empresaOrigenId, setEmpresaOrigenId] = useState<string>(empresaOrigenInicial || '')
  const [empresasDestinoIds, setEmpresasDestinoIds] = useState<string[]>([])
  const [copiando, setCopiando] = useState<boolean>(false)

  const empresasDestinoPosibles = empresas.filter(
    (emp) => String(emp.id || emp.empresa_id) !== String(empresaOrigenId)
  )

  const handleOrigenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoOrigenId = e.target.value
    setEmpresaOrigenId(nuevoOrigenId)
    setEmpresasDestinoIds((prev) => prev.filter((id) => String(id) !== String(nuevoOrigenId)))
  }

  const handleToggleEmpresaDestino = (id: number | string) => {
    const stringId = String(id)
    setEmpresasDestinoIds((prev) =>
      prev.includes(stringId) ? prev.filter((item) => item !== stringId) : [...prev, stringId]
    )
  }

  const handleSelectAll = () => {
    if (empresasDestinoIds.length === empresasDestinoPosibles.length) {
      setEmpresasDestinoIds([])
    } else {
      setEmpresasDestinoIds(empresasDestinoPosibles.map((emp) => String(emp.id || emp.empresa_id)))
    }
  }

  const handleSubmitClonar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!empresaOrigenId || empresasDestinoIds.length === 0) {
      alert('Debes seleccionar empresa origen y al menos una de destino.')
      return
    }

    if (!confirm(`¿Copiar actividades a las ${empresasDestinoIds.length} empresas seleccionadas?`)) return

    setCopiando(true)

    try {
      const data = await crearOClonarActividadAbc({
        accion: 'clonar_actividades',
        empresa_origen_id: empresaOrigenId,
        empresas_destino_ids: empresasDestinoIds
      })

      if (data.exito) {
        alert(data.mensaje || 'Actividades copiadas exitosamente.')
        onSuccess()
      } else {
        alert(data.mensaje || 'Error al clonar actividades.')
      }
    } catch (err) {
      console.error('Error al clonar:', err)
      alert('Error de conexión con el servidor.')
    } finally {
      setCopiando(false)
    }
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-bold text-gray-800">Copiar Actividades ABC</h3>
          <p className="text-xs text-gray-500">Duplica el catálogo de actividades a otras empresas.</p>
        </div>
        <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 p-1 rounded-full text-sm cursor-pointer">
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmitClonar} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Empresa Origen</label>
          <select
            value={empresaOrigenId}
            onChange={handleOrigenChange}
            className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md bg-white outline-none cursor-pointer"
          >
            <option value="">-- Seleccionar Empresa --</option>
            {empresas.map((emp) => {
              const id = String(emp.id || emp.empresa_id)
              const nombre = emp.razon_social || emp.nombre_comercial || emp.nombre
              return (
                <option key={id} value={id}>
                  🏢 {nombre}
                </option>
              )
            })}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase">2. Empresas Destino</label>
            {empresasDestinoPosibles.length > 0 && (
              <button type="button" onClick={handleSelectAll} className="text-xs text-blue-600 font-medium hover:underline cursor-pointer">
                {empresasDestinoIds.length === empresasDestinoPosibles.length ? 'Desmarcar todas' : 'Seleccionar todas'}
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto divide-y divide-gray-100 p-1 bg-gray-50/50">
            {empresasDestinoPosibles.length === 0 ? (
              <p className="p-3 text-xs text-gray-400 text-center">No hay otras empresas disponibles.</p>
            ) : (
              empresasDestinoPosibles.map((emp) => {
                const id = String(emp.id || emp.empresa_id)
                const nombre = emp.razon_social || emp.nombre_comercial || emp.nombre
                const isChecked = empresasDestinoIds.includes(id)
                return (
                  <label key={id} className="flex items-center space-x-2.5 px-3 py-2 hover:bg-white rounded cursor-pointer text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleEmpresaDestino(id)}
                      className="rounded border-gray-300 text-blue-600 h-4 w-4 cursor-pointer"
                    />
                    <span className="font-medium">{nombre}</span>
                  </label>
                )
              })
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 cursor-pointer">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={copiando || !empresaOrigenId || empresasDestinoIds.length === 0}
            className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-50 cursor-pointer"
          >
            {copiando ? 'Copiando...' : '📋 Copiar Actividades'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ==========================================
// SUBFORMULARIO ACTIVIDAD ABC
// ==========================================
function SubformularioActividad({ empresas, empresaIdSeleccionada, actividadEditar, onClose, onSave }: SubformularioProps) {
  const [guardando, setGuardando] = useState<boolean>(false)
  const [formData, setFormData] = useState<ActividadFormData>({
    empresa_id: empresaIdSeleccionada || '',
    codigo: '',
    nombre: '',
    descripcion: ''
  })

  const obtenerCodigoAuto = useCallback(async (empId: string) => {
    if (!empId) return
    try {
      const data = await getActividadesAbcData({ empresaId: empId, accion: 'siguiente_codigo' })
      if (data.exito && data.siguiente_codigo) {
        setFormData((prev) => ({ ...prev, codigo: data.siguiente_codigo as string }))
      }
    } catch (err) {
      console.error('Error consecutivo:', err)
    }
  }, [])

  useEffect(() => {
    if (actividadEditar) {
      setFormData({
        id: actividadEditar.id,
        empresa_id: String(actividadEditar.empresa_id || empresaIdSeleccionada || ''),
        codigo: actividadEditar.codigo || '',
        nombre: actividadEditar.nombre || '',
        descripcion: actividadEditar.descripcion || ''
      })
    } else {
      setFormData({
        id: undefined,
        empresa_id: String(empresaIdSeleccionada || ''),
        codigo: '',
        nombre: '',
        descripcion: ''
      })
      if (empresaIdSeleccionada) obtenerCodigoAuto(empresaIdSeleccionada)
    }
  }, [actividadEditar, empresaIdSeleccionada, obtenerCodigoAuto])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.empresa_id || !formData.nombre.trim()) {
      alert('Empresa y Nombre son requeridos.')
      return
    }

    setGuardando(true)

    try {
      let data
      if (actividadEditar) {
        data = await actualizarActividadAbc({
          id: formData.id!,
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion
        })
      } else {
        data = await crearOClonarActividadAbc({
          ...formData,
          nombre: formData.nombre.trim()
        })
      }

      if (data.exito) {
        onSave()
      } else {
        alert(data.mensaje || 'Error al guardar.')
      }
    } catch (err) {
      console.error('Error al guardar:', err)
      alert('Error de conexión.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-800">
          {actividadEditar ? 'Editar Actividad ABC' : 'Nueva Actividad ABC (Padre)'}
        </h3>
        <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 p-1 text-sm cursor-pointer">
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Empresa *</label>
          <select value={formData.empresa_id} disabled className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md bg-gray-100 font-semibold text-gray-700 cursor-not-allowed">
            {empresas.map((emp) => {
              const id = String(emp.id || emp.empresa_id)
              const nombre = emp.razon_social || emp.nombre_comercial || emp.nombre
              return (
                <option key={id} value={id}>
                  {nombre}
                </option>
              )
            })}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Código</label>
            <input type="text" value={formData.codigo} disabled className="w-full text-sm border border-gray-200 px-2.5 py-1.5 rounded-md bg-gray-50 font-mono font-bold text-gray-600" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nombre Actividad *</label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: Procesos Operativos Principal"
              className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Descripción</label>
          <textarea
            rows={3}
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            placeholder="Descripción opcional de la macro actividad..."
            className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 cursor-pointer">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 cursor-pointer">
            {guardando ? 'Guardando...' : 'Guardar Actividad'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ==========================================
// PÁGINA PRINCIPAL ACTIVIDADES ABC
// ==========================================
export default function ActividadesABCPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true)
  const [empresaIdSeleccionada, setEmpresaIdSeleccionada] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('empresa_activa') || localStorage.getItem('empresa_id') || ''
    }
    return ''
  })
  const [actividades, setActividades] = useState<ActividadABC[]>([])
  const [busqueda, setBusqueda] = useState<string>('')
  const [cargando, setCargando] = useState<boolean>(true)

  const [modalFormAbierto, setModalFormAbierto] = useState<boolean>(false)
  const [modalClonarAbierto, setModalClonarAbierto] = useState<boolean>(false)
  const [actividadSeleccionada, setActividadSeleccionada] = useState<ActividadABC | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const cargarActividades = useCallback(async (empId: string) => {
    if (!empId) {
      setActividades([])
      setCargando(false)
      return
    }
    setCargando(true)
    try {
      const data = await getActividadesAbcData({ empresaId: empId })
      setActividades(data.exito ? data.datos || [] : [])
    } catch (err) {
      console.error('Error cargando actividades:', err)
      setActividades([])
    } finally {
      setCargando(false)
    }
  }, [])

  // Cargar únicamente empresas asignadas al usuario y detectar la empresa activa
  useEffect(() => {
    if (!isMounted) return

    async function cargarEmpresasIniciales() {
      setLoadingEmpresas(true)
      try {
        let listaEmpresas: Empresa[] = []

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey)
          const { data: authData } = await supabase.auth.getSession()
          const userId = authData?.session?.user?.id

          if (userId) {
            const { data: permisosTx } = await supabase
              .from('usuario_permisos_tx')
              .select('empresa_id')
              .eq('usuario_id', userId)

            const empresaIds = Array.from(
              new Set((permisosTx || []).map((p: any) => String(p.empresa_id)).filter(Boolean))
            )

            if (empresaIds.length > 0) {
              const { data: empRows } = await supabase
                .from('empresas')
                .select('id, razon_social, nombre_comercial')
                .in('id', empresaIds)

              if (empRows && empRows.length > 0) {
                listaEmpresas = empRows
              }
            }
          }
        }

        if (listaEmpresas.length === 0) {
          const resPermitidas: any = await getEmpresasPermitidas()
          if (Array.isArray(resPermitidas)) {
            listaEmpresas = resPermitidas
          } else if (Array.isArray(resPermitidas?.datos)) {
            listaEmpresas = resPermitidas.datos
          } else if (Array.isArray(resPermitidas?.data)) {
            listaEmpresas = resPermitidas.data
          }
        }

        if (listaEmpresas.length === 0) {
          const data = await getActividadesAbcData({ accion: 'listar_empresas' })
          if (data.exito && Array.isArray(data.datos)) {
            listaEmpresas = data.datos
          }
        }

        if (listaEmpresas.length > 0) {
          const empresasOrdenadas = [...listaEmpresas].sort((a: Empresa, b: Empresa) => {
            const nombreA = a.razon_social || a.nombre_comercial || a.nombre || ''
            const nombreB = b.razon_social || b.nombre_comercial || b.nombre || ''
            return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' })
          })

          setEmpresas(empresasOrdenadas)

          const cookieEmpresa = document.cookie
            .split('; ')
            .find((row) => row.startsWith('empresa_activa='))
          const empresaGuardadaCookie = cookieEmpresa ? cookieEmpresa.split('=')[1] : null
          const empresaGuardadaLocal =
            typeof window !== 'undefined'
              ? localStorage.getItem('empresa_activa') || localStorage.getItem('empresa_id')
              : null

          const empresaIdParaSeleccionar = empresaGuardadaLocal || empresaGuardadaCookie
          const existeEmpresa = empresasOrdenadas.some(
            (emp) => String(emp.id || emp.empresa_id) === String(empresaIdParaSeleccionar)
          )

          const primeraEmpresaId =
            existeEmpresa && empresaIdParaSeleccionar
              ? String(empresaIdParaSeleccionar)
              : String(empresasOrdenadas[0].id || empresasOrdenadas[0].empresa_id)

          setEmpresaIdSeleccionada(primeraEmpresaId)
          if (typeof window !== 'undefined') {
            localStorage.setItem('empresa_activa', primeraEmpresaId)
            localStorage.setItem('empresa_id', primeraEmpresaId)
          }
          document.cookie = `empresa_activa=${primeraEmpresaId}; path=/; max-age=86400; SameSite=Lax`

          await cargarActividades(primeraEmpresaId)
        } else {
          setEmpresas([])
          setCargando(false)
        }
      } catch (error) {
        console.error('Error al cargar empresas:', error)
        setEmpresas([])
        setCargando(false)
      } finally {
        setLoadingEmpresas(false)
      }
    }

    cargarEmpresasIniciales()
  }, [isMounted, cargarActividades])

  const handleEmpresaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setEmpresaIdSeleccionada(id)
    setBusqueda('')

    if (!id) {
      setActividades([])
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('empresa_activa', String(id))
      localStorage.setItem('empresa_id', String(id))
    }
    document.cookie = `empresa_activa=${id}; path=/; max-age=86400; SameSite=Lax`

    await cargarActividades(id)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const { data: authData } = await supabase.auth.getSession()
        const userId = authData?.session?.user?.id
        if (userId) {
          const { data: sucursalesEmpresa } = await supabase
            .from('sucursales')
            .select('id')
            .eq('empresa_id', id)
            .order('id', { ascending: true })
            .limit(1)

          const payloadUpdate: Record<string, any> = { empresa_activa: id }
          if (sucursalesEmpresa && sucursalesEmpresa.length > 0) {
            const primeraSucursalId = String(sucursalesEmpresa[0].id)
            payloadUpdate.sucursal_activa = primeraSucursalId
            if (typeof window !== 'undefined') {
              localStorage.setItem('sucursal_activa', primeraSucursalId)
            }
            document.cookie = `sucursal_activa=${primeraSucursalId}; path=/; max-age=86400; SameSite=Lax`
          }

          await supabase
            .from('usuarios_perfiles')
            .update(payloadUpdate)
            .eq('id', userId)
        }
      }
    } catch (err) {
      console.error('Error al actualizar empresa_activa y sucursal_activa en usuarios_perfiles:', err)
    }
  }

  const handleEliminar = async (actividad: ActividadABC) => {
    if (!confirm(`¿Eliminar la actividad "${actividad.nombre}"?`)) return
    try {
      const data = await eliminarActividadAbc(actividad.id)
      if (data.exito) cargarActividades(empresaIdSeleccionada)
      else alert(data.mensaje || 'Error al eliminar.')
    } catch (err) {
      console.error('Error eliminar:', err)
    }
  }

  const actividadesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return actividades
    return actividades.filter(
      (act) =>
        (act.codigo && act.codigo.toLowerCase().includes(q)) ||
        (act.nombre && act.nombre.toLowerCase().includes(q)) ||
        (act.descripcion && act.descripcion.toLowerCase().includes(q))
    )
  }, [actividades, busqueda])

  if (!isMounted) {
    return <div className="p-12 text-center text-sm text-gray-500">Cargando entorno seguro...</div>
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/modulos/contabilidad/configuracion"
            className="p-2.5 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition flex items-center justify-center shrink-0"
            title="Volver a Configuración"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-800 truncate">Actividades ABC (Padres)</h1>
            <p className="text-xs md:text-sm text-gray-500 truncate">Gestión de Macro Actividades para el Costeo Basado en Actividades (ABC).</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={empresaIdSeleccionada}
            onChange={handleEmpresaChange}
            disabled={!isMounted || loadingEmpresas || empresas.length <= 1}
            suppressHydrationWarning
            className="border border-gray-300 px-3 py-1.5 rounded-md bg-white text-xs md:text-sm font-semibold text-gray-700 shadow-sm outline-none min-w-[220px] disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {!isMounted || loadingEmpresas ? (
              <option value="">Cargando empresas...</option>
            ) : empresas.length === 0 ? (
              <option value="">Sin empresas asignadas</option>
            ) : (
              <>
                {empresas.length !== 1 && <option value="">-- Seleccione una Empresa --</option>}
                {empresas.map((emp) => {
                  const id = String(emp.id || emp.empresa_id)
                  const nombre = emp.razon_social || emp.nombre_comercial || emp.nombre
                  return (
                    <option key={id} value={id}>
                      🏢 {nombre}
                    </option>
                  )
                })}
              </>
            )}
          </select>

          <button
            type="button"
            onClick={() => setModalClonarAbierto(true)}
            disabled={!isMounted || !empresaIdSeleccionada || empresas.length <= 1}
            suppressHydrationWarning
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-md shadow-sm text-xs md:text-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            📋 Copiar a otras
          </button>

          <button
            type="button"
            onClick={() => {
              setActividadSeleccionada(null)
              setModalFormAbierto(true)
            }}
            disabled={!isMounted || !empresaIdSeleccionada || empresas.length === 0}
            suppressHydrationWarning
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded-md shadow-sm text-xs md:text-sm disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            + Nueva Actividad
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda */}
      <div className="bg-white p-3.5 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código, nombre o descripción..."
            className="w-full pl-9 pr-8 py-1.5 text-xs md:text-sm border border-gray-300 rounded-md bg-gray-50/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              title="Limpiar búsqueda"
              className="text-gray-400 hover:text-gray-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-500 font-medium">
          Mostrando <strong className="text-gray-800">{actividadesFiltradas.length}</strong> de{' '}
          <strong className="text-gray-800">{actividades.length}</strong> actividad(es)
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="p-6 text-center text-gray-500 text-sm">Cargando actividades ABC...</div>
        ) : actividadesFiltradas.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            {busqueda
              ? 'No se encontraron actividades ABC que coincidan con la búsqueda.'
              : 'No hay actividades registradas para esta empresa.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200 text-xs">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Nombre Actividad</th>
                  <th className="py-2.5 px-3">Descripción</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {actividadesFiltradas.map((act) => (
                  <tr key={act.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-gray-800">{act.codigo}</td>
                    <td className="py-2 px-3 font-medium text-gray-900">{act.nombre}</td>
                    <td className="py-2 px-3 text-gray-600">{act.descripcion || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => {
                            setActividadSeleccionada(act)
                            setModalFormAbierto(true)
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button onClick={() => handleEliminar(act)} className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {modalFormAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-100">
            <SubformularioActividad
              empresas={empresas}
              empresaIdSeleccionada={empresaIdSeleccionada}
              actividadEditar={actividadSeleccionada}
              onClose={() => setModalFormAbierto(false)}
              onSave={() => {
                setModalFormAbierto(false)
                cargarActividades(empresaIdSeleccionada)
              }}
            />
          </div>
        </div>
      )}

      {modalClonarAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-100">
            <ModalClonarActividades
              empresas={empresas}
              empresaOrigenInicial={empresaIdSeleccionada}
              onClose={() => setModalClonarAbierto(false)}
              onSuccess={() => {
                setModalClonarAbierto(false)
                cargarActividades(empresaIdSeleccionada)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}