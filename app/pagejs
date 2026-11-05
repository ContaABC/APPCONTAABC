'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const [clasesDoc, setClasesDoc] = useState([])
  const [errorMsg, setErrorMsg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarClasesDocumento() {
      try {
        const { data, error } = await supabase
          .from('clases_documento')
          .select('*')

        if (error) {
          console.error('Error Supabase:', error)
          setErrorMsg(error.message)
        } else {
          setClasesDoc(data || [])
        }
      } catch (err) {
        setErrorMsg(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargarClasesDocumento()
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Prueba de Conexión a Supabase</h1>
      
      {loading && <p>Cargando clases de documento...</p>}

      {errorMsg && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '6px', marginTop: '1rem' }}>
          <strong>Error de conexión:</strong> {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && (
        <div>
          <h3>Clases de Documento Fijas Registradas ({clasesDoc.length}):</h3>
          <ul>
            {clasesDoc.map((clase) => (
              <li key={clase.id}>
                <strong>[{clase.codigo_clase}]</strong> - {clase.nombre_clase}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}