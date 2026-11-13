'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useEmpresaContext } from '@/app/context/EmpresaContext'
import {
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Activity,
  Search,
  RefreshCw,
  Trash2,
  Info,
  X,
  FileText,
  Layers,
  Power
} from 'lucide-react'

export default function ActividadesAuxiliaresPage() {
  const [isMounted, setIsMounted] = useState(false)

  // Consumimos el contexto global
  const {
    empresaActiva,
    setEmpresaActiva,
    bloquearSelectores,
    cargandoContexto
  } = useEmpresaContext()

  // Estados locales para manejo unificado de empresas
  const [empresas, setEmpresas] = useState([])
  const [loadingEmpresas, setLoadingEmpresas] = useState(false)
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')

  // Estados principales de datos
  const [actividades, setActividades] = useState([])
  const [actividadesAbc, setActividadesAbc] = useState([])

  // Estados de carga e interfaz
  const [loadingTabla, setLoadingTabla] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)

  // Filtros
  const [filtroBusqueda, setFiltroBusqueda] = useState('')

  // Modales
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [actividadEditarId, setActividadEditarId] = useState(null)

  // Notificaciones
  const [notificacion, setNotificacion] = useState({
    visible: false,
    tipo: 'exito',
    mensaje: ''
  })

  // Formulario
  const [formData, setFormData] = useState({
    actividad_padre_id: '',
    codigo: '',
    nombre: '',
    descripcion: '',
    unidad_medida: '',
    estado: true
  })

  const [erroresForm, setErroresForm] = useState({})

  const mostrarNotificacion = useCallback((tipo, mensaje) => {
    setNotificacion({ visible: true, tipo, mensaje })
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (notificacion.visible) {
      const timer = setTimeout(() => {
        setNotificacion((prev) => ({ ...prev, visible: false }))
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [notificacion.visible])

  // Cargar empresas de forma centralizada y unificada desde el endpoint seguro
  const cargarEmpresas = useCallback(async () => {
    setLoadingEmpresas(true)
    try {
      const res = await fetch('/api/empresas/listar')
      const json = await res.json()

      if (json.exito) {
        const listaEmpresas = json.empresas || []
        setEmpresas(listaEmpresas)

        if (listaEmpresas.length > 0) {
          // 1. Obtener cookie o localStorage de la empresa activa
          const empresaGuardada = 
            (typeof window !== 'undefined' ? localStorage.getItem('empresa_activa') || localStorage.getItem('empresa_id') : '') ||
            (document.cookie.match(/(^| )empresa_activa=([^;]+)/)?.[2] ?? '') ||
            (empresaActiva ? String(empresaActiva) : '')

          // 2. Seleccionar la empresa guardada si existe en la lista permitida
          if (empresaGuardada && listaEmpresas.some((e) => String(e.id) === String(empresaGuardada))) {
            setEmpresaSeleccionada(String(empresaGuardada))
          } else {
            // 3. Caso contrario, tomar la primera disponible
            const primeraEmpresa = String(listaEmpresas[0].id)
            setEmpresaSeleccionada(primeraEmpresa)
            if (typeof window !== 'undefined') {
              localStorage.setItem('empresa_activa', primeraEmpresa)
              localStorage.setItem('empresa_id', primeraEmpresa)
            }
            document.cookie = `empresa_activa=${primeraEmpresa}; path=/; max-age=86400; SameSite=Lax`
          }
        }
      } else {
        mostrarNotificacion('error', json.mensaje || 'Error al obtener empresas')
      }
    } catch (error) {
      console.error('Error al cargar empresas:', error)
      mostrarNotificacion('error', 'Error de red al cargar empresas')
    } finally {
      setLoadingEmpresas(false)
    }
  }, [empresaActiva, mostrarNotificacion])

  useEffect(() => {
    cargarEmpresas()
  }, [cargarEmpresas])

  const handleCambioEmpresa = (nuevaEmpresaId) => {
    setEmpresaSeleccionada(nuevaEmpresaId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('empresa_activa', nuevaEmpresaId)
      localStorage.setItem('empresa_id', nuevaEmpresaId)
    }
    document.cookie = `empresa_activa=${nuevaEmpresaId}; path=/; max-age=86400; SameSite=Lax`
    if (setEmpresaActiva) setEmpresaActiva(nuevaEmpresaId)
  }

  // Cargar Actividades Auxiliares y Actividades ABC de la empresa seleccionada
  const cargarDatosEmpresa = useCallback(async (empId) => {
    if (!empId) return
    setLoadingTabla(true)
    try {
      const resAux = await fetch(`/api/actividades_auxiliares?empresa_id=${empId}`)
      const jsonAux = await resAux.json()
      if (jsonAux.exito) {
        setActividades(jsonAux.datos || [])
      }

      const resAbc = await fetch(`/api/actividades_auxiliares?empresa_id=${empId}&accion=listar_actividades_abc`)
      const jsonAbc = await resAbc.json()
      if (jsonAbc.exito) {
        setActividadesAbc(jsonAbc.datos || [])
      }
    } catch (error) {
      console.error('Error al cargar datos:', error)
      mostrarNotificacion('error', 'Error de red al consultar datos de la empresa')
    } finally {
      setLoadingTabla(false)
    }
  }, [mostrarNotificacion])

  useEffect(() => {
    if (empresaSeleccionada) {
      cargarDatosEmpresa(empresaSeleccionada)
    } else {
      setActividades([])
      setActividadesAbc([])
    }
  }, [empresaSeleccionada, cargarDatosEmpresa])

  const mapaActividadesAbc = useMemo(() => {
    const map = new Map()
    actividadesAbc.forEach((item) => map.set(String(item.id), item))
    return map
  }, [actividadesAbc])

  const calcularCodigoAutomatico = (padreId, actividadesAuxList, abcList, excluirId = null) => {
    if (!padreId) {
      const raices = actividadesAuxList.filter(
        (item) => !item.actividad_padre_id && (!excluirId || item.id !== excluirId)
      )
      return `ACT-${String(raices.length + 1).padStart(3, '0')}`
    }

    const padreAbc = abcList.find((item) => String(item.id) === String(padreId))
    if (!padreAbc || !padreAbc.codigo) return ''

    const hijos = actividadesAuxList.filter(
      (item) =>
        String(item.actividad_padre_id) === String(padreId) &&
        (!excluirId || item.id !== excluirId)
    )

    const consecutivo = String(hijos.length + 1).padStart(3, '0')
    return `${padreAbc.codigo}-${consecutivo}`
  }

  const handleCambioPadre = (nuevoPadreId) => {
    setFormData((prev) => {
      const nuevoCodigo = calcularCodigoAutomatico(
        nuevoPadreId,
        actividades,
        actividadesAbc,
        modoEdicion ? actividadEditarId : null
      )
      return {
        ...prev,
        actividad_padre_id: nuevoPadreId,
        codigo: nuevoCodigo
      }
    })
    setErroresForm((prev) => ({ ...prev, codigo: null }))
  }

  const handleToggleEstado = async (item) => {
    const nuevoEstado = !(item.estado !== false)
    try {
      const res = await fetch('/api/actividades_auxiliares', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          codigo: item.codigo,
          nombre: item.nombre,
          actividad_padre_id: item.actividad_padre_id,
          descripcion: item.descripcion,
          unidad_medida: item.unidad_medida,
          estado: nuevoEstado
        })
      })

      const json = await res.json()
      if (json.exito) {
        mostrarNotificacion('exito', `Estado cambiado a ${nuevoEstado ? 'Activo' : 'Inactivo'}`)
        cargarDatosEmpresa(empresaSeleccionada)
      } else {
        mostrarNotificacion('error', json.mensaje || 'Error al actualizar el estado')
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      mostrarNotificacion('error', 'Error de red al actualizar el estado')
    }
  }

  const handleEliminar = async (item) => {
    const confirmacion = window.confirm(
      `¿Está seguro de eliminar la actividad auxiliar "${item.nombre}"?`
    )
    if (!confirmacion) return

    setEliminandoId(item.id)
    try {
      const res = await fetch(`/api/actividades_auxiliares?id=${item.id}&empresa_id=${empresaSeleccionada}`, {
        method: 'DELETE'
      })
      const json = await res.json()

      if (json.exito) {
        mostrarNotificacion('exito', 'Actividad eliminada correctamente')
        cargarDatosEmpresa(empresaSeleccionada)
      } else {
        mostrarNotificacion('error', json.mensaje || 'No se puede eliminar la actividad')
      }
    } catch (error) {
      console.error('Error al eliminar:', error)
      mostrarNotificacion('error', 'Error al procesar la eliminación')
    } finally {
      setEliminandoId(null)
    }
  }

  const abrirModalCrear = () => {
    setModoEdicion(false)
    setActividadEditarId(null)
    setErroresForm({})
    
    const codigoInicial = calcularCodigoAutomatico('', actividades, actividadesAbc, null)
    setFormData({
      actividad_padre_id: '',
      codigo: codigoInicial,
      nombre: '',
      descripcion: '',
      unidad_medida: '',
      estado: true
    })
    setModalAbierto(true)
  }

  const abrirModalEditar = (item) => {
    setModoEdicion(true)
    setActividadEditarId(item.id)
    setErroresForm({})
    setFormData({
      actividad_padre_id: item.actividad_padre_id ? String(item.actividad_padre_id) : '',
      codigo: item.codigo || '',
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      unidad_medida: item.unidad_medida || '',
      estado: item.estado !== false
    })
    setModalAbierto(true)
  }

  const validarFormulario = () => {
    const nuevosErrores = {}
    if (!formData.nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio'
    }
    if (!formData.codigo.trim()) {
      nuevosErrores.codigo = 'El código es obligatorio y no puede ser nulo'
    }
    setErroresForm(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validarFormulario()) return

    setGuardando(true)
    try {
      const method = modoEdicion ? 'PUT' : 'POST'
      const payload = {
        ...formData,
        empresa_id: empresaSeleccionada,
        id: modoEdicion ? actividadEditarId : undefined
      }

      const res = await fetch('/api/actividades_auxiliares', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()

      if (json.exito) {
        mostrarNotificacion(
          'exito',
          modoEdicion ? 'Actividad actualizada correctamente' : 'Actividad registrada con éxito'
        )
        cargarDatosEmpresa(empresaSeleccionada)
        setModalAbierto(false)
      } else {
        mostrarNotificacion('error', json.mensaje || 'Ocurrió un error al procesar')
      }
    } catch (error) {
      console.error('Error al guardar:', error)
      mostrarNotificacion('error', 'Error de servidor al guardar cambios')
    } finally {
      setGuardando(false)
    }
  }

  const actividadesFiltradas = useMemo(() => {
    return actividades.filter((item) => {
      const termino = filtroBusqueda.toLowerCase().trim()
      return (
        !termino ||
        (item.nombre && item.nombre.toLowerCase().includes(termino)) ||
        (item.codigo && item.codigo.toLowerCase().includes(termino)) ||
        (item.unidad_medida && item.unidad_medida.toLowerCase().includes(termino)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(termino))
      )
    })
  }, [actividades, filtroBusqueda])

  if (!isMounted || cargandoContexto) return <div className="p-12 text-center text-sm text-slate-500">Cargando módulo seguro...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen bg-slate-50/50">
      {notificacion.visible && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all transform animate-in fade-in slide-in-from-top-4 ${
            notificacion.tipo === 'exito'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : notificacion.tipo === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-sky-50 text-sky-800 border-sky-200'
          }`}
        >
          {notificacion.tipo === 'exito' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {notificacion.tipo === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
          {notificacion.tipo === 'info' && <Info className="w-5 h-5 text-sky-600" />}
          <span>{notificacion.mensaje}</span>
          <button
            onClick={() => setNotificacion((prev) => ({ ...prev, visible: false }))}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Actividades Auxiliares
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Gestión de actividades operativas y contables auxiliares
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={empresaSeleccionada}
              onChange={(e) => handleCambioEmpresa(e.target.value)}
              disabled={loadingEmpresas || empresas.length === 0}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer pr-2 disabled:opacity-60"
            >
              {loadingEmpresas ? (
                <option value="">Cargando empresas...</option>
              ) : empresas.length === 0 ? (
                <option value="">Sin empresas asignadas</option>
              ) : (
                empresas.map((emp) => {
                  const id = String(emp.id)
                  const nombre = emp.razon_social || emp.nombre_comercial
                  return (
                    <option key={id} value={id}>
                      {nombre}
                    </option>
                  )
                })
              )}
            </select>
          </div>

          <button
            onClick={() => {
              if (empresaSeleccionada) cargarDatosEmpresa(empresaSeleccionada)
            }}
            title="Recargar datos"
            className="p-2.5 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${loadingTabla ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={abrirModalCrear}
            disabled={!empresaSeleccionada || empresas.length === 0}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Nueva Actividad
          </button>
        </div>
      </div>

      {bloquearSelectores && (
        <div className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 p-3 rounded-xl">
          🔒 El selector de empresa se encuentra bloqueado automáticamente por contar con una única asignación autorizada.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, nombre, unidad de medida o descripción..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition shadow-sm"
          />
          {filtroBusqueda && (
            <button
              onClick={() => setFiltroBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loadingTabla ? (
          <div className="p-16 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Cargando actividades auxiliares...</p>
          </div>
        ) : actividadesFiltradas.length === 0 ? (
          <div className="p-16 text-center max-w-sm mx-auto">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              No hay actividades registradas
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              {filtroBusqueda
                ? 'No se encontraron resultados que coincidan con la búsqueda.'
                : 'Aún no se han agregado actividades auxiliares para esta empresa.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Nombre de la Actividad</th>
                  <th className="py-3.5 px-4">Actividad Padre (ABC)</th>
                  <th className="py-3.5 px-4">Unidad de Medida</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actividadesFiltradas.map((item) => {
                  const nombrePadreAbc = item.actividad_padre_id
                    ? mapaActividadesAbc.get(String(item.actividad_padre_id))?.nombre
                    : null
                  const estaActivo = item.estado !== false

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition group">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600 text-xs">
                        {item.codigo || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 text-xs">
                        {item.nombre}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {nombrePadreAbc ? (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-medium">
                            <Layers className="w-3 h-3" /> {nombrePadreAbc}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs font-medium">
                        {item.unidad_medida || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleEstado(item)}
                          title="Hacer clic para cambiar estado"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer hover:shadow-sm ${
                            estaActivo
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              estaActivo ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          ></span>
                          {estaActivo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirModalEditar(item)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Editar actividad"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEliminar(item)}
                            disabled={eliminandoId === item.id}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                            title="Eliminar actividad"
                          >
                            {eliminandoId === item.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loadingTabla && actividadesFiltradas.length > 0 && (
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200/80 text-xs text-slate-500 flex items-center justify-between">
            <span>
              Mostrando <strong>{actividadesFiltradas.length}</strong> de{' '}
              <strong>{actividades.length}</strong> actividades
            </span>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {modoEdicion ? 'Editar Actividad Auxiliar' : 'Nueva Actividad Auxiliar'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {modoEdicion
                      ? 'Modifica los datos de la actividad seleccionada'
                      : 'Registra una nueva actividad auxiliar para la empresa'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalAbierto(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-8">
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Actividad Padre (ABC) *
                  </label>
                  <select
                    value={formData.actividad_padre_id}
                    onChange={(e) => handleCambioPadre(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-indigo-500 transition cursor-pointer"
                  >
                    <option value="">-- Seleccionar Actividad ABC --</option>
                    {actividadesAbc.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.codigo ? `[${item.codigo}] ` : ''}{item.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    readOnly
                    placeholder="ABC-001-001"
                    className={`w-full px-2 py-2 text-center font-mono bg-slate-100 text-slate-700 border rounded-xl text-xs outline-none cursor-not-allowed ${
                      erroresForm.codigo ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                  {erroresForm.codigo && (
                    <p className="text-[10px] text-rose-500 mt-1">{erroresForm.codigo}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  Nombre de la Actividad *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                    setErroresForm((prev) => ({ ...prev, nombre: null }))
                  }}
                  placeholder="Ej. Actividad de Operación Comercial"
                  className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm outline-none focus:border-indigo-500 transition ${
                    erroresForm.nombre ? 'border-rose-400' : 'border-slate-200'
                  }`}
                />
                {erroresForm.nombre && (
                  <p className="text-xs text-rose-500 mt-1">{erroresForm.nombre}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  Descripción / Observación (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Notas adicionales..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Unidad de Medida (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.unidad_medida}
                    onChange={(e) => setFormData((prev) => ({ ...prev, unidad_medida: e.target.value }))}
                    placeholder="Ej. Unidades, Horas, %"
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Estado
                  </label>
                  <div className="flex items-center h-[38px]">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.estado}
                        onChange={(e) => setFormData((prev) => ({ ...prev, estado: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <Power className={`w-3.5 h-3.5 ${formData.estado ? 'text-emerald-600' : 'text-slate-400'}`} />
                        {formData.estado ? 'Activo' : 'Inactivo'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition"
                >
                  {guardando && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {modoEdicion ? 'Guardar Cambios' : 'Grabar Actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}