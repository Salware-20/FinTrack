import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'
import type { Usuario } from '../models'
import { finanzasService } from '../services'
import { formatearCodigoRecuperacion } from '../utils/criptografia'
import { descargarTexto } from '../utils/descargas'
import { Marca } from '../componentes/Marca'

type Modo = 'entrar' | 'crear' | 'recuperar' | 'codigo'

interface Props {
  onEntrar: (usuario: Usuario) => void
}

function mensaje(fallo: unknown): string {
  return fallo instanceof Error && fallo.message
    ? fallo.message
    : 'Ocurrió un error inesperado.'
}

export function Acceso({ onEntrar }: Props) {
  const [modo, setModo] = useState<Modo>('entrar')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [pendiente, setPendiente] = useState<Usuario | null>(null)
  const [codigoUsado, setCodigoUsado] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [nota, setNota] = useState<string | null>(null)

  const cambiarModo = (nuevo: Modo) => {
    setError(null)
    setNota(null)
    setContrasena('')
    setConfirmacion('')
    setModo(nuevo)
  }

  const entrar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    setCargando(true)
    try {
      onEntrar(await finanzasService.iniciarSesion(correo, contrasena))
    } catch (fallo) {
      setError(mensaje(fallo))
    } finally {
      setCargando(false)
    }
  }

  const crear = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    if (contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setCargando(true)
    try {
      const resultado = await finanzasService.registrar({ nombre, correo, contrasena })
      setCodigo(resultado.codigoRecuperacion)
      setPendiente(resultado.usuario)
      setModo('codigo')
    } catch (fallo) {
      setError(mensaje(fallo))
    } finally {
      setCargando(false)
    }
  }

  const recuperar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    if (contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setCargando(true)
    try {
      const resultado = await finanzasService.recuperarContrasena(correo, codigoUsado, contrasena)
      setCodigo(resultado.codigoRecuperacion)
      setCodigoUsado('')
      setPendiente(null)
      setCopiado(false)
      setModo('codigo')
    } catch (fallo) {
      setError(mensaje(fallo))
    } finally {
      setCargando(false)
    }
  }

  const terminarCodigo = () => {
    if (pendiente) {
      onEntrar(pendiente)
      return
    }
    // Después de recuperar la contraseña se vuelve a iniciar sesión con la nueva
    cambiarModo('entrar')
    setCodigo('')
    setNota('La contraseña se actualizó correctamente. Inicie sesión con la nueva contraseña.')
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(formatearCodigoRecuperacion(codigo))
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  const descargar = () =>
    descargarTexto(
      'fintrack-codigo-recuperacion.txt',
      `Código de recuperación de FinTrack\n${correo}\n\n${formatearCodigoRecuperacion(codigo)}\n`,
    )

  return (
    <main className="ft-acceso">
      <section className="ft-acceso-lado">
        <Marca className="p-0" />
        <div>
          <h1>Gestión de finanzas personales</h1>
          <p>
            La información se almacena localmente en este navegador. El sistema no requiere
            conexión a internet ni envía datos a servidores externos.
          </p>
        </div>
      </section>

      <section className="ft-acceso-formulario">
        {modo === 'codigo' ? (
          <>
            <h2 className="h4 mb-2">
              {pendiente ? 'Código de recuperación' : 'Nuevo código de recuperación'}
            </h2>
            <p className="text-secondary">
              {pendiente
                ? 'Este código es el único medio para restablecer la contraseña. Consérvelo en un lugar seguro; no se mostrará nuevamente.'
                : 'El código anterior quedó invalidado. Conserve este nuevo código en un lugar seguro; no se mostrará nuevamente.'}
            </p>
            <div className="ft-codigo mb-3">{formatearCodigoRecuperacion(codigo)}</div>
            <div className="d-flex gap-2 mb-4">
              <Button variant="outline-primary" onClick={() => void copiar()}>
                <i className={`bi ${copiado ? 'bi-check2' : 'bi-clipboard'} me-1`} aria-hidden="true" />
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
              <Button variant="outline-primary" onClick={descargar}>
                <i className="bi bi-download me-1" aria-hidden="true" />
                Descargar
              </Button>
            </div>
            <Button className="w-100" onClick={terminarCodigo}>
              {pendiente ? 'Continuar' : 'Ir al inicio de sesión'}
            </Button>
          </>
        ) : (
          <>
            <h2 className="h4 mb-2">
              {modo === 'entrar' ? 'Iniciar sesión' : modo === 'crear' ? 'Crear cuenta' : 'Recuperar contraseña'}
            </h2>
            <p className="text-secondary mb-4">
              {modo === 'recuperar'
                ? 'Ingrese el código de recuperación generado al registrar la cuenta.'
                : modo === 'entrar'
                  ? 'Ingrese su correo electrónico y su contraseña.'
                  : 'Complete los datos para registrar una cuenta nueva.'}
            </p>

            {nota && (
              <Alert variant="success" className="py-2" role="status">
                {nota}
              </Alert>
            )}

            {error && (
              <Alert variant="danger" className="py-2" role="alert">
                {error}
              </Alert>
            )}

            <Form onSubmit={(e) => void (modo === 'entrar' ? entrar(e) : modo === 'crear' ? crear(e) : recuperar(e))}>
              {modo === 'crear' && (
                <Form.Group className="mb-3" controlId="acc-nombre">
                  <Form.Label>Nombre completo</Form.Label>
                  <Form.Control
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </Form.Group>
              )}
              <Form.Group className="mb-3" controlId="acc-correo">
                <Form.Label>Correo electrónico</Form.Label>
                <Form.Control
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Form.Group>
              {modo === 'recuperar' && (
                <Form.Group className="mb-3" controlId="acc-codigo">
                  <Form.Label>Código de recuperación</Form.Label>
                  <Form.Control
                    value={codigoUsado}
                    onChange={(e) => setCodigoUsado(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX"
                    autoComplete="one-time-code"
                    className="ft-campo-codigo"
                    spellCheck={false}
                    required
                  />
                </Form.Group>
              )}
              <Form.Group className="mb-3" controlId="acc-contrasena">
                <div className="d-flex justify-content-between align-items-baseline">
                  <Form.Label>{modo === 'recuperar' ? 'Contraseña nueva' : 'Contraseña'}</Form.Label>
                  {modo === 'entrar' && (
                    <Button variant="link" size="sm" className="p-0 mb-1" onClick={() => cambiarModo('recuperar')}>
                      Recuperar contraseña
                    </Button>
                  )}
                </div>
                <Form.Control
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  required
                />
                {modo !== 'entrar' && <Form.Text>Mínimo 8 caracteres.</Form.Text>}
              </Form.Group>
              {modo !== 'entrar' && (
                <Form.Group className="mb-3" controlId="acc-confirmacion">
                  <Form.Label>Confirmar contraseña</Form.Label>
                  <Form.Control
                    type="password"
                    value={confirmacion}
                    onChange={(e) => setConfirmacion(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </Form.Group>
              )}
              <Button type="submit" className="w-100 mt-2" disabled={cargando}>
                {cargando
                  ? 'Un momento…'
                  : modo === 'entrar'
                    ? 'Iniciar sesión'
                    : modo === 'crear'
                      ? 'Crear cuenta'
                      : 'Cambiar contraseña'}
              </Button>
            </Form>

            <p className="mt-4 mb-0 text-secondary">
              {modo === 'entrar' ? '¿No posee una cuenta? ' : modo === 'crear' ? '¿Ya posee una cuenta? ' : 'Volver al '}
              <Button
                variant="link"
                className="p-0 align-baseline"
                onClick={() => cambiarModo(modo === 'entrar' ? 'crear' : 'entrar')}
              >
                {modo === 'entrar' ? 'Registrarse' : modo === 'crear' ? 'Iniciar sesión' : 'inicio de sesión'}
              </Button>
            </p>
          </>
        )}
      </section>
    </main>
  )
}
