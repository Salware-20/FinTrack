import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import type { Usuario } from '../../models';
import type { ConfiguracionUsuario } from '../../models/tipos';
import { finanzasService } from '../../services';
import type { RespaldoFinanzas } from '../../services';
import { descargarTexto, leerArchivoTexto, nombreConFecha } from '../../utils/descargas';
import { useNotificaciones } from '../componentes/notificacionesContexto';
import { useErroresFormulario } from '../componentes/useErroresFormulario';
import { mensajeDeError, normalizarError } from '../../utils/errores';

interface Props {
  usuario: Usuario;
  onSalir: () => void;
}

function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;

  return fecha.toLocaleString('es-CR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Pantalla "Mi cuenta" de la demo: perfil, contraseÃ±a, respaldo local,
 * restablecimiento de datos y eliminaciÃ³n de la cuenta.
 */
export function MiCuenta({ usuario, onSalir }: Props) {
  const notificaciones = useNotificaciones();
  const { error: notificarError } = notificaciones;
  const { errores, limpiar, limpiarTodo, marcar, manejar } =
    useErroresFormulario();

  const [configuracion, setConfiguracion] = useState<ConfiguracionUsuario | null>(null);
  const [metaAhorro, setMetaAhorro] = useState<string>('');
  const [guardandoMeta, setGuardandoMeta] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');

  const [archivo, setArchivo] = useState<File | null>(null);
  const [confirmarImportacion, setConfirmarImportacion] = useState(false);

  const [contrasenaEliminar, setContrasenaEliminar] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  useEffect(() => {
    let activo = true;

    finanzasService
      .obtenerConfiguracion()
      .then((resultado) => {
        if (!activo) return;
        setConfiguracion(resultado);
        setMetaAhorro(resultado.metaAhorroMensual ? String(resultado.metaAhorroMensual) : '0');
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        notificarError(mensajeDeError(fallo));
      });

    return () => {
      activo = false;
    };
  }, [notificarError]);

  const actualizarMetaAhorro = async (e: FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(metaAhorro);
    if (isNaN(valor) || valor < 0) {
      notificaciones.error('La meta de ahorro debe ser un numero mayor o igual a 0.');
      return;
    }
    setGuardandoMeta(true);
    try {
      const act = await finanzasService.actualizarConfiguracion({ metaAhorroMensual: valor });
      setConfiguracion(act);
      notificaciones.exito('Meta de ahorro mensual guardada.');
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    } finally {
      setGuardandoMeta(false);
    }
  };
  const cambiarContrasena = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarTodo();

    if (nueva !== confirmacion) {
      marcar('confirmacion', 'La nueva contraseÃ±a y su confirmaciÃ³n no coinciden.');
      return;
    }

    setOcupado(true);
    try {
      await finanzasService.cambiarContrasena(actual, nueva);
      setActual('');
      setNueva('');
      setConfirmacion('');
      limpiarTodo();
      notificaciones.exito('ContraseÃ±a actualizada.');
    } catch (fallo) {
      manejar(fallo, ['actual', 'contrasena']);
    } finally {
      setOcupado(false);
    }
  };

  const exportarRespaldo = async () => {
    setOcupado(true);

    try {
      const respaldo = await finanzasService.exportarRespaldo();
      descargarTexto(
        nombreConFecha('respaldo-fintrack', 'json'),
        JSON.stringify(respaldo, null, 2),
        'application/json;charset=utf-8',
      );
      notificaciones.exito('Respaldo descargado. GuÃ¡rdelo fuera de este equipo.');
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    } finally {
      setOcupado(false);
    }
  };

  const importarRespaldo = async () => {
    limpiarTodo();

    if (!archivo) {
      marcar('respaldo', 'Seleccione un archivo de respaldo.');
      return;
    }
    if (!confirmarImportacion) {
      notificaciones.aviso('Confirme que desea reemplazar sus datos actuales.');
      return;
    }

    setOcupado(true);
    try {
      const contenido = await leerArchivoTexto(archivo);
      const respaldo = JSON.parse(contenido) as RespaldoFinanzas;
      await finanzasService.importarRespaldo(respaldo);
      setArchivo(null);
      setConfirmarImportacion(false);
      limpiarTodo();
      notificaciones.exito(
        'Respaldo importado. Sus datos actuales fueron reemplazados.',
      );
    } catch (fallo) {
      if (fallo instanceof SyntaxError) {
        marcar('respaldo', 'El archivo no es un JSON vÃ¡lido.');
      } else {
        manejar(fallo, ['respaldo']);
      }
    } finally {
      setOcupado(false);
    }
  };

  const restablecerDatos = async () => {
    const confirmado = window.confirm(
      'Se eliminarÃ¡n todas sus cuentas, movimientos y transferencias, y se restaurarÃ¡n las categorÃ­as base. Â¿Continuar?',
    );
    if (!confirmado) return;

    setOcupado(true);
    try {
      await finanzasService.resetearDatos();
      notificaciones.exito(
        'Datos restablecidos: categorÃ­as base y cuenta de efectivo.',
      );
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    } finally {
      setOcupado(false);
    }
  };

  const eliminarCuenta = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarTodo();

    if (!confirmarEliminar) {
      notificaciones.aviso('Marque la casilla para confirmar la eliminaciÃ³n.');
      return;
    }

    setOcupado(true);
    try {
      await finanzasService.eliminarCuenta(contrasenaEliminar);
      notificaciones.exito('Cuenta eliminada. Todos sus datos locales fueron borrados.');
      onSalir();
    } catch (fallo) {
      const error = normalizarError(fallo);
      if (error.tipo === 'validacion' && error.campo === 'contrasena') {
        marcar('contrasenaEliminar', error.mensaje);
      } else {
        notificaciones.error(error.mensaje);
      }
      setOcupado(false);
    }
  };

  const cerrarSesion = async () => {
    setOcupado(true);
    try {
      await finanzasService.cerrarSesion();
      onSalir();
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
      setOcupado(false);
    }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 mb-1">Mi cuenta</h1>
          <p className="text-muted mb-0">
            Perfil, seguridad y respaldo de sus datos locales.
          </p>
        </div>
        <Button variant="outline-secondary" disabled={ocupado} onClick={() => void cerrarSesion()}>
          Cerrar sesiÃ³n
        </Button>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={12} lg={5}>
          <Card className="h-100">
            <Card.Body>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div
                  className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-semibold"
                  style={{ width: 56, height: 56, fontSize: 20 }}
                >
                  {usuario.iniciales}
                </div>
                <div>
                  <div className="h5 mb-0">{usuario.nombre}</div>
                  <div className="text-muted small">{usuario.correo}</div>
                </div>
              </div>

              <dl className="row small mb-0">
                <dt className="col-5 text-muted fw-normal">Cuenta creada</dt>
                <dd className="col-7 mb-2">{formatearFechaHora(usuario.creadoEn)}</dd>
                <dt className="col-5 text-muted fw-normal">Ãšltimo acceso</dt>
                <dd className="col-7 mb-2">{formatearFechaHora(usuario.ultimoAcceso)}</dd>
                <dt className="col-5 text-muted fw-normal">Moneda</dt>
                <dd className="col-7 mb-2">
                  {configuracion ? configuracion.moneda : 'CRC'}{' '}
                  <span className="text-muted">({configuracion?.locale ?? 'es-CR'})</span>
                </dd>
                <dt className="col-5 text-muted fw-normal">Almacenamiento</dt>
                <dd className="col-7 mb-0">
                  <Badge bg="secondary">IndexedDB local</Badge>
                </dd>
              </dl>
              <hr />
              <div className="mb-2">
                <h2 className="h6 mb-2">Meta de ahorro mensual</h2>
                <Form onSubmit={actualizarMetaAhorro} className="d-flex gap-2">
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Monto meta (CRC)"
                    value={metaAhorro}
                    onChange={(e) => setMetaAhorro(e.target.value)}
                  />
                  <Button type="submit" size="sm" variant="outline-primary" disabled={guardandoMeta || ocupado}>
                    {guardandoMeta ? '...' : 'Guardar'}
                  </Button>
                </Form>
                <p className="text-muted small mt-1 mb-0">
                  Fije una meta para visualizar el progreso en el Dashboard (0 para desactivar).
                </p>
              </div>

              <hr />
              <p className="text-muted small mb-0">
                No hay roles ni administrador: cada cuenta ve Ãºnicamente sus propias
                cuentas, categorÃ­as y movimientos.
              </p>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} lg={7}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="h5 mb-3">Cambiar contraseÃ±a</Card.Title>
              <Form onSubmit={cambiarContrasena} noValidate>
                <Row className="g-3">
                  <Col xs={12}>
                    <Form.Group controlId="mi-actual">
                      <Form.Label>ContraseÃ±a actual</Form.Label>
                      <Form.Control
                        type="password"
                        autoComplete="current-password"
                        value={actual}
                        required
                        isInvalid={Boolean(errores.actual)}
                        onChange={(evento) => {
                          setActual(evento.target.value);
                          limpiar('actual');
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errores.actual}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Group controlId="mi-nueva">
                      <Form.Label>Nueva contraseÃ±a</Form.Label>
                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        value={nueva}
                        required
                        minLength={8}
                        isInvalid={Boolean(errores.contrasena)}
                        onChange={(evento) => {
                          setNueva(evento.target.value);
                          limpiar('contrasena');
                        }}
                      />
                      <Form.Text>MÃ­nimo 8 caracteres.</Form.Text>
                      <Form.Control.Feedback type="invalid">
                        {errores.contrasena}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Group controlId="mi-confirmacion">
                      <Form.Label>Confirmar nueva contraseÃ±a</Form.Label>
                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        value={confirmacion}
                        required
                        isInvalid={Boolean(errores.confirmacion)}
                        onChange={(evento) => {
                          setConfirmacion(evento.target.value);
                          limpiar('confirmacion');
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errores.confirmacion}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
                <Button type="submit" className="mt-3" disabled={ocupado}>
                  {ocupado ? 'Guardandoâ€¦' : 'Cambiar contraseÃ±a'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-3">
        <Card.Body>
          <Card.Title className="h5 mb-1">Respaldo de datos</Card.Title>
          <p className="text-muted small mb-3">
            Exporte un JSON con todo su historial o restÃ¡urelo en este u otro navegador.
            La importaciÃ³n reemplaza los datos actuales de su cuenta.
          </p>

          <Row className="g-3">
            <Col xs={12} lg={5}>
              <div className="border rounded p-3 h-100">
                <h2 className="h6">Exportar</h2>
                <p className="text-muted small mb-2">
                  Incluye cuentas, categorÃ­as, movimientos, transferencias y preferencias.
                </p>
                <Button
                  variant="outline-primary"
                  size="sm"
                  disabled={ocupado}
                  onClick={() => void exportarRespaldo()}
                >
                  Descargar respaldo .json
                </Button>
              </div>
            </Col>

            <Col xs={12} lg={7}>
              <div className="border rounded p-3 h-100">
                <h2 className="h6">Importar</h2>
                <Form.Group controlId="mi-archivo" className="mb-2">
                  <Form.Label className="small text-muted mb-1">
                    Archivo de respaldo
                  </Form.Label>
                  <Form.Control
                    type="file"
                    accept="application/json,.json"
                    isInvalid={Boolean(errores.respaldo)}
                    onChange={(evento) => {
                      const seleccionado =
                        (evento.currentTarget as HTMLInputElement).files?.[0] ?? null;
                      setArchivo(seleccionado);
                      setConfirmarImportacion(false);
                      limpiar('respaldo');
                    }}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errores.respaldo}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Check
                  type="checkbox"
                  id="mi-confirmar-importacion"
                  className="mb-2"
                  checked={confirmarImportacion}
                  onChange={(evento) => setConfirmarImportacion(evento.target.checked)}
                  label="Entiendo que se reemplazarÃ¡n mis datos actuales"
                />
                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={ocupado || !archivo || !confirmarImportacion}
                  onClick={() => void importarRespaldo()}
                >
                  Importar respaldo
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3 border-warning">
        <Card.Body>
          <Card.Title className="h5 mb-1">Restablecer datos</Card.Title>
          <p className="text-muted small mb-3">
            Borra cuentas, movimientos y transferencias y vuelve a las 34 categorÃ­as base
            con una cuenta de efectivo en cero. La cuenta de usuario se conserva.
          </p>
          <Button
            variant="outline-warning"
            disabled={ocupado}
            onClick={() => void restablecerDatos()}
          >
            Restablecer mis datos financieros
          </Button>
        </Card.Body>
      </Card>

      <Card className="border-danger">
        <Card.Body>
          <Card.Title className="h5 mb-1 text-danger">Eliminar cuenta</Card.Title>
          <p className="text-muted small mb-3">
            Elimina el usuario y todos sus datos de este navegador. No se puede deshacer.
            Descargue un respaldo antes de continuar.
          </p>

          <Form onSubmit={eliminarCuenta} noValidate>
            <Row className="g-3 align-items-end">
              <Col xs={12} md={5}>
                <Form.Group controlId="mi-eliminar-contrasena">
                  <Form.Label>ContraseÃ±a</Form.Label>
                  <Form.Control
                    type="password"
                    autoComplete="current-password"
                    value={contrasenaEliminar}
                    required
                    isInvalid={Boolean(errores.contrasenaEliminar)}
                    onChange={(evento) => {
                      setContrasenaEliminar(evento.target.value);
                      limpiar('contrasenaEliminar');
                    }}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errores.contrasenaEliminar}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col xs={12} md={7}>
                <Form.Check
                  type="checkbox"
                  id="mi-confirmar-eliminar"
                  className="mb-2"
                  checked={confirmarEliminar}
                  onChange={(evento) => setConfirmarEliminar(evento.target.checked)}
                  label="Confirmo que deseo eliminar mi cuenta y todos mis datos"
                />
                <Button
                  type="submit"
                  variant="danger"
                  disabled={ocupado || !confirmarEliminar}
                >
                  Eliminar cuenta definitivamente
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <p className="text-muted small mt-3 mb-0">
        Los datos de esta demo viven en IndexedDB y no se envÃ­an a ningÃºn servidor.
      </p>
    </>
  );
}
