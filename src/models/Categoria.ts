import { ErrorValidacion } from './errores';
import { esTipoTransaccion } from './tipos';
import type { NuevaCategoria, TipoTransaccion } from './tipos';

const COLOR_POR_DEFECTO = '#0d6efd';
const ICONO_POR_DEFECTO = '🏷️';

/** Representación serializable de una categoría. */
export interface DatosCategoria {
  id: string;
  nombre: string;
  tipo: TipoTransaccion;
  /** Color hexadecimal usado en gráficos y etiquetas. */
  color: string;
  /** Emoji o texto corto que identifica la categoría. */
  icono: string;
}

/**
 * Categoría que clasifica ingresos o gastos.
 *
 * El tipo de la categoría es fijo: no se puede convertir una categoría de
 * gasto en una de ingreso, porque eso rompería el histórico de transacciones.
 */
export class Categoria {
  readonly id: string;
  nombre: string;
  readonly tipo: TipoTransaccion;
  color: string;
  icono: string;

  constructor(datos: DatosCategoria) {
    if (!datos.id) {
      throw new ErrorValidacion('La categoría requiere un identificador.', 'id');
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

    this.id = datos.id;
    this.nombre = datos.nombre.trim();
    this.tipo = datos.tipo;
    this.color = datos.color || COLOR_POR_DEFECTO;
    this.icono = datos.icono || ICONO_POR_DEFECTO;
  }

  /** Indica si la categoría puede usarse con el tipo de transacción indicado. */
  esDelTipo(tipo: TipoTransaccion): boolean {
    return this.tipo === tipo;
  }

  toJSON(): DatosCategoria {
    return {
      id: this.id,
      nombre: this.nombre,
      tipo: this.tipo,
      color: this.color,
      icono: this.icono,
    };
  }

  /** Crea una categoría nueva generando su identificador. */
  static crear(datos: NuevaCategoria): Categoria {
    return new Categoria({
      id: `cat-${crypto.randomUUID()}`,
      nombre: datos.nombre,
      tipo: datos.tipo,
      color: datos.color ?? COLOR_POR_DEFECTO,
      icono: datos.icono ?? ICONO_POR_DEFECTO,
    });
  }

  static desdeJSON(datos: DatosCategoria): Categoria {
    return new Categoria(datos);
  }
}
