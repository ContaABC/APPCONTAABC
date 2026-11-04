'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const [clasesDoc, setClasesDoc] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarClasesDocumento() {
      const { data, error } = await supabase
        .from('clases_documento')
        .select('*')

      if (error) {
        console.error('Error al consultar Supabase:', error)
      } else {
        setClasesDoc(data)
      }
      setLoading(false)
    }

    cargarClasesDocumento()
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Prueba de Conexión a Supabase</h1>
      {loading ? (
        <p>Cargando clases de documento...</p>
      ) : (
        <ul>
          {clasesDoc.map((clase) => (
            <li key={clase.id}>
              <strong>[{clase.codigo_clase}]</strong> - {clase.nombre_clase}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}