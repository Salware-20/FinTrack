import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import type { Cuenta, SaldoCuenta } from '../models'
import { TIPOS_CUENTA, TipoCuenta } from '../models'
import { finanzasService } from '../services'
import { ICONO_CUENTA } from '../componentes/ayudas'
import { Avisos } from '../componentes/Avisos'
import { Encabezado } from '../componentes/Encabezado'
import { useAvisos } from '../componentes/useAvisos'
import { fechaHoy, formatearMoneda, formatearTipoCuenta } from '../utils/formato'
import { sumarMontos } from '../utils/numeros'

export function Cuentas() {
  const { error, aviso, fallo, mostrarError, exito, limpiar } = useAvisos()
  const [version, setVersion] = useState(0)
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [saldos, setSaldos] = useState<SaldoCuenta[]>([])
  const [cargando, setCargando] = useState(true)

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

  const activas = cuentas.filter((c) => c.activa)
  const origenEfectivo = origen || activas[0]?.id || ''
  const destinoEfectivo = destino || activas.find((c) => c.id !== origenEfectivo)?.id || ''
  const patrimonio = sumarMontos(saldos.filter((s) => s.activa).map((s) => s.saldo))

  const crear = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    try {
      await finanzasService.crearCuenta({
        nombre,
        tipo,
        saldoInicial: Number(saldoInicial.replace(',', '.')) || 0,
        institucion,
      })
      exito(`Cuenta “${nombre}” creada.`)
      setNombre('')
      setSaldoInicial('0')
      setInstitucion('')
      recargar()
    } catch (causa) {
      fallo(causa)
    }
  }

  const cambiarEstado = async (cuenta: Cuenta) => {
    try {
      await finanzasService.actualizarCuenta(cuenta.id, { activa: !cuenta.activa })
      exito(cuenta.activa ? `“${cuenta.nombre}” se archivó.` : `“${cuenta.nombre}” volvió a estar activa.`)
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
      <Encabezado titulo="Cuentas" subtitulo="Dónde está su dinero hoy." />
      <Avisos error={error} aviso={aviso} onCerrar={limpiar} />

      {cargando ? (
        <p className="ft-vacio">Cargando…</p>
      ) : (
        <div className="table-responsive mb-5">
          <table className="ft-tabla">
            <thead>
              <tr>
                <th scope="col">Cuenta</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="derecha">Saldo</th>
                <th scope="col"><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((cuenta) => {
                const saldo = saldos.find((s) => s.cuentaId === cuenta.id)?.saldo ?? cuenta.saldoInicial
                return (
                  <tr key={cuenta.id} className={cuenta.activa ? '' : 'ft-fila-archivada'}>
                    <td>
                      <i className={`bi ${ICONO_CUENTA[cuenta.tipo] ?? 'bi-wallet'} me-2 text-success`} aria-hidden="true" />
                      {cuenta.nombre}
                      {!cuenta.activa && <span className="ft-etiqueta-estado">Archivada</span>}
                      {cuenta.institucion && <small style={{ marginLeft: '1.6rem' }}>{cuenta.institucion}</small>}
                    </td>
                    <td>{formatearTipoCuenta(cuenta.tipo)}</td>
                    <td className={`derecha ft-monto ${saldo < 0 ? 'gasto' : ''}`}>{formatearMoneda(saldo)}</td>
                    <td className="derecha">
                      <Button variant="link" size="sm" className="p-0" onClick={() => void cambiarEstado(cuenta)}>
                        {cuenta.activa ? 'Archivar' : 'Reactivar'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td colSpan={2}><strong>Total en cuentas activas</strong></td>
                <td className="derecha ft-monto"><strong>{formatearMoneda(patrimonio)}</strong></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="row g-5">
        <section className="col-12 col-xl-6" aria-labelledby="t-nueva">
          <h2 id="t-nueva" className="ft-seccion-titulo">Nueva cuenta</h2>
          <Form className="ft-panel" onSubmit={(e) => void crear(e)}>
            <div className="ft-rejilla">
              <Form.Group controlId="cta-nombre" className="ft-ancho-doble">
                <Form.Label>Nombre</Form.Label>
                <Form.Control value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </Form.Group>
              <Form.Group controlId="cta-tipo">
                <Form.Label>Tipo</Form.Label>
                <Form.Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCuenta)}>
                  {TIPOS_CUENTA.map((t) => (
                    <option key={t} value={t}>{formatearTipoCuenta(t)}</option>
                  ))}
                </Form.Select>
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
            <Button type="submit" className="mt-3">Crear cuenta</Button>
          </Form>
        </section>

        <section className="col-12 col-xl-6" aria-labelledby="t-transf">
          <h2 id="t-transf" className="ft-seccion-titulo">Transferir entre cuentas</h2>
          {activas.length < 2 ? (
            <p className="ft-vacio">Necesita al menos dos cuentas activas para transferir.</p>
          ) : (
            <Form className="ft-panel" onSubmit={(e) => void transferir(e)}>
              <div className="ft-rejilla">
                <Form.Group controlId="tr-origen">
                  <Form.Label>Desde</Form.Label>
                  <Form.Select value={origenEfectivo} onChange={(e) => setOrigen(e.target.value)}>
                    {activas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group controlId="tr-destino">
                  <Form.Label>Hacia</Form.Label>
                  <Form.Select value={destinoEfectivo} onChange={(e) => setDestino(e.target.value)}>
                    {activas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
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
              <Button type="submit" className="mt-3">Transferir</Button>
            </Form>
          )}
        </section>
      </div>
    </>
  )
}
