import { useState } from 'react';
import { ORDEN_INICIAL, ordenarFilas, siguienteOrden } from './ordenTabla';
import type { Comparador, EstadoOrden } from './ordenTabla';

/**
 * Ordena una lista a partir de los clics en los encabezados de una tabla.
 *
 * El ciclo por columna es: mayor a menor → menor a mayor → orden original.
 * El orden vive en memoria: al cambiar de pantalla se reinicia.
 */
export function useOrdenTabla<T>(
  filas: readonly T[],
  comparadores: Record<string, Comparador<T>>,
) {
  const [orden, setOrden] = useState<EstadoOrden>(ORDEN_INICIAL);

  const alternar = (clave: string) =>
    setOrden((actual) => siguienteOrden(actual, clave));

  return {
    filas: ordenarFilas(filas, orden, comparadores),
    orden,
    alternar,
  };
}
