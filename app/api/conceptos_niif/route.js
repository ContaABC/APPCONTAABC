import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ==========================================
// GET: Obtener conceptos NIIF, empresas o consecutivo
// ==========================================
export async function GET(req) {
  try {
    const cookieStore = cookies()
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')
    
    // Captura automática de empresaId: desde parámetros o leyendo la cookie activa
    const empresaId = searchParams.get('empresa_id') || cookieStore.get('empresa_activa')?.value

    // 1. Cargar la lista de empresas para el selector
    if (accion === 'listar_empresas') {
      const { data: empresas, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social, nombre_comercial')
        .order('razon_social', { ascending: true })

      if (error) {
        return NextResponse.json(
          { exito: false, mensaje: `Error al cargar empresas: ${error.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({ exito: true, datos: empresas || [] })
    }

    // 2. Generar el siguiente código consecutivo (ej: NIIF-001)
    if (accion === 'siguiente_codigo') {
      if (!empresaId) {
        return NextResponse.json(
          { exito: false, mensaje: 'empresa_id es requerido o no hay sesión activa para generar el consecutivo.' },
          { status: 400 }
        )
      }

      const { data: conceptos, error } = await supabaseAdmin
        .from('conceptos_niif')
        .select('codigo_concepto')
        .eq('empresa_id', empresaId)

      if (error) {
        return NextResponse.json(
          { exito: false, mensaje: `Error al obtener consecutivo: ${error.message}` },
          { status: 500 }
        )
      }

      let maxNum = 0
      if (conceptos && conceptos.length > 0) {
        conceptos.forEach((c) => {
          if (c.codigo_concepto && c.codigo_concepto.startsWith('NIIF-')) {
            const num = parseInt(c.codigo_concepto.replace('NIIF-', ''), 10)
            if (!isNaN(num) && num > maxNum) {
              maxNum = num
            }
          }
        })
      }

      const siguienteCodigo = `NIIF-${String(maxNum + 1).padStart(3, '0')}`
      return NextResponse.json({ exito: true, siguiente_codigo: siguienteCodigo })
    }

    // 3. Listar conceptos NIIF filtrados por empresa
    if (!empresaId) {
      return NextResponse.json(
        { exito: false, mensaje: 'El parámetro empresa_id es requerido o no hay sesión activa.' },
        { status: 400 }
      )
    }

    const { data: conceptos, error } = await supabaseAdmin
      .from('conceptos_niif')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('codigo_concepto', { ascending: true })

    if (error) {
      return NextResponse.json(
        { exito: false, mensaje: `Error al consultar conceptos NIIF: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, datos: conceptos || [] })
  } catch (err) {
    console.error('Error inesperado en GET /api/conceptos_niif:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}

// ==========================================
// POST: Crear un nuevo concepto NIIF o Clonar conceptos masivamente
// ==========================================
export async function POST(req) {
  try {
    const cookieStore = cookies()
    const body = await req.json()

    // ==========================================
    // CASO 1: ACCIÓN CLONAR / COPIAR CONCEPTOS
    // ==========================================
    if (body.accion === 'clonar_conceptos') {
      const { empresa_origen_id, empresas_destino_ids } = body

      if (!empresa_origen_id || !empresas_destino_ids || empresas_destino_ids.length === 0) {
        return NextResponse.json(
          { exito: false, mensaje: 'Debes especificar la empresa de origen y al menos una empresa de destino.' },
          { status: 400 }
        )
      }

      // 1. Consultar los conceptos NIIF de la empresa origen
      const { data: conceptosOrigen, error: errorOrigen } = await supabaseAdmin
        .from('conceptos_niif')
        .select('codigo_concepto, nombre, elemento, clasificacion_balance')
        .eq('empresa_id', empresa_origen_id)

      if (errorOrigen) {
        console.error('Error al obtener conceptos origen:', errorOrigen)
        return NextResponse.json(
          { exito: false, mensaje: `Error al consultar empresa origen: ${errorOrigen.message}` },
          { status: 500 }
        )
      }

      if (!conceptosOrigen || conceptosOrigen.length === 0) {
        return NextResponse.json(
          { exito: false, mensaje: 'La empresa de origen no tiene conceptos NIIF registrados para copiar.' },
          { status: 400 }
        )
      }

      // 2. Consultar los conceptos que YA EXISTEN en las empresas destino
      const { data: conceptosExistentes, error: errorExistentes } = await supabaseAdmin
        .from('conceptos_niif')
        .select('empresa_id, codigo_concepto')
        .in('empresa_id', empresas_destino_ids)

      if (errorExistentes) {
        console.error('Error al consultar conceptos existentes:', errorExistentes)
        return NextResponse.json(
          { exito: false, mensaje: `Error al verificar conceptos existentes: ${errorExistentes.message}` },
          { status: 500 }
        )
      }

      // Crear un Set con la combinación (empresa_id + codigo_concepto) ya registrados
      const codigosExistentesSet = new Set(
        (conceptosExistentes || []).map((item) => `${item.empresa_id}_${item.codigo_concepto}`)
      )

      // 3. Filtrar solo los conceptos NIIF que NO existen en cada empresa destino
      const nuevosConceptosMasivos = []

      for (const destinoId of empresas_destino_ids) {
        for (const concepto of conceptosOrigen) {
          const claveUnica = `${destinoId}_${concepto.codigo_concepto}`
          
          if (!codigosExistentesSet.has(claveUnica)) {
            nuevosConceptosMasivos.push({
              empresa_id: destinoId,
              codigo_concepto: concepto.codigo_concepto,
              nombre: concepto.nombre,
              elemento: concepto.elemento || '',
              clasificacion_balance: concepto.clasificacion_balance || ''
            })
          }
        }
      }

      // Si todos los conceptos ya estaban creados en las empresas de destino:
      if (nuevosConceptosMasivos.length === 0) {
        return NextResponse.json({
          exito: true,
          mensaje: 'Todas las empresas seleccionadas ya cuentan con el catálogo completo de estos conceptos.'
        })
      }

      // 4. Insertar únicamente los conceptos faltantes en Supabase
      const { error: errorInsert } = await supabaseAdmin
        .from('conceptos_niif')
        .insert(nuevosConceptosMasivos)

      if (errorInsert) {
        console.error('Error al copiar conceptos masivamente:', errorInsert)
        return NextResponse.json(
          { exito: false, mensaje: `Error al guardar en base de datos: ${errorInsert.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        exito: true,
        mensaje: `¡Se agregaron ${nuevosConceptosMasivos.length} nuevos conceptos faltantes a las empresas de destino!`
      })
    }

    // ==========================================
    // CASO 2: CREAR UN SOLO CONCEPTO NIIF
    // ==========================================
    // Captura automática: si el body no trae empresa_id, se inyecta desde la cookie activa
    const empresa_id = body.empresa_id || cookieStore.get('empresa_activa')?.value
    const { codigo_concepto, nombre, elemento, clasificacion_balance } = body

    if (!empresa_id || !nombre) {
      return NextResponse.json(
        { exito: false, mensaje: 'Campos requeridos faltantes: empresa_id (o sesión activa) y nombre son obligatorios.' },
        { status: 400 }
      )
    }

    const nuevoConcepto = {
      empresa_id: Number(empresa_id),
      codigo_concepto: codigo_concepto || 'NIIF-001',
      nombre,
      elemento: elemento || '',
      clasificacion_balance: clasificacion_balance || ''
    }

    const { data, error } = await supabaseAdmin
      .from('conceptos_niif')
      .insert([nuevoConcepto])
      .select()

    if (error) {
      console.error('Error al insertar concepto NIIF:', error)
      return NextResponse.json(
        { exito: false, mensaje: `Error al guardar en base de datos: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, datos: data ? data[0] : null })
  } catch (err) {
    console.error('Error inesperado en POST /api/conceptos_niif:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}

// ==========================================
// PUT: Actualizar un concepto NIIF existente
// ==========================================
export async function PUT(req) {
  try {
    const body = await req.json()
    const { id, nombre, elemento, clasificacion_balance, codigo_concepto } = body

    if (!id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El ID del concepto NIIF es obligatorio para actualizar.' },
        { status: 400 }
      )
    }

    const datosActualizar = {}

    if (nombre !== undefined) datosActualizar.nombre = nombre
    if (elemento !== undefined) datosActualizar.elemento = elemento
    if (clasificacion_balance !== undefined) datosActualizar.clasificacion_balance = clasificacion_balance
    if (codigo_concepto !== undefined) datosActualizar.codigo_concepto = codigo_concepto

    const { data, error } = await supabaseAdmin
      .from('conceptos_niif')
      .update(datosActualizar)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error al actualizar concepto NIIF:', error)
      return NextResponse.json(
        { exito: false, mensaje: `Error al actualizar en base de datos: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, datos: data ? data[0] : null })
  } catch (err) {
    console.error('Error inesperado en PUT /api/conceptos_niif:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}

// ==========================================
// DELETE: Eliminar un concepto NIIF
// ==========================================
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El ID del concepto NIIF es obligatorio para eliminar.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('conceptos_niif')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error al eliminar concepto NIIF:', error)
      return NextResponse.json(
        { exito: false, mensaje: `Error al eliminar de la base de datos: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, mensaje: 'Concepto NIIF eliminado correctamente.' })
  } catch (err) {
    console.error('Error inesperado en DELETE /api/conceptos_niif:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}