import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

// Valores válidos según la restricción CHECK de la base de datos
const TIPOS_ENTIDAD_VALIDOS = [
  'Auxiliar_General',
  'Actividad_ABC',
  'Centro_Costo',
  'Subcuenta_Gasto'
]

// ==========================================
// MÉTODOS GET (Consultar datos)
// ==========================================
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const accion = searchParams.get('accion')
    const empresaId = searchParams.get('empresa_id')

    // 1. CASO: Listar empresas activas
    if (accion === 'listar_empresas') {
      const { data: empresas, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social, nombre_comercial')
        .eq('estado', 'Activa')
        .order('razon_social', { ascending: true })

      if (error) throw error

      return NextResponse.json({ exito: true, datos: empresas })
    }

    // 2. CASO: Listar Subconceptos NIIF por empresa
    if (accion === 'listar_subconceptos_niif') {
      if (!empresaId) {
        return NextResponse.json(
          { exito: false, mensaje: 'El parámetro empresa_id es obligatorio' },
          { status: 400 }
        )
      }

      const { data: subconceptos, error } = await supabaseAdmin
        .from('subconceptos_niif')
        .select('id, codigo, nombre, empresa_id')
        .eq('empresa_id', empresaId)
        .order('codigo', { ascending: true })

      if (error) throw error

      return NextResponse.json({ exito: true, datos: subconceptos })
    }

    // 3. CASO POR DEFECTO: Listar Conceptos Auxiliares
    if (!empresaId) {
      return NextResponse.json(
        { exito: false, mensaje: 'El parámetro empresa_id es requerido para listar conceptos' },
        { status: 400 }
      )
    }

    const { data: conceptos, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .select(`
        *,
        subconceptos_niif (
          codigo,
          nombre
        )
      `)
      .eq('empresa_id', empresaId)
      .order('id', { ascending: false })

    if (error) throw error

    const conceptosFormateados = conceptos.map((item) => ({
      ...item,
      codigo_niif_padre: item.subconceptos_niif?.codigo || null,
      nombre_niif_padre: item.subconceptos_niif?.nombre || null
    }))

    return NextResponse.json({ exito: true, datos: conceptosFormateados })

  } catch (error) {
    console.error('❌ Error en GET /api/conceptos_auxiliares:', error)
    return NextResponse.json(
      { exito: false, mensaje: 'Error interno en el servidor', error: error.message },
      { status: 500 }
    )
  }
}

// ==========================================
// MÉTODOS POST (Crear registro)
// ==========================================
export async function POST(request) {
  try {
    const body = await request.json()

    const {
      empresa_id,
      subconcepto_niif_id,
      codigo_auxiliar,
      nombre,
      tipo_entidad,
      descripcion,
      nombre_inductor,
      capacidad_total_inductor,
      costo_estimado_inductor,
      estado
    } = body

    if (!empresa_id || !codigo_auxiliar || !nombre) {
      return NextResponse.json(
        { exito: false, mensaje: 'Faltan campos obligatorios (empresa_id, codigo_auxiliar, nombre)' },
        { status: 400 }
      )
    }

    // Validación estricta para evitar CHECK constraint failure
    const tipoEntidadSanitizado = TIPOS_ENTIDAD_VALIDOS.includes(tipo_entidad)
      ? tipo_entidad
      : 'Auxiliar_General'

    const esActividadABC = tipoEntidadSanitizado === 'Actividad_ABC'

    // Validación Backend: Si es Actividad ABC, exige obligatoriamente los 3 campos de inductor
    if (esActividadABC) {
      if (
        !nombre_inductor || !String(nombre_inductor).trim() ||
        !capacidad_total_inductor || !String(capacidad_total_inductor).trim() ||
        costo_estimado_inductor === null || costo_estimado_inductor === undefined || costo_estimado_inductor === '' || isNaN(costo_estimado_inductor)
      ) {
        return NextResponse.json(
          { exito: false, mensaje: 'Para la entidad Actividad ABC, los campos "Nombre del Inductor", "Capacidad Total" y "Costo Estimado" son obligatorios.' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .insert([
        {
          empresa_id: Number(empresa_id),
          subconcepto_niif_id: subconcepto_niif_id ? Number(subconcepto_niif_id) : null,
          codigo_auxiliar,
          nombre,
          tipo_entidad: tipoEntidadSanitizado,
          descripcion: descripcion || null,
          nombre_inductor: esActividadABC ? String(nombre_inductor).trim() : null,
          capacidad_total_inductor: esActividadABC ? String(capacidad_total_inductor).trim() : null,
          costo_estimado_inductor: esActividadABC ? parseFloat(costo_estimado_inductor) : null,
          estado: estado || 'Activo'
        }
      ])
      .select()

    if (error) {
      console.error('❌ Error al insertar concepto auxiliar:', error)
      return NextResponse.json(
        { exito: false, mensaje: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      exito: true,
      mensaje: 'Concepto auxiliar creado correctamente',
      datos: data[0]
    })

  } catch (error) {
    console.error('❌ Error fatal en POST /api/conceptos_auxiliares:', error)
    return NextResponse.json(
      { exito: false, mensaje: 'Error interno del servidor', error: error.message },
      { status: 500 }
    )
  }
}

// ==========================================
// MÉTODOS PUT (Actualizar registro)
// ==========================================
export async function PUT(request) {
  try {
    const body = await request.json()

    const {
      id,
      empresa_id,
      subconcepto_niif_id,
      codigo_auxiliar,
      nombre,
      tipo_entidad,
      descripcion,
      nombre_inductor,
      capacidad_total_inductor,
      costo_estimado_inductor,
      estado
    } = body

    if (!id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El id del concepto es obligatorio para actualizar' },
        { status: 400 }
      )
    }

    const tipoEntidadSanitizado = TIPOS_ENTIDAD_VALIDOS.includes(tipo_entidad)
      ? tipo_entidad
      : 'Auxiliar_General'

    const esActividadABC = tipoEntidadSanitizado === 'Actividad_ABC'

    // Validación Backend: Si es Actividad ABC, exige obligatoriamente los 3 campos de inductor
    if (esActividadABC) {
      if (
        !nombre_inductor || !String(nombre_inductor).trim() ||
        !capacidad_total_inductor || !String(capacidad_total_inductor).trim() ||
        costo_estimado_inductor === null || costo_estimado_inductor === undefined || costo_estimado_inductor === '' || isNaN(costo_estimado_inductor)
      ) {
        return NextResponse.json(
          { exito: false, mensaje: 'Para la entidad Actividad ABC, los campos "Nombre del Inductor", "Capacidad Total" y "Costo Estimado" son obligatorios.' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .update({
        empresa_id: empresa_id ? Number(empresa_id) : undefined,
        subconcepto_niif_id: subconcepto_niif_id ? Number(subconcepto_niif_id) : null,
        codigo_auxiliar,
        nombre,
        tipo_entidad: tipoEntidadSanitizado,
        descripcion: descripcion || null,
        nombre_inductor: esActividadABC ? String(nombre_inductor).trim() : null,
        capacidad_total_inductor: esActividadABC ? String(capacidad_total_inductor).trim() : null,
        costo_estimado_inductor: esActividadABC ? parseFloat(costo_estimado_inductor) : null,
        estado
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('❌ Error al actualizar concepto auxiliar:', error)
      return NextResponse.json(
        { exito: false, mensaje: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      exito: true,
      mensaje: 'Concepto auxiliar actualizado correctamente',
      datos: data[0]
    })

  } catch (error) {
    console.error('❌ Error fatal en PUT /api/conceptos_auxiliares:', error)
    return NextResponse.json(
      { exito: false, mensaje: 'Error interno del servidor', error: error.message },
      { status: 500 }
    )
  }
}

// ==========================================
// MÉTODOS DELETE (Eliminar registro)
// ==========================================
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El id es requerido para eliminar' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ Error al eliminar concepto auxiliar:', error)
      return NextResponse.json(
        { exito: false, mensaje: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      exito: true,
      mensaje: 'Concepto auxiliar eliminado correctamente'
    })

  } catch (error) {
    console.error('❌ Error fatal en DELETE /api/conceptos_auxiliares:', error)
    return NextResponse.json(
      { exito: false, mensaje: 'Error interno del servidor', error: error.message },
      { status: 500 }
    )
  }
}