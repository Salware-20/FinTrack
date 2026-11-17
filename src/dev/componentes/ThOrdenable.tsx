import type { ReactNode, ThHTMLAttributes } from 'react';
import type { EstadoOrden } from './ordenTabla';
import './tablaOrdenable.css';

interface Props extends ThHTMLAttributes<HTMLTableCellElement> {
  clave: string;
  orden: EstadoOrden;
  onAlternar: (clave: string) => void;
  children: ReactNode;
}

/**
 * Encabezado de tabla que alterna el orden al hacer clic.
 *
 * Los tres estados siguen el comportamiento del explorador de archivos:
 * mayor a menor, menor a mayor y, al tercer clic, el orden original.
 */
export function ThOrdenable({
  clave,
  orden,
  onAlternar,
  children,
  className,
  ...resto
}: Props) {
  const activa = orden.clave === clave;
  const direccion = activa ? orden.direccion : null;
  const ariaSort =
    direccion === 'desc'
      ? 'descending'
      : direccion === 'asc'
        ? 'ascending'
        : 'none';
  const indicador =
    direccion === 'desc' ? '▼' : direccion === 'asc' ? '▲' : '↕';
  const proximaAccion =
    direccion === 'desc'
      ? 'menor a mayor'
      : direccion === 'asc'
        ? 'el orden original'
        : 'mayor a menor';

  return (
    <th {...resto} className={className} scope="col" aria-sort={ariaSort}>
      <button
        type="button"
        className={`btn btn-link p-0 text-decoration-none text-reset th-ordenable${
          activa ? ' th-ordenable-activa' : ''
        }`}
        title={`Ordenar de ${proximaAccion}`}
        onClick={() => onAlternar(clave)}
      >
        {children}
        <span className="th-ordenable-indicador ms-1" aria-hidden="true">
          {indicador}
        </span>
        <span className="visually-hidden">. Ordenar de {proximaAccion}</span>
      </button>
    </th>
  );
}
