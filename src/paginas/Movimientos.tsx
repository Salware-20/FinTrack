import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import type { Categoria, Cuenta, Transaccion } from '../models'
import { EstadoTransaccion, METODOS_PAGO, MetodoPago, TipoTransaccion } from '../models'
import type { FiltroTransacciones } from '../models/tipos'
import { finanzasService } from '../services'
import { etiquetaCategoria } from '../componentes/ayudas'
import { Avisos } from '../componentes/Avisos'
import { cargarEjemplos } from '../componentes/ejemplos'
import { Encabezado } from '../componentes/Encabezado'
import { useAvisos } from '../componentes/useAvisos'
import { fechaHoy, formatearFecha, formatearMetodoPago, formatearMoneda } from '../utils/formato'
import { sumarMontos } from '../utils/numeros'

interface Filtros {
  texto: string
  tipo: '' | TipoTransaccion
  cuentaId: string
  desde: string
  hasta: string
}

const FILTROS_VACIOS: Filtros = { texto: '', tipo: '', cuentaId: '', desde: '', hasta: '' }

export function Movimientos() {
  const { error, aviso, fallo, mostrarError, exito, limpiar } = useAvisos()
  const [version, setVersion] = useState(0)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [lista, setLista] = useState<Transaccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Formulario de movimiento nuevo
  const [tipo, setTipo] = useState<TipoTransaccion>(TipoTransaccion.Gasto)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(fechaHoy())
  const [descripcion, setDescripcion] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [cuentaElegida, setCuentaElegida] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>(MetodoPago.Efectivo)
  const [estado, setEstado] = useState<EstadoTransaccion>(EstadoTransaccion.Confirmado)
  const [etiquetas, setEtiquetas] = useState('')

  const recargar = () => setVersion((v) => v + 1)

  useEffect(() => {
    let activo = true
    const filtro: FiltroTransacciones = {}
    if (filtros.texto.trim()) filtro.texto = filtros.texto.trim()
    if (filtros.tipo) filtro.tipo = filtros.tipo
    if (filtros.cuentaId) filtro.cuentaId = filtros.cuentaId
    if (filtros.desde) filtro.desde = filtros.desde
    if (filtros.hasta) filtro.hasta = filtros.hasta

    Promise.all([
      finanzasService.listarTransacciones(filtro),
      finanzasService.listarCategorias(),
      finanzasService.listarCuentas(),
    ])
      .then(([tx, cat, cta]) => {
        if (!activo) return
        setLista(tx)
        setCategorias(cat)
        setCuentas(cta)
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
  }, [filtros, version, fallo])

  const cuentasActivas = cuentas.filter((c) => c.activa)
  const cuentaEfectiva = cuentaElegida || cuentasActivas[0]?.id || ''
  const categoriasDelTipo = categorias
    .filter((c) => c.tipo === tipo)
    .map((c) => ({ id: c.id, texto: etiquetaCategoria(c, categorias) }))
    .sort((a, b) => a.texto.localeCompare(b.texto, 'es'))

  const nombreCategoria = (id: string) => {
    const c = categorias.find((x) => x.id === id)
    return c ? etiquetaCategoria(c, categorias) : 'Sin categoría'
  }
  const nombreCuenta = (id: string) => cuentas.find((c) => c.id === id)?.nombre ?? 'Sin cuenta'

  const totalIngresos = sumarMontos(lista.filter((t) => t.tipo === TipoTransaccion.Ingreso).map((t) => t.monto))
  const totalGastos = sumarMontos(lista.filter((t) => t.tipo === TipoTransaccion.Gasto).map((t) => t.monto))

  const cambiarFiltro = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) =>
    setFiltros((previos) => ({ ...previos, [campo]: valor }))

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setGuardando(true)
    try {
      await finanzasService.crearTransaccion({
        monto: Number(monto.replace(',', '.')),
        tipo,
        fecha,
        descripcion,
        categoriaId,
        cuentaId: cuentaEfectiva,
        metodoPago: metodo,
        estado,
        etiquetas: etiquetas.split(',').map((e) => e.trim()).filter(Boolean),
      })
      exito('Movimiento guardado.')
      setMonto('')
      setDescripcion('')
      setEtiquetas('')
      recargar()
    } catch (causa) {
      fallo(causa)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (t: Transaccion) => {
    if (!window.confirm(`¿Eliminar "${t.descripcion}"? No se puede deshacer.`)) return
    try {
      await finanzasService.eliminarTransaccion(t.id)
      exito('Movimiento eliminado.')
      recargar()
    } catch (causa) {
      fallo(causa)
    }
  }

  const ejemplos = async () => {
    try {
      const creados = await cargarEjemplos(categorias, cuentas)
      exito(`Se cargaron ${creados} movimientos de ejemplo.`)
      recargar()
    } catch (causa) {
      mostrarError(causa instanceof Error ? causa.message : 'No se pudieron crear los ejemplos.')
    }
  }

  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS)

  return (
    <>
      <Encabezado titulo="Movimientos" subtitulo="Todo lo que entra y sale, en orden.">
        <Button variant="outline-primary" onClick={() => void ejemplos()}>
          Cargar ejemplos
        </Button>
        <Button onClick={() => setFormularioAbierto((abierto) => !abierto)} aria-expanded={formularioAbierto}>
          <i className={`bi ${formularioAbierto ? 'bi-x-lg' : 'bi-plus-lg'} me-1`} aria-hidden="true" />
          {formularioAbierto ? 'Cerrar' : 'Nuevo movimiento'}
        </Button>
      </Encabezado>

      <Avisos error={error} aviso={aviso} onCerrar={limpiar} />

      {formularioAbierto && (
        <Form className="ft-panel" onSubmit={(e) => void guardar(e)}>
          <div className="ft-selector-tipo mb-3" role="group" aria-label="Tipo de movimiento">
            {[TipoTransaccion.Gasto, TipoTransaccion.Ingreso].map((valor) => (
              <button
                key={valor}
                type="button"
                className={`${valor}${tipo === valor ? ' activo' : ''}`}
                aria-pressed={tipo === valor}
                onClick={() => {
                  setTipo(valor)
                  setCategoriaId('')
                }}
              >
                {valor === TipoTransaccion.Gasto ? 'Gasto' : 'Ingreso'}
              </button>
            ))}
          </div>

          <div className="ft-rejilla">
            <Form.Group controlId="mov-monto">
              <Form.Label>Monto (₡)</Form.Label>
              <Form.Control inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            </Form.Group>
            <Form.Group controlId="mov-fecha">
              <Form.Label>Fecha</Form.Label>
              <Form.Control type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </Form.Group>
            <Form.Group controlId="mov-descripcion" className="ft-ancho-doble">
              <Form.Label>Descripción</Form.Label>
              <Form.Control value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required />
            </Form.Group>
            <Form.Group controlId="mov-categoria">
              <Form.Label>Categoría</Form.Label>
              <Form.Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
                <option value="">Elegir categoría</option>
                {categoriasDelTipo.map((c) => (
                  <option key={c.id} value={c.id}>{c.texto}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="mov-cuenta">
              <Form.Label>Cuenta</Form.Label>
              <Form.Select value={cuentaEfectiva} onChange={(e) => setCuentaElegida(e.target.value)} required>
                {cuentasActivas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="mov-metodo">
              <Form.Label>Método de pago</Form.Label>
              <Form.Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                {METODOS_PAGO.map((m) => (
                  <option key={m} value={m}>{formatearMetodoPago(m)}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="mov-estado">
              <Form.Label>Estado</Form.Label>
              <Form.Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoTransaccion)}>
                <option value={EstadoTransaccion.Confirmado}>Confirmado</option>
                <option value={EstadoTransaccion.Pendiente}>Pendiente</option>
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="mov-etiquetas">
              <Form.Label>Etiquetas</Form.Label>
              <Form.Control value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="Separadas por coma" />
            </Form.Group>
          </div>

          <Button type="submit" className="mt-3" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar movimiento'}
          </Button>
        </Form>
      )}

      <div className="ft-filtros" role="search" aria-label="Filtrar movimientos">
        <Form.Control
          aria-label="Buscar"
          placeholder="Buscar por descripción o etiqueta"
          value={filtros.texto}
          onChange={(e) => cambiarFiltro('texto', e.target.value)}
        />
        <Form.Select aria-label="Tipo" value={filtros.tipo} onChange={(e) => cambiarFiltro('tipo', e.target.value as Filtros['tipo'])}>
          <option value="">Ingresos y gastos</option>
          <option value={TipoTransaccion.Ingreso}>Solo ingresos</option>
          <option value={TipoTransaccion.Gasto}>Solo gastos</option>
        </Form.Select>
        <Form.Select aria-label="Cuenta" value={filtros.cuentaId} onChange={(e) => cambiarFiltro('cuentaId', e.target.value)}>
          <option value="">Todas las cuentas</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Form.Select>
        <Form.Control type="date" aria-label="Desde" value={filtros.desde} onChange={(e) => cambiarFiltro('desde', e.target.value)} />
        <Form.Control type="date" aria-label="Hasta" value={filtros.hasta} onChange={(e) => cambiarFiltro('hasta', e.target.value)} />
        {hayFiltros && (
          <Button variant="link" className="p-0 text-start" onClick={() => setFiltros(FILTROS_VACIOS)}>
            Quitar filtros
          </Button>
        )}
      </div>

      {cargando ? (
        <p className="ft-vacio">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="ft-vacio">
          {hayFiltros ? 'Ningún movimiento coincide con esos filtros.' : 'Todavía no hay movimientos. Registre el primero con “Nuevo movimiento”.'}
        </p>
      ) : (
        <>
          <p className="ft-resumen-linea">
            {lista.length} {lista.length === 1 ? 'movimiento' : 'movimientos'}:{' '}
            <span className="ft-monto ingreso">+ {formatearMoneda(totalIngresos)}</span>{' '}y{' '}
            <span className="ft-monto gasto">− {formatearMoneda(totalGastos)}</span>
          </p>
          <div className="table-responsive">
            <table className="ft-tabla">
              <thead>
                <tr>
                  <th scope="col">Movimiento</th>
                  <th scope="col">Fecha</th>
                  <th scope="col" className="derecha">Monto</th>
                  <th scope="col"><span className="visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => {
                  const esIngreso = t.tipo === TipoTransaccion.Ingreso
                  return (
                    <tr key={t.id}>
                      <td>
                        <span className={`ft-tipo-icono ${esIngreso ? 'ingreso' : 'gasto'}`}>
                          <i className={`bi ${esIngreso ? 'bi-arrow-down-left' : 'bi-arrow-up-right'}`} aria-hidden="true" />
                        </span>
                        {t.descripcion}
                        {t.estado === EstadoTransaccion.Pendiente && <span className="ft-etiqueta-estado">Pendiente</span>}
                        <small style={{ marginLeft: '2.5rem' }}>
                          {nombreCategoria(t.categoriaId)} · {nombreCuenta(t.cuentaId)} · {formatearMetodoPago(t.metodoPago)}
                        </small>
                      </td>
                      <td className="text-nowrap">{formatearFecha(t.fecha)}</td>
                      <td className={`derecha ft-monto ${esIngreso ? 'ingreso' : 'gasto'}`}>
                        {esIngreso ? '+' : '−'} {formatearMoneda(t.monto)}
                      </td>
                      <td className="derecha">
                        <button type="button" className="ft-icono-btn" aria-label={`Eliminar ${t.descripcion}`} onClick={() => void eliminar(t)}>
                          <i className="bi bi-trash3" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
