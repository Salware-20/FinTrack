import { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import type { EstadoResultados, FilaEstadoResultados, Usuario } from '../../models';
import type { ResumenFinanciero } from '../../models/tipos';
import { finanzasService } from '../../services';
import {
  aFechaISO,
  finDeMes,
  formatearFecha,
  formatearMoneda,
  formatearPorcentaje,
  inicioDeMes,
} from '../../utils/formato';
import {
  descargarTexto,
  nombreConFecha,
} from '../../utils/descargas';
import {
  generarPdfEstadoResultados,
  generarPdfGastosPorCategoria,
} from '../../utils/reportesPdf';
import { AlertaErrorCarga, Cargando } from '../componentes/Estado';
import { useNotificaciones } from '../componentes/notificacionesContexto';
import { ThOrdenable } from '../componentes/ThOrdenable';
import {
  ORDEN_INICIAL,
  compararNumero,
  compararTexto,
  ordenarFilas,
  siguienteOrden,
} from '../componentes/ordenTabla';
import type { EstadoOrden } from '../componentes/ordenTabla';
import { useErroresFormulario } from '../componentes/useErroresFormulario';
import { mensajeDeError } from '../../utils/errores';
import { GraficoCategorias, GraficoFlujo } from '../componentes/Graficos';

interface Props {
  usuario: Usuario;
}

interface DatosReporte {
  resumen: ResumenFinanciero;
  estado: EstadoResultados;
}

async function consultarReporte(desde: string, hasta: string): Promise<DatosReporte> {
  const [resumen, estado] = await Promise.all([
    finanzasService.obtenerResumen({ desde, hasta }),
    finanzasService.obtenerEstadoResultados(desde, hasta),
  ]);
  return { resumen, estado };
}

/** Rango del mes actual desplazado `meses` hacia atrás. */
function rangoMes(meses: number): { desde: string; hasta: string } {
  const hoy = new Date();
  const referencia = new Date(hoy.getFullYear(), hoy.getMonth() - meses, 1);
  return { desde: inicioDeMes(referencia), hasta: finDeMes(referencia) };
}

export function Reportes({ usuario }: Props) {
  const notificaciones = useNotificaciones();
  const { errores, limpiar, limpiarTodo, marcar } = useErroresFormulario();

  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(finDeMes());
  const [datos, setDatos] = useState<DatosReporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [ordenReporte, setOrdenReporte] =
    useState<EstadoOrden>(ORDEN_INICIAL);

  useEffect(() => {
    if (desde > hasta) return;

    let activo = true;

    consultarReporte(desde, hasta)
      .then((resultado) => {
        if (!activo) return;
        setDatos(resultado);
        setErrorCarga(null);
        setCargando(false);
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        setErrorCarga(mensajeDeError(fallo));
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [desde, hasta, version]);

  const reintentarCarga = () => {
    setErrorCarga(null);
    setCargando(true);
    setVersion((actual) => actual + 1);
  };

  const aplicarRango = (rango: { desde: string; hasta: string }) => {
    limpiarTodo();

    if (rango.desde > rango.hasta) {
      marcar('desde', 'La fecha inicial no puede ser posterior a la final.');
      setCargando(false);
      return;
    }

    setCargando(true);
    setDesde(rango.desde);
    setHasta(rango.hasta);
  };

  const cambiarDesde = (valor: string) => {
    limpiar('desde');
    limpiar('hasta');
    setDesde(valor);

    if (valor > hasta) {
      marcar('desde', 'La fecha inicial no puede ser posterior a la final.');
      setCargando(false);
      return;
    }

    setCargando(true);
  };

  const cambiarHasta = (valor: string) => {
    limpiar('hasta');
    limpiar('desde');
    setHasta(valor);

    if (desde > valor) {
      marcar('hasta', 'La fecha final no puede ser anterior a la inicial.');
      setCargando(false);
      return;
    }

    setCargando(true);
  };

  const aplicarAnio = () => {
    const anio = new Date().getFullYear();
    aplicarRango({ desde: `${anio}-01-01`, hasta: `${anio}-12-31` });
  };

  const descargarEstadoResultados = () => {
    if (!datos) return;
    try {
      const documento = generarPdfEstadoResultados(datos.estado, usuario.nombre);
      documento.save(nombreConFecha('estado-resultados', 'pdf'));
      notificaciones.exito('PDF del estado de resultados generado.');
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    }
  };

  const descargarGastos = () => {
    if (!datos) return;
    try {
      const documento = generarPdfGastosPorCategoria(
        datos.resumen.porCategoria,
        desde,
        hasta,
        usuario.nombre,
      );
      documento.save(nombreConFecha('gastos-por-categoria', 'pdf'));
      notificaciones.exito('PDF de gastos por categoría generado.');
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    }
  };

  const descargarCsv = async () => {
    try {
      const csv = await finanzasService.exportarTransaccionesCsv({ desde, hasta });
      descargarTexto(
        nombreConFecha('movimientos', 'csv'),
        `\uFEFF${csv}`,
        'text/csv;charset=utf-8',
      );
      notificaciones.exito('CSV exportado. Se abre directamente en Excel.');
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    }
  };

  const ingresos = datos?.estado.filas.filter((fila) => fila.tipo === 'ingreso') ?? [];
  const gastos = datos?.estado.filas.filter((fila) => fila.tipo === 'gasto') ?? [];
  const margen =
    datos && datos.estado.totalIngresos > 0
      ? (datos.estado.utilidad / datos.estado.totalIngresos) * 100
      : 0;

  const comparadoresReporte = {
    concepto: compararTexto<FilaEstadoResultados>((fila) => fila.nombre),
    monto: compararNumero<FilaEstadoResultados>((fila) => fila.total),
    porcentaje: compararNumero<FilaEstadoResultados>((fila) => fila.total),
  };
  const ingresosOrdenados = ordenarFilas(
    ingresos,
    ordenReporte,
    comparadoresReporte,
  );
  const gastosOrdenados = ordenarFilas(gastos, ordenReporte, comparadoresReporte);
  const alternarReporte = (clave: string) =>
    setOrdenReporte((actual) => siguienteOrden(actual, clave));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 mb-1">Reportes</h1>
          <p className="text-muted mb-0">
            Estado de resultados, gastos por categoría y exportaciones del periodo.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-danger"
            disabled={!datos}
            onClick={descargarEstadoResultados}
          >
            PDF estado de resultados
          </Button>
          <Button
            variant="outline-secondary"
            disabled={!datos || gastos.length === 0}
            onClick={descargarGastos}
          >
            PDF gastos
          </Button>
          <Button variant="outline-success" onClick={() => void descargarCsv()}>
            CSV movimientos
          </Button>
        </div>
      </div>

      <AlertaErrorCarga mensaje={errorCarga} onReintentar={reintentarCarga} />

      <Card className="mb-4">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col xs={12} md={3}>
              <Form.Group controlId="rep-desde">
                <Form.Label className="small text-muted mb-1">Desde</Form.Label>
                <Form.Control
                  type="date"
                  value={desde}
                  max={hasta}
                  isInvalid={Boolean(errores.desde)}
                  onChange={(evento) => cambiarDesde(evento.target.value)}
                />
                <Form.Control.Feedback type="invalid">
                  {errores.desde}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col xs={12} md={3}>
              <Form.Group controlId="rep-hasta">
                <Form.Label className="small text-muted mb-1">Hasta</Form.Label>
                <Form.Control
                  type="date"
                  value={hasta}
                  min={desde}
                  isInvalid={Boolean(errores.hasta)}
                  onChange={(evento) => cambiarHasta(evento.target.value)}
                />
                <Form.Control.Feedback type="invalid">
                  {errores.hasta}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <div className="d-flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => aplicarRango(rangoMes(0))}
                >
                  Este mes
                </Button>
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => aplicarRango(rangoMes(1))}
                >
                  Mes anterior
                </Button>
                <Button size="sm" variant="outline-primary" onClick={aplicarAnio}>
                  Este año
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() =>
                    aplicarRango({ desde: '2000-01-01', hasta: aFechaISO(new Date()) })
                  }
                >
                  Todo
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setVersion((actual) => actual + 1)}
                >
                  Actualizar
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {errorCarga ? null : cargando || !datos ? (
        <Cargando texto="Calculando el reporte…" />
      ) : (
        <>
          <Row className="g-3 mb-4">
            <Col xs={12} sm={6} xl={3}>
              <Card bg="success" text="white" className="h-100">
                <Card.Body>
                  <div className="text-uppercase small opacity-75">Ingresos</div>
                  <div className="fs-5 fw-semibold">
                    {formatearMoneda(datos.estado.totalIngresos)}
                  </div>
                  <div className="small opacity-75">
                    {datos.resumen.cantidadIngresos} movimientos
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} sm={6} xl={3}>
              <Card bg="danger" text="white" className="h-100">
                <Card.Body>
                  <div className="text-uppercase small opacity-75">Gastos</div>
                  <div className="fs-5 fw-semibold">
                    {formatearMoneda(datos.estado.totalGastos)}
                  </div>
                  <div className="small opacity-75">
                    {datos.resumen.cantidadGastos} movimientos
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} sm={6} xl={3}>
              <Card
                bg={datos.estado.utilidad >= 0 ? 'primary' : 'danger'}
                text="white"
                className="h-100"
              >
                <Card.Body>
                  <div className="text-uppercase small opacity-75">
                    {datos.estado.utilidad >= 0 ? 'Utilidad' : 'Pérdida'}
                  </div>
                  <div className="fs-5 fw-semibold">
                    {formatearMoneda(datos.estado.utilidad)}
                  </div>
                  <div className="small opacity-75">
                    {datos.estado.totalIngresos > 0
                      ? `Margen ${formatearPorcentaje(margen)}`
                      : 'Sin ingresos en el periodo'}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} sm={6} xl={3}>
              <Card bg="secondary" text="white" className="h-100">
                <Card.Body>
                  <div className="text-uppercase small opacity-75">Promedios</div>
                  <div className="small">
                    Ingreso: {formatearMoneda(datos.resumen.promedioIngreso)}
                  </div>
                  <div className="small">
                    Gasto: {formatearMoneda(datos.resumen.promedioGasto)}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="g-3 mb-4">
            <Col xs={12} xl={7}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title className="h5 mb-3">
                    Ingresos y gastos por mes
                  </Card.Title>
                  <GraficoFlujo datos={datos.resumen.porMes} />
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} xl={5}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title className="h5 mb-3">Gastos por categoría</Card.Title>
                  <GraficoCategorias datos={datos.resumen.porCategoria} />
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="mb-3">
            <Card.Body>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <Card.Title className="h5 mb-0">Estado de resultados</Card.Title>
                <Badge bg="light" text="dark">
                  {formatearFecha(desde)} — {formatearFecha(hasta)}
                </Badge>
              </div>

              {ingresos.length === 0 && gastos.length === 0 ? (
                <p className="text-muted mb-0">
                  No hay movimientos confirmados en este periodo.
                </p>
              ) : (
                <div className="table-responsive">
                  <Table hover size="sm" className="align-middle mb-0">
                    <thead>
                      <tr>
                        <ThOrdenable
                          clave="concepto"
                          orden={ordenReporte}
                          onAlternar={alternarReporte}
                        >
                          Concepto
                        </ThOrdenable>
                        <ThOrdenable
                          clave="monto"
                          orden={ordenReporte}
                          onAlternar={alternarReporte}
                          className="text-end"
                        >
                          Monto
                        </ThOrdenable>
                        <ThOrdenable
                          clave="porcentaje"
                          orden={ordenReporte}
                          onAlternar={alternarReporte}
                          className="text-end"
                        >
                          % del grupo
                        </ThOrdenable>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="table-light">
                        <td colSpan={3} className="fw-semibold">
                          Ingresos
                        </td>
                      </tr>
                      {ingresosOrdenados.map((fila) => (
                        <tr key={fila.categoriaId}>
                          <td className="ps-4">{fila.nombre}</td>
                          <td className="text-end text-nowrap">
                            {formatearMoneda(fila.total)}
                          </td>
                          <td className="text-end text-muted text-nowrap">
                            {datos.estado.totalIngresos === 0
                              ? '—'
                              : formatearPorcentaje(
                                  (fila.total / datos.estado.totalIngresos) * 100,
                                )}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="fw-semibold">Total de ingresos</td>
                        <td className="text-end fw-semibold text-success text-nowrap">
                          {formatearMoneda(datos.estado.totalIngresos)}
                        </td>
                        <td className="text-end text-muted">100 %</td>
                      </tr>

                      <tr className="table-light">
                        <td colSpan={3} className="fw-semibold">
                          Gastos
                        </td>
                      </tr>
                      {gastosOrdenados.map((fila) => (
                        <tr key={fila.categoriaId}>
                          <td className="ps-4">{fila.nombre}</td>
                          <td className="text-end text-nowrap">
                            {formatearMoneda(fila.total)}
                          </td>
                          <td className="text-end text-muted text-nowrap">
                            {datos.estado.totalGastos === 0
                              ? '—'
                              : formatearPorcentaje(
                                  (fila.total / datos.estado.totalGastos) * 100,
                                )}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="fw-semibold">Total de gastos</td>
                        <td className="text-end fw-semibold text-danger text-nowrap">
                          {formatearMoneda(datos.estado.totalGastos)}
                        </td>
                        <td className="text-end text-muted">100 %</td>
                      </tr>

                      <tr className="table-primary">
                        <td className="fw-semibold">
                          {datos.estado.utilidad >= 0 ? 'Utilidad' : 'Pérdida'} del periodo
                        </td>
                        <td
                          className={`text-end fw-semibold text-nowrap ${
                            datos.estado.utilidad >= 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {formatearMoneda(datos.estado.utilidad)}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>

          <p className="text-muted small mb-0">
            Los reportes solo incluyen movimientos confirmados. Las transferencias entre
            cuentas no se consideran ingreso ni gasto.
          </p>
        </>
      )}
    </>
  );
}
