import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import type { Categoria, ResumenFinanciero, Transaccion } from '../models';
import { MetodoPago, TipoTransaccion } from '../models';
import { finanzasService } from '../services';
import {
  aFechaISO,
  formatearFecha,
  formatearMes,
  formatearMetodoPago,
  formatearMoneda,
  formatearPorcentaje,
} from '../utils/formato';

function mensajeDeError(fallo: unknown): string {
  return fallo instanceof Error ? fallo.message : 'Ocurrió un error inesperado.';
}

interface DatosDemo {
  transacciones: Transaccion[];
  categorias: Categoria[];
  resumen: ResumenFinanciero;
}

/** Lee los tres conjuntos de datos en paralelo (una sola espera percibida). */
async function obtenerDatos(): Promise<DatosDemo> {
  const [transacciones, categorias, resumen] = await Promise.all([
    finanzasService.listarTransacciones(),
    finanzasService.listarCategorias(),
    finanzasService.obtenerResumen(),
  ]);

  return { transacciones, categorias, resumen };
}

/**
 * Página de demostración del servicio mock.
 *
 * No forma parte de la aplicación final: sirve para verificar que los datos
 * fluyen y para que el frontend tenga una referencia de consumo del servicio.
 * Solo usa componentes de React Bootstrap, sin CSS propio.
 */
export function DemoDatos() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // La carga inicial se resuelve con promesas dentro del efecto: los setState
  // viven en los callbacks, nunca de forma síncrona en el cuerpo del efecto.
  const aplicarDatos = useCallback((datos: DatosDemo) => {
    setTransacciones(datos.transacciones);
    setCategorias(datos.categorias);
    setResumen(datos.resumen);
  }, []);

  useEffect(() => {
    let activo = true;

    obtenerDatos()
      .then((datos) => {
        if (!activo) return;
        aplicarDatos(datos);
        setCargando(false);
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        setError(mensajeDeError(fallo));
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [aplicarDatos]);

  const cargar = useCallback(async () => {
    try {
      aplicarDatos(await obtenerDatos());
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setCargando(false);
    }
  }, [aplicarDatos]);

  const recargar = () => {
    setError(null);
    setCargando(true);
    void cargar();
  };

  const ejecutarAccion = useCallback(
    async (accion: () => Promise<void>) => {
      setError(null);
      setCargando(true);
      try {
        await accion();
        await cargar();
      } catch (fallo) {
        setError(mensajeDeError(fallo));
        setCargando(false);
      }
    },
    [cargar],
  );

  const crearGastoEjemplo = () => {
    const categoria = categorias.find(
      (item) => item.tipo === TipoTransaccion.Gasto,
    );
    if (!categoria) {
      setError('Primero debe existir una categoría de gasto.');
      return;
    }

    return ejecutarAccion(async () => {
      await finanzasService.crearTransaccion({
        monto: 12500,
        tipo: TipoTransaccion.Gasto,
        fecha: aFechaISO(new Date()),
        descripcion: 'Gasto de ejemplo desde la demo',
        categoriaId: categoria.id,
        metodoPago: MetodoPago.Efectivo,
      });
    });
  };

  const restablecer = () =>
    ejecutarAccion(async () => {
      await finanzasService.resetearDatos();
    });

  const eliminar = (id: string) =>
    ejecutarAccion(async () => {
      await finanzasService.eliminarTransaccion(id);
    });

  const nombreCategoria = (categoriaId: string) =>
    categorias.find((item) => item.id === categoriaId)?.nombre ?? 'Sin categoría';

  return (
    <Container className="py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 mb-1">Demo de datos mock</h1>
          <p className="text-muted mb-0">
            Página de apoyo para el frontend. No forma parte de la aplicación
            final y no usa Supabase.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            disabled={cargando}
            onClick={() => recargar()}
          >
            Recargar
          </Button>
          <Button
            variant="outline-danger"
            disabled={cargando}
            onClick={() => void restablecer()}
          >
            Restablecer datos
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert variant="info">
        Cualquier cambio se guarda en <code>localStorage</code> bajo la clave{" "}
        <code>fintrack:mock:v1</code>. Usa “Restablecer datos” para volver a los
        datos de demostración.
      </Alert>

      {cargando && !resumen ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
          <p className="mt-3 text-muted">Cargando datos de demostración…</p>
        </div>
      ) : (
        <>
          {resumen && (
            <>
              <Row className="g-3 mb-4">
                <Col xs={12} md={3}>
                  <Card bg="success" text="white" className="h-100">
                    <Card.Body>
                      <Card.Title className="h6">Ingresos</Card.Title>
                      <p className="h4 mb-0">
                        {formatearMoneda(resumen.totalIngresos)}
                      </p>
                      <small>{resumen.cantidadIngresos} movimientos</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12} md={3}>
                  <Card bg="danger" text="white" className="h-100">
                    <Card.Body>
                      <Card.Title className="h6">Gastos</Card.Title>
                      <p className="h4 mb-0">
                        {formatearMoneda(resumen.totalGastos)}
                      </p>
                      <small>{resumen.cantidadGastos} movimientos</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12} md={3}>
                  <Card
                    bg={resumen.balance >= 0 ? 'primary' : 'danger'}
                    text="white"
                    className="h-100"
                  >
                    <Card.Body>
                      <Card.Title className="h6">Balance</Card.Title>
                      <p className="h4 mb-0">{formatearMoneda(resumen.balance)}</p>
                      <small>
                        {resumen.rango.desde && resumen.rango.hasta
                          ? `${formatearFecha(resumen.rango.desde)} a ${formatearFecha(resumen.rango.hasta)}`
                          : 'Sin datos'}
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12} md={3}>
                  <Card bg="secondary" text="white" className="h-100">
                    <Card.Body>
                      <Card.Title className="h6">Promedios</Card.Title>
                      <p className="mb-1">
                        Ingreso: {formatearMoneda(resumen.promedioIngreso)}
                      </p>
                      <p className="mb-0">
                        Gasto: {formatearMoneda(resumen.promedioGasto)}
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Row className="g-3 mb-4">
                <Col xs={12} lg={7}>
                  <Card className="h-100">
                    <Card.Body>
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                        <Card.Title className="h5 mb-0">
                          Últimos movimientos
                        </Card.Title>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          disabled={cargando}
                          onClick={() => void crearGastoEjemplo()}
                        >
                          Crear gasto de ejemplo
                        </Button>
                      </div>
                      <div className="table-responsive">
                        <Table hover size="sm" className="align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Descripción</th>
                              <th>Categoría</th>
                              <th>Método</th>
                              <th className="text-end">Monto</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {transacciones.slice(0, 10).map((transaccion) => (
                              <tr key={transaccion.id}>
                                <td>{formatearFecha(transaccion.fecha)}</td>
                                <td>{transaccion.descripcion}</td>
                                <td>{nombreCategoria(transaccion.categoriaId)}</td>
                                <td>{formatearMetodoPago(transaccion.metodoPago)}</td>
                                <td
                                  className={`text-end fw-semibold ${
                                    transaccion.esIngreso
                                      ? 'text-success'
                                      : 'text-danger'
                                  }`}
                                >
                                  {transaccion.esIngreso ? '+' : '−'}
                                  {formatearMoneda(transaccion.monto)}
                                </td>
                                <td className="text-end">
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    disabled={cargando}
                                    onClick={() => void eliminar(transaccion.id)}
                                  >
                                    Eliminar
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                      <p className="text-muted small mt-3 mb-0">
                        Mostrando {Math.min(transacciones.length, 10)} de{" "}
                        {transacciones.length} transacciones.
                      </p>
                    </Card.Body>
                  </Card>
                </Col>

                <Col xs={12} lg={5}>
                  <Card className="h-100">
                    <Card.Body>
                      <Card.Title className="h5 mb-3">
                        Resumen por categoría
                      </Card.Title>
                      <div className="table-responsive">
                        <Table size="sm" className="align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Categoría</th>
                              <th className="text-end">Total</th>
                              <th className="text-end">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resumen.porCategoria.map((categoria) => (
                              <tr key={categoria.categoriaId}>
                                <td>
                                  <span
                                    className="d-inline-block rounded-circle me-2"
                                    style={{
                                      width: 10,
                                      height: 10,
                                      backgroundColor: categoria.color,
                                    }}
                                  />
                                  {categoria.icono} {categoria.nombre}
                                  <Badge
                                    bg={
                                      categoria.tipo === TipoTransaccion.Ingreso
                                        ? 'success'
                                        : 'danger'
                                    }
                                    className="ms-2"
                                  >
                                    {categoria.cantidad}
                                  </Badge>
                                </td>
                                <td className="text-end">
                                  {formatearMoneda(categoria.total)}
                                </td>
                                <td className="text-end text-muted">
                                  {formatearPorcentaje(categoria.porcentaje)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Card>
                <Card.Body>
                  <Card.Title className="h5 mb-3">Evolución mensual</Card.Title>
                  <div className="table-responsive">
                    <Table size="sm" className="align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th className="text-end">Ingresos</th>
                          <th className="text-end">Gastos</th>
                          <th className="text-end">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.porMes.map((mes) => (
                          <tr key={mes.mes}>
                            <td>{formatearMes(mes.mes)}</td>
                            <td className="text-end text-success">
                              {formatearMoneda(mes.ingresos)}
                            </td>
                            <td className="text-end text-danger">
                              {formatearMoneda(mes.gastos)}
                            </td>
                            <td
                              className={`text-end fw-semibold ${
                                mes.balance >= 0 ? 'text-success' : 'text-danger'
                              }`}
                            >
                              {formatearMoneda(mes.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </>
          )}

          {!resumen && (
            <Alert variant="warning">
              No se pudo cargar el resumen financiero.
            </Alert>
          )}
        </>
      )}
    </Container>
  );
}
