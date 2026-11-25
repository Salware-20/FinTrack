import { Fragment, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import type { Categoria, Presupuesto, Transaccion } from '../models'
import { TipoTransaccion } from '../models'
import type { EstadoPresupuesto } from '../models/tipos'
import { finanzasService } from '../services'
import { Avance } from '../componentes/Avance'
import { mensajeDeError } from '../componentes/ayudas'
import { Avisos } from '../componentes/Avisos'
import { Confirmar } from '../componentes/Confirmar'
import type { PeticionConfirmar } from '../componentes/Confirmar'
import { Emoji } from '../componentes/Emoji'
import { Encabezado } from '../componentes/Encabezado'
import { porNumero, porTexto } from '../componentes/orden'
import { SelectorOrden } from '../componentes/SelectorOrden'
import { ThOrdenable } from '../componentes/ThOrdenable'
import { useAvisos } from '../componentes/useAvisos'
import { useOrden } from '../componentes/useOrden'
import { formatearMoneda, formatearPorcentaje } from '../utils/formato'
import { sumarMontos } from '../utils/numeros'

interface Uso {
  cantidad: number
  total: number
}

interface EdicionPresupuesto {
  categoria: Categoria
  existente?: Presupuesto
}

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Categorias() {
  const { error, aviso, fallo, exito, limpiar } = useAvisos()
  const [version, setVersion] = useState(0)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [estados, setEstados] = useState<EstadoPresupuesto[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmar, setConfirmar] = useState<PeticionConfirmar | null>(null)

  const [vista, setVista] = useState<TipoTransaccion>(TipoTransaccion.Gasto)
  const [busqueda, setBusqueda] = useState('')
  const [soloConLimite, setSoloConLimite] = useState(false)

  const [formAbierto, setFormAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoTransaccion>(TipoTransaccion.Gasto)
  const [padreId, setPadreId] = useState('')
  const [color, setColor] = useState('#1f6b55')
  const [icono, setIcono] = useState('')

  const [edicion, setEdicion] = useState<EdicionPresupuesto | null>(null)
  const [limite, setLimite] = useState('')
  const [alerta, setAlerta] = useState(80)
  const [errorPresupuesto, setErrorPresupuesto] = useState<string | null>(null)

  const recargar = () => setVersion((v) => v + 1)

  useEffect(() => {
    let activo = true
    Promise.all([
      finanzasService.listarCategorias(),
      finanzasService.listarTransacciones(),
      finanzasService.listarPresupuestos(),
      finanzasService.obtenerEstadoPresupuestos(),
    ])
      .then(([cat, tx, pre, est]) => {
        if (!activo) return
        setCategorias(cat)
        setTransacciones(tx)
        setPresupuestos(pre)
        setEstados(est)
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

  const uso = new Map<string, Uso>()
  for (const t of transacciones) {
    const actual = uso.get(t.categoriaId) ?? { cantidad: 0, total: 0 }
    uso.set(t.categoriaId, { cantidad: actual.cantidad + 1, total: actual.total + t.monto })
  }
  const usoDe = (id: string): Uso => uso.get(id) ?? { cantidad: 0, total: 0 }
  const totalDelTipo = sumarMontos(transacciones.filter((t) => t.tipo === vista).map((t) => t.monto))
  const presupuestoDe = (id: string) => presupuestos.find((p) => p.categoriaId === id && p.activo)
  const estadoDe = (id: string) => estados.find((e) => e.categoriaId === id)

  const comparadores = {
    categoria: porTexto<Categoria>((c) => c.nombre),
    movimientos: porNumero<Categoria>((c) => usoDe(c.id).cantidad),
    total: porNumero<Categoria>((c) => usoDe(c.id).total),
    presupuesto: porNumero<Categoria>((c) => presupuestoDe(c.id)?.montoLimite ?? null),
  }

  // Se ordenan las principales y, dentro de cada una, sus subcategorías: el árbol no se rompe
  const delTipo = categorias.filter((c) => c.tipo === vista)
  const tabla = useOrden(delTipo.filter((c) => !c.padreId), comparadores)
  const hijas = useOrden(delTipo.filter((c) => c.padreId), comparadores)

  const coincide = (c: Categoria) =>
    (!busqueda || normalizar(c.nombre).includes(normalizar(busqueda))) &&
    (!soloConLimite || Boolean(presupuestoDe(c.id)))

  // Al filtrar, una principal se ve si coincide ella o alguna de sus subcategorías
  const filtrando = Boolean(busqueda) || soloConLimite
  const grupos = tabla.filas
    .map((raiz) => {
      const suyas = hijas.filas.filter((h) => h.padreId === raiz.id)
      const visibles = filtrando ? suyas.filter(coincide) : suyas
      return { raiz, hijas: visibles, mostrar: !filtrando || coincide(raiz) || visibles.length > 0 }
    })
    .filter((g) => g.mostrar)

  const posiblesPadres = categorias
    .filter((c) => c.tipo === tipo && !c.padreId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const crear = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    try {
      await finanzasService.crearCategoria({
        nombre,
        tipo,
        padreId: padreId || null,
        color,
        icono: icono.trim() || undefined,
      })
      exito(`Categoría “${nombre}” creada.`)
      setNombre('')
      setIcono('')
      setPadreId('')
      setVista(tipo)
      recargar()
    } catch (causa) {
      fallo(causa)
    }
  }

  const abrirPresupuesto = (categoria: Categoria) => {
    const existente = presupuestoDe(categoria.id)
    setEdicion({ categoria, existente })
    setLimite(existente ? String(existente.montoLimite) : '')
    setAlerta(existente?.alertaPorcentaje ?? 80)
    setErrorPresupuesto(null)
  }

  const guardarPresupuesto = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (!edicion) return
    const monto = Number(limite.replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorPresupuesto('Ingrese un monto mayor que cero.')
      return
    }
    try {
      if (edicion.existente) {
        await finanzasService.actualizarPresupuesto(edicion.existente.id, { montoLimite: monto, alertaPorcentaje: alerta })
        exito(`Presupuesto de “${edicion.categoria.nombre}” actualizado.`)
      } else {
        await finanzasService.crearPresupuesto({ categoriaId: edicion.categoria.id, montoLimite: monto, alertaPorcentaje: alerta })
        exito(`Presupuesto de “${edicion.categoria.nombre}” fijado.`)
      }
      setEdicion(null)
      recargar()
    } catch (causa) {
      setErrorPresupuesto(mensajeDeError(causa))
    }
  }

  const pedirQuitarPresupuesto = () => {
    if (!edicion?.existente) return
    const { categoria, existente } = edicion
    setEdicion(null)
    setConfirmar({
      titulo: 'Quitar presupuesto',
      mensaje: (
        <p className="mb-0">
          <strong>{categoria.nombre}</strong> quedará sin límite mensual. Los movimientos registrados no se modifican.
        </p>
      ),
      accion: 'Quitar límite',
      peligro: true,
      alAceptar: async () => {
        try {
          await finanzasService.eliminarPresupuesto(existente.id)
          exito('Presupuesto eliminado.')
          recargar()
        } catch (causa) {
          fallo(causa)
        }
      },
    })
  }

  const esGasto = vista === TipoTransaccion.Gasto

  const fila = (c: Categoria, esHija: boolean) => {
    const u = usoDe(c.id)
    const pres = presupuestoDe(c.id)
    const est = estadoDe(c.id)
    return (
      <tr key={c.id} className={esHija ? 'ft-fila-hija' : 'ft-fila-raiz'}>
        <td className="ft-celda-principal">
          <span className="ft-punto" style={{ background: c.color }} aria-hidden="true" />
          <Emoji valor={c.icono} />
          {c.nombre}
          {esHija && <span className="visually-hidden"> (subcategoría)</span>}
        </td>
        <td data-label="Movimientos" className="derecha">{u.cantidad}</td>
        <td data-label="Total" className="derecha ft-monto">{formatearMoneda(u.total)}</td>
        <td data-label="% del tipo" className="derecha ft-tenue">
          {totalDelTipo === 0 ? '—' : formatearPorcentaje((u.total / totalDelTipo) * 100)}
        </td>
        {esGasto && (
          <td data-label="Presupuesto" className="derecha ft-celda-presupuesto">
            {pres ? (
              <button type="button" className="ft-presupuesto" onClick={() => abrirPresupuesto(c)} title="Editar presupuesto">
                <span className="ft-monto">{formatearMoneda(pres.montoLimite)}</span>
                {est && (
                  <>
                    <Avance porcentaje={est.porcentajeConsumido} estado={est.estadoAlerta} etiqueta={`Consumo de ${c.nombre}`} />
                    <small className={`ft-presupuesto-uso ${est.estadoAlerta}`}>
                      {formatearPorcentaje(est.porcentajeConsumido)} este mes
                    </small>
                  </>
                )}
              </button>
            ) : (
              <Button variant="link" size="sm" className="ft-fijar" onClick={() => abrirPresupuesto(c)}>
                <i className="bi bi-plus me-1" aria-hidden="true" />
                Definir límite
              </Button>
            )}
          </td>
        )}
      </tr>
    )
  }

  return (
    <>
      <Encabezado titulo="Categorías" subtitulo="Clasificación de ingresos y gastos, y presupuestos mensuales por categoría.">
        <Button onClick={() => setFormAbierto((v) => !v)} aria-expanded={formAbierto}>
          <i className={`bi ${formAbierto ? 'bi-x-lg' : 'bi-plus-lg'} me-1`} aria-hidden="true" />
          {formAbierto ? 'Cerrar' : 'Nueva categoría'}
        </Button>
      </Encabezado>
      <Avisos error={error} aviso={aviso} onCerrar={limpiar} />

      {formAbierto && (
        <Form className="ft-panel" onSubmit={(e) => void crear(e)} aria-label="Nueva categoría">
          <h2 className="ft-seccion-titulo">Nueva categoría</h2>
          <div className="ft-rejilla">
            <Form.Group controlId="cat-nombre" className="ft-ancho-doble">
              <Form.Label>Nombre</Form.Label>
              <Form.Control value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ejemplo: Peajes" required />
            </Form.Group>
            <Form.Group controlId="cat-tipo">
              <Form.Label>Tipo</Form.Label>
              <Form.Select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as TipoTransaccion)
                  setPadreId('')
                }}
              >
                <option value={TipoTransaccion.Gasto}>Gasto</option>
                <option value={TipoTransaccion.Ingreso}>Ingreso</option>
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="cat-padre">
              <Form.Label>Categoría principal</Form.Label>
              <Form.Select value={padreId} onChange={(e) => setPadreId(e.target.value)}>
                <option value="">Ninguna (categoría principal)</option>
                {posiblesPadres.map((c) => (
                  <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="cat-icono">
              <Form.Label>Emoji (opcional)</Form.Label>
              <Form.Control value={icono} onChange={(e) => setIcono(e.target.value)} maxLength={4} placeholder="🏷️" />
            </Form.Group>
            <Form.Group controlId="cat-color">
              <Form.Label>Color</Form.Label>
              <Form.Control type="color" className="ft-color" value={color} onChange={(e) => setColor(e.target.value)} title="Elegir color" />
            </Form.Group>
          </div>
          <div className="ft-acciones mt-3">
            <Button type="submit">Crear categoría</Button>
            <Button variant="outline-secondary" onClick={() => setFormAbierto(false)}>Cancelar</Button>
          </div>
        </Form>
      )}

      <div className="ft-barra-filtros">
        <div className="ft-selector-tipo" role="group" aria-label="Qué categorías ver">
          {[TipoTransaccion.Gasto, TipoTransaccion.Ingreso].map((valor) => (
            <button
              key={valor}
              type="button"
              className={`${valor}${vista === valor ? ' activo' : ''}`}
              aria-pressed={vista === valor}
              onClick={() => {
                setVista(valor)
                if (valor === TipoTransaccion.Ingreso) setSoloConLimite(false)
              }}
            >
              {valor === TipoTransaccion.Gasto ? 'Gastos' : 'Ingresos'}
            </button>
          ))}
        </div>
        <Form.Control
          type="search"
          className="ft-filtro-texto"
          aria-label="Buscar categoría"
          placeholder="Buscar categoría"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {esGasto && (
          <Form.Check
            type="switch"
            id="cat-solo-limite"
            label="Solo con presupuesto"
            checked={soloConLimite}
            onChange={(e) => setSoloConLimite(e.target.checked)}
          />
        )}
        <SelectorOrden
          id="orden-categorias"
          orden={tabla.orden}
          onCambiar={(o) => {
            tabla.fijar(o)
            hijas.fijar(o)
          }}
          columnas={[
            { clave: 'total', texto: 'Total' },
            { clave: 'movimientos', texto: 'Movimientos' },
            { clave: 'categoria', texto: 'Nombre' },
            ...(esGasto ? [{ clave: 'presupuesto', texto: 'Presupuesto' }] : []),
          ]}
        />
      </div>

      {cargando ? (
        <p className="ft-vacio">Cargando…</p>
      ) : grupos.length === 0 ? (
        <p className="ft-vacio">
          {busqueda || soloConLimite ? 'Ninguna categoría coincide.' : `No hay categorías de ${esGasto ? 'gasto' : 'ingreso'}.`}
        </p>
      ) : (
        <table className="ft-tabla ft-tabla-apilada ft-tabla-categorias">
          <thead>
            <tr>
              {(['categoria', 'movimientos', 'total'] as const).map((clave) => (
                <ThOrdenable
                  key={clave}
                  clave={clave}
                  orden={tabla.orden}
                  derecha={clave !== 'categoria'}
                  onOrdenar={(c) => {
                    tabla.alternar(c)
                    hijas.alternar(c)
                  }}
                >
                  {clave === 'categoria' ? 'Categoría' : clave === 'movimientos' ? 'Movimientos' : 'Total'}
                </ThOrdenable>
              ))}
              <th scope="col" className="derecha">% del tipo</th>
              {esGasto && (
                <ThOrdenable
                  clave="presupuesto"
                  orden={tabla.orden}
                  derecha
                  onOrdenar={(c) => {
                    tabla.alternar(c)
                    hijas.alternar(c)
                  }}
                >
                  Presupuesto mensual
                </ThOrdenable>
              )}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <Fragment key={g.raiz.id}>
                {fila(g.raiz, false)}
                {g.hijas.map((h) => fila(h, true))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      <p className="ft-nota mt-3">
        Las subcategorías heredan el tipo de su padre. Los totales cuentan todos los movimientos, también los pendientes.
        {esGasto && ' El presupuesto de una categoría principal suma también sus subcategorías.'}
      </p>

      <Modal show={edicion !== null} onHide={() => setEdicion(null)} centered className="ft-modal">
        {edicion && (
          <Form onSubmit={(e) => void guardarPresupuesto(e)}>
            <Modal.Header closeButton>
              <Modal.Title as="h2">
                <Emoji valor={edicion.categoria.icono} />
                {edicion.categoria.nombre}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {errorPresupuesto && <p className="text-danger small" role="alert">{errorPresupuesto}</p>}
              <Form.Group className="mb-4" controlId="pre-monto">
                <Form.Label>Límite por mes (₡)</Form.Label>
                <Form.Control
                  inputMode="decimal"
                  value={limite}
                  onChange={(e) => setLimite(e.target.value)}
                  placeholder="Ejemplo: 150000"
                  autoFocus
                  required
                />
                {!edicion.categoria.padreId && <Form.Text>Incluye el gasto de sus subcategorías.</Form.Text>}
              </Form.Group>
              <Form.Group controlId="pre-alerta">
                <Form.Label className="d-flex justify-content-between">
                  <span>Umbral de alerta</span>
                  <strong>{alerta} %</strong>
                </Form.Label>
                <Form.Range min={1} max={100} value={alerta} onChange={(e) => setAlerta(Number(e.target.value))} />
                {Number(limite) > 0 && (
                  <Form.Text>
                    Es decir, cuando el gasto del mes pase de {formatearMoneda((Number(limite.replace(',', '.')) * alerta) / 100)}.
                  </Form.Text>
                )}
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="justify-content-between">
              {edicion.existente ? (
                <Button variant="link" className="text-danger p-0" onClick={pedirQuitarPresupuesto}>
                  Quitar límite
                </Button>
              ) : (
                <span />
              )}
              <div className="ft-acciones">
                <Button variant="outline-secondary" onClick={() => setEdicion(null)}>Cancelar</Button>
                <Button type="submit">Guardar</Button>
              </div>
            </Modal.Footer>
          </Form>
        )}
      </Modal>

      <Confirmar peticion={confirmar} onCerrar={() => setConfirmar(null)} />
    </>
  )
}
