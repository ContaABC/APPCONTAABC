import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET: Listar actividades ABC por empresa o generar consecutivo
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')
    const empresa_id = searchParams.get('empresa_id')

    // Listar todas las empresas para los selectores
    if (accion === 'listar_empresas') {
      const { data: empresas, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social, nombre_comercial')
        .order('razon_social', { ascending: true })

      if (error) throw error
      return NextResponse.json({ exito: true, datos: empresas || [] })
    }

    // Generar siguiente código consecutivo (ABC-001, ABC-002, ...)
    if (accion === 'siguiente_codigo' && empresa_id) {
      const { data, error } = await supabaseAdmin
        .from('actividades_abc')
        .select('codigo')
        .eq('empresa_id', empresa_id)

      if (error) throw error

      let maxNum = 0
      if (data && data.length > 0) {
        data.forEach((item) => {
          if (item.codigo) {
            const match = item.codigo.match(/\d+$/)
            if (match) {
              const num = parseInt(match[0], 10)
              if (num > maxNum) maxNum = num
            }
          }
        })
      }

      const siguienteNum = maxNum + 1
      const siguienteCodigo = `ABC-${String(siguienteNum).padStart(3, '0')}`
      return NextResponse.json({ exito: true, siguiente_codigo: siguienteCodigo })
    }

    // Listar actividades ABC de una empresa específica
    if (!empresa_id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El parámetro empresa_id es obligatorio.' },
        { status: 400 }
      )
    }

    const { data: actividades, error } = await supabaseAdmin
      .from('actividades_abc')
      .select('*')
      .eq('empresa_id', empresa_id)
      .order('codigo', { ascending: true })

    if (error) throw error

    return NextResponse.json({ exito: true, datos: actividades || [] })
  } catch (err) {
    console.error('Error en GET /api/actividades_abc:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}

// POST: Crear actividad ABC o Clonar masivamente
export async function POST(req) {
  try {
    const body = await req.json()

    // CASO 1: ACCIÓN CLONAR / COPIAR A OTRAS EMPRESAS
    if (body.accion === 'clonar_actividades') {
      const { empresa_origen_id, empresas_destino_ids } = body

      if (!empresa_origen_id || !empresas_destino_ids || empresas_destino_ids.length === 0) {
        return NextResponse.json(
          { exito: false, mensaje: 'Debes especificar la empresa de origen y al menos una empresa destino.' },
          { status: 400 }
        )
      }

      // 1. Obtener actividades de origen
      const { data: origen, error: errOrigen } = await supabaseAdmin
        .from('actividades_abc')
        .select('codigo, nombre, descripcion')
        .eq('empresa_id', empresa_origen_id)

      if (errOrigen) throw errOrigen
      if (!origen || origen.length === 0) {
        return NextResponse.json(
          { exito: false, mensaje: 'La empresa origen no tiene actividades ABC para copiar.' },
          { status: 400 }
        )
      }

      // 2. Consultar cuáles ya existen en las empresas destino
      const { data: existentes, error: errExistentes } = await supabaseAdmin
        .from('actividades_abc')
        .select('empresa_id, codigo')
        .in('empresa_id', empresas_destino_ids)

      if (errExistentes) throw errExistentes

      const existentesSet = new Set(
        (existentes || []).map((item) => `${item.empresa_id}_${item.codigo}`)
      )

      // 3. Filtrar únicamente las que faltan por cada empresa
      const nuevosRegistros = []
      for (const destinoId of empresas_destino_ids) {
        for (const item of origen) {
          const clave = `${destinoId}_${item.codigo}`
          if (!existentesSet.has(clave)) {
            nuevosRegistros.push({
              empresa_id: destinoId,
              codigo: item.codigo,
              nombre: item.nombre,
              descripcion: item.descripcion || ''
            })
          }
        }
      }

      if (nuevosRegistros.length === 0) {
        return NextResponse.json({
          exito: true,
          mensaje: 'Todas las empresas seleccionadas ya tienen las actividades creadas.'
        })
      }

      const { error: errInsert } = await supabaseAdmin
        .from('actividades_abc')
        .insert(nuevosRegistros)

      if (errInsert) throw errInsert

      return NextResponse.json({
        exito: true,
        mensaje: `Se copiaron ${nuevosRegistros.length} actividades exitosamente.`
      })
    }

    // CASO 2: CREAR UNA SOLA ACTIVIDAD ABC
    const { empresa_id, codigo, nombre, descripcion } = body

    if (!empresa_id || !nombre) {
      return NextResponse.json(
        { exito: false, mensaje: 'Campos requeridos faltantes: empresa_id y nombre son obligatorios.' },
        { status: 400 }
      )
    }

    const nuevaActividad = {
      empresa_id,
      codigo: codigo || 'ABC-001',
      nombre,
      descripcion: descripcion || ''
    }

    const { data, error } = await supabaseAdmin
      .from('actividades_abc')
      .insert([nuevaActividad])
      .select()

    if (error) throw error

    return NextResponse.json({ exito: true, datos: data ? data[0] : null })
  } catch (err) {
    console.error('Error en POST /api/actividades_abc:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}

// PUT: Actualizar actividad ABC
export async function PUT(req) {
  try {
    const body = await req.json()
    const { id, nombre, descripcion } = body

    if (!id || !nombre) {
      return NextResponse.json(
        { exito: false, mensaje: 'ID y Nombre son obligatorios.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('actividades_abc')
      .update({ nombre, descripcion })
      .eq('id', id)
      .select()

    if (error) throw error

    return NextResponse.json({ exito: true, datos: data ? data[0] : null })
  } catch (err) {
    console.error('Error en PUT /api/actividades_abc:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}

// DELETE: Eliminar actividad ABC
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El parámetro ID es obligatorio.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('actividades_abc')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ exito: true, mensaje: 'Actividad eliminada correctamente.' })
  } catch (err) {
    console.error('Error en DELETE /api/actividades_abc:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}