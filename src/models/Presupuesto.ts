import { redondearMonto } from '../utils/numeros';
import { ErrorValidacion } from './errores';
import type { CambiosPresupuesto, NuevoPresupuesto } from './tipos';

const PATRON_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Verifica en tiempo de ejecución si un valor es un periodo mensual AAAA-MM. */
export function esPeriodoMensual(valor: unknown): valor is string {
  return typeof valor === 'string' && PATRON_PERIODO.test(valor);
}

/** Representación serializable de un presupuesto por categoría. */
export interface DatosPresupuesto {
  id: string;
  usuarioId: string;
  categoriaId: string;
  /** Límite mensual, siempre positivo y con 2 decimales. */
  montoLimite: number;
  /** Mes concreto (AAAA-MM) o `null` para repetirlo todos los meses. */
  periodo: string | null;
  /** Porcentaje de consumo que dispara la advertencia (1–100). */
  alertaPorcentaje: number;
  activo: boolean;
  /** Fecha y hora de registro en formato ISO 8601. */
  creadoEn: string;
}

/**
 * Límite de gasto para una categoría.
 *
 * El presupuesto no guarda montos gastados: esos se calculan al consultar el
 * periodo con las transacciones confirmadas. Así el límite nunca queda
 * desincronizado del historial.
 */
export class Presupuesto {
  readonly id: string;
  readonly usuarioId: string;
  categoriaId: string;
  montoLimite: number;
  periodo: string | null;
  alertaPorcentaje: number;
  activo: boolean;
  readonly creadoEn: string;

  constructor(datos: DatosPresupuesto) {
    if (!datos.id) {
      throw new ErrorValidacion('El presupuesto requiere un identificador.', 'id');
    }
    if (!datos.usuarioId) {
      throw new ErrorValidacion('El presupuesto requiere un usuario.', 'usuarioId');
    }
    if (!datos.categoriaId) {
      throw new ErrorValidacion(
        'El presupuesto requiere una categoría.',
        'categoriaId',
      );
    }

    if (
      typeof datos.montoLimite !== 'number' ||
      !Number.isFinite(datos.montoLimite)
    ) {
      throw new ErrorValidacion(
        'El límite debe ser un número mayor que cero.',
        'montoLimite',
      );
    }
    const montoLimite = redondearMonto(datos.montoLimite);
    if (montoLimite <= 0) {
      throw new ErrorValidacion(
        'El límite debe ser un número mayor que cero.',
        'montoLimite',
      );
    }

    const periodo = datos.periodo ?? null;
    if (periodo !== null && !esPeriodoMensual(periodo)) {
      throw new ErrorValidacion(
        'El periodo debe tener formato AAAA-MM o quedar vacío para repetirse cada mes.',
        'periodo',
      );
    }

    const alertaPorcentaje = datos.alertaPorcentaje ?? 80;
    if (
      typeof alertaPorcentaje !== 'number' ||
      !Number.isFinite(alertaPorcentaje) ||
      alertaPorcentaje < 1 ||
      alertaPorcentaje > 100
    ) {
      throw new ErrorValidacion(
        'La alerta debe ser un porcentaje entre 1 y 100.',
        'alertaPorcentaje',
      );
    }

    this.id = datos.id;
    this.usuarioId = datos.usuarioId;
    this.categoriaId = datos.categoriaId;
    this.montoLimite = montoLimite;
    this.periodo = periodo;
    this.alertaPorcentaje = redondearMonto(alertaPorcentaje);
    this.activo = datos.activo ?? true;
    this.creadoEn = datos.creadoEn;
  }

  /** Verdadero si el límite se repite todos los meses. */
  get recurrente(): boolean {
    return this.periodo === null;
  }

  /** Verdadero si el presupuesto aplica al periodo mensual indicado. */
  aplicaA(periodo: string): boolean {
    return this.periodo === null || this.periodo === periodo;
  }

  /** Aplica cambios parciales validando el resultado. */
  actualizar(cambios: CambiosPresupuesto): void {
    if (cambios.montoLimite !== undefined) {
      if (
        typeof cambios.montoLimite !== 'number' ||
        !Number.isFinite(cambios.montoLimite)
      ) {
        throw new ErrorValidacion(
          'El límite debe ser un número mayor que cero.',
          'montoLimite',
        );
      }
      const montoLimite = redondearMonto(cambios.montoLimite);
      if (montoLimite <= 0) {
        throw new ErrorValidacion(
          'El límite debe ser un número mayor que cero.',
          'montoLimite',
        );
      }
      this.montoLimite = montoLimite;
    }

    if (cambios.periodo !== undefined) {
      const periodo = cambios.periodo || null;
      if (periodo !== null && !esPeriodoMensual(periodo)) {
        throw new ErrorValidacion(
          'El periodo debe tener formato AAAA-MM o quedar vacío para repetirse cada mes.',
          'periodo',
        );
      }
      this.periodo = periodo;
    }

    if (cambios.alertaPorcentaje !== undefined) {
      const alerta = cambios.alertaPorcentaje;
      if (
        typeof alerta !== 'number' ||
        !Number.isFinite(alerta) ||
        alerta < 1 ||
        alerta > 100
      ) {
        throw new ErrorValidacion(
          'La alerta debe ser un porcentaje entre 1 y 100.',
          'alertaPorcentaje',
        );
      }
      this.alertaPorcentaje = redondearMonto(alerta);
    }

    if (cambios.activo !== undefined) {
      this.activo = cambios.activo;
    }
  }

  toJSON(): DatosPresupuesto {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      categoriaId: this.categoriaId,
      montoLimite: this.montoLimite,
      periodo: this.periodo,
      alertaPorcentaje: this.alertaPorcentaje,
      activo: this.activo,
      creadoEn: this.creadoEn,
    };
  }

  /** Crea un presupuesto nuevo con id, estado y fecha de registro. */
  static crear(datos: NuevoPresupuesto, usuarioId: string): Presupuesto {
    return new Presupuesto({
      id: `pre-${crypto.randomUUID()}`,
      usuarioId,
      categoriaId: datos.categoriaId,
      montoLimite: datos.montoLimite,
      periodo: datos.periodo ?? null,
      alertaPorcentaje: datos.alertaPorcentaje ?? 80,
      activo: datos.activo ?? true,
      creadoEn: new Date().toISOString(),
    });
  }

  static desdeJSON(datos: DatosPresupuesto): Presupuesto {
    return new Presupuesto(datos);
  }
}
