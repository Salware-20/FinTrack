import { Fragment, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import type { Categoria, Transaccion } from '../../models';
import { TipoTransaccion, TIPOS_TRANSACCION } from '../../models';
import { finanzasService } from '../../services';
import { formatearMoneda, formatearPorcentaje, formatearTipo } from '../../utils/formato';
import { AlertaErrorCarga, Cargando } from '../componentes/Estado';
import { useNotificaciones } from '../componentes/notificacionesContexto';
import { useErroresFormulario } from '../componentes/useErroresFormulario';
import { mensajeDeError } from '../../utils/errores';

interface DatosCategorias {
  categorias: Categoria[];
  transacciones: Transaccion[];
}

async function consultarCategorias(): Promise<DatosCategorias> {
  const [categorias, transacciones] = await Promise.all([
    finanzasService.listarCategorias(),
    finanzasService.listarTransacciones(),
  ]);
  return { categorias, transacciones };
}

interface FormularioCategoria {
  nombre: string;
  tipo: TipoTransaccion;
  padreId: string;
  color: string;
  icono: string;
}

const FORMULARIO_INICIAL: FormularioCategoria = {
  nombre: '',
  tipo: TipoTransaccion.Gasto,
  padreId: '',
  color: '#0d6efd',
  icono: '',
};

const CAMPOS_CATEGORIA = ['nombre', 'padreId'] as const;

/**
 * Pantalla de categorías de la demo.
 *
 * Muestra el árbol ingreso/gasto con el uso real de cada categoría y permite
 * crear categorías raíz o subcategorías del mismo tipo.
 */
export function Categorias() {
  const notificaciones = useNotificaciones();
  const { errores, limpiar, limpiarTodo, manejar } = useErroresFormulario();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [version, setVersion] = useState(0);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [formulario, setFormulario] = useState({ ...FORMULARIO_INICIAL });

  useEffect(() => {
    let activo = true;

    consultarCategorias()
      .then((datos) => {
        if (!activo) return;
        setCategorias(datos.categorias);
        setTransacciones(datos.transacciones);
        setCargando(false);
        setErrorCarga(null);
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        setErrorCarga(mensajeDeError(fallo));
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [version]);

  const recargar = () => setVersion((actual) => actual + 1);

  const reintentarCarga = () => {
    setErrorCarga(null);
    setCargando(true);
    recargar();
  };

  const crear = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarTodo();
    setGuardando(true);

    try {
      await finanzasService.crearCategoria({
        nombre: formulario.nombre,
        tipo: formulario.tipo,
        padreId: formulario.padreId || null,
        color: formulario.color || undefined,
        icono: formulario.icono.trim() || undefined,
      });
      setFormulario((previo) => ({ ...previo, nombre: '', icono: '' }));
      setMostrarFormulario(false);
      limpiarTodo();
      notificaciones.exito('Categoría creada.');
      recargar();
    } catch (fallo) {
      manejar(fallo, CAMPOS_CATEGORIA);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarTipo = (tipo: TipoTransaccion) => {
    limpiar('padreId');
    setFormulario((previo) => ({ ...previo, tipo, padreId: '' }));
  };

  const raices = (tipo: TipoTransaccion) =>
    categorias.filter((categoria) => categoria.tipo === tipo && !categoria.padreId);

  const hijosDe = (padreId: string) =>
    categorias.filter((categoria) => categoria.padreId === padreId);

  const usoDe = (categoriaId: string) => {
    const movimientos = transacciones.filter(
      (transaccion) => transaccion.categoriaId === categoriaId,
    );
    return {
      cantidad: movimientos.length,
      total: movimientos.reduce((suma, movimiento) => suma + movimiento.monto, 0),
    };
  };

  const totalPorTipo = (tipo: TipoTransaccion) =>
    transacciones
      .filter((transaccion) => transaccion.tipo === tipo)
      .reduce((suma, transaccion) => suma + transaccion.monto, 0);

  const totales = {
    [TipoTransaccion.Ingreso]: totalPorTipo(TipoTransaccion.Ingreso),
    [TipoTransaccion.Gasto]: totalPorTipo(TipoTransaccion.Gasto),
  };

  if (cargando) return <Cargando texto="Cargando categorías…" />;

  const padresDisponibles = raices(formulario.tipo);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 mb-1">Categorías</h1>
          <p className="text-muted mb-0">
            Clasificación jerárquica de ingresos y gastos, pensada para Costa Rica.
          </p>
        </div>
        <Button onClick={() => {
          limpiarTodo();
          setMostrarFormulario((visible) => !visible);
        }}>
          {mostrarFormulario ? 'Cerrar formulario' : '+ Nueva categoría'}
        </Button>
      </div>

      <AlertaErrorCarga mensaje={errorCarga} onReintentar={reintentarCarga} />

      {mostrarFormulario && (
        <Card className="mb-4">
          <Card.Body>
            <Card.Title className="h5 mb-3">Nueva categoría</Card.Title>
            <Form onSubmit={crear} noValidate>
              <Row className="g-3">
                <Col xs={12} md={4}>
                  <Form.Group controlId="cat-nombre">
                    <Form.Label>Nombre</Form.Label>
                    <Form.Control
                      value={formulario.nombre}
                      required
                      placeholder="Ejemplo: Peajes"
                      isInvalid={Boolean(errores.nombre)}
                      onChange={(evento) => {
                        setFormulario((previo) => ({
                          ...previo,
                          nombre: evento.target.value,
                        }));
                        limpiar('nombre');
                      }}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errores.nombre}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={6} md={2}>
                  <Form.Group controlId="cat-tipo">
                    <Form.Label>Tipo</Form.Label>
                    <Form.Select
                      value={formulario.tipo}
                      onChange={(evento) =>
                        cambiarTipo(evento.target.value as TipoTransaccion)
                      }
                    >
                      {TIPOS_TRANSACCION.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {formatearTipo(tipo)}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={6} md={4}>
                  <Form.Group controlId="cat-padre">
                    <Form.Label>Categoría padre (opcional)</Form.Label>
                    <Form.Select
                      value={formulario.padreId}
                      isInvalid={Boolean(errores.padreId)}
                      onChange={(evento) => {
                        setFormulario((previo) => ({
                          ...previo,
                          padreId: evento.target.value,
                        }));
                        limpiar('padreId');
                      }}
                    >
                      <option value="">Sin padre (categoría raíz)</option>
                      {padresDisponibles.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.icono} {categoria.nombre}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">
                      {errores.padreId}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={6} md={1}>
                  <Form.Group controlId="cat-color">
                    <Form.Label>Color</Form.Label>
                    <Form.Control
                      type="color"
                      className="form-control-color w-100"
                      value={formulario.color}
                      onChange={(evento) =>
                        setFormulario((previo) => ({
                          ...previo,
                          color: evento.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                </Col>
                <Col xs={6} md={1}>
                  <Form.Group controlId="cat-icono">
                    <Form.Label>Ícono</Form.Label>
                    <Form.Control
                      value={formulario.icono}
                      placeholder="🏷️"
                      maxLength={4}
                      onChange={(evento) =>
                        setFormulario((previo) => ({
                          ...previo,
                          icono: evento.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex gap-2 mt-3">
                <Button type="submit" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Crear categoría'}
                </Button>
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={() => {
                    limpiarTodo();
                    setMostrarFormulario(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}

      {TIPOS_TRANSACCION.map((tipo) => (
        <Card key={tipo} className="mb-4">
          <Card.Body>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <Card.Title className="h5 mb-0">
                {tipo === TipoTransaccion.Ingreso ? 'Ingresos' : 'Gastos'}
              </Card.Title>
              <Badge bg={tipo === TipoTransaccion.Ingreso ? 'success' : 'danger'}>
                Total histórico: {formatearMoneda(totales[tipo])}
              </Badge>
            </div>

            {raices(tipo).length === 0 ? (
              <p className="text-muted mb-0">
                No hay categorías de {formatearTipo(tipo).toLowerCase()}.
              </p>
            ) : (
              <div className="table-responsive">
                <Table hover size="sm" className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th className="text-end">Movimientos</th>
                      <th className="text-end">Total</th>
                      <th className="text-end">% del tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raices(tipo).map((padre) => {
                      const usoPadre = usoDe(padre.id);
                      const hijos = hijosDe(padre.id);
                      return (
                        <Fragment key={padre.id}>
                          <tr>
                            <td>
                              <span
                                className="d-inline-block rounded-circle me-2"
                                style={{
                                  width: 10,
                                  height: 10,
                                  backgroundColor: padre.color,
                                }}
                              />
                              <span className="fw-semibold">
                                {padre.icono} {padre.nombre}
                              </span>
                            </td>
                            <td className="text-end">{usoPadre.cantidad}</td>
                            <td className="text-end text-nowrap">
                              {formatearMoneda(usoPadre.total)}
                            </td>
                            <td className="text-end text-muted text-nowrap">
                              {totales[tipo] === 0
                                ? '—'
                                : formatearPorcentaje(
                                    (usoPadre.total / totales[tipo]) * 100,
                                  )}
                            </td>
                          </tr>
                          {hijos.map((hijo) => {
                            const usoHijo = usoDe(hijo.id);
                            return (
                              <tr key={hijo.id}>
                                <td className="ps-4 text-muted">
                                  ↳ {hijo.icono} {hijo.nombre}
                                </td>
                                <td className="text-end">{usoHijo.cantidad}</td>
                                <td className="text-end text-nowrap">
                                  {formatearMoneda(usoHijo.total)}
                                </td>
                                <td className="text-end text-muted text-nowrap">
                                  {totales[tipo] === 0
                                    ? '—'
                                    : formatearPorcentaje(
                                        (usoHijo.total / totales[tipo]) * 100,
                                      )}
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      ))}

      <p className="text-muted small mb-0">
        Las subcategorías heredan el tipo de su padre. Los totales se calculan con todos
        los movimientos registrados, incluidos los pendientes.
      </p>
    </>
  );
}
