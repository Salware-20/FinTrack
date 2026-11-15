/**
 * Tipos, constantes y estructuras de datos del dominio financiero.
 *
 * Nota: el proyecto compila con `erasableSyntaxOnly`, por lo que NO se usan
 * `enum` de TypeScript. En su lugar se emplean objetos `as const` con un tipo
 * unión equivalente, que además funcionan como valores en tiempo de ejecución
 * (útiles para llenar selects y validar formularios).
 */

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

/** Verifica en tiempo de ejecución si un valor es un método de pago válido. */
export function esMetodoPago(valor: unknown): valor is MetodoPago {
  return METODOS_PAGO.includes(valor as MetodoPago);
}

/** Filtros aceptados por las consultas del servicio de finanzas. */
export interface FiltroTransacciones {
  /** Fecha inicial inclusive, formato AAAA-MM-DD. */
  desde?: string;
  /** Fecha final inclusive, formato AAAA-MM-DD. */
  hasta?: string;
  tipo?: TipoTransaccion;
  categoriaId?: string;
  metodoPago?: MetodoPago;
  /** Búsqueda libre sobre la descripción y el nombre de la categoría. */
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
  /** Si se omite, se usa "otro". */
  metodoPago?: MetodoPago;
}

/** Datos necesarios para crear una categoría. */
export interface NuevaCategoria {
  nombre: string;
  tipo: TipoTransaccion;
  /** Color hexadecimal; si se omite se usa el color por defecto. */
  color?: string;
  /** Emoji o texto corto; si se omite se usa un ícono genérico. */
  icono?: string;
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
