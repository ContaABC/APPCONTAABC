import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseDianXml } from '@/lib/dian-xml-parser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const empresaId = formData.get('empresa_id') as string; // BIGINT
    const esRecibida = formData.get('es_recibida') === 'true'; // true = Compra/Recibida, false = Venta/Emitida

    if (!file || !empresaId) {
      return NextResponse.json({ error: 'El archivo XML y el empresa_id son obligatorios.' }, { status: 400 });
    }

    const xmlContent = await file.text();
    
    // Parsear el contenido XML de la DIAN
    const parsedData = parseDianXml(xmlContent);

    if (esRecibida) {
      // 1. Insertar en facturas_recibidas
      const { data, error } = await supabase
        .from('facturas_recibidas')
        .insert({
          empresa_id: parseInt(empresaId, 10),
          prefijo: parsedData.prefijo,
          numero_factura: parsedData.numero_factura,
          cufe_cude: parsedData.cufe_cude,
          tipo_documento: parsedData.tipo_documento,
          fecha_emision: parsedData.fecha_emision,
          fecha_vencimiento: parsedData.fecha_vencimiento,
          tercero_nit: parsedData.emisor_nit,
          tercero_nombre: parsedData.emisor_nombre,
          moneda: parsedData.moneda,
          subtotal: parsedData.subtotal,
          descuentos: parsedData.descuentos,
          impuestos: parsedData.impuestos,
          retenciones: parsedData.retenciones,
          total_factura: parsedData.total_factura,
          saldo_pendiente: parsedData.total_factura,
          estado_pago: 'Pendiente',
          estado_dian: 'Aceptado',
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, tipo: 'recibida', data });

    } else {
      // 2. Insertar en facturas_emitidas
      const { data, error } = await supabase
        .from('facturas_emitidas')
        .insert({
          empresa_id: parseInt(empresaId, 10),
          prefijo: parsedData.prefijo,
          numero_factura: parsedData.numero_factura,
          cufe: parsedData.cufe_cude,
          tipo_documento: parsedData.tipo_documento,
          fecha_emision: parsedData.fecha_emision,
          fecha_vencimiento: parsedData.fecha_vencimiento || parsedData.fecha_emision,
          cliente_nit: parsedData.adquirente_nit,
          cliente_nombre: parsedData.adquirente_nombre,
          moneda: parsedData.moneda,
          subtotal: parsedData.subtotal,
          descuentos: parsedData.descuentos,
          iva: parsedData.impuestos,
          retenciones: parsedData.retenciones,
          total_factura: parsedData.total_factura,
          saldo_pendiente: parsedData.total_factura,
          estado_cobro: 'Pendiente',
          estado_dian: 'Aprobado',
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, tipo: 'emitida', data });
    }

  } catch (error: any) {
    console.error('Error al procesar el XML:', error);
    return NextResponse.json(
      { error: 'Error al procesar el archivo XML', details: error.message },
      { status: 500 }
    );
  }
}