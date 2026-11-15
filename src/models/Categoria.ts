import { ErrorValidacion } from './errores';
import { esTipoTransaccion } from './tipos';
import type { NuevaCategoria, TipoTransaccion } from './tipos';

const COLOR_POR_DEFECTO = '#0d6efd';
const ICONO_POR_DEFECTO = '🏷️';

/** Representación serializable de una categoría. */
export interface DatosCategoria {
  id: string;
  usuarioId: string;
  nombre: string;
  tipo: TipoTransaccion;
  /** Categoría padre para subcategorías; null si es raíz. */
  padreId: string | null;
  /** Color hexadecimal usado en gráficos y etiquetas. */
  color: string;
  /** Emoji o texto corto que identifica la categoría. */
  icono: string;
}

/**
 * Categoría que clasifica ingresos o gastos.
 *
 * El tipo es fijo: no se puede convertir una categoría de gasto en una de
 * ingreso, porque rompería el histórico. Las subcategorías heredan el tipo
 * de su padre (lo valida el servicio).
 */
export class Categoria {
  readonly id: string;
  readonly usuarioId: string;
  nombre: string;
  readonly tipo: TipoTransaccion;
  readonly padreId: string | null;
  color: string;
  icono: string;

  constructor(datos: DatosCategoria) {
    if (!datos.id) {
      throw new ErrorValidacion('La categoría requiere un identificador.', 'id');
    }
    if (!datos.usuarioId) {
      throw new ErrorValidacion('La categoría requiere un usuario.', 'usuarioId');
    }
    if (!datos.nombre || !datos.nombre.trim()) {
      throw new ErrorValidacion('El nombre de la categoría es obligatorio.', 'nombre');
    }
    if (!esTipoTransaccion(datos.tipo)) {
      throw new ErrorValidacion(
        'El tipo de la categoría debe ser "ingreso" o "gasto".',
        'tipo',
      );
    }
    if (datos.padreId && datos.padreId === datos.id) {
      throw new ErrorValidacion(
        'Una categoría no puede ser su propia categoría padre.',
        'padreId',
      );
    }

    this.id = datos.id;
    this.usuarioId = datos.usuarioId;
    this.nombre = datos.nombre.trim();
    this.tipo = datos.tipo;
    this.padreId = datos.padreId ?? null;
    this.color = datos.color || COLOR_POR_DEFECTO;
    this.icono = datos.icono || ICONO_POR_DEFECTO;
  }

  /** Indica si la categoría puede usarse con el tipo de transacción indicado. */
  esDelTipo(tipo: TipoTransaccion): boolean {
    return this.tipo === tipo;
  }

  /** Nombre completo con el padre: "Servicios › Luz". */
  nombreCompleto(padres: Categoria[] = []): string {
    if (!this.padreId) return this.nombre;
    const padre = padres.find((categoria) => categoria.id === this.padreId);
    return padre ? `${padre.nombre} › ${this.nombre}` : this.nombre;
  }

  toJSON(): DatosCategoria {
    return {
      id: this.id,
      usuarioId: this.usuarioId,
      nombre: this.nombre,
      tipo: this.tipo,
      padreId: this.padreId,
      color: this.color,
      icono: this.icono,
    };
  }

  /** Crea una categoría nueva para el usuario indicado. */
  static crear(datos: NuevaCategoria, usuarioId: string): Categoria {
    return new Categoria({
      id: `cat-${crypto.randomUUID()}`,
      usuarioId,
      nombre: datos.nombre,
      tipo: datos.tipo,
      padreId: datos.padreId ?? null,
      color: datos.color ?? COLOR_POR_DEFECTO,
      icono: datos.icono ?? ICONO_POR_DEFECTO,
    });
  }

  static desdeJSON(datos: DatosCategoria): Categoria {
    return new Categoria(datos);
  }
}
