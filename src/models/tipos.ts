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
  /** Meta de ahorro mensual; 0 o ausente significa sin meta configurada. */
  metaAhorroMensual?: number;
}

/** Estado de la alerta de un presupuesto. */
export const EstadoAlertaPresupuesto = {
  Normal: 'normal',
  Advertencia: 'advertencia',
  Excedido: 'excedido',
} as const;

export type EstadoAlertaPresupuesto =
  (typeof EstadoAlertaPresupuesto)[keyof typeof EstadoAlertaPresupuesto];

/** Situacion calculada de un presupuesto para un periodo concreto. */
export interface EstadoPresupuesto {
  presupuestoId: string;
  categoriaId: string;
  categoriaNombre: string;
  montoLimite: number;
  montoGastado: number;
  montoDisponible: number;
  /** Porcentaje de consumo respecto al limite (0-100+). */
  porcentajeConsumido: number;
  estadoAlerta: EstadoAlertaPresupuesto;
}

/**
 * Categoria que absorbe el umbral % o mas del gasto total del periodo.
 * Se genera automaticamente sin configurar un limite manual.
 */
export interface AlertaConcentracionGasto {
  categoriaId: string;
  categoriaNombre: string;
  montoGastado: number;
  /** Porcentaje que representa del gasto total del periodo. */
  porcentajeDelTotal: number;
  /** Umbral utilizado para detectar la alerta (por defecto 30). */
  umbral: number;
}

// --- Análisis financiero local ---------------------------------------------

/** Umbral por defecto del detector de gastos hormiga: ₡10 000. */
export const UMBRAL_GASTOS_HORMIGA = 10_000;

/** Fuga de gasto pequeño agrupada por descripción normalizada. */
export interface FugaGastoHormiga {
  /** Clave normalizada usada para agrupar descripciones similares. */
  clave: string;
  /** Descripción original más representativa del grupo. */
  etiqueta: string;
  categoriaId: string;
  categoriaNombre: string;
  cantidad: number;
  /** Suma real en el periodo analizado. */
  totalPeriodo: number;
  /** Promedio por movimiento. */
  promedio: number;
  /** Estimación lineal: totalPeriodo × 12. */
  proyeccionAnual: number;
  /** Porcentaje sobre el total de gastos hormiga del periodo. */
  porcentajeSobreFugas: number;
  /** Verdadero si el grupo tiene 2 o más movimientos. */
  esFrecuente: boolean;
  primeraFecha: string;
  ultimaFecha: string;
}

/** Resultado del detector de gastos hormiga para un periodo. */
export interface AnalisisGastosHormiga {
  /** Periodo analizado en formato AAAA-MM. */
  periodo: string;
  umbralMonto: number;
  /** Gastos confirmados del periodo con monto <= umbral. */
  cantidadGastos: number;
  /** Suma de esos gastos en el periodo. */
  totalMensual: number;
  /** totalMensual × 12. */
  proyeccionAnual: number;
  /** Total de gastos confirmados del periodo, sin importar el monto. */
  totalGastosPeriodo: number;
  /** Porcentaje que representan los gastos hormiga del total del periodo. */
  porcentajeDelGastoTotal: number;
  /** Cantidad de grupos con 2 o más movimientos. */
  cantidadFugasFrecuentes: number;
  /** Ranking por frecuencia y luego por impacto anual. */
  fugas: FugaGastoHormiga[];
}

/** Diagnóstico visual; los valores coinciden con las variantes de Bootstrap. */
export const DiagnosticoSimulacion = {
  Viable: 'success',
  Ajustado: 'warning',
  Inviable: 'danger',
} as const;

export type DiagnosticoSimulacion =
  (typeof DiagnosticoSimulacion)[keyof typeof DiagnosticoSimulacion];

/** Recurrencia activa con su monto traducido a un equivalente mensual. */
export interface RecurrenciaMensualizada {
  id: string;
  categoriaId: string;
  descripcion: string;
  tipo: TipoTransaccion;
  frecuencia: FrecuenciaRecurrencia;
  monto: number;
  montoMensual: number;
}

/** Parámetros del simulador de escenarios. */
export interface ParametrosSimulacion {
  /** Monto de la compra o meta; siempre positivo. */
  montoObjetivo: number;
  /** Número de meses o cuotas; entero >= 1. */
  meses: number;
  /** Categoría de gasto a recortar; opcional. */
  categoriaRecorteId?: string;
  /** Porcentaje de recorte entre 0 y 100; opcional. */
  porcentajeRecorte?: number;
}

/** Datos históricos y recurrentes con los que se calcula la simulación. */
export interface ContextoSimulacion {
  periodoReferencia: string;
  mesesAnalizados: string[];
  /** Promedios reales: incluyen movimientos de recurrencias. */
  ingresosPromedio: number;
  gastosPromedio: number;
  flujoLibrePromedio: number;
  /** Base proyectada: promedio variable + recurrencias activas mensualizadas. */
  ingresosBase: number;
  gastosBase: number;
  flujoLibreActual: number;
  /** Gasto base de la categoría a recortar: variable + recurrencias de esa categoría. */
  gastoCategoriaPromedio: number;
  categoriaRecorteNombre: string | null;
  metaAhorroMensual: number;
  ingresoRecurrenteMensual: number;
  compromisoRecurrenteMensual: number;
  recurrenciasActivas: RecurrenciaMensualizada[];
}

/** Resultado completo del simulador de escenarios. */
export interface ResultadoSimulacion {
  montoObjetivo: number;
  meses: number;
  cuotaMensual: number;
  categoriaRecorteId: string | null;
  categoriaRecorteNombre: string | null;
  porcentajeRecorte: number;

  periodoReferencia: string;
  mesesAnalizados: string[];
  ingresosPromedio: number;
  gastosPromedio: number;
  flujoLibrePromedio: number;
  ingresoRecurrenteMensual: number;
  compromisoRecurrenteMensual: number;
  recurrenciasActivas: RecurrenciaMensualizada[];
  metaAhorroMensual: number;

  gastoCategoriaPromedio: number;
  ahorroMensualRecorte: number;
  ahorroAnualRecorte: number;
  gastoCategoriaProyectada: number;

  ingresosBase: number;
  gastosBase: number;
  gastosProyectados: number;
  flujoLibreActual: number;
  flujoLibreProyectado: number;
  disponibleParaCuota: number;
  diferenciaMensual: number;

  viable: boolean;
  alcanzaCuota: boolean;
  diagnostico: DiagnosticoSimulacion;
  mesesParaObjetivo: number | null;
  fechaEstimada: string | null;
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

/**
 * Movimiento detectado en un CSV bancario, listo para revisión del usuario.
 *
 * No se persiste: es el contrato entre el motor de importación y la interfaz.
 * La selección de qué filas se importan no vive aquí: la maneja la pantalla y
 * solo las filas elegidas llegan a `confirmarImportacionCsv`.
 */
export interface FilaCsvDetectada {
  /** Clave estable para React y para la selección en la tabla. */
  id: string;
  /** Fecha normalizada, formato AAAA-MM-DD. */
  fecha: string;
  descripcion: string;
  /** Siempre positivo; el signo lo aporta `tipo`. */
  monto: number;
  tipo: TipoTransaccion;
  /** Categoría real del usuario sugerida; '' si no hay ninguna del tipo. */
  categoriaIdSugerida: string;
  metodoPagoSugerido: MetodoPago;
  /** Coincide con un movimiento ya existente o con otra fila del archivo. */
  posibleDuplicado: boolean;
  /** Posición de la fila de datos en el archivo (1 = tras la cabecera). */
  numeroFila: number;
  /** Detalle opcional para mostrar junto a la fila (ej. motivo del duplicado). */
  advertencia?: string;
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

/** Cambios admitidos en un presupuesto. */
export interface CambiosPresupuesto {
  montoLimite?: number;
  periodo?: string | null;
  alertaPorcentaje?: number;
  activo?: boolean;
}

/** Datos necesarios para crear un presupuesto nuevo. */
export interface NuevoPresupuesto {
  categoriaId: string;
  montoLimite: number;
  periodo?: string | null;
  alertaPorcentaje?: number;
  activo?: boolean;
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
