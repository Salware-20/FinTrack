/**
 * Ordenamiento de tablas de la demo.
 *
 * Cada columna define un comparador que ya aplica la dirección del orden.
 * Los valores vacíos (null, undefined o cadena vacía) siempre quedan al
 * final, sin importar la dirección.
 */

export type DireccionOrden = 'asc' | 'desc';

export interface EstadoOrden {
  clave: string | null;
  direccion: DireccionOrden;
}

export type Comparador<T> = (a: T, b: T, direccion: DireccionOrden) => number;

/** Estado inicial: sin columna activa (orden original de los datos). */
export const ORDEN_INICIAL: EstadoOrden = { clave: null, direccion: 'desc' };

const COLADOR = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

function esVacio(valor: string | number | null | undefined): boolean {
  return valor === null || valor === undefined || valor === '';
}

function conDireccion(resultado: number, direccion: DireccionOrden): number {
  return direccion === 'asc' ? resultado : -resultado;
}

/**
 * Ciclo de un encabezado: mayor a menor → menor a mayor → orden original.
 *
 * Al cambiar de columna se reinicia en "mayor a menor".
 */
export function siguienteOrden(actual: EstadoOrden, clave: string): EstadoOrden {
  if (actual.clave !== clave) return { clave, direccion: 'desc' };
  if (actual.direccion === 'desc') return { clave, direccion: 'asc' };
  return { ...ORDEN_INICIAL };
}

/** Compara texto con reglas del español, incluyendo acentos y números. */
export function compararTexto<T>(
  obtener: (item: T) => string | null | undefined,
): Comparador<T> {
  return (a, b, direccion) => {
    const va = obtener(a) ?? '';
    const vb = obtener(b) ?? '';

    if (esVacio(va) && esVacio(vb)) return 0;
    if (esVacio(va)) return 1;
    if (esVacio(vb)) return -1;

    return conDireccion(COLADOR.compare(va, vb), direccion);
  };
}

/** Compara números; los vacíos quedan al final en ambas direcciones. */
export function compararNumero<T>(
  obtener: (item: T) => number | null | undefined,
): Comparador<T> {
  return (a, b, direccion) => {
    const va = obtener(a);
    const vb = obtener(b);

    if (esVacio(va) && esVacio(vb)) return 0;
    if (esVacio(va)) return 1;
    if (esVacio(vb)) return -1;

    return conDireccion(Number(va) - Number(vb), direccion);
  };
}

/** Compara fechas en formato AAAA-MM-DD (orden lexicográfico = cronológico). */
export function compararFecha<T>(
  obtener: (item: T) => string | null | undefined,
): Comparador<T> {
  return (a, b, direccion) => {
    const va = obtener(a) ?? '';
    const vb = obtener(b) ?? '';

    if (esVacio(va) && esVacio(vb)) return 0;
    if (esVacio(va)) return 1;
    if (esVacio(vb)) return -1;

    const resultado = va < vb ? -1 : va > vb ? 1 : 0;
    return conDireccion(resultado, direccion);
  };
}

/** Compara booleanos (false antes que true). */
export function compararBooleano<T>(
  obtener: (item: T) => boolean,
): Comparador<T> {
  return (a, b, direccion) =>
    conDireccion(Number(obtener(a)) - Number(obtener(b)), direccion);
}

/**
 * Devuelve una copia ordenada de `filas`. Sin columna activa conserva el
 * orden original; los empates se resuelven por la posición de llegada.
 */
export function ordenarFilas<T>(
  filas: readonly T[],
  orden: EstadoOrden,
  comparadores: Record<string, Comparador<T>>,
): T[] {
  const comparador = orden.clave ? comparadores[orden.clave] : undefined;
  if (!comparador) return [...filas];

  return filas
    .map((fila, indice) => ({ fila, indice }))
    .sort(
      (a, b) =>
        comparador(a.fila, b.fila, orden.direccion) || a.indice - b.indice,
    )
    .map(({ fila }) => fila);
}
