import { ErrorValidacion } from './errores';

/** Representación serializable del usuario (la que viaja y se guarda). */
export interface DatosUsuario {
  id: string;
  nombre: string;
  correo: string;
  /** Código ISO 4217 de la moneda principal, por ejemplo "CRC". */
  moneda: string;
  /** Fecha y hora de creación en formato ISO 8601. */
  creadoEn: string;
}

/**
 * Usuario dueño de las finanzas.
 *
 * En esta etapa no hay autenticación: el mock entrega un usuario de
 * demostración. Cuando se integre Supabase Auth, esta clase seguirá siendo
 * el modelo de lectura del perfil.
 */
export class Usuario {
  readonly id: string;
  nombre: string;
  correo: string;
  readonly moneda: string;
  readonly creadoEn: string;

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
    if (!datos.moneda) {
      throw new ErrorValidacion('El usuario requiere una moneda.', 'moneda');
    }

    this.id = datos.id;
    this.nombre = datos.nombre.trim();
    this.correo = datos.correo.trim().toLowerCase();
    this.moneda = datos.moneda.toUpperCase();
    this.creadoEn = datos.creadoEn;
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

  /** Copia serializable, segura para guardar o enviar. */
  toJSON(): DatosUsuario {
    return {
      id: this.id,
      nombre: this.nombre,
      correo: this.correo,
      moneda: this.moneda,
      creadoEn: this.creadoEn,
    };
  }

  /** Reconstruye la entidad a partir de datos persistidos. */
  static desdeJSON(datos: DatosUsuario): Usuario {
    return new Usuario(datos);
  }
}
