import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  section: { marginBottom: 15 },
  bold: { fontWeight: "bold" },
  table: { width: "100%", marginTop: 10, borderStyle: "solid", borderWidth: 1, borderColor: "#cbd5e1" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#cbd5e1", padding: 5 },
  tableHeader: { backgroundColor: "#f1f5f9", fontWeight: "bold" },
  colDesc: { width: "50%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "17.5%", textAlign: "right" },
  colTotal: { width: "17.5%", textAlign: "right" },
  totals: { marginTop: 15, alignItems: "flex-end" },
  qrContainer: { marginTop: 20, flexDirection: "row", alignItems: "center", gap: 15 },
  qrImage: { width: 80, height: 80 }
});

interface ItemPDF {
  nombre_item: string;
  cantidad: number;
  valor_unitario: number;
  total: number;
}

interface FacturaPDFProps {
  factura: {
    numero_factura: string;
    fecha_emision: string;
    cliente_nombre: string;
    cliente_nit: string;
    subtotal: number;
    iva: number;
    total_factura: number;
    cufe: string;
  };
  items: ItemPDF[];
  qrBase64: string;
}

export const FacturaPDFTemplate: React.FC<FacturaPDFProps> = ({ factura, items, qrBase64 }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      {/* Encabezado */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>FACTURA ELECTRÓNICA DE VENTA</Text>
          <Text style={styles.bold}>N°: {factura.numero_factura}</Text>
          <Text>Fecha Emisión: {factura.fecha_emision}</Text>
        </View>
      </View>

      {/* Datos del Cliente */}
      <View style={styles.section}>
        <Text style={styles.bold}>CLIENTE / ADQUIRENTE:</Text>
        <Text>Nombre / Razón Social: {factura.cliente_nombre}</Text>
        <Text>NIT / CC: {factura.cliente_nit}</Text>
      </View>

      {/* Tabla de Ítems */}
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={styles.colDesc}>Descripción</Text>
          <Text style={styles.colQty}>Cant.</Text>
          <Text style={styles.colPrice}>Val. Unit</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>
        {items.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={styles.colDesc}>{item.nombre_item}</Text>
            <Text style={styles.colQty}>{item.cantidad}</Text>
            <Text style={styles.colPrice}>${item.valor_unitario.toLocaleString("es-CO")}</Text>
            <Text style={styles.colTotal}>${item.total.toLocaleString("es-CO")}</Text>
          </View>
        ))}
      </View>

      {/* Totales */}
      <View style={styles.totals}>
        <Text>Subtotal: ${factura.subtotal.toLocaleString("es-CO")}</Text>
        <Text>IVA: ${factura.iva.toLocaleString("es-CO")}</Text>
        <Text style={styles.bold}>Total Factura: ${factura.total_factura.toLocaleString("es-CO")}</Text>
      </View>

      {/* Código QR y CUFE */}
      <View style={styles.qrContainer}>
        {qrBase64 && <Image src={qrBase64} style={styles.qrImage} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.bold}>CUFE (Pruebas):</Text>
          <Text style={{ fontSize: 8 }}>{factura.cufe}</Text>
        </View>
      </View>
    </Page>
  </Document>
);