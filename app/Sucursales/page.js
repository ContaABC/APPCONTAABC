'use client'

import { useState, useEffect, useCallback } from 'react'

// ==========================================
// COMPONENTE: SUBFORMULARIO MODAL SUCURSAL
// ==========================================
function SubformularioSucursal({ empresas, empresaIdSeleccionada, sucursalEditar, onClose, onSave }) {
  const [departamentos, setDepartamentos] = useState([])
  const [municipios, setMunicipios] = useState([])
  const [cargandoUbicaciones, setCargandoUbicaciones] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorEmail, setErrorEmail] = useState('')

  const [formData, setFormData] = useState({
    empresa_id: empresaIdSeleccionada || '',
    codigo_sucursal: '',
    nombre: '',
    direccion: '',
    telefono: '',
    email: '',
    departamento: '',
    ciudad: '',
    codigo_dane: ''
  })

  // 1. Cargar la lista general de Departamentos Únicos
  useEffect(() => {
    async function cargarDepartamentos() {
      try {
        const res = await fetch('/api/ubicaciones')
        const data = await res.json()

        if (data.exito && Array.isArray(data.datos)) {
          setDepartamentos(data.datos)
        } else {
          setDepartamentos([])
        }
      } catch (err) {
        console.error('Error al cargar departamentos:', err)
        setDepartamentos([])
      }
    }
    cargarDepartamentos()
  }, [])

  // 2. Cargar Municipios pasando 'codigo_departamento' a la API
  const cargarMunicipiosPorCodigoDepto = useCallback(async (codDepto, ciudadActual = '', daneActual = '') => {
    if (!codDepto) {
      setMunicipios([])
      return
    }

    setCargandoUbicaciones(true)
    try {
      const res = await fetch(`/api/ubicaciones?codigo_departamento=${encodeURIComponent(codDepto)}`)
      const data = await res.json()

      if (data.exito && Array.isArray(data.datos)) {
        setMunicipios(data.datos)

        if (ciudadActual) {
          const munEncontrado = data.datos.find(
            (m) => m.municipio.toLowerCase().trim() === ciudadActual.toLowerCase().trim()
          )
          if (munEncontrado) {
            setFormData((prev) => ({ ...prev, codigo_dane: munEncontrado.codigo_municipio }))
          } else if (daneActual) {
            setFormData((prev) => ({ ...prev, codigo_dane: daneActual }))
          }
        }
      } else {
        setMunicipios([])
      }
    } catch (err) {
      console.error('Error al cargar municipios:', err)
      setMunicipios([])
    } finally {
      setCargandoUbicaciones(false)
    }
  }, [])

  // 3. Obtener consecutivo de código de la sucursal
  const obtenerCodigoAuto = async (empId) => {
    if (!empId) return
    try {
      const res = await fetch(`/api/sucursales?empresa_id=${empId}&accion=siguiente_codigo`)
      const data = await res.json()
      if (data.exito) {
        setFormData((prev) => ({ ...prev, codigo_sucursal: data.siguiente_codigo }))
      }
    } catch (err) {
      console.error('Error al obtener consecutivo:', err)
    }
  }

  // 4. Inicializar Estado al Editar o Crear
  useEffect(() => {
    if (sucursalEditar) {
      const depto = sucursalEditar.departamento || ''
      const ciud = sucursalEditar.ciudad || sucursalEditar.municipio || ''
      const dane = sucursalEditar.codigo_dane || ''

      setFormData({
        id: sucursalEditar.id,
        empresa_id: sucursalEditar.empresa_id || empresaIdSeleccionada || '',
        codigo_sucursal: sucursalEditar.codigo_sucursal || '',
        nombre: sucursalEditar.nombre || sucursalEditar.nombre_sucursal || '',
        direccion: sucursalEditar.direccion || '',
        telefono: sucursalEditar.telefono || '',
        email: sucursalEditar.email || '',
        departamento: depto,
        ciudad: ciud,
        codigo_dane: dane
      })

      if (depto && departamentos.length > 0) {
        const objDepto = departamentos.find(
          (d) => d.departamento.toLowerCase().trim() === depto.toLowerCase().trim()
        )
        if (objDepto) {
          cargarMunicipiosPorCodigoDepto(objDepto.codigo_departamento, ciud, dane)
        }
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        empresa_id: empresaIdSeleccionada || ''
      }))
      if (empresaIdSeleccionada) {
        obtenerCodigoAuto(empresaIdSeleccionada)
      }
    }
  }, [sucursalEditar, empresaIdSeleccionada, departamentos, cargarMunicipiosPorCodigoDepto])

  // Manejar cambio de Departamento
  const handleDepartamentoChange = (e) => {
    const nombreDeptoSel = e.target.value

    if (!nombreDeptoSel) {
      setFormData((prev) => ({
        ...prev,
        departamento: '',
        ciudad: '',
        codigo_dane: ''
      }))
      setMunicipios([])
      return
    }

    const objDepto = departamentos.find((d) => d.departamento === nombreDeptoSel)

    setFormData((prev) => ({
      ...prev,
      departamento: nombreDeptoSel,
      ciudad: '',
      codigo_dane: ''
    }))

    if (objDepto) {
      cargarMunicipiosPorCodigoDepto(objDepto.codigo_departamento)
    }
  }

  // Manejar cambio de Municipio
  const handleMunicipioChange = (e) => {
    const nombreMunSel = e.target.value

    if (!nombreMunSel) {
      setFormData((prev) => ({
        ...prev,
        ciudad: '',
        codigo_dane: ''
      }))
      return
    }

    const objMun = municipios.find((m) => m.municipio === nombreMunSel)

    setFormData((prev) => ({
      ...prev,
      ciudad: nombreMunSel,
      codigo_dane: objMun ? objMun.codigo_municipio : ''
    }))
  }

  const validarEmail = (email) => {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.empresa_id) {
      alert('Debes seleccionar una empresa.')
      return
    }

    if (formData.email && !validarEmail(formData.email)) {
      setErrorEmail('Formato de correo electrónico no válido.')
      return
    }

    setGuardando(true)

    // Payload dual para soportar cualquier tipo de validación/campo
    const payload = {
      ...formData,
      nombre: formData.nombre,
      nombre_sucursal: formData.nombre
    }

    try {
      const metodo = sucursalEditar ? 'PUT' : 'POST'
      const res = await fetch('/api/sucursales', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (data.exito) {
        onSave()
      } else {
        alert(data.mensaje || 'Error al guardar la sucursal.')
      }
    } catch (err) {
      console.error('Error en envío:', err)
      alert('Error de conexión al servidor.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="flex justify-between items-center pb-3 mb-3 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-800">
          {sucursalEditar ? 'Editar Sucursal' : 'Nueva Sucursal'}
        </h3>
        <button
          onClick={onClose}
          type="button"
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Empresa */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            Empresa *
          </label>
          <select
            value={formData.empresa_id}
            disabled
            className="w-full text-xs border border-gray-300 p-2 rounded-md bg-gray-100 font-semibold text-gray-700 cursor-not-allowed outline-none"
          >
            <option value="">-- Seleccione una Empresa --</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.razon_social || emp.nombre_comercial}
              </option>
            ))}
          </select>
        </div>

        {/* Código y Nombre */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Código
            </label>
            <input
              type="text"
              value={formData.codigo_sucursal}
              disabled
              className="w-full text-xs border border-gray-200 p-2 rounded-md bg-gray-50 font-mono font-bold text-gray-600"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Nombre Sucursal *
            </label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full text-xs border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            Correo Electrónico
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => {
              const val = e.target.value
              setFormData({ ...formData, email: val })
              setErrorEmail(val && !validarEmail(val) ? 'Formato de correo no válido' : '')
            }}
            className={`w-full text-xs border p-2 rounded-md outline-none ${
              errorEmail ? 'border-red-500' : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {errorEmail && <p className="text-red-500 text-[11px] mt-1">{errorEmail}</p>}
        </div>

        {/* Departamento y Municipio */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Departamento
            </label>
            <select
              value={formData.departamento}
              onChange={handleDepartamentoChange}
              className="w-full text-xs border border-gray-300 p-2 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Seleccionar --</option>
              {departamentos.map((d) => (
                <option key={d.codigo_departamento} value={d.departamento}>
                  {d.departamento}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Ciudad / Municipio
            </label>
            <select
              value={formData.ciudad}
              onChange={handleMunicipioChange}
              disabled={!formData.departamento || cargandoUbicaciones}
              className="w-full text-xs border border-gray-300 p-2 rounded-md bg-white disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">
                {cargandoUbicaciones
                  ? 'Cargando municipios...'
                  : formData.departamento
                  ? municipios.length === 0
                    ? 'No se encontraron municipios'
                    : '-- Seleccionar Municipio --'
                  : '-- Elija Departamento --'}
              </option>
              {municipios.map((m) => (
                <option key={m.codigo_municipio} value={m.municipio}>
                  {m.municipio}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Código DANE y Teléfono */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Código DANE
            </label>
            <input
              type="text"
              value={formData.codigo_dane}
              disabled
              readOnly
              placeholder="Ej: 05001"
              className="w-full text-xs border border-gray-300 p-2 rounded-md bg-gray-100 font-mono font-bold text-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Teléfono
            </label>
            <input
              type="text"
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              className="w-full text-xs border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Dirección */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            Dirección
          </label>
          <input
            type="text"
            value={formData.direccion}
            onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            className="w-full text-xs border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Botones */}
        <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || Boolean(errorEmail)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar Sucursal'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ==========================================
// COMPONENTE PRINCIPAL: PÁGINA SUCURSALES
// ==========================================
export default function SucursalesPage() {
  const [empresas, setEmpresas] = useState([])
  const [empresaIdSeleccionada, setEmpresaIdSeleccionada] = useState('')
  const [sucursales, setSucursales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const cargarSucursales = useCallback(async (empId) => {
    if (!empId) return
    setCargando(true)
    try {
      const res = await fetch(`/api/sucursales?empresa_id=${empId}`)
      const data = await res.json()
      if (data.exito) {
        setSucursales(data.datos || [])
      } else {
        setSucursales([])
      }
    } catch (error) {
      console.error('Error al cargar sucursales:', error)
      setSucursales([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    async function cargarEmpresasIniciales() {
      try {
        const res = await fetch('/api/sucursales?accion=listar_empresas')
        const data = await res.json()
        if (data.exito && data.datos.length > 0) {
          const empresasOrdenadas = [...data.datos].sort((a, b) => {
            const nombreA = a.razon_social || a.nombre_comercial || ''
            const nombreB = b.razon_social || b.nombre_comercial || ''
            return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' })
          })

          setEmpresas(empresasOrdenadas)

          const primeraEmpresaId = String(empresasOrdenadas[0].id)
          setEmpresaIdSeleccionada(primeraEmpresaId)
          cargarSucursales(primeraEmpresaId)
        } else {
          setCargando(false)
        }
      } catch (error) {
        console.error('Error al cargar empresas:', error)
        setCargando(false)
      }
    }
    cargarEmpresasIniciales()
  }, [cargarSucursales])

  const handleEmpresaChange = (e) => {
    const nuevoId = e.target.value
    setEmpresaIdSeleccionada(nuevoId)
    cargarSucursales(nuevoId)
  }

  const handleNuevaSucursal = () => {
    setSucursalSeleccionada(null)
    setModalAbierto(true)
  }

  const handleEditarSucursal = (sucursal) => {
    setSucursalSeleccionada(sucursal)
    setModalAbierto(true)
  }

  const handleToggleEstado = async (sucursal) => {
    const nuevoEstado = sucursal.estado === 'Activa' ? 'Inactiva' : 'Activa'
    try {
      const res = await fetch('/api/sucursales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sucursal.id, estado: nuevoEstado })
      })
      const data = await res.json()
      if (data.exito) {
        cargarSucursales(empresaIdSeleccionada)
      } else {
        alert(data.mensaje)
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error)
    }
  }

  const handleEliminar = async (sucursal) => {
    const nombreVisual = sucursal.nombre || sucursal.nombre_sucursal || 'esta sucursal'
    if (!confirm(`¿Deseas eliminar la sucursal "${nombreVisual}"?`)) return

    try {
      const res = await fetch(`/api/sucursales?id=${sucursal.id}&empresa_id=${empresaIdSeleccionada}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.exito) {
        cargarSucursales(empresaIdSeleccionada)
      } else {
        alert(data.mensaje || 'No se pudo eliminar la sucursal.')
      }
    } catch (error) {
      console.error('Error al eliminar sucursal:', error)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Sucursales</h1>
          <p className="text-sm text-gray-500">Administra las sedes y ubicaciones vinculadas a la empresa.</p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <select
            value={empresaIdSeleccionada}
            onChange={handleEmpresaChange}
            className="border border-gray-300 p-2 rounded-md bg-white text-sm font-semibold text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[240px]"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                🏢 {emp.razon_social || emp.nombre_comercial}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleNuevaSucursal}
            disabled={!isMounted || !empresaIdSeleccionada}
            suppressHydrationWarning
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md shadow-sm transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
          >
            + Nueva Sucursal
          </button>
        </div>
      </div>

      {/* Tabla Principal */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-gray-500 text-sm">Cargando sucursales...</div>
        ) : sucursales.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No hay sucursales registradas para la empresa seleccionada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200 text-xs">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Ubicación</th>
                  <th className="p-3">Código DANE</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sucursales.map((suc) => (
                  <tr key={suc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-gray-800">{suc.codigo_sucursal || '-'}</td>
                    <td className="p-3 font-medium text-gray-900">
                      {suc.nombre || suc.nombre_sucursal || 'Sin Nombre'}
                    </td>
                    <td className="p-3 text-gray-600">{suc.email || '-'}</td>
                    <td className="p-3 text-gray-600">
                      {(suc.ciudad || suc.municipio) && suc.departamento
                        ? `${suc.ciudad || suc.municipio}, ${suc.departamento}`
                        : suc.ciudad || suc.municipio || suc.departamento || '-'}
                    </td>
                    <td className="p-3 text-gray-600 font-mono font-bold">{suc.codigo_dane || '-'}</td>
                    <td className="p-3 text-gray-600">{suc.telefono || '-'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleEstado(suc)}
                        type="button"
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          suc.estado === 'Activa'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {suc.estado || 'Activa'}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEditarSucursal(suc)}
                          type="button"
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleEliminar(suc)}
                          type="button"
                          disabled={suc.codigo_sucursal === 'SUC-001'}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-30"
                          title="Eliminar"
                        >
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

      {/* Modal Subformulario */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-100">
            <SubformularioSucursal
              empresas={empresas}
              empresaIdSeleccionada={empresaIdSeleccionada}
              sucursalEditar={sucursalSeleccionada}
              onClose={() => setModalAbierto(false)}
              onSave={() => {
                setModalAbierto(false)
                cargarSucursales(empresaIdSeleccionada)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}