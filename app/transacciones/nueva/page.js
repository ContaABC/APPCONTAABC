'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { validarPeriodoContable } from "@/lib/accounting-validations" // <--- Importación del validador de periodo

export default function NuevaTransaccion() {
  const [empresas, setEmpresas] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [terceros, setTerceros] = useState([])
  const [clasesDoc, setClasesDoc] = useState([])
  const [conceptosAux, setConceptosAux] = useState([])

  const [empresaId, setEmpresaId] = useState('')
  const [sucursalId, setSucursalId] = useState('')
  const [terceroId, setTerceroId] = useState('')
  const [claseDocId, setClaseDocId] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [glosa, setGlosa] = useState('')
  const [fechaContable, setFechaContable] = useState('') // <--- Estado de fecha contable
  const [cargandoConsecutivo, setCargandoConsecutivo] = useState(false)

  // Estados para Control de Periodo Contable
  const [errorPeriodo, setErrorPeriodo] = useState(null)
  const [validandoPeriodo, setValidandoPeriodo] = useState(false)

  const [lineas, setLineas] = useState([
    { id: 1, concepto_auxiliar_id: '', tercero_id: '', debito: 0, credito: 0 }
  ])

  useEffect(() => {
    setFechaContable(new Date().toISOString().split('T')[0])
    async function cargarCatalogos() {
      const { data: dataEmpresas } = await supabase.from('empresas').select('*')
      const { data: dataClases } = await supabase.from('clases_documento').select('*')
      if (dataEmpresas) setEmpresas(dataEmpresas)
      if (dataClases) setClasesDoc(dataClases)
    }
    cargarCatalogos()
  }, [])

  // Función de validación de periodo en tiempo real
  const verificarPeriodo = async (fecha) => {
    if (!empresaId || !sucursalId || !fecha) {
      setErrorPeriodo(null)
      return
    }

    setValidandoPeriodo(true)
    setErrorPeriodo(null)

    const res = await validarPeriodoContable(empresaId, sucursalId, fecha)
    if (!res.valido) {
      setErrorPeriodo(res.mensaje || "Periodo no habilitado para transacciones.")
    }

    setValidandoPeriodo(false)
  }

  // Validar automáticamente al cambiar empresa, sucursal o fecha contable
  useEffect(() => {
    if (empresaId && sucursalId && fechaContable) {
      verificarPeriodo(fechaContable)
    }
  }, [empresaId, sucursalId])

  useEffect(() => {
    if (!empresaId) return
    async function cargarPorEmpresa() {
      const { data: dataSuc } = await supabase.from('sucursales').select('*').eq('empresa_id', empresaId)
      const { data: dataTerc } = await supabase.from('terceros').select('*').eq('empresa_id', empresaId)
      const { data: dataAux } = await supabase.from('conceptos_auxiliares').select('*').eq('empresa_id', empresaId)

      if (dataSuc) {
        setSucursales(dataSuc)
        if (dataSuc.length > 0 && !sucursalId) setSucursalId(dataSuc[0].id)
      }
      if (dataTerc) setTerceros(dataTerc)
      if (dataAux) setConceptosAux(dataAux)
    }
    cargarPorEmpresa()
  }, [empresaId])

  // Obtener el consecutivo automático cuando cambia la Empresa o la Clase de Documento
  useEffect(() => {
    if (!empresaId || !claseDocId) {
      setNumeroDocumento('')
      return
    }

    async function obtenerConsecutivo() {
      setCargandoConsecutivo(true)
      const { data, error } = await supabase.rpc('obtener_siguiente_consecutivo', {
        p_empresa_id: empresaId,
        p_clase_doc_id: claseDocId
      })

      if (error) {
        console.error('Error al generar consecutivo:', error)
      } else {
        setNumeroDocumento(data)
      }
      setCargandoConsecutivo(false)
    }

    obtenerConsecutivo()
  }, [empresaId, claseDocId])

  const agregarLinea = () => {
    setLineas([...lineas, { id: Date.now(), concepto_auxiliar_id: '', tercero_id: terceroId, debito: 0, credito: 0 }])
  }

  const removerLinea = (index) => {
    if (lineas.length === 1) return
    setLineas(lineas.filter((_, i) => i !== index))
  }

  const actualizarLinea = (index, campo, valor) => {
    const nuevasLineas = [...lineas]
    nuevasLineas[index][campo] = valor
    setLineas(nuevasLineas)
  }

  const totalDebito = lineas.reduce((acc, l) => acc + (parseFloat(l.debito) || 0), 0)
  const totalCredito = lineas.reduce((acc, l) => acc + (parseFloat(l.credito) || 0), 0)
  const estaBalanceado = Math.abs(totalDebito - totalCredito) < 0.01 && totalDebito > 0

  const guardarTransaccion = async (e) => {
    e.preventDefault()

    if (errorPeriodo) {
      alert('Error: No se puede guardar la transacción porque el periodo contable no es válido o está cerrado.')
      return
    }

    if (!estaBalanceado) {
      alert('Error: La partida doble no cuadra. Los débitos deben ser iguales a los créditos.')
      return
    }

    try {
      // 1. Insertar el encabezado
      const { data: tx, error: errTx } = await supabase
        .from('transacciones')
        .insert([{
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          clase_documento_id: claseDocId,
          tercero_id: terceroId,
          numero_documento: numeroDocumento,
          fecha_contable: fechaContable, // <--- Incluyendo la fecha contable validada
          glosa_concepto: glosa,
          estado: 'Registrado'
        }])
        .select()
        .single()

      if (errTx) throw errTx

      // 2. Insertar los detalles contables
      const detalles = lineas.map(l => ({
        transaccion_id: tx.id,
        concepto_niif_id: conceptosAux.find(a => a.id == l.concepto_auxiliar_id)?.concepto_padre_id,
        concepto_auxiliar_id: l.concepto_auxiliar_id,
        tercero_id: l.tercero_id || terceroId,
        debito: parseFloat(l.debito) || 0,
        credito: parseFloat(l.credito) || 0
      }))

      const { error: errDetalle } = await supabase.from('detalle_transacciones').insert(detalles)
      if (errDetalle) throw errDetalle

      alert(`¡Transacción ${numeroDocumento} guardada exitosamente!`)
      setGlosa('')
      setClaseDocId('')
      setNumeroDocumento('')
      setLineas([{ id: 1, concepto_auxiliar_id: '', tercero_id: '', debito: 0, credito: 0 }])

    } catch (err) {
      alert('Error al guardar la transacción: ' + err.message)
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '2rem auto', padding: '1.5rem', fontFamily: 'sans-serif' }}>
      <h1>Registro de Transacción Contable</h1>

      <form onSubmit={guardarTransaccion}>
        <fieldset style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <legend><strong>Encabezado del Documento</strong></legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            
            <label>Empresa:
              <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} required style={{ width: '100%' }}>
                <option value="">Seleccione Empresa...</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
              </select>
            </label>

            <label>Sucursal:
              <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} required style={{ width: '100%' }}>
                <option value="">Seleccione Sucursal...</option>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>

            <label>Clase de Documento:
              <select value={claseDocId} onChange={e => setClaseDocId(e.target.value)} required style={{ width: '100%' }}>
                <option value="">Seleccione Clase...</option>
                {clasesDoc.map(c => <option key={c.id} value={c.id}>[{c.codigo_clase}] {c.nombre_clase}</option>)}
              </select>
            </label>

            <label>Tercero Principal:
              <select value={terceroId} onChange={e => setTerceroId(e.target.value)} required style={{ width: '100%' }}>
                <option value="">Seleccione Tercero...</option>
                {terceros.map(t => <option key={t.id} value={t.id}>{t.razon_social || `${t.primer_nombre} ${t.primer_apellido}`}</option>)}
              </select>
            </label>

            <label>N° Documento (Automático):
              <input 
                type="text" 
                value={cargandoConsecutivo ? 'Generando...' : numeroDocumento} 
                readOnly 
                required 
                style={{ width: '100%', backgroundColor: '#f0f0f0', fontWeight: 'bold' }} 
              />
            </label>

            {/* Campo de Fecha Contable con validación integrada */}
            <label>Fecha Contable *:
              <input 
                type="date" 
                value={fechaContable} 
                onChange={e => {
                  setFechaContable(e.target.value)
                  if (errorPeriodo) setErrorPeriodo(null)
                }} 
                onBlur={() => verificarPeriodo(fechaContable)}
                required 
                style={{ width: '100%' }} 
              />
              {validandoPeriodo && <small style={{ color: 'blue' }}>Verificando periodo...</small>}
              {errorPeriodo && <div style={{ color: 'red', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>⚠️ {errorPeriodo}</div>}
            </label>

            <label style={{ gridColumn: 'span 3' }}>Glosa / Concepto:
              <input type="text" value={glosa} onChange={e => setGlosa(e.target.value)} placeholder="Descripción del asiento" required style={{ width: '100%' }} />
            </label>
          </div>
        </fieldset>

        {/* Asiento Contable */}
        <fieldset style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <legend><strong>Asiento Contable (Partida Doble)</strong></legend>
          
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th>Concepto / Cuenta Auxiliar</th>
                <th>Tercero Fila</th>
                <th style={{ width: '120px' }}>Débito ($)</th>
                <th style={{ width: '120px' }}>Crédito ($)</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((linea, idx) => (
                <tr key={linea.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>
                    <select 
                      value={linea.concepto_auxiliar_id} 
                      onChange={e => actualizarLinea(idx, 'concepto_auxiliar_id', e.target.value)} 
                      required style={{ width: '100%' }}
                    >
                      <option value="">Seleccione Auxiliar / ABC...</option>
                      {conceptosAux.map(a => <option key={a.id} value={a.id}>{a.codigo_auxiliar} - {a.nombre}</option>)}
                    </select>
                  </td>
                  <td>
                    <select 
                      value={linea.tercero_id || terceroId} 
                      onChange={e => actualizarLinea(idx, 'tercero_id', e.target.value)} 
                      style={{ width: '100%' }}
                    >
                      <option value="">Usar Tercero Principal</option>
                      {terceros.map(t => <option key={t.id} value={t.id}>{t.razon_social || `${t.primer_nombre} ${t.primer_apellido}`}</option>)}
                    </select>
                  </td>
                  <td>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={linea.debito} 
                      onChange={e => actualizarLinea(idx, 'debito', e.target.value)} 
                      style={{ width: '100%' }} 
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={linea.credito} 
                      onChange={e => actualizarLinea(idx, 'credito', e.target.value)} 
                      style={{ width: '100%' }} 
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => removerLinea(idx)} style={{ color: 'red' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" onClick={agregarLinea} style={{ marginTop: '1rem', padding: '0.4rem 0.8rem' }}>
            + Agregar Línea
          </button>
        </fieldset>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9f9f9', padding: '1rem', borderRadius: '6px' }}>
          <div>
            <strong>Total Débitos:</strong> ${totalDebito.toFixed(2)} | <strong>Total Créditos:</strong> ${totalCredito.toFixed(2)}
            {!estaBalanceado && <span style={{ color: 'red', marginLeft: '1rem', fontWeight: 'bold' }}>⚠️ Partida Doble Desbalanceada</span>}
            {estaBalanceado && <span style={{ color: 'green', marginLeft: '1rem', fontWeight: 'bold' }}>✓ Cuadrado</span>}
          </div>

          <button 
            type="submit" 
            disabled={!estaBalanceado || cargandoConsecutivo || Boolean(errorPeriodo)} 
            style={{ 
              padding: '0.6rem 1.5rem', 
              background: (!estaBalanceado || Boolean(errorPeriodo)) ? '#ccc' : '#16a34a', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '4px',
              cursor: (!estaBalanceado || Boolean(errorPeriodo)) ? 'not-allowed' : 'pointer'
            }}
          >
            Guardar Transacción
          </button>
        </div>
      </form>
    </div>
  )
}