import type { Categoria, DatosCategoria } from '../models/Categoria';
import type { DatosPresupuesto, Presupuesto } from '../models/Presupuesto';
import type { Cuenta, DatosCuenta } from '../models/Cuenta';
import type { DatosRecurrencia, Recurrencia } from '../models/Recurrencia';
import type { DatosTransaccion, Transaccion } from '../models/Transaccion';
import type { DatosTransferencia, Transferencia } from '../models/Transferencia';
import type { DatosUsuario, Usuario } from '../models/Usuario';
import type {
  AlertaConcentracionGasto,
  CambiosPresupuesto,
  CambiosRecurrencia,
  ConfiguracionUsuario,
  EstadoPresupuesto,
  EstadoResultados,
  FiltroTransacciones,
  NuevaCategoria,
  NuevaCuenta,
  NuevaRecurrencia,
  NuevoPresupuesto,
  NuevaTransaccion,
  NuevaTransferencia,
  NuevoUsuario,
  ResumenFinanciero,
  ResumenMensual,
  ResultadoCreacionRecurrencia,
  ResultadoRecuperacion,
  ResultadoRegistro,
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
 * Contrato Ãºnico de acceso a los datos financieros.
 *
 * La interfaz no recibe `usuarioId`: el servicio lo toma de la sesiÃ³n activa.
 * Eso garantiza que ninguna pantalla pueda consultar datos de otro usuario.
 *
 * Todos los mÃ©todos son asÃ­ncronos (aunque la base sea local) para que la UI
 * maneje estados de carga de forma uniforme.
 *
 * Los errores de negocio se lanzan como `ErrorValidacion`.
 */
export interface FinanzasService {
  // --- SesiÃ³n y cuenta ------------------------------------------------------
  /** Registra un usuario nuevo y devuelve el cÃ³digo de recuperaciÃ³n (una vez). */
  registrar(datos: NuevoUsuario): Promise<ResultadoRegistro>;
  iniciarSesion(correo: string, contrasena: string): Promise<Usuario>;
  cerrarSesion(): Promise<void>;
  /** Usuario de la sesiÃ³n activa, o `null` si no hay sesiÃ³n. */
  usuarioActual(): Promise<Usuario | null>;
  cambiarContrasena(actual: string, nueva: string): Promise<void>;
  /** Cambia la contraseÃ±a con el cÃ³digo de recuperaciÃ³n. Rota el cÃ³digo. */
  recuperarContrasena(
    correo: string,
    codigo: string,
    nueva: string,
  ): Promise<ResultadoRecuperacion>;
  /** Elimina la cuenta y todos sus datos. Requiere la contraseÃ±a. */
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

  // --- CategorÃ­as -----------------------------------------------------------
  listarCategorias(tipo?: TipoTransaccion): Promise<Categoria[]>;
  /** Crea una categorÃ­a; el nombre es Ãºnico entre hermanas del mismo tipo. */
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

  // --- Recurrencias ---------------------------------------------------------
  listarRecurrencias(): Promise<Recurrencia[]>;
  /** Crea la regla y genera las ocurrencias cuya fecha ya llegÃ³. */
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
  /** Borra los movimientos del usuario y restaura categorÃ­as y cuenta base. */
  resetearDatos(): Promise<void>;
}
