'use client'

import React, { useState, useEffect, useMemo, useCallback, FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  setEmpresaActivaUsuario
} from '@/app/actions/accionesEmpresas'
import {
  getConceptosAuxiliaresData,
  crearConceptoAuxiliar,
  actualizarConceptoAuxiliar,
  eliminarConceptoAuxiliar
} from './actions'
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
  Filter,
  ArrowLeft
} from 'lucide-react'

// Interfaces corporativas estrictas
interface Empresa {
  id: number | string;
  empresa_id?: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
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
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('empresa_activa') || localStorage.getItem('empresa_id') || ''
    }
    return ''
  })
  const [conceptos, setConceptos] = useState<ConceptoAuxiliar[]>([])
  const [subconceptosNiif, setSubconceptosNiif] = useState<SubconceptoNiif[]>([])

  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true)
  const [loadingTabla, setLoadingTabla] = useState<boolean>(false)
  const [loadingNiif, setLoadingNiif] = useState<boolean>(false)
  const [guardando, setGuardando] = useState<boolean>(false)
  const [eliminandoId, setEliminandoId] = useState<number | string | null>(null)

  // Filtros
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

  const persistirEmpresaActiva = useCallback(async (empId: string, actualizarPerfil = false) => {
    if (!empId) return

    if (typeof window !== 'undefined') {
      localStorage.setItem('empresa_activa', String(empId))
      localStorage.setItem('empresa_id', String(empId))
    }
    document.cookie = `empresa_activa=${empId}; path=/; max-age=86400; SameSite=Lax`

    try {
      await setEmpresaActivaUsuario(empId)
    } catch (err) {
      console.error('Error al sincronizar empresa activa en acción:', err)
    }

    if (actualizarPerfil) {
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
              .eq('empresa_id', empId)
              .order('id', { ascending: true })
              .limit(1)

            const payloadUpdate: Record<string, any> = { empresa_activa: empId }
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
  }, [])

  // Carga de empresas asignadas y detección de empresa activa
  const cargarEmpresas = useCallback(async () => {
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
        const resEmp: any = await getConceptosAuxiliaresData({ accion: 'listar_empresas' })
        if (resEmp.exito && Array.isArray(resEmp.datos)) {
          listaEmpresas = resEmp.datos
        }
      }

      if (listaEmpresas.length > 0) {
        const empresasOrdenadas = [...listaEmpresas].sort((a: Empresa, b: Empresa) => {
          const nombreA = a.razon_social || a.nombre_comercial || a.nombre || ''
          const nombreB = b.razon_social || b.nombre_comercial || b.nombre || ''
          return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' })
        })

        setEmpresas(empresasOrdenadas)

        let empresaActivaBD: string | null = null
        try {
          const bdVal = await getEmpresaActivaUsuario()
          if (bdVal) empresaActivaBD = String(bdVal)
        } catch {
          // Ignorar si no aplica
        }

        const cookieEmpresa = document.cookie
          .split('; ')
          .find((row) => row.startsWith('empresa_activa='))
        const empresaGuardadaCookie = cookieEmpresa ? cookieEmpresa.split('=')[1] : null
        const empresaGuardadaLocal =
          typeof window !== 'undefined'
            ? localStorage.getItem('empresa_activa') || localStorage.getItem('empresa_id')
            : null

        const candidata = empresaGuardadaLocal || empresaGuardadaCookie || empresaActivaBD
        const existe = empresasOrdenadas.some(
          (emp) => String(emp.id || emp.empresa_id) === String(candidata)
        )

        const idFinal =
          existe && candidata
            ? String(candidata)
            : String(empresasOrdenadas[0].id || empresasOrdenadas[0].empresa_id)

        setEmpresaSeleccionada(idFinal)
        if (typeof window !== 'undefined') {
          localStorage.setItem('empresa_activa', idFinal)
          localStorage.setItem('empresa_id', idFinal)
        }
        document.cookie = `empresa_activa=${idFinal}; path=/; max-age=86400; SameSite=Lax`

        if (String(empresaActivaBD) !== idFinal) {
          await persistirEmpresaActiva(idFinal, false)
        }
      } else {
        setEmpresas([])
        mostrarNotificacion('error', 'No se encontraron empresas autorizadas')
      }
    } catch (error) {
      console.error('Error al cargar empresas:', error)
      setEmpresas([])
      mostrarNotificacion('error', 'Error de conexión al cargar empresas')
    } finally {
      setLoadingEmpresas(false)
    }
  }, [mostrarNotificacion, persistirEmpresaActiva])

  const cargarSubconceptosNiif = useCallback(async (empId: string) => {
    if (!empId) return
    setLoadingNiif(true)
    try {
      const res: any = await getConceptosAuxiliaresData({ accion: 'listar_subconceptos_niif', empresa_id: empId })
      if (res.exito) {
        setSubconceptosNiif(res.datos || [])
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
      const resConc: any = await getConceptosAuxiliaresData({ empresa_id: empId })
      if (resConc.exito) {
        setConceptos(resConc.datos || [])
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
    if (!isMounted) return
    cargarEmpresas()
  }, [isMounted, cargarEmpresas])

  useEffect(() => {
    if (!isMounted) return
    if (empresaSeleccionada) {
      cargarDatosEmpresa(empresaSeleccionada)
      cargarSubconceptosNiif(empresaSeleccionada)
    } else {
      setConceptos([])
      setSubconceptosNiif([])
    }
  }, [isMounted, empresaSeleccionada, cargarDatosEmpresa, cargarSubconceptosNiif])

  const handleCambioEmpresa = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaEmpresa = e.target.value
    setEmpresaSeleccionada(nuevaEmpresa)
    setFiltroSubconcepto('')
    setFiltroBusqueda('')
    if (nuevaEmpresa) {
      await persistirEmpresaActiva(nuevaEmpresa, true)
    }
  }

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
      const res: any = await actualizarConceptoAuxiliar({
        id: item.id,
        empresa_id: empresaSeleccionada || item.empresa_id,
        subconcepto_niif_id: item.subconcepto_niif_id,
        codigo_auxiliar: item.codigo_auxiliar,
        nombre: item.nombre,
        tipo_entidad: item.tipo_entidad,
        descripcion: item.descripcion,
        elemento: item.elemento || item.elemento_niif,
        estado: nuevoEstado
      })

      if (res.exito) {
        mostrarNotificacion('exito', `Estado cambiado a ${nuevoEstado}`)
        cargarDatosEmpresa(empresaSeleccionada)
      } else {
        mostrarNotificacion('error', res.mensaje || 'Error al actualizar el estado')
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
      const res: any = await eliminarConceptoAuxiliar(item.id)

      if (res.exito) {
        mostrarNotificacion('exito', 'Concepto auxiliar eliminado correctamente')
        cargarDatosEmpresa(empresaSeleccionada)
      } else {
        mostrarNotificacion('error', res.mensaje || 'No se puede eliminar el concepto')
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
      const payload = {
        ...formData,
        nombre: formData.nombre.trim(),
        empresa_id: empresaSeleccionada,
        id: modoEdicion ? conceptoEditarId : undefined,
        estado: modoEdicion ? formData.estado : 'Activo'
      }

      let res: any
      if (modoEdicion) {
        res = await actualizarConceptoAuxiliar(payload)
      } else {
        res = await crearConceptoAuxiliar(payload)
      }

      if (res.exito) {
        if (modoEdicion) {
          mostrarNotificacion('exito', 'Concepto actualizado correctamente')
          cargarDatosEmpresa(empresaSeleccionada)
          setModalAbierto(false)
        } else {
          setUltimoCreado({
            codigo: res.datos?.codigo_auxiliar || formData.codigo_auxiliar,
            nombre: formData.nombre.trim()
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
        mostrarNotificacion('error', res.mensaje || 'Ocurrió un error al procesar')
      }
    } catch (error) {
      console.error('Error al guardar:', error)
      mostrarNotificacion('error', 'Error de servidor al guardar cambios')
    } finally {
      setGuardando(false)
    }
  }

  const conceptosFiltrados = useMemo(() => {
    const termino = filtroBusqueda.toLowerCase().trim()

    return conceptos
      .filter((item) => {
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
      .sort((a, b) =>
        (a.codigo_auxiliar || '').localeCompare(b.codigo_auxiliar || '', undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      )
  }, [conceptos, filtroBusqueda, filtroSubconcepto, filtroEstado])

  const obtenerEtiquetaTipoAuxiliar = (valor: string): string => {
    const encontrado = OPCIONES_TIPO_AUXILIAR.find((op) => op.valor === valor)
    return encontrado ? encontrado.etiqueta : valor || '-'
  }

  if (!isMounted) {
    return <div className="p-12 text-center text-sm text-slate-500">Cargando entorno seguro...</div>
  }

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

      {/* Encabezado Principal con Botón de Retorno */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/modulos/contabilidad/configuracion"
            className="p-2.5 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer"
            title="Volver a Configuración"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-800 tracking-tight truncate">
                Conceptos Auxiliares
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                Gestión de conceptos contables auxiliares y clasificación por tipo de auxiliar
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={empresaSeleccionada}
              onChange={handleCambioEmpresa}
              disabled={!isMounted || loadingEmpresas || empresas.length <= 1}
              suppressHydrationWarning
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1 disabled:opacity-60 disabled:cursor-not-allowed"
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
                    return (
                      <option key={id} value={id}>
                        {emp.razon_social || emp.nombre_comercial || emp.nombre}
                      </option>
                    )
                  })}
                </>
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
            disabled={!empresaSeleccionada || loadingTabla}
            title="Recargar datos"
            className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTabla ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={abrirModalCrear}
            disabled={!isMounted || !empresaSeleccionada || empresas.length === 0}
            suppressHydrationWarning
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
            className="w-full pl-9 pr-8 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition"
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
            className="w-full h-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="">Estados (Todos)</option>
            <option value="Activo">Activos</option>
            <option value="Inactivo">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Tabla Sin Agrupación */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loadingTabla ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">Cargando conceptos auxiliares...</p>
          </div>
        ) : conceptosFiltrados.length === 0 ? (
          <div className="p-12 text-center max-w-sm mx-auto">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3.5">Código Aux.</th>
                  <th className="py-2.5 px-3.5">Nombre del Auxiliar</th>
                  <th className="py-2.5 px-3.5">Subconcepto NIIF</th>
                  <th className="py-2.5 px-3.5">Elemento</th>
                  <th className="py-2.5 px-3.5">Tipo de Auxiliar</th>
                  <th className="py-2.5 px-3.5 text-center">Estado</th>
                  <th className="py-2.5 px-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conceptosFiltrados.map((item) => {
                  const estaActivo = item.estado === 'Activo'
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2 px-3.5 font-mono font-medium text-indigo-600 whitespace-nowrap">
                        {item.codigo_auxiliar || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-2 px-3.5 font-medium text-slate-800">
                        {item.nombre}
                      </td>
                      <td className="py-2 px-3.5 text-slate-600">
                        {item.codigo_subconcepto_niif || item.nombre_subconcepto_niif ? (
                          <span className="truncate block max-w-[260px]" title={`${item.codigo_subconcepto_niif || ''} - ${item.nombre_subconcepto_niif || ''}`}>
                            {item.codigo_subconcepto_niif ? (
                              <span className="font-mono text-indigo-700 font-semibold">{item.codigo_subconcepto_niif}</span>
                            ) : null}
                            {item.codigo_subconcepto_niif && item.nombre_subconcepto_niif ? ' - ' : ''}
                            {item.nombre_subconcepto_niif || ''}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3.5 whitespace-nowrap">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          {item.elemento || item.elemento_niif || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-3.5 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          {obtenerEtiquetaTipoAuxiliar(item.tipo_entidad)}
                        </span>
                      </td>
                      <td className="py-2 px-3.5 text-center whitespace-nowrap">
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
                      </td>
                      <td className="py-2 px-3.5 text-right whitespace-nowrap">
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
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loadingTabla && conceptosFiltrados.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
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
                  <span className="font-semibold">¡Creado con éxito!</span> Código:{' '}
                  <strong className="font-mono">{ultimoCreado.codigo}</strong> -{' '}
                  <span>{ultimoCreado.nombre}</span>. Puede continuar creando el siguiente.
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