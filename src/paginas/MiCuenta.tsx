import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import type { Usuario } from '../models'
import { finanzasService } from '../services'
import type { RespaldoFinanzas } from '../services'
import { Avisos } from '../componentes/Avisos'
import { Encabezado } from '../componentes/Encabezado'
import { useAvisos } from '../componentes/useAvisos'
import { descargarTexto, leerArchivoTexto, nombreConFecha } from '../utils/descargas'

interface Props {
  usuario: Usuario
  onCuentaEliminada: () => void
}

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleString('es-CR', { dateStyle: 'long', timeStyle: 'short' })

export function MiCuenta({ usuario, onCuentaEliminada }: Props) {
  const { error, aviso, fallo, mostrarError, exito, limpiar } = useAvisos()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [confirmaImportar, setConfirmaImportar] = useState(false)
  const [contrasenaEliminar, setContrasenaEliminar] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const cambiarContrasena = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (nueva !== confirmacion) {
      mostrarError('Las contraseñas nuevas no coinciden.')
      return
    }
    try {
      await finanzasService.cambiarContrasena(actual, nueva)
      exito('Contraseña actualizada.')
      setActual('')
      setNueva('')
      setConfirmacion('')
    } catch (causa) {
      fallo(causa)
    }
  }

  const exportar = async () => {
    setOcupado(true)
    try {
      const respaldo = await finanzasService.exportarRespaldo()
      descargarTexto(nombreConFecha('respaldo-fintrack', 'json'), JSON.stringify(respaldo, null, 2), 'application/json;charset=utf-8')
      exito('Respaldo descargado. Guárdelo fuera de este equipo.')
    } catch (causa) {
      fallo(causa)
    } finally {
      setOcupado(false)
    }
  }

  const importar = async () => {
    if (!archivo) {
      mostrarError('Seleccione un archivo de respaldo.')
      return
    }
    if (!confirmaImportar) {
      mostrarError('Confirme que desea reemplazar sus datos actuales.')
      return
    }
    setOcupado(true)
    try {
      const respaldo = JSON.parse(await leerArchivoTexto(archivo)) as RespaldoFinanzas
      await finanzasService.importarRespaldo(respaldo)
      setArchivo(null)
      setConfirmaImportar(false)
      exito('Respaldo importado. Sus datos anteriores fueron reemplazados.')
    } catch (causa) {
      fallo(causa)
    } finally {
      setOcupado(false)
    }
  }

  const restablecer = async () => {
    if (!window.confirm('Se borrarán todos sus movimientos y se restaurarán las categorías base. ¿Continuar?')) return
    try {
      await finanzasService.resetearDatos()
      exito('Datos restablecidos.')
    } catch (causa) {
      fallo(causa)
    }
  }

  const eliminarCuenta = async () => {
    if (!contrasenaEliminar) {
      mostrarError('Escriba su contraseña para eliminar la cuenta.')
      return
    }
    if (!window.confirm('Se eliminará su cuenta y todos sus datos. Esto no se puede deshacer. ¿Continuar?')) return
    try {
      await finanzasService.eliminarCuenta(contrasenaEliminar)
      onCuentaEliminada()
    } catch (causa) {
      fallo(causa)
    }
  }

  return (
    <>
      <Encabezado titulo="Mi cuenta" subtitulo="Su perfil, su contraseña y sus datos." />
      <Avisos error={error} aviso={aviso} onCerrar={limpiar} />

      <section className="ft-bloque" aria-labelledby="t-perfil">
        <h2 id="t-perfil" className="ft-seccion-titulo">Perfil</h2>
        <dl className="ft-datos">
          <dt>Nombre</dt>
          <dd>{usuario.nombre}</dd>
          <dt>Correo</dt>
          <dd>{usuario.correo}</dd>
          <dt>Cuenta creada</dt>
          <dd>{fechaLarga(usuario.creadoEn)}</dd>
          <dt>Último acceso</dt>
          <dd>{fechaLarga(usuario.ultimoAcceso)}</dd>
        </dl>
      </section>

      <section className="ft-bloque" aria-labelledby="t-clave">
        <h2 id="t-clave" className="ft-seccion-titulo">Cambiar contraseña</h2>
        <Form onSubmit={(e) => void cambiarContrasena(e)}>
          <Form.Group className="mb-3" controlId="mc-actual">
            <Form.Label>Contraseña actual</Form.Label>
            <Form.Control type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
          </Form.Group>
          <Form.Group className="mb-3" controlId="mc-nueva">
            <Form.Label>Contraseña nueva</Form.Label>
            <Form.Control type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} required />
            <Form.Text>Mínimo 8 caracteres.</Form.Text>
          </Form.Group>
          <Form.Group className="mb-3" controlId="mc-confirmacion">
            <Form.Label>Repita la contraseña nueva</Form.Label>
            <Form.Control type="password" autoComplete="new-password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} required />
          </Form.Group>
          <Button type="submit">Guardar contraseña</Button>
        </Form>
      </section>

      <section className="ft-bloque" aria-labelledby="t-respaldo">
        <h2 id="t-respaldo" className="ft-seccion-titulo">Respaldo</h2>
        <p className="text-secondary">
          Sus datos viven solo en este navegador. Descargue un respaldo de vez en cuando para no perderlos.
        </p>
        <Button variant="outline-primary" onClick={() => void exportar()} disabled={ocupado}>
          <i className="bi bi-download me-1" aria-hidden="true" />
          Descargar respaldo
        </Button>

        <hr />
        <Form.Group className="mb-2" controlId="mc-archivo">
          <Form.Label>Restaurar desde un respaldo</Form.Label>
          <Form.Control type="file" accept="application/json,.json" onChange={(e) => setArchivo((e.target as HTMLInputElement).files?.[0] ?? null)} />
        </Form.Group>
        <Form.Check
          id="mc-confirma-importar"
          className="mb-3"
          type="checkbox"
          label="Entiendo que esto reemplaza mis datos actuales"
          checked={confirmaImportar}
          onChange={(e) => setConfirmaImportar(e.target.checked)}
        />
        <Button variant="outline-primary" onClick={() => void importar()} disabled={ocupado}>
          Restaurar respaldo
        </Button>
      </section>

      <section className="ft-bloque" aria-labelledby="t-peligro">
        <h2 id="t-peligro" className="ft-seccion-titulo">Borrar datos</h2>
        <p className="text-secondary">Estas acciones no se pueden deshacer.</p>
        <Button variant="outline-danger" onClick={() => void restablecer()}>
          Restablecer mis datos
        </Button>

        <hr />
        <Form.Group className="mb-3" controlId="mc-eliminar">
          <Form.Label>Para eliminar la cuenta, escriba su contraseña</Form.Label>
          <Form.Control type="password" autoComplete="current-password" value={contrasenaEliminar} onChange={(e) => setContrasenaEliminar(e.target.value)} />
        </Form.Group>
        <Button variant="danger" onClick={() => void eliminarCuenta()}>
          Eliminar mi cuenta
        </Button>
      </section>
    </>
  )
}
