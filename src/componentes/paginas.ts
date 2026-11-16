export type Pagina =
  | 'resumen'
  | 'movimientos'
  | 'cuentas'
  | 'categorias'
  | 'reportes'
  | 'cuenta'

export const PAGINAS: { id: Pagina; etiqueta: string; icono: string }[] = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'bi-grid-1x2' },
  { id: 'movimientos', etiqueta: 'Movimientos', icono: 'bi-receipt' },
  { id: 'cuentas', etiqueta: 'Cuentas', icono: 'bi-bank' },
  { id: 'categorias', etiqueta: 'Categorías', icono: 'bi-tags' },
  { id: 'reportes', etiqueta: 'Reportes', icono: 'bi-file-earmark-bar-graph' },
  { id: 'cuenta', etiqueta: 'Mi cuenta', icono: 'bi-person-circle' },
]
