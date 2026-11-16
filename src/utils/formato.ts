import { CONFIG_APP } from '../config/app';
import { MetodoPago } from '../models/tipos';
import type {
  EstadoTransaccion,
  FrecuenciaRecurrencia,
  TipoCuenta,
  TipoTransaccion,
} from '../models/tipos';

const ETIQUETAS_METODO_PAGO: Record<MetodoPago, string> = {
  [MetodoPago.Efectivo]: 'Efectivo',
  [MetodoPago.Tarjeta]: 'Tarjeta',
  [MetodoPago.Transferencia]: 'Transferencia',
  [MetodoPago.Sinpe]: 'SINPE Móvil',
  [MetodoPago.Otro]: 'Otro',
};

const ETIQUETAS_TIPO_CUENTA: Record<TipoCuenta, string> = {
  efectivo: 'Efectivo',
  banco: 'Cuenta bancaria',
  ahorro: 'Ahorro',
  tarjeta: 'Tarjeta',
};

const ETIQUETAS_ESTADO: Record<EstadoTransaccion, string> = {
  confirmado: 'Confirmado',
  pendiente: 'Pendiente',
};

const ETIQUETAS_FRECUENCIA: Record<FrecuenciaRecurrencia, string> = {
  diaria: 'Diaria',
  semanal: 'Semanal',
  mensual: 'Mensual',
};

const formateadoresMoneda = new Map<string, Intl.NumberFormat>();

function obtenerFormateadorMoneda(moneda: string): Intl.NumberFormat {
  const existente = formateadoresMoneda.get(moneda);
  if (existente) return existente;

  const formateador = new Intl.NumberFormat(CONFIG_APP.locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  formateadoresMoneda.set(moneda, formateador);
  return formateador;
}

/** Formatea un monto como moneda: 12500 -> "₡12 500,00". */
export function formatearMoneda(
  monto: number,
  moneda: string = CONFIG_APP.moneda,
): string {
  return obtenerFormateadorMoneda(moneda).format(monto);
}

/** Convierte una fecha local a texto AAAA-MM-DD (sin desfase de zona horaria). */
export function aFechaISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function analizarFechaISO(fecha: string): Date | null {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) return null;

  const objeto = new Date(anio, mes - 1, dia);
  return Number.isNaN(objeto.getTime()) ? null : objeto;
}

/** Formatea una fecha AAAA-MM-DD en texto largo: "14 de noviembre de 2026". */
export function formatearFecha(fecha: string): string {
  const objeto = analizarFechaISO(fecha);
  if (!objeto) return fecha;

  return new Intl.DateTimeFormat(CONFIG_APP.locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(objeto);
}

/** Formatea un periodo AAAA-MM: "2026-11" -> "noviembre de 2026". */
export function formatearMes(mes: string): string {
  const objeto = analizarFechaISO(`${mes}-01`);
  if (!objeto) return mes;

  return new Intl.DateTimeFormat(CONFIG_APP.locale, {
    month: 'long',
    year: 'numeric',
  }).format(objeto);
}

/** Formatea un porcentaje ya calculado: 32.5 -> "32,5 %". */
export function formatearPorcentaje(valor: number): string {
  return `${valor.toLocaleString(CONFIG_APP.locale, {
    maximumFractionDigits: 1,
  })} %`;
}

/** Nombre legible de un método de pago. */
export function formatearMetodoPago(metodo: MetodoPago): string {
  return ETIQUETAS_METODO_PAGO[metodo] ?? metodo;
}

/** Nombre legible de un tipo de transacción. */
export function formatearTipo(tipo: TipoTransaccion): string {
  return tipo === 'ingreso' ? 'Ingreso' : 'Gasto';
}

/** Nombre legible de un tipo de cuenta. */
export function formatearTipoCuenta(tipo: TipoCuenta): string {
  return ETIQUETAS_TIPO_CUENTA[tipo] ?? tipo;
}

/** Nombre legible de un estado de transacción. */
export function formatearEstado(estado: EstadoTransaccion): string {
  return ETIQUETAS_ESTADO[estado] ?? estado;
}

/** Nombre legible de una frecuencia recurrente. */
export function formatearFrecuencia(frecuencia: FrecuenciaRecurrencia): string {
  return ETIQUETAS_FRECUENCIA[frecuencia] ?? frecuencia;
}

/** Fecha de hoy en formato AAAA-MM-DD. */
export function fechaHoy(): string {
  return aFechaISO(new Date());
}

/** Primer día del mes actual en formato AAAA-MM-DD. */
export function inicioDeMes(fecha: Date = new Date()): string {
  return aFechaISO(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
}

/** Último día del mes actual en formato AAAA-MM-DD. */
export function finDeMes(fecha: Date = new Date()): string {
  return aFechaISO(new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0));
}
