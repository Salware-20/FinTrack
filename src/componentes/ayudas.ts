import type { Categoria } from '../models'

/** Extrae un mensaje legible de cualquier error. */
export function mensajeDeError(fallo: unknown): string {
  return fallo instanceof Error && fallo.message
    ? fallo.message
    : 'Ocurrió un error inesperado.'
}

/** Icono de respaldo por si una cuenta no trae emoji. */
export const ICONO_CUENTA: Record<string, string> = {
  efectivo: 'bi-cash-coin',
  banco: 'bi-bank',
  ahorro: 'bi-piggy-bank',
  tarjeta: 'bi-credit-card',
}

/** "Alimentación › Cafetería" para subcategorías, el nombre solo para las principales. */
export function etiquetaCategoria(categoria: Categoria, todas: Categoria[]): string {
  const padre = categoria.padreId
    ? todas.find((otra) => otra.id === categoria.padreId)
    : undefined
  return padre ? `${padre.nombre} › ${categoria.nombre}` : categoria.nombre
}

/** Igual que etiquetaCategoria pero con el emoji delante, para listas desplegables. */
export function etiquetaConIcono(categoria: Categoria, todas: Categoria[]): string {
  const texto = etiquetaCategoria(categoria, todas)
  return categoria.icono ? `${categoria.icono} ${texto}` : texto
}

/** Mes actual como AAAA-MM. */
export function periodoActual(fecha: Date = new Date()): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

/** Primer y último día de un periodo AAAA-MM. */
export function rangoDePeriodo(periodo: string): { desde: string; hasta: string } {
  const [anio, mes] = periodo.split('-').map(Number)
  const ultimo = new Date(anio, mes, 0).getDate()
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(ultimo).padStart(2, '0')}` }
}

/** Suma o resta meses a un periodo AAAA-MM. */
export function moverPeriodo(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split('-').map(Number)
  return periodoActual(new Date(anio, mes - 1 + meses, 1))
}
