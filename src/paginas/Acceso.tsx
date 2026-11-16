import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'
import type { Usuario } from '../models'
import { finanzasService } from '../services'
import { formatearCodigoRecuperacion } from '../utils/criptografia'
import { descargarTexto } from '../utils/descargas'

type Modo = 'entrar' | 'crear' | 'codigo'

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

  const cambiarModo = (nuevo: Modo) => {
    setError(null)
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

  const descargar = () =>
    descargarTexto(
      'fintrack-codigo-recuperacion.txt',
      `Código de recuperación de FinTrack\n${correo}\n\n${formatearCodigoRecuperacion(codigo)}\n`,
    )

  return (
    <main className="ft-acceso">
      <section className="ft-acceso-lado">
        <div className="ft-marca p-0">
          <i className="bi bi-wallet2" aria-hidden="true" />
          FinTrack
        </div>
        <div>
          <h1>Sus ingresos y gastos, en un solo libro.</h1>
          <p>
            Todo se guarda en este navegador. No necesita internet ni
            enviar datos a ningún servidor.
          </p>
        </div>
        <small>Hecho en Costa Rica, en colones.</small>
      </section>

      <section className="ft-acceso-formulario">
        {modo === 'codigo' ? (
          <>
            <h2 className="h4 mb-2">Guarde su código de recuperación</h2>
            <p className="text-secondary">
              Es la única forma de recuperar su contraseña y no se vuelve a
              mostrar.
            </p>
            <div className="ft-codigo mb-3">{formatearCodigoRecuperacion(codigo)}</div>
            <div className="d-flex gap-2 mb-4">
              <Button variant="outline-primary" onClick={() => void navigator.clipboard?.writeText(codigo)}>
                <i className="bi bi-clipboard me-1" aria-hidden="true" />
                Copiar
              </Button>
              <Button variant="outline-primary" onClick={descargar}>
                <i className="bi bi-download me-1" aria-hidden="true" />
                Descargar
              </Button>
            </div>
            <Button className="w-100" onClick={() => pendiente && onEntrar(pendiente)}>
              Ya lo guardé, entrar
            </Button>
          </>
        ) : (
          <>
            <h2 className="h4 mb-4">
              {modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h2>

            {error && (
              <Alert variant="danger" className="py-2" role="alert">
                {error}
              </Alert>
            )}

            <Form onSubmit={(e) => void (modo === 'entrar' ? entrar(e) : crear(e))}>
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
                <Form.Label>Correo</Form.Label>
                <Form.Control
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="acc-contrasena">
                <Form.Label>Contraseña</Form.Label>
                <Form.Control
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  required
                />
                {modo === 'crear' && <Form.Text>Mínimo 8 caracteres.</Form.Text>}
              </Form.Group>
              {modo === 'crear' && (
                <Form.Group className="mb-3" controlId="acc-confirmacion">
                  <Form.Label>Repita la contraseña</Form.Label>
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
                {cargando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
              </Button>
            </Form>

            <p className="mt-4 mb-0 text-secondary">
              {modo === 'entrar' ? '¿Aún no tiene cuenta? ' : '¿Ya tiene cuenta? '}
              <Button
                variant="link"
                className="p-0 align-baseline"
                onClick={() => cambiarModo(modo === 'entrar' ? 'crear' : 'entrar')}
              >
                {modo === 'entrar' ? 'Crear una' : 'Iniciar sesión'}
              </Button>
            </p>
          </>
        )}
      </section>
    </main>
  )
}
