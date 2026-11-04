import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request) {
  try {
    const body = await request.json()
    const { 
      empresaId, 
      sucursalId, 
      claseDocId, 
      terceroId, 
      glosa, 
      lineas,
      usuarioId // ID del usuario app que solicita la transacción
    } = body

    // 1. (Opcional) Validar permisos del usuario en la base de datos antes de grabar
    // ...

    // 2. Obtener consecutivo automático usando el Superusuario
    const { data: numeroDocumento, error: errConsecutivo } = await supabaseAdmin
      .rpc('obtener_siguiente_consecutivo', {
        p_empresa_id: empresaId,
        p_clase_doc_id: claseDocId
      })

    if (errConsecutivo) throw new Error('Error al generar consecutivo: ' + errConsecutivo.message)

    // 3. Insertar la Transacción (Encabezado) como Administrador
    const { data: tx, error: errTx } = await supabaseAdmin
      .from('transacciones')
      .insert([{
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        clase_documento_id: claseDocId,
        tercero_id: terceroId,
        numero_documento: numeroDocumento,
        glosa_concepto: glosa,
        estado: 'Registrado',
        creado_por_usuario: usuarioId || null
      }])
      .select()
      .single()

    if (errTx) throw new Error('Error al guardar encabezado: ' + errTx.message)

    // 4. Preparar e Insertar los Detalles como Administrador
    const detalles = lineas.map(l => ({
      transaccion_id: tx.id,
      concepto_auxiliar_id: l.concepto_auxiliar_id,
      tercero_id: l.tercero_id || terceroId,
      debito: parseFloat(l.debito) || 0,
      credito: parseFloat(l.credito) || 0
    }))

    const { error: errDetalle } = await supabaseAdmin
      .from('detalle_transacciones')
      .insert(detalles)

    if (errDetalle) throw new Error('Error al guardar detalle: ' + errDetalle.message)

    return NextResponse.json({
      exito: true,
      numeroDocumento: numeroDocumento,
      transaccionId: tx.id
    })

  } catch (error) {
    return NextResponse.json(
      { exito: false, mensaje: error.message },
      { status: 500 }
    )
  }
}