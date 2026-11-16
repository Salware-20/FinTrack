import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, ProgressBar, Row, Table } from 'react-bootstrap';
import type { Categoria, Cuenta, SaldoCuenta, Transaccion, Usuario } from '../../models';
import { TipoTransaccion } from '../../models';
import { finanzasService } from '../../services';
import type { AlertaConcentracionGasto, ConfiguracionUsuario, EstadoPresupuesto, ResumenFinanciero } from '../../models/tipos';
import {
  finDeMes,
  formatearFecha,
  formatearMes,
  formatearMoneda,
  inicioDeMes,
} from '../../utils/formato';
import { redondearMonto, sumarMontos } from '../../utils/numeros';
import { AlertaErrorCarga, Cargando, TarjetaKpi } from '../componentes/Estado';
import { mensajeDeError } from '../../utils/errores';
import { GraficoCategorias, GraficoFlujo } from '../componentes/Graficos';
import type { Seccion } from '../secciones';

interface Props {
  usuario: Usuario;
  irA: (seccion: Seccion) => void;
}

export function Dashboard({ usuario, irA }: Props) {
  const [resumenMes, setResumenMes] = useState<ResumenFinanciero | null>(null);
  const [resumenTotal, setResumenTotal] = useState<ResumenFinanciero | null>(null);
  const [saldos, setSaldos] = useState<SaldoCuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [ultimas, setUltimas] = useState<Transaccion[]>([]);
  const [presupuestos, setPresupuestos] = useState<EstadoPresupuesto[]>([]);
  const [alertasConcentracion, setAlertasConcentracion] = useState<AlertaConcentracionGasto[]>([]);
  const [configuracion, setConfiguracion] = useState<ConfiguracionUsuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let activo = true;

    Promise.all([
      finanzasService.obtenerResumen({ desde: inicioDeMes(), hasta: finDeMes() }),
      finanzasService.obtenerResumen(),
      finanzasService.obtenerSaldos(),
      finanzasService.listarCategorias(),
      finanzasService.listarCuentas(),
      finanzasService.listarTransacciones(),
      finanzasService.obtenerEstadoPresupuestos(),
      finanzasService.obtenerAlertasConcentracion(),
      finanzasService.obtenerConfiguracion(),
    ])
      .then(([mes, total, saldosCargados, categoriasCargadas, cuentasCargadas, transacciones, presupuestosCargados, alertasCargadas, configCargada]) => {
        if (!activo) return;
        setResumenMes(mes);
        setResumenTotal(total);
        setSaldos(saldosCargados);
        setCategorias(categoriasCargadas);
        setCuentas(cuentasCargadas);
        setUltimas(transacciones.slice(0, 7));
        setPresupuestos(presupuestosCargados);
        setAlertasConcentracion(alertasCargadas);
        setConfiguracion(configCargada);
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
  }, [version]);

  const reintentarCarga = () => {
    setErrorCarga(null);
    setCargando(true);
    setVersion((actual) => actual + 1);
  };

  if (cargando) return <Cargando texto="Calculando su situaciÃ³n financieraâ€¦" />;
  if (errorCarga) {
    return (
      <AlertaErrorCarga mensaje={errorCarga} onReintentar={reintentarCarga} />
    );
  }
  if (!resumenMes || !resumenTotal) return null;

  const patrimonio = sumarMontos(saldos.map((cuenta) => cuenta.saldo));
  const nombreCategoria = (id: string) =>
    categorias.find((categoria) => categoria.id === id)?.nombre ?? 'Sin categorÃ­a';
  const nombreCuenta = (id: string) =>
    cuentas.find((cuenta) => cuenta.id === id)?.nombre ?? 'Sin cuenta';
  const mesActual = new Date().toLocaleDateString('es-CR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
        <div>
          <h1 className="h4 mb-1">Hola, {usuario.nombre.split(' ')[0]} ðŸ‘‹</h1>
          <p className="text-muted mb-0 text-capitalize">{mesActual}</p>
        </div>
        <Button onClick={() => irA('movimientos')}>+ Registrar movimiento</Button>
      </div>

      {resumenTotal.cantidadTransacciones === 0 && (
        <Card className="border-primary mb-4">
          <Card.Body className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <Card.Title className="h5 mb-1">Empiece por su primer movimiento</Card.Title>
              <p className="text-muted mb-0">
                Registre un ingreso o un gasto y el dashboard se llenarÃ¡ solo.
              </p>
            </div>
            <Button onClick={() => irA('movimientos')}>Registrar ahora</Button>
          </Card.Body>
        </Card>
      )}

      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} xl={3}>
          <TarjetaKpi
            titulo="Ingresos del mes"
            valor={formatearMoneda(resumenMes.totalIngresos)}
            detalle={`${resumenMes.cantidadIngresos} movimientos`}
            color="success"
          />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <TarjetaKpi
            titulo="Gastos del mes"
            valor={formatearMoneda(resumenMes.totalGastos)}
            detalle={`${resumenMes.cantidadGastos} movimientos`}
            color="danger"
          />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <TarjetaKpi
            titulo="Balance del mes"
            valor={formatearMoneda(resumenMes.balance)}
            detalle={
              resumenMes.totalIngresos > 0
                ? `Ahorro: ${(
                    (resumenMes.balance / resumenMes.totalIngresos) *
                    100
                  ).toFixed(1)} %`
                : 'Sin ingresos este mes'
            }
            color={resumenMes.balance >= 0 ? 'primary' : 'danger'}
          />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <TarjetaKpi
            titulo="Patrimonio"
            valor={formatearMoneda(patrimonio)}
            detalle={`${saldos.filter((cuenta) => cuenta.activa).length} cuentas activas`}
            color="secondary"
          />
        </Col>
      </Row>

      {/* Seccion de Alertas de Consumo y Presupuestos */}
      <Card className="mb-4">
        <Card.Header className="bg-transparent d-flex justify-content-between align-items-center">
          <h2 className="h5 mb-0">Alertas y Control de Gastos</h2>
          <Button size="sm" variant="outline-primary" onClick={() => irA('categorias')}>
            Gestionar presupuestos
          </Button>
        </Card.Header>
        <Card.Body>
          {alertasConcentracion.length > 0 && (
            <div className="mb-4">
              <h3 className="h6 text-danger fw-bold mb-2">
                ⚠️ Alerta de concentracion de gasto ({'>='} 30 % del gasto mensual)
              </h3>
              <div className="d-flex flex-column gap-2">
                {alertasConcentracion.map((alerta) => (
                  <Alert key={alerta.categoriaId} variant="warning" className="mb-0 d-flex justify-content-between align-items-center py-2 px-3">
                    <div>
                      <strong>{alerta.categoriaNombre}</strong> absorbe el <strong>{alerta.porcentajeDelTotal.toFixed(1)} %</strong> del gasto total del mes ({formatearMoneda(alerta.montoGastado)}).
                    </div>
                    <Badge bg="danger" className="fs-6">
                      {alerta.porcentajeDelTotal.toFixed(0)} % del gasto
                    </Badge>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          <Row className="g-3">
            <Col xs={12} md={configuracion?.metaAhorroMensual ? 6 : 12}>
              <h3 className="h6 mb-3">Presupuestos por categoria</h3>
              {presupuestos.length === 0 ? (
                <p className="text-muted small mb-0">
                  No hay presupuestos activos este mes. Puede crearlos desde la seccion Categorias.
                </p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {presupuestos.map((p) => {
                    const variant =
                      p.estadoAlerta === 'excedido'
                        ? 'danger'
                        : p.estadoAlerta === 'advertencia'
                        ? 'warning'
                        : 'success';
                    return (
                      <div key={p.presupuestoId}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-semibold">
                            {p.categoriaNombre}
                            {p.estadoAlerta === 'excedido' && (
                              <Badge bg="danger" className="ms-2">Excedido</Badge>
                            )}
                            {p.estadoAlerta === 'advertencia' && (
                              <Badge bg="warning" text="dark" className="ms-2">Advertencia</Badge>
                            )}
                          </span>
                          <span className="small text-muted">
                            {formatearMoneda(p.montoGastado)} / {formatearMoneda(p.montoLimite)} ({p.porcentajeConsumido.toFixed(1)} %)
                          </span>
                        </div>
                        <ProgressBar
                          now={Math.min(p.porcentajeConsumido, 100)}
                          variant={variant}
                          style={{ height: '8px' }}
                        />
                        <div className="d-flex justify-content-between mt-1">
                          <span className="small text-muted">
                            {p.montoDisponible >= 0
                              ? `Disponible: ${formatearMoneda(p.montoDisponible)}`
                              : `Excedido por: ${formatearMoneda(Math.abs(p.montoDisponible))}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Col>

            {Boolean(configuracion?.metaAhorroMensual && configuracion.metaAhorroMensual > 0) && (
              <Col xs={12} md={6}>
                <h3 className="h6 mb-3">Meta de ahorro mensual</h3>
                {(() => {
                  const meta = configuracion!.metaAhorroMensual!;
                  const ahorroActual = Math.max(0, resumenMes.balance);
                  const pctAhorro = redondearMonto((ahorroActual / meta) * 100);
                  const alcanzada = ahorroActual >= meta;
                  return (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-semibold">
                          Progreso del mes
                          {alcanzada && <Badge bg="success" className="ms-2">¡Meta alcanzada!</Badge>}
                        </span>
                        <span className="small text-muted">
                          {formatearMoneda(ahorroActual)} / {formatearMoneda(meta)} ({pctAhorro.toFixed(1)} %)
                        </span>
                      </div>
                      <ProgressBar
                        now={Math.min(pctAhorro, 100)}
                        variant={alcanzada ? 'success' : 'primary'}
                        style={{ height: '8px' }}
                      />
                      <div className="mt-1 small text-muted">
                        {alcanzada
                          ? `Supero la meta por ${formatearMoneda(ahorroActual - meta)}.`
                          : `Faltan ${formatearMoneda(meta - ahorroActual)} para alcanzar la meta.`}
                      </div>
                    </div>
                  );
                })()}
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-3 mb-4">
        <Col xs={12} xl={7}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="h5 mb-3">Flujo por mes</Card.Title>
              <GraficoFlujo datos={resumenTotal.porMes} />
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} xl={5}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="h5 mb-3">Gastos del mes por categorÃ­a</Card.Title>
              <GraficoCategorias datos={resumenMes.porCategoria} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3">
        <Col xs={12} xl={7}>
          <Card className="h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title className="h5 mb-0">Ãšltimos movimientos</Card.Title>
                <Button size="sm" variant="outline-primary" onClick={() => irA('movimientos')}>
                  Ver todos
                </Button>
              </div>

              {ultimas.length === 0 ? (
                <p className="text-muted mb-0">TodavÃ­a no hay movimientos.</p>
              ) : (
                <div className="table-responsive">
                  <Table hover size="sm" className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>DescripciÃ³n</th>
                        <th>CategorÃ­a</th>
                        <th className="text-end">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimas.map((transaccion) => (
                        <tr key={transaccion.id}>
                          <td className="text-nowrap">{formatearFecha(transaccion.fecha)}</td>
                          <td>
                            {transaccion.descripcion}
                            <div className="small text-muted">
                              {nombreCuenta(transaccion.cuentaId)}
                            </div>
                          </td>
                          <td className="text-nowrap">{nombreCategoria(transaccion.categoriaId)}</td>
                          <td
                            className={`text-end fw-semibold text-nowrap ${
                              transaccion.tipo === TipoTransaccion.Ingreso
                                ? 'text-success'
                                : 'text-danger'
                            }`}
                          >
                            {transaccion.tipo === TipoTransaccion.Ingreso ? '+' : 'âˆ’'}
                            {formatearMoneda(transaccion.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} xl={5}>
          <Card className="h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title className="h5 mb-0">Mis cuentas</Card.Title>
                <Button size="sm" variant="outline-secondary" onClick={() => irA('cuentas')}>
                  Gestionar
                </Button>
              </div>

              {saldos.length === 0 ? (
                <p className="text-muted mb-0">Sin cuentas registradas.</p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {saldos.map((cuenta) => (
                    <div
                      key={cuenta.cuentaId}
                      className="d-flex justify-content-between align-items-center border rounded p-2"
                    >
                      <div>
                        <div className="fw-semibold">
                          {cuenta.icono} {cuenta.nombre}
                          {!cuenta.activa && (
                            <Badge bg="secondary" className="ms-2">
                              Archivada
                            </Badge>
                          )}
                        </div>
                        <div className="small text-muted text-capitalize">{cuenta.tipo}</div>
                      </div>
                      <span
                        className={`fw-semibold ${cuenta.saldo < 0 ? 'text-danger' : ''}`}
                      >
                        {formatearMoneda(cuenta.saldo)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <hr />
              <div className="small text-muted">
                Ãšltimo mes disponible: {formatearMes(
                  resumenTotal.porMes.length > 0
                    ? resumenTotal.porMes[resumenTotal.porMes.length - 1].mes
                    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
