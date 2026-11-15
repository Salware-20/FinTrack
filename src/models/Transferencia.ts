import { redondearMonto } from '../utils/numeros';
import { ErrorValidacion } from './errores';
import { Transaccion } from './Transaccion';
import type { NuevaTransferencia } from './tipos';

/** Representación serializable de una transferencia entre cuentas. */
export interface DatosTransferencia {
  id: string;
  usuarioId: string;
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  monto: number;
  fecha: string;
  descripcion: string;
  creadoEn: string;
}

/**
 * Movimiento interno de dinero entre dos cuentas del mismo usuario.
 *
 * Se guarda aparte de las transacciones para que los reportes de ingresos y
 * gastos no se inflen con el dinero que solo cambió de bolsillo.
 */
export class Transferencia {
  readonly id: string;
  readonly usuarioId: string;
  readonly cuentaOrigenId: string;
  readonly cuentaDestinoId: string;
  monto: number;
  fecha: string;
  descripcion: string;
  readonly creadoEn: string;

  constructor(datos: DatosTransferencia) {
    if (!datos.id) {
      throw new ErrorValidacion('La transferencia requiere un identificador.', 'id');
    }
    if (!datos.usuarioId) {
      throw new ErrorValidacion('La transferencia requiere un usuario.', 'usuarioId');
    }
    if (!datos.cuentaOrigenId || !datos.cuentaDestinoId) {
      throw new ErrorValidacion(
        'La transferencia requiere una cuenta de origen y una de destino.',
        'cuentaOrigenId',
      );
    }
    if (datos.cuentaOrigenId === datos.cuentaDestinoId) {
      throw new ErrorValidacion(
        'La cuenta de origen y la de destino deben ser diferentes.',
        'cuentaDestinoId',
      );
    }
    if (typeof datos.monto !== 'number' || !Number.isFinite(datos.monto) || datos.monto <= 0) {
      throw new ErrorValidacion('El monto debe ser un número mayor que cero.', 'monto');
    }

    Transaccion.validarFecha(datos.fecha);

    this.id = datos.id;
    this.usuarioId = datos.usuarioId;
    this.cuentaOrigenId = datos.cuentaOrigenId;
    this.cuentaDestinoId = datos.cuentaDestinoId;
    this.monto = redondearMonto(datos.monto);
    this.fecha = datos.fecha;
    this.descripcion = (datos.descripcion ?? '').trim() || 'Transferencia entre cuentas';
    this.creadoEn = datos.creadoEn;
  }

  toJSON(): DatosTransferencia {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      cuentaOrigenId: this.cuentaOrigenId,
      cuentaDestinoId: this.cuentaDestinoId,
      monto: this.monto,
      fecha: this.fecha,
      descripcion: this.descripcion,
      creadoEn: this.creadoEn,
    };
  }

  static crear(datos: NuevaTransferencia, usuarioId: string): Transferencia {
    return new Transferencia({
      id: `trf-${crypto.randomUUID()}`,
      usuarioId,
      cuentaOrigenId: datos.cuentaOrigenId,
      cuentaDestinoId: datos.cuentaDestinoId,
      monto: datos.monto,
      fecha: datos.fecha,
      descripcion: datos.descripcion ?? '',
      creadoEn: new Date().toISOString(),
    });
  }

  static desdeJSON(datos: DatosTransferencia): Transferencia {
    return new Transferencia(datos);
  }
}
