import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Table,
} from 'react-bootstrap';
import type { Cuenta, SaldoCuenta } from '../../models';
import { TipoCuenta, TIPOS_CUENTA } from '../../models';
import { finanzasService } from '../../services';
import {
  fechaHoy,
  formatearMoneda,
  formatearTipoCuenta,
} from '../../utils/formato';
import { sumarMontos } from '../../utils/numeros';
import { AlertaErrorCarga, Cargando } from '../componentes/Estado';
import { useNotificaciones } from '../componentes/notificacionesContexto';
import { useErroresFormulario } from '../componentes/useErroresFormulario';
import { mensajeDeError } from '../../utils/errores';

interface DatosCuentas {
  cuentas: Cuenta[];
  saldos: SaldoCuenta[];
}

async function consultarCuentas(): Promise<DatosCuentas> {
  const [cuentas, saldos] = await Promise.all([
    finanzasService.listarCuentas(),
    finanzasService.obtenerSaldos(),
  ]);
  return { cuentas, saldos };
}

interface FormularioCuenta {
  nombre: string;
  tipo: TipoCuenta;
  saldoInicial: string;
  institucion: string;
  color: string;
  icono: string;
}

const FORMULARIO_CUENTA: FormularioCuenta = {
  nombre: '',
  tipo: TipoCuenta.Banco,
  saldoInicial: '',
  institucion: '',
  color: '#0d6efd',
  icono: '',
};

const FORMULARIO_TRANSFERENCIA = {
  cuentaOrigenId: '',
  cuentaDestinoId: '',
  monto: '',
  fecha: fechaHoy(),
  descripcion: '',
};

const CAMPOS_CUENTA = ['nombre', 'saldoInicial'] as const;
const CAMPOS_TRANSFERENCIA = [
  'cuentaOrigenId',
  'cuentaDestinoId',
  'monto',
  'fecha',
] as const;

/**
 * Pantalla de cuentas de la demo: saldos calculados, alta de cuentas,
 * archivado y transferencias entre cuentas del mismo usuario.
 */
export function Cuentas() {
  const notificaciones = useNotificaciones();
  const {
    errores,
    limpiar,
    limpiarTodo,
    marcar,
    manejar,
  } = useErroresFormulario();

  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [saldos, setSaldos] = useState<SaldoCuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [version, setVersion] = useState(0);

  const [mostrarCuenta, setMostrarCuenta] = useState(false);
  const [formularioCuenta, setFormularioCuenta] = useState({ ...FORMULARIO_CUENTA });

  const [mostrarTransferencia, setMostrarTransferencia] = useState(false);
  const [formularioTransferencia, setFormularioTransferencia] = useState({
    ...FORMULARIO_TRANSFERENCIA,
  });

  useEffect(() => {
    let activo = true;

    consultarCuentas()
      .then((datos) => {
        if (!activo) return;
        setCuentas(datos.cuentas);
        setSaldos(datos.saldos);
        const activas = datos.cuentas.filter((cuenta) => cuenta.activa);
        setFormularioTransferencia((previo) => ({
          ...previo,
          cuentaOrigenId: previo.cuentaOrigenId || activas[0]?.id || '',
          cuentaDestinoId:
            previo.cuentaDestinoId ||
            activas.find((cuenta) => cuenta.id !== activas[0]?.id)?.id ||
            '',
        }));
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

  const crearCuenta = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarTodo();
    setGuardando(true);

    try {
      await finanzasService.crearCuenta({
        nombre: formularioCuenta.nombre,
        tipo: formularioCuenta.tipo,
        saldoInicial: formularioCuenta.saldoInicial
          ? Number(formularioCuenta.saldoInicial)
          : 0,
        institucion: formularioCuenta.institucion.trim() || undefined,
        color: formularioCuenta.color || undefined,
        icono: formularioCuenta.icono.trim() || undefined,
      });
      setFormularioCuenta({ ...FORMULARIO_CUENTA });
      setMostrarCuenta(false);
      limpiarTodo();
      notificaciones.exito('Cuenta creada.');
      recargar();
    } catch (fallo) {
      manejar(fallo, CAMPOS_CUENTA);
    } finally {
      setGuardando(false);
    }
  };

  const alternarArchivo = async (cuenta: Cuenta) => {
    setGuardando(true);

    try {
      await finanzasService.actualizarCuenta(cuenta.id, { activa: !cuenta.activa });
      notificaciones.exito(cuenta.activa ? 'Cuenta archivada.' : 'Cuenta reactivada.');
      recargar();
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    } finally {
      setGuardando(false);
    }
  };

  const transferir = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarTodo();

    if (formularioTransferencia.cuentaOrigenId === formularioTransferencia.cuentaDestinoId) {
      marcar(
        'cuentaDestinoId',
        'La cuenta de origen y la de destino deben ser diferentes.',
      );
      return;
    }

    setGuardando(true);
    try {
      await finanzasService.transferir({
        cuentaOrigenId: formularioTransferencia.cuentaOrigenId,
        cuentaDestinoId: formularioTransferencia.cuentaDestinoId,
        monto: Number(formularioTransferencia.monto),
        fecha: formularioTransferencia.fecha,
        descripcion: formularioTransferencia.descripcion.trim() || undefined,
      });
      setFormularioTransferencia((previo) => ({
        ...previo,
        monto: '',
        descripcion: '',
      }));
      setMostrarTransferencia(false);
      limpiarTodo();
      notificaciones.exito(
        'Transferencia registrada. No afecta los reportes de ingreso y gasto.',
      );
      recargar();
    } catch (fallo) {
      manejar(fallo, CAMPOS_TRANSFERENCIA);
    } finally {
      setGuardando(false);
    }
  };

  const patrimonio = sumarMontos(
    saldos.filter((saldo) => saldo.activa).map((saldo) => saldo.saldo),
  );
  const activas = cuentas.filter((cuenta) => cuenta.activa);
  const saldosActivos = saldos.filter((saldo) => saldo.activa);
  const saldoMayor =
    saldosActivos.length === 0
      ? 0
      : Math.max(...saldosActivos.map((saldo) => saldo.saldo));

  if (cargando) return <Cargando texto="Cargando cuentas y saldos…" />;

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 mb-1">Cuentas</h1>
          <p className="text-muted mb-0">
            Efectivo, banco, ahorro y tarjetas. El saldo se calcula solo.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-secondary"
            onClick={() => {
              limpiarTodo();
              setMostrarTransferencia((visible) => !visible);
            }}
          >
            Transferir entre cuentas
          </Button>
          <Button onClick={() => {
            limpiarTodo();
            setMostrarCuenta((visible) => !visible);
          }}>
            {mostrarCuenta ? 'Cerrar formulario' : '+ Nueva cuenta'}
          </Button>
        </div>
      </div>

      <AlertaErrorCarga mensaje={errorCarga} onReintentar={reintentarCarga} />

      <Row className="g-3 mb-4">
        <Col xs={12} md={4}>
          <Card bg="secondary" text="white" className="h-100">
            <Card.Body>
              <div className="text-uppercase small opacity-75">Patrimonio</div>
              <div className="fs-4 fw-semibold">{formatearMoneda(patrimonio)}</div>
              <div className="small opacity-75">
                {saldos.filter((saldo) => saldo.activa).length} cuentas activas
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-uppercase small text-muted">Cuentas totales</div>
              <div className="fs-4 fw-semibold">{cuentas.length}</div>
              <div className="small text-muted">
                {cuentas.length - activas.length} archivadas
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-uppercase small text-muted">Saldo más alto</div>
              <div className="fs-4 fw-semibold">
                {formatearMoneda(saldoMayor)}
              </div>
              <div className="small text-muted">Entre cuentas activas</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {mostrarCuenta && (
        <Card className="mb-4">
          <Card.Body>
            <Card.Title className="h5 mb-3">Nueva cuenta</Card.Title>
            <Form onSubmit={crearCuenta} noValidate>
              <Row className="g-3">
                <Col xs={12} md={4}>
                  <Form.Group controlId="cuenta-nombre">
                    <Form.Label>Nombre</Form.Label>
                    <Form.Control
                      value={formularioCuenta.nombre}
                      required
                      placeholder="Ejemplo: BAC Credomatic"
                      isInvalid={Boolean(errores.nombre)}
                      onChange={(evento) => {
                        setFormularioCuenta((previo) => ({
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
                <Col xs={12} md={4}>
                  <Form.Group controlId="cuenta-tipo">
                    <Form.Label>Tipo</Form.Label>
                    <Form.Select
                      value={formularioCuenta.tipo}
                      onChange={(evento) =>
                        setFormularioCuenta((previo) => ({
                          ...previo,
                          tipo: evento.target.value as TipoCuenta,
                        }))
                      }
                    >
                      {TIPOS_CUENTA.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {formatearTipoCuenta(tipo)}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Group controlId="cuenta-saldo">
                    <Form.Label>Saldo inicial (₡)</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={formularioCuenta.saldoInicial}
                      placeholder="0"
                      isInvalid={Boolean(errores.saldoInicial)}
                      onChange={(evento) => {
                        setFormularioCuenta((previo) => ({
                          ...previo,
                          saldoInicial: evento.target.value,
                        }));
                        limpiar('saldoInicial');
                      }}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errores.saldoInicial}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Group controlId="cuenta-institucion">
                    <Form.Label>Institución (opcional)</Form.Label>
                    <Form.Control
                      value={formularioCuenta.institucion}
                      placeholder="Banco, cooperativa…"
                      onChange={(evento) =>
                        setFormularioCuenta((previo) => ({
                          ...previo,
                          institucion: evento.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                </Col>
                <Col xs={6} md={3}>
                  <Form.Group controlId="cuenta-color">
                    <Form.Label>Color</Form.Label>
                    <Form.Control
                      type="color"
                      className="form-control-color w-100"
                      value={formularioCuenta.color}
                      onChange={(evento) =>
                        setFormularioCuenta((previo) => ({
                          ...previo,
                          color: evento.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                </Col>
                <Col xs={6} md={2}>
                  <Form.Group controlId="cuenta-icono">
                    <Form.Label>Ícono</Form.Label>
                    <Form.Control
                      value={formularioCuenta.icono}
                      placeholder="💵"
                      maxLength={4}
                      onChange={(evento) =>
                        setFormularioCuenta((previo) => ({
                          ...previo,
                          icono: evento.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} md={3} className="d-flex align-items-end gap-2">
                  <Button type="submit" disabled={guardando} className="flex-grow-1">
                    {guardando ? 'Guardando…' : 'Crear cuenta'}
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
      )}

      {mostrarTransferencia && (
        <Card className="mb-4">
          <Card.Body>
            <Card.Title className="h5 mb-1">Transferencia entre cuentas</Card.Title>
            <p className="text-muted small mb-3">
              Mueve dinero sin registrarlo como ingreso ni como gasto.
            </p>
            {activas.length < 2 ? (
              <Alert variant="warning" className="mb-0">
                Necesita al menos dos cuentas activas para transferir.
              </Alert>
            ) : (
              <Form onSubmit={transferir} noValidate>
                <Row className="g-3">
                  <Col xs={12} md={3}>
                    <Form.Group controlId="trf-origen">
                      <Form.Label>Desde</Form.Label>
                      <Form.Select
                        value={formularioTransferencia.cuentaOrigenId}
                        required
                        isInvalid={Boolean(errores.cuentaOrigenId)}
                        onChange={(evento) => {
                          setFormularioTransferencia((previo) => ({
                            ...previo,
                            cuentaOrigenId: evento.target.value,
                          }));
                          limpiar('cuentaOrigenId');
                          limpiar('cuentaDestinoId');
                        }}
                      >
                        {activas.map((cuenta) => (
                          <option key={cuenta.id} value={cuenta.id}>
                            {cuenta.icono} {cuenta.nombre}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">
                        {errores.cuentaOrigenId}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={3}>
                    <Form.Group controlId="trf-destino">
                      <Form.Label>Hacia</Form.Label>
                      <Form.Select
                        value={formularioTransferencia.cuentaDestinoId}
                        required
                        isInvalid={Boolean(errores.cuentaDestinoId)}
                        onChange={(evento) => {
                          setFormularioTransferencia((previo) => ({
                            ...previo,
                            cuentaDestinoId: evento.target.value,
                          }));
                          limpiar('cuentaDestinoId');
                        }}
                      >
                        {activas
                          .filter(
                            (cuenta) =>
                              cuenta.id !== formularioTransferencia.cuentaOrigenId,
                          )
                          .map((cuenta) => (
                            <option key={cuenta.id} value={cuenta.id}>
                              {cuenta.icono} {cuenta.nombre}
                            </option>
                          ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">
                        {errores.cuentaDestinoId}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col xs={6} md={2}>
                    <Form.Group controlId="trf-monto">
                      <Form.Label>Monto (₡)</Form.Label>
                      <Form.Control
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formularioTransferencia.monto}
                        required
                        isInvalid={Boolean(errores.monto)}
                        onChange={(evento) => {
                          setFormularioTransferencia((previo) => ({
                            ...previo,
                            monto: evento.target.value,
                          }));
                          limpiar('monto');
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errores.monto}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col xs={6} md={2}>
                    <Form.Group controlId="trf-fecha">
                      <Form.Label>Fecha</Form.Label>
                      <Form.Control
                        type="date"
                        value={formularioTransferencia.fecha}
                        required
                        isInvalid={Boolean(errores.fecha)}
                        onChange={(evento) => {
                          setFormularioTransferencia((previo) => ({
                            ...previo,
                            fecha: evento.target.value,
                          }));
                          limpiar('fecha');
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errores.fecha}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={2}>
                    <Form.Group controlId="trf-descripcion">
                      <Form.Label>Detalle</Form.Label>
                      <Form.Control
                        value={formularioTransferencia.descripcion}
                        placeholder="Opcional"
                        onChange={(evento) =>
                          setFormularioTransferencia((previo) => ({
                            ...previo,
                            descripcion: evento.target.value,
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex gap-2 mt-3">
                  <Button type="submit" disabled={guardando}>
                    {guardando ? 'Transfiriendo…' : 'Transferir'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => {
                      limpiarTodo();
                      setMostrarTransferencia(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </Form>
            )}
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body>
          <Card.Title className="h5 mb-3">Saldos por cuenta</Card.Title>

          {saldos.length === 0 ? (
            <p className="text-muted mb-0">Todavía no tiene cuentas registradas.</p>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Tipo</th>
                    <th className="text-end">Saldo inicial</th>
                    <th className="text-end">Saldo actual</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {saldos.map((saldo) => {
                    const cuenta = cuentas.find((item) => item.id === saldo.cuentaId);
                    return (
                      <tr key={saldo.cuentaId}>
                        <td>
                          <span
                            className="d-inline-block rounded-circle me-2"
                            style={{
                              width: 10,
                              height: 10,
                              backgroundColor: saldo.color,
                            }}
                          />
                          <span className="fw-semibold">
                            {saldo.icono} {saldo.nombre}
                          </span>
                          {cuenta?.institucion && (
                            <div className="small text-muted">{cuenta.institucion}</div>
                          )}
                        </td>
                        <td className="text-nowrap">{formatearTipoCuenta(saldo.tipo)}</td>
                        <td className="text-end text-muted text-nowrap">
                          {formatearMoneda(cuenta?.saldoInicial ?? 0)}
                        </td>
                        <td
                          className={`text-end fw-semibold text-nowrap ${
                            saldo.saldo < 0 ? 'text-danger' : ''
                          }`}
                        >
                          {formatearMoneda(saldo.saldo)}
                        </td>
                        <td>
                          <Badge bg={saldo.activa ? 'success' : 'secondary'}>
                            {saldo.activa ? 'Activa' : 'Archivada'}
                          </Badge>
                        </td>
                        <td className="text-end">
                          {cuenta && (
                            <Button
                              size="sm"
                              variant={cuenta.activa ? 'outline-danger' : 'outline-success'}
                              disabled={guardando}
                              onClick={() => void alternarArchivo(cuenta)}
                            >
                              {cuenta.activa ? 'Archivar' : 'Reactivar'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}

          <p className="text-muted small mt-3 mb-0">
            El saldo actual suma los movimientos confirmados y las transferencias; las
            cuentas archivadas conservan su historial pero no admiten movimientos nuevos.
          </p>
        </Card.Body>
      </Card>
    </>
  );
}
