'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef, FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { obtenerEmpresas, obtenerSucursales } from '@/app/consultas/movimientos/actions'
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  setEmpresaActivaUsuario
} from '@/app/actions/accionesEmpresas'
import {
  ArrowLeft,
  FileCheck2,
  Building2,
  MapPin,
  Search,
  X,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

interface Empresa {
  id: number | string;
  empresa_id?: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
}

interface Sucursal {
  id: number | string;
  empresa_id?: number | string;
  codigo_sucursal?: string;
  nombre?: string;
}

interface ResolucionFacturacion {
  id: number | string;
  empresa_id: number | string;
  sucursal_id: number | string;
  prefijo?: string | null;
  numero_resolucion: string;
  fecha_expedicion: string;
  consecutivo_inicial: number;
  consecutivo_final: number;
  consecutivo_actual: number;
  fecha_vigencia_hasta: string;
  activo: boolean;
}

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

function setCookieValue(name: string, value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=86400; SameSite=Lax`
}

function esResolucionVigente(r: ResolucionFacturacion): boolean {
  if (!r.fecha_vigencia_hasta) return Boolean(r.activo)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const partes = String(r.fecha_vigencia_hasta).slice(0, 10).split('-')
  if (partes.length === 3) {
    const vigencia = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
    vigencia.setHours(0, 0, 0, 0)
    return vigencia >= hoy
  }
  return Boolean(r.activo)
}

export default function ResolucionesPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [resoluciones, setResoluciones] = useState<ResolucionFacturacion[]>([])

  const empresasRef = useRef<Empresa[]>([])
  const sucursalesRef = useRef<Sucursal[]>([])

  useEffect(() => {
    empresasRef.current = empresas
  }, [empresas])

  useEffect(() => {
    sucursalesRef.current = sucursales
  }, [sucursales])

  const [empresaId, setEmpresaId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('empresa_activa') || localStorage.getItem('empresa_id') || ''
    }
    return ''
  })
  const [sucursalId, setSucursalId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sucursal_activa') || localStorage.getItem('sucursal_id') || ''
    }
    return ''
  })

  const [prefijo, setPrefijo] = useState<string>('')
  const [numeroResolucion, setNumeroResolucion] = useState<string>('')
  const [fechaExpedicion, setFechaExpedicion] = useState<string>('')
  const [consecutivoInicial, setConsecutivoInicial] = useState<number>(1)
  const [consecutivoFinal, setConsecutivoFinal] = useState<number>(1000)
  const [fechaVigenciaHasta, setFechaVigenciaHasta] = useState<string>('')

  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true)
  const [loadingTabla, setLoadingTabla] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

  // Barra de búsqueda y filtro de estado
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  const [mensajeFeedback, setMensajeFeedback] = useState<{
    tipo: 'exito' | 'error';
    texto: string;
  } | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const persistirContexto = useCallback(async (empId: string, sucId?: string, actualizarPerfil = false) => {
    if (!empId) return

    const empEncontrada = empresasRef.current.find(
      (e) => String(e.id || e.empresa_id) === String(empId)
    )
    const nombreEmpresa =
      empEncontrada?.razon_social ||
      empEncontrada?.nombre_comercial ||
      empEncontrada?.nombre ||
      ''

    if (typeof window !== 'undefined') {
      localStorage.setItem('empresa_activa', String(empId))
      localStorage.setItem('empresa_id', String(empId))
      if (nombreEmpresa) {
        localStorage.setItem('empresa_activa_nombre', nombreEmpresa)
      }
    }
    setCookieValue('empresa_activa', String(empId))

    if (sucId) {
      const sucEncontrada = sucursalesRef.current.find((s) => String(s.id) === String(sucId))
      if (typeof window !== 'undefined') {
        localStorage.setItem('sucursal_activa', String(sucId))
        localStorage.setItem('sucursal_id', String(sucId))
        if (sucEncontrada?.nombre) {
          localStorage.setItem('sucursal_activa_nombre', sucEncontrada.nombre)
        }
      }
      setCookieValue('sucursal_activa', String(sucId))
    }

    try {
      await setEmpresaActivaUsuario(empId)
    } catch {
      // Ignorar si no aplica
    }

    if (actualizarPerfil) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        if (supabaseUrl && supabaseAnonKey) {
          const client = createClient(supabaseUrl, supabaseAnonKey)
          const { data: { user } } = await client.auth.getUser()
          if (user) {
            const payloadPerfil: Record<string, unknown> = {
              empresa_activa: Number(empId)
            }
            if (sucId) {
              payloadPerfil.sucursal_activa = Number(sucId)
            }
            await client
              .from('usuarios_perfiles')
              .update(payloadPerfil)
              .eq('id', user.id)
          }
        }
      } catch (err) {
        console.error('Error al actualizar perfil en Resoluciones:', err)
      }
    }
  }, [])

  const cargarEmpresas = useCallback(async () => {
    setLoadingEmpresas(true)
    try {
      let listaEmpresas: Empresa[] = []

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      if (supabaseUrl && supabaseAnonKey) {
        const client = createClient(supabaseUrl, supabaseAnonKey)
        const { data: { user } } = await client.auth.getUser()
        if (user) {
          const { data: permisosTx } = await client
            .from('usuario_permisos_tx')
            .select('empresa_id')
            .eq('usuario_id', user.id)

          const idsPermitidos = Array.from(
            new Set((permisosTx || []).map((p: any) => String(p.empresa_id)).filter(Boolean))
          )

          if (idsPermitidos.length > 0) {
            const { data: rowsEmp } = await client
              .from('empresas')
              .select('id, razon_social, nombre_comercial')
              .in('id', idsPermitidos)

            if (rowsEmp && rowsEmp.length > 0) {
              listaEmpresas = rowsEmp
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
        }
      }

      if (listaEmpresas.length === 0) {
        const res = await obtenerEmpresas()
        if (res.success && Array.isArray(res.data)) {
          listaEmpresas = res.data
        }
      }

      if (listaEmpresas.length > 0) {
        const ordenadas = [...listaEmpresas].sort((a, b) => {
          const nomA = a.razon_social || a.nombre_comercial || a.nombre || ''
          const nomB = b.razon_social || b.nombre_comercial || b.nombre || ''
          return nomA.localeCompare(nomB, 'es', { sensitivity: 'base' })
        })
        setEmpresas(ordenadas)

        let empresaActivaBD: string | null = null
        try {
          const bdVal = await getEmpresaActivaUsuario()
          if (bdVal) empresaActivaBD = String(bdVal)
        } catch {
          // Ignorar
        }

        const localEmp =
          typeof window !== 'undefined'
            ? localStorage.getItem('empresa_activa') || localStorage.getItem('empresa_id')
            : null
        const cookieEmp = getCookieValue('empresa_activa')

        const candidata = localEmp || cookieEmp || empresaActivaBD
        const existe = ordenadas.some(
          (e) => String(e.id || e.empresa_id) === String(candidata)
        )

        const idFinal =
          existe && candidata
            ? String(candidata)
            : String(ordenadas[0].id || ordenadas[0].empresa_id)

        setEmpresaId(idFinal)
        if (typeof window !== 'undefined') {
          localStorage.setItem('empresa_activa', idFinal)
          localStorage.setItem('empresa_id', idFinal)
        }
        setCookieValue('empresa_activa', idFinal)
      } else {
        setEmpresas([])
        setEmpresaId('')
      }
    } catch (error) {
      console.error('Error al cargar empresas en Resoluciones:', error)
      setMensajeFeedback({ tipo: 'error', texto: 'Error al cargar las empresas asignadas.' })
    } finally {
      setLoadingEmpresas(false)
    }
  }, [])

  const cargarResoluciones = useCallback(async (empId: string) => {
    if (!empId) {
      setResoluciones([])
      setLoadingTabla(false)
      return
    }
    setLoadingTabla(true)
    try {
      const { data, error } = await supabase
        .from('resoluciones_facturacion')
        .select('*')
        .eq('empresa_id', Number(empId))
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data)) {
        const hoyStr = new Date().toISOString().slice(0, 10)
        const vencidasIds = data
          .filter((r) => r.activo && r.fecha_vigencia_hasta && String(r.fecha_vigencia_hasta).slice(0, 10) < hoyStr)
          .map((r) => r.id)

        if (vencidasIds.length > 0) {
          await supabase
            .from('resoluciones_facturacion')
            .update({ activo: false })
            .in('id', vencidasIds)
        }

        setResoluciones(
          data.map((r) => ({
            ...r,
            activo: esResolucionVigente(r)
          }))
        )
      } else {
        setResoluciones([])
      }
    } catch (error) {
      console.error('Error al cargar resoluciones:', error)
      setResoluciones([])
    } finally {
      setLoadingTabla(false)
    }
  }, [])

  useEffect(() => {
    if (!isMounted) return
    cargarEmpresas()
  }, [isMounted, cargarEmpresas])

  useEffect(() => {
    if (!empresaId || !isMounted) {
      setSucursales([])
      setSucursalId('')
      setResoluciones([])
      setLoadingTabla(false)
      return
    }

    let cancelado = false

    async function cargarSucursalesYResoluciones() {
      try {
        const sucRes = await obtenerSucursales(Number(empresaId))
        if (cancelado) return

        let sucursalElegidaId = ''

        if (sucRes.success) {
          const listaSuc = sucRes.data || []
          setSucursales(listaSuc)

          const sucGuardada =
            (typeof window !== 'undefined'
              ? localStorage.getItem('sucursal_activa') || localStorage.getItem('sucursal_id')
              : null) || getCookieValue('sucursal_activa')

          const coincideGuardada = listaSuc.some(
            (s: Sucursal) => String(s.id) === String(sucGuardada)
          )

          if (coincideGuardada && sucGuardada) {
            sucursalElegidaId = String(sucGuardada)
          } else if (listaSuc.length > 0) {
            sucursalElegidaId = String(listaSuc[0].id)
          }

          setSucursalId(sucursalElegidaId)
        } else {
          setSucursales([])
          setSucursalId('')
        }

        await persistirContexto(empresaId, sucursalElegidaId || undefined, false)
        if (!cancelado) {
          await cargarResoluciones(empresaId)
        }
      } catch (err) {
        console.error('Error al cargar sucursales y resoluciones:', err)
        if (!cancelado) {
          setLoadingTabla(false)
        }
      }
    }

    cargarSucursalesYResoluciones()

    return () => {
      cancelado = true
    }
  }, [empresaId, isMounted, cargarResoluciones, persistirContexto])

  const handleCambioEmpresa = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaEmpresa = e.target.value
    setMensajeFeedback(null)
    setEmpresaId(nuevaEmpresa)
    setSucursalId('')

    if (typeof window !== 'undefined') {
      localStorage.removeItem('sucursal_activa')
      localStorage.removeItem('sucursal_id')
      localStorage.removeItem('sucursal_activa_nombre')
    }

    if (nuevaEmpresa) {
      await persistirContexto(nuevaEmpresa, undefined, true)
    }
  }

  const handleCambioSucursal = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaSucursal = e.target.value
    setSucursalId(nuevaSucursal)
    if (empresaId && nuevaSucursal) {
      await persistirContexto(empresaId, nuevaSucursal, true)
    }
  }

  const nombresSucursalesMap = useMemo(() => {
    const mapa = new Map<string, string>()
    sucursales.forEach((s) => {
      mapa.set(String(s.id), `${s.nombre || ''}${s.codigo_sucursal ? ` (${s.codigo_sucursal})` : ''}`)
    })
    return mapa
  }, [sucursales])

  const resolucionesFiltradas = useMemo(() => {
    const termino = filtroBusqueda.toLowerCase().trim()
    return resoluciones.filter((r) => {
      const vigente = esResolucionVigente(r)
      const nombreSuc = (nombresSucursalesMap.get(String(r.sucursal_id)) || '').toLowerCase()
      const cumpleBusqueda =
        !termino ||
        (r.prefijo && r.prefijo.toLowerCase().includes(termino)) ||
        (r.numero_resolucion && r.numero_resolucion.toLowerCase().includes(termino)) ||
        nombreSuc.includes(termino)

      const cumpleEstado =
        !filtroEstado ||
        (filtroEstado === 'ACTIVA' && vigente) ||
        (filtroEstado === 'INACTIVA' && !vigente)

      return cumpleBusqueda && cumpleEstado
    })
  }, [resoluciones, filtroBusqueda, filtroEstado, nombresSucursalesMap])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMensajeFeedback(null)

    if (!empresaId || !sucursalId || !numeroResolucion.trim()) {
      setMensajeFeedback({
        tipo: 'error',
        texto: 'Complete los campos obligatorios (Empresa, Sucursal y N° Resolución).'
      })
      return
    }

    if (consecutivoFinal < consecutivoInicial) {
      setMensajeFeedback({
        tipo: 'error',
        texto: 'El consecutivo final no puede ser menor que el consecutivo inicial.'
      })
      return
    }

    const prefijoLimpio = prefijo.trim().toUpperCase() || null

    const estadoPorVigencia = esResolucionVigente({
      id: 0,
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      prefijo: prefijoLimpio,
      numero_resolucion: numeroResolucion.trim(),
      fecha_expedicion: fechaExpedicion,
      consecutivo_inicial: Number(consecutivoInicial),
      consecutivo_final: Number(consecutivoFinal),
      consecutivo_actual: Number(consecutivoInicial) - 1,
      fecha_vigencia_hasta: fechaVigenciaHasta,
      activo: true
    })

    setLoading(true)
    const { error } = await supabase.from('resoluciones_facturacion').insert([
      {
        empresa_id: Number(empresaId),
        sucursal_id: Number(sucursalId),
        prefijo: prefijoLimpio,
        numero_resolucion: numeroResolucion.trim(),
        fecha_expedicion: fechaExpedicion,
        consecutivo_inicial: Number(consecutivoInicial),
        consecutivo_final: Number(consecutivoFinal),
        consecutivo_actual: Number(consecutivoInicial) - 1,
        fecha_vigencia_hasta: fechaVigenciaHasta,
        activo: estadoPorVigencia
      }
    ])

    if (error) {
      setMensajeFeedback({
        tipo: 'error',
        texto: 'Error al guardar resolución: ' + error.message
      })
    } else {
      setMensajeFeedback({
        tipo: 'exito',
        texto: '¡Resolución DIAN registrada con éxito!'
      })
      setNumeroResolucion('')
      setPrefijo('')
      await cargarResoluciones(empresaId)
    }
    setLoading(false)
  }

  if (!isMounted) {
    return <div className="p-4 text-center text-xs text-slate-400">Cargando módulo de resoluciones...</div>
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4 text-xs font-sans bg-slate-50/50 min-h-screen">
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
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold text-slate-800 truncate">
                Administración de Resoluciones DIAN
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                Configuración de rangos de numeración autorizados por prefijo y sucursal.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={empresaId}
              onChange={handleCambioEmpresa}
              disabled={!isMounted || loadingEmpresas || empresas.length <= 1}
              suppressHydrationWarning
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!isMounted || loadingEmpresas ? (
                <option value="">Cargando empresas...</option>
              ) : empresas.length === 0 ? (
                <option value="">Sin empresas asignadas</option>
              ) : (
                <>
                  {empresas.length !== 1 && <option value="">-- Seleccione Empresa --</option>}
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
            type="button"
            onClick={() => {
              if (empresaId) cargarResoluciones(empresaId)
            }}
            disabled={!empresaId || loadingTabla}
            title="Recargar resoluciones"
            className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTabla ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {mensajeFeedback && (
        <div
          className={`p-3 rounded-xl font-medium border flex items-center gap-2 ${
            mensajeFeedback.tipo === 'exito'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {mensajeFeedback.tipo === 'exito' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{mensajeFeedback.texto}</span>
        </div>
      )}

      {/* Formulario de Registro */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3"
      >
        {/* Fila 1: Empresa y Sucursal amplias */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <label className="block font-semibold text-slate-600 uppercase mb-1 text-[10px] tracking-wider">
              Empresa *
            </label>
            <select
              value={empresaId}
              onChange={handleCambioEmpresa}
              disabled={!isMounted || loadingEmpresas || empresas.length <= 1}
              suppressHydrationWarning
              className="w-full bg-slate-50/60 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!isMounted || loadingEmpresas ? (
                <option value="">Cargando empresas...</option>
              ) : empresas.length === 0 ? (
                <option value="">Sin empresas asignadas</option>
              ) : (
                empresas.map((emp) => {
                  const id = String(emp.id || emp.empresa_id)
                  return (
                    <option key={id} value={id}>
                      {emp.razon_social || emp.nombre_comercial || emp.nombre}
                    </option>
                  )
                })
              )}
            </select>
          </div>

          <div className="md:col-span-6">
            <label className="block font-semibold text-slate-600 uppercase mb-1 text-[10px] tracking-wider">
              Sucursal *
            </label>
            <div className="relative flex items-center">
              <MapPin className="w-3.5 h-3.5 text-slate-400 left-2.5 absolute pointer-events-none" />
              <select
                value={sucursalId}
                onChange={handleCambioSucursal}
                disabled={!isMounted || sucursales.length === 0}
                suppressHydrationWarning
                className="w-full bg-slate-50/60 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 font-medium text-slate-800 outline-none focus:border-indigo-500 disabled:opacity-60"
              >
                {sucursales.length === 0 ? (
                  <option value="">-- Sin sucursales disponibles --</option>
                ) : (
                  sucursales.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.nombre} ({s.codigo_sucursal})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Fila 2: N° Resolución, Fecha Expedición y Fecha Vigencia Hasta */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <label className="block font-semibold text-slate-600 uppercase mb-1 text-[10px] tracking-wider">
              N° Resolución DIAN *
            </label>
            <input
              type="text"
              value={numeroResolucion}
              onChange={(e) => setNumeroResolucion(e.target.value)}
              placeholder="Ej: 18760000001"
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="block font-semibold text-slate-600 uppercase mb-1 text-[10px] tracking-wider">
              Fecha Expedición *
            </label>
            <input
              type="date"
              value={fechaExpedicion}
              onChange={(e) => setFechaExpedicion(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="block font-semibold text-slate-600 uppercase mb-1 text-[10px] tracking-wider">
              Fecha Vigencia Hasta *
            </label>
            <input
              type="date"
              value={fechaVigenciaHasta}
              onChange={(e) => setFechaVigenciaHasta(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
              required
            />
          </div>
        </div>

        {/* Fila 3: Prefijo (opcional) y Consecutivos en la misma línea */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-600 uppercase mb-1 text-[10px] tracking-wider">
              Prefijo
            </label>
            <input
              type="text"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="Opcional"
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold uppercase outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block font-semibold text-slate-600 uppercase mb-1 text-[10px] tracking-wider">
              Consecutivo Inicial *
            </label>
            <input
              type="number"
              min="1"
              value={consecutivoInicial}
              onChange={(e) => setConsecutivoInicial(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="block font-semibold text-slate-600 uppercase mb-1 text-[10px] tracking-wider">
              Consecutivo Final *
            </label>
            <input
              type="number"
              min="1"
              value={consecutivoFinal}
              onChange={(e) => setConsecutivoFinal(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={loading || !empresaId || !sucursalId}
              className="w-full md:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm text-xs disabled:opacity-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? 'Guardando...' : 'Guardar Resolución DIAN'}
            </button>
          </div>
        </div>
      </form>

      {/* Barra de Búsqueda y Filtro */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="md:col-span-9 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por prefijo, N° resolución o sucursal..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition"
          />
          {filtroBusqueda && (
            <button
              type="button"
              onClick={() => setFiltroBusqueda('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="md:col-span-3">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full h-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="">Estados (Todos)</option>
            <option value="ACTIVA">Activas</option>
            <option value="INACTIVA">Inactivas</option>
          </select>
        </div>
      </div>

      {/* Listado de Resoluciones */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-slate-600 font-bold border-b text-[10px] uppercase tracking-wider">
            <tr>
              <th className="p-3">Prefijo</th>
              <th className="p-3">N° Resolución</th>
              <th className="p-3">Sucursal</th>
              <th className="p-3 text-center">Rango Autorizado</th>
              <th className="p-3 text-center">Actual Usado</th>
              <th className="p-3 text-center">Vigencia Hasta</th>
              <th className="p-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y text-[11px]">
            {loadingTabla ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  Cargando resoluciones...
                </td>
              </tr>
            ) : resolucionesFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                  {filtroBusqueda || filtroEstado
                    ? 'No hay resoluciones que coincidan con la búsqueda.'
                    : 'No hay resoluciones registradas para esta empresa.'}
                </td>
              </tr>
            ) : (
              resolucionesFiltradas.map((r) => {
                const vigente = esResolucionVigente(r)
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-indigo-700 font-mono text-xs">
                      {r.prefijo ? r.prefijo : <span className="text-slate-400 font-normal">-</span>}
                    </td>
                    <td className="p-3 font-medium text-slate-800">{r.numero_resolucion}</td>
                    <td className="p-3 text-slate-600">
                      {nombresSucursalesMap.get(String(r.sucursal_id)) || `Sucursal #${r.sucursal_id}`}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600">
                      {r.consecutivo_inicial} al {r.consecutivo_final}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-emerald-700">
                      {r.consecutivo_actual}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600">
                      {r.fecha_vigencia_hasta}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          vigente
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {vigente ? 'ACTIVA' : 'INACTIVA'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}