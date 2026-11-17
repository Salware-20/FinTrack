import { Badge, Button, Card, Table } from 'react-bootstrap';
import type { Categoria, Cuenta, Recurrencia } from '../../models';
import { TipoTransaccion } from '../../models';
import {
  formatearFecha,
  formatearFrecuencia,
  formatearMoneda,
} from '../../utils/formato';
import { ThOrdenable } from './ThOrdenable';
import { useOrdenTabla } from './useOrdenTabla';
import {
  compararFecha,
  compararNumero,
  compararTexto,
} from './ordenTabla';

interface Props {
  recurrencias: Recurrencia[];
  categorias: Categoria[];
  cuentas: Cuenta[];
  ocupado: boolean;
  onCambiarEstado: (id: string, activa: boolean) => void;
  onEliminar: (id: string) => void;
}

/**
 * Tarjeta con las reglas recurrentes del usuario.
 *
 * Solo administra la regla: los movimientos ya generados son historial y se
 * conservan aunque la regla se pause o se elimine.
 */
export function TablaRecurrencias({
  recurrencias,
  categorias,
  cuentas,
  ocupado,
  onCambiarEstado,
  onEliminar,
}: Props) {
  const nombreCategoria = (id: string) =>
    categorias.find((categoria) => categoria.id === id)?.nombre ?? 'Sin categoría';
  const nombreCuenta = (id: string) =>
    cuentas.find((cuenta) => cuenta.id === id)?.nombre ?? 'Sin cuenta';

  const {
    filas: recurrenciasOrdenadas,
    orden,
    alternar,
  } = useOrdenTabla(recurrencias, {
    descripcion: compararTexto<Recurrencia>((recurrencia) => recurrencia.descripcion),
    frecuencia: compararTexto<Recurrencia>((recurrencia) =>
      formatearFrecuencia(recurrencia.frecuencia),
    ),
    proxima: compararFecha<Recurrencia>((recurrencia) =>
      recurrencia.finalizada ? null : recurrencia.proximaFecha,
    ),
    categoria: compararTexto<Recurrencia>((recurrencia) =>
      nombreCategoria(recurrencia.categoriaId),
    ),
    monto: compararNumero<Recurrencia>((recurrencia) =>
      Math.abs(recurrencia.monto),
    ),
    estado: compararNumero<Recurrencia>((recurrencia) =>
      recurrencia.finalizada ? 2 : recurrencia.activa ? 0 : 1,
    ),
  });

  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <div>
            <Card.Title className="h6 mb-1">Movimientos recurrentes</Card.Title>
            <p className="text-muted small mb-0">
              Se registran solos el día que corresponde; nunca se adelantan al
              saldo.
            </p>
          </div>
          <Badge bg="light" text="dark">
            {recurrencias.length} {recurrencias.length === 1 ? 'regla' : 'reglas'}
          </Badge>
        </div>

        {recurrencias.length === 0 ? (
          <p className="text-muted small mb-0">
            Aún no hay movimientos recurrentes. Active “Repetir este movimiento”
            al registrar un gasto o ingreso.
          </p>
        ) : (
          <div className="table-responsive">
            <Table hover size="sm" className="align-middle mb-0">
              <thead>
                <tr>
                  <ThOrdenable clave="descripcion" orden={orden} onAlternar={alternar}>
                    Descripción
                  </ThOrdenable>
                  <ThOrdenable clave="frecuencia" orden={orden} onAlternar={alternar}>
                    Frecuencia
                  </ThOrdenable>
                  <ThOrdenable clave="proxima" orden={orden} onAlternar={alternar}>
                    Próxima
                  </ThOrdenable>
                  <ThOrdenable clave="categoria" orden={orden} onAlternar={alternar}>
                    Categoría / Cuenta
                  </ThOrdenable>
                  <ThOrdenable
                    clave="monto"
                    orden={orden}
                    onAlternar={alternar}
                    className="text-end"
                  >
                    Monto
                  </ThOrdenable>
                  <ThOrdenable clave="estado" orden={orden} onAlternar={alternar}>
                    Estado
                  </ThOrdenable>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recurrenciasOrdenadas.map((recurrencia) => (
                  <tr key={recurrencia.id}>
                    <td>
                      {recurrencia.descripcion}
                      <div className="small text-muted">
                        desde {formatearFecha(recurrencia.fechaInicio)}
                        {recurrencia.fechaFin
                          ? ` · hasta ${formatearFecha(recurrencia.fechaFin)}`
                          : ''}
                      </div>
                    </td>
                    <td className="text-nowrap">
                      {formatearFrecuencia(recurrencia.frecuencia)}
                    </td>
                    <td className="text-nowrap">
                      {recurrencia.finalizada
                        ? '—'
                        : formatearFecha(recurrencia.proximaFecha)}
                    </td>
                    <td className="text-nowrap">
                      {nombreCategoria(recurrencia.categoriaId)}
                      <div className="small text-muted">
                        {nombreCuenta(recurrencia.cuentaId)}
                      </div>
                    </td>
                    <td
                      className={`text-end fw-semibold text-nowrap ${
                        recurrencia.tipo === TipoTransaccion.Ingreso
                          ? 'text-success'
                          : 'text-danger'
                      }`}
                    >
                      {recurrencia.tipo === TipoTransaccion.Ingreso ? '+' : '−'}
                      {formatearMoneda(recurrencia.monto)}
                    </td>
                    <td className="text-nowrap">
                      <Badge
                        bg={
                          recurrencia.finalizada
                            ? 'secondary'
                            : recurrencia.activa
                              ? 'success'
                              : 'warning'
                        }
                        text={
                          recurrencia.finalizada || recurrencia.activa
                            ? 'white'
                            : 'dark'
                        }
                      >
                        {recurrencia.finalizada
                          ? 'Finalizada'
                          : recurrencia.activa
                            ? 'Activa'
                            : 'Pausada'}
                      </Badge>
                    </td>
                    <td className="text-end text-nowrap">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-1"
                        disabled={ocupado || recurrencia.finalizada}
                        onClick={() =>
                          onCambiarEstado(recurrencia.id, !recurrencia.activa)
                        }
                      >
                        {recurrencia.activa ? 'Pausar' : 'Reanudar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={ocupado}
                        onClick={() => onEliminar(recurrencia.id)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
