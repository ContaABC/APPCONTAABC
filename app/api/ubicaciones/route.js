import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const codDept = searchParams.get('codigo_departamento')
    const codMunicipio = searchParams.get('codigo_municipio') || searchParams.get('codigo_dane')

    // A. Búsqueda directa por código DANE / Código de municipio
    if (codMunicipio) {
      const { data: municipio, error } = await supabaseAdmin
        .from('municipios_dane')
        .select('codigo_municipio, municipio, codigo_departamento, departamento')
        .eq('codigo_municipio', codMunicipio.trim())
        .eq('estado', 'ACTIVO')
        .maybeSingle()

      if (error) {
        console.error('Error Supabase al buscar código DANE:', error)
        return NextResponse.json(
          { exito: false, mensaje: `Error de base de datos: ${error.message}` },
          { status: 500 }
        )
      }

      if (!municipio) {
        return NextResponse.json(
          { exito: false, mensaje: 'No se encontró municipio con el código DANE especificado.' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        exito: true,
        datos: municipio
      })
    }

    // B. Si se envía codigo_departamento, retornar sus municipios
    if (codDept) {
      const { data: municipios, error } = await supabaseAdmin
        .from('municipios_dane')
        .select('codigo_municipio, municipio, codigo_departamento, departamento')
        .eq('codigo_departamento', codDept.trim())
        .eq('estado', 'ACTIVO')
        .order('municipio', { ascending: true })

      if (error) {
        console.error('Error Supabase al consultar municipios por departamento:', error)
        return NextResponse.json(
          { exito: false, mensaje: `Error de base de datos: ${error.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        exito: true,
        datos: municipios || []
      })
    }

    // C. Si no hay parámetros, retornar lista de departamentos únicos
    const { data: departamentos, error } = await supabaseAdmin
      .from('municipios_dane')
      .select('codigo_departamento, departamento')
      .eq('estado', 'ACTIVO')

    if (error) {
      console.error('Error Supabase al consultar departamentos:', error)
      return NextResponse.json(
        { exito: false, mensaje: `Error de base de datos: ${error.message}` },
        { status: 500 }
      )
    }

    // Eliminar duplicados de departamentos de forma segura
    const unicos = Array.from(
      new Map((departamentos || []).map(item => [item.codigo_departamento, item])).values()
    ).sort((a, b) => (a.departamento || '').localeCompare(b.departamento || ''))

    return NextResponse.json({
      exito: true,
      datos: unicos
    })

  } catch (err) {
    console.error('Error inesperado en GET /api/ubicaciones:', err)
    return NextResponse.json(
      {
        exito: false,
        mensaje: err instanceof Error ? err.message : 'Error interno del servidor.'
      },
      { status: 500 }
    )
  }
}