'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function ClasesDocumentoPage() {
  const [clasesDoc, setClasesDoc] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarClasesDocumento() {
      try {
        const { data, error } = await supabase
          .from('clases_documento')
          .select('*')
          .order('codigo_clase', { ascending: true })

        if (error) {
          console.error('Error al consultar Supabase:', error)
        } else {
          setClasesDoc(data || [])
        }
      } catch (err) {
        console.error('Error inesperado:', err)
      } finally {
        setLoading(false)
      }
    }

    cargarClasesDocumento()
  }, [])

  return (
    <div style={{ maxWidth: '900px', margin: '1.5rem auto', padding: '1.5rem', fontFamily: 'sans-serif', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
      <h1 style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Clases de Documentos del Sistema</h1>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1.2rem' }}>Catálogo maestro de comprobantes y tipos de documentos contables.</p>

      {loading ? (
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Cargando clases de documento...</p>
      ) : clasesDoc.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: '#ef4444' }}>No se encontraron clases de documento registradas.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {clasesDoc.map((clase) => (
            <div key={clase.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {clase.codigo_clase}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#1e293b' }}>
                  {clase.nombre_clase}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                ID: {clase.id}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}