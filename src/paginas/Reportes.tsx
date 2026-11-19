import { useEffect, useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import type { Usuario } from '../models'
import type { EstadoResultados, FilaEstadoResultados, ResumenFinanciero, ResumenPorCategoria } from '../models/tipos'
import { finanzasService } from '../services'
import { Avisos } from '../componentes/Avisos'
import { Encabezado } from '../componentes/Encabezado'
import { GraficoFlujo, GraficoGastos } from '../componentes/Graficos'
import { Emoji } from '../componentes/Emoji'
import { porNumero, porTexto } from '../componentes/orden'
import { ThOrdenable } from '../componentes/ThOrdenable'
import { useAvisos } from '../componentes/useAvisos'
import { useOrden } from '../componentes/useOrden'
import { descargarTexto, nombreConFecha } from '../utils/descargas'
import { finDeMes, formatearFecha, formatearMoneda, formatearPorcentaje, inicioDeMes } from '../utils/formato'

interface Rango {
  desde: string
  hasta: string
}

export function Reportes({ usuario }: { usuario: Usuario }) {
  const { error, aviso, fallo, mostrarError, exito, limpiar } = useAvisos()
  const [rango, setRango] = useState<Rango>({ desde: inicioDeMes(), hasta: finDeMes() })
  const [borrador, setBorrador] = useState<Rango>(rango)
  const [estado, setEstado] = useState<EstadoResultados | null>(null)
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null)

  useEffect(() => {
    let activo = true
    Promise.all([
      finanzasService.obtenerEstadoResultados(rango.desde, rango.hasta),
      finanzasService.obtenerResumen({ desde: rango.desde, hasta: rango.hasta }),
    ])
      .then(([est, res]) => {
        if (!activo) return
        setEstado(est)
        setResumen(res)
      })
      .catch((causa: unknown) => {
        if (activo) fallo(causa)
      })
    return () => {
      activo = false
    }
  }, [rango, fallo])

  const aplicar = (nuevo: Rango) => {
    if (nuevo.desde > nuevo.hasta) {
      mostrarError('La fecha inicial no puede ser posterior a la final.')
      return
    }
    limpiar()
    setBorrador(nuevo)
    setRango(nuevo)
  }

  const esteMes = () => aplicar({ desde: inicioDeMes(), hasta: finDeMes() })
  const mesAnterior = () => {
    const hoy = new Date()
    const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    aplicar({ desde: inicioDeMes(anterior), hasta: finDeMes(anterior) })
  }
  const esteAnio = () => {
    const anio = new Date().getFullYear()
    aplicar({ desde: `${anio}-01-01`, hasta: `${anio}-12-31` })
  }

  const pdfEstado = async () => {
    if (!estado) return
    try {
      const { generarPdfEstadoResultados } = await import('../utils/reportesPdf')
      generarPdfEstadoResultados(estado, usuario.nombre).save(nombreConFecha('estado-resultados', 'pdf'))
      exito('PDF del estado de resultados generado.')
    } catch (causa) {
      fallo(causa)
    }
  }

  const pdfGastos = async () => {
    if (!resumen) return
    try {
      const { generarPdfGastosPorCategoria } = await import('../utils/reportesPdf')
      generarPdfGastosPorCategoria(resumen.porCategoria, rango.desde, rango.hasta, usuario.nombre).save(
        nombreConFecha('gastos-por-categoria', 'pdf'),
      )
      exito('PDF de gastos por categoría generado.')
    } catch (causa) {
      fallo(causa)
    }
  }

  const csv = async () => {
    try {
      const texto = await finanzasService.exportarTransaccionesCsv({ desde: rango.desde, hasta: rango.hasta })
      descargarTexto(nombreConFecha('movimientos', 'csv'), `\uFEFF${texto}`, 'text/csv;charset=utf-8')
      exito('CSV exportado. Se abre directo en Excel.')
    } catch (causa) {
      fallo(causa)
    }
  }

  // En el estado de resultados solo se ordenan las filas de cada grupo; los totales quedan fijos
  const comparadoresFila = {
    concepto: porTexto<FilaEstadoResultados>((f) => f.nombre),
    total: porNumero<FilaEstadoResultados>((f) => f.total),
  }
  const ordenIngresos = useOrden(estado?.filas.filter((f) => f.tipo === 'ingreso') ?? [], comparadoresFila)
  const ordenGastos = useOrden(estado?.filas.filter((f) => f.tipo === 'gasto') ?? [], comparadoresFila)
  const ingresos = ordenIngresos.filas
  const gastos = ordenGastos.filas
  const alternarEstado = (clave: string) => {
    ordenIngresos.alternar(clave)
    ordenGastos.alternar(clave)
  }

  const tablaCategorias = useOrden(resumen?.porCategoria.filter((c) => c.tipo === 'gasto') ?? [], {
    categoria: porTexto<ResumenPorCategoria>((c) => c.nombre),
    total: porNumero<ResumenPorCategoria>((c) => c.total),
    cantidad: porNumero<ResumenPorCategoria>((c) => c.cantidad),
  })
  const gastosCategoria = tablaCategorias.filas

  return (
    <>
      <Encabezado titulo="Reportes" subtitulo={`Del ${formatearFecha(rango.desde)} al ${formatearFecha(rango.hasta)}.`}>
        <Button variant="outline-primary" onClick={() => void pdfEstado()} disabled={!estado}>
          <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
          Estado de resultados
        </Button>
        <Button variant="outline-primary" onClick={() => void pdfGastos()} disabled={!resumen}>
          <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
          Gastos por categoría
        </Button>
        <Button variant="outline-primary" onClick={() => void csv()}>
          <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
          Movimientos
        </Button>
      </Encabezado>

      <Avisos error={error} aviso={aviso} onCerrar={limpiar} />

      <div className="ft-filtros ft-filtros-fechas">
        <Form.Group controlId="rep-desde">
          <Form.Label>Desde</Form.Label>
          <Form.Control type="date" value={borrador.desde} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} />
        </Form.Group>
        <Form.Group controlId="rep-hasta">
          <Form.Label>Hasta</Form.Label>
          <Form.Control type="date" value={borrador.hasta} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} />
        </Form.Group>
        <div className="ft-acciones align-self-end">
          <Button onClick={() => aplicar(borrador)}>Ver reporte</Button>
          <Button variant="link" onClick={esteMes}>Este mes</Button>
          <Button variant="link" onClick={mesAnterior}>Mes anterior</Button>
          <Button variant="link" onClick={esteAnio}>Este año</Button>
        </div>
      </div>

      {!estado || !resumen ? (
        <p className="ft-vacio">Cargando…</p>
      ) : (
        <div className="row g-5">
          <section className="col-12 col-xl-6" aria-labelledby="t-estado">
            <h2 id="t-estado" className="ft-seccion-titulo">Estado de resultados</h2>
            {estado.filas.length === 0 ? (
              <p className="ft-vacio">No hay movimientos en este periodo.</p>
            ) : (
              <table className="ft-tabla">
                <thead>
                  <tr>
                    <ThOrdenable clave="concepto" orden={ordenIngresos.orden} onOrdenar={alternarEstado}>Concepto</ThOrdenable>
                    <ThOrdenable clave="total" orden={ordenIngresos.orden} onOrdenar={alternarEstado} derecha>Total</ThOrdenable>
                  </tr>
                </thead>
                <tbody>
                  {ingresos.map((f) => (
                    <tr key={f.categoriaId}>
                      <td className="ps-3">{f.nombre}</td>
                      <td className="derecha ft-monto ingreso">{formatearMoneda(f.total)}</td>
                    </tr>
                  ))}
                  <tr className="ft-fila-subtotal">
                    <td><strong>Total de ingresos</strong></td>
                    <td className="derecha ft-monto ingreso"><strong>{formatearMoneda(estado.totalIngresos)}</strong></td>
                  </tr>
                  {gastos.map((f) => (
                    <tr key={f.categoriaId}>
                      <td className="ps-3">{f.nombre}</td>
                      <td className="derecha ft-monto gasto">− {formatearMoneda(f.total)}</td>
                    </tr>
                  ))}
                  <tr className="ft-fila-subtotal">
                    <td><strong>Total de gastos</strong></td>
                    <td className="derecha ft-monto gasto"><strong>− {formatearMoneda(estado.totalGastos)}</strong></td>
                  </tr>
                </tbody>
              </table>
            )}
            <dl className="ft-libro mt-3">
              <div className="ft-libro-linea ft-libro-total">
                <dt>Utilidad</dt>
                <dd className={estado.utilidad < 0 ? 'ft-monto gasto' : ''}>{formatearMoneda(estado.utilidad)}</dd>
              </div>
            </dl>
          </section>

          <section className="col-12 col-xl-6" aria-labelledby="t-gastos">
            <h2 id="t-gastos" className="ft-seccion-titulo">Gastos por categoría</h2>
            <GraficoGastos datos={resumen.porCategoria} />
            {gastosCategoria.length > 0 && (
              <table className="ft-tabla mt-3">
                <thead>
                  <tr>
                    <ThOrdenable clave="categoria" orden={tablaCategorias.orden} onOrdenar={tablaCategorias.alternar}>Categoría</ThOrdenable>
                    <ThOrdenable clave="cantidad" orden={tablaCategorias.orden} onOrdenar={tablaCategorias.alternar} derecha>Mov.</ThOrdenable>
                    <ThOrdenable clave="total" orden={tablaCategorias.orden} onOrdenar={tablaCategorias.alternar} derecha>Total</ThOrdenable>
                    <th scope="col" className="derecha">%</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosCategoria.map((c) => (
                    <tr key={c.categoriaId}>
                      <td><Emoji valor={c.icono} />{c.nombre}</td>
                      <td className="derecha ft-tenue">{c.cantidad}</td>
                      <td className="derecha ft-monto">{formatearMoneda(c.total)}</td>
                      <td className="derecha">{formatearPorcentaje(c.porcentaje)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {resumen.porMes.length > 0 && (
            <section className="col-12" aria-labelledby="t-flujo-rep">
              <h2 id="t-flujo-rep" className="ft-seccion-titulo">Ingresos y gastos por mes</h2>
              <GraficoFlujo datos={resumen.porMes} />
            </section>
          )}
        </div>
      )}
    </>
  )
}
