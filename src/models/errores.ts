/**
 * Errores de dominio compartidos por modelos y servicios.
 *
 * El frontend puede usar `instanceof ErrorValidacion` para distinguir un
 * problema de datos (mostrar el mensaje al usuario) de un fallo técnico.
 */
export class ErrorValidacion extends Error {
  /** Campo del formulario relacionado con el error, si aplica. */
  readonly campo: string | undefined;

  constructor(mensaje: string, campo?: string) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.campo = campo;
  }
}
