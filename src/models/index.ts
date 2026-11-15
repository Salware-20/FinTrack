/**
 * Punto único de importación del dominio.
 *
 *   import type { Transaccion } from '../models';
 *   import { TipoTransaccion } from '../models';
 */
export { Categoria } from './Categoria';
export type { DatosCategoria } from './Categoria';
export { Cuenta } from './Cuenta';
export type { DatosCuenta } from './Cuenta';
export { ErrorValidacion } from './errores';
export { Transaccion } from './Transaccion';
export type { DatosTransaccion } from './Transaccion';
export { Transferencia } from './Transferencia';
export type { DatosTransferencia } from './Transferencia';
export { Usuario } from './Usuario';
export type { DatosUsuario } from './Usuario';
export * from './tipos';
