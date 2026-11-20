'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
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
  ArrowLeft
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import {
  obtenerConceptosNiifPorEmpresaAction,
  siguienteCodigoSubconceptoAction,
  obtenerSubconceptosAction,
  crearSubconceptoAction,
  clonarSubconceptosAction,
  actualizarSubconceptoAction,
  eliminarSubconceptoAction
} from './actions'

interface Empresa {
  id: string | number;
  razon_social?: string;
  nombre_comercial?: string;
  nit_identificacion?: string;
}

export default function SubconceptosNiifPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaIdSeleccionada, setEmpresaIdSeleccionada] = useState<string | number>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("empresa_activa") || localStorage.getItem("empresa_id") || "";
    }
    return "";
  })

  const [conceptosPadre, setConceptosPadre] = useState<any[]>([])
  const [subconceptos, setSubconceptos] = useState<any[]>([])

  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true)
  const [loadingPadres, setLoadingPadres] = useState<boolean>(false)
  const [loadingTabla, setLoadingTabla] = useState<boolean>(false)
  const [guardando, setGuardando] = useState<boolean>(false)
  const [eliminandoId, setEliminandoId] = useState<string | number | null>(null)
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<string | number | null>(null)

  const [filtroBusqueda, setFiltroBusqueda] = useState<string>('')
  const [filtroPadre, setFiltroPadre] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  const [modalAbierto, setModalAbierto] = useState<boolean>(false)
  const [modoEdicion, setModoEdicion] = useState<boolean>(false)
  const [subconceptoEditarId, setSubconceptoEditarId] = useState<string | number | null>(null)

  const [modalCopiaAbierto, setModalCopiaAbierto] = useState<boolean>(false)
  const [empresasDestino, setEmpresasDestino] = useState<string[]>([])
  const [copiando, setCopiando] = useState<boolean>(false)

  const [notificacion, setNotificacion] = useState<{
    visible: boolean;
    tipo: 'exito' | 'error' | 'info';
    mensaje: string;
  }>({
    visible: false,
    tipo: 'exito',
    mensaje: ''
  })

  const [formData, setFormData] = useState({
    concepto_niif_id: '',
    codigo: '',
    nombre: '',
    descripcion: '',
    elemento: '',
    activo: true
  })

  const [erroresForm, setErroresForm] = useState<Record<string, string | null>>({})

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

  const cargarDatosEmpresa = useCallback(async (empId: string | number) => {
    if (!empId) return
    setLoadingPadres(true)
    setLoadingTabla(true)

    try {
      const [resPadres, resSub] = await Promise.all([
        obtenerConceptosNiifPorEmpresaAction(empId),
        obtenerSubconceptosAction(empId)
      ])

      if (resPadres.exito) {
        setConceptosPadre(resPadres.datos || [])
      } else {
        setConceptosPadre([])
      }

      if (resSub.exito) {
        setSubconceptos(resSub.datos || [])
      } else {
        setSubconceptos([])
      }
    } catch (error) {
      console.error('Error al cargar datos de empresa:', error)
    } finally {
      setLoadingPadres(false)
      setLoadingTabla(false)
    }
  }, [])

  // Sincronización de empresas y sucursal predeterminada al montar
  useEffect(() => {
    async function sincronizarEmpresasAsignadas() {
      setLoadingEmpresas(true)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
      if (!supabaseUrl || !supabaseAnonKey) {
        setLoadingEmpresas(false)
        return
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      try {
        const { data: authData } = await supabase.auth.getSession()
        const userId = authData?.session?.user?.id
        if (!userId) {
          setLoadingEmpresas(false)
          return
        }

        const { data: permisosTx } = await supabase
          .from("usuario_permisos_tx")
          .select("empresa_id")
          .eq("usuario_id", userId)

        if (!permisosTx || permisosTx.length === 0) {
          setLoadingEmpresas(false)
          return
        }

        const empresaIds = Array.from(new Set(permisosTx.map((p: any) => p.empresa_id).filter(Boolean)))
        if (empresaIds.length === 0) {
          setLoadingEmpresas(false)
          return
        }

        const { data: listaEmpresas, error } = await supabase
          .from("empresas")
          .select("id, razon_social, nombre_comercial, nit_identificacion")
          .in("id", empresaIds)
          .order("razon_social", { ascending: true })

        if (!error && listaEmpresas && listaEmpresas.length > 0) {
          setEmpresas(listaEmpresas)

          let empresaAUsar = localStorage.getItem("empresa_activa") || localStorage.getItem("empresa_id")

          if (!empresaAUsar || !listaEmpresas.some(e => String(e.id) === String(empresaAUsar))) {
            empresaAUsar = String(listaEmpresas[0].id)
          }

          setEmpresaIdSeleccionada(empresaAUsar)
          localStorage.setItem("empresa_activa", empresaAUsar)
          localStorage.setItem("empresa_id", empresaAUsar)
          document.cookie = `empresa_activa=${empresaAUsar}; path=/; max-age=86400; SameSite=Lax`

          const empresaObj = listaEmpresas.find(e => String(e.id) === String(empresaAUsar))
          if (empresaObj) {
            localStorage.setItem("empresa_activa_nombre", empresaObj.razon_social || empresaObj.nombre_comercial || "")
          }

          // Consultar y asegurar la primera sucursal activa correspondiente a esta empresa
          const { data: sucursalesEmpresa } = await supabase
            .from("sucursales")
            .select("id")
            .eq("empresa_id", empresaAUsar)
            .order("id", { ascending: true })
            .limit(1)

          if (sucursalesEmpresa && sucursalesEmpresa.length > 0) {
            const primeraSucursalId = String(sucursalesEmpresa[0].id)
            localStorage.setItem("sucursal_activa", primeraSucursalId)
            document.cookie = `sucursal_activa=${primeraSucursalId}; path=/; max-age=86400; SameSite=Lax`

            await supabase
              .from("usuarios_perfiles")
              .update({ empresa_activa: empresaAUsar, sucursal_activa: primeraSucursalId })
              .eq("id", userId)
          }

          cargarDatosEmpresa(empresaAUsar)
        }
      } catch (err) {
        console.error("Error al sincronizar empresas asignadas en subconceptos:", err)
      } finally {
        setLoadingEmpresas(false)
      }
    }

    sincronizarEmpresasAsignadas()
  }, [cargarDatosEmpresa])

  // Cambio de empresa: actualiza estado, localStorage, cookies, y fuerza la primera sucursal en sucursal_activa y usuarios_perfiles
  const handleEmpresaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoId = e.target.value
    setEmpresaIdSeleccionada(nuevoId)
    cargarDatosEmpresa(nuevoId)

    localStorage.setItem("empresa_activa", nuevoId)
    localStorage.setItem("empresa_id", nuevoId)
    document.cookie = `empresa_activa=${nuevoId}; path=/; max-age=86400; SameSite=Lax`

    const empresaObj = empresas.find(emp => String(emp.id) === String(nuevoId))
    if (empresaObj) {
      localStorage.setItem("empresa_activa_nombre", empresaObj.razon_social || empresaObj.nombre_comercial || "")
    }

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const { data: authData } = await supabase.auth.getSession()
        const userId = authData?.session?.user?.id
        if (userId) {
          // Consultar de forma estricta la primera sucursal de la nueva empresa
          const { data: sucursalesEmpresa } = await supabase
            .from("sucursales")
            .select("id")
            .eq("empresa_id", nuevoId)
            .order("id", { ascending: true })
            .limit(1)

          const payloadUpdate: Record<string, any> = { empresa_activa: nuevoId }

          if (sucursalesEmpresa && sucursalesEmpresa.length > 0) {
            const primeraSucursalId = String(sucursalesEmpresa[0].id)
            payloadUpdate.sucursal_activa = primeraSucursalId
            
            localStorage.setItem("sucursal_activa", primeraSucursalId)
            document.cookie = `sucursal_activa=${primeraSucursalId}; path=/; max-age=86400; SameSite=Lax`
          }

          await supabase
            .from("usuarios_perfiles")
            .update(payloadUpdate)
            .eq("id", userId)
        }
      }
    } catch (err) {
      console.error("Error al actualizar empresa_activa y sucursal_activa en usuarios_perfiles:", err)
    }
  }

  const obtenerSiguienteCodigo = async (conceptoPadreId: string) => {
    if (!conceptoPadreId) return
    try {
      const res = await siguienteCodigoSubconceptoAction(conceptoPadreId)
      if (res.exito && res.siguiente_codigo) {
        setFormData((prev) => ({ ...prev, codigo: res.siguiente_codigo! }))
      } else {
        mostrarNotificacion('info', 'No se pudo generar un código automático, ingréselo manualmente.')
      }
    } catch (error) {
      console.error('Error al obtener código sugerido:', error)
      mostrarNotificacion('error', 'Error al solicitar el código sugerido')
    }
  }

  const handleCambiarEstado = async (item: any, nuevoEstado: boolean) => {
    if (Boolean(item.activo) === nuevoEstado) return

    setCambiandoEstadoId(item.id)
    try {
      const res = await actualizarSubconceptoAction({
        id: item.id,
        nombre: item.nombre,
        activo: nuevoEstado
      })

      if (res.exito) {
        mostrarNotificacion('exito', `Estado actualizado a ${nuevoEstado ? 'Activo' : 'Inactivo'}`)
        cargarDatosEmpresa(empresaIdSeleccionada)
      } else {
        mostrarNotificacion('error', res.mensaje || 'No se pudo actualizar el estado')
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      mostrarNotificacion('error', 'Error al procesar el cambio de estado')
    } finally {
      setCambiandoEstadoId(null)
    }
  }

  const handleEliminarSubconcepto = async (item: any) => {
    const confirmacion = window.confirm(`¿Está seguro de eliminar el subconcepto "${item.nombre}" (${item.codigo})?`)
    if (!confirmacion) return

    setEliminandoId(item.id)
    try {
      const res = await eliminarSubconceptoAction(item.id)
      if (res.exito) {
        mostrarNotificacion('exito', 'Subconcepto eliminado correctamente')
        cargarDatosEmpresa(empresaIdSeleccionada)
      } else {
        mostrarNotificacion('error', res.mensaje || 'No se puede eliminar el subconcepto')
      }
    } catch (error) {
      console.error('Error al eliminar subconcepto:', error)
      mostrarNotificacion('error', 'Error al procesar la eliminación')
    } finally {
      setEliminandoId(null)
    }
  }

  const obtenerElementoTexto = (c: any) => {
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

  const handleConceptoPadreChange = (conceptoId: string) => {
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

  const abrirModalEditar = (item: any) => {
    setModoEdicion(true)
    setSubconceptoEditarId(item.id)
    setErroresForm({})

    setFormData({
      concepto_niif_id: item.concepto_niif_id ? String(item.concepto_niif_id) : '',
      codigo: item.codigo || '',
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      elemento: item.elemento || obtenerElementoTexto(item),
      activo: Boolean(item.activo)
    })

    setModalAbierto(true)
  }

  const validarFormulario = () => {
    const nuevosErrores: Record<string, string> = {}
    if (!formData.concepto_niif_id) nuevosErrores.concepto_niif_id = 'Seleccione un concepto NIIF padre'
    if (!formData.codigo.trim()) nuevosErrores.codigo = 'Código no disponible'
    if (!formData.nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio'
    } else if (formData.nombre.trim().length < 3) {
      nuevosErrores.nombre = 'Mínimo 3 caracteres'
    }

    setErroresForm(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validarFormulario()) return

    setGuardando(true)
    try {
      let res;
      if (modoEdicion && subconceptoEditarId) {
        res = await actualizarSubconceptoAction({
          id: subconceptoEditarId,
          concepto_niif_id: formData.concepto_niif_id,
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          elemento: formData.elemento,
          activo: formData.activo
        })
      } else {
        res = await crearSubconceptoAction({
          empresa_id: empresaIdSeleccionada,
          concepto_niif_id: formData.concepto_niif_id,
          codigo: formData.codigo,
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          elemento: formData.elemento
        })
      }

      if (res.exito) {
        mostrarNotificacion('exito', modoEdicion ? 'Subconcepto actualizado correctamente' : 'Subconcepto registrado con éxito')
        cargarDatosEmpresa(empresaIdSeleccionada)

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
        mostrarNotificacion('error', res.mensaje || 'Ocurrió un error al procesar la solicitud')
      }
    } catch (error) {
      console.error('Error al guardar subconcepto:', error)
      mostrarNotificacion('error', 'Error de servidor al guardar cambios')
    } finally {
      setGuardando(false)
    }
  }

  const abrirModalCopia = () => {
    if (!empresaIdSeleccionada) {
      mostrarNotificacion('info', 'Seleccione una empresa de origen primero')
      return
    }
    setEmpresasDestino([])
    setModalCopiaAbierto(true)
  }

  const toggleEmpresaDestino = (idStr: string) => {
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
      const res = await clonarSubconceptosAction({
        empresa_origen_id: empresaIdSeleccionada,
        empresas_destino_ids: empresasDestino
      })

      if (res.exito) {
        mostrarNotificacion('exito', res.mensaje || 'Copia realizada con éxito')
        setModalCopiaAbierto(false)
      } else {
        mostrarNotificacion('error', res.mensaje || 'Ocurrió un error durante la copia')
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
        (item.descripcion && item.descripcion.toLowerCase().includes(termino)) ||
        (item.elemento && item.elemento.toLowerCase().includes(termino))

      const coincidePadre = filtroPadre ? String(item.concepto_niif_id) === String(filtroPadre) : true

      const esActivo = Boolean(item.activo)
      const coincideEstado =
        filtroEstado === 'todos' ? true : filtroEstado === 'activos' ? esActivo : !esActivo

      return coincideTexto && coincidePadre && coincideEstado
    })
  }, [subconceptos, filtroBusqueda, filtroPadre, filtroEstado])

  const conceptosPadreAgrupadosPorElemento = useMemo(() => {
    const ordenElementos = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESOS', 'GASTOS', 'COSTOS']
    const grupos: Record<string, any[]> = {}

    ordenElementos.forEach((elem) => {
      grupos[elem] = []
    })

    conceptosPadre.forEach((c) => {
      const elementoRaw = (obtenerElementoTexto(c) || 'GENERAL / OTROS').trim().toUpperCase()
      const elementoKey = ordenElementos.includes(elementoRaw) ? elementoRaw : 'GENERAL / OTROS'
      if (!grupos[elementoKey]) {
        grupos[elementoKey] = []
      }
      grupos[elementoKey].push(c)
    })

    return Object.fromEntries(Object.entries(grupos).filter(([_, lista]) => lista.length > 0))
  }, [conceptosPadre])

  if (!isMounted) {
    return <div className="p-4 max-w-7xl mx-auto space-y-3 text-gray-500 text-xs">Cargando módulo de subconceptos NIIF...</div>
  }

  return (
    <div className="p-3 md:p-4 max-w-7xl mx-auto space-y-3 text-xs">
      {notificacion.visible && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-md border text-xs font-medium transition-all transform animate-in fade-in slide-in-from-top-4 ${
            notificacion.tipo === 'exito'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : notificacion.tipo === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-sky-50 text-sky-800 border-sky-200'
          }`}
        >
          {notificacion.tipo === 'exito' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          {notificacion.tipo === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
          {notificacion.tipo === 'info' && <Info className="w-3.5 h-3.5 text-sky-600" />}
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-3 rounded-lg shadow-sm border border-gray-200 gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            href="/modulos/contabilidad/configuracion"
            className="inline-flex items-center justify-center p-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 shadow-2xs transition-colors shrink-0 cursor-pointer"
            title="Volver al Menú de Configuración"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-800">Subconceptos NIIF</h1>
            <p className="text-[11px] text-gray-500">Configuración y detalle de subcuentas contables</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={empresaIdSeleccionada}
            disabled={loadingEmpresas || empresas.length <= 1}
            onChange={handleEmpresaChange}
            className="border border-gray-300 px-2.5 py-1.5 rounded-md bg-white text-xs font-semibold text-gray-700 shadow-2xs focus:ring-2 focus:ring-blue-500 outline-none min-w-[220px] disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
          >
            {loadingEmpresas ? (
              <option value="">Cargando empresas...</option>
            ) : empresas.length !== 1 ? (
              <option value="">-- Seleccione una Empresa --</option>
            ) : null}
            {empresas.map((emp) => (
              <option key={emp.id} value={String(emp.id)}>
                🏢 {emp.razon_social || emp.nombre_comercial}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              if (empresaIdSeleccionada) {
                cargarDatosEmpresa(empresaIdSeleccionada)
              }
            }}
            title="Recargar datos"
            className="p-1.5 text-gray-600 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-300 rounded-md transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTabla ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={abrirModalCopia}
            disabled={!empresaIdSeleccionada || subconceptos.length === 0}
            title="Copiar subconceptos a otras empresas"
            className="px-2.5 py-1.5 text-gray-700 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-300 rounded-md text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-2xs transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copiar a Empresas</span>
          </button>

          <button
            onClick={abrirModalCrear}
            disabled={conceptosPadre.length === 0 || loadingPadres}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-md shadow-2xs transition-colors disabled:opacity-50 text-xs whitespace-nowrap cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Subconcepto
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
        <div className="relative md:col-span-2">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código, nombre, descripción o elemento..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs outline-none focus:ring-2 focus:ring-blue-500 transition shadow-2xs"
          />
          {filtroBusqueda && (
            <button
              onClick={() => setFiltroBusqueda('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* SELECTOR DE CONCEPTOS PADRES AGRUPADOS POR ELEMENTO NIIF */}
        <div className="relative">
          <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={filtroPadre}
            onChange={(e) => setFiltroPadre(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition shadow-2xs cursor-pointer"
          >
            <option value="">Todos los conceptos padres</option>
            {Object.entries(conceptosPadreAgrupadosPorElemento).map(([elementoGrupo, listaPadres]) => (
              <optgroup key={elementoGrupo} label={`── ${elementoGrupo} ──`}>
                {listaPadres.map((c: any) => {
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
        </div>

        <div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition shadow-2xs cursor-pointer"
          >
            <option value="todos">Todos los estados</option>
            <option value="activos">Solo Activos</option>
            <option value="inactivos">Solo Inactivos</option>
          </select>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL: TABLA ÚNICA COMPACTA SIN AGRUPACIONES DE PADRE */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loadingTabla ? (
          <div className="p-8 text-center text-gray-500 text-xs">Cargando subconceptos NIIF...</div>
        ) : subconceptosFiltrados.length === 0 ? (
          <div className="p-8 text-center max-w-sm mx-auto">
            <div className="w-10 h-10 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold text-gray-800 mb-1">
              No hay subconceptos registrados
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              {filtroBusqueda || filtroPadre || filtroEstado !== 'todos'
                ? 'No se encontraron resultados que coincidan con los filtros.'
                : 'Aún no se han agregado subconceptos para esta empresa.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200 text-[11px]">
                <tr>
                  <th className="py-2 px-3 w-32">Código</th>
                  <th className="py-2 px-3">Nombre Subconcepto</th>
                  <th className="py-2 px-3 w-28">Elemento</th>
                  <th className="py-2 px-3">Descripción</th>
                  <th className="py-2 px-3 text-center w-24">Estado</th>
                  <th className="py-2 px-3 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subconceptosFiltrados.map((item: any) => {
                  const estaActivo = Boolean(item.activo)
                  const elementoTexto = item.elemento || obtenerElementoTexto(item) || '-'
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-1.5 px-3 font-mono font-bold text-blue-600 text-xs">
                        {item.codigo}
                      </td>
                      <td className="py-1.5 px-3 font-medium text-gray-900">
                        {item.nombre}
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-gray-700 uppercase text-[11px]">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                          {elementoTexto}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-gray-500 text-[11px]">
                        {item.descripcion || <span className="text-gray-300">Sin descripción</span>}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        {cambiandoEstadoId === item.id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                            <RefreshCw className="w-3 h-3 animate-spin" /> ...
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCambiarEstado(item, !estaActivo)}
                            type="button"
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer ${
                              estaActivo
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }`}
                          >
                            {estaActivo ? 'Activo' : 'Inactivo'}
                          </button>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => abrirModalEditar(item)}
                            type="button"
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded cursor-pointer"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleEliminarSubconcepto(item)}
                            disabled={eliminandoId === item.id}
                            type="button"
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-30 cursor-pointer"
                            title="Eliminar"
                          >
                            {eliminandoId === item.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                            ) : (
                              '🗑️'
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
      </div>

      {/* MODAL CREAR / EDITAR */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">
                    {modoEdicion ? 'Editar Subconcepto NIIF' : 'Nuevo Subconcepto NIIF'}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                type="button"
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                    Concepto NIIF Padre *
                  </label>
                  <select
                    value={formData.concepto_niif_id}
                    onChange={(e) => handleConceptoPadreChange(e.target.value)}
                    disabled={modoEdicion}
                    className={`w-full text-xs border p-1.5 rounded-md bg-white font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                      modoEdicion ? 'bg-gray-100 cursor-not-allowed opacity-80' : ''
                    } ${erroresForm.concepto_niif_id ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">Seleccione un concepto...</option>
                    {Object.entries(conceptosPadreAgrupadosPorElemento).map(([elementoGrupo, listaPadres]) => (
                      <optgroup key={elementoGrupo} label={`── ${elementoGrupo} ──`}>
                        {listaPadres.map((c: any) => {
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
                    <p className="text-red-500 text-[10px] mt-0.5">{erroresForm.concepto_niif_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
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
                    className="w-full text-xs border border-gray-300 p-1.5 rounded-md bg-gray-50 font-mono font-bold text-center text-blue-600 outline-none"
                  />
                  {erroresForm.codigo && (
                    <p className="text-red-500 text-[10px] mt-0.5">{erroresForm.codigo}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                    Nombre del Subconcepto *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                      setErroresForm((prev) => ({ ...prev, nombre: null }))
                    }}
                    placeholder="Ingrese el nombre"
                    className={`w-full text-xs border p-1.5 rounded-md outline-none focus:ring-2 focus:ring-blue-500 ${
                      erroresForm.nombre ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {erroresForm.nombre && (
                    <p className="text-red-500 text-[10px] mt-0.5">{erroresForm.nombre}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                    Elemento
                  </label>
                  <input
                    type="text"
                    value={formData.elemento}
                    onChange={(e) => setFormData((prev) => ({ ...prev, elemento: e.target.value }))}
                    placeholder="Ej: ACTIVO"
                    className="w-full text-xs border border-gray-300 p-1.5 rounded-md bg-gray-50 font-semibold uppercase outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Notas adicionales..."
                  className="w-full text-xs border border-gray-300 p-1.5 rounded-md outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-gray-100">
                <span className="text-[10px] text-gray-400">
                  {!modoEdicion && 'El formulario permanecerá abierto para agilizar.'}
                </span>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setModalAbierto(false)}
                    disabled={guardando}
                    className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    {modoEdicion ? 'Cancelar' : 'Cerrar'}
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium disabled:opacity-50 cursor-pointer flex items-center gap-1"
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

      {/* MODAL COPIAR */}
      {modalCopiaAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Copiar Subconceptos</h2>
                  <p className="text-[11px] text-gray-500">Sincronice la estructura con otras empresas</p>
                </div>
              </div>
              <button
                onClick={() => setModalCopiaAbierto(false)}
                type="button"
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-600 leading-relaxed">
                Seleccione las empresas de destino hacia las cuales desea copiar:
              </p>

              <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100 bg-gray-50/50 p-1 space-y-1">
                {empresas
                  .filter((emp) => String(emp.id) !== String(empresaIdSeleccionada))
                  .map((emp) => {
                    const empIdStr = String(emp.id)
                    const checked = empresasDestino.includes(empIdStr)
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center gap-2 p-1.5 rounded-md border cursor-pointer transition select-none ${
                          checked
                            ? 'bg-blue-50/60 border-blue-200 text-blue-900'
                            : 'bg-white border-transparent hover:border-gray-200 text-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEmpresaDestino(empIdStr)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">
                            {emp.razon_social || emp.nombre_comercial}
                          </span>
                          {emp.nit_identificacion && (
                            <span className="text-[10px] text-gray-400">NIT: {emp.nit_identificacion}</span>
                          )}
                        </div>
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2.5 border-t border-gray-100">
              <span className="text-[11px] text-gray-400">
                {empresasDestino.length} empresa(s) seleccionada(s)
              </span>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setModalCopiaAbierto(false)}
                  disabled={copiando}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCopiarASubconceptos}
                  disabled={copiando || empresasDestino.length === 0}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium disabled:opacity-50 cursor-pointer flex items-center gap-1"
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