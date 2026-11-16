/**
 * ConfiguraciÃ³n general de la aplicaciÃ³n.
 *
 * La aplicaciÃ³n es local-first: no depende de internet ni de un servidor.
 * Todo lo ajustable (moneda, base de datos, sesiÃ³n) vive aquÃ­.
 */
export const CONFIG_APP = {
  nombre: 'FinTrack',
  descripcion: 'Gestor de finanzas personales local',
  /** Moneda por defecto (colÃ³n costarricense). */
  moneda: 'CRC',
  /** ConfiguraciÃ³n regional usada por los formateadores. */
  locale: 'es-CR',
  /** Nombre de la base IndexedDB. */
  nombreBaseDatos: 'fintrack',
  /** VersiÃ³n del esquema de Dexie. Subir al cambiar tablas o Ã­ndices. */
  versionBaseDatos: 3,
  /** Clave de sesiÃ³n en sessionStorage. */
  claveSesion: 'fintrack:sesion:v1',
  /** Longitud mÃ­nima de contraseÃ±a. */
  longitudMinimaContrasena: 8,
  /** Longitud del cÃ³digo de recuperaciÃ³n (sin contar guiones). */
  longitudCodigoRecuperacion: 12,
  /** Iteraciones de PBKDF2-SHA256 (recomendaciÃ³n OWASP). */
  iteracionesHash: 210_000,
  /** Intentos fallidos antes de empezar a frenar la respuesta. */
  intentosAntesDeEspera: 3,
  /** Espera mÃ¡xima por intento fallido, en milisegundos. */
  esperaMaximaMs: 8_000,
} as const;
