import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Table,
} from 'react-bootstrap';
import type { Categoria, Cuenta, Transaccion } from '../../models';
import { EstadoTransaccion, MetodoPago, TipoTransaccion } from '../../models';
import type { FiltroTransacciones } from '../../models/tipos';
import { finanzasService } from '../../services';
import {
  aFechaISO,
  fechaHoy,
  formatearEstado,
  formatearFecha,
  formatearMetodoPago,
  formatearMoneda,
} from '../../utils/formato';
import { AlertaErrorCarga, Cargando } from '../componentes/Estado';
import { useNotificaciones } from '../componentes/notificacionesContexto';
import { useErroresFormulario } from '../componentes/useErroresFormulario';
import { mensajeDeError } from '../../utils/errores';

interface DatosMovimientos {
  transacciones: Transaccion[];
  categorias: Categoria[];
  cuentas: Cuenta[];
}

async function consultarMovimientos(
  filtro: FiltroTransacciones,
): Promise<DatosMovimientos> {
  const [transacciones, categorias, cuentas] = await Promise.all([
    finanzasService.listarTransacciones(filtro),
    finanzasService.listarCategorias(),
    finanzasService.listarCuentas(),
  ]);

  return { transacciones, categorias, cuentas };
}

interface FormularioMovimiento {
  tipo: TipoTransaccion;
  monto: string;
  fecha: string;
  descripcion: string;
  categoriaId: string;
  cuentaId: string;
  metodoPago: MetodoPago;
  estado: EstadoTransaccion;
  etiquetas: string;
}

const FORMULARIO_INICIAL: FormularioMovimiento = {
  tipo: TipoTransaccion.Gasto,
  monto: '',
  fecha: fechaHoy(),
  descripcion: '',
  categoriaId: '',
  cuentaId: '',
  metodoPago: MetodoPago.Efectivo,
  estado: EstadoTransaccion.Confirmado,
  etiquetas: '',
};

const CAMPOS_MOVIMIENTO = [
  'monto',
  'fecha',
  'descripcion',
  'categoriaId',
  'cuentaId',
] as const;

export function Movimientos() {
  const notificaciones = useNotificaciones();
  const { errores, limpiar, limpiarTodo, marcar, manejar } =
    useErroresFormulario();

  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCuenta, setFiltroCuenta] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [version, setVersion] = useState(0);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [formulario, setFormulario] = useState({ ...FORMULARIO_INICIAL });
  const [guardando, setGuardando] = useState(false);

  // Carga inicial y recargas por filtros o acciones.
  useEffect(() => {
    let activo = true;

    consultarMovimientos({
      tipo: (filtroTipo as TipoTransaccion) || undefined,
      cuentaId: filtroCuenta || undefined,
      texto: filtroTexto || undefined,
    })
      .then((datos) => {
        if (!activo) return;
        setTransacciones(datos.transacciones);
        setCategorias(datos.categorias);
        setCuentas(datos.cuentas);
        setFormulario((previo) => ({
          ...previo,
          cuentaId: previo.cuentaId || datos.cuentas[0]?.id || '',
          categoriaId:
            previo.categoriaId ||
            datos.categorias.find((categoria) => categoria.tipo === previo.tipo)?.id ||
            '',
        }));
        setCargando(false);
        setErrorCarga(null);
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        setErrorCarga(mensajeDeError(fallo));
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [filtroTipo, filtroCuenta, filtroTexto, version]);

  const recargar = () => setVersion((actual) => actual + 1);

  const reintentarCarga = () => {
    setErrorCarga(null);
    setCargando(true);
    recargar();
  };

  const categoriasDelTipo = categorias.filter(
    (categoria) => categoria.tipo === formulario.tipo,
  );

  const cambiarTipo = (tipo: TipoTransaccion) => {
    const primera = categorias.find((categoria) => categoria.tipo === tipo);
    limpiar('categoriaId');
    setFormulario((previo) => ({
      ...previo,
      tipo,
      categoriaId: primera ? primera.id : '',
    }));
  };

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarTodo();

    if (!formulario.cuentaId) {
      marcar('cuentaId', 'Seleccione una cuenta.');
      return;
    }
    if (!formulario.categoriaId) {
      marcar('categoriaId', 'Seleccione una categoría.');
      return;
    }

    setGuardando(true);
    try {
      await finanzasService.crearTransaccion({
        monto: Number(formulario.monto),
        tipo: formulario.tipo,
        fecha: formulario.fecha,
        descripcion: formulario.descripcion,
        categoriaId: formulario.categoriaId,
        cuentaId: formulario.cuentaId,
        metodoPago: formulario.metodoPago,
        estado: formulario.estado,
        etiquetas: formulario.etiquetas
          .split(',')
          .map((etiqueta) => etiqueta.trim())
          .filter((etiqueta) => etiqueta.length > 0),
      });
      setFormulario((previo) => ({
        ...previo,
        monto: '',
        descripcion: '',
        etiquetas: '',
      }));
      setMostrarFormulario(false);
      limpiarTodo();
      notificaciones.exito('Movimiento registrado.');
      recargar();
    } catch (fallo) {
      manejar(fallo, CAMPOS_MOVIMIENTO);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: string) => {
    if (!window.confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await finanzasService.eliminarTransaccion(id);
      notificaciones.exito('Movimiento eliminado.');
      recargar();
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    }
  };

  const cargarEjemplos = async () => {
    const gastos = categorias.filter((categoria) => categoria.tipo === TipoTransaccion.Gasto);
    const ingresos = categorias.filter(
      (categoria) => categoria.tipo === TipoTransaccion.Ingreso,
    );
    const cuenta = cuentas[0];

    if (gastos.length === 0 || ingresos.length === 0 || !cuenta) {
      notificaciones.aviso(
        'No hay categorías o cuentas disponibles para crear ejemplos.',
      );
      return;
    }

    const hoy = new Date();
    const fecha = (diasAtras: number) =>
      aFechaISO(
        new Date(
          hoy.getFullYear(),
          hoy.getMonth(),
          Math.max(1, hoy.getDate() - diasAtras),
        ),
      );

    const porNombre = (nombre: string, respaldo: Categoria) =>
      categorias.find((categoria) => categoria.nombre === nombre)?.id ?? respaldo.id;

    const ejemplos = [
      { dias: 0, monto: 950000, tipo: TipoTransaccion.Ingreso, categoria: porNombre('Salario', ingresos[0]), descripcion: 'Salario del mes', metodo: MetodoPago.Transferencia },
      { dias: 1, monto: 28500, tipo: TipoTransaccion.Gasto, categoria: porNombre('Supermercado', gastos[0]), descripcion: 'Supermercado semanal', metodo: MetodoPago.Tarjeta },
      { dias: 2, monto: 18000, tipo: TipoTransaccion.Gasto, categoria: porNombre('Gasolina', gastos[0]), descripcion: 'Recarga de combustible', metodo: MetodoPago.Tarjeta },
      { dias: 3, monto: 6500, tipo: TipoTransaccion.Gasto, categoria: porNombre('Cafetería', gastos[0]), descripcion: 'Cafetería', metodo: MetodoPago.Efectivo },
      { dias: 4, monto: 12800, tipo: TipoTransaccion.Gasto, categoria: porNombre('Didi / Uber', gastos[0]), descripcion: 'Didi al trabajo', metodo: MetodoPago.Sinpe },
      { dias: 5, monto: 42000, tipo: TipoTransaccion.Gasto, categoria: porNombre('Luz', gastos[0]), descripcion: 'Electricidad', metodo: MetodoPago.Transferencia },
      { dias: 6, monto: 22000, tipo: TipoTransaccion.Gasto, categoria: porNombre('Internet', gastos[0]), descripcion: 'Internet del hogar', metodo: MetodoPago.Tarjeta },
      { dias: 8, monto: 150000, tipo: TipoTransaccion.Ingreso, categoria: porNombre('Outsourcing', ingresos[0]), descripcion: 'Outsourcing por SINPE', metodo: MetodoPago.Sinpe },
    ];

    setGuardando(true);
    try {
      for (const ejemplo of ejemplos) {
        await finanzasService.crearTransaccion({
          monto: ejemplo.monto,
          tipo: ejemplo.tipo,
          fecha: fecha(ejemplo.dias),
          descripcion: ejemplo.descripcion,
          categoriaId: ejemplo.categoria,
          cuentaId: cuenta.id,
          metodoPago: ejemplo.metodo,
        });
      }
      notificaciones.exito('Se cargaron 8 movimientos de ejemplo.');
      recargar();
    } catch (fallo) {
      notificaciones.error(mensajeDeError(fallo));
    } finally {
      setGuardando(false);
    }
  };

  const nombreCategoria = (id: string) =>
    categorias.find((categoria) => categoria.id === id)?.nombre ?? 'Sin categoría';
  const nombreCuenta = (id: string) =>
    cuentas.find((cuenta) => cuenta.id === id)?.nombre ?? 'Sin cuenta';

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 mb-1">Movimientos</h1>
          <p className="text-muted mb-0">Ingresos y gastos de todas sus cuentas.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-secondary"
            disabled={guardando}
            onClick={() => void cargarEjemplos()}
          >
            Cargar ejemplos
          </Button>
          <Button onClick={() => {
            limpiarTodo();
            setMostrarFormulario((visible) => !visible);
          }}>
            {mostrarFormulario ? 'Cerrar formulario' : '+ Nuevo movimiento'}
          </Button>
        </div>
      </div>

      <AlertaErrorCarga mensaje={errorCarga} onReintentar={reintentarCarga} />

      {mostrarFormulario && (
        <Card className="mb-4">
          <Card.Body>
            <Card.Title className="h5 mb-3">Registrar movimiento</Card.Title>
            <Form onSubmit={guardar} noValidate>
              <Row className="g-3">
                <Col xs={12} md={4}>
                  <Form.Group controlId="mov-tipo">
                    <Form.Label>Tipo</Form.Label>
                    <Form.Select
                      value={formulario.tipo}
                      onChange={(evento) =>
                        cambiarTipo(evento.target.value as TipoTransaccion)
                      }
                    >
                      <option value={TipoTransaccion.Gasto}>Gasto</option>
                      <option value={TipoTransaccion.Ingreso}>Ingreso</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Group controlId="mov-monto">
                    <Form.Label>Monto (₡)</Form.Label>
                    <Form.Control
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formulario.monto}
                      required
                      isInvalid={Boolean(errores.monto)}
                      onChange={(evento) => {
                        setFormulario((previo) => ({ ...previo, monto: evento.target.value }));
                        limpiar('monto');
                      }}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errores.monto}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Group controlId="mov-fecha">
                    <Form.Label>Fecha</Form.Label>
                    <Form.Control
                      type="date"
                      value={formulario.fecha}
                      required
                      isInvalid={Boolean(errores.fecha)}
                      onChange={(evento) => {
                        setFormulario((previo) => ({ ...previo, fecha: evento.target.value }));
                        limpiar('fecha');
                      }}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errores.fecha}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>

                <Col xs={12} md={8}>
                  <Form.Group controlId="mov-descripcion">
                    <Form.Label>Descripción</Form.Label>
                    <Form.Control
                      value={formulario.descripcion}
                      required
                      placeholder="Ejemplo: Supermercado del barrio"
                      isInvalid={Boolean(errores.descripcion)}
                      onChange={(evento) => {
                        setFormulario((previo) => ({
                          ...previo,
                          descripcion: evento.target.value,
                        }));
                        limpiar('descripcion');
                      }}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errores.descripcion}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Group controlId="mov-categoria">
                    <Form.Label>Categoría</Form.Label>
                    <Form.Select
                      value={formulario.categoriaId}
                      required
                      isInvalid={Boolean(errores.categoriaId)}
                      onChange={(evento) => {
                        setFormulario((previo) => ({
                          ...previo,
                          categoriaId: evento.target.value,
                        }));
                        limpiar('categoriaId');
                      }}
                    >
                      <option value="">Seleccione…</option>
                      {categoriasDelTipo.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.icono} {categoria.nombre}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">
                      {errores.categoriaId}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>

                <Col xs={12} md={4}>
                  <Form.Group controlId="mov-cuenta">
                    <Form.Label>Cuenta</Form.Label>
                    <Form.Select
                      value={formulario.cuentaId}
                      required
                      isInvalid={Boolean(errores.cuentaId)}
                      onChange={(evento) => {
                        setFormulario((previo) => ({
                          ...previo,
                          cuentaId: evento.target.value,
                        }));
                        limpiar('cuentaId');
                      }}
                    >
                      <option value="">Seleccione…</option>
                      {cuentas
                        .filter((cuenta) => cuenta.activa)
                        .map((cuenta) => (
                          <option key={cuenta.id} value={cuenta.id}>
                            {cuenta.icono} {cuenta.nombre}
                          </option>
                        ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">
                      {errores.cuentaId}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Group controlId="mov-metodo">
                    <Form.Label>Método de pago</Form.Label>
                    <Form.Select
                      value={formulario.metodoPago}
                      onChange={(evento) =>
                        setFormulario((previo) => ({
                          ...previo,
                          metodoPago: evento.target.value as MetodoPago,
                        }))
                      }
                    >
                      {Object.values(MetodoPago).map((metodo) => (
                        <option key={metodo} value={metodo}>
                          {formatearMetodoPago(metodo)}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Group controlId="mov-estado">
                    <Form.Label>Estado</Form.Label>
                    <Form.Select
                      value={formulario.estado}
                      onChange={(evento) =>
                        setFormulario((previo) => ({
                          ...previo,
                          estado: evento.target.value as EstadoTransaccion,
                        }))
                      }
                    >
                      <option value={EstadoTransaccion.Confirmado}>Confirmado</option>
                      <option value={EstadoTransaccion.Pendiente}>Pendiente</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12}>
                  <Form.Group controlId="mov-etiquetas">
                    <Form.Label>Etiquetas (separadas por coma)</Form.Label>
                    <Form.Control
                      value={formulario.etiquetas}
                      placeholder="trabajo, fijo, emergencia"
                      onChange={(evento) =>
                        setFormulario((previo) => ({
                          ...previo,
                          etiquetas: evento.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex gap-2 mt-3">
                <Button type="submit" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar movimiento'}
                </Button>
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => {
                    limpiarTodo();
                    setMostrarFormulario(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col xs={12} md={3}>
              <Form.Group controlId="filtro-tipo">
                <Form.Label className="small text-muted mb-1">Tipo</Form.Label>
                <Form.Select
                  value={filtroTipo}
                  onChange={(evento) => setFiltroTipo(evento.target.value)}
                >
                  <option value="">Todos</option>
                  <option value={TipoTransaccion.Ingreso}>Ingresos</option>
                  <option value={TipoTransaccion.Gasto}>Gastos</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} md={3}>
              <Form.Group controlId="filtro-cuenta">
                <Form.Label className="small text-muted mb-1">Cuenta</Form.Label>
                <Form.Select
                  value={filtroCuenta}
                  onChange={(evento) => setFiltroCuenta(evento.target.value)}
                >
                  <option value="">Todas</option>
                  {cuentas.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group controlId="filtro-texto">
                <Form.Label className="small text-muted mb-1">Buscar</Form.Label>
                <Form.Control
                  value={filtroTexto}
                  placeholder="Descripción, categoría, etiqueta…"
                  onChange={(evento) => setFiltroTexto(evento.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          {cargando ? (
            <Cargando texto="Cargando movimientos…" />
          ) : transacciones.length === 0 ? (
            <p className="text-muted mb-0">
              No hay movimientos con estos filtros.
            </p>
          ) : (
            <div className="table-responsive">
              <Table hover size="sm" className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Cuenta</th>
                    <th>Método</th>
                    <th>Estado</th>
                    <th className="text-end">Monto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {transacciones.map((transaccion) => (
                    <tr key={transaccion.id}>
                      <td className="text-nowrap">{formatearFecha(transaccion.fecha)}</td>
                      <td>
                        {transaccion.descripcion}
                        {transaccion.etiquetas.length > 0 && (
                          <div className="small text-muted">
                            {transaccion.etiquetas.map((etiqueta) => (
                              <Badge key={etiqueta} bg="light" text="dark" className="me-1">
                                #{etiqueta}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="text-nowrap">{nombreCategoria(transaccion.categoriaId)}</td>
                      <td className="text-nowrap">{nombreCuenta(transaccion.cuentaId)}</td>
                      <td className="text-nowrap">
                        {formatearMetodoPago(transaccion.metodoPago)}
                      </td>
                      <td className="text-nowrap">
                        <Badge
                          bg={
                            transaccion.estado === EstadoTransaccion.Confirmado
                              ? 'success'
                              : 'warning'
                          }
                          text={transaccion.estado === EstadoTransaccion.Confirmado ? 'white' : 'dark'}
                        >
                          {formatearEstado(transaccion.estado)}
                        </Badge>
                      </td>
                      <td
                        className={`text-end fw-semibold text-nowrap ${
                          transaccion.tipo === TipoTransaccion.Ingreso
                            ? 'text-success'
                            : 'text-danger'
                        }`}
                      >
                        {transaccion.tipo === TipoTransaccion.Ingreso ? '+' : '−'}
                        {formatearMoneda(transaccion.monto)}
                      </td>
                      <td className="text-end">
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => void eliminar(transaccion.id)}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </>
  );
}
