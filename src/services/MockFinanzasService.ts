import { CONFIG_MOCK } from '../config/mock';
import {
  crearCategoriasSemilla,
  crearTransaccionesSemilla,
  crearUsuarioSemilla,
} from '../data/seed';
import { Categoria } from '../models/Categoria';
import type { DatosCategoria } from '../models/Categoria';
import { ErrorValidacion } from '../models/errores';
import { Transaccion } from '../models/Transaccion';
import type { DatosTransaccion } from '../models/Transaccion';
import { Usuario } from '../models/Usuario';
import type { DatosUsuario } from '../models/Usuario';
import { esTipoTransaccion, OrdenTransacciones } from '../models/tipos';
import type {
  FiltroTransacciones,
  NuevaCategoria,
  NuevaTransaccion,
  ResumenFinanciero,
  ResumenMensual,
  ResumenPorCategoria,
  TipoTransaccion,
} from '../models/tipos';
import { redondearMonto, sumarMontos } from '../utils/numeros';
import type { FinanzasService } from './FinanzasService';

/** Formato exacto del estado que el mock guarda en `localStorage`. */
interface EstadoPersistido {
  version: number;
  usuario: DatosUsuario;
  categorias: DatosCategoria[];
  transacciones: DatosTransaccion[];
}

/** Normaliza texto para búsquedas sin distinguir mayúsculas ni tildes. */
function normalizarTexto(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Implementación del servicio con datos de demostración.
 *
 * - Mantiene el estado en memoria y lo persiste en `localStorage`.
 * - Si no hay estado guardado (o es de otra versión) carga el seed.
 * - Simula latencia de red para ejercitar estados de carga en la UI.
 * - Devuelve copias de las entidades: el frontend no puede mutar el estado
 *   interno del servicio por accidente.
 *
 * Limitación conocida: no hay autenticación ni concurrencia; los datos son
 * locales al navegador. Eso es intencional en esta etapa.
 */
export class MockFinanzasService implements FinanzasService {
  private usuario: Usuario;
  private categorias: Categoria[];
  private transacciones: Transaccion[];

  constructor() {
    const guardado = this.cargarEstado();

    if (!guardado) {
      this.usuario = crearUsuarioSemilla();
      this.categorias = crearCategoriasSemilla();
      this.transacciones = crearTransaccionesSemilla();
      this.persistir();
      return;
    }

    try {
      this.usuario = Usuario.desdeJSON(guardado.usuario);
      this.categorias = guardado.categorias.map((categoria) =>
        Categoria.desdeJSON(categoria),
      );
      this.transacciones = guardado.transacciones.map((transaccion) =>
        Transaccion.desdeJSON(transaccion),
      );
    } catch {
      // Estado corrupto o incompatible: se descarta y se vuelve al seed.
      this.usuario = crearUsuarioSemilla();
      this.categorias = crearCategoriasSemilla();
      this.transacciones = crearTransaccionesSemilla();
      this.persistir();
    }
  }

  async obtenerUsuario(): Promise<Usuario> {
    await this.simularLatencia();
    return this.clonarUsuario();
  }

  async listarCategorias(tipo?: TipoTransaccion): Promise<Categoria[]> {
    await this.simularLatencia();
    const categorias = tipo
      ? this.categorias.filter((categoria) => categoria.esDelTipo(tipo))
      : this.categorias;

    return categorias.map((categoria) => this.clonarCategoria(categoria));
  }

  async crearCategoria(datos: NuevaCategoria): Promise<Categoria> {
    await this.simularLatencia();

    const nombre = datos.nombre ? datos.nombre.trim() : '';
    if (!nombre) {
      throw new ErrorValidacion('El nombre de la categoría es obligatorio.', 'nombre');
    }
    if (!esTipoTransaccion(datos.tipo)) {
      throw new ErrorValidacion(
        'El tipo de la categoría debe ser "ingreso" o "gasto".',
        'tipo',
      );
    }

    const existe = this.categorias.some(
      (categoria) =>
        categoria.tipo === datos.tipo &&
        normalizarTexto(categoria.nombre) === normalizarTexto(nombre),
    );
    if (existe) {
      throw new ErrorValidacion(
        `Ya existe una categoría de ${datos.tipo} llamada "${nombre}".`,
        'nombre',
      );
    }

    const categoria = Categoria.crear({ ...datos, nombre });
    this.categorias.push(categoria);
    this.persistir();
    return this.clonarCategoria(categoria);
  }

  async listarTransacciones(
    filtro: FiltroTransacciones = {},
  ): Promise<Transaccion[]> {
    await this.simularLatencia();

    const filtradas = this.transacciones.filter((transaccion) =>
      this.cumpleFiltro(transaccion, filtro),
    );

    return this.ordenar(filtradas, filtro.orden).map((transaccion) =>
      this.clonarTransaccion(transaccion),
    );
  }

  async obtenerTransaccion(id: string): Promise<Transaccion | null> {
    await this.simularLatencia();

    const transaccion = this.transacciones.find((item) => item.id === id);
    return transaccion ? this.clonarTransaccion(transaccion) : null;
  }

  async crearTransaccion(datos: NuevaTransaccion): Promise<Transaccion> {
    await this.simularLatencia();

    const categoria = this.buscarCategoria(datos.categoriaId);
    this.validarCompatibilidad(categoria, datos.tipo);

    const transaccion = Transaccion.crear(datos);
    this.transacciones.push(transaccion);
    this.persistir();
    return this.clonarTransaccion(transaccion);
  }

  async actualizarTransaccion(
    id: string,
    cambios: Partial<NuevaTransaccion>,
  ): Promise<Transaccion> {
    await this.simularLatencia();

    const indice = this.transacciones.findIndex((item) => item.id === id);
    if (indice < 0) {
      throw new ErrorValidacion(`No existe una transacción con id "${id}".`, 'id');
    }

    const actual = this.transacciones[indice];
    const categoria = this.buscarCategoria(cambios.categoriaId ?? actual.categoriaId);
    this.validarCompatibilidad(categoria, cambios.tipo ?? actual.tipo);

    actual.actualizar(cambios);
    this.persistir();
    return this.clonarTransaccion(actual);
  }

  async eliminarTransaccion(id: string): Promise<void> {
    await this.simularLatencia();

    const indice = this.transacciones.findIndex((item) => item.id === id);
    if (indice < 0) {
      throw new ErrorValidacion(`No existe una transacción con id "${id}".`, 'id');
    }

    this.transacciones.splice(indice, 1);
    this.persistir();
  }

  async obtenerResumen(
    filtro: FiltroTransacciones = {},
  ): Promise<ResumenFinanciero> {
    await this.simularLatencia();

    const transacciones = this.transacciones.filter((transaccion) =>
      this.cumpleFiltro(transaccion, filtro),
    );
    const ingresos = transacciones.filter((transaccion) => transaccion.esIngreso);
    const gastos = transacciones.filter((transaccion) => !transaccion.esIngreso);

    const totalIngresos = sumarMontos(ingresos.map((item) => item.monto));
    const totalGastos = sumarMontos(gastos.map((item) => item.monto));
    const fechas = transacciones.map((item) => item.fecha).sort();

    return {
      totalIngresos,
      totalGastos,
      balance: redondearMonto(totalIngresos - totalGastos),
      cantidadTransacciones: transacciones.length,
      cantidadIngresos: ingresos.length,
      cantidadGastos: gastos.length,
      promedioIngreso:
        ingresos.length === 0 ? 0 : redondearMonto(totalIngresos / ingresos.length),
      promedioGasto:
        gastos.length === 0 ? 0 : redondearMonto(totalGastos / gastos.length),
      porCategoria: this.agruparPorCategoria(transacciones, totalIngresos, totalGastos),
      porMes: this.agruparPorMes(transacciones),
      rango: {
        desde: fechas.length > 0 ? fechas[0] : null,
        hasta: fechas.length > 0 ? fechas[fechas.length - 1] : null,
      },
    };
  }

  async resetearDatos(): Promise<void> {
    await this.simularLatencia();

    this.usuario = crearUsuarioSemilla();
    this.categorias = crearCategoriasSemilla();
    this.transacciones = crearTransaccionesSemilla();

    this.eliminarEstadoGuardado();
    this.persistir();
  }

  // ---------------------------------------------------------------------------
  // Consultas internas
  // ---------------------------------------------------------------------------

  private cumpleFiltro(
    transaccion: Transaccion,
    filtro: FiltroTransacciones,
  ): boolean {
    if (filtro.desde && transaccion.fecha < filtro.desde) return false;
    if (filtro.hasta && transaccion.fecha > filtro.hasta) return false;
    if (filtro.tipo && transaccion.tipo !== filtro.tipo) return false;
    if (filtro.categoriaId && transaccion.categoriaId !== filtro.categoriaId) {
      return false;
    }
    if (filtro.metodoPago && transaccion.metodoPago !== filtro.metodoPago) {
      return false;
    }
    if (filtro.texto && filtro.texto.trim()) {
      const categoria = this.categorias.find(
        (item) => item.id === transaccion.categoriaId,
      );
      const contenido = normalizarTexto(
        `${transaccion.descripcion} ${categoria ? categoria.nombre : ''}`,
      );
      if (!contenido.includes(normalizarTexto(filtro.texto))) return false;
    }

    return true;
  }

  private ordenar(
    transacciones: Transaccion[],
    orden: OrdenTransacciones = OrdenTransacciones.FechaDesc,
  ): Transaccion[] {
    const copia = [...transacciones];

    switch (orden) {
      case OrdenTransacciones.FechaAsc:
        return copia.sort(
          (a, b) =>
            a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn),
        );
      case OrdenTransacciones.MontoDesc:
        return copia.sort((a, b) => b.monto - a.monto);
      case OrdenTransacciones.MontoAsc:
        return copia.sort((a, b) => a.monto - b.monto);
      case OrdenTransacciones.FechaDesc:
      default:
        return copia.sort(
          (a, b) =>
            b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn),
        );
    }
  }

  private agruparPorCategoria(
    transacciones: Transaccion[],
    totalIngresos: number,
    totalGastos: number,
  ): ResumenPorCategoria[] {
    const acumulados = new Map<
      string,
      { categoria: Categoria; total: number; cantidad: number }
    >();

    for (const transaccion of transacciones) {
      const categoria = this.categorias.find(
        (item) => item.id === transaccion.categoriaId,
      );
      if (!categoria) continue;

      const acumulado = acumulados.get(categoria.id) ?? {
        categoria,
        total: 0,
        cantidad: 0,
      };
      acumulado.total += transaccion.monto;
      acumulado.cantidad += 1;
      acumulados.set(categoria.id, acumulado);
    }

    const resumen: ResumenPorCategoria[] = [];

    for (const acumulado of acumulados.values()) {
      const totalDelTipo =
        acumulado.categoria.tipo === 'ingreso' ? totalIngresos : totalGastos;

      resumen.push({
        categoriaId: acumulado.categoria.id,
        nombre: acumulado.categoria.nombre,
        color: acumulado.categoria.color,
        icono: acumulado.categoria.icono,
        tipo: acumulado.categoria.tipo,
        total: redondearMonto(acumulado.total),
        cantidad: acumulado.cantidad,
        porcentaje:
          totalDelTipo === 0
            ? 0
            : redondearMonto((acumulado.total / totalDelTipo) * 100),
      });
    }

    return resumen.sort((a, b) => b.total - a.total);
  }

  private agruparPorMes(transacciones: Transaccion[]): ResumenMensual[] {
    const acumulados = new Map<string, ResumenMensual>();

    for (const transaccion of transacciones) {
      const actual = acumulados.get(transaccion.periodo) ?? {
        mes: transaccion.periodo,
        ingresos: 0,
        gastos: 0,
        balance: 0,
      };

      if (transaccion.esIngreso) {
        actual.ingresos += transaccion.monto;
      } else {
        actual.gastos += transaccion.monto;
      }
      acumulados.set(transaccion.periodo, actual);
    }

    return [...acumulados.values()]
      .map((mes) => ({
        mes: mes.mes,
        ingresos: redondearMonto(mes.ingresos),
        gastos: redondearMonto(mes.gastos),
        balance: redondearMonto(mes.ingresos - mes.gastos),
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }

  private buscarCategoria(id: string): Categoria {
    const categoria = this.categorias.find((item) => item.id === id);
    if (!categoria) {
      throw new ErrorValidacion(
        `No existe una categoría con id "${id}".`,
        'categoriaId',
      );
    }
    return categoria;
  }

  private validarCompatibilidad(
    categoria: Categoria,
    tipo: TipoTransaccion,
  ): void {
    if (!categoria.esDelTipo(tipo)) {
      throw new ErrorValidacion(
        `La categoría "${categoria.nombre}" es de tipo ${categoria.tipo} y la transacción es de tipo ${tipo}.`,
        'categoriaId',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Persistencia y copias
  // ---------------------------------------------------------------------------

  private obtenerAlmacenamiento(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  private cargarEstado(): EstadoPersistido | null {
    const almacenamiento = this.obtenerAlmacenamiento();
    if (!almacenamiento) return null;

    try {
      const crudo = almacenamiento.getItem(CONFIG_MOCK.claveAlmacenamiento);
      if (!crudo) return null;

      const estado = JSON.parse(crudo) as Partial<EstadoPersistido>;
      const esValido =
        estado.version === CONFIG_MOCK.versionEstado &&
        estado.usuario !== undefined &&
        Array.isArray(estado.categorias) &&
        Array.isArray(estado.transacciones);

      return esValido ? (estado as EstadoPersistido) : null;
    } catch {
      return null;
    }
  }

  private persistir(): void {
    const almacenamiento = this.obtenerAlmacenamiento();
    if (!almacenamiento) return;

    const estado: EstadoPersistido = {
      version: CONFIG_MOCK.versionEstado,
      usuario: this.usuario.toJSON(),
      categorias: this.categorias.map((categoria) => categoria.toJSON()),
      transacciones: this.transacciones.map((transaccion) =>
        transaccion.toJSON(),
      ),
    };

    try {
      almacenamiento.setItem(
        CONFIG_MOCK.claveAlmacenamiento,
        JSON.stringify(estado),
      );
    } catch {
      // Cuota llena o modo privado: el mock sigue funcionando en memoria.
    }
  }

  private eliminarEstadoGuardado(): void {
    const almacenamiento = this.obtenerAlmacenamiento();
    if (!almacenamiento) return;

    try {
      almacenamiento.removeItem(CONFIG_MOCK.claveAlmacenamiento);
    } catch {
      // Sin almacenamiento disponible: nada que limpiar.
    }
  }

  private async simularLatencia(): Promise<void> {
    if (CONFIG_MOCK.latenciaMs <= 0) return;

    await new Promise<void>((resolver) => {
      setTimeout(resolver, CONFIG_MOCK.latenciaMs);
    });
  }

  private clonarUsuario(): Usuario {
    return Usuario.desdeJSON(this.usuario.toJSON());
  }

  private clonarCategoria(categoria: Categoria): Categoria {
    return Categoria.desdeJSON(categoria.toJSON());
  }

  private clonarTransaccion(transaccion: Transaccion): Transaccion {
    return Transaccion.desdeJSON(transaccion.toJSON());
  }
}
