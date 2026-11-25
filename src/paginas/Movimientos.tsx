import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import type { Categoria, Cuenta, Recurrencia, Transaccion } from '../models'
import {
  EstadoTransaccion,
  FRECUENCIAS_RECURRENCIA,
  FrecuenciaRecurrencia,
  METODOS_PAGO,
  MetodoPago,
  TipoTransaccion,
} from '../models'
import type { FiltroTransacciones } from '../models/tipos'
import { finanzasService } from '../services'
import { etiquetaCategoria, etiquetaConIcono } from '../componentes/ayudas'
import { Avisos } from '../componentes/Avisos'
import { Confirmar } from '../componentes/Confirmar'
import type { PeticionConfirmar } from '../componentes/Confirmar'
import { cargarEjemplos } from '../componentes/ejemplos'
import { Emoji } from '../componentes/Emoji'
import { ImportadorCsv } from '../componentes/ImportadorCsv'
import { Encabezado } from '../componentes/Encabezado'
import { porFecha, porNumero, porTexto } from '../componentes/orden'
import { SelectorOrden } from '../componentes/SelectorOrden'
import { ThOrdenable } from '../componentes/ThOrdenable'
import { useAvisos } from '../componentes/useAvisos'
import { useOrden } from '../componentes/useOrden'
import {
  fechaHoy,
  formatearFecha,
  formatearFrecuencia,
  formatearMetodoPago,
  formatearMoneda,
} from '../utils/formato'
import { sumarMontos } from '../utils/numeros'

interface Filtros {
  texto: string
  tipo: '' | TipoTransaccion
  categoriaId: string
  cuentaId: string
  desde: string
  hasta: string
}

const FILTROS_VACIOS: Filtros = { texto: '', tipo: '', categoriaId: '', cuentaId: '', desde: '', hasta: '' }
const POR_PAGINA = 40

/** "17 nov." para el celular, donde la fecha larga no cabe. */
const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  const fecha = new Date(a, m - 1, d)
  const mismoAnio = a === new Date().getFullYear()
  return fecha.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', ...(mismoAnio ? {} : { year: 'numeric' }) })
}

const TEXTO_FRECUENCIA: Record<FrecuenciaRecurrencia, string> = {
  [FrecuenciaRecurrencia.Diaria]: 'Diaria',
  [FrecuenciaRecurrencia.Semanal]: 'Semanal',
  [FrecuenciaRecurrencia.Mensual]: 'Mensual',
}

interface Formulario {
  tipo: TipoTransaccion
  monto: string
  fecha: string
  descripcion: string
  categoriaId: string
  cuentaId: string
  metodo: MetodoPago
  estado: EstadoTransaccion
  etiquetas: string
  repetir: boolean
  frecuencia: FrecuenciaRecurrencia
  fechaFin: string
}

const formularioNuevo = (): Formulario => ({
  tipo: TipoTransaccion.Gasto,
  monto: '',
  fecha: fechaHoy(),
  descripcion: '',
  categoriaId: '',
  cuentaId: '',
  metodo: MetodoPago.Efectivo,
  estado: EstadoTransaccion.Confirmado,
  etiquetas: '',
  repetir: false,
  frecuencia: FrecuenciaRecurrencia.Mensual,
  fechaFin: '',
})

export function Movimientos() {
  const { error, aviso, fallo, mostrarError, exito, limpiar } = useAvisos()
  const [version, setVersion] = useState(0)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [lista, setLista] = useState<Transaccion[]>([])
  const [reglas, setReglas] = useState<Recurrencia[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<Transaccion | null>(null)
  const [verReglas, setVerReglas] = useState(false)
  const [verFiltros, setVerFiltros] = useState(false)
  const [importando, setImportando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState<Formulario>(formularioNuevo)
  const [confirmar, setConfirmar] = useState<PeticionConfirmar | null>(null)

  const recargar = () => setVersion((v) => v + 1)
  const campo = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setForm((previo) => ({ ...previo, [clave]: valor }))

  useEffect(() => {
    let activo = true
    const filtro: FiltroTransacciones = {}
    if (filtros.texto.trim()) filtro.texto = filtros.texto.trim()
    if (filtros.tipo) filtro.tipo = filtros.tipo
    if (filtros.categoriaId) filtro.categoriaId = filtros.categoriaId
    if (filtros.cuentaId) filtro.cuentaId = filtros.cuentaId
    if (filtros.desde) filtro.desde = filtros.desde
    if (filtros.hasta) filtro.hasta = filtros.hasta

    Promise.all([
      finanzasService.listarTransacciones(filtro),
      finanzasService.listarCategorias(),
      finanzasService.listarCuentas(),
      finanzasService.listarRecurrencias(),
    ])
      .then(([tx, cat, cta, rec]) => {
        if (!activo) return
        setLista(tx)
        setCategorias(cat)
        setCuentas(cta)
        setReglas(rec)
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

  const categoria = (id: string) => categorias.find((c) => c.id === id)
  const nombreCategoria = (id: string) => {
    const c = categoria(id)
    return c ? etiquetaCategoria(c, categorias) : 'Sin categoría'
  }
  const nombreCuenta = (id: string) => cuentas.find((c) => c.id === id)?.nombre ?? 'Sin cuenta'

  const tabla = useOrden(lista, {
    descripcion: porTexto<Transaccion>((t) => t.descripcion),
    categoria: porTexto<Transaccion>((t) => nombreCategoria(t.categoriaId)),
    cuenta: porTexto<Transaccion>((t) => nombreCuenta(t.cuentaId)),
    fecha: porFecha<Transaccion>((t) => t.fecha),
    monto: porNumero<Transaccion>((t) => t.monto),
  })

  const tablaReglas = useOrden(reglas, {
    descripcion: porTexto<Recurrencia>((r) => r.descripcion),
    frecuencia: porTexto<Recurrencia>((r) => formatearFrecuencia(r.frecuencia)),
    proxima: porFecha<Recurrencia>((r) => (r.finalizada ? null : r.proximaFecha)),
    monto: porNumero<Recurrencia>((r) => r.monto),
    estado: porNumero<Recurrencia>((r) => (r.finalizada ? 2 : r.activa ? 0 : 1)),
  })

  const cuentasActivas = cuentas.filter((c) => c.activa)
  const cuentasFormulario = editando
    ? cuentas.filter((c) => c.activa || c.id === editando.cuentaId)
    : cuentasActivas
  const cuentaEfectiva = form.cuentaId || cuentasFormulario[0]?.id || ''
  const opcionesCategoria = (tipo?: TipoTransaccion) =>
    categorias
      .filter((c) => !tipo || c.tipo === tipo)
      .map((c) => ({ id: c.id, texto: etiquetaConIcono(c, categorias), orden: etiquetaCategoria(c, categorias) }))
      .sort((a, b) => a.orden.localeCompare(b.orden, 'es'))

  const totalIngresos = sumarMontos(lista.filter((t) => t.tipo === TipoTransaccion.Ingreso).map((t) => t.monto))
  const totalGastos = sumarMontos(lista.filter((t) => t.tipo === TipoTransaccion.Gasto).map((t) => t.monto))
  const reglasActivas = reglas.filter((r) => r.activa && !r.finalizada).length

  const cambiarFiltro = <K extends keyof Filtros>(clave: K, valor: Filtros[K]) => {
    setVisibles(POR_PAGINA)
    setFiltros((previos) => {
      const siguientes = { ...previos, [clave]: valor }
      // Si se cambia el tipo, la categoría elegida puede dejar de servir
      if (clave === 'tipo' && valor && previos.categoriaId) {
        const c = categoria(previos.categoriaId)
        if (c && c.tipo !== valor) siguientes.categoriaId = ''
      }
      return siguientes
    })
  }

  const cerrarFormulario = () => {
    setAbierto(false)
    setEditando(null)
    setForm(formularioNuevo())
  }

  const abrirNuevo = () => {
    if (abierto && !editando) {
      cerrarFormulario()
      return
    }
    setEditando(null)
    setForm(formularioNuevo())
    setImportando(false)
    setAbierto(true)
  }

  const abrirEdicion = (t: Transaccion) => {
    setEditando(t)
    setForm({
      ...formularioNuevo(),
      tipo: t.tipo,
      monto: String(t.monto),
      fecha: t.fecha,
      descripcion: t.descripcion,
      categoriaId: t.categoriaId,
      cuentaId: t.cuentaId,
      metodo: t.metodoPago,
      estado: t.estado,
      etiquetas: t.etiquetas.join(', '),
    })
    setAbierto(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (form.repetir && form.fechaFin && form.fechaFin < form.fecha) {
      mostrarError('La fecha final de la repetición no puede ser anterior a la fecha de inicio.')
      return
    }
    const datos = {
      monto: Number(form.monto.replace(',', '.')),
      tipo: form.tipo,
      descripcion: form.descripcion,
      categoriaId: form.categoriaId,
      cuentaId: cuentaEfectiva,
      metodoPago: form.metodo,
      etiquetas: form.etiquetas.split(',').map((e) => e.trim()).filter(Boolean),
    }
    setGuardando(true)
    try {
      if (editando) {
        await finanzasService.actualizarTransaccion(editando.id, { ...datos, fecha: form.fecha, estado: form.estado })
        exito('Cambios guardados.')
      } else if (form.repetir) {
        const { recurrencia, generadas } = await finanzasService.crearRecurrencia({
          ...datos,
          fechaInicio: form.fecha,
          frecuencia: form.frecuencia,
          fechaFin: form.fechaFin || null,
        })
        exito(
          generadas === 0
            ? `Regla recurrente creada. El primer movimiento se registrará el ${formatearFecha(recurrencia.proximaFecha)}.`
            : `Regla recurrente creada. Se ${generadas === 1 ? 'registró 1 movimiento vencido' : `registraron ${generadas} movimientos vencidos`} a la fecha.`,
        )
        setVerReglas(true)
      } else {
        await finanzasService.crearTransaccion({ ...datos, fecha: form.fecha, estado: form.estado })
        exito('Movimiento guardado.')
      }
      cerrarFormulario()
      recargar()
    } catch (causa) {
      fallo(causa)
    } finally {
      setGuardando(false)
    }
  }

  const pedirEliminar = (t: Transaccion) =>
    setConfirmar({
      titulo: 'Eliminar movimiento',
      mensaje: (
        <p className="mb-0">
          Se eliminará <strong>{t.descripcion}</strong> del {formatearFecha(t.fecha)} por{' '}
          <strong>{formatearMoneda(t.monto)}</strong>. No se puede deshacer.
        </p>
      ),
      accion: 'Eliminar',
      peligro: true,
      alAceptar: async () => {
        try {
          await finanzasService.eliminarTransaccion(t.id)
          if (editando?.id === t.id) cerrarFormulario()
          exito('Movimiento eliminado.')
          recargar()
        } catch (causa) {
          fallo(causa)
        }
      },
    })

  const cambiarRegla = async (r: Recurrencia) => {
    try {
      await finanzasService.actualizarRecurrencia(r.id, { activa: !r.activa })
      exito(r.activa ? `La regla “${r.descripcion}” se suspendió.` : `La regla “${r.descripcion}” se reactivó y se registraron los movimientos pendientes.`)
      recargar()
    } catch (causa) {
      fallo(causa)
    }
  }

  const pedirEliminarRegla = (r: Recurrencia) =>
    setConfirmar({
      titulo: 'Eliminar regla recurrente',
      mensaje: (
        <p className="mb-0">
          La regla <strong>{r.descripcion}</strong> dejará de generar movimientos. Los movimientos
          generados previamente se conservan en el historial.
        </p>
      ),
      accion: 'Eliminar regla',
      peligro: true,
      alAceptar: async () => {
        try {
          await finanzasService.eliminarRecurrencia(r.id)
          exito('Regla eliminada. Los movimientos generados se conservan.')
          recargar()
        } catch (causa) {
          fallo(causa)
        }
      },
    })

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
  const filas = tabla.filas.slice(0, visibles)

  return (
    <>
      <Encabezado titulo="Movimientos" subtitulo="Registro de ingresos y gastos.">
        <Button variant="outline-primary" onClick={() => void ejemplos()}>
          <i className="bi bi-magic me-1" aria-hidden="true" />
          Cargar datos de ejemplo
        </Button>
        <Button
          variant="outline-primary"
          aria-expanded={importando}
          onClick={() => {
            cerrarFormulario()
            setImportando((v) => !v)
          }}
        >
          <i className="bi bi-file-earmark-arrow-up me-1" aria-hidden="true" />
          Importar estado de cuenta
        </Button>
        <Button onClick={abrirNuevo} aria-expanded={abierto && !editando}>
          <i className={`bi ${abierto && !editando ? 'bi-x-lg' : 'bi-plus-lg'} me-1`} aria-hidden="true" />
          {abierto && !editando ? 'Cerrar' : 'Nuevo movimiento'}
        </Button>
      </Encabezado>

      <Avisos error={error} aviso={aviso} onCerrar={limpiar} />

      {importando && (
        <ImportadorCsv
          cuentas={cuentas}
          categorias={categorias}
          onCerrar={() => setImportando(false)}
          onImportado={(cantidad) => {
            setImportando(false)
            exito(cantidad === 1 ? 'Se importó 1 movimiento.' : `Se importaron ${cantidad} movimientos.`)
            recargar()
          }}
        />
      )}

      {abierto && (
        <Form className="ft-panel" onSubmit={(e) => void guardar(e)} aria-label={editando ? 'Editar movimiento' : 'Nuevo movimiento'}>
          <div className="ft-panel-cabeza">
            <h2 className="ft-seccion-titulo mb-0">{editando ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
            {editando?.recurrenciaId && (
              <span className="ft-nota">
                <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                Movimiento generado por una regla recurrente. Los cambios afectan únicamente a este registro.
              </span>
            )}
          </div>

          <div className="ft-selector-tipo mb-3" role="group" aria-label="Tipo de movimiento">
            {[TipoTransaccion.Gasto, TipoTransaccion.Ingreso].map((valor) => (
              <button
                key={valor}
                type="button"
                className={`${valor}${form.tipo === valor ? ' activo' : ''}`}
                aria-pressed={form.tipo === valor}
                onClick={() => setForm((p) => ({ ...p, tipo: valor, categoriaId: '' }))}
              >
                {valor === TipoTransaccion.Gasto ? 'Gasto' : 'Ingreso'}
              </button>
            ))}
          </div>

          <div className="ft-rejilla">
            <Form.Group controlId="mov-monto">
              <Form.Label>Monto (₡)</Form.Label>
              <Form.Control inputMode="decimal" value={form.monto} onChange={(e) => campo('monto', e.target.value)} required />
            </Form.Group>
            <Form.Group controlId="mov-fecha">
              <Form.Label>{form.repetir ? 'Fecha de inicio' : 'Fecha'}</Form.Label>
              <Form.Control type="date" value={form.fecha} onChange={(e) => campo('fecha', e.target.value)} required />
            </Form.Group>
            <Form.Group controlId="mov-descripcion" className="ft-ancho-doble">
              <Form.Label>Descripción</Form.Label>
              <Form.Control value={form.descripcion} onChange={(e) => campo('descripcion', e.target.value)} required />
            </Form.Group>
            <Form.Group controlId="mov-categoria">
              <Form.Label>Categoría</Form.Label>
              <Form.Select value={form.categoriaId} onChange={(e) => campo('categoriaId', e.target.value)} required>
                <option value="">Seleccione una categoría</option>
                {opcionesCategoria(form.tipo).map((c) => (
                  <option key={c.id} value={c.id}>{c.texto}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="mov-cuenta">
              <Form.Label>Cuenta</Form.Label>
              <Form.Select value={cuentaEfectiva} onChange={(e) => campo('cuentaId', e.target.value)} required>
                {cuentasFormulario.map((c) => (
                  <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="mov-metodo">
              <Form.Label>Método de pago</Form.Label>
              <Form.Select value={form.metodo} onChange={(e) => campo('metodo', e.target.value as MetodoPago)}>
                {METODOS_PAGO.map((m) => (
                  <option key={m} value={m}>{formatearMetodoPago(m)}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="mov-estado">
              <Form.Label>Estado</Form.Label>
              <Form.Select
                value={form.repetir ? EstadoTransaccion.Confirmado : form.estado}
                onChange={(e) => campo('estado', e.target.value as EstadoTransaccion)}
                disabled={form.repetir}
              >
                <option value={EstadoTransaccion.Confirmado}>Confirmado</option>
                <option value={EstadoTransaccion.Pendiente}>Pendiente</option>
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="mov-etiquetas" className="ft-ancho-doble">
              <Form.Label>Etiquetas</Form.Label>
              <Form.Control value={form.etiquetas} onChange={(e) => campo('etiquetas', e.target.value)} placeholder="Separadas por comas" />
            </Form.Group>
          </div>

          {!editando && (
            <div className={`ft-repetir${form.repetir ? ' activo' : ''}`}>
              <Form.Check
                type="switch"
                id="mov-repetir"
                label="Movimiento recurrente"
                checked={form.repetir}
                onChange={(e) => campo('repetir', e.target.checked)}
              />
              {form.repetir ? (
                <div className="ft-rejilla mt-3">
                  <Form.Group controlId="mov-frecuencia">
                    <Form.Label>Se repite</Form.Label>
                    <Form.Select value={form.frecuencia} onChange={(e) => campo('frecuencia', e.target.value as FrecuenciaRecurrencia)}>
                      {FRECUENCIAS_RECURRENCIA.map((f) => (
                        <option key={f} value={f}>{TEXTO_FRECUENCIA[f]}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group controlId="mov-fin">
                    <Form.Label>Hasta (opcional)</Form.Label>
                    <Form.Control type="date" value={form.fechaFin} min={form.fecha} onChange={(e) => campo('fechaFin', e.target.value)} />
                  </Form.Group>
                  <p className="ft-nota ft-ancho-doble mb-0">
                    Cada ocurrencia se registra automáticamente en su fecha, con estado confirmado. No se registran movimientos futuros.
                  </p>
                </div>
              ) : (
                <p className="ft-nota mb-0">Aplica a ingresos o gastos periódicos, como salarios, alquileres o suscripciones.</p>
              )}
            </div>
          )}

          <div className="ft-acciones mt-3">
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : form.repetir ? 'Crear regla' : 'Guardar movimiento'}
            </Button>
            <Button variant="outline-secondary" onClick={cerrarFormulario}>
              Cancelar
            </Button>
          </div>
        </Form>
      )}

      {reglas.length > 0 && (
        <section className="ft-reglas" aria-labelledby="t-reglas">
          <button
            type="button"
            className="ft-reglas-cabeza"
            aria-expanded={verReglas}
            aria-controls="lista-reglas"
            onClick={() => setVerReglas((v) => !v)}
          >
            <i className="bi bi-arrow-repeat" aria-hidden="true" />
            <span id="t-reglas">Reglas recurrentes</span>
            <small>
              {reglasActivas} {reglasActivas === 1 ? 'activo' : 'activos'} de {reglas.length}
            </small>
            <i className={`bi ${verReglas ? 'bi-chevron-up' : 'bi-chevron-down'} ms-auto`} aria-hidden="true" />
          </button>

          {verReglas && (
            <div id="lista-reglas">
              <SelectorOrden
                id="orden-reglas"
                orden={tablaReglas.orden}
                onCambiar={tablaReglas.fijar}
                columnas={[
                  { clave: 'proxima', texto: 'Próxima fecha' },
                  { clave: 'monto', texto: 'Monto' },
                  { clave: 'descripcion', texto: 'Descripción' },
                ]}
              />
              <table className="ft-tabla ft-tabla-apilada">
                <thead>
                  <tr>
                    <ThOrdenable clave="descripcion" orden={tablaReglas.orden} onOrdenar={tablaReglas.alternar}>Descripción</ThOrdenable>
                    <ThOrdenable clave="frecuencia" orden={tablaReglas.orden} onOrdenar={tablaReglas.alternar}>Frecuencia</ThOrdenable>
                    <ThOrdenable clave="proxima" orden={tablaReglas.orden} onOrdenar={tablaReglas.alternar}>Próxima</ThOrdenable>
                    <ThOrdenable clave="estado" orden={tablaReglas.orden} onOrdenar={tablaReglas.alternar}>Estado</ThOrdenable>
                    <ThOrdenable clave="monto" orden={tablaReglas.orden} onOrdenar={tablaReglas.alternar} derecha>Monto</ThOrdenable>
                    <th scope="col"><span className="visually-hidden">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {tablaReglas.filas.map((r) => {
                    const esIngreso = r.tipo === TipoTransaccion.Ingreso
                    const estado = r.finalizada ? 'Terminada' : r.activa ? 'Activa' : 'En pausa'
                    return (
                      <tr key={r.id} className={r.activa && !r.finalizada ? '' : 'ft-fila-archivada'}>
                        <td className="ft-celda-principal">
                          <Emoji valor={categoria(r.categoriaId)?.icono} />
                          {r.descripcion}
                          <small>
                            {nombreCategoria(r.categoriaId)} · {nombreCuenta(r.cuentaId)}
                            {r.fechaFin ? ` · hasta el ${formatearFecha(r.fechaFin)}` : ''}
                          </small>
                        </td>
                        <td data-label="Frecuencia">{formatearFrecuencia(r.frecuencia)}</td>
                        <td data-label="Próxima" className="text-nowrap">{r.finalizada ? '—' : formatearFecha(r.proximaFecha)}</td>
                        <td data-label="Estado">
                          <span className={`ft-estado ${r.finalizada ? 'terminada' : r.activa ? 'activa' : 'pausa'}`}>{estado}</span>
                        </td>
                        <td data-label="Monto" className={`derecha ft-monto ${esIngreso ? 'ingreso' : 'gasto'}`}>
                          {esIngreso ? '+' : '−'} {formatearMoneda(r.monto)}
                        </td>
                        <td className="derecha ft-celda-acciones">
                          {!r.finalizada && (
                            <Button variant="link" size="sm" onClick={() => void cambiarRegla(r)}>
                              <i className={`bi ${r.activa ? 'bi-pause' : 'bi-play'} me-1`} aria-hidden="true" />
                              {r.activa ? 'Pausar' : 'Reanudar'}
                            </Button>
                          )}
                          <button type="button" className="ft-icono-btn peligro" aria-label={`Eliminar la regla ${r.descripcion}`} title="Eliminar regla" onClick={() => pedirEliminarRegla(r)}>
                            <i className="bi bi-trash3" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className={`ft-filtros${verFiltros ? ' abiertos' : ''}`} role="search" aria-label="Filtrar movimientos">
        <div className="ft-filtro-busqueda">
          <Form.Control
            type="search"
            aria-label="Buscar"
            className="ft-filtro-texto"
            placeholder="Buscar por descripción o etiqueta"
            value={filtros.texto}
            onChange={(e) => cambiarFiltro('texto', e.target.value)}
          />
          <Button
            variant="outline-secondary"
            className="ft-boton-filtros"
            aria-expanded={verFiltros}
            onClick={() => setVerFiltros((v) => !v)}
          >
            <i className="bi bi-funnel me-1" aria-hidden="true" />
            Filtros{hayFiltros && !filtros.texto ? ' •' : ''}
          </Button>
        </div>
        <Form.Select aria-label="Tipo" value={filtros.tipo} onChange={(e) => cambiarFiltro('tipo', e.target.value as Filtros['tipo'])}>
          <option value="">Ingresos y gastos</option>
          <option value={TipoTransaccion.Ingreso}>Solo ingresos</option>
          <option value={TipoTransaccion.Gasto}>Solo gastos</option>
        </Form.Select>
        <Form.Select aria-label="Categoría" value={filtros.categoriaId} onChange={(e) => cambiarFiltro('categoriaId', e.target.value)}>
          <option value="">Todas las categorías</option>
          {opcionesCategoria(filtros.tipo || undefined).map((c) => (
            <option key={c.id} value={c.id}>{c.texto}</option>
          ))}
        </Form.Select>
        <Form.Select aria-label="Cuenta" value={filtros.cuentaId} onChange={(e) => cambiarFiltro('cuentaId', e.target.value)}>
          <option value="">Todas las cuentas</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Form.Select>
        <Form.Control type="date" aria-label="Desde" title="Desde" value={filtros.desde} onChange={(e) => cambiarFiltro('desde', e.target.value)} />
        <Form.Control type="date" aria-label="Hasta" title="Hasta" value={filtros.hasta} onChange={(e) => cambiarFiltro('hasta', e.target.value)} />
        {hayFiltros && (
          <Button variant="link" className="ft-quitar-filtros" onClick={() => setFiltros(FILTROS_VACIOS)}>
            <i className="bi bi-x-circle me-1" aria-hidden="true" />
            Quitar filtros
          </Button>
        )}
      </div>

      {cargando ? (
        <p className="ft-vacio">Cargando…</p>
      ) : lista.length === 0 ? (
        hayFiltros ? (
          <p className="ft-vacio">Ningún movimiento coincide con los filtros aplicados.</p>
        ) : (
          <div className="ft-vacio-grande">
            <i className="bi bi-receipt" aria-hidden="true" />
            <p>No existen movimientos registrados.</p>
            <Button onClick={abrirNuevo}>Registrar movimiento</Button>
          </div>
        )
      ) : (
        <>
          <div className="ft-lista-cabeza">
            <p className="ft-resumen-linea mb-0">
              {lista.length} {lista.length === 1 ? 'movimiento' : 'movimientos'}:{' '}
              <span className="ft-monto ingreso">+ {formatearMoneda(totalIngresos)}</span>{' '}y{' '}
              <span className="ft-monto gasto">− {formatearMoneda(totalGastos)}</span>
            </p>
            <SelectorOrden
              id="orden-movimientos"
              orden={tabla.orden}
              onCambiar={tabla.fijar}
              columnas={[
                { clave: 'fecha', texto: 'Fecha' },
                { clave: 'monto', texto: 'Monto' },
                { clave: 'descripcion', texto: 'Descripción' },
                { clave: 'categoria', texto: 'Categoría' },
                { clave: 'cuenta', texto: 'Cuenta' },
              ]}
            />
          </div>

          <table className="ft-tabla ft-tabla-movimientos">
            <thead>
              <tr>
                <ThOrdenable clave="descripcion" orden={tabla.orden} onOrdenar={tabla.alternar}>Movimiento</ThOrdenable>
                <ThOrdenable clave="categoria" orden={tabla.orden} onOrdenar={tabla.alternar} className="ft-col-ancha">Categoría</ThOrdenable>
                <ThOrdenable clave="cuenta" orden={tabla.orden} onOrdenar={tabla.alternar} className="ft-col-ancha">Cuenta</ThOrdenable>
                <ThOrdenable clave="fecha" orden={tabla.orden} onOrdenar={tabla.alternar} className="ft-col-fecha">Fecha</ThOrdenable>
                <ThOrdenable clave="monto" orden={tabla.orden} onOrdenar={tabla.alternar} derecha>Monto</ThOrdenable>
                <th scope="col"><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((t) => {
                const esIngreso = t.tipo === TipoTransaccion.Ingreso
                const cat = categoria(t.categoriaId)
                return (
                  <tr key={t.id} className={editando?.id === t.id ? 'ft-fila-editando' : ''}>
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
                              <span className="ft-marca-repite" title="Generado automáticamente por una regla recurrente">
                                🔁<span className="visually-hidden"> Generado por una regla recurrente</span>
                              </span>
                            )}
                            {t.estado === EstadoTransaccion.Pendiente && <span className="ft-etiqueta-estado">Pendiente</span>}
                          </span>
                          <small>
                            <span className="ft-solo-angosto">{nombreCategoria(t.categoriaId)} · {nombreCuenta(t.cuentaId)} · </span>
                            <span className="ft-solo-movil">{cat?.nombre ?? 'Sin categoría'} · {fechaCorta(t.fecha)}</span>
                            <span className="ft-oculto-movil">{formatearMetodoPago(t.metodoPago)}</span>
                            {t.etiquetas.length > 0 && <span className="ft-etiquetas ft-oculto-movil"> · {t.etiquetas.map((e) => `#${e}`).join(' ')}</span>}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="ft-col-ancha">{nombreCategoria(t.categoriaId)}</td>
                    <td className="ft-col-ancha">{nombreCuenta(t.cuentaId)}</td>
                    <td className="text-nowrap ft-col-fecha">{formatearFecha(t.fecha)}</td>
                    <td className={`derecha ft-monto ${esIngreso ? 'ingreso' : 'gasto'}`}>
                      {esIngreso ? '+' : '−'} {formatearMoneda(t.monto)}
                    </td>
                    <td className="derecha ft-celda-acciones">
                      <button type="button" className="ft-icono-btn" aria-label={`Editar ${t.descripcion}`} title="Editar" onClick={() => abrirEdicion(t)}>
                        <i className="bi bi-pencil" aria-hidden="true" />
                      </button>
                      <button type="button" className="ft-icono-btn peligro" aria-label={`Eliminar ${t.descripcion}`} title="Eliminar" onClick={() => pedirEliminar(t)}>
                        <i className="bi bi-trash3" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {tabla.filas.length > visibles && (
            <div className="ft-ver-mas">
              <Button variant="outline-primary" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
                Ver más ({tabla.filas.length - visibles} restantes)
              </Button>
            </div>
          )}
        </>
      )}

      <Confirmar peticion={confirmar} onCerrar={() => setConfirmar(null)} />
    </>
  )
}
