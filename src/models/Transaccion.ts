import { redondearMonto } from '../utils/numeros';
import { ErrorValidacion } from './errores';
import {
  esEstadoTransaccion,
  esMetodoPago,
  esTipoTransaccion,
  EstadoTransaccion,
  MetodoPago,
} from './tipos';
import type { EstadoTransaccion as EstadoTransaccionType, TipoTransaccion } from './tipos';

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Representación serializable de una transacción. */
export interface DatosTransaccion {
  id: string;
  usuarioId: string;
  /** Cuenta de donde sale (gasto) o entra (ingreso) el dinero. */
  cuentaId: string;
  /** Monto siempre positivo; el signo lo aporta `tipo`. */
  monto: number;
  tipo: TipoTransaccion;
  /** Fecha del movimiento, formato AAAA-MM-DD. */
  fecha: string;
  descripcion: string;
  categoriaId: string;
  metodoPago: MetodoPago;
  estado: EstadoTransaccionType;
  etiquetas: string[];
  /** Fecha y hora de registro en formato ISO 8601. */
  creadoEn: string;
  /** Regla recurrente que generó el movimiento, si aplica. */
  recurrenciaId?: string;
  /** Fecha de la ocurrencia dentro de la serie, si aplica. */
  recurrenciaFecha?: string;
}

/**
 * Movimiento de dinero: un ingreso o un gasto.
 *
 * Las transferencias NO son transacciones: se modelan aparte para que no
 * contaminen los reportes de ingresos y gastos.
 *
 * Reglas de negocio:
 * - el monto debe ser mayor que cero (el signo lo define el tipo);
 * - la fecha debe ser una fecha real en formato AAAA-MM-DD;
 * - la descripción es obligatoria;
 * - siempre debe apuntar a una cuenta y a una categoría del mismo usuario
 *   (el servicio valida la existencia, la pertenencia y el tipo).
 */
export class Transaccion {
  readonly id: string;
  readonly usuarioId: string;
  cuentaId: string;
  monto: number;
  tipo: TipoTransaccion;
  fecha: string;
  descripcion: string;
  categoriaId: string;
  metodoPago: MetodoPago;
  estado: EstadoTransaccionType;
  etiquetas: string[];
  readonly creadoEn: string;
  /** Vínculo con la regla que generó el movimiento (solo si aplica). */
  readonly recurrenciaId?: string;
  readonly recurrenciaFecha?: string;

  constructor(datos: DatosTransaccion) {
    if (!datos.id) {
      throw new ErrorValidacion('La transacción requiere un identificador.', 'id');
    }
    if (!datos.usuarioId) {
      throw new ErrorValidacion('La transacción requiere un usuario.', 'usuarioId');
    }
    if (!esTipoTransaccion(datos.tipo)) {
      throw new ErrorValidacion(
        'El tipo de transacción debe ser "ingreso" o "gasto".',
        'tipo',
      );
    }

    Transaccion.validarMonto(datos.monto);
    Transaccion.validarFecha(datos.fecha);

    if (!datos.descripcion || !datos.descripcion.trim()) {
      throw new ErrorValidacion('La descripción es obligatoria.', 'descripcion');
    }
    if (!datos.categoriaId) {
      throw new ErrorValidacion('La transacción debe tener una categoría.', 'categoriaId');
    }
    if (!datos.cuentaId) {
      throw new ErrorValidacion('La transacción debe tener una cuenta.', 'cuentaId');
    }
    if (!esMetodoPago(datos.metodoPago)) {
      throw new ErrorValidacion('El método de pago no es válido.', 'metodoPago');
    }
    if (!esEstadoTransaccion(datos.estado)) {
      throw new ErrorValidacion('El estado de la transacción no es válido.', 'estado');
    }

    this.id = datos.id;
    this.usuarioId = datos.usuarioId;
    this.cuentaId = datos.cuentaId;
    this.monto = redondearMonto(datos.monto);
    this.tipo = datos.tipo;
    this.fecha = datos.fecha;
    this.descripcion = datos.descripcion.trim();
    this.categoriaId = datos.categoriaId;
    this.metodoPago = datos.metodoPago;
    this.estado = datos.estado;
    this.etiquetas = normalizarEtiquetas(datos.etiquetas);
    this.creadoEn = datos.creadoEn;
    this.recurrenciaId = datos.recurrenciaId;
    this.recurrenciaFecha = datos.recurrenciaFecha;
  }

  /** Verdadero si la transacción representa una entrada de dinero. */
  get esIngreso(): boolean {
    return this.tipo === 'ingreso';
  }

  /** Monto con signo: positivo para ingresos, negativo para gastos. */
  get montoFirmado(): number {
    return this.esIngreso ? this.monto : -this.monto;
  }

  /** Periodo mensual al que pertenece la transacción, formato AAAA-MM. */
  get periodo(): string {
    return this.fecha.slice(0, 7);
  }

  /** Aplica cambios parciales validando el resultado antes de aceptarlo. */
  actualizar(cambios: Partial<DatosTransaccion>): void {
    const fusion = { ...this.toJSON(), ...Transaccion.soloDefinidos(cambios) };
    const actualizada = new Transaccion(fusion);

    this.cuentaId = actualizada.cuentaId;
    this.monto = actualizada.monto;
    this.tipo = actualizada.tipo;
    this.fecha = actualizada.fecha;
    this.descripcion = actualizada.descripcion;
    this.categoriaId = actualizada.categoriaId;
    this.metodoPago = actualizada.metodoPago;
    this.estado = actualizada.estado;
    this.etiquetas = actualizada.etiquetas;
  }

  toJSON(): DatosTransaccion {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      cuentaId: this.cuentaId,
      monto: this.monto,
      tipo: this.tipo,
      fecha: this.fecha,
      descripcion: this.descripcion,
      categoriaId: this.categoriaId,
      metodoPago: this.metodoPago,
      estado: this.estado,
      etiquetas: [...this.etiquetas],
      creadoEn: this.creadoEn,
      ...(this.recurrenciaId
        ? {
            recurrenciaId: this.recurrenciaId,
            recurrenciaFecha: this.recurrenciaFecha,
          }
        : {}),
    };
  }

  /** Crea una transacción nueva generando id y fecha de registro. */
  static crear(
    datos: {
      monto: number;
      tipo: TipoTransaccion;
      fecha: string;
      descripcion: string;
      categoriaId: string;
      cuentaId: string;
      metodoPago?: MetodoPago;
      estado?: EstadoTransaccionType;
      etiquetas?: string[];
    },
    usuarioId: string,
    recurrencia?: { id: string; fecha: string },
  ): Transaccion {
    return new Transaccion({
      id: `trx-${crypto.randomUUID()}`,
      usuarioId,
      cuentaId: datos.cuentaId,
      monto: datos.monto,
      tipo: datos.tipo,
      fecha: datos.fecha,
      descripcion: datos.descripcion,
      categoriaId: datos.categoriaId,
      metodoPago: datos.metodoPago ?? MetodoPago.Otro,
      estado: datos.estado ?? EstadoTransaccion.Confirmado,
      etiquetas: datos.etiquetas ?? [],
      creadoEn: new Date().toISOString(),
      recurrenciaId: recurrencia?.id,
      recurrenciaFecha: recurrencia?.fecha,
    });
  }

  static desdeJSON(datos: DatosTransaccion): Transaccion {
    return new Transaccion(datos);
  }

  static validarFecha(fecha: string): void {
    if (typeof fecha !== 'string' || !PATRON_FECHA.test(fecha)) {
      throw new ErrorValidacion('La fecha debe tener formato AAAA-MM-DD.', 'fecha');
    }

    const [anio, mes, dia] = fecha.split('-').map(Number);
    const fechaObjeto = new Date(anio, mes - 1, dia);
    const esFechaReal =
      fechaObjeto.getFullYear() === anio &&
      fechaObjeto.getMonth() === mes - 1 &&
      fechaObjeto.getDate() === dia;

    if (!esFechaReal) {
      throw new ErrorValidacion('La fecha indicada no existe en el calendario.', 'fecha');
    }
  }

  private static validarMonto(monto: number): void {
    if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0) {
      throw new ErrorValidacion('El monto debe ser un número mayor que cero.', 'monto');
    }
  }

  /** Descarta las claves `undefined` para no sobrescribir datos existentes. */
  private static soloDefinidos(
    cambios: Partial<DatosTransaccion>,
  ): Partial<DatosTransaccion> {
    const limpio: Partial<DatosTransaccion> = {};
    if (cambios.cuentaId !== undefined) limpio.cuentaId = cambios.cuentaId;
    if (cambios.monto !== undefined) limpio.monto = cambios.monto;
    if (cambios.tipo !== undefined) limpio.tipo = cambios.tipo;
    if (cambios.fecha !== undefined) limpio.fecha = cambios.fecha;
    if (cambios.descripcion !== undefined) limpio.descripcion = cambios.descripcion;
    if (cambios.categoriaId !== undefined) limpio.categoriaId = cambios.categoriaId;
    if (cambios.metodoPago !== undefined) limpio.metodoPago = cambios.metodoPago;
    if (cambios.estado !== undefined) limpio.estado = cambios.estado;
    if (cambios.etiquetas !== undefined) limpio.etiquetas = cambios.etiquetas;
    return limpio;
  }
}

function normalizarEtiquetas(etiquetas: string[] | undefined): string[] {
  if (!etiquetas) return [];
  return [
    ...new Set(
      etiquetas
        .map((etiqueta) => etiqueta.trim())
        .filter((etiqueta) => etiqueta.length > 0),
    ),
  ];
}
