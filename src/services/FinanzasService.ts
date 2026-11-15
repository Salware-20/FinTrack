import type { Categoria } from '../models/Categoria';
import type { Transaccion } from '../models/Transaccion';
import type { Usuario } from '../models/Usuario';
import type {
  FiltroTransacciones,
  NuevaCategoria,
  NuevaTransaccion,
  ResumenFinanciero,
  TipoTransaccion,
} from '../models/tipos';

/**
 * Contrato único de acceso a los datos financieros.
 *
 * El frontend depende SOLO de esta interfaz, nunca de una implementación
 * concreta. Hoy la implementa `MockFinanzasService` (localStorage) y en el
 * futuro la implementará un `SupabaseFinanzasService`, sin cambios en la UI.
 *
 * Todos los métodos son asíncronos a propósito: imitan el comportamiento de
 * una API real (latencia, errores, promesas) para que el cambio a Supabase
 * sea transparente.
 *
 * Los errores de negocio se lanzan como `ErrorValidacion`.
 */
export interface FinanzasService {
  /** Perfil del usuario actual (por ahora, el usuario de demostración). */
  obtenerUsuario(): Promise<Usuario>;

  /** Categorías disponibles, opcionalmente filtradas por tipo. */
  listarCategorias(tipo?: TipoTransaccion): Promise<Categoria[]>;

  /** Crea una categoría. El nombre debe ser único dentro de su tipo. */
  crearCategoria(datos: NuevaCategoria): Promise<Categoria>;

  /**
   * Transacciones que cumplen el filtro, ya ordenadas.
   * Sin filtro devuelve todas, de la fecha más reciente a la más antigua.
   */
  listarTransacciones(filtro?: FiltroTransacciones): Promise<Transaccion[]>;

  /** Devuelve la transacción indicada o `null` si no existe. */
  obtenerTransaccion(id: string): Promise<Transaccion | null>;

  /**
   * Registra una transacción.
   * La categoría debe existir y su tipo debe coincidir con el de la transacción.
   */
  crearTransaccion(datos: NuevaTransaccion): Promise<Transaccion>;

  /** Actualiza parcialmente una transacción existente. */
  actualizarTransaccion(
    id: string,
    cambios: Partial<NuevaTransaccion>,
  ): Promise<Transaccion>;

  /** Elimina una transacción. Lanza error si el id no existe. */
  eliminarTransaccion(id: string): Promise<void>;

  /**
   * Totales, balance, desglose por categoría y evolución mensual.
   * Acepta los mismos filtros que `listarTransacciones`.
   */
  obtenerResumen(filtro?: FiltroTransacciones): Promise<ResumenFinanciero>;

  /** Restaura los datos de demostración y descarta los cambios locales. */
  resetearDatos(): Promise<void>;
}
