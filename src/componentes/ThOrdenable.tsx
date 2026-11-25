import type { ReactNode } from 'react'
import type { EstadoOrden } from './orden'

interface Props {
  clave: string
  orden: EstadoOrden
  onOrdenar: (clave: string) => void
  derecha?: boolean
  className?: string
  children: ReactNode
}

/** Título de columna que ordena la tabla al pulsarlo. */
export function ThOrdenable({ clave, orden, onOrdenar, derecha, className, children }: Props) {
  const activa = orden.clave === clave
  const direccion = activa ? orden.direccion : null
  const icono =
    direccion === 'desc' ? 'bi-caret-down-fill' : direccion === 'asc' ? 'bi-caret-up-fill' : 'bi-chevron-expand'
  const siguiente =
    direccion === 'desc' ? 'en orden ascendente' : direccion === 'asc' ? 'en el orden predeterminado' : 'en orden descendente'

  return (
    <th
      scope="col"
      className={[derecha ? 'derecha' : '', className ?? ''].join(' ').trim() || undefined}
      aria-sort={direccion === 'desc' ? 'descending' : direccion === 'asc' ? 'ascending' : 'none'}
    >
      <button
        type="button"
        className={`ft-orden${activa ? ' activa' : ''}`}
        title={`Ordenar ${siguiente}`}
        onClick={() => onOrdenar(clave)}
      >
        {children}
        <i className={`bi ${icono}`} aria-hidden="true" />
        <span className="visually-hidden">, ordenar {siguiente}</span>
      </button>
    </th>
  )
}
