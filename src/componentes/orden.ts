/**
 * Orden de tablas al pulsar el título de una columna.
 *
 * Sigue el mismo ciclo que el explorador de archivos (y que la demo):
 * mayor a menor → menor a mayor → orden original.
 * Los valores vacíos quedan siempre al final y los empates conservan
 * el orden en que llegaron del servicio.
 */

export type Direccion = 'asc' | 'desc'

export interface EstadoOrden {
  clave: string | null
  direccion: Direccion
}

export type Comparador<T> = (a: T, b: T, direccion: Direccion) => number

export const SIN_ORDEN: EstadoOrden = { clave: null, direccion: 'desc' }

const colador = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

const vacio = (valor: unknown) => valor === null || valor === undefined || valor === ''
const aplicar = (resultado: number, direccion: Direccion) =>
  direccion === 'asc' ? resultado : -resultado

export function siguienteOrden(actual: EstadoOrden, clave: string): EstadoOrden {
  if (actual.clave !== clave) return { clave, direccion: 'desc' }
  if (actual.direccion === 'desc') return { clave, direccion: 'asc' }
  return { ...SIN_ORDEN }
}

function conVacios<V>(comparar: (a: V, b: V) => number) {
  return (va: V | null | undefined, vb: V | null | undefined, direccion: Direccion) => {
    if (vacio(va) && vacio(vb)) return 0
    if (vacio(va)) return 1
    if (vacio(vb)) return -1
    return aplicar(comparar(va as V, vb as V), direccion)
  }
}

const textoBase = conVacios<string>((a, b) => colador.compare(a, b))
const numeroBase = conVacios<number>((a, b) => a - b)
const fechaBase = conVacios<string>((a, b) => (a < b ? -1 : a > b ? 1 : 0))

export const porTexto =
  <T,>(obtener: (fila: T) => string | null | undefined): Comparador<T> =>
  (a, b, d) => textoBase(obtener(a), obtener(b), d)

export const porNumero =
  <T,>(obtener: (fila: T) => number | null | undefined): Comparador<T> =>
  (a, b, d) => numeroBase(obtener(a), obtener(b), d)

/** Fechas AAAA-MM-DD: el orden alfabético coincide con el cronológico. */
export const porFecha =
  <T,>(obtener: (fila: T) => string | null | undefined): Comparador<T> =>
  (a, b, d) => fechaBase(obtener(a), obtener(b), d)

export function ordenar<T>(
  filas: readonly T[],
  orden: EstadoOrden,
  comparadores: Record<string, Comparador<T>>,
): T[] {
  const comparar = orden.clave ? comparadores[orden.clave] : undefined
  if (!comparar) return [...filas]
  return filas
    .map((fila, indice) => ({ fila, indice }))
    .sort((a, b) => comparar(a.fila, b.fila, orden.direccion) || a.indice - b.indice)
    .map(({ fila }) => fila)
}
