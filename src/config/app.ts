/**
 * Configuración general de la aplicación.
 *
 * La aplicación es local-first: no depende de internet ni de un servidor.
 * Todo lo ajustable (moneda, base de datos, sesión) vive aquí.
 */
export const CONFIG_APP = {
  nombre: 'FinTrack',
  descripcion: 'Gestor de finanzas personales local',
  /** Moneda por defecto (colón costarricense). */
  moneda: 'CRC',
  /** Configuración regional usada por los formateadores. */
  locale: 'es-CR',
  /** Nombre de la base IndexedDB. */
  nombreBaseDatos: 'fintrack',
  /** Versión del esquema de Dexie. Subir al cambiar tablas o índices. */
  versionBaseDatos: 1,
  /** Clave de sesión en sessionStorage. */
  claveSesion: 'fintrack:sesion:v1',
  /** Longitud mínima de contraseña. */
  longitudMinimaContrasena: 8,
  /** Longitud del código de recuperación (sin contar guiones). */
  longitudCodigoRecuperacion: 12,
  /** Iteraciones de PBKDF2-SHA256 (recomendación OWASP). */
  iteracionesHash: 210_000,
  /** Intentos fallidos antes de empezar a frenar la respuesta. */
  intentosAntesDeEspera: 3,
  /** Espera máxima por intento fallido, en milisegundos. */
  esperaMaximaMs: 8_000,
} as const;
