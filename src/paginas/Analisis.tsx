import { useEffect, useState } from 'react'
import { Form } from 'react-bootstrap'
import type { Categoria } from '../models'
import type {
  AnalisisGastosHormiga,
  FugaGastoHormiga,
  ParametrosSimulacion,
  ResultadoSimulacion,
} from '../models/tipos'
import { finanzasService } from '../services'
import { Avance } from '../componentes/Avance'
import { etiquetaCategoria, mensajeDeError, moverPeriodo, periodoActual } from '../componentes/ayudas'
import { Encabezado } from '../componentes/Encabezado'
import type { Pagina } from '../componentes/paginas'
import { formatearFecha, formatearFrecuencia, formatearMes, formatearMoneda, formatearPorcentaje } from '../utils/formato'

type Vista = 'hormiga' | 'simulador'

const UMBRALES = [5_000, 10_000, 15_000] as const

/** Convierte el texto ingresado ("150 000", "150.000,50") en número. */
const leerNumero = (texto: string) => Number(texto.replace(/[\s.]/g, '').replace(',', '.'))

export function Analisis({ onIr }: { onIr: (pagina: Pagina) => void }) {
  const [vista, setVista] = useState<Vista>('hormiga')

  return (
    <>
      <Encabezado
        titulo="Análisis"
        subtitulo="Indicadores calculados a partir del historial de movimientos: detección de gastos de bajo monto y evaluación de viabilidad financiera."
      />

      <div className="ft-pestanas" role="tablist" aria-label="Tipo de análisis">
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'hormiga'}
          className={vista === 'hormiga' ? 'activa' : ''}
          onClick={() => setVista('hormiga')}
        >
          <i className="bi bi-bug" aria-hidden="true" />
          <span>
            <strong>Gastos hormiga</strong>
            <small>Detección de gastos recurrentes de bajo monto</small>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'simulador'}
          className={vista === 'simulador' ? 'activa' : ''}
          onClick={() => setVista('simulador')}
        >
          <i className="bi bi-calculator" aria-hidden="true" />
          <span>
            <strong>Simulador de escenarios</strong>
            <small>Evaluación de viabilidad de compras y metas</small>
          </span>
        </button>
      </div>

      {vista === 'hormiga' ? <GastosHormiga /> : <Simulador onIr={onIr} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Gastos hormiga                                                      */
/* ------------------------------------------------------------------ */

function GastosHormiga() {
  const hoy = periodoActual()
  const [periodo, setPeriodo] = useState(hoy)
  const [umbral, setUmbral] = useState<number>(10_000)
  const [soloRepetidos, setSoloRepetidos] = useState(true)
  const [datos, setDatos] = useState<AnalisisGastosHormiga | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    finanzasService
      .analizarGastosHormiga(periodo, umbral)
      .then((resultado) => {
        if (!activo) return
        setDatos(resultado)
        setError(null)
      })
      .catch((causa: unknown) => {
        if (activo) setError(mensajeDeError(causa))
      })
    return () => {
      activo = false
    }
  }, [periodo, umbral])

  const esMesActual = periodo === hoy
  const mes = formatearMes(periodo)
  const fugas = (datos?.fugas ?? []).filter((f) => !soloRepetidos || f.esFrecuente)
  const mayor = Math.max(1, ...fugas.map((f) => f.totalPeriodo))

  return (
    <section aria-label="Gastos hormiga">
      <div className="ft-controles">
        <div className="ft-mes" role="group" aria-label="Mes analizado">
          <button type="button" className="ft-icono-btn" onClick={() => setPeriodo(moverPeriodo(periodo, -1))} aria-label="Mes anterior">
            <i className="bi bi-chevron-left" aria-hidden="true" />
          </button>
          <span aria-live="polite">{mes}</span>
          <button type="button" className="ft-icono-btn" onClick={() => setPeriodo(moverPeriodo(periodo, 1))} disabled={esMesActual} aria-label="Mes siguiente">
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </div>

        <div className="ft-campo-linea">
          <span>Umbral por transacción</span>
          <div className="ft-selector-tipo ft-selector-neutro" role="group" aria-label="Umbral por transacción">
            {UMBRALES.map((valor) => (
              <button key={valor} type="button" className={umbral === valor ? 'activo' : ''} aria-pressed={umbral === valor} onClick={() => setUmbral(valor)}>
                {formatearMoneda(valor).replace(/,00$/, '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-danger" role="alert">{error}</p>}
      {!datos && !error && <p className="ft-vacio">Procesando análisis…</p>}

      {datos && !error && (
        datos.cantidadGastos === 0 ? (
          <div className="ft-vacio-grande">
            <i className="bi bi-emoji-smile" aria-hidden="true" />
            <p>
              No se registran gastos confirmados iguales o inferiores a {formatearMoneda(umbral)} en {mes}.
            </p>
          </div>
        ) : (
          <>
            <div className="ft-veredicto alerta">
              <p className="ft-veredicto-titulo">
                Gasto de bajo monto en {mes}:{' '}
                <strong className="ft-monto">{formatearMoneda(datos.totalMensual)}</strong>
              </p>
              <dl className="ft-indicadores">
                <div>
                  <dt>Transacciones</dt>
                  <dd>{datos.cantidadGastos}</dd>
                </div>
                <div>
                  <dt>Proyección anual</dt>
                  <dd className="ft-monto">{formatearMoneda(datos.proyeccionAnual)}</dd>
                </div>
                <div>
                  <dt>% del gasto total</dt>
                  <dd>{formatearPorcentaje(datos.porcentajeDelGastoTotal)}</dd>
                </div>
                <div>
                  <dt>Gasto total del periodo</dt>
                  <dd className="ft-monto">{formatearMoneda(datos.totalGastosPeriodo)}</dd>
                </div>
                <div>
                  <dt>Comercios recurrentes</dt>
                  <dd>{datos.cantidadFugasFrecuentes} de {datos.fugas.length}</dd>
                </div>
              </dl>
            </div>

            <div className="ft-seccion-cabeza mt-4">
              <h2 className="ft-seccion-titulo mb-0">Distribución por comercio</h2>
              <Form.Check
                type="switch"
                id="hormiga-repetidos"
                label="Solo comercios recurrentes"
                checked={soloRepetidos}
                onChange={(e) => setSoloRepetidos(e.target.checked)}
              />
            </div>

            {fugas.length === 0 ? (
              <p className="ft-vacio">
                Ningún comercio registra dos o más transacciones en el periodo.{' '}
                <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setSoloRepetidos(false)}>
                  Mostrar los {datos.fugas.length} comercios
                </button>
              </p>
            ) : (
              <ol className="ft-fugas">
                {fugas.map((f) => (
                  <FilaFuga key={f.clave} fuga={f} mayor={mayor} />
                ))}
              </ol>
            )}

            <details className="ft-explicacion">
              <summary>Metodología</summary>
              <ul>
                <li>Se consideran los gastos confirmados del periodo con monto igual o inferior a {formatearMoneda(umbral)}.</li>
                <li>Las transacciones se agrupan por descripción normalizada del comercio.</li>
                <li>La proyección anual es lineal: total del periodo × 12. Constituye una estimación, no un pronóstico.</li>
                <li>El total incluye todas las transacciones bajo el umbral, aun cuando la tabla muestre solo los comercios recurrentes.</li>
              </ul>
            </details>
          </>
        )
      )}
    </section>
  )
}

function FilaFuga({ fuga, mayor }: { fuga: FugaGastoHormiga; mayor: number }) {
  const fechas =
    fuga.primeraFecha === fuga.ultimaFecha
      ? formatearFecha(fuga.primeraFecha)
      : `del ${formatearFecha(fuga.primeraFecha).replace(/ de \d{4}$/, '')} al ${formatearFecha(fuga.ultimaFecha).replace(/ de \d{4}$/, '')}`
  return (
    <li>
      <div className="ft-fuga-linea">
        <span className="ft-fuga-nombre">
          {fuga.etiqueta}
          <small>
            {fuga.categoriaNombre} · {fuga.cantidad} {fuga.cantidad === 1 ? 'transacción' : 'transacciones'} · promedio {formatearMoneda(fuga.promedio)} · {fechas}
          </small>
        </span>
        <span className="ft-fuga-montos">
          <strong className="ft-monto">{formatearMoneda(fuga.totalPeriodo)}</strong>
          <small className="ft-tenue">{formatearMoneda(fuga.proyeccionAnual)} anual · {formatearPorcentaje(fuga.porcentajeSobreFugas)}</small>
        </span>
      </div>
      <Avance porcentaje={(fuga.totalPeriodo / mayor) * 100} estado="advertencia" etiqueta={`Peso de ${fuga.etiqueta}`} />
    </li>
  )
}

/* ------------------------------------------------------------------ */
/*  Simulador "¿Me alcanza?"                                            */
/* ------------------------------------------------------------------ */

const VEREDICTO = {
  success: {
    clase: 'bien',
    icono: 'bi-check-circle',
    titulo: 'Escenario viable',
    detalle: 'El flujo disponible cubre la cuota mensual y se mantiene la meta de ahorro.',
  },
  warning: {
    clase: 'alerta',
    icono: 'bi-exclamation-triangle',
    titulo: 'Escenario viable con déficit de ahorro',
    detalle: 'El flujo libre cubre la cuota, pero reduce el monto destinado a la meta de ahorro.',
  },
  danger: {
    clase: 'mal',
    icono: 'bi-x-circle',
    titulo: 'Escenario no viable',
    detalle: 'El flujo libre mensual es insuficiente para cubrir la cuota.',
  },
} as const

function Simulador({ onIr }: { onIr: (pagina: Pagina) => void }) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [monto, setMonto] = useState('150000')
  const [meses, setMeses] = useState('6')
  const [categoriaId, setCategoriaId] = useState('')
  const [recorte, setRecorte] = useState(20)
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [calculando, setCalculando] = useState(false)

  useEffect(() => {
    finanzasService.listarCategorias().then(setCategorias).catch(() => setCategorias([]))
  }, [])

  const montoNumero = leerNumero(monto)
  const mesesNumero = Number(meses)
  const errorMonto = !monto.trim() || !Number.isFinite(montoNumero) || montoNumero <= 0 ? 'Ingrese un monto mayor que cero.' : null
  const errorMeses = !Number.isInteger(mesesNumero) || mesesNumero < 1 || mesesNumero > 120 ? 'Ingrese un plazo entero entre 1 y 120 meses.' : null
  const valido = !errorMonto && !errorMeses
  const porcentaje = categoriaId ? recorte : 0

  useEffect(() => {
    if (!valido) return
    let activo = true
    const espera = setTimeout(() => {
      setCalculando(true)
      const parametros: ParametrosSimulacion = categoriaId
        ? { montoObjetivo: montoNumero, meses: mesesNumero, categoriaRecorteId: categoriaId, porcentajeRecorte: porcentaje }
        : { montoObjetivo: montoNumero, meses: mesesNumero }
      finanzasService
        .simularEscenario(parametros)
        .then((r) => {
          if (!activo) return
          setResultado(r)
          setError(null)
        })
        .catch((causa: unknown) => {
          if (activo) setError(mensajeDeError(causa))
        })
        .finally(() => {
          if (activo) setCalculando(false)
        })
    }, 250)
    return () => {
      activo = false
      clearTimeout(espera)
    }
  }, [valido, montoNumero, mesesNumero, categoriaId, porcentaje])

  const gastos = categorias
    .filter((c) => c.tipo === 'gasto')
    .map((c) => ({ id: c.id, texto: `${c.icono ? `${c.icono} ` : ''}${etiquetaCategoria(c, categorias)}`, orden: etiquetaCategoria(c, categorias) }))
    .sort((a, b) => a.orden.localeCompare(b.orden, 'es'))

  return (
    <section aria-label="Simulador">
      <form className="ft-panel" onSubmit={(e) => e.preventDefault()} aria-label="Parámetros de la simulación">
        <h2 className="ft-seccion-titulo">Parámetros</h2>
        <div className="ft-rejilla">
          <Form.Group controlId="sim-monto">
            <Form.Label>Monto objetivo (₡)</Form.Label>
            <Form.Control inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} isInvalid={Boolean(errorMonto)} />
            <Form.Control.Feedback type="invalid">{errorMonto}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group controlId="sim-meses">
            <Form.Label>Plazo (meses)</Form.Label>
            <Form.Control inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value.replace(/\D/g, ''))} isInvalid={Boolean(errorMeses)} />
            <Form.Control.Feedback type="invalid">{errorMeses}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group controlId="sim-categoria">
            <Form.Label>Categoría a reducir (opcional)</Form.Label>
            <Form.Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Sin reducción</option>
              {gastos.map((c) => (
                <option key={c.id} value={c.id}>{c.texto}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="sim-recorte">
            <Form.Label className="d-flex justify-content-between">
              <span>Porcentaje de reducción</span>
              <strong>{categoriaId ? `${recorte} %` : '—'}</strong>
            </Form.Label>
            <Form.Range min={5} max={100} step={5} value={recorte} disabled={!categoriaId} onChange={(e) => setRecorte(Number(e.target.value))} />
          </Form.Group>
        </div>
      </form>

      {error && <p className="text-danger" role="alert">{error}</p>}
      {!resultado && !error && valido && <p className="ft-vacio">Calculando escenario…</p>}

      {resultado && valido && <ResultadoSimulador r={resultado} calculando={calculando} onIr={onIr} />}
    </section>
  )
}

function ResultadoSimulador({ r, calculando, onIr }: { r: ResultadoSimulacion; calculando: boolean; onIr: (pagina: Pagina) => void }) {
  const v = VEREDICTO[r.diagnostico]
  const sobra = r.diferenciaMensual >= 0
  const conRecorte = r.ahorroMensualRecorte > 0
  const sinHistorial = r.mesesAnalizados.length === 0
  const usoDisponible = r.disponibleParaCuota > 0 ? (r.cuotaMensual / r.disponibleParaCuota) * 100 : 100

  return (
    <div className={calculando ? 'ft-recalculando' : ''} aria-live="polite">
      <div className={`ft-veredicto ${v.clase}`}>
        <p className="ft-veredicto-titulo">
          <i className={`bi ${v.icono}`} aria-hidden="true" />
          {v.titulo}
        </p>
        <p className="mb-2">
          {v.detalle} Cuota mensual requerida: <strong className="ft-monto">{formatearMoneda(r.cuotaMensual)}</strong> durante {r.meses}{' '}
          {r.meses === 1 ? 'mes' : 'meses'}.
        </p>
        <Avance
          porcentaje={usoDisponible}
          estado={r.diagnostico === 'success' ? 'normal' : r.diagnostico === 'warning' ? 'advertencia' : 'excedido'}
          etiqueta="Proporción del flujo disponible comprometida por la cuota"
        />
        <small>
          {r.disponibleParaCuota > 0
            ? `Índice de compromiso: la cuota representa el ${formatearPorcentaje(Math.min(usoDisponible, 999))} del flujo disponible.`
            : 'Flujo disponible nulo o negativo después de la meta de ahorro.'}
        </small>
      </div>

      <div className="row g-5 mt-0">
        <section className="col-12 col-xl-7" aria-labelledby="t-cuenta">
          <h2 id="t-cuenta" className="ft-seccion-titulo">Desglose del flujo de caja mensual</h2>
          <dl className="ft-libro ft-libro-pasos">
            <div className="ft-libro-linea">
              <dt>Ingresos promedio<small>Incluye ingresos recurrentes</small></dt>
              <dd className="ft-monto ingreso">{formatearMoneda(r.ingresosBase)}</dd>
            </div>
            <div className="ft-libro-linea">
              <dt>Egresos promedio<small>Incluye compromisos recurrentes</small></dt>
              <dd className="ft-monto gasto">− {formatearMoneda(r.gastosBase)}</dd>
            </div>
            {conRecorte && (
              <div className="ft-libro-linea">
                <dt>Reducción aplicada<small>{r.categoriaRecorteNombre}: −{formatearPorcentaje(r.porcentajeRecorte)}</small></dt>
                <dd className="ft-monto ingreso">+ {formatearMoneda(r.ahorroMensualRecorte)}</dd>
              </div>
            )}
            <div className="ft-libro-linea ft-libro-sub">
              <dt>Flujo libre mensual</dt>
              <dd className={`ft-monto ${r.flujoLibreProyectado < 0 ? 'gasto' : ''}`}>{formatearMoneda(r.flujoLibreProyectado)}</dd>
            </div>
            <div className="ft-libro-linea">
              <dt>
                Meta de ahorro mensual
                <small>
                  {r.metaAhorroMensual > 0 ? (
                    'Configurada en Mi cuenta'
                  ) : (
                    <>
                      Sin configurar.{' '}
                      <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => onIr('cuenta')}>
                        Configurar
                      </button>
                    </>
                  )}
                </small>
              </dt>
              <dd className="ft-monto gasto">− {formatearMoneda(r.metaAhorroMensual)}</dd>
            </div>
            <div className="ft-libro-linea ft-libro-sub">
              <dt>Flujo disponible</dt>
              <dd className={`ft-monto ${r.disponibleParaCuota < 0 ? 'gasto' : ''}`}>{formatearMoneda(r.disponibleParaCuota)}</dd>
            </div>
            <div className="ft-libro-linea">
              <dt>Cuota mensual del objetivo<small>{formatearMoneda(r.montoObjetivo)} ÷ {r.meses}</small></dt>
              <dd className="ft-monto gasto">− {formatearMoneda(r.cuotaMensual)}</dd>
            </div>
            <div className="ft-libro-linea ft-libro-total">
              <dt>{sobra ? 'Superávit mensual' : 'Déficit mensual'}</dt>
              <dd className={sobra ? 'ft-monto ingreso' : 'ft-monto gasto'}>{formatearMoneda(Math.abs(r.diferenciaMensual))}</dd>
            </div>
          </dl>
        </section>

        <aside className="col-12 col-xl-5">
          <h2 className="ft-seccion-titulo">Indicadores complementarios</h2>
          <ul className="ft-datos-clave">
            <li>
              <i className="bi bi-calendar-check" aria-hidden="true" />
              <span>
                {r.mesesParaObjetivo === null ? (
                  'El flujo libre mensual no es positivo; el objetivo no es alcanzable sin modificar ingresos o egresos.'
                ) : (
                  <>
                    Plazo mínimo destinando el 100 % del flujo libre:{' '}
                    <strong>{r.mesesParaObjetivo} {r.mesesParaObjetivo === 1 ? 'mes' : 'meses'}</strong>
                    {r.fechaEstimada ? ` (fecha estimada: ${formatearMes(r.fechaEstimada)})` : ''}.
                  </>
                )}
              </span>
            </li>
            {conRecorte && (
              <li>
                <i className="bi bi-scissors" aria-hidden="true" />
                <span>
                  Gasto en {r.categoriaRecorteNombre}: {formatearMoneda(r.gastoCategoriaPromedio)} →{' '}
                  {formatearMoneda(r.gastoCategoriaProyectada)} mensual. Ahorro anual estimado:{' '}
                  <strong>{formatearMoneda(r.ahorroAnualRecorte)}</strong>.
                </span>
              </li>
            )}
            {!sobra && (
              <li>
                <i className="bi bi-arrow-repeat" aria-hidden="true" />
                <span>Para equilibrar el escenario, amplíe el plazo o aplique una reducción de gasto.</span>
              </li>
            )}
          </ul>

          {sinHistorial && (
            <p className="ft-alerta mt-3">
              <i className="bi bi-info-circle" aria-hidden="true" />
              <span>Sin historial de movimientos confirmados. El cálculo considera únicamente las reglas recurrentes activas.</span>
            </p>
          )}

          <details className="ft-explicacion">
            <summary>Base de cálculo</summary>
            <ul>
              <li>
                Periodos promediados:{' '}
                {sinHistorial ? 'ninguno' : r.mesesAnalizados.map(formatearMes).join(', ')}. Se utilizan hasta los últimos 3 meses
                cerrados; el mes en curso se incluye solo si no existe historial previo.
              </li>
              <li>
                Reglas recurrentes activas mensualizadas: ingresos {formatearMoneda(r.ingresoRecurrenteMensual)}, compromisos{' '}
                {formatearMoneda(r.compromisoRecurrenteMensual)}. Flujo libre promedio histórico: {formatearMoneda(r.flujoLibrePromedio)}.
              </li>
            </ul>
            {r.recurrenciasActivas.length > 0 && (
              <ul className="ft-lista-cuentas">
                {r.recurrenciasActivas.map((rec) => (
                  <li key={rec.id}>
                    <span>
                      {rec.descripcion} <small className="ft-tenue">({formatearFrecuencia(rec.frecuencia).toLowerCase()})</small>
                    </span>
                    <span className={`ft-monto ${rec.tipo === 'ingreso' ? 'ingreso' : 'gasto'}`}>
                      {formatearMoneda(rec.montoMensual)}/mes
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </aside>
      </div>
    </div>
  )
}
