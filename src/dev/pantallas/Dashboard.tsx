import { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Row, Table } from 'react-bootstrap';
import type { Categoria, Cuenta, SaldoCuenta, Transaccion, Usuario } from '../../models';
import { TipoTransaccion } from '../../models';
import { finanzasService } from '../../services';
import type { ResumenFinanciero } from '../../models/tipos';
import {
  finDeMes,
  formatearFecha,
  formatearMes,
  formatearMoneda,
  inicioDeMes,
} from '../../utils/formato';
import { sumarMontos } from '../../utils/numeros';
import { AlertaError, Cargando, TarjetaKpi } from '../componentes/Estado';
import { mensajeDeError } from '../componentes/mensajes';
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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    Promise.all([
      finanzasService.obtenerResumen({ desde: inicioDeMes(), hasta: finDeMes() }),
      finanzasService.obtenerResumen(),
      finanzasService.obtenerSaldos(),
      finanzasService.listarCategorias(),
      finanzasService.listarCuentas(),
      finanzasService.listarTransacciones(),
    ])
      .then(([mes, total, saldosCargados, categoriasCargadas, cuentasCargadas, transacciones]) => {
        if (!activo) return;
        setResumenMes(mes);
        setResumenTotal(total);
        setSaldos(saldosCargados);
        setCategorias(categoriasCargadas);
        setCuentas(cuentasCargadas);
        setUltimas(transacciones.slice(0, 7));
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
  }, []);

  if (cargando) return <Cargando texto="Calculando su situación financiera…" />;
  if (error) return <AlertaError mensaje={error} />;
  if (!resumenMes || !resumenTotal) return null;

  const patrimonio = sumarMontos(saldos.map((cuenta) => cuenta.saldo));
  const nombreCategoria = (id: string) =>
    categorias.find((categoria) => categoria.id === id)?.nombre ?? 'Sin categoría';
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
          <h1 className="h4 mb-1">Hola, {usuario.nombre.split(' ')[0]} 👋</h1>
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
                Registre un ingreso o un gasto y el dashboard se llenará solo.
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
              <Card.Title className="h5 mb-3">Gastos del mes por categoría</Card.Title>
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
                <Card.Title className="h5 mb-0">Últimos movimientos</Card.Title>
                <Button size="sm" variant="outline-primary" onClick={() => irA('movimientos')}>
                  Ver todos
                </Button>
              </div>

              {ultimas.length === 0 ? (
                <p className="text-muted mb-0">Todavía no hay movimientos.</p>
              ) : (
                <div className="table-responsive">
                  <Table hover size="sm" className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Categoría</th>
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
                            {transaccion.tipo === TipoTransaccion.Ingreso ? '+' : '−'}
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
                Último mes disponible: {formatearMes(
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
