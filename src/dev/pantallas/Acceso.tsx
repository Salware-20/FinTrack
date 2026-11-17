import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
import type { Usuario } from '../../models';
import { finanzasService } from '../../services';
import { descargarTexto } from '../../utils/descargas';
import { formatearCodigoRecuperacion } from '../../utils/criptografia';
import { mensajeDeError, normalizarError } from '../../utils/errores';
import { useNotificaciones } from '../componentes/notificacionesContexto';
import { useErroresFormulario } from '../componentes/useErroresFormulario';

type Modo = 'login' | 'registro' | 'recuperacion' | 'codigo';
type OrigenCodigo = 'registro' | 'recuperacion';

interface Props {
  onEntrar: (usuario: Usuario) => void;
}

/**
 * Pantalla de acceso de la demo: registro abierto, login y recuperación por
 * código. No hay administrador ni roles.
 *
 * En el login nunca se marcan campos concretos: un toast genérico evita
 * revelar si el correo existe. En registro y recuperación sí se usa la
 * validación inline porque el usuario está corrigiendo sus propios datos.
 */
export function Acceso({ onEntrar }: Props) {
  const notificaciones = useNotificaciones();
  const { errores, limpiar, limpiarTodo, marcar, manejar } =
    useErroresFormulario();

  const [modo, setModo] = useState<Modo>('login');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [cargando, setCargando] = useState(false);

  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null);
  const [origenCodigo, setOrigenCodigo] = useState<OrigenCodigo>('registro');
  const [codigoGuardado, setCodigoGuardado] = useState(false);
  const [usuarioPendiente, setUsuarioPendiente] = useState<Usuario | null>(null);

  const limpiarFormularios = () => {
    setContrasena('');
    setConfirmacion('');
    setNuevaContrasena('');
    setCodigo('');
    limpiarTodo();
  };

  const cambiarModo = (nuevo: Modo) => {
    limpiarFormularios();
    setModo(nuevo);
  };

  const iniciarSesion = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarTodo();
    setCargando(true);

    try {
      const usuario = await finanzasService.iniciarSesion(correo, contrasena);
      onEntrar(usuario);
    } catch (fallo) {
      // Sin marcar campos: no se revela si el correo existe o la clave falló.
      notificaciones.error(normalizarError(fallo).mensaje);
    } finally {
      setCargando(false);
    }
  };

  const registrarse = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarTodo();

    if (contrasena !== confirmacion) {
      marcar('confirmacion', 'Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      const resultado = await finanzasService.registrar({
        nombre,
        correo,
        contrasena,
      });
      setCodigoGenerado(resultado.codigoRecuperacion);
      setOrigenCodigo('registro');
      setUsuarioPendiente(resultado.usuario);
      setCodigoGuardado(false);
      setModo('codigo');
    } catch (fallo) {
      manejar(fallo, ['nombre', 'correo', 'contrasena']);
    } finally {
      setCargando(false);
    }
  };

  const recuperar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarTodo();

    if (nuevaContrasena !== confirmacion) {
      marcar('confirmacion', 'Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      const resultado = await finanzasService.recuperarContrasena(
        correo,
        codigo,
        nuevaContrasena,
      );
      setCodigoGenerado(resultado.codigoRecuperacion);
      setOrigenCodigo('recuperacion');
      setCodigoGuardado(false);
      setUsuarioPendiente(null);
      setModo('codigo');
      notificaciones.exito(
        'Contraseña actualizada. Guarde el código nuevo: el anterior ya no funciona.',
      );
    } catch (fallo) {
      manejar(fallo, ['correo', 'codigo', 'contrasena']);
    } finally {
      setCargando(false);
    }
  };

  const copiarCodigo = async () => {
    if (!codigoGenerado) return;

    try {
      await navigator.clipboard.writeText(codigoGenerado);
      notificaciones.exito('Código copiado al portapapeles.');
    } catch {
      notificaciones.aviso(
        'No se pudo copiar. Seleccione el código y cópielo manualmente.',
      );
    }
  };

  const descargarCodigo = () => {
    if (!codigoGenerado) return;

    try {
      descargarTexto(
        'codigo-recuperacion.txt',
        [
          'FinTrack · Código de recuperación',
          '',
          `Correo: ${correo}`,
          `Código: ${codigoGenerado}`,
          '',
          'Guarde este código en un lugar seguro. Se muestra una sola vez.',
          'Sin él no es posible recuperar la contraseña.',
        ].join('\n'),
      );
      notificaciones.exito('Código descargado como archivo de texto.');
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    }
  };

  const continuarTrasCodigo = () => {
    if (origenCodigo === 'registro' && usuarioPendiente) {
      onEntrar(usuarioPendiente);
      return;
    }

    setCodigoGenerado(null);
    setUsuarioPendiente(null);
    setContrasena('');
    setConfirmacion('');
    setNuevaContrasena('');
    setCodigo('');
    setModo('login');
    notificaciones.info('Inicie sesión con su nueva contraseña.');
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} md={9} lg={6} xl={5}>
          <div className="text-center mb-4">
            <div className="fs-1">💸</div>
            <h1 className="h3 mb-1">FinTrack</h1>
            <p className="text-muted mb-0">
              Demo local · sus datos se quedan en este navegador
            </p>
          </div>

          <Card className="shadow-sm">
            <Card.Body className="p-4">
              {modo === 'login' && (
                <>
                  <Card.Title className="h5 mb-3">Iniciar sesión</Card.Title>
                  <Form onSubmit={iniciarSesion} noValidate>
                    <Form.Group className="mb-3" controlId="login-correo">
                      <Form.Label>Correo</Form.Label>
                      <Form.Control
                        type="email"
                        autoComplete="username"
                        value={correo}
                        required
                        onChange={(evento) => setCorreo(evento.target.value)}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="login-contrasena">
                      <Form.Label>Contraseña</Form.Label>
                      <Form.Control
                        type="password"
                        autoComplete="current-password"
                        value={contrasena}
                        required
                        onChange={(evento) => setContrasena(evento.target.value)}
                      />
                    </Form.Group>
                    <Button type="submit" className="w-100" disabled={cargando}>
                      {cargando ? 'Verificando…' : 'Entrar'}
                    </Button>
                  </Form>

                  <div className="d-flex flex-wrap justify-content-between gap-2 mt-3">
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0"
                      onClick={() => cambiarModo('registro')}
                    >
                      Crear una cuenta
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0"
                      onClick={() => cambiarModo('recuperacion')}
                    >
                      Olvidé mi contraseña
                    </Button>
                  </div>
                </>
              )}

              {modo === 'registro' && (
                <>
                  <Card.Title className="h5 mb-3">Crear cuenta</Card.Title>
                  <Form onSubmit={registrarse} noValidate>
                    <Form.Group className="mb-3" controlId="registro-nombre">
                      <Form.Label>Nombre completo</Form.Label>
                      <Form.Control
                        value={nombre}
                        required
                        isInvalid={Boolean(errores.nombre)}
                        onChange={(evento) => {
                          setNombre(evento.target.value);
                          limpiar('nombre');
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errores.nombre}
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="registro-correo">
                      <Form.Label>Correo</Form.Label>
                      <Form.Control
                        type="email"
                        autoComplete="username"
                        value={correo}
                        required
                        isInvalid={Boolean(errores.correo)}
                        onChange={(evento) => {
                          setCorreo(evento.target.value);
                          limpiar('correo');
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errores.correo}
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="registro-contrasena">
                      <Form.Label>Contraseña</Form.Label>
                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        value={contrasena}
                        required
                        minLength={8}
                        isInvalid={Boolean(errores.contrasena)}
                        onChange={(evento) => {
                          setContrasena(evento.target.value);
                          limpiar('contrasena');
                        }}
                      />
                      <Form.Text>Mínimo 8 caracteres.</Form.Text>
                      <Form.Control.Feedback type="invalid">
                        {errores.contrasena}
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="registro-confirmacion">
                      <Form.Label>Confirmar contraseña</Form.Label>
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
                    <Button type="submit" className="w-100" disabled={cargando}>
                      {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
                    </Button>
                  </Form>

                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 mt-3"
                    onClick={() => cambiarModo('login')}
                  >
                    Ya tengo cuenta
                  </Button>
                </>
              )}

              {modo === 'recuperacion' && (
                <>
                  <Card.Title className="h5 mb-3">Recuperar contraseña</Card.Title>
                  <Form onSubmit={recuperar} noValidate>
                    <Form.Group className="mb-3" controlId="recuperar-correo">
                      <Form.Label>Correo</Form.Label>
                      <Form.Control
                        type="email"
                        value={correo}
                        required
                        isInvalid={Boolean(errores.correo)}
                        onChange={(evento) => {
                          setCorreo(evento.target.value);
                          limpiar('correo');
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errores.correo}
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="recuperar-codigo">
                      <Form.Label>Código de recuperación</Form.Label>
                      <Form.Control
                        value={codigo}
                        required
                        placeholder="XXXX-XXXX-XXXX"
                        isInvalid={Boolean(errores.codigo)}
                        onChange={(evento) => {
                          setCodigo(evento.target.value);
                          limpiar('codigo');
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errores.codigo}
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="recuperar-nueva">
                      <Form.Label>Nueva contraseña</Form.Label>
                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        value={nuevaContrasena}
                        required
                        minLength={8}
                        isInvalid={Boolean(errores.contrasena)}
                        onChange={(evento) => {
                          setNuevaContrasena(evento.target.value);
                          limpiar('contrasena');
                        }}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errores.contrasena}
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="recuperar-confirmacion">
                      <Form.Label>Confirmar nueva contraseña</Form.Label>
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
                    <Button type="submit" className="w-100" disabled={cargando}>
                      {cargando ? 'Verificando…' : 'Recuperar acceso'}
                    </Button>
                  </Form>

                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 mt-3"
                    onClick={() => cambiarModo('login')}
                  >
                    Volver a iniciar sesión
                  </Button>
                </>
              )}

              {modo === 'codigo' && codigoGenerado && (
                <>
                  <Card.Title className="h5 mb-3">
                    Guarde su código de recuperación
                  </Card.Title>
                  <Alert variant="warning">
                    Este código se muestra una sola vez. Sin él no se puede
                    recuperar la contraseña.
                  </Alert>

                  <div className="bg-light border rounded p-3 text-center mb-3">
                    <div className="text-muted small mb-1">Código</div>
                    <div className="fs-4 fw-semibold font-monospace">
                      {formatearCodigoRecuperacion(codigoGenerado)}
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <Button variant="outline-primary" size="sm" onClick={() => void copiarCodigo()}>
                      Copiar
                    </Button>
                    <Button variant="outline-secondary" size="sm" onClick={descargarCodigo}>
                      Descargar .txt
                    </Button>
                  </div>

                  <Form.Check
                    type="checkbox"
                    id="codigo-guardado"
                    className="mb-3"
                    checked={codigoGuardado}
                    onChange={(evento) => setCodigoGuardado(evento.target.checked)}
                    label="Ya guardé mi código en un lugar seguro"
                  />

                  <Button
                    className="w-100"
                    disabled={!codigoGuardado}
                    onClick={continuarTrasCodigo}
                  >
                    {origenCodigo === 'registro'
                      ? 'Entrar a mi dashboard'
                      : 'Ir a iniciar sesión'}
                  </Button>
                </>
              )}
            </Card.Body>
          </Card>

          <p className="text-center text-muted small mt-4 mb-0">
            <Badge bg="secondary" className="me-2">
              Offline
            </Badge>
            IndexedDB · sin servidores · sin internet
          </p>
        </Col>
      </Row>
    </Container>
  );
}
