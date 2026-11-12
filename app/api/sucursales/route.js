import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ==========================================
// GET: Obtener sucursales, empresas o código
// ==========================================
export async function GET(req) {
  try {
    const cookieStore = await cookies()
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')
    
    // Captura automática de empresaId: desde parámetros o leyendo la cookie activa
    const empresaId = searchParams.get('empresa_id') || cookieStore.get('empresa_activa')?.value

    // 1. Accionar listado de empresas para el select principal
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

    // 2. Generar el siguiente código consecutivo (ej: SUC-001, SUC-002)
    if (accion === 'siguiente_codigo') {
      if (!empresaId) {
        return NextResponse.json(
          { exito: false, mensaje: 'empresa_id es requerido o no hay sesión activa para el consecutivo.' },
          { status: 400 }
        )
      }

      const { data: sucursales, error } = await supabaseAdmin
        .from('sucursales')
        .select('codigo_sucursal')
        .eq('empresa_id', empresaId)

      if (error) {
        return NextResponse.json(
          { exito: false, mensaje: `Error al obtener consecutivo: ${error.message}` },
          { status: 500 }
        )
      }

      let maxNum = 0
      if (sucursales && sucursales.length > 0) {
        sucursales.forEach((s) => {
          if (s.codigo_sucursal && s.codigo_sucursal.startsWith('SUC-')) {
            const num = parseInt(s.codigo_sucursal.replace('SUC-', ''), 10)
            if (!isNaN(num) && num > maxNum) {
              maxNum = num
            }
          }
        })
      }

      const siguienteNum = maxNum + 1
      const siguienteCodigo = `SUC-${String(siguienteNum).padStart(3, '0')}`

      return NextResponse.json({ exito: true, siguiente_codigo: siguienteCodigo })
    }

    // 3. Listar sucursales por empresa
    if (!empresaId) {
      return NextResponse.json(
        { exito: false, mensaje: 'El parámetro empresa_id es requerido o no hay sesión activa.' },
        { status: 400 }
      )
    }

    const { data: sucursales, error } = await supabaseAdmin
      .from('sucursales')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('codigo_sucursal', { ascending: true })

    if (error) {
      return NextResponse.json(
        { exito: false, mensaje: `Error al consultar sucursales: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, datos: sucursales || [] })
  } catch (err) {
    console.error('Error inesperado en GET /api/sucursales:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}

// ==========================================
// POST: Crear una nueva sucursal
// ==========================================
export async function POST(req) {
  try {
    const cookieStore = await cookies()
    const body = await req.json()
    
    // Captura automática de empresa_id: desde el body o la cookie de sesión activa
    const empresa_id = body.empresa_id || body.empresaId || cookieStore.get('empresa_activa')?.value

    const {
      codigo_sucursal,
      direccion,
      telefono,
      email,
      departamento,
      ciudad,
      codigo_dane
    } = body

    // Normalizar el nombre admitiendo ambas claves
    const nombreFinal = body.nombre || body.nombre_sucursal

    if (!empresa_id || !nombreFinal) {
      return NextResponse.json(
        { exito: false, mensaje: 'Campos requeridos faltantes: empresa_id (o sesión activa) o nombre' },
        { status: 400 }
      )
    }

    const nuevaSucursal = {
      empresa_id: Number(empresa_id),
      codigo_sucursal: codigo_sucursal || 'SUC-001',
      nombre: nombreFinal,
      direccion: direccion || '',
      telefono: telefono || '',
      email: email || '',
      departamento: departamento || '',
      ciudad: ciudad || '',
      codigo_dane: codigo_dane || '',
      estado: 'Activa'
    }

    const { data, error } = await supabaseAdmin
      .from('sucursales')
      .insert([nuevaSucursal])
      .select()

    if (error) {
      console.error('Error al insertar sucursal:', error)
      return NextResponse.json(
        { exito: false, mensaje: `Error al guardar en base de datos: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, datos: data ? data[0] : null })
  } catch (err) {
    console.error('Error inesperado en POST /api/sucursales:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}

// ==========================================
// PUT: Actualizar una sucursal existente
// ==========================================
export async function PUT(req) {
  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El ID de la sucursal es obligatorio para actualizar.' },
        { status: 400 }
      )
    }

    // Armar explícitamente solo los campos existentes en la tabla
    const datosActualizar = {}

    const nombreFinal = body.nombre !== undefined ? body.nombre : body.nombre_sucursal
    if (nombreFinal !== undefined) datosActualizar.nombre = nombreFinal
    if (body.direccion !== undefined) datosActualizar.direccion = body.direccion
    if (body.telefono !== undefined) datosActualizar.telefono = body.telefono
    if (body.email !== undefined) datosActualizar.email = body.email
    if (body.departamento !== undefined) datosActualizar.departamento = body.departamento
    if (body.ciudad !== undefined) datosActualizar.ciudad = body.ciudad
    if (body.codigo_dane !== undefined) datosActualizar.codigo_dane = body.codigo_dane
    if (body.estado !== undefined) datosActualizar.estado = body.estado

    const { data, error } = await supabaseAdmin
      .from('sucursales')
      .update(datosActualizar)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error al actualizar sucursal:', error)
      return NextResponse.json(
        { exito: false, mensaje: `Error al actualizar en base de datos: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, datos: data ? data[0] : null })
  } catch (err) {
    console.error('Error inesperado en PUT /api/sucursales:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}

// ==========================================
// DELETE: Eliminar una sucursal
// ==========================================
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { exito: false, mensaje: 'El ID de la sucursal es obligatorio para eliminar.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('sucursales')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error al eliminar sucursal:', error)
      return NextResponse.json(
        { exito: false, mensaje: `Error al eliminar de la base de datos: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ exito: true, mensaje: 'Sucursal eliminada correctamente.' })
  } catch (err) {
    console.error('Error inesperado en DELETE /api/sucursales:', err)
    return NextResponse.json(
      { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}