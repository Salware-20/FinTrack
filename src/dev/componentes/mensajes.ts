/** Utilidades de presentación de errores compartidas por las pantallas. */

/** Extrae un mensaje legible de cualquier error. */
export function mensajeDeError(fallo: unknown): string {
  if (fallo instanceof Error && fallo.message) return fallo.message;
  return 'Ocurrió un error inesperado.';
}
