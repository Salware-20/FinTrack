/**
 * Punto único de importación del dominio.
 *
 *   import type { Transaccion } from '../models';
 *   import { TipoTransaccion } from '../models';
 */
export { Categoria } from './Categoria';
export type { DatosCategoria } from './Categoria';
export { ErrorValidacion } from './errores';
export { Transaccion } from './Transaccion';
export type { DatosTransaccion } from './Transaccion';
export { Usuario } from './Usuario';
export type { DatosUsuario } from './Usuario';
export * from './tipos';
