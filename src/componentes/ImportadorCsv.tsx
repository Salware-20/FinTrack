import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { METODOS_PAGO, MetodoPago, TipoTransaccion } from '../models'
import type { Categoria, Cuenta } from '../models'
import type { FilaCsvDetectada } from '../models/tipos'
import { finanzasService } from '../services'
import { sugerirCategoria } from '../utils/importadorCsv'
import { formatearFecha, formatearMetodoPago, formatearMoneda } from '../utils/formato'
import { etiquetaCategoria, mensajeDeError } from './ayudas'

const MAXIMO_BYTES = 5 * 1024 * 1024

interface Props {
  cuentas: Cuenta[]
  categorias: Categoria[]
  onImportado: (cantidad: number) => void
  onCerrar: () => void
}

/** Los bancos de Costa Rica suelen exportar en Windows-1252: si UTF-8 falla se reintenta. */
async function leerTexto(archivo: File): Promise<string> {
  const buffer = await archivo.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buffer) : utf8
}

/**
 * Importar un estado de cuenta en tres pasos:
 * 1. elegir la cuenta y el archivo, 2. revisar lo detectado, 3. guardar.
 * Los posibles duplicados llegan sin marcar para no registrar dos veces lo mismo.
 */
export function ImportadorCsv({ cuentas, categorias, onImportado, onCerrar }: Props) {
  const activas = cuentas.filter((c) => c.activa)
  const [cuentaElegida, setCuentaElegida] = useState('')
  const [texto, setTexto] = useState('')
  const [verPegar, setVerPegar] = useState(false)
  const [archivo, setArchivo] = useState('')
  const [filas, setFilas] = useState<FilaCsvDetectada[]>([])
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cuentaId = activas.some((c) => c.id === cuentaElegida) ? cuentaElegida : activas[0]?.id ?? ''
  const revisando = filas.length > 0
  const elegidas = filas.filter((f) => marcadas.has(f.id))
  const sinCategoria = elegidas.filter((f) => !f.categoriaIdSugerida).length
  const duplicados = filas.filter((f) => f.posibleDuplicado).length
  const entra = elegidas.filter((f) => f.tipo === TipoTransaccion.Ingreso).reduce((s, f) => s + f.monto, 0)
  const sale = elegidas.filter((f) => f.tipo === TipoTransaccion.Gasto).reduce((s, f) => s + f.monto, 0)

  const opciones = (tipo: TipoTransaccion) =>
    categorias
      .filter((c) => c.tipo === tipo)
      .map((c) => ({ id: c.id, texto: `${c.icono ? `${c.icono} ` : ''}${etiquetaCategoria(c, categorias)}`, orden: etiquetaCategoria(c, categorias) }))
      .sort((a, b) => a.orden.localeCompare(b.orden, 'es'))

  const reiniciar = () => {
    setFilas([])
    setMarcadas(new Set())
    setError(null)
  }

  const analizar = async (contenido: string) => {
    if (!cuentaId) {
      setError('No existe una cuenta activa. Registre una en Cuentas.')
      return
    }
    if (!contenido.trim()) {
      setError('Seleccione un archivo .csv o ingrese su contenido.')
      return
    }
    setOcupado(true)
    setError(null)
    try {
      const detectadas = await finanzasService.previsualizarCsv(contenido, cuentaId)
      setFilas(detectadas)
      setMarcadas(new Set(detectadas.filter((f) => !f.posibleDuplicado).map((f) => f.id)))
      if (detectadas.length === 0) setError('El archivo no contiene movimientos válidos.')
    } catch (causa) {
      reiniciar()
      setError(mensajeDeError(causa))
    } finally {
      setOcupado(false)
    }
  }

  const elegirArchivo = async (evento: ChangeEvent<HTMLInputElement>) => {
    const entrada = evento.target
    const elegido = entrada.files?.[0]
    entrada.value = ''
    if (!elegido) return
    if (elegido.size > MAXIMO_BYTES) {
      setError('El archivo supera el límite de 5 MB.')
      return
    }
    setArchivo(elegido.name)
    try {
      const contenido = await leerTexto(elegido)
      setTexto(contenido)
      await analizar(contenido)
    } catch {
      setError('No fue posible leer el archivo. Verifique que sea un CSV en texto plano.')
    }
  }

  const cambiarFila = (id: string, cambios: Partial<FilaCsvDetectada>) =>
    setFilas((previas) => previas.map((f) => (f.id === id ? { ...f, ...cambios } : f)))

  const alternar = (id: string) =>
    setMarcadas((previas) => {
      const copia = new Set(previas)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })

  const todas = elegidas.length === filas.length
  const alternarTodas = () => setMarcadas(todas ? new Set() : new Set(filas.map((f) => f.id)))

  const importar = async () => {
    if (sinCategoria > 0) {
      setError(`Hay ${sinCategoria === 1 ? '1 movimiento' : `${sinCategoria} movimientos`} sin categoría asignada.`)
      return
    }
    setOcupado(true)
    setError(null)
    try {
      const cantidad = await finanzasService.confirmarImportacionCsv(cuentaId, elegidas)
      onImportado(cantidad)
    } catch (causa) {
      setError(mensajeDeError(causa))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="ft-panel ft-importador" aria-labelledby="t-importar">
      <div className="ft-panel-cabeza">
        <h2 id="t-importar" className="ft-seccion-titulo mb-0">Importar estado de cuenta</h2>
        <button type="button" className="ft-icono-btn ms-auto" onClick={onCerrar} aria-label="Cerrar importador" disabled={ocupado}>
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      <ol className="ft-pasos" aria-label="Pasos">
        <li className={revisando ? 'hecho' : 'actual'}>Origen</li>
        <li className={revisando ? 'actual' : ''}>Validación</li>
        <li>Registro</li>
      </ol>

      {error && <p className="text-danger small" role="alert">{error}</p>}

      {!revisando ? (
        <>
          <div className="ft-rejilla">
            <Form.Group controlId="csv-cuenta">
              <Form.Label>Cuenta asociada</Form.Label>
              <Form.Select value={cuentaId} onChange={(e) => setCuentaElegida(e.target.value)} disabled={ocupado}>
                {activas.length === 0 && <option value="">No hay cuentas activas</option>}
                {activas.map((c) => (
                  <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ''}{c.nombre}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div>
              <span className="form-label d-block">Archivo CSV</span>
              <label className={`ft-soltar${ocupado ? ' ocupado' : ''}`}>
                <i className="bi bi-file-earmark-arrow-up" aria-hidden="true" />
                <span>
                  <strong>{ocupado ? 'Procesando…' : archivo || 'Seleccionar archivo .csv'}</strong>
                  <small>Exportado desde la banca en línea</small>
                </span>
                <input type="file" accept=".csv,text/csv" className="visually-hidden" disabled={ocupado} onChange={(e) => void elegirArchivo(e)} />
              </label>
            </div>
          </div>

          <button type="button" className="btn btn-link p-0 mt-3" onClick={() => setVerPegar((v) => !v)} aria-expanded={verPegar}>
            {verPegar ? 'Ocultar ingreso manual' : 'Ingresar contenido manualmente'}
          </button>
          {verPegar && (
            <div className="mt-2">
              <Form.Control
                as="textarea"
                rows={4}
                aria-label="Contenido del CSV"
                value={texto}
                disabled={ocupado}
                placeholder={'Fecha;Descripción;Débito;Crédito\n15/03/2026;AUTOMERCADO;25000,50;'}
                onChange={(e) => setTexto(e.target.value)}
              />
              <Button className="mt-2" disabled={ocupado} onClick={() => void analizar(texto)}>
                {ocupado ? 'Procesando…' : 'Procesar contenido'}
              </Button>
            </div>
          )}

          <p className="ft-nota mt-3 mb-0">
            Formatos admitidos: separador coma o punto y coma; fechas DD/MM/AAAA o AAAA-MM-DD; columnas de débito y crédito o monto
            único. Las filas de totales y metadatos se omiten. Ningún registro se guarda hasta la confirmación final.
          </p>
        </>
      ) : (
        <>
          <div className="ft-importador-resumen">
            <p className="mb-0">
              Registros detectados: <strong>{filas.length}</strong>{archivo ? ` (${archivo})` : ''}.{' '}
              {duplicados > 0 && (
                <>
                  Posibles duplicados: <strong>{duplicados}</strong>, excluidos por defecto.
                </>
              )}
            </p>
            <p className="mb-0">
              Seleccionados: <strong>{elegidas.length}</strong> ·{' '}
              <span className="ft-monto ingreso">+ {formatearMoneda(entra)}</span> y{' '}
              <span className="ft-monto gasto">− {formatearMoneda(sale)}</span>
            </p>
          </div>

          <table className="ft-tabla ft-tabla-importar">
            <thead>
              <tr>
                <th scope="col">
                  <Form.Check type="checkbox" aria-label="Marcar todos" checked={todas} onChange={alternarTodas} />
                </th>
                <th scope="col">Movimiento</th>
                <th scope="col" className="derecha">Monto</th>
                <th scope="col">Tipo</th>
                <th scope="col">Categoría</th>
                <th scope="col">Método</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const marcada = marcadas.has(f.id)
                const esIngreso = f.tipo === TipoTransaccion.Ingreso
                return (
                  <tr key={f.id} className={`${marcada ? '' : 'ft-fila-archivada'}${f.posibleDuplicado ? ' ft-fila-duplicada' : ''}`}>
                    <td className="ft-celda-marca">
                      <Form.Check type="checkbox" checked={marcada} onChange={() => alternar(f.id)} aria-label={`Importar ${f.descripcion}`} />
                    </td>
                    <td className="ft-celda-principal">
                      {f.descripcion}
                      <small>
                        {formatearFecha(f.fecha)}
                        {f.posibleDuplicado && <span className="ft-estado pausa ms-2">{f.advertencia ?? 'Posible duplicado'}</span>}
                      </small>
                    </td>
                    <td className={`derecha ft-monto ${esIngreso ? 'ingreso' : 'gasto'}`}>
                      {esIngreso ? '+' : '−'} {formatearMoneda(f.monto)}
                    </td>
                    <td data-label="Tipo">
                      <Form.Select
                        size="sm"
                        aria-label={`Tipo de ${f.descripcion}`}
                        value={f.tipo}
                        onChange={(e) => {
                          const tipo = e.target.value as TipoTransaccion
                          cambiarFila(f.id, { tipo, categoriaIdSugerida: sugerirCategoria(f.descripcion, tipo, categorias) })
                        }}
                      >
                        <option value={TipoTransaccion.Gasto}>Gasto</option>
                        <option value={TipoTransaccion.Ingreso}>Ingreso</option>
                      </Form.Select>
                    </td>
                    <td data-label="Categoría">
                      <Form.Select
                        size="sm"
                        aria-label={`Categoría de ${f.descripcion}`}
                        value={f.categoriaIdSugerida}
                        isInvalid={marcada && !f.categoriaIdSugerida}
                        onChange={(e) => cambiarFila(f.id, { categoriaIdSugerida: e.target.value })}
                      >
                        <option value="">Seleccionar…</option>
                        {opciones(f.tipo).map((c) => (
                          <option key={c.id} value={c.id}>{c.texto}</option>
                        ))}
                      </Form.Select>
                    </td>
                    <td data-label="Método">
                      <Form.Select
                        size="sm"
                        aria-label={`Método de pago de ${f.descripcion}`}
                        value={f.metodoPagoSugerido}
                        onChange={(e) => cambiarFila(f.id, { metodoPagoSugerido: e.target.value as MetodoPago })}
                      >
                        {METODOS_PAGO.map((m) => (
                          <option key={m} value={m}>{formatearMetodoPago(m)}</option>
                        ))}
                      </Form.Select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="ft-acciones mt-3">
            <Button disabled={ocupado || elegidas.length === 0} onClick={() => void importar()}>
              {ocupado ? 'Registrando…' : `Registrar ${elegidas.length} ${elegidas.length === 1 ? 'movimiento' : 'movimientos'}`}
            </Button>
            <Button variant="outline-secondary" disabled={ocupado} onClick={reiniciar}>
              Cargar otro archivo
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
