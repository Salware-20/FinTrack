import { MockFinanzasService } from './MockFinanzasService';
import type { FinanzasService } from './FinanzasService';

/**
 * Punto único de acceso a los datos para el frontend.
 *
 *   import { finanzasService } from '../services';
 *
 * Es un singleton: toda la aplicación comparte el mismo estado en memoria y
 * la misma persistencia en `localStorage`. Cuando se integre Supabase, solo
 * cambia la implementación asignada aquí; los componentes no se tocan.
 */
export const finanzasService: FinanzasService = new MockFinanzasService();

export { MockFinanzasService };
export type { FinanzasService } from './FinanzasService';
