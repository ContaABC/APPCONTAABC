import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

// Valores válidos para "Tipo de Auxiliar"
const TIPOS_AUXILIAR_VALIDOS = [
  'Auxiliar_General',
  'Cuentas_Bancarias',
  'Cuentas_Proveedor',
  'Cuentas_Clientes',
  'Cuentas_Inventario',
  'Cuentas_Acreedores',
  'Cuentas_Gastos',
  'Cuentas_Caja',
  'Cuentas_Costos',
  'Cuentas_Ingresos',
  'Cuentas_Patrimonio',
  'Cuentas_Activos_Fijos'
]

// ==========================================
// MÉTODOS GET (Consultar datos)
// ==========================================
export async function GET(request) {
  try {
    const cookieStore = await cookies() // <-- CORREGIDO: Await obligatorio
    const { searchParams } = new URL(request.url)
    const accion = searchParams.get('accion')
    
    // Captura automática de empresaId: si no viene en los parámetros, se lee de la cookie activa
    const empresaId = searchParams.get('empresa_id') || cookieStore.get('empresa_activa')?.value
    const subconceptoNiifId = searchParams.get('subconcepto_niif_id')

    // 1. Listar empresas activas
    if (accion === 'listar_empresas') {
      const { data: empresas, error } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social, nombre_comercial')
        .eq('estado', 'Activa')
        .order('razon_social', { ascending: true })

      if (error) throw error

      return NextResponse.json({ exito: true, datos: empresas || [] })
    }

    // 2. Listar Subconceptos NIIF por empresa
    if (accion === 'listar_subconceptos_niif') {
      if (!empresaId) {
        return NextResponse.json(
          { exito: false, mensaje: 'El parámetro empresa_id es obligatorio o no hay sesión activa' },
          { status: 400 }
        )
      }

      const { data: subconceptos, error } = await supabaseAdmin
        .from('subconceptos_niif')
        .select(`
          id,
          codigo,
          nombre,
          elemento,
          empresa_id,
          conceptos_niif (
            id,
            codigo_concepto,
            nombre,
            elemento
          )
        `)
        .eq('empresa_id', empresaId)
        .order('codigo', { ascending: true })

      if (error) throw error

      return NextResponse.json({ exito: true, datos: subconceptos || [] })
    }

    // 3. Generar nuevo Código Auxiliar autogenerado secuencial
    if (accion === 'generar_codigo_auxiliar') {
      if (!empresaId) {
        return NextResponse.json(
          { exito: false, mensaje: 'El parámetro empresa_id es requerido o no hay sesión activa' },
          { status: 400 }
        )
      }

      let query = supabaseAdmin
        .from('conceptos_auxiliares')
        .select('codigo_auxiliar')
        .eq('empresa_id', empresaId)

      if (subconceptoNiifId) {
        query = query.eq('subconcepto_niif_id', subconceptoNiifId)
      }

      const { data: registros, error } = await query
        .order('codigo_auxiliar', { ascending: false })
        .limit(1)

      if (error) throw error

      let siguienteCodigo = '001'
      if (registros && registros.length > 0 && registros[0].codigo_auxiliar) {
        const ultimoCodigoStr = registros[0].codigo_auxiliar
        const numeroLimpio = parseInt(ultimoCodigoStr.replace(/\D/g, ''), 10)
        
        if (!isNaN(numeroLimpio)) {
          siguienteCodigo = String(numeroLimpio + 1).padStart(3, '0')
        }
      }

      return NextResponse.json({ exito: true, nuevo_codigo: siguienteCodigo })
    }

    // 4. Listar Conceptos Auxiliares por empresa (Por defecto)
    if (!empresaId) {
      return NextResponse.json(
        { exito: false, mensaje: 'El parámetro empresa_id es requerido o no hay sesión activa' },
        { status: 400 }
      )
    }

    const { data: conceptos, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .select(`
        *,
        subconceptos_niif (
          id,
          codigo,
          nombre,
          elemento,
          concepto_niif_id,
          conceptos_niif (
            id,
            codigo_concepto,
            nombre,
            elemento
          )
        )
      `)
      .eq('empresa_id', empresaId)
      .order('id', { ascending: false })

    if (error) throw error

    const conceptosFormateados = (conceptos || []).map((item) => ({
      ...item,
      codigo_subconcepto_niif: item.subconceptos_niif?.codigo || null,
      nombre_subconcepto_niif: item.subconceptos_niif?.nombre || null,
      codigo_concepto_niif: item.subconceptos_niif?.conceptos_niif?.codigo_concepto || null,
      nombre_concepto_niif: item.subconceptos_niif?.conceptos_niif?.nombre || null,
      elemento_niif: item.elemento || item.subconceptos_niif?.conceptos_niif?.elemento || item.subconceptos_niif?.elemento || null
    }))

    return NextResponse.json({ exito: true, datos: conceptosFormateados })

  } catch (error) {
    console.error('❌ Error en GET /api/conceptos_auxiliares:', error)
    return NextResponse.json(
      { exito: false, mensaje: 'Error interno en el servidor', error: error.message },
      { status: 500 }
    );
  }
}

// ==========================================
// MÉTODOS POST (Crear registro)
// ==========================================
export async function POST(request) {
  try {
    const cookieStore = await cookies() // <-- CORREGIDO: Await obligatorio
    const body = await request.json()

    // Captura automática de empresa_id: desde el body o la cookie de sesión activa
    const empresa_id = body.empresa_id || body.empresaId || cookieStore.get('empresa_activa')?.value

    const {
      subconcepto_niif_id,
      codigo_auxiliar,
      nombre,
      tipo_entidad,
      descripcion,
      estado,
      elemento
    } = body

    if (!empresa_id || !nombre) {
      return NextResponse.json(
        { exito: false, mensaje: 'Faltan campos obligatorios o no hay sesión activa (empresa_id, nombre)' },
        { status: 400 }
      )
    }

    const tipoAuxiliarSanitizado = TIPOS_AUXILIAR_VALIDOS.includes(tipo_entidad)
      ? tipo_entidad
      : 'Auxiliar_General'

    const subconceptoUuid = subconcepto_niif_id && String(subconcepto_niif_id).trim() !== '' 
      ? String(subconcepto_niif_id).trim() 
      : null

    let codigoFinal = codigo_auxiliar ? String(codigo_auxiliar).trim() : null

    if (!codigoFinal) {
      let query = supabaseAdmin
        .from('conceptos_auxiliares')
        .select('codigo_auxiliar')
        .eq('empresa_id', Number(empresa_id))

      if (subconceptoUuid) {
        query = query.eq('subconcepto_niif_id', subconceptoUuid)
      }

      const { data: registrosExistentes } = await query
        .order('codigo_auxiliar', { ascending: false })
        .limit(1)

      codigoFinal = '001'
      if (registrosExistentes && registrosExistentes.length > 0 && registrosExistentes[0].codigo_auxiliar) {
        const numActual = parseInt(registrosExistentes[0].codigo_auxiliar.replace(/\D/g, ''), 10)
        if (!isNaN(numActual)) {
          codigoFinal = String(numActual + 1).padStart(3, '0')
        }
      }
    }

    let codigoDuplicado = true
    let intentos = 0
    while (codigoDuplicado && intentos < 15) {
      let queryCheck = supabaseAdmin
        .from('conceptos_auxiliares')
        .select('id')
        .eq('empresa_id', Number(empresa_id))
        .eq('codigo_auxiliar', codigoFinal)

      if (subconceptoUuid) {
        queryCheck = queryCheck.eq('subconcepto_niif_id', subconceptoUuid)
      }

      const { data: existeCodigo } = await queryCheck.maybeSingle()

      if (existeCodigo) {
        const partes = codigoFinal.split('-')
        const ultimoSegmento = partes[partes.length - 1]
        const numActual = parseInt(ultimoSegmento, 10)
        
        if (!isNaN(numActual)) {
          partes[partes.length - 1] = String(numActual + 1).padStart(3, '0')
          codigoFinal = partes.join('-')
        } else {
          intentos++
        }
      } else {
        codigoDuplicado = false
      }
      intentos++
    }

    const insertPayload = {
      empresa_id: Number(empresa_id),
      subconcepto_niif_id: subconceptoUuid,
      codigo_auxiliar: codigoFinal,
      nombre: String(nombre).trim(),
      tipo_entidad: tipoAuxiliarSanitizado,
      descripcion: descripcion ? String(descripcion).trim() : null,
      estado: estado || 'Activo',
      elemento: elemento ? String(elemento).trim() : null
    }

    const { data, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .insert([insertPayload])
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
    const cookieStore = await cookies() // <-- CORREGIDO: Await obligatorio
    const body = await request.json()

    // Captura automática opcional de empresa_id si viene en el body o cookie
    const empresa_id = body.empresa_id || body.empresaId || cookieStore.get('empresa_activa')?.value

    const {
      id,
      subconcepto_niif_id,
      codigo_auxiliar,
      nombre,
      tipo_entidad,
      descripcion,
      estado,
      elemento
    } = body

    if (!id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El id del concepto es obligatorio para actualizar' },
        { status: 400 }
      )
    }

    const tipoAuxiliarSanitizado = TIPOS_AUXILIAR_VALIDOS.includes(tipo_entidad)
      ? tipo_entidad
      : 'Auxiliar_General'

    const subconceptoUuid = subconcepto_niif_id && String(subconcepto_niif_id).trim() !== '' 
      ? String(subconcepto_niif_id).trim() 
      : null

    const updatePayload = {
      tipo_entidad: tipoAuxiliarSanitizado,
      descripcion: descripcion ? String(descripcion).trim() : null,
      subconcepto_niif_id: subconceptoUuid,
      elemento: elemento ? String(elemento).trim() : null
    }

    if (empresa_id) updatePayload.empresa_id = Number(empresa_id)
    if (codigo_auxiliar) updatePayload.codigo_auxiliar = String(codigo_auxiliar).trim()
    if (nombre) updatePayload.nombre = String(nombre).trim()
    if (estado) updatePayload.estado = estado

    const { data, error } = await supabaseAdmin
      .from('conceptos_auxiliares')
      .update(updatePayload)
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