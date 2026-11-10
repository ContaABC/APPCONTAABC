// lib/permissions.ts

export const PERMISOS_MODULOS: Record<string, string[]> = {
  // Configuración y Usuarios: Solo Administradores
  "/modulos/contabilidad/configuracion": ["Administrador"],
  "/usuarios": ["Administrador"],
  "/usuarios/asignaciones": ["Administrador"],

  // Proveedores (CXP): Administrador, Contador y Operador autorizado
  "/modulos/contabilidad/proveedores": ["Administrador", "Contador", "Operador"],

  // Clientes (CXC) y Facturación: Administrador, Contador y Operador
  "/modulos/clientes": ["Administrador", "Contador", "Operador"],

  // Tesorería: Administrador y Contador
  "/modulos/tesoreria": ["Administrador", "Contador"],

  // Consultas y Reportes: Administrador, Contador y Auditor (lectura)
  "/modulos/contabilidad/consultas": ["Administrador", "Contador", "Auditor"],

  // Contables (Balances, Cierres): Administrador y Contador
  "/modulos/contabilidad/contables": ["Administrador", "Contador"],
};

// Función para verificar si un rol tiene acceso a una ruta
export function tieneAcceso(tipoUsuario: string, ruta: string): boolean {
  // El Administrador tiene acceso total por defecto
  if (tipoUsuario === "Administrador") return true;

  const rolesPermitidos = PERMISOS_MODULOS[ruta];
  if (!rolesPermitidos) return true; // Si la ruta no está restringida, se permite

  return rolesPermitidos.includes(tipoUsuario);
}