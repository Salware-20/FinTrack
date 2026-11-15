import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import type { Usuario } from '../../models';
import type { ConfiguracionUsuario } from '../../models/tipos';
import { finanzasService } from '../../services';
import type { RespaldoFinanzas } from '../../services';
import { descargarTexto, leerArchivoTexto, nombreConFecha } from '../../utils/descargas';
import { AlertaError } from '../componentes/Estado';
import { mensajeDeError } from '../componentes/mensajes';

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
 * Pantalla "Mi cuenta" de la demo: perfil, contraseña, respaldo local,
 * restablecimiento de datos y eliminación de la cuenta.
 */
export function MiCuenta({ usuario, onSalir }: Props) {
  const [configuracion, setConfiguracion] = useState<ConfiguracionUsuario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
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
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        setError(mensajeDeError(fallo));
      });

    return () => {
      activo = false;
    };
  }, []);

  const cambiarContrasena = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    setAviso(null);

    if (nueva !== confirmacion) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setOcupado(true);
    try {
      await finanzasService.cambiarContrasena(actual, nueva);
      setActual('');
      setNueva('');
      setConfirmacion('');
      setAviso('Contraseña actualizada.');
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setOcupado(false);
    }
  };

  const exportarRespaldo = async () => {
    setError(null);
    setAviso(null);
    setOcupado(true);

    try {
      const respaldo = await finanzasService.exportarRespaldo();
      descargarTexto(
        nombreConFecha('respaldo-fintrack', 'json'),
        JSON.stringify(respaldo, null, 2),
        'application/json;charset=utf-8',
      );
      setAviso('Respaldo descargado. Guárdelo fuera de este equipo.');
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setOcupado(false);
    }
  };

  const importarRespaldo = async () => {
    setError(null);
    setAviso(null);

    if (!archivo) {
      setError('Seleccione un archivo de respaldo.');
      return;
    }
    if (!confirmarImportacion) {
      setError('Confirme que desea reemplazar sus datos actuales.');
      return;
    }

    setOcupado(true);
    try {
      const contenido = await leerArchivoTexto(archivo);
      const respaldo = JSON.parse(contenido) as RespaldoFinanzas;
      await finanzasService.importarRespaldo(respaldo);
      setArchivo(null);
      setConfirmarImportacion(false);
      setAviso('Respaldo importado. Sus datos actuales fueron reemplazados.');
    } catch (fallo) {
      setError(
        fallo instanceof SyntaxError
          ? 'El archivo no es un JSON válido.'
          : mensajeDeError(fallo),
      );
    } finally {
      setOcupado(false);
    }
  };

  const restablecerDatos = async () => {
    const confirmado = window.confirm(
      'Se eliminarán todas sus cuentas, movimientos y transferencias, y se restaurarán las categorías base. ¿Continuar?',
    );
    if (!confirmado) return;

    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      await finanzasService.resetearDatos();
      setAviso('Datos restablecidos: categorías base y cuenta de efectivo.');
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setOcupado(false);
    }
  };

  const eliminarCuenta = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError(null);
    setAviso(null);

    if (!confirmarEliminar) {
      setError('Marque la casilla para confirmar la eliminación.');
      return;
    }

    setOcupado(true);
    try {
      await finanzasService.eliminarCuenta(contrasenaEliminar);
      onSalir();
    } catch (fallo) {
      setError(mensajeDeError(fallo));
      setOcupado(false);
    }
  };

  const cerrarSesion = async () => {
    setOcupado(true);
    try {
      await finanzasService.cerrarSesion();
      onSalir();
    } catch (fallo) {
      setError(mensajeDeError(fallo));
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
          Cerrar sesión
        </Button>
      </div>

      <AlertaError mensaje={error} onCerrar={() => setError(null)} />
      {aviso && (
        <Alert variant="success" dismissible onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}

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
                <dt className="col-5 text-muted fw-normal">Último acceso</dt>
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
              <p className="text-muted small mb-0">
                No hay roles ni administrador: cada cuenta ve únicamente sus propias
                cuentas, categorías y movimientos.
              </p>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} lg={7}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="h5 mb-3">Cambiar contraseña</Card.Title>
              <Form onSubmit={cambiarContrasena}>
                <Row className="g-3">
                  <Col xs={12}>
                    <Form.Group controlId="mi-actual">
                      <Form.Label>Contraseña actual</Form.Label>
                      <Form.Control
                        type="password"
                        autoComplete="current-password"
                        value={actual}
                        required
                        onChange={(evento) => setActual(evento.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Group controlId="mi-nueva">
                      <Form.Label>Nueva contraseña</Form.Label>
                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        value={nueva}
                        required
                        minLength={8}
                        onChange={(evento) => setNueva(evento.target.value)}
                      />
                      <Form.Text>Mínimo 8 caracteres.</Form.Text>
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Group controlId="mi-confirmacion">
                      <Form.Label>Confirmar nueva contraseña</Form.Label>
                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        value={confirmacion}
                        required
                        onChange={(evento) => setConfirmacion(evento.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Button type="submit" className="mt-3" disabled={ocupado}>
                  {ocupado ? 'Guardando…' : 'Cambiar contraseña'}
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
            Exporte un JSON con todo su historial o restáurelo en este u otro navegador.
            La importación reemplaza los datos actuales de su cuenta.
          </p>

          <Row className="g-3">
            <Col xs={12} lg={5}>
              <div className="border rounded p-3 h-100">
                <h2 className="h6">Exportar</h2>
                <p className="text-muted small mb-2">
                  Incluye cuentas, categorías, movimientos, transferencias y preferencias.
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
                    onChange={(evento) => {
                      const seleccionado =
                        (evento.currentTarget as HTMLInputElement).files?.[0] ?? null;
                      setArchivo(seleccionado);
                      setConfirmarImportacion(false);
                    }}
                  />
                </Form.Group>
                <Form.Check
                  type="checkbox"
                  id="mi-confirmar-importacion"
                  className="mb-2"
                  checked={confirmarImportacion}
                  onChange={(evento) => setConfirmarImportacion(evento.target.checked)}
                  label="Entiendo que se reemplazarán mis datos actuales"
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
            Borra cuentas, movimientos y transferencias y vuelve a las 34 categorías base
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

          <Form onSubmit={eliminarCuenta}>
            <Row className="g-3 align-items-end">
              <Col xs={12} md={5}>
                <Form.Group controlId="mi-eliminar-contrasena">
                  <Form.Label>Contraseña</Form.Label>
                  <Form.Control
                    type="password"
                    autoComplete="current-password"
                    value={contrasenaEliminar}
                    required
                    onChange={(evento) => setContrasenaEliminar(evento.target.value)}
                  />
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
        Los datos de esta demo viven en IndexedDB y no se envían a ningún servidor.
      </p>
    </>
  );
}
