import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import type { Cuenta, SaldoCuenta } from '../models'
import { TIPOS_CUENTA, TipoCuenta } from '../models'
import { finanzasService } from '../services'
import { ICONO_CUENTA } from '../componentes/ayudas'
import { Avisos } from '../componentes/Avisos'
import { Encabezado } from '../componentes/Encabezado'
import { porNumero, porTexto } from '../componentes/orden'
import { SelectorOrden } from '../componentes/SelectorOrden'
import { ThOrdenable } from '../componentes/ThOrdenable'
import { useAvisos } from '../componentes/useAvisos'
import { useOrden } from '../componentes/useOrden'
import { fechaHoy, formatearMoneda, formatearTipoCuenta } from '../utils/formato'
import { sumarMontos } from '../utils/numeros'

function IconoCuenta({ cuenta }: { cuenta: Cuenta }) {
  return cuenta.icono ? (
    <span className="ft-emoji" aria-hidden="true">{cuenta.icono}</span>
  ) : (
    <i className={`bi ${ICONO_CUENTA[cuenta.tipo] ?? 'bi-wallet'} ft-emoji`} aria-hidden="true" />
  )
}

export function Cuentas() {
  const { error, aviso, fallo, mostrarError, exito, limpiar } = useAvisos()
  const [version, setVersion] = useState(0)
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [saldos, setSaldos] = useState<SaldoCuenta[]>([])
  const [cargando, setCargando] = useState(true)
  const formularioRef = useRef<HTMLElement>(null)

  const [editando, setEditando] = useState<Cuenta | null>(null)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoCuenta>(TipoCuenta.Banco)
  const [saldoInicial, setSaldoInicial] = useState('0')
  const [institucion, setInstitucion] = useState('')

  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [montoTransferencia, setMontoTransferencia] = useState('')
  const [fechaTransferencia, setFechaTransferencia] = useState(fechaHoy())
  const [notaTransferencia, setNotaTransferencia] = useState('')

  const recargar = () => setVersion((v) => v + 1)

  useEffect(() => {
    let activo = true
    Promise.all([finanzasService.listarCuentas(), finanzasService.obtenerSaldos()])
      .then(([cta, sal]) => {
        if (!activo) return
        setCuentas(cta)
        setSaldos(sal)
        setCargando(false)
      })
      .catch((causa: unknown) => {
        if (!activo) return
        fallo(causa)
        setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [version, fallo])

  const saldoDe = (cuenta: Cuenta) => saldos.find((s) => s.cuentaId === cuenta.id)?.saldo ?? cuenta.saldoInicial

  const tabla = useOrden(cuentas, {
    cuenta: porTexto<Cuenta>((c) => c.nombre),
    tipo: porTexto<Cuenta>((c) => formatearTipoCuenta(c.tipo)),
    inicial: porNumero<Cuenta>((c) => c.saldoInicial),
    saldo: porNumero<Cuenta>((c) => saldoDe(c)),
  })

  const activas = cuentas.filter((c) => c.activa)
  const origenEfectivo = origen || activas[0]?.id || ''
  const destinoEfectivo = destino || activas.find((c) => c.id !== origenEfectivo)?.id || ''
  const patrimonio = sumarMontos(saldos.filter((s) => s.activa).map((s) => s.saldo))

  const limpiarFormulario = () => {
    setEditando(null)
    setNombre('')
    setTipo(TipoCuenta.Banco)
    setSaldoInicial('0')
    setInstitucion('')
  }

  const empezarEdicion = (cuenta: Cuenta) => {
    setEditando(cuenta)
    setNombre(cuenta.nombre)
    setTipo(cuenta.tipo)
    setSaldoInicial(String(cuenta.saldoInicial))
    setInstitucion(cuenta.institucion ?? '')
    formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const saldo = Number(saldoInicial.replace(',', '.')) || 0
    try {
      if (editando) {
        await finanzasService.actualizarCuenta(editando.id, { nombre, institucion, saldoInicial: saldo })
        exito(`Cuenta “${nombre}” actualizada.`)
      } else {
        await finanzasService.crearCuenta({ nombre, tipo, saldoInicial: saldo, institucion })
        exito(`Cuenta “${nombre}” creada.`)
      }
      limpiarFormulario()
      recargar()
    } catch (causa) {
      fallo(causa)
    }
  }

  const cambiarEstado = async (cuenta: Cuenta) => {
    try {
      await finanzasService.actualizarCuenta(cuenta.id, { activa: !cuenta.activa })
      exito(
        cuenta.activa
          ? `La cuenta “${cuenta.nombre}” se archivó. Sus reglas recurrentes se suspendieron.`
          : `La cuenta “${cuenta.nombre}” se reactivó.`,
      )
      recargar()
    } catch (causa) {
      fallo(causa)
    }
  }

  const transferir = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (origenEfectivo === destinoEfectivo) {
      mostrarError('Elija dos cuentas distintas.')
      return
    }
    try {
      await finanzasService.transferir({
        cuentaOrigenId: origenEfectivo,
        cuentaDestinoId: destinoEfectivo,
        monto: Number(montoTransferencia.replace(',', '.')),
        fecha: fechaTransferencia,
        descripcion: notaTransferencia,
      })
      exito('Transferencia registrada.')
      setMontoTransferencia('')
      setNotaTransferencia('')
      recargar()
    } catch (causa) {
      fallo(causa)
    }
  }

  return (
    <>
      <Encabezado titulo="Cuentas" subtitulo="Saldos actuales y transferencias entre cuentas." />
      <Avisos error={error} aviso={aviso} onCerrar={limpiar} />

      {cargando ? (
        <p className="ft-vacio">Cargando…</p>
      ) : (
        <section className="mb-5" aria-label="Saldos">
          <SelectorOrden
            id="orden-cuentas"
            orden={tabla.orden}
            onCambiar={tabla.fijar}
            columnas={[
              { clave: 'saldo', texto: 'Saldo' },
              { clave: 'cuenta', texto: 'Nombre' },
              { clave: 'tipo', texto: 'Tipo' },
            ]}
          />
          <table className="ft-tabla ft-tabla-apilada">
            <thead>
              <tr>
                <ThOrdenable clave="cuenta" orden={tabla.orden} onOrdenar={tabla.alternar}>Cuenta</ThOrdenable>
                <ThOrdenable clave="tipo" orden={tabla.orden} onOrdenar={tabla.alternar}>Tipo</ThOrdenable>
                <ThOrdenable clave="inicial" orden={tabla.orden} onOrdenar={tabla.alternar} derecha>Saldo inicial</ThOrdenable>
                <ThOrdenable clave="saldo" orden={tabla.orden} onOrdenar={tabla.alternar} derecha>Saldo</ThOrdenable>
                <th scope="col"><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((cuenta) => {
                const saldo = saldoDe(cuenta)
                return (
                  <tr key={cuenta.id} className={`${cuenta.activa ? '' : 'ft-fila-archivada'}${editando?.id === cuenta.id ? ' ft-fila-editando' : ''}`}>
                    <td className="ft-celda-principal">
                      <IconoCuenta cuenta={cuenta} />
                      {cuenta.nombre}
                      {!cuenta.activa && <span className="ft-etiqueta-estado">Archivada</span>}
                      {cuenta.institucion && <small>{cuenta.institucion}</small>}
                    </td>
                    <td data-label="Tipo">{formatearTipoCuenta(cuenta.tipo)}</td>
                    <td data-label="Saldo inicial" className="derecha ft-monto ft-tenue">{formatearMoneda(cuenta.saldoInicial)}</td>
                    <td data-label="Saldo" className={`derecha ft-monto ft-saldo ${saldo < 0 ? 'gasto' : ''}`}>{formatearMoneda(saldo)}</td>
                    <td className="derecha ft-celda-acciones">
                      <button type="button" className="ft-icono-btn" aria-label={`Editar ${cuenta.nombre}`} title="Editar" onClick={() => empezarEdicion(cuenta)}>
                        <i className="bi bi-pencil" aria-hidden="true" />
                      </button>
                      <Button variant="link" size="sm" onClick={() => void cambiarEstado(cuenta)}>
                        <i className={`bi ${cuenta.activa ? 'bi-archive' : 'bi-arrow-counterclockwise'} me-1`} aria-hidden="true" />
                        {cuenta.activa ? 'Archivar' : 'Reactivar'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="ft-fila-total">
                <td colSpan={3}>Total en cuentas activas</td>
                <td className="derecha ft-monto">{formatearMoneda(patrimonio)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <div className="row g-5">
        <section className="col-12 col-xl-6" aria-labelledby="t-nueva" ref={formularioRef}>
          <h2 id="t-nueva" className="ft-seccion-titulo">
            {editando ? `Editar “${editando.nombre}”` : 'Nueva cuenta'}
          </h2>
          <Form className="ft-panel" onSubmit={(e) => void guardar(e)}>
            <div className="ft-rejilla">
              <Form.Group controlId="cta-nombre" className="ft-ancho-doble">
                <Form.Label>Nombre</Form.Label>
                <Form.Control value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </Form.Group>
              <Form.Group controlId="cta-tipo">
                <Form.Label>Tipo</Form.Label>
                <Form.Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCuenta)} disabled={Boolean(editando)}>
                  {TIPOS_CUENTA.map((t) => (
                    <option key={t} value={t}>{formatearTipoCuenta(t)}</option>
                  ))}
                </Form.Select>
                {editando && <Form.Text>El tipo no se puede cambiar.</Form.Text>}
              </Form.Group>
              <Form.Group controlId="cta-saldo">
                <Form.Label>Saldo inicial (₡)</Form.Label>
                <Form.Control inputMode="decimal" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} />
              </Form.Group>
              <Form.Group controlId="cta-institucion" className="ft-ancho-doble">
                <Form.Label>Banco o entidad (opcional)</Form.Label>
                <Form.Control value={institucion} onChange={(e) => setInstitucion(e.target.value)} />
              </Form.Group>
            </div>
            <div className="ft-acciones mt-3">
              <Button type="submit">{editando ? 'Guardar cambios' : 'Crear cuenta'}</Button>
              {editando && (
                <Button variant="outline-secondary" onClick={limpiarFormulario}>Cancelar</Button>
              )}
            </div>
          </Form>
        </section>

        <section className="col-12 col-xl-6" aria-labelledby="t-transf">
          <h2 id="t-transf" className="ft-seccion-titulo">Transferir entre cuentas</h2>
          {activas.length < 2 ? (
            <p className="ft-vacio">Se requieren al menos dos cuentas activas para realizar una transferencia.</p>
          ) : (
            <Form className="ft-panel" onSubmit={(e) => void transferir(e)}>
              <div className="ft-rejilla">
                <Form.Group controlId="tr-origen">
                  <Form.Label>Desde</Form.Label>
                  <Form.Select value={origenEfectivo} onChange={(e) => setOrigen(e.target.value)}>
                    {activas.map((c) => (
                      <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group controlId="tr-destino">
                  <Form.Label>Hacia</Form.Label>
                  <Form.Select value={destinoEfectivo} onChange={(e) => setDestino(e.target.value)}>
                    {activas.map((c) => (
                      <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group controlId="tr-monto">
                  <Form.Label>Monto (₡)</Form.Label>
                  <Form.Control inputMode="decimal" value={montoTransferencia} onChange={(e) => setMontoTransferencia(e.target.value)} required />
                </Form.Group>
                <Form.Group controlId="tr-fecha">
                  <Form.Label>Fecha</Form.Label>
                  <Form.Control type="date" value={fechaTransferencia} onChange={(e) => setFechaTransferencia(e.target.value)} required />
                </Form.Group>
                <Form.Group controlId="tr-nota" className="ft-ancho-doble">
                  <Form.Label>Nota (opcional)</Form.Label>
                  <Form.Control value={notaTransferencia} onChange={(e) => setNotaTransferencia(e.target.value)} />
                </Form.Group>
              </div>
              <Button type="submit" className="mt-3">
                <i className="bi bi-arrow-left-right me-1" aria-hidden="true" />
                Transferir
              </Button>
            </Form>
          )}
        </section>
      </div>
    </>
  )
}
