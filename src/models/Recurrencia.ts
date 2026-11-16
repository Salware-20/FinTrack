import { ErrorValidacion } from './errores';
import { Transaccion } from './Transaccion';
import { esFrecuenciaRecurrencia, MetodoPago } from './tipos';
import type {
  CambiosRecurrencia,
  FrecuenciaRecurrencia,
  NuevaRecurrencia,
  TipoTransaccion,
} from './tipos';

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Representación serializable de una regla de movimiento recurrente. */
export interface DatosRecurrencia {
  id: string;
  usuarioId: string;
  cuentaId: string;
  categoriaId: string;
  /** Monto siempre positivo; el signo lo aporta `tipo`. */
  monto: number;
  tipo: TipoTransaccion;
  descripcion: string;
  metodoPago: MetodoPago;
  etiquetas: string[];
  frecuencia: FrecuenciaRecurrencia;
  /** Primera fecha de la serie, formato AAAA-MM-DD. */
  fechaInicio: string;
  /** Última fecha permitida; `null` significa indefinida. */
  fechaFin: string | null;
  /** Día del mes original (1–31); evita el desplazamiento en meses cortos. */
  diaAncla: number;
  /** Siguiente ocurrencia que falta por generar. */
  proximaFecha: string;
  activa: boolean;
  /** Fecha y hora de registro en formato ISO 8601. */
  creadoEn: string;
}

/**
 * Regla que describe un gasto o ingreso repetitivo.
 *
 * La regla NO proyecta ni simula movimientos: solo guarda cuándo debe nacer
 * el siguiente. El servicio genera transacciones reales únicamente cuando su
 * fecha ya llegó, de modo que los saldos nunca incluyen ocurrencias futuras.
 */
export class Recurrencia {
  readonly id: string;
  readonly usuarioId: string;
  cuentaId: string;
  categoriaId: string;
  monto: number;
  tipo: TipoTransaccion;
  descripcion: string;
  metodoPago: MetodoPago;
  etiquetas: string[];
  frecuencia: FrecuenciaRecurrencia;
  readonly fechaInicio: string;
  fechaFin: string | null;
  readonly diaAncla: number;
  proximaFecha: string;
  activa: boolean;
  readonly creadoEn: string;

  constructor(datos: DatosRecurrencia) {
    if (!datos.id) {
      throw new ErrorValidacion('La recurrencia requiere un identificador.', 'id');
    }

    // Reutiliza todas las validaciones de una transacción (monto, fecha,
    // descripción, referencias y método de pago) antes de aceptar la regla.
    const base = Transaccion.crear(
      {
        monto: datos.monto,
        tipo: datos.tipo,
        fecha: datos.fechaInicio,
        descripcion: datos.descripcion,
        categoriaId: datos.categoriaId,
        cuentaId: datos.cuentaId,
        metodoPago: datos.metodoPago,
        etiquetas: datos.etiquetas,
      },
      datos.usuarioId,
    );

    if (!esFrecuenciaRecurrencia(datos.frecuencia)) {
      throw new ErrorValidacion(
        'La frecuencia debe ser diaria, semanal o mensual.',
        'frecuencia',
      );
    }

    const fechaFin = datos.fechaFin ?? null;
    if (fechaFin !== null) {
      Transaccion.validarFecha(fechaFin);
      if (fechaFin < datos.fechaInicio) {
        throw new ErrorValidacion(
          'La fecha final no puede ser anterior a la fecha de inicio.',
          'fechaFin',
        );
      }
    }

    const diaAncla = datos.diaAncla ?? Number(datos.fechaInicio.slice(8, 10));
    if (!Number.isInteger(diaAncla) || diaAncla < 1 || diaAncla > 31) {
      throw new ErrorValidacion(
        'El día de anclaje debe estar entre 1 y 31.',
        'diaAncla',
      );
    }

    const proximaFecha = datos.proximaFecha ?? datos.fechaInicio;
    if (
      typeof proximaFecha !== 'string' ||
      !PATRON_FECHA.test(proximaFecha)
    ) {
      throw new ErrorValidacion(
        'La próxima fecha debe tener formato AAAA-MM-DD.',
        'proximaFecha',
      );
    }
    Transaccion.validarFecha(proximaFecha);
    if (proximaFecha < datos.fechaInicio) {
      throw new ErrorValidacion(
        'La próxima ocurrencia no puede ser anterior al inicio.',
        'proximaFecha',
      );
    }

    this.id = datos.id;
    this.usuarioId = datos.usuarioId;
    this.cuentaId = base.cuentaId;
    this.categoriaId = base.categoriaId;
    this.monto = base.monto;
    this.tipo = base.tipo;
    this.descripcion = base.descripcion;
    this.metodoPago = base.metodoPago;
    this.etiquetas = [...base.etiquetas];
    this.frecuencia = datos.frecuencia;
    this.fechaInicio = datos.fechaInicio;
    this.fechaFin = fechaFin;
    this.diaAncla = diaAncla;
    this.proximaFecha = proximaFecha;
    this.activa = datos.activa ?? true;
    this.creadoEn = datos.creadoEn;
  }

  /** Verdadero si la regla representa una entrada de dinero. */
  get esIngreso(): boolean {
    return this.tipo === 'ingreso';
  }

  /** Verdadero si ya se generó la última ocurrencia permitida. */
  get finalizada(): boolean {
    return this.fechaFin !== null && this.proximaFecha > this.fechaFin;
  }

  /** Periodo mensual de la próxima ocurrencia, formato AAAA-MM. */
  get periodoProximo(): string {
    return this.proximaFecha.slice(0, 7);
  }

  /** Aplica cambios parciales validando el resultado. */
  actualizar(cambios: CambiosRecurrencia): void {
    if (cambios.fechaFin !== undefined) {
      const fechaFin = cambios.fechaFin || null;
      if (fechaFin !== null) {
        Transaccion.validarFecha(fechaFin);
        if (fechaFin < this.fechaInicio) {
          throw new ErrorValidacion(
            'La fecha final no puede ser anterior a la fecha de inicio.',
            'fechaFin',
          );
        }
      }
      this.fechaFin = fechaFin;
    }

    if (cambios.activa !== undefined) {
      this.activa = cambios.activa;
    }
  }

  toJSON(): DatosRecurrencia {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      cuentaId: this.cuentaId,
      categoriaId: this.categoriaId,
      monto: this.monto,
      tipo: this.tipo,
      descripcion: this.descripcion,
      metodoPago: this.metodoPago,
      etiquetas: [...this.etiquetas],
      frecuencia: this.frecuencia,
      fechaInicio: this.fechaInicio,
      fechaFin: this.fechaFin,
      diaAncla: this.diaAncla,
      proximaFecha: this.proximaFecha,
      activa: this.activa,
      creadoEn: this.creadoEn,
    };
  }

  /** Crea una regla nueva; la primera ocurrencia queda pendiente de generar. */
  static crear(datos: NuevaRecurrencia, usuarioId: string): Recurrencia {
    return new Recurrencia({
      id: `rec-${crypto.randomUUID()}`,
      usuarioId,
      cuentaId: datos.cuentaId,
      categoriaId: datos.categoriaId,
      monto: datos.monto,
      tipo: datos.tipo,
      descripcion: datos.descripcion,
      metodoPago: datos.metodoPago ?? MetodoPago.Otro,
      etiquetas: datos.etiquetas ?? [],
      frecuencia: datos.frecuencia,
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin ?? null,
      diaAncla: Number(datos.fechaInicio.slice(8, 10)),
      proximaFecha: datos.fechaInicio,
      activa: true,
      creadoEn: new Date().toISOString(),
    });
  }

  static desdeJSON(datos: DatosRecurrencia): Recurrencia {
    return new Recurrencia(datos);
  }
}
