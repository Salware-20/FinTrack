import { Form } from 'react-bootstrap'
import { SIN_ORDEN } from './orden'
import type { EstadoOrden } from './orden'

interface Props {
  id: string
  orden: EstadoOrden
  columnas: { clave: string; texto: string }[]
  onCambiar: (orden: EstadoOrden) => void
}

/**
 * En el celular las tablas se muestran como lista y no tienen títulos de
 * columna que pulsar, así que el orden se elige aquí.
 */
export function SelectorOrden({ id, orden, columnas, onCambiar }: Props) {
  const valor = orden.clave ? `${orden.clave}:${orden.direccion}` : ''
  return (
    <div className="ft-orden-movil">
      <Form.Label htmlFor={id} className="mb-0">
        <i className="bi bi-sort-down me-1" aria-hidden="true" />
        Ordenar
      </Form.Label>
      <Form.Select
        id={id}
        size="sm"
        value={valor}
        onChange={(e) => {
          const [clave, direccion] = e.target.value.split(':')
          onCambiar(clave ? { clave, direccion: direccion === 'asc' ? 'asc' : 'desc' } : { ...SIN_ORDEN })
        }}
      >
        <option value="">Orden predeterminado</option>
        {columnas.flatMap((c) => [
          <option key={`${c.clave}-d`} value={`${c.clave}:desc`}>{c.texto} (descendente)</option>,
          <option key={`${c.clave}-a`} value={`${c.clave}:asc`}>{c.texto} (ascendente)</option>,
        ])}
      </Form.Select>
    </div>
  )
}
