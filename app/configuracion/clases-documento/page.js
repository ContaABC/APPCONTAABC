'use client'

import { useState, useEffect } from 'react'

export default function ClasesDocumentoPage() {
  const [empresas, setEmpresas] = useState([])
  const [empresaId, setEmpresaId] = useState('')
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true)

  const [documentos, setDocumentos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)

  // Estados del subformulario
  const [idActual, setIdActual] = useState(null)
  const [codigoClase, setCodigoClase] = useState('')
  const [nombreClase, setNombreClase] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [afectaCajaBancos, setAfectaCajaBancos] = useState(false)

  const [guardando, setGuardando] = useState(false)
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 1. Cargar lista de empresas
  const cargarEmpresas = async () => {
    setCargandoEmpresas(true)
    try {
      const res = await fetch('/api/empresas/listar')
      const json = await res.json().catch(() => ({}))
      const lista = Array.isArray(json) ? json : (json.datos || json.empresas || [])

      if (res.ok && lista.length > 0) {
        setEmpresas(lista)
        setEmpresaId(String(lista[0].id || lista[0].empresa_id))
      } else {
        setEmpresas([])
      }
    } catch (e) {
      console.error('Error al cargar empresas:', e)
      setEmpresas([])
    } finally {
      setCargandoEmpresas(false)
    }
  }

  useEffect(() => {
    cargarEmpresas()
  }, [])

  // 2. Cargar clases de documento por empresa
  const cargarDocumentos = async () => {
    if (!empresaId) return
    setCargando(true)
    try {
      const res = await fetch(`/api/clases-documento?empresa_id=${empresaId}`)
      const json = await res.json().catch(() => ({}))

      if (res.ok && json.exito) {
        setDocumentos(json.datos || [])
      } else {
        setDocumentos([])
      }
    } catch (e) {
      console.error('Error al cargar clases_documento:', e)
      setDocumentos([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (empresaId) {
      cargarDocumentos()
    }
  }, [empresaId])

  // Abrir Modal Crear
  const abrirModalCrear = () => {
    if (!empresaId) {
      alert('Debe seleccionar una empresa activa primero.')
      return
    }
    setModoEdicion(false)
    setIdActual(null)
    setCodigoClase('')
    setNombreClase('')
    setDescripcion('')
    setAfectaCajaBancos(false)
    setMostrarModal(true)
  }

  // Abrir Modal Editar
  const abrirModalEditar = (doc) => {
    setModoEdicion(true)
    setIdActual(doc.id)
    setCodigoClase(doc.codigo_clase)
    setNombreClase(doc.nombre_clase)
    setDescripcion(doc.descripcion || '')
    setAfectaCajaBancos(doc.afecta_caja_bancos)
    setMostrarModal(true)
  }

  // Alternar Estado directo al dar clic en la tabla
  const handleToggleEstado = async (doc) => {
    const estadoActualBool = (doc.estado === 'Activa' || doc.estado === true)
    const nuevoEstado = !estadoActualBool

    setCambiandoEstadoId(doc.id)

    try {
      const res = await fetch('/api/clases-documento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc.id,
          nombre_clase: doc.nombre_clase,
          descripcion: doc.descripcion,
          afecta_caja_bancos: doc.afecta_caja_bancos,
          estado: nuevoEstado
        })
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json.exito) {
        throw new Error(json.mensaje || 'Error al cambiar el estado.')
      }

      // Actualizar estado localmente
      setDocumentos(prevDocs =>
        prevDocs.map(d =>
          d.id === doc.id ? { ...d, estado: nuevoEstado ? 'Activa' : 'Inactiva' } : d
        )
      )
    } catch (error) {
      alert(error.message)
    } finally {
      setCambiandoEstadoId(null)
    }
  }

  // Guardar Registro
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!codigoClase || !nombreClase) {
      alert('El código y el nombre de la clase son obligatorios.')
      return
    }

    setGuardando(true)

    try {
      const endpoint = '/api/clases-documento'
      const method = modoEdicion ? 'PUT' : 'POST'
      const payload = modoEdicion
        ? {
            id: idActual,
            empresa_id: Number(empresaId),
            nombre_clase: nombreClase,
            descripcion,
            afecta_caja_bancos: afectaCajaBancos
          }
        : {
            empresa_id: Number(empresaId),
            codigo_clase: codigoClase,
            nombre_clase: nombreClase,
            descripcion,
            afecta_caja_bancos: afectaCajaBancos
          }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json.exito) {
        throw new Error(json.mensaje || json.error || 'No se pudo guardar la clase de documento.')
      }

      alert(json.mensaje || 'Guardado exitosamente.')
      setMostrarModal(false)
      cargarDocumentos()
    } catch (error) {
      alert(error.message)
    } finally {
      setGuardando(false)
    }
  }

  // Eliminar Registro
  const handleEliminar = async (doc) => {
    if (doc.es_sistema) {
      alert('No se pueden eliminar documentos de sistema.')
      return
    }

    if (!confirm(`¿Eliminar la clase "${doc.codigo_clase} - ${doc.nombre_clase}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/clases-documento?id=${doc.id}&empresa_id=${doc.empresa_id}`, {
        method: 'DELETE'
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json.exito) throw new Error(json.mensaje || 'Error al eliminar.')

      alert('Documento eliminado.')
      cargarDocumentos()
    } catch (error) {
      alert(error.message || 'Error al eliminar el registro.')
    }
  }

  if (!mounted) return null

  const empresaSeleccionada = empresas.find(e => String(e.id || e.empresa_id) === String(empresaId))
  const nombreEmpresaActiva = empresaSeleccionada 
    ? (empresaSeleccionada.razon_social || empresaSeleccionada.nombre_comercial || empresaSeleccionada.nombre)
    : `Empresa ID: ${empresaId}`

  const labelStyle = { display: 'block', fontWeight: 'bold', fontSize: '0.75rem', color: '#334155', marginBottom: '0.2rem' }
  const inputStyle = { width: '100%', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: '1100px', margin: '1rem auto', padding: '1.25rem', fontFamily: 'sans-serif', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      
      {/* Selector de Empresa y Acción de Crear */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#f8fafc', padding: '0.8rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
        <div>
          <h1 style={{ color: '#0f172a', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Clases de Documento</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.75rem' }}>Parametrización por empresa.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' }}>Empresa Activa:</label>
          <select 
            value={empresaId} 
            onChange={(e) => setEmpresaId(e.target.value)}
            disabled={cargandoEmpresas}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #2563eb', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: '#ffffff', color: '#1e3a8a', cursor: 'pointer' }}
          >
            {cargandoEmpresas ? (
              <option value="">Cargando empresas...</option>
            ) : empresas.length === 0 ? (
              <option value="">Sin empresas registradas</option>
            ) : (
              empresas.map((emp) => {
                const id = String(emp.id || emp.empresa_id)
                const nombre = emp.razon_social || emp.nombre_comercial || emp.nombre || `Empresa ${id}`
                return <option key={id} value={id}>{nombre}</option>
              })
            )}
          </select>

          <button 
            onClick={abrirModalCrear}
            disabled={!empresaId || empresas.length === 0}
            style={{ padding: '0.45rem 1rem', backgroundColor: (!empresaId || empresas.length === 0) ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ＋ Nueva Clase
          </button>
        </div>
      </div>

      {/* Tabla Principal */}
      {cargando ? (
        <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', padding: '1.5rem' }}>Cargando documentos...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
              <th style={{ padding: '0.5rem' }}>Código</th>
              <th style={{ padding: '0.5rem' }}>Nombre</th>
              <th style={{ padding: '0.5rem' }}>Descripción</th>
              <th style={{ padding: '0.5rem', textAlign: 'center' }}>Caja / Bancos</th>
              <th style={{ padding: '0.5rem', textAlign: 'center' }}>Origen</th>
              <th style={{ padding: '0.5rem', textAlign: 'center' }}>Estado (Clic para alternar)</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documentos.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  No hay clases de documento registradas para esta empresa.
                </td>
              </tr>
            ) : (
              documentos.map((doc) => {
                const estaActivo = doc.estado === 'Activa' || doc.estado === true
                const cambiandoEste = cambiandoEstadoId === doc.id

                return (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#1e293b' }}>{doc.codigo_clase}</td>
                    <td style={{ padding: '0.5rem' }}>{doc.nombre_clase}</td>
                    <td style={{ padding: '0.5rem', color: '#64748b' }}>{doc.descripcion || '-'}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      {doc.afecta_caja_bancos ? <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Sí</span> : 'No'}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      {doc.es_sistema ? (
                        <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>Sistema</span>
                      ) : (
                        <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>Manual</span>
                      )}
                    </td>

                    {/* ESTADO INTERACTIVO */}
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <span 
                        onClick={() => !cambiandoEste && handleToggleEstado(doc)}
                        title="Haga clic para cambiar estado"
                        style={{ 
                          color: estaActivo ? '#16a34a' : '#dc2626', 
                          fontWeight: 'bold',
                          cursor: cambiandoEste ? 'wait' : 'pointer',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          border: `1px solid ${estaActivo ? '#bbf7d0' : '#fecaca'}`,
                          backgroundColor: estaActivo ? '#f0fdf4' : '#fef2f2',
                          userSelect: 'none',
                          display: 'inline-block',
                          opacity: cambiandoEste ? 0.5 : 1
                        }}
                      >
                        {cambiandoEste ? 'Guardando...' : (estaActivo ? 'Activa' : 'Inactiva')}
                      </span>
                    </td>

                    {/* ACCIONES CON ÍCONOS SVG */}
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        
                        {/* Botón Editar */}
                        <button 
                          onClick={() => abrirModalEditar(doc)}
                          title="Editar clase de documento"
                          style={{ 
                            backgroundColor: '#f59e0b', 
                            color: 'white', 
                            border: 'none', 
                            padding: '0.35rem', 
                            borderRadius: '4px', 
                            cursor: 'pointer', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        {/* Botón Eliminar */}
                        <button 
                          onClick={() => handleEliminar(doc)}
                          disabled={doc.es_sistema}
                          title={doc.es_sistema ? "No se puede eliminar un documento del sistema" : "Eliminar clase de documento"}
                          style={{ 
                            backgroundColor: doc.es_sistema ? '#cbd5e1' : '#ef4444', 
                            color: 'white', 
                            border: 'none', 
                            padding: '0.35rem', 
                            borderRadius: '4px', 
                            cursor: doc.es_sistema ? 'not-allowed' : 'pointer', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>

                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      )}

      {/* Subformulario (Modal) */}
      {mostrarModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', width: '450px', padding: '1.25rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: 'bold' }}>
              {modoEdicion ? 'Editar Clase de Documento' : 'Nueva Clase de Documento'}
            </h2>

            <form onSubmit={handleSubmit}>
              
              <div style={{ marginBottom: '0.8rem', backgroundColor: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>EMPRESA ASIGNADA</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>{nombreEmpresaActiva}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <div>
                  <label style={labelStyle}>Código Clase *</label>
                  <input 
                    type="text" 
                    value={codigoClase} 
                    onChange={e => setCodigoClase(e.target.value.toUpperCase())} 
                    disabled={modoEdicion}
                    placeholder="Ej: CC"
                    required 
                    style={{ ...inputStyle, backgroundColor: modoEdicion ? '#f1f5f9' : 'white', fontWeight: 'bold', textTransform: 'uppercase' }} 
                  />
                </div>
                <div>
                  <label style={labelStyle}>Nombre Clase *</label>
                  <input 
                    type="text" 
                    value={nombreClase} 
                    onChange={e => setNombreClase(e.target.value.toUpperCase())} 
                    placeholder="Ej: COMPROBANTE DE CONTABILIDAD"
                    required 
                    style={{ ...inputStyle, textTransform: 'uppercase' }} 
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.6rem' }}>
                <label style={labelStyle}>Descripción:</label>
                <input 
                  type="text" 
                  value={descripcion} 
                  onChange={e => setDescripcion(e.target.value)} 
                  placeholder="Detalles opcionales"
                  style={inputStyle} 
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={afectaCajaBancos} 
                    onChange={e => setAfectaCajaBancos(e.target.checked)} 
                  />
                  Afecta Caja / Bancos
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setMostrarModal(false)}
                  style={{ padding: '0.35rem 0.8rem', backgroundColor: '#94a3b8', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={guardando}
                  style={{ padding: '0.35rem 0.8rem', backgroundColor: guardando ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 'bold', cursor: guardando ? 'not-allowed' : 'pointer' }}
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}