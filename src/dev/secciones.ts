/** Secciones navegables de la demo (no de la aplicación final). */
export type Seccion =
  | 'dashboard'
  | 'movimientos'
  | 'cuentas'
  | 'categorias'
  | 'reportes'
  | 'cuenta';

export const SECCIONES: { id: Seccion; etiqueta: string; icono: string }[] = [
  { id: 'dashboard', etiqueta: 'Dashboard', icono: '📊' },
  { id: 'movimientos', etiqueta: 'Movimientos', icono: '🧾' },
  { id: 'cuentas', etiqueta: 'Cuentas', icono: '🏦' },
  { id: 'categorias', etiqueta: 'Categorías', icono: '🏷️' },
  { id: 'reportes', etiqueta: 'Reportes', icono: '📄' },
  { id: 'cuenta', etiqueta: 'Mi cuenta', icono: '👤' },
];
