'use client'

import React, { useState, useEffect, useMemo, useCallback, FormEvent } from 'react'
import {
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Search,
  RefreshCw,
  Trash2,
  Info,
  X,
  FileText,
  Tag,
  FolderKanban,
  Filter
} from 'lucide-react'

// Interfaces corporativas estrictas
interface Empresa {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
}

interface SubconceptoNiif {
  id: number | string;
  codigo: string;
  nombre: string;
  elemento?: string;
  clasificacion_elemento?: string;
  tipo_elemento?: string;
  naturaleza?: string;
  elemento_niif?: string;
}

interface ConceptoAuxiliar {
  id: number | string;
  empresa_id: number | string;
  subconcepto_niif_id: number | string;
  codigo_auxiliar: string;
  nombre: string;
  tipo_entidad: string;
  descripcion?: string;
  estado: 'Activo' | 'Inactivo';
  elemento?: string;
  elemento_niif?: string;
  codigo_subconcepto_niif?: string;
  nombre_subconcepto_niif?: string;
  codigo_concepto_niif?: string;
  nombre_concepto_niif?: string;
}

interface TipoAuxiliarOption {
  valor: string;
  etiqueta: string;
}

const OPCIONES_TIPO_AUXILIAR: TipoAuxiliarOption[] = [
  { valor: 'Auxiliar_General', etiqueta: 'Auxiliar General' },
  { valor: 'Cuentas_Bancarias', etiqueta: 'Cuentas Bancarias' },
  { valor: 'Cuentas_Caja', etiqueta: 'Cuentas de Caja' },
  { valor: 'Cuentas_Proveedor', etiqueta: 'Cuentas de Proveedor' },
  { valor: 'Cuentas_Clientes', etiqueta: 'Cuentas de Clientes' },
  { valor: 'Cuentas_Inventario', etiqueta: 'Cuentas de Inventario' },
  { valor: 'Cuentas_Acreedores', etiqueta: 'Cuentas de Acreedores' },
  { valor: 'Cuentas_Gastos', etiqueta: 'Cuentas de Gastos' },
  { valor: 'Cuentas_Costos', etiqueta: 'Cuentas de Costos' },
  { valor: 'Cuentas_Ingresos', etiqueta: 'Cuentas de Ingresos' },
  { valor: 'Cuentas_Patrimonio', etiqueta: 'Cuentas de Patrimonio' },
  { valor: 'Cuentas_Activos_Fijos', etiqueta: 'Cuentas de Activos Fijos' }
]

export default function ConceptosAuxiliaresPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<string>('')
  const [conceptos, setConceptos] = useState<ConceptoAuxiliar[]>([])
  const [subconceptosNiif, setSubconceptosNiif] = useState<SubconceptoNiif[]>([])

  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true)
  const [loadingTabla, setLoadingTabla] = useState<boolean>(false)
  const [loadingNiif, setLoadingNiif] = useState<boolean>(false)
  const [guardando, setGuardando] = useState<boolean>(false)
  const [eliminandoId, setEliminandoId] = useState<number | string | null>(null)

  // Filtros avanzados
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>('')
  const [filtroSubconcepto, setFiltroSubconcepto] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  const [modalAbierto, setModalAbierto] = useState<boolean>(false)
  const [modoEdicion, setModoEdicion] = useState<boolean>(false)
  const [conceptoEditarId, setConceptoEditarId] = useState<number | string | null>(null)

  // Mensaje de éxito específico para inserciones continuas en el modal
  const [ultimoCreado, setUltimoCreado] = useState<{ codigo: string; nombre: string } | null>(null)

  const [notificacion, setNotificacion] = useState<{
    visible: boolean;
    tipo: 'exito' | 'error' | 'info';
    mensaje: string;
  }>({
    visible: false,
    tipo: 'exito',
    mensaje: ''
  })

  const [formData, setFormData] = useState<{
    subconcepto_niif_id: string;
    codigo_auxiliar: string;
    nombre: string;
    tipo_entidad: string;
    descripcion: string;
    estado: 'Activo' | 'Inactivo';
    elemento: string;
  }>({
    subconcepto_niif_id: '',
    codigo_auxiliar: '',
    nombre: '',
    tipo_entidad: 'Auxiliar_General',
    descripcion: '',
    estado: 'Activo',
    elemento: ''
  })

  const [erroresForm, setErroresForm] = useState<{ [key: string]: string | null }>({})

  const mostrarNotificacion = useCallback((tipo: 'exito' | 'error' | 'info', mensaje: string) => {
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
      const res = await fetch('/api/conceptos_auxiliares?accion=listar_empresas')
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)

      const json = await res.json()
      if (json.exito) {
        const listaEmpresas: Empresa[] = json.datos || []
        setEmpresas(listaEmpresas)
        if (listaEmpresas.length > 0) {
          // Leer la empresa activa de cookies o localStorage corporativo
          const cookieEmpresa = document.cookie
            .split('; ')
            .find((row) => row.startsWith('empresa_activa='))
          const empresaGuardadaCookie = cookieEmpresa ? cookieEmpresa.split('=')[1] : null
          const empresaGuardadaLocal = localStorage.getItem('empresa_activa')
          
          const empresaIdParaSeleccionar = empresaGuardadaCookie || empresaGuardadaLocal
          const existeEmpresa = listaEmpresas.some((emp) => String(emp.id) === String(empresaIdParaSeleccionar))

          if (existeEmpresa && empresaIdParaSeleccionar) {
            setEmpresaSeleccionada(String(empresaIdParaSeleccionar))
          } else {
            setEmpresaSeleccionada(String(listaEmpresas[0].id))
          }
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

  // Persistir cambios de empresaSeleccionada en cookies y localStorage
  useEffect(() => {
    if (empresaSeleccionada) {
      localStorage.setItem('empresa_activa', String(empresaSeleccionada))
      document.cookie = `empresa_activa=${empresaSeleccionada}; path=/; max-age=86400; SameSite=Lax`
    }
  }, [empresaSeleccionada])

  const cargarSubconceptosNiif = useCallback(async (empId: string) => {
    if (!empId) return
    setLoadingNiif(true)
    try {
      const res = await fetch(`/api/conceptos_auxiliares?accion=listar_subconceptos_niif&empresa_id=${empId}`)
      const json = await res.json()
      if (json.exito) {
        setSubconceptosNiif(json.datos || [])
      } else {
        setSubconceptosNiif([])
      }
    } catch (error) {
      console.error('Error al cargar subconceptos NIIF:', error)
      mostrarNotificacion('error', 'Error al cargar los Subconceptos NIIF')
    } finally {
      setLoadingNiif(false)
    }
  }, [mostrarNotificacion])

  const cargarDatosEmpresa = useCallback(async (empId: string) => {
    if (!empId) return
    setLoadingTabla(true)
    try {
      const resConc = await fetch(`/api/conceptos_auxiliares?empresa_id=${empId}`)
      const jsonConc = await resConc.json()
      if (jsonConc.exito) {
        setConceptos(jsonConc.datos || [])
      } else {
        setConceptos([])
      }
    } catch (error) {
      console.error('Error al cargar datos:', error)
      mostrarNotificacion('error', 'Error de red al consultar datos de la empresa')
    } finally {
      setLoadingTabla(false)
    }
  }, [mostrarNotificacion])

  useEffect(() => {
    cargarEmpresas()
  }, [cargarEmpresas])

  useEffect(() => {
    if (empresaSeleccionada) {
      cargarDatosEmpresa(empresaSeleccionada)
      cargarSubconceptosNiif(empresaSeleccionada)
    } else {
      setConceptos([])
      setSubconceptosNiif([])
    }
  }, [empresaSeleccionada, cargarDatosEmpresa, cargarSubconceptosNiif])

  const obtenerElementoTexto = (c: any): string => {
    return (
      c.elemento ||
      c.clasificacion_elemento ||
      c.tipo_elemento ||
      c.naturaleza ||
      c.elemento_niif ||
      ''
    )
  }

  const subconceptosNiifAgrupadosPorElemento = useMemo(() => {
    const grupos: { [key: string]: SubconceptoNiif[] } = {}
    subconceptosNiif.forEach((n) => {
      const elemento = obtenerElementoTexto(n) || 'GENERAL / OTROS'
      if (!grupos[elemento]) {
        grupos[elemento] = []
      }
      grupos[elemento].push(n)
    })
    return grupos
  }, [subconceptosNiif])

  const handleCambioSubconceptoNiif = (niifId: string) => {
    setErroresForm((prev) => ({ ...prev, subconcepto_niif_id: null }))

    if (!niifId) {
      setFormData((prev) => ({ ...prev, subconcepto_niif_id: '', codigo_auxiliar: '', elemento: '' }))
      return
    }

    const niifPadre = subconceptosNiif.find((item) => String(item.id) === String(niifId))

    if (niifPadre) {
      const elementoNiifPadre = obtenerElementoTexto(niifPadre)
      const creadosDelPadre = conceptos.filter((c) => String(c.subconcepto_niif_id) === String(niifId))
      
      let maxNum = 0
      creadosDelPadre.forEach((item) => {
        if (item.codigo_auxiliar) {
          const partes = item.codigo_auxiliar.split('-')
          const num = parseInt(partes[partes.length - 1], 10)
          if (!isNaN(num) && num > maxNum) {
            maxNum = num
          }
        }
      })

      const consecutivo = String(maxNum + 1).padStart(3, '0')
      const codigoAuto = `${niifPadre.codigo}-${consecutivo}`

      setFormData((prev) => ({
        ...prev,
        subconcepto_niif_id: String(niifId),
        codigo_auxiliar: codigoAuto,
        elemento: elementoNiifPadre
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        subconcepto_niif_id: String(niifId),
        codigo_auxiliar: '',
        elemento: ''
      }))
    }
  }

  const handleToggleEstado = async (item: ConceptoAuxiliar) => {
    const nuevoEstado = item.estado === 'Activo' ? 'Inactivo' : 'Activo'

    try {
      const res = await fetch('/api/conceptos_auxiliares', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          estado: nuevoEstado
        })
      })

      const json = await res.json()
      if (json.exito) {
        mostrarNotificacion('exito', `Estado cambiado a ${nuevoEstado}`)
        cargarDatosEmpresa(empresaSeleccionada)
      } else {
        mostrarNotificacion('error', json.mensaje || 'Error al actualizar el estado')
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      mostrarNotificacion('error', 'Error de red al actualizar el estado')
    }
  }

  const handleEliminar = async (item: ConceptoAuxiliar) => {
    const confirmacion = window.confirm(
      `¿Está seguro de eliminar el concepto auxiliar "${item.nombre}"?`
    )
    if (!confirmacion) return

    setEliminandoId(item.id)
    try {
      const res = await fetch(`/api/conceptos_auxiliares?id=${item.id}`, {
        method: 'DELETE'
      })
      const json = await res.json()

      if (json.exito) {
        mostrarNotificacion('exito', 'Concepto auxiliar eliminado correctamente')
        cargarDatosEmpresa(empresaSeleccionada)
      } else {
        mostrarNotificacion('error', json.mensaje || 'No se puede eliminar el concepto')
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
    setConceptoEditarId(null)
    setUltimoCreado(null)
    setErroresForm({})
    setFormData({
      subconcepto_niif_id: '',
      codigo_auxiliar: '',
      nombre: '',
      tipo_entidad: 'Auxiliar_General',
      descripcion: '',
      estado: 'Activo',
      elemento: ''
    })
    setModalAbierto(true)
  }

  const abrirModalEditar = (item: ConceptoAuxiliar) => {
    setModoEdicion(true)
    setConceptoEditarId(item.id)
    setUltimoCreado(null)
    setErroresForm({})

    setFormData({
      subconcepto_niif_id: item.subconcepto_niif_id ? String(item.subconcepto_niif_id) : '',
      codigo_auxiliar: item.codigo_auxiliar || '',
      nombre: item.nombre || '',
      tipo_entidad: item.tipo_entidad || 'Auxiliar_General',
      descripcion: item.descripcion || '',
      estado: item.estado || 'Activo',
      elemento: item.elemento || item.elemento_niif || ''
    })
    setModalAbierto(true)
  }

  const validarFormulario = (): boolean => {
    const nuevosErrores: { [key: string]: string } = {}

    if (!formData.subconcepto_niif_id) {
      nuevosErrores.subconcepto_niif_id = 'Debe seleccionar un Subconcepto NIIF'
    }
    if (!formData.nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio'
    }
    if (!formData.tipo_entidad) {
      nuevosErrores.tipo_entidad = 'Seleccione un Tipo de Auxiliar'
    }

    setErroresForm(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validarFormulario()) return

    setGuardando(true)
    try {
      const method = modoEdicion ? 'PUT' : 'POST'

      const payload = {
        ...formData,
        empresa_id: empresaSeleccionada,
        id: modoEdicion ? conceptoEditarId : undefined,
        estado: modoEdicion ? formData.estado : 'Activo'
      }

      const res = await fetch('/api/conceptos_auxiliares', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()

      if (json.exito) {
        if (modoEdicion) {
          mostrarNotificacion('exito', 'Concepto actualizado correctamente')
          cargarDatosEmpresa(empresaSeleccionada)
          setModalAbierto(false)
        } else {
          setUltimoCreado({
            codigo: json.datos?.codigo_auxiliar || formData.codigo_auxiliar,
            nombre: formData.nombre
          })
          mostrarNotificacion('exito', 'Concepto registrado con éxito')
          cargarDatosEmpresa(empresaSeleccionada)

          const subActualId = formData.subconcepto_niif_id
          setFormData((prev) => ({
            ...prev,
            nombre: '',
            descripcion: ''
          }))
          if (subActualId) {
            handleCambioSubconceptoNiif(subActualId)
          }
        }
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

  const conceptosFiltrados = useMemo(() => {
    return conceptos.filter((item) => {
      const termino = filtroBusqueda.toLowerCase().trim()
      
      const cumpleBusqueda =
        !termino ||
        (item.nombre && item.nombre.toLowerCase().includes(termino)) ||
        (item.codigo_auxiliar && item.codigo_auxiliar.toLowerCase().includes(termino)) ||
        (item.tipo_entidad && item.tipo_entidad.toLowerCase().includes(termino)) ||
        (item.codigo_subconcepto_niif && item.codigo_subconcepto_niif.toLowerCase().includes(termino)) ||
        (item.nombre_subconcepto_niif && item.nombre_subconcepto_niif.toLowerCase().includes(termino)) ||
        (item.elemento && item.elemento.toLowerCase().includes(termino)) ||
        (item.elemento_niif && item.elemento_niif.toLowerCase().includes(termino))

      const cumpleSubconcepto =
        !filtroSubconcepto || String(item.subconcepto_niif_id) === String(filtroSubconcepto)

      const cumpleEstado = !filtroEstado || item.estado === filtroEstado

      return cumpleBusqueda && cumpleSubconcepto && cumpleEstado
    })
  }, [conceptos, filtroBusqueda, filtroSubconcepto, filtroEstado])

  const conceptosAgrupadosPorPadre = useMemo(() => {
    const grupos: { [key: string]: { padreId: any; padreCodigo: string; padreNombre: string; conceptoNiifNombre: string; items: ConceptoAuxiliar[] } } = {}
    
    conceptosFiltrados.forEach((item) => {
      const padreId = item.subconcepto_niif_id || 'sin_padre'
      const padreCodigo = item.codigo_subconcepto_niif || 'S/C'
      const padreNombre = item.nombre_subconcepto_niif || 'Sin subconcepto NIIF especificado'
      const conceptoNiifNombre = item.nombre_concepto_niif ? `Concepto: [${item.codigo_concepto_niif}] ${item.nombre_concepto_niif}` : ''

      if (!grupos[padreId]) {
        grupos[padreId] = {
          padreId,
          padreCodigo,
          padreNombre,
          conceptoNiifNombre,
          items: []
        }
      }
      grupos[padreId].items.push(item)
    })

    Object.values(grupos).forEach((grupo) => {
      grupo.items.sort((a, b) => 
        (a.codigo_auxiliar || '').localeCompare(b.codigo_auxiliar || '', undefined, { numeric: true, sensitivity: 'base' })
      )
    })

    return Object.values(grupos).sort((a, b) => 
      a.padreCodigo.localeCompare(b.padreCodigo, undefined, { numeric: true, sensitivity: 'base' })
    )
  }, [conceptosFiltrados])

  const obtenerEtiquetaTipoAuxiliar = (valor: string): string => {
    const encontrado = OPCIONES_TIPO_AUXILIAR.find((op) => op.valor === valor)
    return encontrado ? encontrado.etiqueta : valor || '-'
  }

  if (!isMounted) return null

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 bg-slate-50/50 min-h-screen text-xs md:text-sm">
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

      {/* Encabezado Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              Conceptos Auxiliares
            </h1>
            <p className="text-[11px] text-slate-500">
              Gestión de conceptos contables auxiliares y clasificación por tipo de auxiliar
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
                cargarDatosEmpresa(empresaSeleccionada)
                cargarSubconceptosNiif(empresaSeleccionada)
              }
            }}
            title="Recargar datos"
            className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTabla ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={abrirModalCrear}
            disabled={!empresaSeleccionada}
            className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Concepto
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Buscador Avanzado */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="md:col-span-6 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, código, elemento o tipo..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition"
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

        <div className="md:col-span-4 flex items-center gap-2 bg-slate-50/50 border border-slate-200 px-3 py-1.5 rounded-lg">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={filtroSubconcepto}
            onChange={(e) => setFiltroSubconcepto(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer w-full"
          >
            <option value="">-- Todos los Subconceptos NIIF --</option>
            {Object.entries(subconceptosNiifAgrupadosPorElemento).map(([elementoGrupo, listaSub]) => (
              <optgroup key={elementoGrupo} label={`── ${elementoGrupo.toUpperCase()} ──`}>
                {listaSub.map((n) => {
                  const elem = obtenerElementoTexto(n)
                  return (
                    <option key={n.id} value={String(n.id)}>
                      {n.codigo} - {n.nombre} {elem ? `[${elem}]` : ''}
                    </option>
                  )
                })}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full h-full px-3 bg-slate-50/50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="">Estados (Todos)</option>
            <option value="Activo">Activos</option>
            <option value="Inactivo">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Contenedor de Tarjetas Agrupadas y Ordenadas */}
      <div className="space-y-4">
        {loadingTabla ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">Cargando conceptos auxiliares...</p>
          </div>
        ) : conceptosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-sm mx-auto">
            <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 mb-0.5">
              No hay conceptos registrados
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {filtroBusqueda || filtroSubconcepto || filtroEstado
                ? 'No se encontraron resultados con los filtros aplicados.'
                : 'Aún no se han registrado conceptos auxiliares para esta empresa.'}
            </p>
          </div>
        ) : (
          conceptosAgrupadosPorPadre.map((grupo) => (
            <div key={grupo.padreId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 truncate">
                  <FolderKanban className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-600 uppercase">Subconcepto NIIF:</span>
                  <span className="font-mono font-semibold text-indigo-700 text-xs shrink-0">{grupo.padreCodigo}</span>
                  <span className="text-slate-400">-</span>
                  <span className="font-semibold text-slate-800 text-xs truncate">{grupo.padreNombre}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {grupo.conceptoNiifNombre && (
                    <span className="text-[10px] text-slate-500 bg-white/80 border border-slate-200 px-2 py-0.5 rounded">
                      {grupo.conceptoNiifNombre}
                    </span>
                  )}
                  <span className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                    {grupo.items.length} auxiliar(es)
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="grid grid-cols-12 bg-slate-50/70 px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <div className="col-span-2">Código Aux.</div>
                  <div className="col-span-3">Nombre del Auxiliar</div>
                  <div className="col-span-2">Elemento</div>
                  <div className="col-span-2">Tipo de Auxiliar</div>
                  <div className="col-span-2 text-center">Estado</div>
                  <div className="col-span-1 text-right">Acciones</div>
                </div>

                {grupo.items.map((item) => {
                  const estaActivo = item.estado === 'Activo'
                  return (
                    <div key={item.id} className="grid grid-cols-12 items-center px-4 py-2 hover:bg-slate-50/80 transition">
                      <div className="col-span-2 font-mono font-medium text-indigo-600 text-xs truncate pr-2">
                        {item.codigo_auxiliar || <span className="text-slate-300">-</span>}
                      </div>
                      <div className="col-span-3 font-medium text-slate-800 truncate pr-2">
                        {item.nombre}
                      </div>
                      <div className="col-span-2 truncate pr-2">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          {item.elemento || item.elemento_niif || '-'}
                        </span>
                      </div>
                      <div className="col-span-2 truncate pr-2">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          {obtenerEtiquetaTipoAuxiliar(item.tipo_entidad)}
                        </span>
                      </div>
                      <div className="col-span-2 text-center">
                        <select
                          value={estaActivo ? 'true' : 'false'}
                          onChange={() => handleToggleEstado(item)}
                          className={`cursor-pointer text-[10px] font-semibold px-2 py-0.5 rounded-full border outline-none transition ${
                            estaActivo
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          <option value="true">Activo</option>
                          <option value="false">Inactivo</option>
                        </select>
                      </div>
                      <div className="col-span-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirModalEditar(item)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                            title="Editar concepto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEliminar(item)}
                            disabled={eliminandoId === item.id}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition disabled:opacity-50 cursor-pointer"
                            title="Eliminar concepto"
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

        {!loadingTabla && conceptosFiltrados.length > 0 && (
          <div className="px-4 py-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between shadow-2xs">
            <span>
              Mostrando <strong>{conceptosFiltrados.length}</strong> de{' '}
              <strong>{conceptos.length}</strong> conceptos auxiliares.
            </span>
          </div>
        )}
      </div>

      {/* Modal de Creación / Edición */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full p-5 space-y-3.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs md:text-sm font-bold text-slate-800">
                    {modoEdicion ? 'Editar Concepto Auxiliar' : 'Nuevo Concepto Auxiliar'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {modoEdicion
                      ? 'Modifica la información del concepto'
                      : 'Registra un nuevo concepto auxiliar vinculado a NIIF'}
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

            {ultimoCreado && !modoEdicion && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-semibold">¡Creado con éxito!</span> Código: <strong className="font-mono">{ultimoCreado.codigo}</strong> - <span>{ultimoCreado.nombre}</span>. Puede continuar creando el siguiente.
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Subconcepto NIIF (Padre) *
                  </label>
                  <select
                    value={formData.subconcepto_niif_id}
                    onChange={(e) => handleCambioSubconceptoNiif(e.target.value)}
                    disabled={loadingNiif}
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 transition cursor-pointer ${
                      erroresForm.subconcepto_niif_id ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  >
                    <option value="">
                      {loadingNiif ? 'Cargando NIIF...' : '-- Seleccionar NIIF --'}
                    </option>
                    {Object.entries(subconceptosNiifAgrupadosPorElemento).map(([elementoGrupo, listaSub]) => (
                      <optgroup key={elementoGrupo} label={`── ${elementoGrupo.toUpperCase()} ──`}>
                        {listaSub.map((n) => {
                          const elem = obtenerElementoTexto(n)
                          return (
                            <option key={n.id} value={String(n.id)}>
                              {n.codigo} - {n.nombre} {elem ? `[${elem}]` : ''}
                            </option>
                          )
                        })}
                      </optgroup>
                    ))}
                  </select>
                  {erroresForm.subconcepto_niif_id && (
                    <p className="text-[10px] text-rose-500 mt-0.5">{erroresForm.subconcepto_niif_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Código Auxiliar
                  </label>
                  <input
                    type="text"
                    readOnly={!modoEdicion}
                    value={formData.codigo_auxiliar}
                    onChange={(e) => setFormData((prev) => ({ ...prev, codigo_auxiliar: e.target.value }))}
                    placeholder="Auto-generado"
                    className="w-full px-2.5 py-1.5 font-mono font-medium text-center text-indigo-600 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Tipo de Auxiliar *
                  </label>
                  <select
                    value={formData.tipo_entidad}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, tipo_entidad: e.target.value }))
                      setErroresForm((prev) => ({ ...prev, tipo_entidad: null }))
                      if (ultimoCreado) setUltimoCreado(null)
                    }}
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 transition cursor-pointer ${
                      erroresForm.tipo_entidad ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  >
                    {OPCIONES_TIPO_AUXILIAR.map((op) => (
                      <option key={op.valor} value={op.valor}>
                        {op.etiqueta}
                      </option>
                    ))}
                  </select>
                  {erroresForm.tipo_entidad && (
                    <p className="text-[10px] text-rose-500 mt-0.5">{erroresForm.tipo_entidad}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Nombre del Concepto *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                      setErroresForm((prev) => ({ ...prev, nombre: null }))
                      if (ultimoCreado) setUltimoCreado(null)
                    }}
                    placeholder="Ej. Banco Bogotá Cta Ahorros"
                    className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs outline-none focus:border-indigo-500 transition ${
                      erroresForm.nombre ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                  {erroresForm.nombre && (
                    <p className="text-[10px] text-rose-500 mt-0.5">{erroresForm.nombre}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
                    if (ultimoCreado) setUltimoCreado(null)
                  }}
                  placeholder="Notas u observaciones adicionales..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <span className="text-[10px] text-slate-400">
                  {!modoEdicion && 'Campos marcados con * son obligatorios.'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModalAbierto(false)}
                    disabled={guardando}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    Cerrar / Terminar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    {guardando && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {modoEdicion ? 'Guardar Cambios' : 'Grabar y Continuar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}