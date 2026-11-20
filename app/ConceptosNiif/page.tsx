'use client'

import React, { useState, useEffect, useCallback, useMemo, FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getEmpresasPermitidas } from '@/app/actions/accionesEmpresas'
import { ArrowLeft, Search, X } from 'lucide-react'
import {
  listarConceptosNiifEmpresas,
  obtenerConceptosNiif,
  obtenerSiguienteCodigoNiif,
  crearConceptoNiif,
  actualizarConceptoNiif,
  eliminarConceptoNiif,
  clonarConceptosNiifMasivo
} from './actions'

// Interfaces corporativas estrictas
interface Empresa {
  id: number | string;
  razon_social?: string;
  nombre_comercial?: string;
}

interface ConceptoNiif {
  id: number | string;
  empresa_id: number | string;
  codigo_concepto: string;
  nombre: string;
  elemento?: string;
  clasificacion_balance?: string;
}

// Opciones estándar para el Marco Conceptual NIIF
const ELEMENTOS_NIIF = [
  'Activo',
  'Pasivo',
  'Patrimonio',
  'Ingresos',
  'Gastos',
  'Costos'
] as const;

const CLASIFICACIONES_BALANCE = [
  'Corriente',
  'No Corriente',
  'Resultado del Periodo',
  'Otro Resultado Integral (ORI)',
  'No Aplica'
] as const;

// Colores distintivos por Elemento NIIF
const ELEMENTO_BADGE_COLORS: { [key: string]: string } = {
  'Activo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Pasivo': 'bg-sky-50 text-sky-700 border-sky-200',
  'Patrimonio': 'bg-purple-50 text-purple-700 border-purple-200',
  'Ingresos': 'bg-blue-50 text-blue-700 border-blue-200',
  'Gastos': 'bg-rose-50 text-rose-700 border-rose-200',
  'Costos': 'bg-amber-50 text-amber-700 border-amber-200',
  'Sin asignar': 'bg-slate-100 text-slate-600 border-slate-200'
}

// ==========================================
// PROPS INTERFACES PARA MODALES
// ==========================================
interface ModalClonarProps {
  empresas: Empresa[];
  empresaOrigenInicial: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface SubformularioProps {
  empresas: Empresa[];
  empresaIdSeleccionada: string;
  conceptoEditar: ConceptoNiif | null;
  onClose: () => void;
  onSave: () => void;
}

// ==========================================
// COMPONENTE: MODAL CLONAR / COPIAR CONCEPTOS NIIF
// ==========================================
function ModalClonarConceptos({ empresas, empresaOrigenInicial, onClose, onSuccess }: ModalClonarProps) {
  const [empresaOrigenId, setEmpresaOrigenId] = useState<string>(empresaOrigenInicial || '')
  const [empresasDestinoIds, setEmpresasDestinoIds] = useState<string[]>([])
  const [copiando, setCopiando] = useState<boolean>(false)

  const empresasDestinoPosibles = empresas.filter(
    (emp) => String(emp.id) !== String(empresaOrigenId)
  )

  const handleOrigenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoOrigenId = e.target.value
    setEmpresaOrigenId(nuevoOrigenId)
    setEmpresasDestinoIds((prev) => prev.filter((id) => String(id) !== String(nuevoOrigenId)))
  }

  const handleToggleEmpresaDestino = (id: number | string) => {
    const stringId = String(id)
    setEmpresasDestinoIds((prev) =>
      prev.includes(stringId)
        ? prev.filter((item) => item !== stringId)
        : [...prev, stringId]
    )
  }

  const handleSelectAll = () => {
    if (empresasDestinoIds.length === empresasDestinoPosibles.length) {
      setEmpresasDestinoIds([])
    } else {
      setEmpresasDestinoIds(empresasDestinoPosibles.map((emp) => String(emp.id)))
    }
  }

  const handleSubmitClonar = async (e: FormEvent) => {
    e.preventDefault()

    if (!empresaOrigenId) {
      alert('Debes seleccionar una empresa de origen.')
      return
    }

    if (empresasDestinoIds.length === 0) {
      alert('Debes seleccionar al menos una empresa de destino.')
      return
    }

    const confirmacion = confirm(
      `¿Deseas copiar todos los conceptos NIIF de la empresa seleccionada a las ${empresasDestinoIds.length} empresas destino?`
    )
    if (!confirmacion) return

    setCopiando(true)

    try {
      const data = await clonarConceptosNiifMasivo({
        empresa_origen_id: empresaOrigenId,
        empresas_destino_ids: empresasDestinoIds
      })

      if (data.exito) {
        alert(data.mensaje || '¡Conceptos NIIF copiados exitosamente!')
        onSuccess()
      } else {
        alert(data.mensaje || 'Ocurrió un error al clonar los conceptos NIIF.')
      }
    } catch (err) {
      console.error('Error al clonar conceptos:', err)
      alert('Error de conexión con el servidor.')
    } finally {
      setCopiando(false)
    }
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-bold text-gray-800">
            Copiar Conceptos NIIF
          </h3>
          <p className="text-xs text-gray-500">
            Duplica la estructura de conceptos de una empresa a otras.
          </p>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors text-sm cursor-pointer"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmitClonar} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            1. Empresa Origen (Copiar desde)
          </label>
          <select
            value={empresaOrigenId}
            onChange={handleOrigenChange}
            className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md bg-white font-medium text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            <option value="">-- Seleccionar Empresa Origen --</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={String(emp.id)}>
                🏢 {emp.razon_social || emp.nombre_comercial}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase">
              2. Empresas Destino (Copiar hacia)
            </label>
            {empresasDestinoPosibles.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
              >
                {empresasDestinoIds.length === empresasDestinoPosibles.length
                  ? 'Desmarcar todas'
                  : 'Seleccionar todas'}
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto divide-y divide-gray-100 p-1 bg-gray-50/50">
            {empresasDestinoPosibles.length === 0 ? (
              <p className="p-3 text-xs text-gray-400 text-center">
                No hay otras empresas disponibles para recibir la copia.
              </p>
            ) : (
              empresasDestinoPosibles.map((emp) => {
                const stringId = String(emp.id)
                const isChecked = empresasDestinoIds.includes(stringId)
                return (
                  <label
                    key={emp.id}
                    className="flex items-center space-x-2.5 px-3 py-2 hover:bg-white rounded cursor-pointer transition-colors text-xs text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleEmpresaDestino(emp.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium">
                      {emp.razon_social || emp.nombre_comercial}
                    </span>
                  </label>
                )
              })
            )}
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">
            Seleccionadas: {empresasDestinoIds.length} empresa(s)
          </span>
        </div>

        <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={copiando || !empresaOrigenId || empresasDestinoIds.length === 0}
            className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
          >
            {copiando ? 'Copiando conceptos...' : '📋 Copiar Conceptos'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ==========================================
// COMPONENTE: SUBFORMULARIO MODAL CONCEPTO NIIF
// ==========================================
function SubformularioConceptoNiif({ empresas, empresaIdSeleccionada, conceptoEditar, onClose, onSave }: SubformularioProps) {
  const [guardando, setGuardando] = useState<boolean>(false)

  const [formData, setFormData] = useState<{
    id?: number | string;
    empresa_id: string;
    codigo_concepto: string;
    nombre: string;
    elemento: string;
    clasificacion_balance: string;
  }>({
    empresa_id: empresaIdSeleccionada || '',
    codigo_concepto: '',
    nombre: '',
    elemento: '',
    clasificacion_balance: ''
  })

  const obtenerCodigoAuto = useCallback(async (empId: string) => {
    if (!empId) return
    try {
      const data = await obtenerSiguienteCodigoNiif(empId)
      if (data.exito && data.siguiente_codigo) {
        setFormData((prev) => ({ ...prev, codigo_concepto: data.siguiente_codigo! }))
      }
    } catch (err) {
      console.error('Error al obtener consecutivo:', err)
    }
  }, [])

  useEffect(() => {
    if (conceptoEditar) {
      setFormData({
        id: conceptoEditar.id,
        empresa_id: String(conceptoEditar.empresa_id || empresaIdSeleccionada || ''),
        codigo_concepto: conceptoEditar.codigo_concepto || '',
        nombre: conceptoEditar.nombre || '',
        elemento: conceptoEditar.elemento || '',
        clasificacion_balance: conceptoEditar.clasificacion_balance || ''
      })
    } else {
      setFormData((prev) => ({
        ...prev,
        id: undefined,
        codigo_concepto: '',
        nombre: '',
        elemento: '',
        clasificacion_balance: '',
        empresa_id: String(empresaIdSeleccionada || '')
      }))
      if (empresaIdSeleccionada) {
        obtenerCodigoAuto(empresaIdSeleccionada)
      }
    }
  }, [conceptoEditar, empresaIdSeleccionada, obtenerCodigoAuto])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!formData.empresa_id) {
      alert('Debes seleccionar una empresa.')
      return
    }

    if (!formData.nombre.trim()) {
      alert('El nombre del concepto NIIF es obligatorio.')
      return
    }

    setGuardando(true)

    try {
      const data = conceptoEditar
        ? await actualizarConceptoNiif({
            id: conceptoEditar.id,
            codigo_concepto: formData.codigo_concepto,
            nombre: formData.nombre.trim(),
            elemento: formData.elemento,
            clasificacion_balance: formData.clasificacion_balance
          })
        : await crearConceptoNiif({
            empresa_id: formData.empresa_id,
            codigo_concepto: formData.codigo_concepto,
            nombre: formData.nombre.trim(),
            elemento: formData.elemento,
            clasificacion_balance: formData.clasificacion_balance
          })

      if (data.exito) {
        onSave()
      } else {
        alert(data.mensaje || 'Error al guardar el concepto NIIF.')
      }
    } catch (err) {
      console.error('Error en el envío:', err)
      alert('Error de conexión con el servidor.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-800">
          {conceptoEditar ? 'Editar Concepto NIIF' : 'Nuevo Concepto NIIF'}
        </h3>
        <button
          onClick={onClose}
          type="button"
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors text-sm cursor-pointer"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            Empresa *
          </label>
          <select
            value={formData.empresa_id}
            disabled
            className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md bg-gray-100 font-semibold text-gray-700 cursor-not-allowed outline-none"
          >
            <option value="">-- Seleccione una Empresa --</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={String(emp.id)}>
                {emp.razon_social || emp.nombre_comercial}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Código
            </label>
            <input
              type="text"
              value={formData.codigo_concepto}
              disabled
              className="w-full text-sm border border-gray-200 px-2.5 py-1.5 rounded-md bg-gray-50 font-mono font-bold text-gray-600"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Nombre Concepto *
            </label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: Efectivo y Equivalentes de Efectivo"
              className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            Elemento NIIF
          </label>
          <select
            value={formData.elemento}
            onChange={(e) => setFormData({ ...formData, elemento: e.target.value })}
            className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            <option value="">-- Seleccionar Elemento --</option>
            {ELEMENTOS_NIIF.map((elem) => (
              <option key={elem} value={elem}>
                {elem}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            Clasificación Balance / Estado
          </label>
          <select
            value={formData.clasificacion_balance}
            onChange={(e) => setFormData({ ...formData, clasificacion_balance: e.target.value })}
            className="w-full text-sm border border-gray-300 px-2.5 py-1.5 rounded-md bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            <option value="">-- Seleccionar Clasificación --</option>
            {CLASIFICACIONES_BALANCE.map((clas) => (
              <option key={clas} value={clas}>
                {clas}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 cursor-pointer"
          >
            {guardando ? 'Guardando...' : 'Guardar Concepto'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ==========================================
// COMPONENTE PRINCIPAL: PÁGINA CONCEPTOS NIIF
// ==========================================
export default function ConceptosNiifPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true)
  const [empresaIdSeleccionada, setEmpresaIdSeleccionada] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('empresa_activa') || localStorage.getItem('empresa_id') || ''
    }
    return ''
  })
  const [conceptos, setConceptos] = useState<ConceptoNiif[]>([])
  const [busqueda, setBusqueda] = useState<string>('')
  const [cargando, setCargando] = useState<boolean>(true)

  const [modalFormAbierto, setModalFormAbierto] = useState<boolean>(false)
  const [modalClonarAbierto, setModalClonarAbierto] = useState<boolean>(false)
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState<ConceptoNiif | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const cargarConceptos = useCallback(async (empId: string) => {
    if (!empId) {
      setConceptos([])
      setCargando(false)
      return
    }
    setCargando(true)
    try {
      const data = await obtenerConceptosNiif(empId)
      if (data.exito) {
        setConceptos(data.datos || [])
      } else {
        setConceptos([])
      }
    } catch (error) {
      console.error('Error al cargar conceptos NIIF:', error)
      setConceptos([])
    } finally {
      setCargando(false)
    }
  }, [])

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
          const resServer = await listarConceptosNiifEmpresas()
          if (resServer.exito && Array.isArray(resServer.datos)) {
            listaEmpresas = resServer.datos
          }
        }

        if (listaEmpresas.length > 0) {
          const empresasOrdenadas = [...listaEmpresas].sort((a: Empresa, b: Empresa) => {
            const nombreA = a.razon_social || a.nombre_comercial || ''
            const nombreB = b.razon_social || b.nombre_comercial || ''
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
            (emp) => String(emp.id) === String(empresaIdParaSeleccionar)
          )

          const idFinal =
            existeEmpresa && empresaIdParaSeleccionar
              ? String(empresaIdParaSeleccionar)
              : String(empresasOrdenadas[0].id)

          setEmpresaIdSeleccionada(idFinal)
          if (typeof window !== 'undefined') {
            localStorage.setItem('empresa_activa', idFinal)
            localStorage.setItem('empresa_id', idFinal)
          }
          document.cookie = `empresa_activa=${idFinal}; path=/; max-age=86400; SameSite=Lax`

          await cargarConceptos(idFinal)
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
  }, [isMounted, cargarConceptos])

  const handleEmpresaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoId = e.target.value
    setEmpresaIdSeleccionada(nuevoId)
    setBusqueda('')

    if (!nuevoId) {
      setConceptos([])
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('empresa_activa', String(nuevoId))
      localStorage.setItem('empresa_id', String(nuevoId))
    }
    document.cookie = `empresa_activa=${nuevoId}; path=/; max-age=86400; SameSite=Lax`

    await cargarConceptos(nuevoId)

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
            .eq('empresa_id', nuevoId)
            .order('id', { ascending: true })
            .limit(1)

          const payloadUpdate: Record<string, any> = { empresa_activa: nuevoId }
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

  const handleNuevoConcepto = () => {
    setConceptoSeleccionado(null)
    setModalFormAbierto(true)
  }

  const handleEditarConcepto = (concepto: ConceptoNiif) => {
    setConceptoSeleccionado(concepto)
    setModalFormAbierto(true)
  }

  const handleEliminar = async (concepto: ConceptoNiif) => {
    if (!confirm(`¿Deseas eliminar el concepto NIIF "${concepto.nombre}"?`)) return

    try {
      const data = await eliminarConceptoNiif(concepto.id)
      if (data.exito) {
        cargarConceptos(empresaIdSeleccionada)
      } else {
        alert(data.mensaje || 'No se pudo eliminar el concepto NIIF.')
      }
    } catch (error) {
      console.error('Error al eliminar concepto NIIF:', error)
    }
  }

  const conceptosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return conceptos
    return conceptos.filter(
      (c) =>
        (c.codigo_concepto && c.codigo_concepto.toLowerCase().includes(q)) ||
        (c.nombre && c.nombre.toLowerCase().includes(q)) ||
        (c.elemento && c.elemento.toLowerCase().includes(q)) ||
        (c.clasificacion_balance && c.clasificacion_balance.toLowerCase().includes(q))
    )
  }, [conceptos, busqueda])

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Encabezado con Botón Atrás */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/modulos/contabilidad/configuracion"
            className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg transition flex items-center justify-center shrink-0"
            title="Volver a Configuración"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-800 truncate">Conceptos NIIF</h1>
            <p className="text-xs md:text-sm text-gray-500 truncate">Catálogo de conceptos y clasificación de los estados financieros.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={empresaIdSeleccionada}
            onChange={handleEmpresaChange}
            disabled={!isMounted || loadingEmpresas || empresas.length <= 1}
            suppressHydrationWarning
            className="border border-gray-300 px-3 py-1.5 rounded-md bg-white text-xs md:text-sm font-semibold text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none min-w-[200px] disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {!isMounted || loadingEmpresas ? (
              <option value="">Cargando empresas...</option>
            ) : empresas.length === 0 ? (
              <option value="">Sin empresas asignadas</option>
            ) : (
              <>
                {empresas.length !== 1 && <option value="">-- Seleccione una Empresa --</option>}
                {empresas.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    🏢 {emp.razon_social || emp.nombre_comercial}
                  </option>
                ))}
              </>
            )}
          </select>

          <button
            type="button"
            onClick={() => setModalClonarAbierto(true)}
            disabled={!isMounted || !empresaIdSeleccionada || empresas.length <= 1}
            suppressHydrationWarning
            title="Copiar el catálogo de conceptos a otras empresas"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-md shadow-sm transition-colors disabled:opacity-50 text-xs md:text-sm whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            📋 Copiar a otras
          </button>

          <button
            type="button"
            onClick={handleNuevoConcepto}
            disabled={!isMounted || !empresaIdSeleccionada}
            suppressHydrationWarning
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded-md shadow-sm transition-colors disabled:opacity-50 text-xs md:text-sm whitespace-nowrap cursor-pointer"
          >
            + Nuevo Concepto
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
            placeholder="Buscar por código, nombre, elemento o clasificación..."
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
          Mostrando <strong className="text-gray-800">{conceptosFiltrados.length}</strong> de{' '}
          <strong className="text-gray-800">{conceptos.length}</strong> concepto(s)
        </span>
      </div>

      {/* Tabla Principal Sin Agrupación por Elemento */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="p-6 text-center text-gray-500 text-sm">Cargando conceptos NIIF...</div>
        ) : conceptosFiltrados.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            {busqueda
              ? 'No se encontraron conceptos NIIF que coincidan con la búsqueda.'
              : 'No hay conceptos NIIF registrados para la empresa seleccionada.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200 text-xs">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Nombre Concepto</th>
                  <th className="py-2.5 px-3">Elemento</th>
                  <th className="py-2.5 px-3">Clasificación Balance</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {conceptosFiltrados.map((conc) => {
                  const elem = conc.elemento || 'Sin asignar'
                  const badgeColor = ELEMENTO_BADGE_COLORS[elem] || 'bg-slate-100 text-slate-600 border-slate-200'

                  return (
                    <tr key={conc.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-gray-800">{conc.codigo_concepto || '-'}</td>
                      <td className="py-2 px-3 font-medium text-gray-900">{conc.nombre || '-'}</td>
                      <td className="py-2 px-3 text-gray-600">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs border font-medium ${badgeColor}`}>
                          {elem}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-600">{conc.clasificacion_balance || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleEditarConcepto(conc)}
                            type="button"
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleEliminar(conc)}
                            type="button"
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            🗑️
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

      {/* Modal Subformulario (Crear/Editar) */}
      {modalFormAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-100">
            <SubformularioConceptoNiif
              empresas={empresas}
              empresaIdSeleccionada={empresaIdSeleccionada}
              conceptoEditar={conceptoSeleccionado}
              onClose={() => setModalFormAbierto(false)}
              onSave={() => {
                setModalFormAbierto(false)
                cargarConceptos(empresaIdSeleccionada)
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Clonar / Copiar a otras empresas */}
      {modalClonarAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-100">
            <ModalClonarConceptos
              empresas={empresas}
              empresaOrigenInicial={empresaIdSeleccionada}
              onClose={() => setModalClonarAbierto(false)}
              onSuccess={() => {
                setModalClonarAbierto(false)
                cargarConceptos(empresaIdSeleccionada)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}