export type Pagina =
  | 'resumen'
  | 'movimientos'
  | 'cuentas'
  | 'categorias'
  | 'reportes'
  | 'analisis'
  | 'cuenta'

/** `corta` se usa en el menú inferior del celular, donde no cabe el nombre completo. */
export const PAGINAS: { id: Pagina; etiqueta: string; corta?: string; icono: string }[] = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'bi-grid-1x2' },
  { id: 'movimientos', etiqueta: 'Movimientos', corta: 'Movim.', icono: 'bi-receipt' },
  { id: 'cuentas', etiqueta: 'Cuentas', icono: 'bi-bank' },
  { id: 'categorias', etiqueta: 'Categorías', icono: 'bi-tags' },
  { id: 'reportes', etiqueta: 'Reportes', icono: 'bi-file-earmark-bar-graph' },
  { id: 'analisis', etiqueta: 'Análisis', icono: 'bi-lightbulb' },
  { id: 'cuenta', etiqueta: 'Mi cuenta', corta: 'Perfil', icono: 'bi-person-circle' },
]
