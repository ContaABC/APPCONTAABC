'use client'

import { useState, useEffect, useCallback } from 'react'

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
      const res = await fetch('/api/actividades_abc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'clonar_actividades',
          empresa_origen_id: empresaOrigenId,
          empresas_destino_ids: empresasDestinoIds
        })
      })

      const data = await res.json()
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

  const obtenerCodigoAuto = async (empId: string) => {
    if (!empId) return
    try {
      const res = await fetch(`/api/actividades_abc?empresa_id=${empId}&accion=siguiente_codigo`)
      const data = await res.json()
      if (data.exito) {
        setFormData((prev) => ({ ...prev, codigo: data.siguiente_codigo }))
      }
    } catch (err) {
      console.error('Error consecutivo:', err)
    }
  }

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
      setFormData((prev) => ({ ...prev, empresa_id: String(empresaIdSeleccionada || '') }))
      if (empresaIdSeleccionada) obtenerCodigoAuto(empresaIdSeleccionada)
    }
  }, [actividadEditar, empresaIdSeleccionada])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.empresa_id || !formData.nombre.trim()) {
      alert('Empresa y Nombre son requeridos.')
      return
    }

    setGuardando(true)

    try {
      const metodo = actividadEditar ? 'PUT' : 'POST'
      const res = await fetch('/api/actividades_abc', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
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
          <select value={formData.empresa_id} disabled className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md bg-gray-100 font-semibold text-gray-700">
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
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaIdSeleccionada, setEmpresaIdSeleccionada] = useState<string>('')
  const [actividades, setActividades] = useState<ActividadABC[]>([])
  const [cargando, setCargando] = useState<boolean>(true)

  const [modalFormAbierto, setModalFormAbierto] = useState<boolean>(false)
  const [modalClonarAbierto, setModalClonarAbierto] = useState<boolean>(false)
  const [actividadSeleccionada, setActividadSeleccionada] = useState<ActividadABC | null>(null)
  const [isMounted, setIsMounted] = useState<boolean>(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const cargarActividades = useCallback(async (empId: string) => {
    if (!empId) return
    setCargando(true)
    try {
      const res = await fetch(`/api/actividades_abc?empresa_id=${empId}`)
      const data = await res.json()
      setActividades(data.exito ? data.datos || [] : [])
    } catch (err) {
      console.error('Error cargando actividades:', err)
      setActividades([])
    } finally {
      setCargando(false)
    }
  }, [])

  // Cargar empresas mediante el endpoint centralizado unificado (/api/empresas/listar)
  useEffect(() => {
    async function cargarEmpresasIniciales() {
      try {
        const res = await fetch('/api/empresas/listar')
        
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)

        const textData = await res.text()
        if (!textData) throw new Error('Respuesta vacía')

        const data = JSON.parse(textData)
        const listaEmpresas = data.empresas || data.datos || (Array.isArray(data) ? data : [])

        if (listaEmpresas.length > 0) {
          const empresasOrdenadas = [...listaEmpresas].sort((a: Empresa, b: Empresa) => {
            const nombreA = a.razon_social || a.nombre_comercial || a.nombre || ''
            const nombreB = b.razon_social || b.nombre_comercial || b.nombre || ''
            return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' })
          })

          setEmpresas(empresasOrdenadas)

          // Sincronizar con cookies y localStorage corporativo
          const cookieEmpresa = document.cookie
            .split('; ')
            .find((row) => row.startsWith('empresa_activa='))
          const empresaGuardadaCookie = cookieEmpresa ? cookieEmpresa.split('=')[1] : null
          const empresaGuardadaLocal = typeof window !== 'undefined' ? localStorage.getItem('empresa_activa') : null

          const empresaIdParaSeleccionar = empresaGuardadaCookie || empresaGuardadaLocal
          const existeEmpresa = empresasOrdenadas.some((emp) => String(emp.id || emp.empresa_id) === String(empresaIdParaSeleccionar))

          const primeraEmpresaId = existeEmpresa && empresaIdParaSeleccionar
            ? String(empresaIdParaSeleccionar)
            : String(empresasOrdenadas[0].id || empresasOrdenadas[0].empresa_id)

          setEmpresaIdSeleccionada(primeraEmpresaId)
          cargarActividades(primeraEmpresaId)
        } else {
          setCargando(false)
        }
      } catch (error) {
        console.error('Error al cargar empresas:', error)
        setCargando(false)
      }
    }
    cargarEmpresasIniciales()
  }, [cargarActividades])

  // Persistir cambios de empresaIdSeleccionada en cookies y localStorage
  useEffect(() => {
    if (empresaIdSeleccionada && typeof window !== 'undefined') {
      localStorage.setItem('empresa_activa', String(empresaIdSeleccionada))
      document.cookie = `empresa_activa=${empresaIdSeleccionada}; path=/; max-age=86400; SameSite=Lax`
    }
  }, [empresaIdSeleccionada])

  const handleEmpresaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setEmpresaIdSeleccionada(id)
    cargarActividades(id)
  }

  const handleEliminar = async (actividad: ActividadABC) => {
    if (!confirm(`¿Eliminar la actividad "${actividad.nombre}"?`)) return
    try {
      const res = await fetch(`/api/actividades_abc?id=${actividad.id}&empresa_id=${empresaIdSeleccionada}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.exito) cargarActividades(empresaIdSeleccionada)
      else alert(data.mensaje || 'Error al eliminar.')
    } catch (err) {
      console.error('Error eliminar:', err)
    }
  }

  if (!isMounted) {
    return <div className="p-12 text-center text-sm text-gray-500">Cargando entorno seguro...</div>
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Actividades ABC (Padres)</h1>
          <p className="text-xs md:text-sm text-gray-500">Gestión de Macro Actividades para el Costeo Basado en Actividades (ABC).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={empresaIdSeleccionada}
            onChange={handleEmpresaChange}
            disabled={empresas.length === 0}
            className="border border-gray-300 px-3 py-1.5 rounded-md bg-white text-xs md:text-sm font-semibold text-gray-700 shadow-sm outline-none min-w-[200px] disabled:opacity-60 cursor-pointer"
          >
            {empresas.length === 0 ? (
              <option value="">Cargando empresas...</option>
            ) : (
              empresas.map((emp) => {
                const id = String(emp.id || emp.empresa_id)
                const nombre = emp.razon_social || emp.nombre_comercial || emp.nombre
                return (
                  <option key={id} value={id}>
                    🏢 {nombre}
                  </option>
                )
              })
            )}
          </select>

          <button
            type="button"
            onClick={() => setModalClonarAbierto(true)}
            disabled={!isMounted || !empresaIdSeleccionada || empresas.length <= 1}
            suppressHydrationWarning
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-md shadow-sm text-xs md:text-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded-md shadow-sm text-xs md:text-sm disabled:opacity-50 cursor-pointer"
          >
            + Nueva Actividad
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="p-6 text-center text-gray-500 text-sm">Cargando actividades ABC...</div>
        ) : actividades.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No hay actividades registradas para esta empresa.</div>
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
                {actividades.map((act) => (
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