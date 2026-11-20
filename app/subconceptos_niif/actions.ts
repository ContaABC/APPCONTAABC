'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ==========================================
// 1. Obtener conceptos NIIF (padres) de una empresa
// ==========================================
export async function obtenerConceptosNiifPorEmpresaAction(empresaId: string | number) {
  try {
    if (!empresaId) return { exito: false, mensaje: 'El id de la empresa es requerido.' }
    const empIdParsed = parseInt(String(empresaId), 10)

    const { data, error } = await supabaseAdmin
      .from('conceptos_niif')
      .select('id, codigo_concepto, nombre, elemento')
      .eq('empresa_id', empIdParsed)
      .order('codigo_concepto', { ascending: true })

    if (error) throw error
    return { exito: true, datos: data || [] }
  } catch (err: any) {
    console.error('Error en obtenerConceptosNiifPorEmpresaAction:', err)
    return { exito: false, mensaje: err.message || 'Error al obtener conceptos NIIF.' }
  }
}

// ==========================================
// 2. Generar siguiente código correlativo por concepto NIIF
// ==========================================
export async function siguienteCodigoSubconceptoAction(conceptoNiifId: string | number) {
  try {
    if (!conceptoNiifId) return { exito: false, mensaje: 'concepto_niif_id es requerido.' }
    const conceptoIdParsed = parseInt(String(conceptoNiifId), 10)

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
          if (!isNaN(num) && num > maxNum) {
            maxNum = num
          }
        }
      })
    }

    const siguienteCodigo = `${prefix}${String(maxNum + 1).padStart(3, '0')}`
    return { exito: true, siguiente_codigo: siguienteCodigo }
  } catch (err: any) {
    console.error('Error en siguienteCodigoSubconceptoAction:', err)
    return { exito: false, mensaje: err.message || 'Error al obtener consecutivo.' }
  }
}

// ==========================================
// 3. Obtener subconceptos NIIF por empresa / concepto
// ==========================================
export async function obtenerSubconceptosAction(empresaIdParam?: string | number, conceptoNiifIdParam?: string | number) {
  try {
    const cookieStore = await cookies()
    const empresa_id = empresaIdParam || cookieStore.get('empresa_activa')?.value

    if (!empresa_id) {
      return { exito: false, mensaje: 'El id de la empresa es requerido o no hay sesión activa.' }
    }

    const empIdParsed = parseInt(String(empresa_id), 10)

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

    if (conceptoNiifIdParam) {
      query = query.eq('concepto_niif_id', parseInt(String(conceptoNiifIdParam), 10))
    }

    const { data, error } = await query.order('codigo', { ascending: true })

    if (error) throw error

    return { exito: true, datos: data || [] }
  } catch (err: any) {
    console.error('Error en obtenerSubconceptosAction:', err)
    return { exito: false, mensaje: err.message || 'Error al consultar subconceptos NIIF.' }
  }
}

// ==========================================
// 4. Crear un único subconcepto NIIF
// ==========================================
export async function crearSubconceptoAction(formData: {
  empresa_id?: string | number;
  concepto_niif_id: string | number;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  elemento?: string;
}) {
  try {
    const cookieStore = await cookies()
    const empresa_id = formData.empresa_id || cookieStore.get('empresa_activa')?.value
    const { concepto_niif_id, codigo, nombre, descripcion, elemento } = formData

    const empIdParsed = parseInt(String(empresa_id), 10)
    const conceptoIdParsed = parseInt(String(concepto_niif_id), 10)

    if (isNaN(empIdParsed) || isNaN(conceptoIdParsed) || !nombre?.trim()) {
      return { exito: false, mensaje: 'Empresa (o sesión activa), Concepto NIIF padre y Nombre son campos obligatorios.' }
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

    return { exito: true, datos: data ? data[0] : null }
  } catch (err: any) {
    console.error('Error en crearSubconceptoAction:', err)
    return { exito: false, mensaje: err.message || 'Error al guardar el subconcepto NIIF.' }
  }
}

// ==========================================
// 5. Clonar / Copiar subconceptos masivamente
// ==========================================
export async function clonarSubconceptosAction(payload: {
  accion?: string;
  empresa_origen_id: string | number;
  empresas_destino_ids?: (string | number)[];
  empresa_destino_id?: string | number;
}) {
  try {
    const { empresa_origen_id, empresas_destino_ids, empresa_destino_id } = payload

    const origenIdParsed = parseInt(String(empresa_origen_id), 10)
    const destinos = (empresas_destino_ids || (empresa_destino_id ? [empresa_destino_id] : []))
      .map((id) => parseInt(String(id), 10))
      .filter((id) => !isNaN(id))

    if (!origenIdParsed || destinos.length === 0) {
      return { exito: false, mensaje: 'Debes seleccionar la empresa origen y al menos una empresa destino válida.' }
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
      return { exito: false, mensaje: 'La empresa origen no tiene subconceptos NIIF registrados para copiar.' }
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
        const conceptoPadreRel = Array.isArray(sub.conceptos_niif) ? sub.conceptos_niif[0] : sub.conceptos_niif;
        const codigoPadre = (conceptoPadreRel as any)?.codigo_concepto;
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

    return {
      exito: true,
      mensaje: `Proceso completado. Se copió(aron) ${totalInsertados} subconcepto(s) de forma exitosa. Omitidos: ${totalOmitidos} (duplicados o falta concepto padre).`,
      insertados: totalInsertados,
      omitidos: totalOmitidos
    }
  } catch (err: any) {
    console.error('Error en clonarSubconceptosAction:', err)
    return { exito: false, mensaje: err.message || 'Error al clonar subconceptos NIIF.' }
  }
}

// ==========================================
// 6. Actualizar subconcepto NIIF
// ==========================================
export async function actualizarSubconceptoAction(formData: {
  id: string | number;
  concepto_niif_id?: string | number;
  nombre: string;
  descripcion?: string;
  elemento?: string;
  activo?: boolean;
}) {
  try {
    const { id, concepto_niif_id, nombre, descripcion, elemento, activo } = formData

    if (!id || !nombre?.trim()) {
      return { exito: false, mensaje: 'ID y Nombre son campos obligatorios.' }
    }

    const updateData: Record<string, any> = {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null
    }

    if (concepto_niif_id) updateData.concepto_niif_id = parseInt(String(concepto_niif_id), 10)
    if (elemento !== undefined) updateData.elemento = elemento || null
    if (typeof activo === 'boolean') updateData.activo = activo

    const { data, error } = await supabaseAdmin
      .from('subconceptos_niif')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error

    return { exito: true, datos: data ? data[0] : null }
  } catch (err: any) {
    console.error('Error en actualizarSubconceptoAction:', err)
    return { exito: false, mensaje: err.message || 'Error al actualizar el subconcepto NIIF.' }
  }
}

// ==========================================
// 7. Eliminar subconcepto NIIF
// ==========================================
export async function eliminarSubconceptoAction(id: string | number) {
  try {
    if (!id) {
      return { exito: false, mensaje: 'El ID del subconcepto es requerido.' }
    }

    const { error } = await supabaseAdmin
      .from('subconceptos_niif')
      .delete()
      .eq('id', id)

    if (error) throw error

    return { exito: true, mensaje: 'Subconcepto NIIF eliminado correctamente.' }
  } catch (err: any) {
    console.error('Error en eliminarSubconceptoAction:', err)
    return { exito: false, mensaje: err.message || 'Error al eliminar el subconcepto NIIF.' }
  }
}