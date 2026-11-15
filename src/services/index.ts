import { LocalFinanzasService } from './LocalFinanzasService';
import type { FinanzasService } from './FinanzasService';

/**
 * Punto único de acceso a los datos para la interfaz.
 *
 *   import { finanzasService } from '../services';
 *
 * Es un singleton sobre IndexedDB: toda la aplicación comparte la misma base
 * local. La interfaz nunca debe importar `LocalFinanzasService` directamente.
 */
export const finanzasService: FinanzasService = new LocalFinanzasService();

export { LocalFinanzasService };
export type { FinanzasService, RespaldoFinanzas } from './FinanzasService';
