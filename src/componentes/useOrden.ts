import { useState } from 'react'
import { SIN_ORDEN, ordenar, siguienteOrden } from './orden'
import type { Comparador, EstadoOrden } from './orden'

/** Estado de orden de una tabla. Vive en memoria: al cambiar de pantalla se reinicia. */
export function useOrden<T>(filas: readonly T[], comparadores: Record<string, Comparador<T>>) {
  const [orden, setOrden] = useState<EstadoOrden>(SIN_ORDEN)
  return {
    filas: ordenar(filas, orden, comparadores),
    orden,
    alternar: (clave: string) => setOrden((actual) => siguienteOrden(actual, clave)),
    fijar: setOrden,
  }
}
