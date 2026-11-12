import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ==========================================
// INTERFACES DE TIPADO
// ==========================================
interface LineaTransaccion {
  concepto_auxiliar_id: number | string;
  tercero_id?: number | string | null;
  debito: number | string;
  credito: number | string;
}

interface TransaccionBody {
  empresaId: number | string;
  sucursalId: number | string;
  claseDocId: number | string;
  terceroId?: number | string | null;
  glosa: string;
  lineas: LineaTransaccion[];
  usuarioId?: number | string | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: TransaccionBody = await request.json()
    const { 
      empresaId, 
      sucursalId, 
      claseDocId, 
      terceroId, 
      glosa, 
      lineas,
      usuarioId // ID del usuario app que solicita la transacción
    } = body

    // 1. Validaciones básicas de integridad
    if (!empresaId || !sucursalId || !claseDocId || !lineas || lineas.length === 0) {
      return NextResponse.json(
        { exito: false, mensaje: "Faltan campos obligatorios para registrar la transacción (empresa, sucursal, clase de documento o líneas)." },
        { status: 400 }
      )
    }

    // 2. Obtener consecutivo automático usando el Superusuario
    const { data: numeroDocumento, error: errConsecutivo } = await supabaseAdmin
      .rpc('obtener_siguiente_consecutivo', {
        p_empresa_id: Number(empresaId),
        p_clase_doc_id: Number(claseDocId)
      })

    if (errConsecutivo) {
      throw new Error('Error al generar consecutivo: ' + errConsecutivo.message)
    }

    // 3. Insertar la Transacción (Encabezado) como Administrador
    const { data: tx, error: errTx } = await supabaseAdmin
      .from('transacciones')
      .insert([{
        empresa_id: Number(empresaId),
        sucursal_id: Number(sucursalId),
        clase_documento_id: Number(claseDocId),
        tercero_id: terceroId ? Number(terceroId) : null,
        numero_documento: numeroDocumento,
        glosa_concepto: glosa,
        estado: 'Registrado',
        creado_por_usuario: usuarioId ? Number(usuarioId) : null
      }])
      .select()
      .single()

    if (errTx || !tx) {
      throw new Error('Error al guardar encabezado: ' + (errTx?.message || 'No se retornó la transacción creada.'))
    }

    // 4. Preparar e Insertar los Detalles como Administrador
    const detalles = lineas.map((l) => ({
      transaccion_id: tx.id,
      concepto_auxiliar_id: Number(l.concepto_auxiliar_id),
      tercero_id: l.tercero_id ? Number(l.tercero_id) : (terceroId ? Number(terceroId) : null),
      debito: parseFloat(String(l.debito)) || 0,
      credito: parseFloat(String(l.credito)) || 0
    }))

    const { error: errDetalle } = await supabaseAdmin
      .from('detalle_transacciones')
      .insert(detalles)

    if (errDetalle) {
      // Opcional: si falla el detalle, se podría eliminar el encabezado creado para mantener atomicidad
      throw new Error('Error al guardar detalle: ' + errDetalle.message)
    }

    return NextResponse.json({
      exito: true,
      numeroDocumento: numeroDocumento,
      transaccionId: tx.id
    })

  } catch (error: any) {
    console.error("Error en API de transacciones:", error)
    return NextResponse.json(
      { exito: false, mensaje: error.message || 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}