import { Badge, Button, Card, Table } from 'react-bootstrap';
import type { Categoria, Cuenta, Recurrencia } from '../../models';
import { TipoTransaccion } from '../../models';
import {
  formatearFecha,
  formatearFrecuencia,
  formatearMoneda,
} from '../../utils/formato';

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
                  <th>Descripción</th>
                  <th>Frecuencia</th>
                  <th>Próxima</th>
                  <th>Categoría / Cuenta</th>
                  <th className="text-end">Monto</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recurrencias.map((recurrencia) => (
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
