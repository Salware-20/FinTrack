import { ErrorValidacion } from '../models/errores';

/**
 * Normalización de errores para la interfaz.
 *
 * La capa de datos lanza `ErrorValidacion` con un `campo` opcional. La UI no
 * debe mostrar mensajes técnicos de IndexedDB/Dexie, así que este módulo
 * convierte cualquier fallo en un mensaje en español listo para toast o para
 * validación inline.
 */

export type TipoError = 'validacion' | 'sesion' | 'almacenamiento' | 'desconocido';

export interface ErrorNormalizado {
  /** Mensaje apto para mostrar al usuario. */
  mensaje: string;
  /** Campo del formulario relacionado, si el error lo identifica. */
  campo?: string;
  tipo: TipoError;
}

const MENSAJE_GENERICO = 'No se pudo completar la operación. Intente de nuevo.';
const MENSAJE_ALMACENAMIENTO =
  'No hay espacio disponible en este navegador. Exporte un respaldo y libere espacio antes de continuar.';

function esErrorDeCuota(fallo: unknown): boolean {
  if (typeof DOMException !== 'undefined' && fallo instanceof DOMException) {
    return (
      fallo.name === 'QuotaExceededError' ||
      fallo.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }

  if (fallo instanceof Error) {
    return fallo.name === 'QuotaExceededError' || /quota/i.test(fallo.message);
  }

  return false;
}

/** Convierte cualquier fallo en un mensaje, un campo y una categoría. */
export function normalizarError(fallo: unknown): ErrorNormalizado {
  if (fallo instanceof ErrorValidacion) {
    return {
      mensaje: fallo.message,
      campo: fallo.campo,
      tipo: fallo.campo === 'sesion' ? 'sesion' : 'validacion',
    };
  }

  if (esErrorDeCuota(fallo)) {
    return { mensaje: MENSAJE_ALMACENAMIENTO, tipo: 'almacenamiento' };
  }

  return { mensaje: MENSAJE_GENERICO, tipo: 'desconocido' };
}

/** Verdadero si el fallo indica que la sesión ya no es válida. */
export function esErrorDeSesion(fallo: unknown): boolean {
  return normalizarError(fallo).tipo === 'sesion';
}

/** Atajo para los casos en los que solo se necesita el mensaje. */
export function mensajeDeError(fallo: unknown): string {
  return normalizarError(fallo).mensaje;
}
