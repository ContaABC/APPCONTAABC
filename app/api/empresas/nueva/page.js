'use client'

import { useState, useEffect } from 'react'

export default function NuevaEmpresaPage() {
  const [nit, setNit] = useState('')
  const [dv, setDv] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [nombreComercial, setNombreComercial] = useState('')
  
  const [repLegalNombre, setRepLegalNombre] = useState('')
  const [repLegalCedula, setRepLegalCedula] = useState('')

  // Nuevos estados para los códigos CIIU
  const [codigoCiiu, setCodigoCiiu] = useState('')
  const [codigoCiiu1, setCodigoCiiu1] = useState('')
  const [codigoCiiu2, setCodigoCiiu2] = useState('')

  const [pais, setPais] = useState('Colombia')
  const [departamentos, setDepartamentos] = useState([])
  const [municipios, setMunicipios] = useState([])
  
  const [codigoDepartamento, setCodigoDepartamento] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [ciudad, setCiudad] = useState('BUCARAMANGA')
  const [codigoDane, setCodigoDane] = useState('68001')

  const [monedaPrincipal, setMonedaPrincipal] = useState('COP')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('') // Error en tiempo real
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [fechaInicioOperaciones, setFechaInicioOperaciones] = useState(
    new Date().toISOString().split('T')[0]
  )

  const [tieneVariasSucursales, setTieneVariasSucursales] = useState(false)
  const [sucursales, setSucursales] = useState([])
  const [guardando, setGuardando] = useState(false)

  // Regex para validación de formato de correo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // Cargar Departamentos de Colombia
  useEffect(() => {
    async function cargarDepartamentos() {
      try {
        const res = await fetch('/api/ubicaciones')
        const json = await res.json()
        if (json.exito && json.datos) {
          setDepartamentos(json.datos)
          const santander = json.datos.find(d => d.codigo_departamento === '68')
          if (santander) {
            setCodigoDepartamento('68')
            setDepartamento(santander.departamento)
          } else if (json.datos.length > 0) {
            setCodigoDepartamento(json.datos[0].codigo_departamento)
            setDepartamento(json.datos[0].departamento)
          }
        }
      } catch (e) {
        console.error('Error cargando departamentos:', e)
      }
    }
    cargarDepartamentos()
  }, [])

  // Cargar Municipios al cambiar de departamento principal
  useEffect(() => {
    if (!codigoDepartamento || pais !== 'Colombia') {
      setMunicipios([])
      return
    }

    async function cargarMunicipios() {
      try {
        const res = await fetch(`/api/ubicaciones?codigo_departamento=${codigoDepartamento}`)
        const json = await res.json()
        if (json.exito && json.datos) {
          setMunicipios(json.datos)
          const bucaramanga = json.datos.find(m => m.codigo_municipio === '68001')
          if (bucaramanga) {
            setCodigoDane('68001')
            setCiudad(bucaramanga.municipio)
          } else if (json.datos.length > 0) {
            setCodigoDane(json.datos[0].codigo_municipio)
            setCiudad(json.datos[0].municipio)
          }
        }
      } catch (e) {
        console.error('Error cargando municipios:', e)
      }
    }
    cargarMunicipios()
  }, [codigoDepartamento, pais])

  const calcularDV = (nitValue) => {
    const cleanNit = nitValue.replace(/\D/g, '')
    if (!cleanNit) return ''
    const vpri = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
    let z = cleanNit.length
    let x = 0
    for (let i = 0; i < z; i++) {
      let y = parseInt(cleanNit.substring(i, i + 1))
      x += y * vpri[z - i - 1]
    }
    let y = x % 11
    return y > 1 ? 11 - y : y
  }

  const handleNitChange = (e) => {
    const valor = e.target.value
    setNit(valor)
    if (pais === 'Colombia') {
      setDv(calcularDV(valor).toString())
    }
  }

  const handlePaisChange = (e) => {
    const nuevoPais = e.target.value
    setPais(nuevoPais)

    if (nuevoPais === 'Colombia') {
      setMonedaPrincipal('COP')
    } else {
      setCodigoDepartamento('')
      setDepartamento('')
      setCodigoDane('')
      setCiudad('')
      if (nuevoPais === 'Estados Unidos') setMonedaPrincipal('USD')
      else if (nuevoPais === 'España') setMonedaPrincipal('EUR')
      else if (nuevoPais === 'México') setMonedaPrincipal('MXN')
      else if (nuevoPais === 'Chile') setMonedaPrincipal('CLP')
      else if (nuevoPais === 'Perú') setMonedaPrincipal('PEN')
    }
  }

  const handleDepartamentoChange = (e) => {
    const codDept = e.target.value
    setCodigoDepartamento(codDept)
    const objDept = departamentos.find(d => d.codigo_departamento === codDept)
    setDepartamento(objDept ? objDept.departamento : '')
  }

  const handleMunicipioChange = (e) => {
    const codMuni = e.target.value
    setCodigoDane(codMuni)
    const objMuni = municipios.find(m => m.codigo_municipio === codMuni)
    setCiudad(objMuni ? objMuni.municipio : '')
  }

  // Manejador del correo principal con validación en tiempo real
  const handleEmailChange = (e) => {
    const val = e.target.value
    setEmail(val)
    if (val && !emailRegex.test(val)) {
      setEmailError('Correo inválido (ejemplo@dominio.com)')
    } else {
      setEmailError('')
    }
  }

  // Métodos de gestión de Sucursales Adicionales
  const agregarSucursal = () => {
    const numeroSucursal = sucursales.length + 2
    const codigoFormateado = `SUC-${String(numeroSucursal).padStart(3, '0')}`
    setSucursales([
      ...sucursales,
      { 
        codigo: codigoFormateado, 
        nombre: `SUCURSAL ${numeroSucursal}`, 
        direccion: '', 
        telefono: '', 
        codigoDept: codigoDepartamento || '68',
        municipiosLista: municipios,
        codigoDane: codigoDane || '68001',
        ciudad: ciudad || 'BUCARAMANGA', 
        departamento: departamento || 'SANTANDER',
        email: '',
        emailInvalido: false
      }
    ])
  }

  const eliminarSucursal = (index) => {
    const nuevas = sucursales.filter((_, i) => i !== index)
    const reorganizadas = nuevas.map((suc, i) => ({
      ...suc,
      codigo: `SUC-${String(i + 2).padStart(3, '0')}`
    }))
    setSucursales(reorganizadas)
  }

  const updateSucursal = (index, campo, valor) => {
    const actualizadas = [...sucursales]
    if (campo === 'nombre') {
      actualizadas[index][campo] = valor.toUpperCase()
    } else if (campo === 'email') {
      actualizadas[index][campo] = valor
      // Validación en tiempo real para el correo de la sucursal
      actualizadas[index].emailInvalido = Boolean(valor && !emailRegex.test(valor))
    } else {
      actualizadas[index][campo] = valor
    }
    setSucursales(actualizadas)
  }

  const handleSucursalDeptChange = async (index, codDept) => {
    const actualizadas = [...sucursales]
    actualizadas[index].codigoDept = codDept
    const objDept = departamentos.find(d => d.codigo_departamento === codDept)
    actualizadas[index].departamento = objDept ? objDept.departamento : ''

    if (codDept) {
      try {
        const res = await fetch(`/api/ubicaciones?codigo_departamento=${codDept}`)
        const json = await res.json()
        if (json.exito && json.datos) {
          actualizadas[index].municipiosLista = json.datos
          if (json.datos.length > 0) {
            actualizadas[index].codigoDane = json.datos[0].codigo_municipio
            actualizadas[index].ciudad = json.datos[0].municipio
          }
        }
      } catch (e) {
        console.error('Error obteniendo municipios sucursal:', e)
      }
    } else {
      actualizadas[index].municipiosLista = []
      actualizadas[index].codigoDane = ''
      actualizadas[index].ciudad = ''
    }

    setSucursales(actualizadas)
  }

  const handleSucursalMuniChange = (index, codMuni) => {
    const actualizadas = [...sucursales]
    actualizadas[index].codigoDane = codMuni
    const objMuni = actualizadas[index].municipiosLista?.find(m => m.codigo_municipio === codMuni)
    actualizadas[index].ciudad = objMuni ? objMuni.municipio : ''
    setSucursales(actualizadas)
  }

  const handleCheckboxSucursales = (e) => {
    const check = e.target.checked
    setTieneVariasSucursales(check)
    if (check && sucursales.length === 0) {
      agregarSucursal()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validar email principal
    if (!email || !emailRegex.test(email)) {
      alert('Por favor, ingrese un correo electrónico principal válido (ejemplo@dominio.com).')
      return
    }

    // Validar emails de sucursales
    const sucursalCorreoInvalido = sucursales.find(s => s.email && !emailRegex.test(s.email))
    if (sucursalCorreoInvalido) {
      alert(`El correo de la sucursal "${sucursalCorreoInvalido.nombre}" no tiene un formato válido.`)
      return
    }

    if (!nit || !razonSocial) {
      alert('Por favor complete los campos obligatorios (NIT y Razón Social).')
      return
    }

    setGuardando(true)

    try {
      const respuesta = await fetch('/api/empresas/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nit, dv, razonSocial, nombreComercial, repLegalNombre, repLegalCedula,
          codigoCiiu, codigoCiiu1, codigoCiiu2, // Campos CIIU enviados al API
          pais, departamento, ciudad, codigoDane, monedaPrincipal, email, telefono, direccion, fechaInicioOperaciones,
          sucursalesAdicionales: tieneVariasSucursales ? sucursales : []
        })
      })

      const textoRespuesta = await respuesta.text()
      let resultado
      try { resultado = JSON.parse(textoRespuesta) } 
      catch (errJson) { throw new Error(`Error en servidor (código ${respuesta.status}).`) }

      if (!respuesta.ok || !resultado.exito) {
        throw new Error(resultado.mensaje || 'Error al procesar la empresa.')
      }

      alert(`¡Empresa "${resultado.empresa.razon_social}" registrada con éxito!`)
      
      setNit(''); setDv(''); setRazonSocial(''); setNombreComercial('');
      setRepLegalNombre(''); setRepLegalCedula('');
      setCodigoCiiu(''); setCodigoCiiu1(''); setCodigoCiiu2('');
      setEmail(''); setEmailError(''); setTelefono('');
      setDireccion(''); setTieneVariasSucursales(false); setSucursales([]);

    } catch (error) {
      alert(error.message)
    } finally {
      setGuardando(false)
    }
  }

  const labelStyle = { display: 'block', fontWeight: 'bold', fontSize: '0.75rem', color: '#334155', marginBottom: '0.15rem' }
  const inputStyle = { width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }
  const blockStyle = { backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '0.6rem' }

  // Estilos específicos más pequeños para la sección inferior de sucursales
  const labelSucursalStyle = { display: 'block', fontWeight: 'bold', fontSize: '0.7rem', color: '#334155', marginBottom: '0.1rem' }
  const inputSucursalStyle = { width: '100%', padding: '0.25rem 0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.72rem' }

  return (
    <div style={{ maxWidth: '1100px', margin: '1rem auto', padding: '1.25rem', fontFamily: 'sans-serif', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <div>
          <h1 style={{ color: '#0f172a', margin: 0, fontSize: '1.15rem', fontWeight: 'bold' }}>Registro de Nueva Empresa</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.75rem' }}>Información tributaria, representante legal y sedes operativas.</p>
        </div>
        <button 
          type="button" 
          onClick={handleSubmit}
          disabled={guardando} 
          style={{ padding: '0.4rem 1.2rem', backgroundColor: guardando ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', cursor: guardando ? 'not-allowed' : 'pointer' }}
        >
          {guardando ? 'Guardando...' : 'Crear Empresa'}
        </button>
      </div>

      <form style={{ display: 'grid', gap: '0' }}>
        
        {/* BLOQUE 1: DATOS FISCALES */}
        <div style={blockStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.5fr 3.5fr 2.5fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div>
              <label style={labelStyle}>NIT / ID:</label>
              <input type="text" value={nit} onChange={handleNitChange} placeholder="Ej: 900123456" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>DV:</label>
              <input 
                type="text" 
                value={dv} 
                disabled 
                readOnly 
                style={{ ...inputStyle, textAlign: 'center', backgroundColor: '#e2e8f0', color: '#475569', fontWeight: 'bold', cursor: 'not-allowed' }} 
              />
            </div>
            <div>
              <label style={labelStyle}>Razón Social (Legal):</label>
              <input 
                type="text" 
                value={razonSocial} 
                onChange={e => setRazonSocial(e.target.value.toUpperCase())} 
                required 
                style={{ ...inputStyle, textTransform: 'uppercase' }} 
              />
            </div>
            <div>
              <label style={labelStyle}>Nombre Comercial:</label>
              <input 
                type="text" 
                value={nombreComercial} 
                onChange={e => setNombreComercial(e.target.value.toUpperCase())} 
                style={{ ...inputStyle, textTransform: 'uppercase' }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr', gap: '0.6rem' }}>
            <div>
              <label style={labelStyle}>Nombre Representante Legal:</label>
              <input type="text" value={repLegalNombre} onChange={e => setRepLegalNombre(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cédula Rep. Legal:</label>
              <input type="text" value={repLegalCedula} onChange={e => setRepLegalCedula(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* BLOQUE 2: UBICACIÓN Y CONTACTO */}
        <div style={blockStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.8fr 0.8fr 1.2fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div>
              <label style={labelStyle}>País:</label>
              <select value={pais} onChange={handlePaisChange} style={{...inputStyle, backgroundColor: 'white'}}>
                <option value="Colombia">Colombia</option>
                <option value="Estados Unidos">Estados Unidos</option>
                <option value="México">México</option>
                <option value="España">España</option>
                <option value="Chile">Chile</option>
                <option value="Perú">Perú</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            {pais === 'Colombia' ? (
              <>
                <div>
                  <label style={labelStyle}>Departamento:</label>
                  <select value={codigoDepartamento} onChange={handleDepartamentoChange} style={{...inputStyle, backgroundColor: 'white'}}>
                    <option value="">-- Seleccione --</option>
                    {departamentos.map(d => (
                      <option key={d.codigo_departamento} value={d.codigo_departamento}>{d.departamento}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Municipio / Ciudad (DANE):</label>
                  <select value={codigoDane} onChange={handleMunicipioChange} disabled={!codigoDepartamento} style={{...inputStyle, backgroundColor: codigoDepartamento ? 'white' : '#f1f5f9'}}>
                    <option value="">-- Seleccione --</option>
                    {municipios.map(m => (
                      <option key={m.codigo_municipio} value={m.codigo_municipio}>
                        {m.municipio} ({m.codigo_municipio})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Ciudad / Estado Exterior:</label>
                <input type="text" value={ciudad} onChange={e => setCiudad(e.target.value)} placeholder="Ej: Miami" style={inputStyle} />
              </div>
            )}

            <div>
              <label style={labelStyle}>Moneda:</label>
              <select value={monedaPrincipal} onChange={e => setMonedaPrincipal(e.target.value)} style={{...inputStyle, backgroundColor: 'white'}}>
                <option value="COP">COP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="MXN">MXN</option>
              </select>
            </div>
            <div>
              <label style={{...labelStyle, color: '#1e40af'}}>Inicio Operaciones:</label>
              <input type="date" value={fechaInicioOperaciones} onChange={e => setFechaInicioOperaciones(e.target.value)} required style={{...inputStyle, borderColor: '#3b82f6'}} />
            </div>
          </div>

          {/* FILA DE CIIU + DATOS DE CONTACTO (Ajustados para encajar en una misma línea) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2.5fr 1.5fr 2fr', gap: '0.6rem' }}>
            <div>
              <label style={labelStyle}>CIIU Pr.:</label>
              <input 
                type="text" 
                value={codigoCiiu} 
                onChange={e => setCodigoCiiu(e.target.value)} 
                placeholder="Ej: 6201" 
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>CIIU 1:</label>
              <input 
                type="text" 
                value={codigoCiiu1} 
                onChange={e => setCodigoCiiu1(e.target.value)} 
                placeholder="Ej: 4741" 
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>CIIU 2:</label>
              <input 
                type="text" 
                value={codigoCiiu2} 
                onChange={e => setCodigoCiiu2(e.target.value)} 
                placeholder="Ej: 7020" 
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>Correo Electrónico:</label>
              <input 
                type="email" 
                value={email} 
                onChange={handleEmailChange} 
                placeholder="correo@ejemplo.com" 
                required 
                style={{ 
                  ...inputStyle, 
                  borderColor: emailError ? '#ef4444' : '#cbd5e1',
                  backgroundColor: emailError ? '#fef2f2' : 'white'
                }} 
              />
              {emailError && <span style={{ color: '#ef4444', fontSize: '0.65rem', display: 'block', marginTop: '0.1rem' }}>{emailError}</span>}
            </div>
            <div>
              <label style={labelStyle}>Teléfono:</label>
              <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Dirección (Sede Principal SUC-001):</label>
              <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* BLOQUE 3: SUCURSALES ADICIONALES */}
        <div style={{ backgroundColor: '#f0f9ff', padding: '0.6rem', borderRadius: '6px', border: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="chkSucursales" checked={tieneVariasSucursales} onChange={handleCheckboxSucursales} style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
              <label htmlFor="chkSucursales" style={{ fontWeight: 'bold', fontSize: '0.78rem', color: '#0369a1', cursor: 'pointer' }}>
                ¿Maneja más de una sucursal? (La SUC-001 se crea por defecto).
              </label>
            </div>
            {tieneVariasSucursales && (
              <button type="button" onClick={agregarSucursal} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>
                ＋ Añadir Sucursal
              </button>
            )}
          </div>

          {tieneVariasSucursales && (
            <div style={{ marginTop: '0.5rem' }}>
              {/* Encabezados de Columnas con fuente reducida */}
              <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 3fr 2fr 1.6fr 2.2fr 2.2fr 1.1fr auto', gap: '0.3rem', padding: '0 0.2rem 0.2rem 0.2rem' }}>
                <span style={labelSucursalStyle}>Código</span>
                <span style={labelSucursalStyle}>Nombre Sucursal</span>
                <span style={labelSucursalStyle}>Dirección</span>
                <span style={labelSucursalStyle}>Departamento</span>
                <span style={labelSucursalStyle}>Municipio / Ciudad (DANE)</span>
                <span style={labelSucursalStyle}>Correo Electrónico</span>
                <span style={labelSucursalStyle}>Teléfono</span>
                <span></span>
              </div>

              {/* Lista de Sucursales con inputs compactos y validación de correo */}
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingRight: '0.2rem' }}>
                {sucursales.map((suc, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '0.7fr 3fr 2fr 1.6fr 2.2fr 2.2fr 1.1fr auto', gap: '0.3rem', backgroundColor: 'white', padding: '0.3rem', borderRadius: '4px', border: '1px solid #cbd5e1', alignItems: 'center' }}>
                    <input type="text" value={suc.codigo} disabled style={{ ...inputSucursalStyle, backgroundColor: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }} title="Código" />
                    
                    <input 
                      type="text" 
                      value={suc.nombre} 
                      onChange={e => updateSucursal(index, 'nombre', e.target.value)} 
                      placeholder="Nombre Sede" 
                      required 
                      style={{ ...inputSucursalStyle, textTransform: 'uppercase' }} 
                    />
                    
                    <input type="text" value={suc.direccion} onChange={e => updateSucursal(index, 'direccion', e.target.value)} placeholder="Dirección" style={inputSucursalStyle} />
                    
                    {/* Departamento Sucursal */}
                    <select 
                      value={suc.codigoDept || ''} 
                      onChange={e => handleSucursalDeptChange(index, e.target.value)} 
                      style={{...inputSucursalStyle, backgroundColor: 'white'}}
                    >
                      <option value="">-- Seleccione --</option>
                      {departamentos.map(d => (
                        <option key={d.codigo_departamento} value={d.codigo_departamento}>{d.departamento}</option>
                      ))}
                    </select>

                    {/* Municipio DANE Sucursal */}
                    <select 
                      value={suc.codigoDane || ''} 
                      onChange={e => handleSucursalMuniChange(index, e.target.value)} 
                      disabled={!suc.codigoDept}
                      style={{...inputSucursalStyle, backgroundColor: suc.codigoDept ? 'white' : '#f1f5f9'}}
                    >
                      <option value="">-- Seleccione --</option>
                      {(suc.municipiosLista || []).map(m => (
                        <option key={m.codigo_municipio} value={m.codigo_municipio}>
                          {m.municipio} ({m.codigo_municipio})
                        </option>
                      ))}
                    </select>

                    {/* Correo Sucursal con validación en tiempo real */}
                    <input 
                      type="email" 
                      value={suc.email} 
                      onChange={e => updateSucursal(index, 'email', e.target.value)} 
                      placeholder="Email Sede" 
                      style={{
                        ...inputSucursalStyle,
                        borderColor: suc.emailInvalido ? '#ef4444' : '#cbd5e1',
                        backgroundColor: suc.emailInvalido ? '#fef2f2' : 'white'
                      }} 
                      title={suc.emailInvalido ? "Formato de correo inválido" : ""}
                    />

                    <input type="text" value={suc.telefono} onChange={e => updateSucursal(index, 'telefono', e.target.value)} placeholder="Teléfono" style={inputSucursalStyle} />
                    
                    <button type="button" onClick={() => eliminarSucursal(index)} title="Eliminar" style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.2rem 0.4rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </form>
    </div>
  )
}