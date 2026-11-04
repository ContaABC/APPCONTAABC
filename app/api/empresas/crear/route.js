import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request) {
  let empresaIdCreada = null

  try {
    // 1. Lectura segura del Body para evitar crashes en `request.json()`
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { exito: false, mensaje: 'El cuerpo de la petición debe ser un JSON válido.' },
        { status: 400 }
      )
    }

    const { 
      nit, 
      dv,
      razonSocial, 
      nombreComercial,
      codigoCiiu,
      codigoCiiu1,
      codigoCiiu2,
      email, 
      direccion, 
      telefono, 
      repLegalNombre,
      repLegalCedula,
      pais,
      departamento,
      ciudad,
      codigoDane,
      monedaPrincipal,
      fechaInicioOperaciones,
      sucursalesAdicionales
    } = body || {}

    if (!nit || !razonSocial) {
      return NextResponse.json(
        { exito: false, mensaje: 'El NIT y la Razón Social son requeridos.' },
        { status: 400 }
      )
    }

    // 2. Normalización de datos
    const razonSocialUpper = razonSocial.trim().toUpperCase()
    const nombreComercialUpper = (nombreComercial || razonSocialUpper).trim().toUpperCase()

    // 3. Insertar la nueva Empresa con los campos CIIU
    const { data: empresa, error: errEmpresa } = await supabaseAdmin
      .from('empresas')
      .insert([{
        nit_identificacion: nit,
        dv: dv || null,
        razon_social: razonSocialUpper,
        nombre_comercial: nombreComercialUpper,
        codigo_ciiu: codigoCiiu ? codigoCiiu.trim() : null,
        codigo_ciiu1: codigoCiiu1 ? codigoCiiu1.trim() : null,
        codigo_ciiu2: codigoCiiu2 ? codigoCiiu2.trim() : null,
        rep_legal_nombre: repLegalNombre || null,
        rep_legal_cedula: repLegalCedula || null,
        pais: pais || 'Colombia',
        departamento: departamento || null,
        ciudad: ciudad || null,
        codigo_dane: codigoDane || null,
        moneda_principal: monedaPrincipal || 'COP',
        email: email || null,
        telefono: telefono || null,
        direccion: direccion || null,
        fecha_inicio_operaciones: fechaInicioOperaciones || null
      }])
      .select()
      .maybeSingle()

    if (errEmpresa || !empresa) {
      console.error('Error insertando empresa:', errEmpresa)
      return NextResponse.json(
        { exito: false, mensaje: `Error al crear empresa: ${errEmpresa?.message || 'No se obtuvieron datos.'}` },
        { status: 500 }
      )
    }

    // ID guardado para ejecutar Rollback si falla un paso posterior
    empresaIdCreada = empresa.id

    // 4. Crear Tercero Automático
    const datosTercero = {
      empresa_id: empresa.id,
      tipo_documento: 'NIT',
      numero_identificacion: nit,
      dv: dv || null,
      razon_social: razonSocialUpper,
      nombre_comercial: nombreComercialUpper,
      email: email || null,
      telefono: telefono || null,
      direccion: direccion || null,
      pais: pais || 'Colombia',
      departamento_estado: departamento || null,
      ciudad: ciudad || null,
      codigo_dane: codigoDane || null,
      regimen_fiscal: '48',
      responsabilidad_tributaria: 'R-99-PN',
      es_cliente: false,
      es_proveedor: false,
      es_empresa_propia: true,
      estado: 'ACTIVO'
    }

    const { data: tercero, error: errTercero } = await supabaseAdmin
      .from('terceros')
      .insert([datosTercero])
      .select()

    if (errTercero) {
      throw new Error(`Error creando el tercero automático: ${errTercero.message}`)
    }

    // 5. Crear Sucursales (Principal + Adicionales)
    const listaSucursales = [
      {
        empresa_id: empresa.id,
        codigo_sucursal: 'SUC-001',
        nombre: razonSocialUpper,
        direccion: direccion || null,
        telefono: telefono || null,
        email: email || null,
        departamento: departamento || null,
        ciudad: ciudad || null,
        codigo_dane: codigoDane || null
      }
    ]

    if (Array.isArray(sucursalesAdicionales) && sucursalesAdicionales.length > 0) {
      sucursalesAdicionales.forEach((suc) => {
        listaSucursales.push({
          empresa_id: empresa.id,
          codigo_sucursal: suc.codigo,
          nombre: (suc.nombre || '').toUpperCase(),
          direccion: suc.direccion || direccion || null,
          telefono: suc.telefono || telefono || null,
          email: suc.email || email || null,
          departamento: suc.departamento || departamento || null,
          ciudad: suc.ciudad || ciudad || null,
          codigo_dane: suc.codigoDane || codigoDane || null
        })
      })
    }

    const { error: errSucursal } = await supabaseAdmin
      .from('sucursales')
      .insert(listaSucursales)

    if (errSucursal) {
      throw new Error(`Error al crear sucursales: ${errSucursal.message}`)
    }

    // 6. Copiar las Clases de Documento e Inicializar Consecutivos
    const { data: clasesSistema, error: errClases } = await supabaseAdmin
      .from('clases_documento')
      .select('*')

    if (errClases) {
      throw new Error(`Error consultando clases_documento: ${errClases.message}`)
    }

    if (clasesSistema && clasesSistema.length > 0) {
      const consecutivosIniciales = clasesSistema.map((clase) => ({
        empresa_id: empresa.id,
        clase_documento_id: clase.id,
        prefijo: clase.codigo_clase,
        ultimo_numero: 0,
        longitud_numero: 5
      }))

      const { error: errConsecutivos } = await supabaseAdmin
        .from('consecutivos')
        .insert(consecutivosIniciales)

      if (errConsecutivos) {
        throw new Error(`Error al crear consecutivos: ${errConsecutivos.message}`)
      }
    }

    // 7. Inicializar Cierre de Periodo
    if (fechaInicioOperaciones) {
      const fechaInicio = new Date(fechaInicioOperaciones)
      const anioInicio = fechaInicio.getUTCFullYear()
      const mesInicio = fechaInicio.getUTCMonth() + 1

      const { error: errPeriodo } = await supabaseAdmin
        .from('cierres_periodos')
        .insert([{
          empresa_id: empresa.id,
          anio: anioInicio,
          mes: mesInicio,
          cerrado: false
        }])

      if (errPeriodo) {
        throw new Error(`Error al crear periodo inicial: ${errPeriodo.message}`)
      }
    }

    return NextResponse.json({
      exito: true,
      empresa: empresa,
      terceroRegistrado: tercero,
      totalSucursales: listaSucursales.length,
      mensaje: 'Empresa, Tercero y Sucursales creados e inicializados con éxito.'
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido en el servidor.'
    console.error('Error durante el proceso de creación:', errorMsg)

    // Rollback para evitar registros huérfanos
    if (empresaIdCreada) {
      console.log(`Ejecutando ROLLBACK para empresa ID: ${empresaIdCreada}...`)
      try {
        await supabaseAdmin.from('empresas').delete().eq('id', empresaIdCreada)
      } catch (errRollback) {
        console.error('Error ejecutando el Rollback:', errRollback)
      }
    }

    return NextResponse.json(
      { exito: false, mensaje: `Proceso cancelado. Se revirtieron los cambios: ${errorMsg}` },
      { status: 500 }
    )
  }
}