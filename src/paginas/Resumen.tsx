import { useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import type { Categoria, Cuenta, SaldoCuenta, Transaccion, Usuario } from '../models'
import { TipoTransaccion } from '../models'
import type { ResumenFinanciero } from '../models/tipos'
import { finanzasService } from '../services'
import { ICONO_CUENTA } from '../componentes/ayudas'
import { GraficoFlujo } from '../componentes/Graficos'
import { finDeMes, formatearFecha, formatearMoneda, inicioDeMes } from '../utils/formato'
import { sumarMontos } from '../utils/numeros'

interface Props {
  usuario: Usuario
  onIrAMovimientos: () => void
}

export function Resumen({ usuario, onIrAMovimientos }: Props) {
  const [mes, setMes] = useState<ResumenFinanciero | null>(null)
  const [total, setTotal] = useState<ResumenFinanciero | null>(null)
  const [saldos, setSaldos] = useState<SaldoCuenta[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [ultimas, setUltimas] = useState<Transaccion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    Promise.all([
      finanzasService.obtenerResumen({ desde: inicioDeMes(), hasta: finDeMes() }),
      finanzasService.obtenerResumen(),
      finanzasService.obtenerSaldos(),
      finanzasService.listarCategorias(),
      finanzasService.listarCuentas(),
      finanzasService.listarTransacciones(),
    ])
      .then(([resumen, general, sal, cat, cta, tx]) => {
        if (!activo) return
        setMes(resumen)
        setTotal(general)
        setSaldos(sal)
        setCategorias(cat)
        setCuentas(cta)
        setUltimas(tx.slice(0, 8))
      })
      .catch((fallo: unknown) => {
        if (!activo) return
        setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar los datos.')
      })
    return () => {
      activo = false
    }
  }, [])

  if (error) return <p className="text-danger" role="alert">{error}</p>
  if (!mes) return <p className="ft-vacio">Cargando…</p>

  const nombreMes = new Date().toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })
  const patrimonio = sumarMontos(saldos.map((s) => s.saldo))
  const nombreCategoria = (id: string) =>
    categorias.find((c) => c.id === id)?.nombre ?? 'Sin categoría'
  const nombreCuenta = (id: string) => cuentas.find((c) => c.id === id)?.nombre ?? 'Sin cuenta'

  return (
    <>
      <header className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 className="ft-titulo">Hola, {usuario.nombre.split(' ')[0]}</h1>
          <p className="ft-subtitulo">Así va {nombreMes}.</p>
        </div>
        <Button onClick={onIrAMovimientos}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Registrar movimiento
        </Button>
      </header>

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
              <dt>Queda</dt>
              <dd className={mes.balance < 0 ? 'ft-monto gasto' : ''}>
                {formatearMoneda(mes.balance)}
              </dd>
            </div>
          </dl>

          <h2 className="ft-seccion-titulo mt-5">Mis cuentas</h2>
          {saldos.length === 0 ? (
            <p className="ft-vacio">Aún no hay cuentas.</p>
          ) : (
            <ul className="ft-lista-cuentas">
              {saldos.map((cuenta) => (
                <li key={cuenta.cuentaId}>
                  <span>
                    <i className={`bi ${ICONO_CUENTA[cuenta.tipo] ?? 'bi-wallet'}`} aria-hidden="true" />
                    {cuenta.nombre}
                  </span>
                  <span className={`ft-monto ${cuenta.saldo < 0 ? 'gasto' : ''}`}>
                    {formatearMoneda(cuenta.saldo)}
                  </span>
                </li>
              ))}
              <li>
                <strong>Total</strong>
                <strong className="ft-monto">{formatearMoneda(patrimonio)}</strong>
              </li>
            </ul>
          )}
        </section>

        <section className="col-12 col-xl-7" aria-labelledby="t-movs">
          <h2 id="t-movs" className="ft-seccion-titulo">Últimos movimientos</h2>
          {ultimas.length === 0 ? (
            <p className="ft-vacio">
              Todavía no hay movimientos. Registre el primero y aparecerá aquí.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="ft-tabla">
                <thead>
                  <tr>
                    <th scope="col">Movimiento</th>
                    <th scope="col">Fecha</th>
                    <th scope="col" className="derecha">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimas.map((t) => {
                    const esIngreso = t.tipo === TipoTransaccion.Ingreso
                    return (
                      <tr key={t.id}>
                        <td>
                          <span className={`ft-tipo-icono ${esIngreso ? 'ingreso' : 'gasto'}`}>
                            <i
                              className={`bi ${esIngreso ? 'bi-arrow-down-left' : 'bi-arrow-up-right'}`}
                              aria-hidden="true"
                            />
                          </span>
                          {t.descripcion}
                          <small style={{ marginLeft: '2.5rem' }}>
                            {nombreCategoria(t.categoriaId)} · {nombreCuenta(t.cuentaId)}
                          </small>
                        </td>
                        <td className="text-nowrap">{formatearFecha(t.fecha)}</td>
                        <td className={`derecha ft-monto ${esIngreso ? 'ingreso' : 'gasto'}`}>
                          {esIngreso ? '+' : '−'} {formatearMoneda(t.monto)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {total && total.porMes.length > 0 && (
        <section className="mt-5" aria-labelledby="t-flujo">
          <h2 id="t-flujo" className="ft-seccion-titulo">Ingresos y gastos por mes</h2>
          <GraficoFlujo datos={total.porMes} />
        </section>
      )}
    </>
  )
}
