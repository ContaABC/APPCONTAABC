import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// 1. OBTENER REGISTROS (GET)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const empresa_id = searchParams.get('empresa_id')

    if (!empresa_id) {
      return NextResponse.json({ exito: false, mensaje: 'Falta el id de la empresa.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('clases_documento')
      .select('*')
      .eq('empresa_id', Number(empresa_id))
      .order('id', { ascending: true })

    if (error) throw error

    return NextResponse.json({ exito: true, datos: data })
  } catch (err) {
    return NextResponse.json({ exito: false, mensaje: err.message }, { status: 500 })
  }
}

// 2. INSERTAR NUEVA CLASE Y SU CONSECUTIVO INICIAL (POST)
export async function POST(request) {
  try {
    const body = await request.json()

    const empresa_id = body.empresa_id || body.empresaId
    const codigo_clase = String(body.codigo_clase || body.codigoClase || '').trim().toUpperCase()
    const nombre_clase = String(body.nombre_clase || body.nombreClase || '').trim().toUpperCase()
    const descripcion = body.descripcion || ''
    const afecta_caja_bancos = body.afecta_caja_bancos ?? body.afectaCajaBancos ?? false

    // Si el formulario no manda un prefijo personalizado, usa el codigo_clase
    const prefijo = String(body.prefijo || codigo_clase).trim().toUpperCase()
    const consecutivo_inicial = Number(body.consecutivo_inicial || body.consecutivoInicial) || 1

    // Todas las nuevas clases nacen como 'Activa'
    const estadoTexto = 'Activa'

    if (!empresa_id || !codigo_clase || !nombre_clase) {
      return NextResponse.json({ 
        exito: false, 
        mensaje: 'Campos requeridos faltantes: empresa_id, codigo_clase o nombre_clase' 
      }, { status: 400 })
    }

    // PASO 1: Verificar si el código de documento ya existe para la empresa
    const { data: claseExistente } = await supabase
      .from('clases_documento')
      .select('id, es_sistema, codigo_clase')
      .eq('empresa_id', Number(empresa_id))
      .eq('codigo_clase', codigo_clase)
      .maybeSingle()

    if (claseExistente) {
      return NextResponse.json({
        exito: false,
        mensaje: `El código de documento "${codigo_clase}" ya existe para esta empresa${claseExistente.es_sistema ? ' (es un documento del Sistema)' : ''}. Utiliza un código diferente.`
      }, { status: 400 })
    }

    // PASO 2: Insertar en la tabla clases_documento
    const { data: nuevaClase, error: errorClase } = await supabase
      .from('clases_documento')
      .insert([
        {
          empresa_id: Number(empresa_id),
          codigo_clase: codigo_clase,
          nombre_clase: nombre_clase,
          descripcion: descripcion,
          afecta_caja_bancos: Boolean(afecta_caja_bancos),
          estado: estadoTexto,
          es_sistema: false
        }
      ])
      .select()
      .single()

    if (errorClase) {
      console.error('Error al insertar clase_documento:', errorClase)
      return NextResponse.json({ exito: false, mensaje: errorClase.message }, { status: 500 })
    }

    // PASO 3: Insertar en la tabla consecutivos asignando 'prefijo = codigo_clase' y 'ultimo_numero'
    const { error: errorConsecutivo } = await supabase
      .from('consecutivos')
      .upsert([
        {
          empresa_id: Number(empresa_id),
          clase_documento_id: nuevaClase.id,
          prefijo: prefijo,
          ultimo_numero: consecutivo_inicial
        }
      ], { onConflict: 'empresa_id, clase_documento_id' })

    if (errorConsecutivo) {
      console.error('Error al insertar en consecutivos:', errorConsecutivo)
      
      // ROLLBACK GARANTIZADO
      await supabase
        .from('clases_documento')
        .delete()
        .eq('id', nuevaClase.id)
        .eq('empresa_id', Number(empresa_id))

      return NextResponse.json({ 
        exito: false, 
        mensaje: `Error al crear el consecutivo asociado: ${errorConsecutivo.message}` 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      exito: true, 
      mensaje: 'Clase de documento y consecutivo inicial creados exitosamente', 
      datos: nuevaClase 
    })
  } catch (err) {
    console.error('Error en POST /api/clases-documento:', err)
    return NextResponse.json({ exito: false, mensaje: err.message }, { status: 500 })
  }
}

// 3. ACTUALIZAR REGISTRO (PUT)
export async function PUT(request) {
  try {
    const body = await request.json()
    
    const id = body.id || body.idActual
    const nombre_clase = body.nombre_clase || body.nombreClase
    const descripcion = body.descripcion
    const afecta_caja_bancos = body.afecta_caja_bancos ?? body.afectaCajaBancos

    if (!id) {
      return NextResponse.json({ exito: false, mensaje: 'El ID es obligatorio para actualizar' }, { status: 400 })
    }

    const datosActualizar = {
      nombre_clase: String(nombre_clase).trim().toUpperCase(),
      descripcion,
      afecta_caja_bancos: Boolean(afecta_caja_bancos)
    }

    // Si viene la propiedad 'estado' (por clic en la tabla), se actualiza el estado
    if (body.estado !== undefined) {
      const esActivo = body.estado
      datosActualizar.estado = (esActivo === true || esActivo === 'Activa' || esActivo === '1' || esActivo === 1) 
        ? 'Activa' 
        : 'Inactiva'
    }

    const { data, error } = await supabase
      .from('clases_documento')
      .update(datosActualizar)
      .eq('id', id)
      .select()

    if (error) throw error

    return NextResponse.json({ exito: true, mensaje: 'Actualizado correctamente', datos: data })
  } catch (err) {
    return NextResponse.json({ exito: false, mensaje: err.message }, { status: 500 })
  }
}

// 4. ELIMINAR REGISTRO (DELETE)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const empresa_id = searchParams.get('empresa_id')

    if (!id || !empresa_id) {
      return NextResponse.json({ exito: false, mensaje: 'Faltan parámetros requeridos (id, empresa_id).' }, { status: 400 })
    }

    const { error } = await supabase
      .from('clases_documento')
      .delete()
      .eq('id', Number(id))
      .eq('empresa_id', Number(empresa_id))

    if (error) throw error

    return NextResponse.json({ exito: true, mensaje: 'Registro eliminado correctamente.' })
  } catch (err) {
    return NextResponse.json({ exito: false, mensaje: err.message }, { status: 500 })
  }
}