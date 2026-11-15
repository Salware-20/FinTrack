import { redondearMonto } from '../utils/numeros';
import { ErrorValidacion } from './errores';
import { esMetodoPago, esTipoTransaccion, MetodoPago } from './tipos';
import type { NuevaTransaccion, TipoTransaccion } from './tipos';

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Representación serializable de una transacción. */
export interface DatosTransaccion {
  id: string;
  /** Monto siempre positivo; el signo lo aporta `tipo`. */
  monto: number;
  tipo: TipoTransaccion;
  /** Fecha del movimiento, formato AAAA-MM-DD. */
  fecha: string;
  descripcion: string;
  categoriaId: string;
  metodoPago: MetodoPago;
  /** Fecha y hora de registro en formato ISO 8601. */
  creadoEn: string;
}

/**
 * Movimiento de dinero: un ingreso o un gasto.
 *
 * Reglas de negocio:
 * - el monto debe ser mayor que cero (el signo lo define el tipo);
 * - la fecha debe ser una fecha real en formato AAAA-MM-DD;
 * - la descripción es obligatoria;
 * - siempre debe apuntar a una categoría (el servicio valida que exista y
 *   que su tipo coincida con el de la transacción).
 */
export class Transaccion {
  readonly id: string;
  monto: number;
  tipo: TipoTransaccion;
  fecha: string;
  descripcion: string;
  categoriaId: string;
  metodoPago: MetodoPago;
  readonly creadoEn: string;

  constructor(datos: DatosTransaccion) {
    if (!datos.id) {
      throw new ErrorValidacion('La transacción requiere un identificador.', 'id');
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
    if (!esMetodoPago(datos.metodoPago)) {
      throw new ErrorValidacion('El método de pago no es válido.', 'metodoPago');
    }

    this.id = datos.id;
    this.monto = redondearMonto(datos.monto);
    this.tipo = datos.tipo;
    this.fecha = datos.fecha;
    this.descripcion = datos.descripcion.trim();
    this.categoriaId = datos.categoriaId;
    this.metodoPago = datos.metodoPago;
    this.creadoEn = datos.creadoEn;
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
  actualizar(cambios: Partial<NuevaTransaccion>): void {
    const fusion = { ...this.toJSON(), ...Transaccion.soloDefinidos(cambios) };
    const actualizada = new Transaccion(fusion);

    this.monto = actualizada.monto;
    this.tipo = actualizada.tipo;
    this.fecha = actualizada.fecha;
    this.descripcion = actualizada.descripcion;
    this.categoriaId = actualizada.categoriaId;
    this.metodoPago = actualizada.metodoPago;
  }

  toJSON(): DatosTransaccion {
    return {
      id: this.id,
      monto: this.monto,
      tipo: this.tipo,
      fecha: this.fecha,
      descripcion: this.descripcion,
      categoriaId: this.categoriaId,
      metodoPago: this.metodoPago,
      creadoEn: this.creadoEn,
    };
  }

  /** Crea una transacción nueva generando id y fecha de registro. */
  static crear(datos: NuevaTransaccion): Transaccion {
    return new Transaccion({
      id: `trx-${crypto.randomUUID()}`,
      monto: datos.monto,
      tipo: datos.tipo,
      fecha: datos.fecha,
      descripcion: datos.descripcion,
      categoriaId: datos.categoriaId,
      metodoPago: datos.metodoPago ?? MetodoPago.Otro,
      creadoEn: new Date().toISOString(),
    });
  }

  static desdeJSON(datos: DatosTransaccion): Transaccion {
    return new Transaccion(datos);
  }

  private static validarMonto(monto: number): void {
    if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0) {
      throw new ErrorValidacion('El monto debe ser un número mayor que cero.', 'monto');
    }
  }

  private static validarFecha(fecha: string): void {
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

  /** Descarta las claves `undefined` para no sobrescribir datos existentes. */
  private static soloDefinidos(
    cambios: Partial<NuevaTransaccion>,
  ): Partial<DatosTransaccion> {
    const limpio: Partial<DatosTransaccion> = {};
    if (cambios.monto !== undefined) limpio.monto = cambios.monto;
    if (cambios.tipo !== undefined) limpio.tipo = cambios.tipo;
    if (cambios.fecha !== undefined) limpio.fecha = cambios.fecha;
    if (cambios.descripcion !== undefined) limpio.descripcion = cambios.descripcion;
    if (cambios.categoriaId !== undefined) limpio.categoriaId = cambios.categoriaId;
    if (cambios.metodoPago !== undefined) limpio.metodoPago = cambios.metodoPago;
    return limpio;
  }
}
