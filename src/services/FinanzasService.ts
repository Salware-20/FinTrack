import type { Categoria, DatosCategoria } from '../models/Categoria';
import type { DatosPresupuesto, Presupuesto } from '../models/Presupuesto';
import type { Cuenta, DatosCuenta } from '../models/Cuenta';
import type { DatosRecurrencia, Recurrencia } from '../models/Recurrencia';
import type { DatosTransaccion, Transaccion } from '../models/Transaccion';
import type { DatosTransferencia, Transferencia } from '../models/Transferencia';
import type { DatosUsuario, Usuario } from '../models/Usuario';
import type {
  AlertaConcentracionGasto,
  AnalisisGastosHormiga,
  CambiosPresupuesto,
  CambiosRecurrencia,
  ConfiguracionUsuario,
  EstadoPresupuesto,
  EstadoResultados,
  FilaCsvDetectada,
  FiltroTransacciones,
  NuevaCategoria,
  NuevaCuenta,
  NuevaRecurrencia,
  NuevoPresupuesto,
  NuevaTransaccion,
  NuevaTransferencia,
  NuevoUsuario,
  ParametrosSimulacion,
  ResumenFinanciero,
  ResumenMensual,
  ResultadoCreacionRecurrencia,
  ResultadoRecuperacion,
  ResultadoRegistro,
  ResultadoSimulacion,
  SaldoCuenta,
  TipoTransaccion,
} from '../models/tipos';

/** Contenido de un respaldo local (JSON descargable). */
export interface RespaldoFinanzas {
  version: number;
  exportadoEn: string;
  usuario: DatosUsuario;
  cuentas: DatosCuenta[];
  categorias: DatosCategoria[];
  transacciones: DatosTransaccion[];
  transferencias: DatosTransferencia[];
  recurrencias: DatosRecurrencia[];
  presupuestos: DatosPresupuesto[];
  configuracion: ConfiguracionUsuario;
}

/**
 * Contrato único de acceso a los datos financieros.
 *
 * La interfaz no recibe `usuarioId`: el servicio lo toma de la sesión activa.
 * Eso garantiza que ninguna pantalla pueda consultar datos de otro usuario.
 *
 * Todos los métodos son asíncronos (aunque la base sea local) para que la UI
 * maneje estados de carga de forma uniforme.
 *
 * Los errores de negocio se lanzan como `ErrorValidacion`.
 */
export interface FinanzasService {
  // --- Sesión y cuenta ------------------------------------------------------
  /** Registra un usuario nuevo y devuelve el código de recuperación (una vez). */
  registrar(datos: NuevoUsuario): Promise<ResultadoRegistro>;
  iniciarSesion(correo: string, contrasena: string): Promise<Usuario>;
  cerrarSesion(): Promise<void>;
  /** Usuario de la sesión activa, o `null` si no hay sesión. */
  usuarioActual(): Promise<Usuario | null>;
  cambiarContrasena(actual: string, nueva: string): Promise<void>;
  /** Cambia la contraseña con el código de recuperación. Rota el código. */
  recuperarContrasena(
    correo: string,
    codigo: string,
    nueva: string,
  ): Promise<ResultadoRecuperacion>;
  /** Elimina la cuenta y todos sus datos. Requiere la contraseña. */
  eliminarCuenta(contrasena: string): Promise<void>;
  obtenerConfiguracion(): Promise<ConfiguracionUsuario>;
  actualizarConfiguracion(cambios: Partial<ConfiguracionUsuario>): Promise<ConfiguracionUsuario>;

  // --- Cuentas --------------------------------------------------------------
  listarCuentas(): Promise<Cuenta[]>;
  crearCuenta(datos: NuevaCuenta): Promise<Cuenta>;
  actualizarCuenta(
    id: string,
    cambios: Partial<NuevaCuenta> & { activa?: boolean },
  ): Promise<Cuenta>;
  /** Mueve dinero entre dos cuentas del usuario. */
  transferir(datos: NuevaTransferencia): Promise<Transferencia>;
  /** Saldo calculado de cada cuenta (solo movimientos confirmados). */
  obtenerSaldos(): Promise<SaldoCuenta[]>;

  // --- Categorías -----------------------------------------------------------
  listarCategorias(tipo?: TipoTransaccion): Promise<Categoria[]>;
  /** Crea una categoría; el nombre es único entre hermanas del mismo tipo. */
  crearCategoria(datos: NuevaCategoria): Promise<Categoria>;

  // --- Transacciones --------------------------------------------------------
  listarTransacciones(filtro?: FiltroTransacciones): Promise<Transaccion[]>;
  obtenerTransaccion(id: string): Promise<Transaccion | null>;
  crearTransaccion(datos: NuevaTransaccion): Promise<Transaccion>;
  actualizarTransaccion(
    id: string,
    cambios: Partial<NuevaTransaccion>,
  ): Promise<Transaccion>;
  eliminarTransaccion(id: string): Promise<void>;

  // --- Importación de estados de cuenta -------------------------------------
  /**
   * Analiza un CSV bancario y devuelve los movimientos detectados sin guardar
   * nada. La cuenta debe existir y pertenecer al usuario de la sesión.
   */
  previsualizarCsv(
    contenidoCsv: string,
    cuentaId: string,
  ): Promise<FilaCsvDetectada[]>;
  /**
   * Inserta de forma atómica los movimientos revisados y devuelve cuántos se
   * guardaron. Si una sola fila es inválida se rechaza la operación completa.
   */
  confirmarImportacionCsv(
    cuentaId: string,
    filas: FilaCsvDetectada[],
  ): Promise<number>;

  // --- Recurrencias ---------------------------------------------------------
  listarRecurrencias(): Promise<Recurrencia[]>;
  /** Crea la regla y genera las ocurrencias cuya fecha ya llegó. */
  crearRecurrencia(datos: NuevaRecurrencia): Promise<ResultadoCreacionRecurrencia>;
  actualizarRecurrencia(
    id: string,
    cambios: CambiosRecurrencia,
  ): Promise<Recurrencia>;
  /** Elimina la regla; las transacciones ya generadas se conservan. */
  eliminarRecurrencia(id: string): Promise<void>;
  /** Genera las ocurrencias vencidas de todas las reglas activas del usuario. */
  procesarRecurrencias(): Promise<number>;

  // --- Presupuestos ----------------------------------------------------------
  listarPresupuestos(): Promise<Presupuesto[]>;
  crearPresupuesto(datos: NuevoPresupuesto): Promise<Presupuesto>;
  actualizarPresupuesto(id: string, cambios: CambiosPresupuesto): Promise<Presupuesto>;
  eliminarPresupuesto(id: string): Promise<void>;
  /**
   * Estado de consumo de cada presupuesto activo para el periodo indicado.
   * Incluye subcategorias: un limite en Alimentacion acumula Supermercado, etc.
   * Si no se pasa periodo se usa el mes actual.
   */
  obtenerEstadoPresupuestos(periodo?: string): Promise<EstadoPresupuesto[]>;
  /**
   * Categorias cuyo gasto supera el umbral del total del periodo (por defecto 30 %).
   * Ordenadas de mayor a menor porcentaje.
   */
  obtenerAlertasConcentracion(periodo?: string, umbral?: number): Promise<AlertaConcentracionGasto[]>;

  // --- Reportes -------------------------------------------------------------
  obtenerResumen(filtro?: FiltroTransacciones): Promise<ResumenFinanciero>;
  obtenerEstadoResultados(desde: string, hasta: string): Promise<EstadoResultados>;
  obtenerFlujoCaja(desde: string, hasta: string): Promise<ResumenMensual[]>;

  // --- Datos ----------------------------------------------------------------
  exportarRespaldo(): Promise<RespaldoFinanzas>;
  /** Reemplaza los datos del usuario actual con el contenido del respaldo. */
  importarRespaldo(respaldo: RespaldoFinanzas): Promise<void>;
  /** Transacciones del usuario en formato CSV (separador coma). */
  exportarTransaccionesCsv(filtro?: FiltroTransacciones): Promise<string>;
  /** Borra los movimientos del usuario y restaura categorías y cuenta base. */
  resetearDatos(): Promise<void>;

  // --- Análisis financiero local --------------------------------------------

  /**
   * Gastos confirmados del periodo que no superan el umbral, agrupados por
   * comercio/descripción normalizada, con impacto mensual y proyección anual.
   * Si no se indica periodo se usa el mes actual.
   * Umbral por defecto: ₡10 000.
   */
  analizarGastosHormiga(
    periodo?: string,
    umbralMonto?: number,
  ): Promise<AnalisisGastosHormiga>;

  /**
   * Simula una compra/meta y un recorte opcional de categoría usando el flujo
   * de caja promedio de los últimos meses con datos, las recurrencias activas
   * y la meta de ahorro mensual configurada.
   */
  simularEscenario(params: ParametrosSimulacion): Promise<ResultadoSimulacion>;
}
