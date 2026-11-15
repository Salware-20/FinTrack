/**
 * Configuración de la capa de datos simulada (mock).
 *
 * Todo lo que se puede ajustar sin tocar la lógica vive aquí: la clave de
 * `localStorage`, la versión del estado guardado y la latencia artificial.
 */
export const CONFIG_MOCK = {
  /** Clave donde el mock persiste su estado en el navegador. */
  claveAlmacenamiento: 'fintrack:mock:v1',
  /**
   * Versión del formato guardado. Si cambia la estructura de datos, se sube
   * este número y el mock descarta el estado viejo para volver al seed.
   */
  versionEstado: 1,
  /** Latencia simulada en milisegundos (0 la desactiva). */
  latenciaMs: 150,
  /** Moneda por defecto de la aplicación (colón costarricense). */
  moneda: 'CRC',
  /** Configuración regional usada por los formateadores. */
  locale: 'es-CR',
} as const;
