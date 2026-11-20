'use server'

import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ==========================================
// 1. Obtener listado de empresas
// ==========================================
export async function listarEmpresasAction() {
  try {
    const { data: empresas, error } = await supabaseAdmin
      .from('empresas')
      .select('id, razon_social, nombre_comercial')
      .order('razon_social', { ascending: true })

    if (error) {
      return { exito: false, mensaje: `Error al cargar empresas: ${error.message}` }
    }

    return { exito: true, datos: empresas || [] }
  } catch (err) {
    console.error('Error inesperado en listarEmpresasAction:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}

// ==========================================
// 2. Obtener siguiente código consecutivo (ej: SUC-001)
// ==========================================
export async function siguienteCodigoSucursalAction(empresaIdParam?: string | number) {
  try {
    const cookieStore = await cookies()
    const empresaId = empresaIdParam || cookieStore.get('empresa_activa')?.value

    if (!empresaId) {
      return { exito: false, mensaje: 'empresa_id es requerido o no hay sesión activa para el consecutivo.' }
    }

    const { data: sucursales, error } = await supabaseAdmin
      .from('sucursales')
      .select('codigo_sucursal')
      .eq('empresa_id', empresaId)

    if (error) {
      return { exito: false, mensaje: `Error al obtener consecutivo: ${error.message}` }
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

    return { exito: true, siguiente_codigo: siguienteCodigo }
  } catch (err) {
    console.error('Error inesperado en siguienteCodigoSucursalAction:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}

// ==========================================
// 3. Obtener sucursales por empresa
// ==========================================
export async function obtenerSucursalesAction(empresaIdParam?: string | number) {
  try {
    const cookieStore = await cookies()
    const empresaId = empresaIdParam || cookieStore.get('empresa_activa')?.value

    if (!empresaId) {
      return { exito: false, mensaje: 'El parámetro empresa_id es requerido o no hay sesión activa.' }
    }

    const { data: sucursales, error } = await supabaseAdmin
      .from('sucursales')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('codigo_sucursal', { ascending: true })

    if (error) {
      return { exito: false, mensaje: `Error al consultar sucursales: ${error.message}` }
    }

    return { exito: true, datos: sucursales || [] }
  } catch (err) {
    console.error('Error inesperado en obtenerSucursalesAction:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}

// ==========================================
// 4. Crear una nueva sucursal
// ==========================================
export async function crearSucursalAction(formData: {
  empresa_id?: string | number;
  empresaId?: string | number;
  codigo_sucursal?: string;
  nombre?: string;
  nombre_sucursal?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  departamento?: string;
  ciudad?: string;
  codigo_dane?: string;
}) {
  try {
    const cookieStore = await cookies()
    const empresa_id = formData.empresa_id || formData.empresaId || cookieStore.get('empresa_activa')?.value

    const nombreFinal = formData.nombre || formData.nombre_sucursal

    if (!empresa_id || !nombreFinal) {
      return { exito: false, mensaje: 'Campos requeridos faltantes: empresa_id (o sesión activa) o nombre' }
    }

    const nuevaSucursal = {
      empresa_id: Number(empresa_id),
      codigo_sucursal: formData.codigo_sucursal || 'SUC-001',
      nombre: nombreFinal,
      direccion: formData.direccion || '',
      telefono: formData.telefono || '',
      email: formData.email || '',
      departamento: formData.departamento || '',
      ciudad: formData.ciudad || '',
      codigo_dane: formData.codigo_dane || '',
      estado: 'Activa'
    }

    const { data, error } = await supabaseAdmin
      .from('sucursales')
      .insert([nuevaSucursal])
      .select()

    if (error) {
      console.error('Error al insertar sucursal:', error)
      return { exito: false, mensaje: `Error al guardar en base de datos: ${error.message}` }
    }

    return { exito: true, datos: data ? data[0] : null }
  } catch (err) {
    console.error('Error inesperado en crearSucursalAction:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}

// ==========================================
// 5. Actualizar una sucursal existente
// ==========================================
export async function actualizarSucursalAction(formData: {
  id: string | number;
  nombre?: string;
  nombre_sucursal?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  departamento?: string;
  ciudad?: string;
  codigo_dane?: string;
  estado?: string;
}) {
  try {
    const { id } = formData

    if (!id) {
      return { exito: false, mensaje: 'El ID de la sucursal es obligatorio para actualizar.' }
    }

    const datosActualizar: Record<string, any> = {}

    const nombreFinal = formData.nombre !== undefined ? formData.nombre : formData.nombre_sucursal
    if (nombreFinal !== undefined) datosActualizar.nombre = nombreFinal
    if (formData.direccion !== undefined) datosActualizar.direccion = formData.direccion
    if (formData.telefono !== undefined) datosActualizar.telefono = formData.telefono
    if (formData.email !== undefined) datosActualizar.email = formData.email
    if (formData.departamento !== undefined) datosActualizar.departamento = formData.departamento
    if (formData.ciudad !== undefined) datosActualizar.ciudad = formData.ciudad
    if (formData.codigo_dane !== undefined) datosActualizar.codigo_dane = formData.codigo_dane
    if (formData.estado !== undefined) datosActualizar.estado = formData.estado

    const { data, error } = await supabaseAdmin
      .from('sucursales')
      .update(datosActualizar)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error al actualizar sucursal:', error)
      return { exito: false, mensaje: `Error al actualizar en base de datos: ${error.message}` }
    }

    return { exito: true, datos: data ? data[0] : null }
  } catch (err) {
    console.error('Error inesperado en actualizarSucursalAction:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}

// ==========================================
// 6. Eliminar una sucursal
// ==========================================
export async function eliminarSucursalAction(id: string | number) {
  try {
    if (!id) {
      return { exito: false, mensaje: 'El ID de la sucursal es obligatorio para eliminar.' }
    }

    const { error } = await supabaseAdmin
      .from('sucursales')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error al eliminar sucursal:', error)
      return { exito: false, mensaje: `Error al eliminar de la base de datos: ${error.message}` }
    }

    return { exito: true, mensaje: 'Sucursal eliminada correctamente.' }
  } catch (err) {
    console.error('Error inesperado en eliminarSucursalAction:', err)
    return { exito: false, mensaje: err instanceof Error ? err.message : 'Error interno del servidor.' }
  }
}