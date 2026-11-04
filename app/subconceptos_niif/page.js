'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Info,
  X,
  FileText,
  Copy,
  FolderKanban
} from 'lucide-react'

export default function SubconceptosNiifPage() {
  const [isMounted, setIsMounted] = useState(false)

  // Estados principales
  const [empresas, setEmpresas] = useState([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [conceptosPadre, setConceptosPadre] = useState([])
  const [subconceptos, setSubconceptos] = useState([])

  // Estados de carga e interfaz
  const [loadingEmpresas, setLoadingEmpresas] = useState(true)
  const [loadingPadres, setLoadingPadres] = useState(false)
  const [loadingTabla, setLoadingTabla] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminatingId] = useState(null)
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState(null)

  // Filtros
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [filtroPadre, setFiltroPadre] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  // Modales
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [subconceptoEditarId, setSubconceptoEditarId] = useState(null)

  const [modalCopiaAbierto, setModalCopiaAbierto] = useState(false)
  const [empresasDestino, setEmpresasDestino] = useState([])
  const [copiando, setCopiando] = useState(false)

  // Notificaciones
  const [notificacion, setNotificacion] = useState({
    visible: false,
    tipo: 'exito',
    mensaje: ''
  })

  // Formulario
  const [formData, setFormData] = useState({
    concepto_niif_id: '',
    codigo: '',
    nombre: '',
    descripcion: '',
    elemento: '',
    activo: true
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

  const cargarEmpresas = useCallback(async () => {
    setLoadingEmpresas(true)
    try {
      const res = await fetch('/api/subconceptos_niif?accion=listar_empresas')
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)

      const json = await res.json()
      if (json.exito) {
        const listaEmpresas = json.datos || []
        setEmpresas(listaEmpresas)
        if (listaEmpresas.length > 0) {
          setEmpresaSeleccionada(String(listaEmpresas[0].id))
        }
      } else {
        mostrarNotificacion('error', json.mensaje || 'Error al obtener empresas')
      }
    } catch (error) {
      console.error('Error al cargar empresas:', error)
      mostrarNotificacion('error', 'Error de conexión al cargar empresas')
    } finally {
      setLoadingEmpresas(false)
    }
  }, [mostrarNotificacion])

  const cargarConceptosPadre = useCallback(async (empId) => {
    if (!empId) return
    setLoadingPadres(true)
    try {
      const res = await fetch(
        `/api/subconceptos_niif?accion=conceptos_niif_por_empresa&empresa_id=${empId}`
      )
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)

      const json = await res.json()
      if (json.exito) {
        setConceptosPadre(json.datos || [])
      } else {
        mostrarNotificacion('error', json.mensaje || 'Error al consultar conceptos padres')
      }
    } catch (error) {
      console.error('Error al cargar conceptos padre:', error)
      mostrarNotificacion('error', 'Error al consultar conceptos NIIF padres')
    } finally {
      setLoadingPadres(false)
    }
  }, [mostrarNotificacion])

  const cargarSubconceptos = useCallback(async (empId) => {
    if (!empId) return
    setLoadingTabla(true)
    try {
      const res = await fetch(`/api/subconceptos_niif?empresa_id=${empId}`)
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)

      const json = await res.json()
      if (json.exito) {
        setSubconceptos(json.datos || [])
      } else {
        mostrarNotificacion('error', json.mensaje || 'Error al cargar subconceptos')
      }
    } catch (error) {
      console.error('Error al cargar subconceptos:', error)
      mostrarNotificacion('error', 'Error de red al consultar subconceptos')
    } finally {
      setLoadingTabla(false)
    }
  }, [mostrarNotificacion])

  useEffect(() => {
    cargarEmpresas()
  }, [cargarEmpresas])

  useEffect(() => {
    if (empresaSeleccionada) {
      cargarConceptosPadre(empresaSeleccionada)
      cargarSubconceptos(empresaSeleccionada)
    } else {
      setConceptosPadre([])
      setSubconceptos([])
    }
  }, [empresaSeleccionada, cargarConceptosPadre, cargarSubconceptos])

  const obtenerSiguienteCodigo = async (conceptoPadreId) => {
    if (!conceptoPadreId) return
    try {
      const res = await fetch(
        `/api/subconceptos_niif?accion=siguiente_codigo&concepto_niif_id=${conceptoPadreId}`
      )
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)

      const json = await res.json()
      if (json.exito && json.siguiente_codigo) {
        setFormData((prev) => ({ ...prev, codigo: json.siguiente_codigo }))
      } else {
        mostrarNotificacion('info', 'No se pudo generar un código automático, ingréselo manualmente.')
      }
    } catch (error) {
      console.error('Error al obtener código sugerido:', error)
      mostrarNotificacion('error', 'Error de red al solicitar el código sugerido')
    }
  }

  const handleCambiarEstado = async (item, nuevoEstado) => {
    if (Boolean(item.activo) === nuevoEstado) return

    setCambiandoEstadoId(item.id)
    try {
      const payload = {
        id: item.id,
        empresa_id: empresaSeleccionada,
        concepto_niif_id: item.concepto_niif_id,
        codigo: item.codigo,
        nombre: item.nombre,
        descripcion: item.descripcion || '',
        activo: nuevoEstado
      }

      const res = await fetch('/api/subconceptos_niif', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()

      if (json.exito) {
        mostrarNotificacion('exito', `Estado actualizado a ${nuevoEstado ? 'Activo' : 'Inactivo'}`)
        cargarSubconceptos(empresaSeleccionada)
      } else {
        mostrarNotificacion('error', json.mensaje || 'No se pudo actualizar el estado')
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      mostrarNotificacion('error', 'Error al procesar el cambio de estado')
    } finally {
      setCambiandoEstadoId(null)
    }
  }

  const handleEliminarSubconcepto = async (item) => {
    const confirmacion = window.confirm(
      `¿Está seguro de eliminar el subconcepto "${item.nombre}" (${item.codigo})?`
    )
    if (!confirmacion) return

    setEliminatingId(item.id)
    try {
      const res = await fetch(`/api/subconceptos_niif?id=${item.id}`, {
        method: 'DELETE'
      })
      const json = await res.json()

      if (json.exito) {
        mostrarNotificacion('exito', 'Subconcepto eliminado correctamente')
        cargarSubconceptos(empresaSeleccionada)
      } else {
        mostrarNotificacion('error', json.mensaje || 'No se puede eliminar el subconcepto')
      }
    } catch (error) {
      console.error('Error al eliminar subconcepto:', error)
      mostrarNotificacion('error', 'Error al procesar la eliminación')
    } finally {
      setEliminatingId(null)
    }
  }

  const obtenerElementoTexto = (c) => {
    return (
      c.elemento ||
      c.clasificacion_elemento ||
      c.tipo_elemento ||
      c.naturaleza ||
      c.conceptos_niif?.elemento ||
      c.elemento_niif ||
      ''
    )
  }

  const handleConceptoPadreChange = (conceptoId) => {
    const padreSeleccionado = conceptosPadre.find((c) => String(c.id) === String(conceptoId))
    const elementoPadre = padreSeleccionado ? obtenerElementoTexto(padreSeleccionado) : ''

    setFormData((prev) => ({
      ...prev,
      concepto_niif_id: conceptoId,
      codigo: '',
      elemento: elementoPadre
    }))
    setErroresForm((prev) => ({ ...prev, concepto_niif_id: null, codigo: null }))
    if (conceptoId) {
      obtenerSiguienteCodigo(conceptoId)
    }
  }

  const abrirModalCrear = () => {
    setModoEdicion(false)
    setSubconceptoEditarId(null)
    setErroresForm({})

    const primerPadreId = conceptosPadre.length > 0 ? String(conceptosPadre[0].id) : ''
    const primerPadre = conceptosPadre.length > 0 ? conceptosPadre[0] : null
    const elementoInicial = primerPadre ? obtenerElementoTexto(primerPadre) : ''

    setFormData({
      concepto_niif_id: primerPadreId,
      codigo: '',
      nombre: '',
      descripcion: '',
      elemento: elementoInicial,
      activo: true
    })

    if (primerPadreId) {
      obtenerSiguienteCodigo(primerPadreId)
    }

    setModalAbierto(true)
  }

  const abrirModalEditar = (item) => {
    setModoEdicion(true)
    setSubconceptoEditarId(item.id)
    setErroresForm({})

    setFormData({
      concepto_niif_id: item.concepto_niif_id ? String(item.concepto_niif_id) : '',
      codigo: item.codigo || '',
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      elemento: item.elemento || '',
      activo: Boolean(item.activo)
    })

    setModalAbierto(true)
  }

  const validarFormulario = () => {
    const nuevosErrores = {}

    if (!formData.concepto_niif_id) {
      nuevosErrores.concepto_niif_id = 'Seleccione un concepto NIIF padre'
    }

    if (!formData.codigo.trim()) {
      nuevosErrores.codigo = 'Código no disponible'
    }

    if (!formData.nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio'
    } else if (formData.nombre.trim().length < 3) {
      nuevosErrores.nombre = 'Mínimo 3 caracteres'
    }

    setErroresForm(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validarFormulario()) return

    setGuardando(true)

    try {
      const url = '/api/subconceptos_niif'
      const method = modoEdicion ? 'PUT' : 'POST'

      const payload = {
        ...formData,
        activo: modoEdicion ? formData.activo : true,
        empresa_id: empresaSeleccionada,
        id: modoEdicion ? subconceptoEditarId : undefined
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()

      if (json.exito) {
        mostrarNotificacion(
          'exito',
          modoEdicion
            ? 'Subconcepto actualizado correctamente'
            : 'Subconcepto registrado con éxito'
        )

        cargarSubconceptos(empresaSeleccionada)

        if (modoEdicion) {
          setModalAbierto(false)
        } else {
          const padreActual = formData.concepto_niif_id
          const padreActualObj = conceptosPadre.find((c) => String(c.id) === String(padreActual))
          setFormData((prev) => ({
            ...prev,
            nombre: '',
            descripcion: '',
            codigo: '',
            elemento: padreActualObj ? obtenerElementoTexto(padreActualObj) : '',
            activo: true
          }))
          setErroresForm({})
          await obtenerSiguienteCodigo(padreActual)
        }
      } else {
        mostrarNotificacion('error', json.mensaje || 'Ocurrió un error al procesar la solicitud')
      }
    } catch (error) {
      console.error('Error al guardar subconcepto:', error)
      mostrarNotificacion('error', 'Error de servidor al guardar cambios')
    } finally {
      setGuardando(false)
    }
  }

  const abrirModalCopia = () => {
    if (!empresaSeleccionada) {
      mostrarNotificacion('info', 'Seleccione una empresa de origen primero')
      return
    }
    setEmpresasDestino([])
    setModalCopiaAbierto(true)
  }

  const toggleEmpresaDestino = (idStr) => {
    setEmpresasDestino((prev) =>
      prev.includes(idStr) ? prev.filter((item) => item !== idStr) : [...prev, idStr]
    )
  }

  const handleCopiarASubconceptos = async () => {
    if (empresasDestino.length === 0) {
      mostrarNotificacion('info', 'Debe seleccionar al menos una empresa destino')
      return
    }

    setCopiando(true)
    try {
      const res = await fetch('/api/subconceptos_niif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'copiar_a_empresas',
          empresa_origen_id: empresaSeleccionada,
          empresas_destino_ids: empresasDestino
        })
      })

      const json = await res.json()

      if (json.exito) {
        mostrarNotificacion('exito', json.mensaje || 'Copia realizada con éxito')
        setModalCopiaAbierto(false)
      } else {
        mostrarNotificacion('error', json.mensaje || 'Ocurrió un error durante la copia')
      }
    } catch (error) {
      console.error('Error al copiar subconceptos:', error)
      mostrarNotificacion('error', 'Error de conexión al procesar la copia')
    } finally {
      setCopiando(false)
    }
  }

  const subconceptosFiltrados = useMemo(() => {
    return subconceptos.filter((item) => {
      const termino = filtroBusqueda.toLowerCase().trim()
      const coincideTexto =
        !termino ||
        (item.nombre && item.nombre.toLowerCase().includes(termino)) ||
        (item.codigo && item.codigo.toLowerCase().includes(termino)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(termino))

      const coincidePadre = filtroPadre
        ? String(item.concepto_niif_id) === String(filtroPadre)
        : true

      const esActivo = Boolean(item.activo)
      const coincideEstado =
        filtroEstado === 'todos'
          ? true
          : filtroEstado === 'activos'
          ? esActivo
          : !esActivo

      return coincideTexto && coincidePadre && coincideEstado
    })
  }, [subconceptos, filtroBusqueda, filtroPadre, filtroEstado])

  const subconceptosAgrupadosPorPadre = useMemo(() => {
    const grupos = {}
    subconceptosFiltrados.forEach((item) => {
      const padreId = item.concepto_niif_id || 'sin_padre'
      const padreNombre = item.conceptos_niif?.nombre || 'Concepto no especificado'
      const padreCodigo = item.conceptos_niif?.codigo_concepto || ''

      if (!grupos[padreId]) {
        grupos[padreId] = {
          padreId,
          padreCodigo,
          padreNombre,
          items: []
        }
      }
      grupos[padreId].items.push(item)
    })
    return Object.values(grupos)
  }, [subconceptosFiltrados])

  const conceptosPadreAgrupadosPorElemento = useMemo(() => {
    const grupos = {}
    conceptosPadre.forEach((c) => {
      const elemento = obtenerElementoTexto(c) || 'GENERAL / OTROS'
      if (!grupos[elemento]) {
        grupos[elemento] = []
      }
      grupos[elemento].push(c)
    })
    return grupos
  }, [conceptosPadre])

  if (!isMounted) {
    return null
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 bg-slate-50/50 min-h-screen text-xs md:text-sm">
      {/* NOTIFICACIÓN FLOTANTE */}
      {notificacion.visible && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl shadow-lg border text-xs font-medium transition-all transform animate-in fade-in slide-in-from-top-4 ${
            notificacion.tipo === 'exito'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : notificacion.tipo === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-sky-50 text-sky-800 border-sky-200'
          }`}
        >
          {notificacion.tipo === 'exito' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          {notificacion.tipo === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
          {notificacion.tipo === 'info' && <Info className="w-4 h-4 text-sky-600" />}
          <span>{notificacion.mensaje}</span>
          <button
            onClick={() => setNotificacion((prev) => ({ ...prev, visible: false }))}
            className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ENCABEZADO Y SELECTOR DE EMPRESA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              Subconceptos NIIF
            </h1>
            <p className="text-[11px] text-slate-500">
              Configuración y detalle de subcuentas contables
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={empresaSeleccionada}
              onChange={(e) => setEmpresaSeleccionada(e.target.value)}
              disabled={loadingEmpresas}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1"
            >
              {loadingEmpresas ? (
                <option value="">Cargando empresas...</option>
              ) : (
                empresas.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.razon_social || emp.nombre_comercial}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={() => {
              if (empresaSeleccionada) {
                cargarConceptosPadre(empresaSeleccionada)
                cargarSubconceptos(empresaSeleccionada)
              }
            }}
            title="Recargar datos"
            className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTabla ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={abrirModalCopia}
            disabled={!empresaSeleccionada || subconceptos.length === 0}
            title="Copiar subconceptos a otras empresas"
            className="px-3 py-2 text-slate-700 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copiar a Empresas</span>
          </button>

          <button
            onClick={abrirModalCrear}
            disabled={conceptosPadre.length === 0 || loadingPadres}
            className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Subconcepto
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        <div className="relative md:col-span-2">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, nombre o descripción..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition shadow-sm"
          />
          {filtroBusqueda && (
            <button
              onClick={() => setFiltroBusqueda('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={filtroPadre}
            onChange={(e) => setFiltroPadre(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer"
          >
            <option value="">Todos los conceptos padres</option>
            {conceptosPadre.map((c) => {
              const elem = obtenerElementoTexto(c)
              return (
                <option key={c.id} value={String(c.id)}>
                  {c.codigo_concepto} - {c.nombre} {elem ? `[${elem}]` : ''}
                </option>
              )
            })}
          </select>
        </div>

        <div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer"
          >
            <option value="todos">Todos los estados</option>
            <option value="activos">Solo Activos</option>
            <option value="inactivos">Solo Inactivos</option>
          </select>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL BASADO EN TARJETAS AGRUPADAS */}
      <div className="space-y-4">
        {loadingTabla ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">Cargando subconceptos NIIF...</p>
          </div>
        ) : subconceptosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-sm mx-auto">
            <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 mb-0.5">
              No hay subconceptos registrados
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {filtroBusqueda || filtroPadre || filtroEstado !== 'todos'
                ? 'No se encontraron resultados que coincidan con los filtros.'
                : 'Aún no se han agregado subconceptos para esta empresa.'}
            </p>
          </div>
        ) : (
          subconceptosAgrupadosPorPadre.map((grupo) => (
            <div key={grupo.padreId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <FolderKanban className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-600 uppercase">Concepto Padre:</span>
                  <span className="font-mono font-bold text-indigo-700 text-xs shrink-0">{grupo.padreCodigo}</span>
                  <span className="text-slate-400">-</span>
                  <span className="font-bold text-slate-800 text-xs truncate">{grupo.padreNombre}</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shrink-0 ml-2 shadow-2xs">
                  {grupo.items.length} subconcepto(s)
                </span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="grid grid-cols-12 bg-slate-50/70 px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <div className="col-span-2">Código</div>
                  <div className="col-span-4">Nombre Subconcepto</div>
                  <div className="col-span-4">Descripción</div>
                  <div className="col-span-1 text-center">Estado</div>
                  <div className="col-span-1 text-right">Acciones</div>
                </div>

                {grupo.items.map((item) => {
                  const estaActivo = Boolean(item.activo)
                  return (
                    <div key={item.id} className="grid grid-cols-12 items-center px-4 py-2 hover:bg-slate-50/80 transition">
                      <div className="col-span-2 font-mono font-bold text-indigo-600 text-xs truncate pr-2">
                        {item.codigo}
                      </div>
                      <div className="col-span-4 font-semibold text-slate-800 truncate pr-2">
                        {item.nombre}
                      </div>
                      <div className="col-span-4 text-slate-500 text-[11px] truncate pr-2">
                        {item.descripcion || <span className="text-slate-300">Sin descripción</span>}
                      </div>
                      <div className="col-span-1 text-center">
                        {cambiandoEstadoId === item.id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                            <RefreshCw className="w-3 h-3 animate-spin" /> ...
                          </span>
                        ) : (
                          <select
                            value={estaActivo ? 'true' : 'false'}
                            onChange={(e) =>
                              handleCambiarEstado(item, e.target.value === 'true')
                            }
                            className={`cursor-pointer text-[10px] font-semibold px-2 py-0.5 rounded-full border outline-none transition ${
                              estaActivo
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            <option value="true">Activo</option>
                            <option value="false">Inactivo</option>
                          </select>
                        )}
                      </div>
                      <div className="col-span-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirModalEditar(item)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEliminarSubconcepto(item)}
                            disabled={eliminandoId === item.id}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition disabled:opacity-50 cursor-pointer"
                            title="Eliminar"
                          >
                            {eliminandoId === item.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {!loadingTabla && subconceptosFiltrados.length > 0 && (
          <div className="px-4 py-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between shadow-2xs">
            <span>
              Mostrando <strong>{subconceptosFiltrados.length}</strong> de{' '}
              <strong>{subconceptos.length}</strong> subconceptos en total.
            </span>
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR SUBCONCEPTOS */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full p-5 space-y-3.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs md:text-sm font-bold text-slate-800">
                    {modoEdicion ? 'Editar Subconcepto NIIF' : 'Nuevo Subconcepto NIIF'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {modoEdicion
                      ? 'Modifica los datos del subconcepto seleccionado'
                      : 'Crea subconceptos de forma continua'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalAbierto(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Concepto NIIF Padre *
                  </label>
                  <select
                    value={formData.concepto_niif_id}
                    onChange={(e) => handleConceptoPadreChange(e.target.value)}
                    disabled={modoEdicion}
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 transition cursor-pointer ${
                      modoEdicion ? 'bg-slate-100 cursor-not-allowed opacity-80' : ''
                    } ${erroresForm.concepto_niif_id ? 'border-rose-400' : 'border-slate-200'}`}
                  >
                    <option value="">Seleccione un concepto...</option>
                    {Object.entries(conceptosPadreAgrupadosPorElemento).map(([elementoGrupo, listaPadres]) => (
                      <optgroup key={elementoGrupo} label={`── ${elementoGrupo.toUpperCase()} ──`}>
                        {listaPadres.map((c) => {
                          const elem = obtenerElementoTexto(c)
                          return (
                            <option key={c.id} value={String(c.id)}>
                              {c.codigo_concepto} - {c.nombre} {elem ? `[${elem}]` : ''}
                            </option>
                          )
                        })}
                      </optgroup>
                    ))}
                  </select>
                  {erroresForm.concepto_niif_id && (
                    <p className="text-[10px] text-rose-500 mt-0.5">{erroresForm.concepto_niif_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, codigo: e.target.value }))
                      setErroresForm((prev) => ({ ...prev, codigo: null }))
                    }}
                    placeholder="Generando..."
                    className="w-full px-2.5 py-1.5 font-mono font-bold text-center text-indigo-600 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition"
                  />
                  {erroresForm.codigo && (
                    <p className="text-[10px] text-rose-500 mt-0.5">{erroresForm.codigo}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  Nombre del Subconcepto *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                    setErroresForm((prev) => ({ ...prev, nombre: null }))
                  }}
                  placeholder="Ingrese el nombre descriptivo"
                  className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs outline-none focus:border-indigo-500 transition ${
                    erroresForm.nombre ? 'border-rose-400' : 'border-slate-200'
                  }`}
                />
                {erroresForm.nombre && (
                  <p className="text-[10px] text-rose-500 mt-0.5">{erroresForm.nombre}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
                  }
                  placeholder="Notas adicionales..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <span className="text-[10px] text-slate-400">
                  {!modoEdicion && 'El formulario permanecerá abierto para agilizar.'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModalAbierto(false)}
                    disabled={guardando}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    {modoEdicion ? 'Cancelar' : 'Cerrar'}
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    {guardando && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {modoEdicion ? 'Guardar Cambios' : 'Grabar Subconcepto'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL COPIAR SUBCONCEPTOS */}
      {modalCopiaAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-3.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs md:text-sm font-bold text-slate-800">
                    Copiar Subconceptos a Otras Empresas
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Sincronice la estructura actual
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalCopiaAbierto(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Seleccione las empresas de destino hacia las cuales desea copiar:
              </p>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50 p-1.5 space-y-1">
                {empresas
                  .filter((emp) => String(emp.id) !== empresaSeleccionada)
                  .map((emp) => {
                    const empIdStr = String(emp.id)
                    const checked = empresasDestino.includes(empIdStr)
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition select-none ${
                          checked
                            ? 'bg-indigo-50/60 border-indigo-200 text-indigo-900'
                            : 'bg-white border-transparent hover:border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEmpresaDestino(empIdStr)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">
                            {emp.razon_social || emp.nombre_comercial}
                          </span>
                          {emp.nit && (
                            <span className="text-[10px] text-slate-400">NIT: {emp.nit}</span>
                          )}
                        </div>
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
              <span className="text-[10px] text-slate-400">
                {empresasDestino.length} empresa(s) seleccionada(s)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setModalCopiaAbierto(false)}
                  disabled={copiando}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCopiarASubconceptos}
                  disabled={copiando || empresasDestino.length === 0}
                  className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  {copiando && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Procesar Copia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}