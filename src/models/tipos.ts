/**
 * Tipos, constantes y estructuras de datos del dominio financiero.
 *
 * Nota: el proyecto compila con `erasableSyntaxOnly`, por lo que NO se usan
 * `enum` de TypeScript. En su lugar se emplean objetos `as const` con un tipo
 * unión equivalente, que además funcionan como valores en tiempo de ejecución
 * (útiles para llenar selects y validar formularios).
 */

import type { Recurrencia } from './Recurrencia';
import type { Usuario } from './Usuario';

export const TipoTransaccion = {
  Ingreso: 'ingreso',
  Gasto: 'gasto',
} as const;

export type TipoTransaccion = (typeof TipoTransaccion)[keyof typeof TipoTransaccion];

/** Lista de tipos válidos, lista para recorrer en la interfaz. */
export const TIPOS_TRANSACCION: readonly TipoTransaccion[] = [
  TipoTransaccion.Ingreso,
  TipoTransaccion.Gasto,
];

export const TipoCuenta = {
  Efectivo: 'efectivo',
  Banco: 'banco',
  Ahorro: 'ahorro',
  Tarjeta: 'tarjeta',
} as const;

export type TipoCuenta = (typeof TipoCuenta)[keyof typeof TipoCuenta];

export const TIPOS_CUENTA: readonly TipoCuenta[] = [
  TipoCuenta.Efectivo,
  TipoCuenta.Banco,
  TipoCuenta.Ahorro,
  TipoCuenta.Tarjeta,
];

export const MetodoPago = {
  Efectivo: 'efectivo',
  Tarjeta: 'tarjeta',
  Transferencia: 'transferencia',
  Sinpe: 'sinpe',
  Otro: 'otro',
} as const;

export type MetodoPago = (typeof MetodoPago)[keyof typeof MetodoPago];

/** Lista de métodos de pago válidos, lista para recorrer en la interfaz. */
export const METODOS_PAGO: readonly MetodoPago[] = [
  MetodoPago.Efectivo,
  MetodoPago.Tarjeta,
  MetodoPago.Transferencia,
  MetodoPago.Sinpe,
  MetodoPago.Otro,
];

export const EstadoTransaccion = {
  Confirmado: 'confirmado',
  Pendiente: 'pendiente',
} as const;

export type EstadoTransaccion = (typeof EstadoTransaccion)[keyof typeof EstadoTransaccion];

export const ESTADOS_TRANSACCION: readonly EstadoTransaccion[] = [
  EstadoTransaccion.Confirmado,
  EstadoTransaccion.Pendiente,
];

export const FrecuenciaRecurrencia = {
  Diaria: 'diaria',
  Semanal: 'semanal',
  Mensual: 'mensual',
} as const;

export type FrecuenciaRecurrencia =
  (typeof FrecuenciaRecurrencia)[keyof typeof FrecuenciaRecurrencia];

/** Frecuencias válidas, lista para recorrer en la interfaz. */
export const FRECUENCIAS_RECURRENCIA: readonly FrecuenciaRecurrencia[] = [
  FrecuenciaRecurrencia.Diaria,
  FrecuenciaRecurrencia.Semanal,
  FrecuenciaRecurrencia.Mensual,
];

export const OrdenTransacciones = {
  FechaDesc: 'fecha-desc',
  FechaAsc: 'fecha-asc',
  MontoDesc: 'monto-desc',
  MontoAsc: 'monto-asc',
} as const;

export type OrdenTransacciones = (typeof OrdenTransacciones)[keyof typeof OrdenTransacciones];

/** Verifica en tiempo de ejecución si un valor es un tipo de transacción. */
export function esTipoTransaccion(valor: unknown): valor is TipoTransaccion {
  return valor === TipoTransaccion.Ingreso || valor === TipoTransaccion.Gasto;
}

/** Verifica en tiempo de ejecución si un valor es un tipo de cuenta. */
export function esTipoCuenta(valor: unknown): valor is TipoCuenta {
  return TIPOS_CUENTA.includes(valor as TipoCuenta);
}

/** Verifica en tiempo de ejecución si un valor es un método de pago válido. */
export function esMetodoPago(valor: unknown): valor is MetodoPago {
  return METODOS_PAGO.includes(valor as MetodoPago);
}

/** Verifica en tiempo de ejecución si un valor es un estado de transacción. */
export function esEstadoTransaccion(valor: unknown): valor is EstadoTransaccion {
  return ESTADOS_TRANSACCION.includes(valor as EstadoTransaccion);
}

/** Verifica en tiempo de ejecución si un valor es una frecuencia recurrente. */
export function esFrecuenciaRecurrencia(
  valor: unknown,
): valor is FrecuenciaRecurrencia {
  return FRECUENCIAS_RECURRENCIA.includes(valor as FrecuenciaRecurrencia);
}

/** Datos para crear una cuenta. */
export interface NuevaCuenta {
  nombre: string;
  tipo: TipoCuenta;
  /** Saldo con el que arranca la cuenta (puede ser 0). */
  saldoInicial: number;
  /** Banco o entidad, opcional. */
  institucion?: string;
  color?: string;
  icono?: string;
}

/** Datos para transferir dinero entre dos cuentas del mismo usuario. */
export interface NuevaTransferencia {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  monto: number;
  fecha: string;
  descripcion?: string;
}

/** Datos para registrar un usuario nuevo. */
export interface NuevoUsuario {
  nombre: string;
  correo: string;
  contrasena: string;
}

/** Resultado del registro: incluye el código de recuperación en claro (una sola vez). */
export interface ResultadoRegistro {
  usuario: Usuario;
  codigoRecuperacion: string;
}

/** Resultado de recuperar la contraseña: el código anterior se reemplaza. */
export interface ResultadoRecuperacion {
  usuario: Usuario;
  codigoRecuperacion: string;
}

/** Preferencias del usuario. */
export interface ConfiguracionUsuario {
  usuarioId: string;
  moneda: string;
  locale: string;
  tema: 'claro' | 'oscuro';
}

/** Filtros aceptados por las consultas del servicio de finanzas. */
export interface FiltroTransacciones {
  /** Fecha inicial inclusive, formato AAAA-MM-DD. */
  desde?: string;
  /** Fecha final inclusive, formato AAAA-MM-DD. */
  hasta?: string;
  tipo?: TipoTransaccion;
  categoriaId?: string;
  cuentaId?: string;
  metodoPago?: MetodoPago;
  estado?: EstadoTransaccion;
  /** Búsqueda libre sobre la descripción, la categoría y las etiquetas. */
  texto?: string;
  /** Orden de los resultados. Por defecto: fecha más reciente primero. */
  orden?: OrdenTransacciones;
}

/** Datos necesarios para registrar una transacción nueva. */
export interface NuevaTransaccion {
  /** Siempre positivo; el signo lo define `tipo`. */
  monto: number;
  tipo: TipoTransaccion;
  /** Fecha del movimiento, formato AAAA-MM-DD. */
  fecha: string;
  descripcion: string;
  categoriaId: string;
  /** Cuenta de donde sale o entra el dinero. */
  cuentaId: string;
  /** Si se omite, se usa "otro". */
  metodoPago?: MetodoPago;
  /** Si se omite, se usa "confirmado". */
  estado?: EstadoTransaccion;
  etiquetas?: string[];
}

/** Datos necesarios para crear una regla de movimiento recurrente. */
export interface NuevaRecurrencia {
  /** Siempre positivo; el signo lo define `tipo`. */
  monto: number;
  tipo: TipoTransaccion;
  /** Primera fecha de la serie, formato AAAA-MM-DD. */
  fechaInicio: string;
  descripcion: string;
  categoriaId: string;
  cuentaId: string;
  frecuencia: FrecuenciaRecurrencia;
  /** Última fecha permitida; `null` o vacío significa sin fin. */
  fechaFin?: string | null;
  /** Si se omite, se usa "otro". */
  metodoPago?: MetodoPago;
  etiquetas?: string[];
}

/** Cambios admitidos en una regla recurrente ya creada. */
export interface CambiosRecurrencia {
  activa?: boolean;
  fechaFin?: string | null;
}

/** Resultado de crear una regla y generar sus ocurrencias vencidas. */
export interface ResultadoCreacionRecurrencia {
  recurrencia: Recurrencia;
  /** Ocurrencias reales generadas hasta hoy (nunca fechas futuras). */
  generadas: number;
}

/** Datos necesarios para crear una categoría. */
export interface NuevaCategoria {
  nombre: string;
  tipo: TipoTransaccion;
  /** Categoría padre para subcategorías; null o vacío para raíz. */
  padreId?: string | null;
  /** Color hexadecimal; si se omite se usa el color por defecto. */
  color?: string;
  /** Emoji o texto corto; si se omite se usa un ícono genérico. */
  icono?: string;
}

/** Saldo calculado de una cuenta. */
export interface SaldoCuenta {
  cuentaId: string;
  nombre: string;
  tipo: TipoCuenta;
  color: string;
  icono: string;
  activa: boolean;
  saldo: number;
}

/** Acumulado de una categoría dentro de un resumen financiero. */
export interface ResumenPorCategoria {
  categoriaId: string;
  nombre: string;
  color: string;
  icono: string;
  tipo: TipoTransaccion;
  total: number;
  cantidad: number;
  /** Porcentaje sobre el total del mismo tipo (ingresos o gastos). */
  porcentaje: number;
}

/** Acumulado mensual dentro de un resumen financiero. */
export interface ResumenMensual {
  /** Periodo en formato AAAA-MM. */
  mes: string;
  ingresos: number;
  gastos: number;
  balance: number;
}

/** Resumen financiero listo para tarjetas y gráficos. */
export interface ResumenFinanciero {
  totalIngresos: number;
  totalGastos: number;
  /** totalIngresos - totalGastos. */
  balance: number;
  cantidadTransacciones: number;
  cantidadIngresos: number;
  cantidadGastos: number;
  /** Promedio por transacción; 0 si no hay movimientos del tipo. */
  promedioIngreso: number;
  promedioGasto: number;
  /** Desglose por categoría, ordenado de mayor a menor monto. */
  porCategoria: ResumenPorCategoria[];
  /** Evolución mensual, ordenada del mes más antiguo al más reciente. */
  porMes: ResumenMensual[];
  /** Rango real de fechas cubierto por las transacciones consideradas. */
  rango: {
    desde: string | null;
    hasta: string | null;
  };
}

/** Fila del estado de resultados. */
export interface FilaEstadoResultados {
  categoriaId: string;
  nombre: string;
  tipo: TipoTransaccion;
  total: number;
}

/** Estado de resultados de un periodo. */
export interface EstadoResultados {
  desde: string;
  hasta: string;
  totalIngresos: number;
  totalGastos: number;
  utilidad: number;
  filas: FilaEstadoResultados[];
}
