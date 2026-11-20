import { useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Table,
} from 'react-bootstrap';
import {
  METODOS_PAGO,
  MetodoPago,
  TipoTransaccion,
} from '../../models';
import type { Categoria, Cuenta, FilaCsvDetectada } from '../../models';
import { finanzasService } from '../../services';
import { mensajeDeError } from '../../utils/errores';
import {
  formatearFecha,
  formatearMetodoPago,
  formatearMoneda,
} from '../../utils/formato';
import { sugerirCategoria } from '../../utils/importadorCsv';
import { useNotificaciones } from './notificacionesContexto';

const MAXIMO_BYTES = 5 * 1024 * 1024;

interface Props {
  cuentas: Cuenta[];
  categorias: Categoria[];
  ocupado?: boolean;
  onImportado: () => void;
  onCerrar: () => void;
}

/**
 * Lee el archivo como texto. Los bancos costarricenses suelen exportar en
 * Windows-1252: si la decodificación UTF-8 produce caracteres inválidos se
 * reintenta con esa codificación para no romper los `₡` ni los acentos.
 */
async function leerArchivoTexto(archivo: File): Promise<string> {
  const buffer = await archivo.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('\uFFFD')) return utf8;
  return new TextDecoder('windows-1252').decode(buffer);
}

/**
 * Flujo de importación de un estado de cuenta CSV:
 * cargar archivo o pegar texto → previsualizar → ajustar → confirmar.
 *
 * Los posibles duplicados llegan desmarcados para evitar registrar dos veces
 * un gasto ya existente; el usuario puede marcarlos manualmente.
 */
export function PanelImportadorCsv({
  cuentas,
  categorias,
  ocupado = false,
  onImportado,
  onCerrar,
}: Props) {
  const notificaciones = useNotificaciones();
  const cuentasActivas = cuentas.filter((cuenta) => cuenta.activa);
  const cuentaPorDefecto = cuentasActivas[0]?.id ?? '';

  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('');
  const [textoCsv, setTextoCsv] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [filas, setFilas] = useState<FilaCsvDetectada[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [previsualizando, setPrevisualizando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [errorCsv, setErrorCsv] = useState<string | null>(null);

  // La cuenta efectiva cae a la primera activa: así el panel funciona aunque
  // se abra antes de que termine la carga inicial de las cuentas.
  const cuentaId =
    cuentaSeleccionada &&
    cuentasActivas.some((cuenta) => cuenta.id === cuentaSeleccionada)
      ? cuentaSeleccionada
      : cuentaPorDefecto;

  const ocupadoTotal = ocupado || previsualizando || importando;
  const filasSeleccionadas = filas.filter((fila) =>
    seleccionadas.has(fila.id),
  );
  const duplicados = filas.filter((fila) => fila.posibleDuplicado).length;
  const total = filasSeleccionadas.reduce(
    (suma, fila) =>
      suma +
      (fila.tipo === TipoTransaccion.Ingreso ? fila.monto : -fila.monto),
    0,
  );

  const limpiarRevision = () => {
    setFilas([]);
    setSeleccionadas(new Set());
    setErrorCsv(null);
  };

  const previsualizar = async (texto: string) => {
    if (!cuentaId) {
      setErrorCsv('Seleccione la cuenta a la que pertenece el estado de cuenta.');
      return;
    }
    if (!texto.trim()) {
      setErrorCsv('Cargue un archivo .csv o pegue su contenido.');
      return;
    }

    setPrevisualizando(true);
    setErrorCsv(null);

    try {
      const detectadas = await finanzasService.previsualizarCsv(texto, cuentaId);
      setFilas(detectadas);

      // Los duplicados arrancan desmarcados por seguridad; el usuario puede
      // marcarlos si confirma que son movimientos distintos.
      setSeleccionadas(
        new Set(
          detectadas
            .filter((fila) => !fila.posibleDuplicado)
            .map((fila) => fila.id),
        ),
      );

      if (detectadas.every((fila) => fila.posibleDuplicado)) {
        notificaciones.aviso(
          'Todas las filas coinciden con movimientos existentes o entre sí. Revíselas antes de importar.',
        );
      }
    } catch (fallo) {
      setFilas([]);
      setSeleccionadas(new Set());
      setErrorCsv(mensajeDeError(fallo));
    } finally {
      setPrevisualizando(false);
    }
  };

  const cargarArchivo = async (
    evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    // Permite volver a elegir el mismo archivo después de un error.
    entrada.value = '';
    if (!archivo) return;

    if (archivo.size > MAXIMO_BYTES) {
      setErrorCsv(
        'El archivo supera los 5 MB. Divídalo en partes más pequeñas e intente de nuevo.',
      );
      return;
    }

    setPrevisualizando(true);
    setErrorCsv(null);
    setNombreArchivo(archivo.name);

    try {
      const texto = await leerArchivoTexto(archivo);
      setTextoCsv(texto);
      await previsualizar(texto);
    } catch {
      setErrorCsv(
        'No se pudo leer el archivo. Verifique que sea un CSV de texto plano.',
      );
    } finally {
      setPrevisualizando(false);
    }
  };

  const alternarFila = (id: string) => {
    setSeleccionadas((previas) => {
      const copia = new Set(previas);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  };

  const cambiarCuenta = (nuevoId: string) => {
    setCuentaSeleccionada(nuevoId);
    // La cuenta define los duplicados: hay que volver a previsualizar.
    limpiarRevision();
  };

  const cambiarTipo = (id: string, nuevoTipo: TipoTransaccion) => {
    setFilas((previas) =>
      previas.map((fila) =>
        fila.id === id
          ? {
              ...fila,
              tipo: nuevoTipo,
              categoriaIdSugerida: sugerirCategoria(
                fila.descripcion,
                nuevoTipo,
                categorias,
              ),
            }
          : fila,
      ),
    );
  };

  const cambiarCategoria = (id: string, categoriaId: string) => {
    setFilas((previas) =>
      previas.map((fila) =>
        fila.id === id ? { ...fila, categoriaIdSugerida: categoriaId } : fila,
      ),
    );
  };

  const cambiarMetodo = (id: string, metodo: MetodoPago) => {
    setFilas((previas) =>
      previas.map((fila) =>
        fila.id === id ? { ...fila, metodoPagoSugerido: metodo } : fila,
      ),
    );
  };

  const confirmar = async () => {
    if (!cuentaId) return;
    if (filasSeleccionadas.length === 0) {
      notificaciones.aviso('Seleccione al menos un movimiento para importar.');
      return;
    }

    setImportando(true);
    try {
      const importados = await finanzasService.confirmarImportacionCsv(
        cuentaId,
        filasSeleccionadas,
      );
      notificaciones.exito(
        importados === 1
          ? 'Se importó 1 movimiento.'
          : `Se importaron ${importados} movimientos.`,
      );
      limpiarRevision();
      setTextoCsv('');
      setNombreArchivo('');
      onImportado();
      onCerrar();
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    } finally {
      setImportando(false);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Body>
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div>
            <Card.Title className="h6 mb-1">Importar estado de cuenta</Card.Title>
            <p className="text-muted small mb-0">
              Cargue el CSV del banco o pegue su contenido. Puede revisar y
              ajustar cada movimiento antes de guardarlo.
            </p>
          </div>
          <Button
            variant="outline-secondary"
            size="sm"
            disabled={ocupadoTotal}
            onClick={onCerrar}
          >
            Cerrar
          </Button>
        </div>

        <Row className="g-3 mb-3">
          <Col xs={12} md={4}>
            <Form.Group controlId="csv-cuenta">
              <Form.Label className="small text-muted mb-1">Cuenta</Form.Label>
              <Form.Select
                value={cuentaId}
                disabled={ocupadoTotal}
                onChange={(evento) => cambiarCuenta(evento.target.value)}
              >
                <option value="">Seleccione…</option>
                {cuentasActivas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.icono} {cuenta.nombre}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col xs={12} md={8}>
            <Form.Group controlId="csv-archivo">
              <Form.Label className="small text-muted mb-1">
                Archivo .csv
              </Form.Label>
              <Form.Control
                type="file"
                accept=".csv,text/csv"
                disabled={ocupadoTotal}
                onChange={(evento) => void cargarArchivo(evento)}
              />
              {nombreArchivo && (
                <Form.Text muted>Archivo: {nombreArchivo}</Form.Text>
              )}
            </Form.Group>
          </Col>
          <Col xs={12}>
            <Form.Group controlId="csv-texto">
              <Form.Label className="small text-muted mb-1">
                …o pegue el contenido del CSV
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={textoCsv}
                disabled={ocupadoTotal}
                placeholder={
                  'Fecha;Descripción;Débito;Crédito\n15/03/2026;AUTOMERCADO;25000,50;'
                }
                onChange={(evento) => setTextoCsv(evento.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12} className="d-flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={ocupadoTotal}
              onClick={() => void previsualizar(textoCsv)}
            >
              {previsualizando ? 'Analizando…' : 'Previsualizar'}
            </Button>
            {filas.length > 0 && (
              <Button
                variant="outline-secondary"
                disabled={ocupadoTotal}
                onClick={limpiarRevision}
              >
                Limpiar revisión
              </Button>
            )}
          </Col>
        </Row>

        {errorCsv && (
          <Alert variant="danger" className="py-2 mb-3">
            {errorCsv}
          </Alert>
        )}

        {filas.length === 0 ? (
          <p className="text-muted small mb-0">
            Se aceptan archivos con separador coma o punto y coma, fechas
            DD/MM/AAAA o AAAA-MM-DD y columnas de Débito/Crédito o un monto
            único. Las filas de resumen y los metadatos del banco se ignoran.
          </p>
        ) : (
          <>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <Badge bg="light" text="dark">
                {filas.length}{' '}
                {filas.length === 1 ? 'movimiento detectado' : 'movimientos detectados'}
              </Badge>
              {duplicados > 0 && (
                <Badge bg="warning" text="dark">
                  {duplicados}{' '}
                  {duplicados === 1 ? 'posible duplicado' : 'posibles duplicados'}
                </Badge>
              )}
              <Badge bg="primary">
                {filasSeleccionadas.length} seleccionados
              </Badge>
              <span className="ms-auto small text-muted">
                Total seleccionado:{' '}
                <strong className={total >= 0 ? 'text-success' : 'text-danger'}>
                  {total >= 0 ? '+' : '−'}
                  {formatearMoneda(Math.abs(total))}
                </strong>
              </span>
            </div>

            <div className="table-responsive">
              <Table hover size="sm" className="align-middle mb-3">
                <thead>
                  <tr>
                    <th style={{ width: '2.5rem' }}> </th>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th className="text-end">Monto</th>
                    <th>Categoría</th>
                    <th>Método</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => (
                    <tr
                      key={fila.id}
                      className={fila.posibleDuplicado ? 'table-warning' : undefined}
                    >
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={seleccionadas.has(fila.id)}
                          disabled={ocupadoTotal}
                          aria-label={`Importar el movimiento de la fila ${fila.numeroFila}`}
                          onChange={() => alternarFila(fila.id)}
                        />
                      </td>
                      <td className="text-nowrap">
                        {formatearFecha(fila.fecha)}
                      </td>
                      <td>
                        {fila.descripcion}
                        {fila.advertencia && (
                          <div className="small text-warning-emphasis">
                            {fila.advertencia}
                          </div>
                        )}
                      </td>
                      <td style={{ minWidth: '7.5rem' }}>
                        <Form.Select
                          size="sm"
                          value={fila.tipo}
                          disabled={ocupadoTotal}
                          aria-label={`Tipo del movimiento ${fila.numeroFila}`}
                          onChange={(evento) =>
                            cambiarTipo(
                              fila.id,
                              evento.target.value as TipoTransaccion,
                            )
                          }
                        >
                          <option value={TipoTransaccion.Gasto}>Gasto</option>
                          <option value={TipoTransaccion.Ingreso}>Ingreso</option>
                        </Form.Select>
                      </td>
                      <td
                        className={`text-end fw-semibold text-nowrap ${
                          fila.tipo === TipoTransaccion.Ingreso
                            ? 'text-success'
                            : 'text-danger'
                        }`}
                      >
                        {fila.tipo === TipoTransaccion.Ingreso ? '+' : '−'}
                        {formatearMoneda(fila.monto)}
                      </td>
                      <td style={{ minWidth: '12rem' }}>
                        <Form.Select
                          size="sm"
                          value={fila.categoriaIdSugerida}
                          isInvalid={!fila.categoriaIdSugerida}
                          disabled={ocupadoTotal}
                          aria-label={`Categoría del movimiento ${fila.numeroFila}`}
                          onChange={(evento) =>
                            cambiarCategoria(fila.id, evento.target.value)
                          }
                        >
                          <option value="">Seleccione…</option>
                          {categorias
                            .filter((categoria) => categoria.tipo === fila.tipo)
                            .map((categoria) => (
                              <option key={categoria.id} value={categoria.id}>
                                {categoria.icono} {categoria.nombre}
                              </option>
                            ))}
                        </Form.Select>
                        {!fila.categoriaIdSugerida && (
                          <Form.Control.Feedback type="invalid" className="d-block">
                            Asigne una categoría.
                          </Form.Control.Feedback>
                        )}
                      </td>
                      <td style={{ minWidth: '9rem' }}>
                        <Form.Select
                          size="sm"
                          value={fila.metodoPagoSugerido}
                          disabled={ocupadoTotal}
                          aria-label={`Método de pago del movimiento ${fila.numeroFila}`}
                          onChange={(evento) =>
                            cambiarMetodo(
                              fila.id,
                              evento.target.value as MetodoPago,
                            )
                          }
                        >
                          {METODOS_PAGO.map((metodo) => (
                            <option key={metodo} value={metodo}>
                              {formatearMetodoPago(metodo)}
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <Button
                disabled={ocupadoTotal || filasSeleccionadas.length === 0}
                onClick={() => void confirmar()}
              >
                {importando
                  ? 'Importando…'
                  : `Importar ${filasSeleccionadas.length} ${
                      filasSeleccionadas.length === 1 ? 'movimiento' : 'movimientos'
                    }`}
              </Button>
              <Button
                variant="outline-secondary"
                disabled={ocupadoTotal}
                onClick={limpiarRevision}
              >
                Descartar previsualización
              </Button>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
