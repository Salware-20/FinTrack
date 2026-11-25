import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import type { Usuario } from '../models'
import { finanzasService } from '../services'
import type { RespaldoFinanzas } from '../services'
import { Avisos } from '../componentes/Avisos'
import { Confirmar } from '../componentes/Confirmar'
import type { PeticionConfirmar } from '../componentes/Confirmar'
import { Encabezado } from '../componentes/Encabezado'
import { useAvisos } from '../componentes/useAvisos'
import { descargarTexto, leerArchivoTexto, nombreConFecha } from '../utils/descargas'
import { formatearMoneda } from '../utils/formato'

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
  const [confirmar, setConfirmar] = useState<PeticionConfirmar | null>(null)
  const [meta, setMeta] = useState('')
  const [metaGuardada, setMetaGuardada] = useState(0)

  useEffect(() => {
    let activo = true
    finanzasService
      .obtenerConfiguracion()
      .then((config) => {
        if (!activo) return
        const valor = config.metaAhorroMensual ?? 0
        setMetaGuardada(valor)
        setMeta(valor > 0 ? String(valor) : '')
      })
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [])

  const guardarMeta = async (valor: number) => {
    if (!Number.isFinite(valor) || valor < 0) {
      mostrarError('La meta debe ser un monto igual o mayor que cero.')
      return
    }
    try {
      const config = await finanzasService.actualizarConfiguracion({ metaAhorroMensual: valor })
      const guardado = config.metaAhorroMensual ?? 0
      setMetaGuardada(guardado)
      setMeta(guardado > 0 ? String(guardado) : '')
      exito(guardado > 0 ? `Meta de ahorro establecida en ${formatearMoneda(guardado)} mensuales. El avance se muestra en el Resumen.` : 'Meta de ahorro eliminada.')
    } catch (causa) {
      fallo(causa)
    }
  }

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
      exito('Respaldo descargado. Se recomienda almacenarlo fuera de este equipo.')
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

  const restablecer = () =>
    setConfirmar({
      titulo: 'Restablecer mis datos',
      mensaje: (
        <p className="mb-0">
          Se eliminarán todos los movimientos y reglas recurrentes, y se restaurarán las categorías base.
          El usuario y la contraseña se conservan.
        </p>
      ),
      accion: 'Restablecer',
      peligro: true,
      alAceptar: async () => {
        try {
          await finanzasService.resetearDatos()
          exito('Datos restablecidos.')
        } catch (causa) {
          fallo(causa)
        }
      },
    })

  const eliminarCuenta = async () => {
    if (!contrasenaEliminar) {
      mostrarError('Ingrese su contraseña para eliminar la cuenta.')
      return
    }
    setConfirmar({
      titulo: 'Eliminar mi cuenta',
      mensaje: <p className="mb-0">Se eliminarán la cuenta y todos sus datos de este navegador. Esta acción es irreversible.</p>,
      accion: 'Eliminar definitivamente',
      peligro: true,
      alAceptar: async () => {
        try {
          await finanzasService.eliminarCuenta(contrasenaEliminar)
          onCuentaEliminada()
        } catch (causa) {
          fallo(causa)
        }
      },
    })
  }

  return (
    <>
      <Encabezado titulo="Mi cuenta" subtitulo="Perfil, seguridad y administración de datos." />
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

      <section className="ft-bloque" aria-labelledby="t-meta">
        <h2 id="t-meta" className="ft-seccion-titulo">Meta de ahorro mensual</h2>
        <p className="text-secondary">
          Monto que se desea reservar al cierre de cada mes. El avance se muestra en el Resumen.
        </p>
        <Form className="ft-fila-formulario" onSubmit={(e) => {
          e.preventDefault()
          void guardarMeta(Number(meta.replace(',', '.') || '0'))
        }}>
          <Form.Group controlId="mc-meta" className="flex-grow-1">
            <Form.Label>Monto por mes (₡)</Form.Label>
            <Form.Control inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Ejemplo: 100000" />
          </Form.Group>
          <Button type="submit">Guardar meta</Button>
          {metaGuardada > 0 && (
            <Button variant="link" className="text-danger" onClick={() => void guardarMeta(0)}>
              Eliminar meta
            </Button>
          )}
        </Form>
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
            <Form.Label>Confirmar contraseña nueva</Form.Label>
            <Form.Control type="password" autoComplete="new-password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} required />
          </Form.Group>
          <Button type="submit">Guardar contraseña</Button>
        </Form>
      </section>

      <section className="ft-bloque" aria-labelledby="t-respaldo">
        <h2 id="t-respaldo" className="ft-seccion-titulo">Respaldo</h2>
        <p className="text-secondary">
          Los datos se almacenan únicamente en este navegador. Se recomienda descargar un respaldo de forma periódica.
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
          label="Confirmo que esta acción reemplaza los datos actuales"
          checked={confirmaImportar}
          onChange={(e) => setConfirmaImportar(e.target.checked)}
        />
        <Button variant="outline-primary" onClick={() => void importar()} disabled={ocupado}>
          Restaurar respaldo
        </Button>
      </section>

      <section className="ft-bloque" aria-labelledby="t-peligro">
        <h2 id="t-peligro" className="ft-seccion-titulo">Borrar datos</h2>
        <p className="text-secondary">Estas acciones son irreversibles.</p>
        <Button variant="outline-danger" onClick={restablecer}>
          Restablecer mis datos
        </Button>

        <hr />
        <Form.Group className="mb-3" controlId="mc-eliminar">
          <Form.Label>Para eliminar la cuenta, ingrese su contraseña</Form.Label>
          <Form.Control type="password" autoComplete="current-password" value={contrasenaEliminar} onChange={(e) => setContrasenaEliminar(e.target.value)} />
        </Form.Group>
        <Button variant="danger" onClick={() => void eliminarCuenta()}>
          Eliminar mi cuenta
        </Button>
      </section>

      <Confirmar peticion={confirmar} onCerrar={() => setConfirmar(null)} />
    </>
  )
}
