import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import type { Categoria } from '../../models';
import type {
  AnalisisGastosHormiga,
  FugaGastoHormiga,
  ParametrosSimulacion,
  ResultadoSimulacion,
} from '../../models/tipos';
import { finanzasService } from '../../services';
import { mensajeDeError } from '../../utils/errores';
import {
  fechaHoy,
  formatearFrecuencia,
  formatearMes,
  formatearMoneda,
  formatearPorcentaje,
} from '../../utils/formato';
import { AlertaErrorCarga, Cargando, TarjetaKpi } from '../componentes/Estado';
import { ThOrdenable } from '../componentes/ThOrdenable';
import { useErroresFormulario } from '../componentes/useErroresFormulario';
import { useNotificaciones } from '../componentes/notificacionesContexto';
import { useOrdenTabla } from '../componentes/useOrdenTabla';
import { compararNumero, compararTexto } from '../componentes/ordenTabla';
import type { Seccion } from '../secciones';

const OPCIONES_UMBRAL = [5_000, 10_000, 15_000] as const;
const CAMPOS_SIMULACION = [
  'montoObjetivo',
  'meses',
  'categoriaRecorteId',
  'porcentajeRecorte',
] as const;

function Metrica({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <div className="border rounded p-2 h-100">
      <div className="small text-uppercase opacity-75">{titulo}</div>
      <div className="fw-semibold">{valor}</div>
      {detalle && <div className="small opacity-75">{detalle}</div>}
    </div>
  );
}

function tituloDiagnostico(resultado: ResultadoSimulacion): string {
  if (resultado.diagnostico === 'success') return '✅ Escenario viable';
  if (resultado.diagnostico === 'warning') {
    return '⚠️ Alcanza, pero sacrifica su meta';
  }
  return '⛔ Escenario no viable';
}

function detalleDiagnostico(resultado: ResultadoSimulacion): string {
  if (resultado.diagnostico === 'success') {
    return 'La cuota cabe en el flujo proyectado y se conserva la meta de ahorro.';
  }
  if (resultado.diagnostico === 'warning') {
    return 'La cuota cabe en el flujo, pero no queda margen para la meta de ahorro completa.';
  }
  return 'El flujo libre proyectado no alcanza para cubrir la cuota mensual.';
}

export function Analisis({ irA }: { irA?: (seccion: Seccion) => void }) {
  const notificaciones = useNotificaciones();
  const { errores, limpiar, limpiarTodo, manejar } = useErroresFormulario();
  const periodoActual = fechaHoy().slice(0, 7);

  // --- Detector de gastos hormiga -------------------------------------------
  const [periodo, setPeriodo] = useState(periodoActual);
  const [umbral, setUmbral] = useState(10_000);
  const [soloRepetitivos, setSoloRepetitivos] = useState(true);
  const [analisis, setAnalisis] = useState<AnalisisGastosHormiga | null>(null);
  const [cargandoAnalisis, setCargandoAnalisis] = useState(true);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
  const [versionAnalisis, setVersionAnalisis] = useState(0);

  useEffect(() => {
    let activo = true;

    finanzasService
      .analizarGastosHormiga(periodo, umbral)
      .then((datos) => {
        if (!activo) return;
        setAnalisis(datos);
        setErrorAnalisis(null);
        setCargandoAnalisis(false);
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        setErrorAnalisis(mensajeDeError(fallo));
        setCargandoAnalisis(false);
      });

    return () => {
      activo = false;
    };
  }, [periodo, umbral, versionAnalisis]);

  const fugasVisibles = (analisis?.fugas ?? []).filter(
    (fuga) => !soloRepetitivos || fuga.esFrecuente,
  );
  const comparadoresFugas = {
    comercio: compararTexto<FugaGastoHormiga>((fuga) => fuga.etiqueta),
    categoria: compararTexto<FugaGastoHormiga>((fuga) => fuga.categoriaNombre),
    movimientos: compararNumero<FugaGastoHormiga>((fuga) => fuga.cantidad),
    promedio: compararNumero<FugaGastoHormiga>((fuga) => fuga.promedio),
    total: compararNumero<FugaGastoHormiga>((fuga) => fuga.totalPeriodo),
    anual: compararNumero<FugaGastoHormiga>((fuga) => fuga.proyeccionAnual),
    porcentaje: compararNumero<FugaGastoHormiga>(
      (fuga) => fuga.porcentajeSobreFugas,
    ),
  };
  const {
    filas: fugasOrdenadas,
    orden: ordenFugas,
    alternar: alternarFugas,
  } = useOrdenTabla(fugasVisibles, comparadoresFugas);

  const reintentarAnalisis = () => {
    setErrorAnalisis(null);
    setCargandoAnalisis(true);
    setVersionAnalisis((actual) => actual + 1);
  };

  const cambiarPeriodo = (nuevo: string) => {
    setPeriodo(nuevo);
    setErrorAnalisis(null);
    setCargandoAnalisis(true);
  };

  const cambiarUmbral = (nuevo: number) => {
    setUmbral(nuevo);
    setErrorAnalisis(null);
    setCargandoAnalisis(true);
  };

  // --- Simulador de escenarios ---------------------------------------------
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [montoObjetivo, setMontoObjetivo] = useState('150000');
  const [meses, setMeses] = useState('6');
  const [categoriaRecorteId, setCategoriaRecorteId] = useState('');
  const [porcentajeRecorte, setPorcentajeRecorte] = useState(0);
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [calculando, setCalculando] = useState(true);
  const [errorSimulacion, setErrorSimulacion] = useState<string | null>(null);
  const [versionSimulacion, setVersionSimulacion] = useState(0);

  useEffect(() => {
    let activo = true;

    finanzasService
      .listarCategorias('gasto')
      .then((datos) => {
        if (!activo) return;
        setCategorias(datos);
        setCargandoCategorias(false);
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        notificaciones.error(mensajeDeError(fallo));
        setCargandoCategorias(false);
      });

    return () => {
      activo = false;
    };
  }, [notificaciones]);

  const montoNumero = Number(montoObjetivo);
  const mesesNumero = Number(meses);

  const errorMontoLocal =
    montoObjetivo.trim() === '' ||
    !Number.isFinite(montoNumero) ||
    montoNumero <= 0
      ? 'Ingrese un monto mayor que cero.'
      : null;
  const errorMesesLocal =
    !Number.isInteger(mesesNumero) || mesesNumero < 1 || mesesNumero > 120
      ? 'Indique una cantidad entera entre 1 y 120 meses.'
      : null;
  const errorPorcentajeLocal =
    !Number.isFinite(porcentajeRecorte) ||
    porcentajeRecorte < 0 ||
    porcentajeRecorte > 100
      ? 'El porcentaje debe estar entre 0 y 100.'
      : null;
  const errorCategoriaLocal =
    porcentajeRecorte > 0 && !categoriaRecorteId
      ? 'Elija la categoría de gasto que quiere recortar.'
      : null;

  const errorMonto = errorMontoLocal ?? errores.montoObjetivo ?? null;
  const errorMeses = errorMesesLocal ?? errores.meses ?? null;
  const errorPorcentaje =
    errorPorcentajeLocal ?? errores.porcentajeRecorte ?? null;
  const errorCategoria =
    errorCategoriaLocal ?? errores.categoriaRecorteId ?? null;

  const puedeSimular = !errorMontoLocal && !errorMesesLocal &&
    !errorPorcentajeLocal && !errorCategoriaLocal;

  useEffect(() => {
    if (!puedeSimular) return;

    let activo = true;

    const temporizador = setTimeout(() => {
      const parametros: ParametrosSimulacion = categoriaRecorteId
        ? {
            montoObjetivo: montoNumero,
            meses: mesesNumero,
            categoriaRecorteId,
            porcentajeRecorte,
          }
        : { montoObjetivo: montoNumero, meses: mesesNumero };

      finanzasService
        .simularEscenario(parametros)
        .then((datos) => {
          if (!activo) return;
          setResultado(datos);
          setErrorSimulacion(null);
          setCalculando(false);
        })
        .catch((fallo: unknown) => {
          if (!activo) return;
          manejar(fallo, CAMPOS_SIMULACION);
          setErrorSimulacion(mensajeDeError(fallo));
          setCalculando(false);
        });
    }, 250);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [
    categoriaRecorteId,
    manejar,
    mesesNumero,
    montoNumero,
    porcentajeRecorte,
    puedeSimular,
    versionSimulacion,
  ]);

  const reintentarSimulacion = () => {
    limpiarTodo();
    setErrorSimulacion(null);
    setCalculando(true);
    setVersionSimulacion((actual) => actual + 1);
  };

  const prepararSimulacion = () => {
    setErrorSimulacion(null);
    setCalculando(true);
  };

  const categoriasGasto = [...categorias].sort((a, b) =>
    a.nombreCompleto(categorias).localeCompare(b.nombreCompleto(categorias), 'es'),
  );

  return (
    <>
      <div className="mb-4">
        <h1 className="h4 mb-1">Análisis financiero</h1>
        <p className="text-muted mb-0">
          Detecte fugas pequeñas y simule compras o recortes con su flujo real.
        </p>
      </div>

      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
            <div>
              <h2 className="h5 mb-1">🐜 Detector de gastos hormiga</h2>
              <p className="text-muted mb-0">
                Gastos confirmados del periodo que no superan el umbral,
                agrupados por comercio.
              </p>
            </div>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => cambiarPeriodo(periodoActual)}
            >
              Mes actual
            </Button>
          </div>

          <Row className="g-3 mb-3">
            <Col xs={12} md={4}>
              <Form.Group controlId="periodoAnalisis">
                <Form.Label>Periodo</Form.Label>
                <Form.Control
                  type="month"
                  value={periodo}
                  max={periodoActual}
                  onChange={(evento) => cambiarPeriodo(evento.target.value)}
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={4}>
              <Form.Group controlId="umbralAnalisis">
                <Form.Label>Umbral por movimiento</Form.Label>
                <Form.Select
                  value={umbral}
                  onChange={(evento) => cambiarUmbral(Number(evento.target.value))}
                >
                  {OPCIONES_UMBRAL.map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {formatearMoneda(opcion)}
                      {opcion === 10_000 ? ' (recomendado)' : ''}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} md={4} className="d-flex align-items-end">
              <Form.Check
                type="switch"
                id="soloRepetitivos"
                label="Solo comercios repetitivos (2+)"
                checked={soloRepetitivos}
                onChange={(evento) => setSoloRepetitivos(evento.target.checked)}
              />
            </Col>
          </Row>

          <AlertaErrorCarga
            mensaje={errorAnalisis}
            onReintentar={reintentarAnalisis}
          />

          {cargandoAnalisis && !analisis && !errorAnalisis && (
            <Cargando texto="Analizando los gastos del periodo…" />
          )}

          {analisis && !errorAnalisis && (
            <>
              <Row className="g-3 mb-3">
                <Col xs={12} sm={6} xl={3}>
                  <TarjetaKpi
                    titulo="Fuga mensual"
                    valor={formatearMoneda(analisis.totalMensual)}
                    detalle={`${analisis.cantidadGastos} movimientos bajo el umbral`}
                    color="danger"
                  />
                </Col>
                <Col xs={12} sm={6} xl={3}>
                  <TarjetaKpi
                    titulo="Proyección anual"
                    valor={formatearMoneda(analisis.proyeccionAnual)}
                    detalle="Estimación lineal ×12"
                    color="danger"
                  />
                </Col>
                <Col xs={12} sm={6} xl={3}>
                  <TarjetaKpi
                    titulo="Fugas frecuentes"
                    valor={String(analisis.cantidadFugasFrecuentes)}
                    detalle={`de ${analisis.fugas.length} comercios detectados`}
                    color="primary"
                  />
                </Col>
                <Col xs={12} sm={6} xl={3}>
                  <TarjetaKpi
                    titulo="% del gasto del mes"
                    valor={formatearPorcentaje(
                      analisis.porcentajeDelGastoTotal,
                    )}
                    detalle={`sobre ${formatearMoneda(analisis.totalGastosPeriodo)}`}
                    color="secondary"
                  />
                </Col>
              </Row>

              {analisis.fugas.length === 0 ? (
                <Alert variant="success" className="mb-0">
                  No se detectaron gastos confirmados bajo el umbral en este
                  periodo.
                </Alert>
              ) : fugasOrdenadas.length === 0 ? (
                <Alert
                  variant="info"
                  className="mb-0 d-flex flex-wrap justify-content-between align-items-center gap-2"
                >
                  <span>
                    Hay {analisis.fugas.length} comercio(s) bajo el umbral, pero
                    ninguno se repite dos veces.
                  </span>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setSoloRepetitivos(false)}
                  >
                    Ver todos
                  </Button>
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table hover size="sm" className="align-middle mb-0">
                    <thead>
                      <tr>
                        <ThOrdenable
                          clave="comercio"
                          orden={ordenFugas}
                          onAlternar={alternarFugas}
                        >
                          Comercio / descripción
                        </ThOrdenable>
                        <ThOrdenable
                          clave="categoria"
                          orden={ordenFugas}
                          onAlternar={alternarFugas}
                        >
                          Categoría
                        </ThOrdenable>
                        <ThOrdenable
                          clave="movimientos"
                          orden={ordenFugas}
                          onAlternar={alternarFugas}
                          className="text-end"
                        >
                          Mov.
                        </ThOrdenable>
                        <ThOrdenable
                          clave="promedio"
                          orden={ordenFugas}
                          onAlternar={alternarFugas}
                          className="text-end"
                        >
                          Promedio
                        </ThOrdenable>
                        <ThOrdenable
                          clave="total"
                          orden={ordenFugas}
                          onAlternar={alternarFugas}
                          className="text-end"
                        >
                          Total del mes
                        </ThOrdenable>
                        <ThOrdenable
                          clave="anual"
                          orden={ordenFugas}
                          onAlternar={alternarFugas}
                          className="text-end"
                        >
                          Proyección anual
                        </ThOrdenable>
                        <ThOrdenable
                          clave="porcentaje"
                          orden={ordenFugas}
                          onAlternar={alternarFugas}
                          className="text-end"
                        >
                          % de fugas
                        </ThOrdenable>
                      </tr>
                    </thead>
                    <tbody>
                      {fugasOrdenadas.map((fuga) => (
                        <tr key={fuga.clave}>
                          <td>
                            <span className="fw-semibold">{fuga.etiqueta}</span>
                            {fuga.esFrecuente && (
                              <Badge bg="warning" text="dark" className="ms-2">
                                Frecuente
                              </Badge>
                            )}
                            <div className="small text-muted">
                              {fuga.primeraFecha === fuga.ultimaFecha
                                ? fuga.primeraFecha
                                : `${fuga.primeraFecha} → ${fuga.ultimaFecha}`}
                            </div>
                          </td>
                          <td>{fuga.categoriaNombre}</td>
                          <td className="text-end">{fuga.cantidad}</td>
                          <td className="text-end">
                            {formatearMoneda(fuga.promedio)}
                          </td>
                          <td className="text-end">
                            {formatearMoneda(fuga.totalPeriodo)}
                          </td>
                          <td className="text-end fw-semibold">
                            {formatearMoneda(fuga.proyeccionAnual)}
                          </td>
                          <td className="text-end">
                            {formatearPorcentaje(fuga.porcentajeSobreFugas)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              <p className="small text-muted mt-3 mb-0">
                La proyección anual es lineal (total del periodo × 12). El total
                mensual incluye todos los gastos bajo el umbral, aunque la tabla
                muestre solo los repetitivos.
              </p>
            </>
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body>
          <div className="mb-3">
            <h2 className="h5 mb-1">🔮 Simulador de escenarios</h2>
            <p className="text-muted mb-0">
              ¿Me alcanza? Ajuste el objetivo, las cuotas y un recorte opcional
              para ver el efecto en su flujo y en su meta de ahorro.
            </p>
          </div>

          <Row className="g-3 mb-4">
            <Col xs={12} md={6} lg={3}>
              <Form.Group controlId="montoObjetivo">
                <Form.Label>Monto objetivo</Form.Label>
                <InputGroup hasValidation>
                  <InputGroup.Text>₡</InputGroup.Text>
                  <Form.Control
                    type="number"
                    min="1"
                    step="1000"
                    value={montoObjetivo}
                    isInvalid={Boolean(errorMonto)}
                    onChange={(evento) => {
                      limpiar('montoObjetivo');
                      prepararSimulacion();
                      setMontoObjetivo(evento.target.value);
                    }}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errorMonto}
                  </Form.Control.Feedback>
                </InputGroup>
              </Form.Group>
            </Col>
            <Col xs={12} md={6} lg={2}>
              <Form.Group controlId="mesesSimulacion">
                <Form.Label>Meses / cuotas</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  max="120"
                  value={meses}
                  isInvalid={Boolean(errorMeses)}
                  onChange={(evento) => {
                    limpiar('meses');
                    prepararSimulacion();
                    setMeses(evento.target.value);
                  }}
                />
                <Form.Control.Feedback type="invalid">
                  {errorMeses}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col xs={12} md={6} lg={4}>
              <Form.Group controlId="categoriaRecorte">
                <Form.Label>Categoría a recortar</Form.Label>
                <Form.Select
                  value={categoriaRecorteId}
                  isInvalid={Boolean(errorCategoria)}
                  disabled={cargandoCategorias}
                  onChange={(evento) => {
                    limpiar('categoriaRecorteId');
                    prepararSimulacion();
                    setCategoriaRecorteId(evento.target.value);
                  }}
                >
                  <option value="">
                    {cargandoCategorias ? 'Cargando categorías…' : 'Sin recorte'}
                  </option>
                  {categoriasGasto.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombreCompleto(categorias)}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {errorCategoria}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Form.Group controlId="porcentajeRecorte">
                <Form.Label>
                  Recorte: {formatearPorcentaje(porcentajeRecorte)}
                </Form.Label>
                <Form.Range
                  min="0"
                  max="100"
                  step="5"
                  value={porcentajeRecorte}
                  onChange={(evento) => {
                    limpiar('porcentajeRecorte');
                    prepararSimulacion();
                    setPorcentajeRecorte(Number(evento.target.value));
                  }}
                />
                <Form.Text muted>
                  Se aplica al gasto promedio de la categoría y sus
                  subcategorías.
                </Form.Text>
                {errorPorcentaje && (
                  <div className="text-danger small">{errorPorcentaje}</div>
                )}
              </Form.Group>
            </Col>
          </Row>

          {errorSimulacion && (
            <Alert
              variant="danger"
              className="d-flex flex-wrap justify-content-between align-items-center gap-2"
            >
              <span>{errorSimulacion}</span>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={reintentarSimulacion}
              >
                Reintentar
              </Button>
            </Alert>
          )}

          {calculando && puedeSimular && !resultado && !errorSimulacion && (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" role="status" />
              <span className="ms-2 text-muted">Calculando escenario…</span>
            </div>
          )}

          {!puedeSimular && (
            <p className="text-muted mb-0">
              Corrija los valores para ver el diagnóstico del escenario.
            </p>
          )}

          {!calculando && puedeSimular && !resultado && !errorSimulacion && (
            <p className="text-muted mb-0">
              Ajuste los valores para ver el diagnóstico del escenario.
            </p>
          )}

          {resultado && puedeSimular && (
            <>
              <Card
                bg={resultado.diagnostico}
                text={resultado.diagnostico === 'warning' ? 'dark' : 'white'}
                className="shadow-sm"
                aria-live="polite"
              >
                <Card.Body>
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                    <div>
                      <Card.Title className="h5 mb-1">
                        {tituloDiagnostico(resultado)}
                      </Card.Title>
                      <Card.Text className="mb-0">
                        {detalleDiagnostico(resultado)}
                      </Card.Text>
                    </div>
                    {calculando && (
                      <Spinner animation="border" size="sm" role="status" />
                    )}
                  </div>

                  <Row className="g-2">
                    <Col xs={12} sm={6} xl={3}>
                      <Metrica
                        titulo="Cuota mensual"
                        valor={formatearMoneda(resultado.cuotaMensual)}
                        detalle={`${resultado.meses} mes(es)`}
                      />
                    </Col>
                    <Col xs={12} sm={6} xl={3}>
                      <Metrica
                        titulo="Flujo libre actual"
                        valor={formatearMoneda(resultado.flujoLibreActual)}
                        detalle="Promedio + reglas activas"
                      />
                    </Col>
                    <Col xs={12} sm={6} xl={3}>
                      <Metrica
                        titulo="Flujo libre proyectado"
                        valor={formatearMoneda(resultado.flujoLibreProyectado)}
                        detalle={
                          resultado.porcentajeRecorte > 0
                            ? `Con recorte del ${formatearPorcentaje(resultado.porcentajeRecorte)}`
                            : 'Sin recorte'
                        }
                      />
                    </Col>
                    <Col xs={12} sm={6} xl={3}>
                      <Metrica
                        titulo="Meta de ahorro mensual"
                        valor={formatearMoneda(resultado.metaAhorroMensual)}
                      />
                    </Col>
                    <Col xs={12} sm={6} xl={3}>
                      <Metrica
                        titulo="Disponible tras la meta"
                        valor={formatearMoneda(resultado.disponibleParaCuota)}
                      />
                    </Col>
                    <Col xs={12} sm={6} xl={3}>
                      <Metrica
                        titulo={
                          resultado.diferenciaMensual >= 0
                            ? 'Sobra al mes'
                            : 'Falta al mes'
                        }
                        valor={formatearMoneda(
                          Math.abs(resultado.diferenciaMensual),
                        )}
                      />
                    </Col>
                    <Col xs={12} sm={6} xl={3}>
                      <Metrica
                        titulo="Meses para el objetivo"
                        valor={
                          resultado.mesesParaObjetivo === null
                            ? '—'
                            : `${resultado.mesesParaObjetivo} mes(es)`
                        }
                        detalle={
                          resultado.fechaEstimada
                            ? `Fecha estimada: ${formatearMes(resultado.fechaEstimada)}`
                            : 'Sin flujo positivo'
                        }
                      />
                    </Col>
                    <Col xs={12} sm={6} xl={3}>
                      <Metrica
                        titulo="Ahorro anual con recorte"
                        valor={formatearMoneda(resultado.ahorroAnualRecorte)}
                        detalle={`${formatearMoneda(resultado.ahorroMensualRecorte)}/mes`}
                      />
                    </Col>
                  </Row>

                  <Row className="g-2 mt-3 small">
                    <Col xs={12} lg={6}>
                      <strong>Meses analizados:</strong>{' '}
                      {resultado.mesesAnalizados.length === 0
                        ? 'sin historial (solo reglas activas)'
                        : resultado.mesesAnalizados
                            .map(formatearMes)
                            .join(' · ')}
                    </Col>
                    <Col xs={12} lg={6}>
                      <strong>Flujo libre promedio:</strong>{' '}
                      {formatearMoneda(resultado.flujoLibrePromedio)}
                    </Col>
                    <Col xs={12} lg={6}>
                      <strong>Compromiso recurrente:</strong>{' '}
                      {formatearMoneda(resultado.compromisoRecurrenteMensual)}
                      /mes
                    </Col>
                    <Col xs={12} lg={6}>
                      <strong>Ingreso recurrente:</strong>{' '}
                      {formatearMoneda(resultado.ingresoRecurrenteMensual)}/mes
                    </Col>
                    {resultado.categoriaRecorteNombre && (
                      <Col xs={12}>
                        <strong>Recorte aplicado:</strong>{' '}
                        {resultado.categoriaRecorteNombre} · gasto promedio{' '}
                        {formatearMoneda(resultado.gastoCategoriaPromedio)} →
                        proyectado{' '}
                        {formatearMoneda(resultado.gastoCategoriaProyectada)}
                      </Col>
                    )}
                  </Row>

                  {resultado.metaAhorroMensual === 0 && (
                    <Alert
                      variant="info"
                      className="mt-3 mb-0 d-flex flex-wrap justify-content-between align-items-center gap-2"
                    >
                      <span>
                        No hay una meta de ahorro mensual configurada. El
                        diagnóstico no descuenta ahorro.
                      </span>
                      {irA && (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => irA('cuenta')}
                        >
                          Configurar meta
                        </Button>
                      )}
                    </Alert>
                  )}

                  {resultado.mesesAnalizados.length === 0 && (
                    <Alert variant="warning" className="mt-3 mb-0">
                      Todavía no hay movimientos confirmados. El cálculo usa
                      únicamente las reglas recurrentes activas.
                    </Alert>
                  )}

                  {resultado.recurrenciasActivas.length > 0 && (
                    <div className="mt-3">
                      <div className="small text-uppercase opacity-75 mb-1">
                        Reglas activas incluidas
                      </div>
                      <ul className="list-unstyled small mb-0">
                        {resultado.recurrenciasActivas.map((recurrencia) => (
                          <li
                            key={recurrencia.id}
                            className="d-flex flex-wrap justify-content-between gap-2 border-bottom py-1"
                          >
                            <span>
                              {recurrencia.descripcion}{' '}
                              <span className="opacity-75">
                                ({formatearFrecuencia(recurrencia.frecuencia)})
                              </span>
                            </span>
                            <span className="fw-semibold">
                              {formatearMoneda(recurrencia.montoMensual)}/mes
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card.Body>
              </Card>

              <p className="small text-muted mt-3 mb-0">
                Los promedios usan hasta los últimos 3 meses cerrados con datos.
                El mes en curso solo entra cuando no existe historial anterior.
              </p>
            </>
          )}
        </Card.Body>
      </Card>
    </>
  );
}
