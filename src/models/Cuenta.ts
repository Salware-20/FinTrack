import { ErrorValidacion } from './errores';
import { esTipoCuenta, TipoCuenta } from './tipos';
import type { NuevaCuenta } from './tipos';

const COLOR_POR_TIPO: Record<TipoCuenta, string> = {
  [TipoCuenta.Efectivo]: '#198754',
  [TipoCuenta.Banco]: '#0d6efd',
  [TipoCuenta.Ahorro]: '#0dcaf0',
  [TipoCuenta.Tarjeta]: '#dc3545',
};

const ICONO_POR_TIPO: Record<TipoCuenta, string> = {
  [TipoCuenta.Efectivo]: '💵',
  [TipoCuenta.Banco]: '🏦',
  [TipoCuenta.Ahorro]: '🐖',
  [TipoCuenta.Tarjeta]: '💳',
};

/** Representación serializable de una cuenta. */
export interface DatosCuenta {
  id: string;
  usuarioId: string;
  nombre: string;
  tipo: TipoCuenta;
  /** Saldo con el que arrancó la cuenta. */
  saldoInicial: number;
  moneda: string;
  institucion: string;
  color: string;
  icono: string;
  activa: boolean;
  creadoEn: string;
}

/**
 * Cuenta donde vive el dinero: efectivo, banco, ahorro o tarjeta.
 *
 * El saldo actual no se guarda: se calcula sumando ingresos, restando gastos
 * y aplicando las transferencias. Así nunca queda desincronizado.
 */
export class Cuenta {
  readonly id: string;
  readonly usuarioId: string;
  nombre: string;
  readonly tipo: TipoCuenta;
  saldoInicial: number;
  readonly moneda: string;
  institucion: string;
  color: string;
  icono: string;
  activa: boolean;
  readonly creadoEn: string;

  constructor(datos: DatosCuenta) {
    if (!datos.id) {
      throw new ErrorValidacion('La cuenta requiere un identificador.', 'id');
    }
    if (!datos.usuarioId) {
      throw new ErrorValidacion('La cuenta requiere un usuario.', 'usuarioId');
    }
    if (!datos.nombre || !datos.nombre.trim()) {
      throw new ErrorValidacion('El nombre de la cuenta es obligatorio.', 'nombre');
    }
    if (!esTipoCuenta(datos.tipo)) {
      throw new ErrorValidacion('El tipo de cuenta no es válido.', 'tipo');
    }
    if (typeof datos.saldoInicial !== 'number' || !Number.isFinite(datos.saldoInicial)) {
      throw new ErrorValidacion('El saldo inicial debe ser un número.', 'saldoInicial');
    }

    this.id = datos.id;
    this.usuarioId = datos.usuarioId;
    this.nombre = datos.nombre.trim();
    this.tipo = datos.tipo;
    this.saldoInicial = datos.saldoInicial;
    this.moneda = datos.moneda;
    this.institucion = datos.institucion ?? '';
    this.color = datos.color ?? COLOR_POR_TIPO[datos.tipo];
    this.icono = datos.icono ?? ICONO_POR_TIPO[datos.tipo];
    this.activa = datos.activa;
    this.creadoEn = datos.creadoEn;
  }

  toJSON(): DatosCuenta {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      nombre: this.nombre,
      tipo: this.tipo,
      saldoInicial: this.saldoInicial,
      moneda: this.moneda,
      institucion: this.institucion,
      color: this.color,
      icono: this.icono,
      activa: this.activa,
      creadoEn: this.creadoEn,
    };
  }

  /** Crea una cuenta nueva para el usuario indicado. */
  static crear(datos: NuevaCuenta, usuarioId: string, moneda: string): Cuenta {
    return new Cuenta({
      id: `cta-${crypto.randomUUID()}`,
      usuarioId,
      nombre: datos.nombre,
      tipo: datos.tipo,
      saldoInicial: datos.saldoInicial ?? 0,
      moneda,
      institucion: datos.institucion ?? '',
      color: datos.color ?? COLOR_POR_TIPO[datos.tipo],
      icono: datos.icono ?? ICONO_POR_TIPO[datos.tipo],
      activa: true,
      creadoEn: new Date().toISOString(),
    });
  }

  static desdeJSON(datos: DatosCuenta): Cuenta {
    return new Cuenta(datos);
  }
}
