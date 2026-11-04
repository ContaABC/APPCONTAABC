'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react'

export default function TercerosPage() {
  const [mounted, setMounted] = useState(false)
  const [empresas, setEmpresas] = useState([])
  const [empresaId, setEmpresaId] = useState('')
  const [todosLosTerceros, setTodosLosTerceros] = useState([])
  const [cargando, setCargando] = useState(false)
  const [hasBuscado, setHasBuscado] = useState(false)

  const [conceptosRetencion, setConceptosRetencion] = useState([])

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const registrosPorPagina = 10

  // Modales
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensajeForm, setMensajeForm] = useState({ tipo: '', texto: '' })

  // Formulario
  const [formulario, setFormulario] = useState({
    id: null,
    tipo_persona: 'JURIDICA',
    tipo_documento: '31',
    numero_identificacion: '',
    dv: '',
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    razon_social: '',
    nombre_comercial: '',
    codigo_dane: '68001',
    ciudad: 'Bucaramanga',
    departamento_estado: 'Santander',
    direccion: '',
    email: '',
    telefono: '',
    codigo_ciiu: '',
    codigo_ciiu_2: '',
    codigo_ciiu_3: '',
    codigo_ciiu_4: '',
    regimen_fiscal: '48',
    responsabilidad_tributaria: 'O-13',
    retencion_renta_id: '',
    retencion_iva_id: '',
    retencion_ica_id: '',
    es_cliente: false,
    es_proveedor: false,
    es_empleado: false,
    es_arrendador: false,
    estado: 'ACTIVO',
  })

  useEffect(() => {
    setMounted(true)
    cargarEmpresas()
  }, [])

  useEffect(() => {
    if (mounted && empresaId) {
      setTodosLosTerceros([])
      setHasBuscado(false)
      setPaginaActual(1)
      cargarConceptosRetencion(empresaId)
    }
  }, [empresaId, mounted])

  const cargarEmpresas = async () => {
    try {
      const res = await fetch('/api/empresas/listar')
      if (res.ok) {
        const data = await res.json()
        const listaEmpresas = data.empresas || data.data || (Array.isArray(data) ? data : [])
        setEmpresas(listaEmpresas)

        const idGuardado = localStorage.getItem('empresa_id')
        if (idGuardado && listaEmpresas.some((e) => e.id.toString() === idGuardado.toString())) {
          setEmpresaId(idGuardado)
        } else if (listaEmpresas.length > 0) {
          setEmpresaId(listaEmpresas[0].id)
          localStorage.setItem('empresa_id', listaEmpresas[0].id)
        }
      }
    } catch (err) {
      console.error('Error al cargar empresas:', err)
    }
  }

  const cargarConceptosRetencion = async (idEmpresa) => {
    try {
      const res = await fetch(`/api/conceptos-retencion?empresa_id=${idEmpresa}`)
      if (res.ok) {
        const data = await res.json()
        setConceptosRetencion(data.conceptos || [])
      }
    } catch (err) {
      console.error('Error al cargar conceptos de retención:', err)
    }
  }

  // Filtrar conceptos por tipo de retención normalizado
  const conceptosRenta = useMemo(() => {
    return conceptosRetencion.filter(
      (c) => (c.tipo_retencion || '').toUpperCase() === 'RENTA'
    )
  }, [conceptosRetencion])

  const conceptosIva = useMemo(() => {
    return conceptosRetencion.filter(
      (c) => (c.tipo_retencion || '').toUpperCase() === 'IVA'
    )
  }, [conceptosRetencion])

  const conceptosIca = useMemo(() => {
    return conceptosRetencion.filter(
      (c) => (c.tipo_retencion || '').toUpperCase() === 'ICA'
    )
  }, [conceptosRetencion])

  const buscarTerceros = async () => {
    if (!empresaId) return
    setCargando(true)
    setHasBuscado(true)
    try {
      const res = await fetch(`/api/terceros?empresa_id=${empresaId}`)
      const data = await res.json()

      if (res.ok && data.exito) {
        setTodosLosTerceros(data.terceros || [])
      } else {
        setTodosLosTerceros([])
      }
    } catch (err) {
      console.error('Error al cargar terceros:', err)
      setTodosLosTerceros([])
    } finally {
      setCargando(false)
    }
  }

  const tercerosFiltrados = useMemo(() => {
    return todosLosTerceros.filter((item) => {
      const termino = busqueda.toLowerCase().trim()
      const coincideTexto =
        !termino ||
        (item.numero_identificacion && item.numero_identificacion.toLowerCase().includes(termino)) ||
        (item.razon_social && item.razon_social.toLowerCase().includes(termino)) ||
        (item.nombre_comercial && item.nombre_comercial.toLowerCase().includes(termino))

      let coincideTipo = true
      if (filtroTipo === 'CLIENTE') coincideTipo = !!item.es_cliente
      if (filtroTipo === 'PROVEEDOR') coincideTipo = !!item.es_proveedor
      if (filtroTipo === 'EMPLEADO') coincideTipo = !!item.es_empleado
      if (filtroTipo === 'ARRENDADOR') coincideTipo = !!item.es_arrendador

      let coincideEstado = true
      if (filtroEstado !== 'TODOS') {
        coincideEstado = item.estado === filtroEstado
      }

      return coincideTexto && coincideTipo && coincideEstado
    })
  }, [todosLosTerceros, busqueda, filtroTipo, filtroEstado])

  useEffect(() => {
    setPaginaActual(1)
  }, [busqueda, filtroTipo, filtroEstado])

  const calcularDV = (nit) => {
    if (!nit || isNaN(nit)) return ''
    const vpri = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
    const z = nit.toString().length
    let x = 0
    let y = 0

    for (let i = 0; i < z; i++) {
      y = parseInt(nit.substr(i, 1), 10)
      x += y * vpri[z - (i + 1)]
    }

    y = x % 11
    return y > 1 ? (11 - y).toString() : y.toString()
  }

  const handleTipoPersonaChange = (nuevoTipo) => {
    setFormulario((prev) => {
      const esJuridica = nuevoTipo === 'JURIDICA'

      return {
        ...prev,
        tipo_persona: nuevoTipo,
        tipo_documento: esJuridica ? '31' : '13',
        dv: esJuridica ? calcularDV(prev.numero_identificacion) : '',
        primer_nombre: '',
        segundo_nombre: '',
        primer_apellido: '',
        segundo_apellido: '',
        razon_social: '',
        nombre_comercial: '',
        codigo_ciiu_2: '',
        codigo_ciiu_3: '',
        codigo_ciiu_4: '',
        responsabilidad_tributaria: esJuridica ? 'O-13' : 'R-99-PN',
        es_empleado: !esJuridica,
        es_cliente: false,
        es_proveedor: false,
        es_arrendador: false,
      }
    })
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    let valorFinal = type === 'checkbox' ? checked : value

    if (name === 'numero_identificacion') {
      valorFinal = value.replace(/\D/g, '').slice(0, 12)
    }

    if (name === 'dv') {
      valorFinal = value.replace(/\D/g, '').slice(0, 1)
    }

    if (['codigo_ciiu', 'codigo_ciiu_2', 'codigo_ciiu_3', 'codigo_ciiu_4'].includes(name)) {
      valorFinal = value.replace(/\D/g, '').slice(0, 4)
    }

    if (
      [
        'primer_nombre',
        'segundo_nombre',
        'primer_apellido',
        'segundo_apellido',
        'razon_social',
        'nombre_comercial',
      ].includes(name) &&
      typeof valorFinal === 'string'
    ) {
      valorFinal = valorFinal.toUpperCase()
    }

    let nuevoEstado = { ...formulario, [name]: valorFinal }

    if (name === 'numero_identificacion') {
      if (formulario.tipo_persona === 'JURIDICA' || nuevoEstado.tipo_documento === '31') {
        nuevoEstado.dv = calcularDV(valorFinal)
      } else {
        nuevoEstado.dv = ''
      }
    }

    if (
      formulario.tipo_persona === 'NATURAL' &&
      ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'].includes(name)
    ) {
      const pNombre = name === 'primer_nombre' ? valorFinal : formulario.primer_nombre
      const sNombre = name === 'segundo_nombre' ? valorFinal : formulario.segundo_nombre
      const pApellido = name === 'primer_apellido' ? valorFinal : formulario.primer_apellido
      const sApellido = name === 'segundo_apellido' ? valorFinal : formulario.segundo_apellido

      nuevoEstado.razon_social = `${pNombre} ${sNombre} ${pApellido} ${sApellido}`
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
    }

    setFormulario(nuevoEstado)
  }

  const handleCodigoDaneChange = async (e) => {
    const codigo = e.target.value.replace(/\D/g, '').slice(0, 5)
    setFormulario((prev) => ({ ...prev, codigo_dane: codigo }))

    if (codigo.trim().length === 5) {
      try {
        const res = await fetch(`/api/ubicaciones?codigo_dane=${codigo.trim()}`)
        const json = await res.json()

        if (res.ok && json.exito && json.datos) {
          setFormulario((prev) => ({
            ...prev,
            ciudad: json.datos.municipio || '',
            departamento_estado: json.datos.departamento || '',
          }))
        } else {
          setFormulario((prev) => ({
            ...prev,
            ciudad: '',
            departamento_estado: '',
          }))
        }
      } catch (err) {
        console.error('Error consultando API de ubicaciones:', err)
      }
    }
  }

  const abrirModalNuevo = () => {
    setMensajeForm({ tipo: '', texto: '' })
    setFormulario({
      id: null,
      tipo_persona: 'JURIDICA',
      tipo_documento: '31',
      numero_identificacion: '',
      dv: '',
      primer_nombre: '',
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      razon_social: '',
      nombre_comercial: '',
      codigo_dane: '68001',
      ciudad: 'Bucaramanga',
      departamento_estado: 'Santander',
      direccion: '',
      email: '',
      telefono: '',
      codigo_ciiu: '',
      codigo_ciiu_2: '',
      codigo_ciiu_3: '',
      codigo_ciiu_4: '',
      regimen_fiscal: '48',
      responsabilidad_tributaria: 'O-13',
      retencion_renta_id: '',
      retencion_iva_id: '',
      retencion_ica_id: '',
      es_cliente: false,
      es_proveedor: false,
      es_empleado: false,
      es_arrendador: false,
      estado: 'ACTIVO',
    })
    setModalAbierto(true)
  }

  const abrirModalEditar = (item) => {
    setMensajeForm({ tipo: '', texto: '' })

    const esJuridica =
      String(item.tipo_documento) === '31' ||
      item.tipo_persona === 'JURIDICA' ||
      (item.dv !== null && item.dv !== undefined && item.dv !== '')

    setFormulario({
      ...item,
      id: item.id,
      tipo_persona: esJuridica ? 'JURIDICA' : 'NATURAL',
      tipo_documento: item.tipo_documento ? String(item.tipo_documento) : esJuridica ? '31' : '13',
      primer_nombre: (item.primer_nombre || '').toUpperCase(),
      segundo_nombre: (item.segundo_nombre || '').toUpperCase(),
      primer_apellido: (item.primer_apellido || '').toUpperCase(),
      segundo_apellido: (item.segundo_apellido || '').toUpperCase(),
      razon_social: (item.razon_social || '').toUpperCase(),
      nombre_comercial: (item.nombre_comercial || '').toUpperCase(),
      telefono: item.telefono || item.telefono_principal || '',
      departamento_estado: item.departamento_estado || item.departamento || '',
      codigo_ciiu: item.codigo_ciiu || '',
      codigo_ciiu_2: item.codigo_ciiu_2 || '',
      codigo_ciiu_3: item.codigo_ciiu_3 || '',
      codigo_ciiu_4: item.codigo_ciiu_4 || '',
      regimen_fiscal: item.regimen_fiscal || '48',
      responsabilidad_tributaria: item.responsabilidad_tributaria || (esJuridica ? 'O-13' : 'R-99-PN'),
      retencion_renta_id: item.retencion_renta_id || '',
      retencion_iva_id: item.retencion_iva_id || '',
      retencion_ica_id: item.retencion_ica_id || '',
    })
    setModalAbierto(true)
  }

  const handleSubmitFormulario = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setMensajeForm({ tipo: '', texto: '' })

    try {
      const url = '/api/terceros'
      const method = formulario.id ? 'PUT' : 'POST'

      const payload = {
        ...formulario,
        empresa_id: empresaId,
        dv: formulario.tipo_persona === 'JURIDICA' ? formulario.dv : null,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok && data.exito) {
        setMensajeForm({
          tipo: 'exito',
          texto: formulario.id ? 'Tercero actualizado con éxito.' : 'Tercero creado con éxito.',
        })
        if (hasBuscado) buscarTerceros()
        setTimeout(() => setModalAbierto(false), 800)
      } else {
        setMensajeForm({
          tipo: 'error',
          texto: data.mensaje || data.error || 'No se pudo insertar o actualizar el tercero en la BD.',
        })
      }
    } catch (err) {
      setMensajeForm({ tipo: 'error', texto: 'Error de conexión con el servidor.' })
    } finally {
      setGuardando(false)
    }
  }

  const toggleEstadoTercero = async (item) => {
    const nuevoEstado = item.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    try {
      const res = await fetch('/api/terceros', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, estado: nuevoEstado }),
      })

      if (res.ok) buscarTerceros()
    } catch (err) {
      console.error('Error al cambiar estado:', err)
    }
  }

  const eliminarTercero = async (id, razonSocial) => {
    if (!confirm(`¿Está seguro de eliminar a "${razonSocial}"?`)) return
    try {
      const res = await fetch(`/api/terceros?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.exito) buscarTerceros()
      else alert(data.mensaje || 'No se pudo eliminar.')
    } catch (err) {
      console.error('Error al eliminar:', err)
    }
  }

  const totalPaginas = Math.ceil(tercerosFiltrados.length / registrosPorPagina) || 1
  const indicePrimer = (paginaActual - 1) * registrosPorPagina
  const indiceUltimo = indicePrimer + registrosPorPagina
  const tercerosPaginados = tercerosFiltrados.slice(indicePrimer, indiceUltimo)

  if (!mounted) return null

  const isNatural = formulario.tipo_persona === 'NATURAL'

  return (
    <div className="min-h-screen bg-gray-100 p-3 md:p-6 text-gray-800">
      {/* BARRA SUPERIOR DE FILTROS */}
      <div className="max-w-7xl mx-auto mb-4 bg-white p-3 md:p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="w-full lg:w-72">
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
              Empresa Activa *
            </label>
            <select
              value={empresaId}
              onChange={(e) => {
                setEmpresaId(e.target.value)
                if (e.target.value) localStorage.setItem('empresa_id', e.target.value)
              }}
              className="w-full border-2 border-blue-500 rounded-md p-1.5 text-sm bg-blue-50 font-semibold text-blue-900 focus:outline-none"
            >
              <option value="">-- Seleccione una Empresa --</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.razon_social || emp.nombre_comercial || emp.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                disabled={!empresaId}
                placeholder="Buscar por NIT o Nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-3 pr-3 py-1.5 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
              />
            </div>

            <select
              disabled={!empresaId}
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="border rounded-md p-1.5 text-sm bg-white focus:outline-none disabled:bg-gray-100"
            >
              <option value="TODOS">Todos los Tipos</option>
              <option value="CLIENTE">Clientes</option>
              <option value="PROVEEDOR">Proveedores</option>
              <option value="EMPLEADO">Empleados</option>
              <option value="ARRENDADOR">Arrendadores</option>
            </select>

            <select
              disabled={!empresaId}
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="border rounded-md p-1.5 text-sm bg-white focus:outline-none disabled:bg-gray-100"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
            </select>

            <button
              disabled={!empresaId || cargando}
              onClick={buscarTerceros}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              Buscar
            </button>

            <button
              disabled={!empresaId}
              onClick={abrirModalNuevo}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo Tercero
            </button>
          </div>
        </div>
      </div>

      {/* TABLA DE RESULTADOS */}
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {!empresaId ? (
          <div className="p-8 text-center text-amber-600 font-medium text-sm">
            ⚠️ Seleccione una empresa para poder buscar y administrar sus terceros.
          </div>
        ) : !hasBuscado ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            🔍 Haga clic en <strong>"Buscar"</strong> para visualizar los terceros de esta empresa.
          </div>
        ) : cargando ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Cargando registros...
          </div>
        ) : tercerosPaginados.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No se encontraron terceros que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-[11px] font-semibold text-gray-600 uppercase">
                  <th className="p-3">Identificación</th>
                  <th className="p-3">Razón Social / Nombre</th>
                  <th className="p-3">Ubicación</th>
                  <th className="p-3">Contacto</th>
                  <th className="p-3">Clasificación</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {tercerosPaginados.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-mono font-medium text-gray-900">
                      {item.numero_identificacion}
                      {item.dv !== null && item.dv !== undefined && item.dv !== '' && (
                        <span className="text-gray-400">-{item.dv}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-800 uppercase">{item.razon_social}</div>
                      {item.nombre_comercial && (
                        <div className="text-[10px] text-gray-500 uppercase">{item.nombre_comercial}</div>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">
                      <div>{item.ciudad || '-'}</div>
                      <div className="text-[10px] text-gray-400">{item.departamento_estado || ''}</div>
                    </td>
                    <td className="p-3 text-gray-600">
                      <div>{item.email || '-'}</div>
                      <div className="text-[10px] text-gray-400">{item.telefono || '-'}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {item.es_cliente && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-800 font-medium">
                            Cliente
                          </span>
                        )}
                        {item.es_proveedor && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-800 font-medium">
                            Proveedor
                          </span>
                        )}
                        {item.es_empleado && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-800 font-medium">
                            Empleado
                          </span>
                        )}
                        {item.es_arrendador && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-100 text-emerald-800 font-medium">
                            Arrendador
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleEstadoTercero(item)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                          item.estado === 'ACTIVO'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {item.estado === 'ACTIVO' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {item.estado}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirModalEditar(item)}
                          className="p-1 hover:bg-gray-100 rounded text-blue-600"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => eliminarTercero(item.id, item.razon_social)}
                          className="p-1 hover:bg-gray-100 rounded text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINACIÓN */}
        {empresaId && hasBuscado && totalPaginas > 1 && (
          <div className="p-3 border-t flex items-center justify-between text-xs text-gray-600">
            <div>
              Mostrando {indicePrimer + 1} a {Math.min(indiceUltimo, tercerosFiltrados.length)} de{' '}
              {tercerosFiltrados.length} registros
            </div>
            <div className="flex gap-2">
              <button
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((prev) => prev - 1)}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="px-2 py-1 font-semibold text-gray-800">
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                disabled={paginaActual === totalPaginas}
                onClick={() => setPaginaActual((prev) => prev + 1)}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL FORMULARIO NUEVO / EDITAR */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[96vh] flex flex-col my-auto">
            <div className="px-4 py-2.5 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-xs font-bold text-gray-800">
                {formulario.id ? 'Editar Tercero' : 'Nuevo Tercero'}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitFormulario} className="p-4 space-y-2.5 overflow-y-auto text-[11px] flex-1">
              {mensajeForm.texto && (
                <div
                  className={`p-1.5 rounded text-[11px] ${
                    mensajeForm.tipo === 'exito' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {mensajeForm.texto}
                </div>
              )}

              {/* FILA 1: TIPO PERSONA (IZQ) Y CLASIFICACIÓN (DER) */}
              <div className="bg-blue-50/60 border border-blue-200 px-3 py-1.5 rounded flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-blue-900 uppercase text-[10px]">Tipo:</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1 cursor-pointer font-semibold text-gray-700 h-6">
                      <input
                        type="radio"
                        name="tipo_persona"
                        value="JURIDICA"
                        disabled={!!formulario.id}
                        checked={formulario.tipo_persona === 'JURIDICA'}
                        onChange={() => handleTipoPersonaChange('JURIDICA')}
                        className="text-blue-600"
                      />
                      Jurídica
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer font-semibold text-gray-700 h-6">
                      <input
                        type="radio"
                        name="tipo_persona"
                        value="NATURAL"
                        disabled={!!formulario.id}
                        checked={formulario.tipo_persona === 'NATURAL'}
                        onChange={() => handleTipoPersonaChange('NATURAL')}
                        className="text-blue-600"
                      />
                      Natural
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-blue-900 uppercase text-[10px] hidden md:inline">Clasif:</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center space-x-1 cursor-pointer h-6">
                      <input
                        type="checkbox"
                        name="es_cliente"
                        disabled={isNatural}
                        checked={formulario.es_cliente}
                        onChange={handleInputChange}
                        className="rounded text-blue-600"
                      />
                      <span>Cliente</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer h-6">
                      <input
                        type="checkbox"
                        name="es_proveedor"
                        disabled={isNatural}
                        checked={formulario.es_proveedor}
                        onChange={handleInputChange}
                        className="rounded text-blue-600"
                      />
                      <span>Proveedor</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer h-6">
                      <input
                        type="checkbox"
                        name="es_empleado"
                        disabled={!isNatural}
                        checked={formulario.es_empleado}
                        onChange={handleInputChange}
                        className="rounded text-blue-600"
                      />
                      <span className="font-bold text-blue-900">Empleado</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer h-6">
                      <input
                        type="checkbox"
                        name="es_arrendador"
                        disabled={isNatural}
                        checked={formulario.es_arrendador}
                        onChange={handleInputChange}
                        className="rounded text-blue-600"
                      />
                      <span>Arrendador</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* FILA 2: DOCUMENTO, NÚMERO, DV Y RESPONSABILIDAD TRIBUTARIA */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    Tipo Doc *
                  </label>
                  <select
                    name="tipo_documento"
                    value={formulario.tipo_documento}
                    onChange={handleInputChange}
                    disabled={!!formulario.id}
                    className="w-full border rounded h-7 px-1 bg-white text-[10px] disabled:bg-gray-100"
                  >
                    {formulario.tipo_persona === 'JURIDICA' ? (
                      <option value="31">31 - NIT</option>
                    ) : (
                      <>
                        <option value="13">13 - Cédula</option>
                        <option value="22">22 - Extranjería</option>
                        <option value="41">41 - Pasaporte</option>
                        <option value="11">11 - Reg. Civil</option>
                        <option value="12">12 - T. Identidad</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    Número ID * (máx 12)
                  </label>
                  <input
                    type="text"
                    name="numero_identificacion"
                    maxLength={12}
                    value={formulario.numero_identificacion}
                    onChange={handleInputChange}
                    disabled={!!formulario.id}
                    required
                    className="w-full border rounded h-7 px-1.5 font-mono text-[11px] disabled:bg-gray-100"
                    placeholder="Máx 12"
                  />
                </div>

                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">DV</label>
                  <input
                    type="text"
                    name="dv"
                    maxLength={1}
                    value={formulario.dv || ''}
                    onChange={handleInputChange}
                    disabled={!isNatural}
                    className="w-full border rounded h-7 px-1 bg-gray-50 font-mono text-center font-bold text-gray-700 text-[11px]"
                  />
                </div>

                <div className="col-span-9 sm:col-span-6">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    Responsabilidad Tributaria
                  </label>
                  <select
                    name="responsabilidad_tributaria"
                    value={formulario.responsabilidad_tributaria || (isNatural ? 'R-99-PN' : 'O-13')}
                    onChange={handleInputChange}
                    disabled={isNatural}
                    className="w-full border rounded h-7 px-1.5 bg-white text-[10px] disabled:bg-gray-100 disabled:text-gray-400 truncate"
                  >
                    <option value="O-13">O-13 Gran Contribuyente</option>
                    <option value="O-15">O-15 Autorretenedor</option>
                    <option value="O-23">O-23 Agente de Retención IVA</option>
                    <option value="R-99-PN">R-99-PN No Aplica / Persona Natural</option>
                  </select>
                </div>
              </div>

              {/* NOMBRES PERSONA NATURAL */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    1er Nombre
                  </label>
                  <input
                    type="text"
                    name="primer_nombre"
                    disabled={!isNatural}
                    value={formulario.primer_nombre || ''}
                    onChange={handleInputChange}
                    className="w-full border rounded h-7 px-1.5 uppercase text-[11px] disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    2do Nombre
                  </label>
                  <input
                    type="text"
                    name="segundo_nombre"
                    disabled={!isNatural}
                    value={formulario.segundo_nombre || ''}
                    onChange={handleInputChange}
                    className="w-full border rounded h-7 px-1.5 uppercase text-[11px] disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    1er Apellido
                  </label>
                  <input
                    type="text"
                    name="primer_apellido"
                    disabled={!isNatural}
                    value={formulario.primer_apellido || ''}
                    onChange={handleInputChange}
                    className="w-full border rounded h-7 px-1.5 uppercase text-[11px] disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    2do Apellido
                  </label>
                  <input
                    type="text"
                    name="segundo_apellido"
                    disabled={!isNatural}
                    value={formulario.segundo_apellido || ''}
                    onChange={handleInputChange}
                    className="w-full border rounded h-7 px-1.5 uppercase text-[11px] disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* RAZÓN SOCIAL / NOMBRE COMERCIAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    Razón Social / Nombre Completo *
                  </label>
                  <input
                    type="text"
                    name="razon_social"
                    disabled={isNatural}
                    value={formulario.razon_social}
                    onChange={handleInputChange}
                    required
                    className="w-full border rounded h-7 px-1.5 font-medium uppercase text-[11px] disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    Nombre Comercial
                  </label>
                  <input
                    type="text"
                    name="nombre_comercial"
                    disabled={isNatural}
                    value={formulario.nombre_comercial || ''}
                    onChange={handleInputChange}
                    className="w-full border rounded h-7 px-1.5 uppercase text-[11px] disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* FILA DE CÓDIGOS CIIU (4 CAMPOS COMPACTOS DE 4 DÍGITOS) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-amber-50/40 p-2 rounded border border-amber-200 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                    CIIU 1 (Principal)
                  </label>
                  <input
                    type="text"
                    name="codigo_ciiu"
                    placeholder="4 díg"
                    maxLength={4}
                    value={formulario.codigo_ciiu || ''}
                    onChange={handleInputChange}
                    className="w-full border border-amber-300 rounded h-7 px-1.5 bg-white font-mono text-[11px]"
                    title="Código CIIU Rev. 5 A.C. Principal (4 dígitos)"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                    CIIU 2
                  </label>
                  <input
                    type="text"
                    name="codigo_ciiu_2"
                    placeholder="4 díg"
                    maxLength={4}
                    disabled={isNatural}
                    value={formulario.codigo_ciiu_2 || ''}
                    onChange={handleInputChange}
                    className="w-full border border-amber-300 rounded h-7 px-1.5 bg-white font-mono text-[11px] disabled:bg-gray-100 disabled:text-gray-400"
                    title="Segundo código CIIU"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                    CIIU 3
                  </label>
                  <input
                    type="text"
                    name="codigo_ciiu_3"
                    placeholder="4 díg"
                    maxLength={4}
                    disabled={isNatural}
                    value={formulario.codigo_ciiu_3 || ''}
                    onChange={handleInputChange}
                    className="w-full border border-amber-300 rounded h-7 px-1.5 bg-white font-mono text-[11px] disabled:bg-gray-100 disabled:text-gray-400"
                    title="Tercer código CIIU"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                    CIIU 4
                  </label>
                  <input
                    type="text"
                    name="codigo_ciiu_4"
                    placeholder="4 díg"
                    maxLength={4}
                    disabled={isNatural}
                    value={formulario.codigo_ciiu_4 || ''}
                    onChange={handleInputChange}
                    className="w-full border border-amber-300 rounded h-7 px-1.5 bg-white font-mono text-[11px] disabled:bg-gray-100 disabled:text-gray-400"
                    title="Cuarto código CIIU"
                  />
                </div>
              </div>

              {/* FILA DE RETENCIONES FILTRADAS, COMPACTAS Y TRUNCADAS (45 CARACTERES) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-blue-50/40 p-2 rounded border border-blue-200 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-blue-900 uppercase mb-0.5">
                    Ret. Renta
                  </label>
                  <select
                    name="retencion_renta_id"
                    value={formulario.retencion_renta_id || ''}
                    onChange={handleInputChange}
                    className="w-full border border-blue-300 rounded h-7 px-1 bg-white text-[10px] truncate"
                  >
                    <option value="">-- Seleccione --</option>
                    {conceptosRenta.map((c) => {
                      const tarifaPorcentaje = (Number(c.tarifa || 0) * 100).toFixed(2)
                      const conceptoLargo = c.concepto || c.descripcion || ''
                      const conceptoCorto = conceptoLargo.length > 45 
                        ? `${conceptoLargo.substring(0, 45)}...` 
                        : conceptoLargo
                      const codigoStr = c.codigo ? `${c.codigo} - ` : ''
                      
                      return (
                        <option key={c.id} value={c.id} title={`${conceptoLargo} (${tarifaPorcentaje}%)`}>
                          {`${codigoStr}${conceptoCorto} (${tarifaPorcentaje}%)`}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-blue-900 uppercase mb-0.5">
                    Ret. IVA
                  </label>
                  <select
                    name="retencion_iva_id"
                    value={formulario.retencion_iva_id || ''}
                    onChange={handleInputChange}
                    className="w-full border border-blue-300 rounded h-7 px-1 bg-white text-[10px] truncate"
                  >
                    <option value="">-- Seleccione --</option>
                    {conceptosIva.map((c) => {
                      const tarifaPorcentaje = (Number(c.tarifa || 0) * 100).toFixed(2)
                      const conceptoLargo = c.concepto || c.descripcion || ''
                      const conceptoCorto = conceptoLargo.length > 45 
                        ? `${conceptoLargo.substring(0, 45)}...` 
                        : conceptoLargo
                      const codigoStr = c.codigo ? `${c.codigo} - ` : ''

                      return (
                        <option key={c.id} value={c.id} title={`${conceptoLargo} (${tarifaPorcentaje}%)`}>
                          {`${codigoStr}${conceptoCorto} (${tarifaPorcentaje}%)`}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-blue-900 uppercase mb-0.5">
                    Ret. ICA
                  </label>
                  <select
                    name="retencion_ica_id"
                    value={formulario.retencion_ica_id || ''}
                    onChange={handleInputChange}
                    className="w-full border border-blue-300 rounded h-7 px-1 bg-white text-[10px] truncate"
                  >
                    <option value="">-- Seleccione --</option>
                    {conceptosIca.map((c) => {
                      const tarifaPorMil = (Number(c.tarifa || 0) * 1000).toFixed(2)
                      const conceptoLargo = c.concepto || c.descripcion || ''
                      const conceptoCorto = conceptoLargo.length > 45 
                        ? `${conceptoLargo.substring(0, 45)}...` 
                        : conceptoLargo
                      const codigoStr = c.codigo ? `${c.codigo} - ` : ''

                      return (
                        <option key={c.id} value={c.id} title={`${conceptoLargo} (${tarifaPorMil}‰)`}>
                          {`${codigoStr}${conceptoCorto} (${tarifaPorMil}‰)`}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {/* UBICACIÓN CON DANE - COMPACTO */}
              <div className="grid grid-cols-12 gap-2 bg-gray-50 p-2 rounded border items-end">
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-[10px] font-bold text-blue-900 uppercase mb-0.5">
                    DANE *
                  </label>
                  <input
                    type="text"
                    name="codigo_dane"
                    maxLength={5}
                    value={formulario.codigo_dane || ''}
                    onChange={handleCodigoDaneChange}
                    className="w-full border border-blue-400 rounded h-7 px-1.5 font-mono font-bold text-blue-900 bg-white text-[11px]"
                    placeholder="5 díg"
                  />
                </div>
                <div className="col-span-8 sm:col-span-5">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    Ciudad / Municipio
                  </label>
                  <input
                    type="text"
                    name="ciudad"
                    readOnly
                    value={formulario.ciudad || ''}
                    className="w-full border rounded h-7 px-1.5 bg-gray-100 font-medium text-gray-700 text-[11px]"
                  />
                </div>
                <div className="col-span-12 sm:col-span-5">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                    Departamento
                  </label>
                  <input
                    type="text"
                    name="departamento_estado"
                    readOnly
                    value={formulario.departamento_estado || ''}
                    className="w-full border rounded h-7 px-1.5 bg-gray-100 font-medium text-gray-700 text-[11px]"
                  />
                </div>
              </div>

              {/* CONTACTO */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formulario.email || ''}
                    onChange={handleInputChange}
                    className="w-full border rounded h-7 px-1.5 text-[11px]"
                  />
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Teléfono</label>
                  <input
                    type="text"
                    name="telefono"
                    value={formulario.telefono || ''}
                    onChange={handleInputChange}
                    className="w-full border rounded h-7 px-1.5 text-[11px]"
                  />
                </div>
                <div className="col-span-12 sm:col-span-5">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Dirección</label>
                  <input
                    type="text"
                    name="direccion"
                    value={formulario.direccion || ''}
                    onChange={handleInputChange}
                    className="w-full border rounded h-7 px-1.5 text-[11px]"
                  />
                </div>
              </div>

              {/* BOTONES */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-3.5 py-1.5 border rounded text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-[11px] font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : formulario.id ? 'Actualizar' : 'Guardar Tercero'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}