import type { Categoria } from '../models'

/** Extrae un mensaje legible de cualquier error. */
export function mensajeDeError(fallo: unknown): string {
  return fallo instanceof Error && fallo.message
    ? fallo.message
    : 'Ocurrió un error inesperado.'
}

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
