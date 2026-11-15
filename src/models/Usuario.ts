import { ErrorValidacion } from './errores';

/** Representación serializable del usuario (sin credenciales). */
export interface DatosUsuario {
  id: string;
  nombre: string;
  correo: string;
  /** Fecha y hora de creación en formato ISO 8601. */
  creadoEn: string;
  /** Fecha y hora del último inicio de sesión. */
  ultimoAcceso: string;
}

/**
 * Usuario dueño de sus finanzas.
 *
 * Cada usuario tiene su propio espacio: cuentas, categorías, transacciones y
 * transferencias se filtran por su id. Las credenciales (hash y sal) viven en
 * la capa de base de datos y nunca salen del servicio.
 */
export class Usuario {
  readonly id: string;
  nombre: string;
  readonly correo: string;
  readonly creadoEn: string;
  readonly ultimoAcceso: string;

  constructor(datos: DatosUsuario) {
    if (!datos.id) {
      throw new ErrorValidacion('El usuario requiere un identificador.', 'id');
    }
    if (!datos.nombre || !datos.nombre.trim()) {
      throw new ErrorValidacion('El nombre del usuario es obligatorio.', 'nombre');
    }
    if (!datos.correo || !datos.correo.includes('@')) {
      throw new ErrorValidacion('El correo del usuario no es válido.', 'correo');
    }

    this.id = datos.id;
    this.nombre = datos.nombre.trim();
    this.correo = datos.correo.trim().toLowerCase();
    this.creadoEn = datos.creadoEn;
    this.ultimoAcceso = datos.ultimoAcceso;
  }

  /** Iniciales del nombre, útiles para avatares: "Ana Rodríguez" -> "AR". */
  get iniciales(): string {
    return this.nombre
      .split(/\s+/)
      .filter((parte) => parte.length > 0)
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join('');
  }

  toJSON(): DatosUsuario {
    return {
      id: this.id,
      nombre: this.nombre,
      correo: this.correo,
      creadoEn: this.creadoEn,
      ultimoAcceso: this.ultimoAcceso,
    };
  }

  static desdeJSON(datos: DatosUsuario): Usuario {
    return new Usuario(datos);
  }
}
