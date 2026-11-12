import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ==========================================
// GET: Obtener subconceptos por empresa/concepto o generar consecutivo
// ==========================================
export async function GET(req) {
  try {
    const cookieStore = cookies()
    const { searchParams } = new URL(req.url)
    
    // Captura automática de empresa_id: desde los parámetros o leyendo la cookie activa
    const empresa_id = searchParams.get('empresa_id') || cookieStore.get('empresa_activa')?.value
    const concepto_niif_id = searchParams.get('concepto_niif_id')
    const accion = searchParams.get('accion')

    // Acción 1: Obtener empresas para los dropdowns
    if (accion === 'listar_empresas') {
      const { data, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social, nombre_comercial')
        .order('razon_social', { ascending: true })

      if (error) throw error
      return NextResponse.json({ exito: true, datos: data || [] })
    }

    // Acción 2: Obtener conceptos NIIF (padres) de una empresa con el elemento
    if (accion === 'conceptos_niif_por_empresa' && empresa_id) {
      const empIdParsed = parseInt(empresa_id, 10)

      const { data, error } = await supabaseAdmin
        .from('conceptos_niif')
        .select('id, codigo_concepto, nombre, elemento')
        .eq('empresa_id', empIdParsed)
        .order('codigo_concepto', { ascending: true })

      if (error) throw error
      return NextResponse.json({ exito: true, datos: data || [] })
    }

    // Acción 3: Generar siguiente código correlativo por concepto NIIF
    if (accion === 'siguiente_codigo' && concepto_niif_id) {
      const conceptoIdParsed = parseInt(concepto_niif_id, 10)

      const { data: conceptoPadre } = await supabaseAdmin
        .from('conceptos_niif')
        .select('codigo_concepto')
        .eq('id', conceptoIdParsed)
        .single()

      const prefix = conceptoPadre?.codigo_concepto ? `${conceptoPadre.codigo_concepto}-` : 'SUB-'

      const { data: existentes, error } = await supabaseAdmin
        .from('subconceptos_niif')
        .select('codigo')
        .eq('concepto_niif_id', conceptoIdParsed)

      if (error) throw error

      let maxNum = 0
      if (existentes && existentes.length > 0) {
        existentes.forEach((item) => {
          if (item.codigo) {
            const partes = item.codigo.split('-')
            const num = parseInt(partes[partes.length - 1], 10)
            if (!isNaN(num) && num > maxNum) maxNum = num
          }
        })
      }

      const siguienteCodigo = `${prefix}${String(maxNum + 1).padStart(3, '0')}`
      return NextResponse.json({ exito: true, siguiente_codigo: siguienteCodigo })
    }

    // Consulta general de subconceptos NIIF por empresa
    if (!empresa_id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El id de la empresa es requerido o no hay sesión activa.' },
        { status: 400 }
      )
    }

    const empIdParsed = parseInt(empresa_id, 10)

    let query = supabaseAdmin
      .from('subconceptos_niif')
      .select(`
        id,
        empresa_id,
        concepto_niif_id,
        codigo,
        nombre,
        descripcion,
        elemento,
        activo,
        created_at,
        conceptos_niif (
          id,
          codigo_concepto,
          nombre,
          elemento
        )
      `)
      .eq('empresa_id', empIdParsed)

    if (concepto_niif_id) {
      query = query.eq('concepto_niif_id', parseInt(concepto_niif_id, 10))
    }

    const { data, error } = await query.order('codigo', { ascending: true })

    if (error) throw error

    return NextResponse.json({ exito: true, datos: data || [] })
  } catch (error) {
    console.error('Error en GET /api/subconceptos_niif:', error)
    return NextResponse.json(
      { exito: false, mensaje: error.message || 'Error al consultar subconceptos NIIF.' },
      { status: 500 }
    )
  }
}

// ==========================================
// POST: Crear subconcepto NIIF o Copiar/Clonar desde/hacia otras empresas
// ==========================================
export async function POST(req) {
  try {
    const cookieStore = cookies()
    const body = await req.json()

    // Operación: Copiar / Clonar catálogo de subconceptos
    if (
      body.accion === 'clonar_subconceptos' || 
      body.accion === 'copiar_subconceptos' ||
      body.accion === 'copiar_a_empresas'
    ) {
      const { empresa_origen_id, empresas_destino_ids, empresa_destino_id } = body

      const origenIdParsed = parseInt(empresa_origen_id, 10)
      const destinos = (empresas_destino_ids || (empresa_destino_id ? [empresa_destino_id] : []))
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id))

      if (!origenIdParsed || destinos.length === 0) {
        return NextResponse.json(
          { exito: false, mensaje: 'Debes seleccionar la empresa origen y al menos una empresa destino válida.' },
          { status: 400 }
        )
      }

      const { data: origenSubconceptos, error: errOrigen } = await supabaseAdmin
        .from('subconceptos_niif')
        .select(`
          codigo,
          nombre,
          descripcion,
          elemento,
          activo,
          conceptos_niif (
            codigo_concepto
          )
        `)
        .eq('empresa_id', origenIdParsed)

      if (errOrigen) throw errOrigen

      if (!origenSubconceptos || origenSubconceptos.length === 0) {
        return NextResponse.json({
          exito: false,
          mensaje: 'La empresa origen no tiene subconceptos NIIF registrados para copiar.'
        })
      }

      let totalInsertados = 0
      let totalOmitidos = 0

      for (const destId of destinos) {
        const { data: conceptosDestino } = await supabaseAdmin
          .from('conceptos_niif')
          .select('id, codigo_concepto')
          .eq('empresa_id', destId)

        if (!conceptosDestino || conceptosDestino.length === 0) continue

        const mapConceptos = new Map(conceptosDestino.map((c) => [c.codigo_concepto, c.id]))

        const { data: subExistentes } = await supabaseAdmin
          .from('subconceptos_niif')
          .select('codigo, nombre, concepto_niif_id')
          .eq('empresa_id', destId)

        const setNombresExistentes = new Set(
          (subExistentes || []).map((s) => `${s.concepto_niif_id}_${s.nombre.toLowerCase().trim()}`)
        )

        const maxConsecutivoPorConcepto = new Map()

        ;(subExistentes || []).forEach((s) => {
          const partes = (s.codigo || '').split('-')
          const num = parseInt(partes[partes.length - 1], 10)
          if (!isNaN(num)) {
            const maxActual = maxConsecutivoPorConcepto.get(s.concepto_niif_id) || 0
            if (num > maxActual) maxConsecutivoPorConcepto.set(s.concepto_niif_id, num)
          }
        })

        const registrosInsertar = []

        for (const sub of origenSubconceptos) {
          const codigoPadre = sub.conceptos_niif?.codigo_concepto
          const conceptoDestinoId = mapConceptos.get(codigoPadre)

          if (conceptoDestinoId) {
            const claveNombre = `${conceptoDestinoId}_${sub.nombre.toLowerCase().trim()}`

            if (!setNombresExistentes.has(claveNombre)) {
              const maxActual = maxConsecutivoPorConcepto.get(conceptoDestinoId) || 0
              const nuevoNum = maxActual + 1
              maxConsecutivoPorConcepto.set(conceptoDestinoId, nuevoNum)

              const nuevoCodigo = `${codigoPadre}-${String(nuevoNum).padStart(3, '0')}`

              registrosInsertar.push({
                empresa_id: destId,
                concepto_niif_id: conceptoDestinoId,
                codigo: nuevoCodigo,
                nombre: sub.nombre.trim(),
                descripcion: sub.descripcion?.trim() || null,
                elemento: sub.elemento || null,
                activo: sub.activo ?? true
              })

              setNombresExistentes.add(claveNombre)
            } else {
              totalOmitidos++
            }
          } else {
            totalOmitidos++
          }
        }

        if (registrosInsertar.length > 0) {
          const { error: errInsert } = await supabaseAdmin
            .from('subconceptos_niif')
            .insert(registrosInsertar)

          if (!errInsert) {
            totalInsertados += registrosInsertar.length
          } else {
            console.error(`Error al insertar en empresa destino ${destId}:`, errInsert)
          }
        }
      }

      return NextResponse.json({
        exito: true,
        mensaje: `Proceso completado. Se copió(aron) ${totalInsertados} subconcepto(s) de forma exitosa. Omitidos: ${totalOmitidos} (duplicados o falta concepto padre).`,
        insertados: totalInsertados,
        omitidos: totalOmitidos
      })
    }

    // Operación: Crear un único subconcepto NIIF
    // Captura automática de empresa_id: desde el body o leyendo la cookie activa
    const empresa_id = body.empresa_id || cookieStore.get('empresa_activa')?.value
    const { concepto_niif_id, codigo, nombre, descripcion, elemento } = body

    const empIdParsed = parseInt(empresa_id, 10)
    const conceptoIdParsed = parseInt(concepto_niif_id, 10)

    if (isNaN(empIdParsed) || isNaN(conceptoIdParsed) || !nombre?.trim()) {
      return NextResponse.json(
        { exito: false, mensaje: 'Empresa (o sesión activa), Concepto NIIF padre y Nombre son campos obligatorios.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('subconceptos_niif')
      .insert([
        {
          empresa_id: empIdParsed,
          concepto_niif_id: conceptoIdParsed,
          codigo: codigo || null,
          nombre: nombre.trim(),
          descripcion: descripcion?.trim() || null,
          elemento: elemento || null
        }
      ])
      .select()

    if (error) throw error

    return NextResponse.json({ exito: true, datos: data[0] })
  } catch (error) {
    console.error('Error en POST /api/subconceptos_niif:', error)
    return NextResponse.json(
      { exito: false, mensaje: error.message || 'Error al guardar el subconcepto NIIF.' },
      { status: 500 }
    )
  }
}

// ==========================================
// PUT: Actualizar subconcepto NIIF
// ==========================================
export async function PUT(req) {
  try {
    const body = await req.json()
    const { id, concepto_niif_id, nombre, descripcion, elemento, activo } = body

    if (!id || !nombre?.trim()) {
      return NextResponse.json(
        { exito: false, mensaje: 'ID y Nombre son campos obligatorios.' },
        { status: 400 }
      )
    }

    const updateData = {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null
    }

    if (concepto_niif_id) updateData.concepto_niif_id = parseInt(concepto_niif_id, 10)
    if (elemento !== undefined) updateData.elemento = elemento || null
    if (typeof activo === 'boolean') updateData.activo = activo

    const { data, error } = await supabaseAdmin
      .from('subconceptos_niif')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error

    return NextResponse.json({ exito: true, datos: data[0] })
  } catch (error) {
    console.error('Error en PUT /api/subconceptos_niif:', error)
    return NextResponse.json(
      { exito: false, mensaje: error.message || 'Error al actualizar el subconcepto NIIF.' },
      { status: 500 }
    )
  }
}

// ==========================================
// DELETE: Eliminar subconcepto NIIF
// ==========================================
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El ID del subconcepto es requerido.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('subconceptos_niif')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ exito: true, mensaje: 'Subconcepto NIIF eliminado correctamente.' })
  } catch (error) {
    console.error('Error en DELETE /api/subconceptos_niif:', error)
    return NextResponse.json(
      { exito: false, mensaje: error.message || 'Error al eliminar el subconcepto NIIF.' },
      { status: 500 }
    )
  }
}