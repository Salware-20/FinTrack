import { useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import type { Categoria, Cuenta, SaldoCuenta, Transaccion, Usuario } from '../models'
import { TipoTransaccion } from '../models'
import type {
  AlertaConcentracionGasto,
  ConfiguracionUsuario,
  EstadoPresupuesto,
  ResumenFinanciero,
} from '../models/tipos'
import { finanzasService } from '../services'
import { Avance } from '../componentes/Avance'
import { ICONO_CUENTA, moverPeriodo, periodoActual, rangoDePeriodo } from '../componentes/ayudas'
import { Emoji } from '../componentes/Emoji'
import { GraficoFlujo } from '../componentes/Graficos'
import type { Pagina } from '../componentes/paginas'
import { formatearFecha, formatearMes, formatearMoneda, formatearPorcentaje } from '../utils/formato'
import { sumarMontos } from '../utils/numeros'

interface Props {
  usuario: Usuario
  onIr: (pagina: Pagina) => void
}

interface Datos {
  mes: ResumenFinanciero
  total: ResumenFinanciero
  saldos: SaldoCuenta[]
  categorias: Categoria[]
  cuentas: Cuenta[]
  ultimas: Transaccion[]
  presupuestos: EstadoPresupuesto[]
  alertas: AlertaConcentracionGasto[]
  configuracion: ConfiguracionUsuario
}

const TEXTO_ESTADO: Record<EstadoPresupuesto['estadoAlerta'], string> = {
  normal: 'Dentro del límite',
  advertencia: 'Próximo al límite',
  excedido: 'Límite excedido',
}

export function Resumen({ onIr }: Props) {
  const hoy = periodoActual()
  const [periodo, setPeriodo] = useState(hoy)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    const rango = rangoDePeriodo(periodo)
    Promise.all([
      finanzasService.obtenerResumen(rango),
      finanzasService.obtenerResumen(),
      finanzasService.obtenerSaldos(),
      finanzasService.listarCategorias(),
      finanzasService.listarCuentas(),
      finanzasService.listarTransacciones(rango),
      finanzasService.obtenerEstadoPresupuestos(periodo),
      finanzasService.obtenerAlertasConcentracion(periodo),
      finanzasService.obtenerConfiguracion(),
    ])
      .then(([mes, total, saldos, categorias, cuentas, tx, presupuestos, alertas, configuracion]) => {
        if (!activo) return
        setError(null)
        setDatos({ mes, total, saldos, categorias, cuentas, ultimas: tx.slice(0, 8), presupuestos, alertas, configuracion })
      })
      .catch((fallo: unknown) => {
        if (!activo) return
        setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar los datos.')
      })
    return () => {
      activo = false
    }
  }, [periodo])

  if (error) return <p className="text-danger" role="alert">{error}</p>
  if (!datos) return <p className="ft-vacio">Cargando…</p>

  const { mes, total, saldos, categorias, cuentas, ultimas, presupuestos, alertas, configuracion } = datos
  const esMesActual = periodo === hoy
  const patrimonio = sumarMontos(saldos.filter((s) => s.activa).map((s) => s.saldo))
  const categoria = (id: string) => categorias.find((c) => c.id === id)
  const nombreCuenta = (id: string) => cuentas.find((c) => c.id === id)?.nombre ?? 'Sin cuenta'

  const meta = configuracion.metaAhorroMensual ?? 0
  const ahorrado = Math.max(0, mes.balance)
  const avanceMeta = meta > 0 ? (ahorrado / meta) * 100 : 0
  const presupuestosOrdenados = [...presupuestos].sort((a, b) => b.porcentajeConsumido - a.porcentajeConsumido)

  return (
    <>
      <header className="ft-encabezado">
        <div>
          <h1 className="ft-titulo">Resumen financiero</h1>
          <div className="ft-mes" role="group" aria-label="Mes que se muestra">
            <button type="button" className="ft-icono-btn" onClick={() => setPeriodo(moverPeriodo(periodo, -1))} aria-label="Mes anterior">
              <i className="bi bi-chevron-left" aria-hidden="true" />
            </button>
            <span aria-live="polite">{`Periodo: ${formatearMes(periodo)}`}</span>
            <button
              type="button"
              className="ft-icono-btn"
              onClick={() => setPeriodo(moverPeriodo(periodo, 1))}
              disabled={esMesActual}
              aria-label="Mes siguiente"
            >
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </button>
            {!esMesActual && (
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setPeriodo(hoy)}>
                Ir al mes actual
              </button>
            )}
          </div>
        </div>
        <div className="ft-acciones">
          <Button onClick={() => onIr('movimientos')}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Registrar movimiento
          </Button>
        </div>
      </header>

      {total.cantidadTransacciones === 0 && (
        <div className="ft-vacio-grande mb-5">
          <i className="bi bi-journal-plus" aria-hidden="true" />
          <p>No existen movimientos registrados. El resumen se generará a partir del primer ingreso o gasto.</p>
          <Button onClick={() => onIr('movimientos')}>Registrar movimiento</Button>
        </div>
      )}

      {alertas.length > 0 && (
        <section className="ft-alertas" aria-label="Avisos de gasto">
          {alertas.map((a) => (
            <p key={a.categoriaId} className="ft-alerta">
              <i className="bi bi-exclamation-triangle" aria-hidden="true" />
              <span>
                <Emoji valor={categoria(a.categoriaId)?.icono} />
                Concentración de gasto: <strong>{a.categoriaNombre}</strong> representa el{' '}
                <strong>{formatearPorcentaje(a.porcentajeDelTotal)}</strong> del gasto total del periodo (
                {formatearMoneda(a.montoGastado)}).
              </span>
            </p>
          ))}
        </section>
      )}

      <div className="row g-5">
        <section className="col-12 col-xl-5" aria-labelledby="t-balance">
          <h2 id="t-balance" className="ft-seccion-titulo">Balance del mes</h2>
          <dl className="ft-libro">
            <div className="ft-libro-linea">
              <dt>Ingresos</dt>
              <dd className="ft-monto ingreso">{formatearMoneda(mes.totalIngresos)}</dd>
            </div>
            <div className="ft-libro-linea">
              <dt>Gastos</dt>
              <dd className="ft-monto gasto">− {formatearMoneda(mes.totalGastos)}</dd>
            </div>
            <div className="ft-libro-linea ft-libro-total">
              <dt>Balance</dt>
              <dd className={mes.balance < 0 ? 'ft-monto gasto' : ''}>{formatearMoneda(mes.balance)}</dd>
            </div>
          </dl>

          <div className="ft-meta">
            {meta > 0 ? (
              <>
                <div className="ft-meta-linea">
                  <span>Meta de ahorro</span>
                  <span className="ft-monto">
                    {formatearMoneda(ahorrado)} <span className="ft-tenue">de {formatearMoneda(meta)}</span>
                  </span>
                </div>
                <Avance porcentaje={avanceMeta} estado="meta" etiqueta="Avance de la meta de ahorro" />
                <small className="ft-tenue">
                  {ahorrado >= meta
                    ? `Meta alcanzada. Excedente: ${formatearMoneda(ahorrado - meta)}.`
                    : `Pendiente: ${formatearMoneda(meta - ahorrado)} (avance del ${formatearPorcentaje(avanceMeta)}).`}
                </small>
              </>
            ) : (
              <p className="ft-nota mb-0">
                No se ha definido una meta de ahorro mensual.{' '}
                <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => onIr('cuenta')}>
                  Configurar meta
                </button>
              </p>
            )}
          </div>

          <h2 className="ft-seccion-titulo mt-5">Saldos por cuenta</h2>
          {saldos.length === 0 ? (
            <p className="ft-vacio">No existen cuentas registradas.</p>
          ) : (
            <ul className="ft-lista-cuentas">
              {saldos.filter((s) => s.activa).map((cuenta) => (
                <li key={cuenta.cuentaId}>
                  <span>
                    {cuenta.icono ? (
                      <span className="ft-emoji" aria-hidden="true">{cuenta.icono}</span>
                    ) : (
                      <i className={`bi ${ICONO_CUENTA[cuenta.tipo] ?? 'bi-wallet'}`} aria-hidden="true" />
                    )}
                    {cuenta.nombre}
                  </span>
                  <span className={`ft-monto ${cuenta.saldo < 0 ? 'gasto' : ''}`}>{formatearMoneda(cuenta.saldo)}</span>
                </li>
              ))}
              <li className="ft-lista-total">
                <strong>Saldo total</strong>
                <strong className="ft-monto">{formatearMoneda(patrimonio)}</strong>
              </li>
            </ul>
          )}
        </section>

        <div className="col-12 col-xl-7">
          <section aria-labelledby="t-presupuestos" className="mb-5">
            <div className="ft-seccion-cabeza">
              <h2 id="t-presupuestos" className="ft-seccion-titulo mb-0">Presupuestos</h2>
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onIr('categorias')}>
                {presupuestos.length === 0 ? 'Definir presupuestos' : 'Administrar'}
              </button>
            </div>
            {presupuestos.length === 0 ? (
              <p className="ft-nota">
                No se han definido presupuestos. Asigne un límite mensual a las categorías de gasto para controlar su consumo.
              </p>
            ) : (
              <ul className="ft-presupuestos">
                {presupuestosOrdenados.map((p) => (
                  <li key={p.presupuestoId}>
                    <div className="ft-presupuestos-linea">
                      <span>
                        <Emoji valor={categoria(p.categoriaId)?.icono} />
                        {p.categoriaNombre}
                        {p.estadoAlerta !== 'normal' && (
                          <span className={`ft-estado ${p.estadoAlerta}`}>{TEXTO_ESTADO[p.estadoAlerta]}</span>
                        )}
                      </span>
                      <span className="ft-monto">
                        {formatearMoneda(p.montoGastado)} <span className="ft-tenue">de {formatearMoneda(p.montoLimite)}</span>
                      </span>
                    </div>
                    <Avance porcentaje={p.porcentajeConsumido} estado={p.estadoAlerta} etiqueta={`Consumo de ${p.categoriaNombre}`} />
                    <small className={p.montoDisponible < 0 ? 'ft-monto gasto' : 'ft-tenue'}>
                      {p.montoDisponible >= 0
                        ? `Disponible: ${formatearMoneda(p.montoDisponible)}`
                        : `Excedido en ${formatearMoneda(Math.abs(p.montoDisponible))}`}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="t-movs">
            <div className="ft-seccion-cabeza">
              <h2 id="t-movs" className="ft-seccion-titulo mb-0">{esMesActual ? 'Movimientos recientes' : 'Movimientos del periodo'}</h2>
              {ultimas.length > 0 && (
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onIr('movimientos')}>
                  Ver detalle
                </button>
              )}
            </div>
            {ultimas.length === 0 ? (
              <p className="ft-vacio">No se registran movimientos en {formatearMes(periodo)}.</p>
            ) : (
              <table className="ft-tabla ft-tabla-movimientos">
                <thead>
                  <tr>
                    <th scope="col">Movimiento</th>
                    <th scope="col" className="ft-col-fecha">Fecha</th>
                    <th scope="col" className="derecha">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimas.map((t) => {
                    const esIngreso = t.tipo === TipoTransaccion.Ingreso
                    const cat = categoria(t.categoriaId)
                    return (
                      <tr key={t.id}>
                        <td>
                          <div className="ft-mov">
                            <span className={`ft-tipo-icono ${esIngreso ? 'ingreso' : 'gasto'}`}>
                              {cat?.icono ? (
                                <span aria-hidden="true">{cat.icono}</span>
                              ) : (
                                <i className={`bi ${esIngreso ? 'bi-arrow-down-left' : 'bi-arrow-up-right'}`} aria-hidden="true" />
                              )}
                            </span>
                            <div className="ft-mov-texto">
                              <span className="ft-mov-titulo">
                                {t.descripcion}
                                {t.recurrenciaId && (
                                  <span className="ft-marca-repite" title="Generado automáticamente por una regla recurrente">🔁</span>
                                )}
                              </span>
                              <small>
                                {cat?.nombre ?? 'Sin categoría'}
                                <span className="ft-oculto-movil"> · {nombreCuenta(t.cuentaId)}</span>
                                <span className="ft-solo-movil"> · {formatearFecha(t.fecha).replace(/ de \d{4}$/, '')}</span>
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="text-nowrap ft-col-fecha">{formatearFecha(t.fecha)}</td>
                        <td className={`derecha ft-monto ${esIngreso ? 'ingreso' : 'gasto'}`}>
                          {esIngreso ? '+' : '−'} {formatearMoneda(t.monto)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>

      {total.porMes.length > 0 && (
        <section className="mt-5" aria-labelledby="t-flujo">
          <h2 id="t-flujo" className="ft-seccion-titulo">Ingresos y gastos por mes</h2>
          <GraficoFlujo datos={total.porMes.slice(-12)} />
        </section>
      )}
    </>
  )
}
