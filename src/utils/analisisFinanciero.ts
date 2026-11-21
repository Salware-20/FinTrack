/**
 * Análisis financiero derivado, sin efectos secundarios.
 *
 * Este módulo no conoce IndexedDB, la sesión ni React: recibe datos planos y
 * devuelve resultados calculados. El servicio se encarga de reunir los datos y
 * de validar las reglas de negocio; así la lógica numérica se puede probar de
 * forma aislada y determinista.
 */

import type {
  AnalisisGastosHormiga,
  ContextoSimulacion,
  FrecuenciaRecurrencia,
  FugaGastoHormiga,
  ParametrosSimulacion,
  ResultadoSimulacion,
} from '../models/tipos';
import { DiagnosticoSimulacion, UMBRAL_GASTOS_HORMIGA } from '../models/tipos';
import { redondearMonto } from './numeros';

/** Gasto mínimo que necesita el detector para agrupar por comercio. */
export interface GastoHormigaEntrada {
  monto: number;
  /** Fecha del movimiento, formato AAAA-MM-DD. */
  fecha: string;
  descripcion: string;
  categoriaId: string;
  categoriaNombre: string;
}

/** Opciones del detector de gastos hormiga. */
export interface OpcionesGastosHormiga {
  /** Periodo analizado en formato AAAA-MM. */
  periodo: string;
  /** Monto máximo (inclusive) para considerar un gasto "hormiga". */
  umbralMonto?: number;
}

/**
 * Palabras que aportan poco a la identidad de un comercio: ruido bancario,
 * artículos y conectores. La clave usa las dos primeras palabras restantes.
 */
const PALABRAS_SIN_VALOR = new Set([
  // Ruido bancario
  'pos',
  'compra',
  'compras',
  'pago',
  'pagos',
  'tarjeta',
  'debito',
  'credito',
  'sinpe',
  'transferencia',
  'transf',
  'sucursal',
  'cuenta',
  'cargo',
  'abono',
  'autorizacion',
  'aplicacion',
  'app',
  'ref',
  'referencia',
  'no',
  // Artículos y conectores
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'del',
  'al',
  'a',
  'en',
  'y',
  'e',
  'o',
  'u',
  'por',
  'para',
  'con',
  'sin',
  'the',
]);

/** Minúsculas, sin tildes, puntuación como espacio y espacios colapsados. */
export function normalizarDescripcionComercio(descripcion: string): string {
  return (descripcion ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/**
 * Clave de agrupación de un comercio/descripción.
 *
 * Se descartan el ruido bancario, los artículos y los tokens numéricos; luego
 * se toman las dos primeras palabras significativas. Ejemplos:
 * `CAFETERÍA ÑANDÚ`, `Cafeteria Nandu` y `COMPRA POS CAFETERIA NANDU 123`
 * producen `cafeteria nandu`.
 */
export function claveComercio(descripcion: string): string {
  const palabras = normalizarDescripcionComercio(descripcion)
    .split(' ')
    .filter(
      (palabra) =>
        Boolean(palabra) &&
        !PALABRAS_SIN_VALOR.has(palabra) &&
        !/^\d+$/.test(palabra),
    );

  return palabras.slice(0, 2).join(' ') || 'sin-descripcion';
}

interface GrupoGasto {
  clave: string;
  total: number;
  cantidad: number;
  primeraFecha: string;
  ultimaFecha: string;
  descripciones: Map<string, number>;
  categorias: Map<string, { nombre: string; cantidad: number }>;
}

/** Descripción más frecuente; empate por longitud y orden alfabético. */
function elegirEtiqueta(descripciones: Map<string, number>): string {
  let elegida = '';
  let maximo = -1;

  for (const [texto, cantidad] of descripciones) {
    const ganaPorConteo = cantidad > maximo;
    const empataYEsMejor =
      cantidad === maximo &&
      (texto.length < elegida.length ||
        (texto.length === elegida.length &&
          texto.localeCompare(elegida, 'es') < 0));

    if (ganaPorConteo || empataYEsMejor) {
      elegida = texto;
      maximo = cantidad;
    }
  }

  return elegida;
}

/** Categoría más frecuente del grupo; empate alfabético. */
function elegirCategoria(
  categorias: Map<string, { nombre: string; cantidad: number }>,
): { id: string; nombre: string } {
  let idElegido = '';
  let nombreElegido = 'Sin categoría';
  let maximo = -1;

  for (const [id, categoria] of categorias) {
    const ganaPorConteo = categoria.cantidad > maximo;
    const empataYEsMejor =
      categoria.cantidad === maximo &&
      categoria.nombre.localeCompare(nombreElegido, 'es') < 0;

    if (ganaPorConteo || empataYEsMejor) {
      idElegido = id;
      nombreElegido = categoria.nombre;
      maximo = categoria.cantidad;
    }
  }

  return { id: idElegido, nombre: nombreElegido };
}

/**
 * Detecta y agrupa los gastos pequeños del periodo.
 *
 * Solo se consideran los gastos recibidos (el servicio ya filtró por usuario,
 * tipo y estado) cuya fecha pertenece al periodo y cuyo monto no supera el
 * umbral. El total mensual incluye todos esos gastos, aunque la interfaz luego
 * decida mostrar solo los grupos repetitivos.
 */
export function detectarGastosHormiga(
  gastos: readonly GastoHormigaEntrada[],
  opciones: OpcionesGastosHormiga,
): AnalisisGastosHormiga {
  const periodo = opciones.periodo;
  const umbralMonto = opciones.umbralMonto ?? UMBRAL_GASTOS_HORMIGA;
  const delPeriodo = gastos.filter((gasto) => gasto.fecha.slice(0, 7) === periodo);

  const totalGastosPeriodo = redondearMonto(
    delPeriodo.reduce((total, gasto) => total + gasto.monto, 0),
  );

  const bajoUmbral = delPeriodo.filter((gasto) => gasto.monto <= umbralMonto);
  const totalMensual = redondearMonto(
    bajoUmbral.reduce((total, gasto) => total + gasto.monto, 0),
  );

  const grupos = new Map<string, GrupoGasto>();

  for (const gasto of bajoUmbral) {
    const clave = claveComercio(gasto.descripcion);
    const grupo = grupos.get(clave) ?? {
      clave,
      total: 0,
      cantidad: 0,
      primeraFecha: gasto.fecha,
      ultimaFecha: gasto.fecha,
      descripciones: new Map<string, number>(),
      categorias: new Map<string, { nombre: string; cantidad: number }>(),
    };

    grupo.total += gasto.monto;
    grupo.cantidad += 1;
    grupo.primeraFecha =
      gasto.fecha < grupo.primeraFecha ? gasto.fecha : grupo.primeraFecha;
    grupo.ultimaFecha =
      gasto.fecha > grupo.ultimaFecha ? gasto.fecha : grupo.ultimaFecha;

    const descripcion = gasto.descripcion.trim() || 'Sin descripción';
    grupo.descripciones.set(
      descripcion,
      (grupo.descripciones.get(descripcion) ?? 0) + 1,
    );

    const categoria = grupo.categorias.get(gasto.categoriaId) ?? {
      nombre: gasto.categoriaNombre || 'Sin categoría',
      cantidad: 0,
    };
    categoria.cantidad += 1;
    grupo.categorias.set(gasto.categoriaId, categoria);

    grupos.set(clave, grupo);
  }

  const fugas: FugaGastoHormiga[] = [...grupos.values()].map((grupo) => {
    const categoria = elegirCategoria(grupo.categorias);
    const totalPeriodo = redondearMonto(grupo.total);

    return {
      clave: grupo.clave,
      etiqueta: elegirEtiqueta(grupo.descripciones),
      categoriaId: categoria.id,
      categoriaNombre: categoria.nombre,
      cantidad: grupo.cantidad,
      totalPeriodo,
      promedio: redondearMonto(totalPeriodo / grupo.cantidad),
      proyeccionAnual: redondearMonto(totalPeriodo * 12),
      // Blindaje explícito contra división por cero.
      porcentajeSobreFugas:
        totalMensual === 0
          ? 0
          : redondearMonto((totalPeriodo / totalMensual) * 100),
      esFrecuente: grupo.cantidad >= 2,
      primeraFecha: grupo.primeraFecha,
      ultimaFecha: grupo.ultimaFecha,
    };
  });

  fugas.sort(
    (a, b) =>
      b.cantidad - a.cantidad ||
      b.proyeccionAnual - a.proyeccionAnual ||
      a.etiqueta.localeCompare(b.etiqueta, 'es'),
  );

  return {
    periodo,
    umbralMonto,
    cantidadGastos: bajoUmbral.length,
    totalMensual,
    proyeccionAnual: redondearMonto(totalMensual * 12),
    totalGastosPeriodo,
    // Blindaje explícito contra división por cero.
    porcentajeDelGastoTotal:
      totalGastosPeriodo === 0
        ? 0
        : redondearMonto((totalMensual / totalGastosPeriodo) * 100),
    cantidadFugasFrecuentes: fugas.filter((fuga) => fuga.esFrecuente).length,
    fugas,
  };
}

/** Convierte el monto de una recurrencia a su equivalente mensual. */
export function mensualizarMontoRecurrente(
  frecuencia: FrecuenciaRecurrencia,
  monto: number,
): number {
  if (frecuencia === 'diaria') return redondearMonto((monto * 365) / 12);
  if (frecuencia === 'semanal') return redondearMonto((monto * 52) / 12);
  return redondearMonto(monto);
}

/** Suma meses a un periodo AAAA-MM, ajustando el año cuando corresponde. */
export function sumarMeses(periodo: string, meses: number): string {
  const [anioTexto, mesTexto] = periodo.split('-');
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);

  if (
    !Number.isInteger(anio) ||
    !Number.isInteger(mes) ||
    mes < 1 ||
    mes > 12 ||
    !Number.isInteger(meses)
  ) {
    return periodo;
  }

  const total = anio * 12 + (mes - 1) + meses;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = ((total % 12) + 12) % 12;

  return `${nuevoAnio}-${String(nuevoMes + 1).padStart(2, '0')}`;
}

/**
 * Calcula un escenario "¿me alcanza?" a partir de un contexto ya preparado.
 *
 * - `viable`: la cuota cabe **y** se conserva la meta de ahorro.
 * - `alcanzaCuota`: la cuota cabe en el flujo, aunque no sobre para la meta.
 */
export function calcularSimulacion(
  contexto: ContextoSimulacion,
  parametros: ParametrosSimulacion,
): ResultadoSimulacion {
  const meses = parametros.meses;
  const montoObjetivo = parametros.montoObjetivo;
  const porcentajeRecorte = parametros.porcentajeRecorte ?? 0;
  const categoriaRecorteId = parametros.categoriaRecorteId ?? null;

  const cuotaMensual = redondearMonto(montoObjetivo / meses);
  const ahorroMensualRecorte = redondearMonto(
    (contexto.gastoCategoriaPromedio * porcentajeRecorte) / 100,
  );
  const ahorroAnualRecorte = redondearMonto(ahorroMensualRecorte * 12);
  const gastoCategoriaProyectada = redondearMonto(
    Math.max(0, contexto.gastoCategoriaPromedio - ahorroMensualRecorte),
  );

  const gastosProyectados = redondearMonto(
    contexto.gastosBase - ahorroMensualRecorte,
  );
  const flujoLibreProyectado = redondearMonto(
    contexto.ingresosBase - gastosProyectados,
  );
  const disponibleParaCuota = redondearMonto(
    flujoLibreProyectado - contexto.metaAhorroMensual,
  );
  const diferenciaMensual = redondearMonto(disponibleParaCuota - cuotaMensual);

  const viable = diferenciaMensual >= 0;
  const alcanzaCuota = flujoLibreProyectado >= cuotaMensual;

  let diagnostico: ResultadoSimulacion['diagnostico'];
  if (viable) {
    diagnostico = DiagnosticoSimulacion.Viable;
  } else if (alcanzaCuota) {
    diagnostico = DiagnosticoSimulacion.Ajustado;
  } else {
    diagnostico = DiagnosticoSimulacion.Inviable;
  }

  const mesesParaObjetivo =
    flujoLibreProyectado > 0
      ? Math.ceil(montoObjetivo / flujoLibreProyectado)
      : null;

  return {
    montoObjetivo,
    meses,
    cuotaMensual,
    categoriaRecorteId,
    categoriaRecorteNombre: contexto.categoriaRecorteNombre,
    porcentajeRecorte,

    periodoReferencia: contexto.periodoReferencia,
    mesesAnalizados: [...contexto.mesesAnalizados],
    ingresosPromedio: contexto.ingresosPromedio,
    gastosPromedio: contexto.gastosPromedio,
    flujoLibrePromedio: contexto.flujoLibrePromedio,
    ingresoRecurrenteMensual: contexto.ingresoRecurrenteMensual,
    compromisoRecurrenteMensual: contexto.compromisoRecurrenteMensual,
    recurrenciasActivas: contexto.recurrenciasActivas.map((recurrencia) => ({
      ...recurrencia,
    })),
    metaAhorroMensual: contexto.metaAhorroMensual,

    gastoCategoriaPromedio: contexto.gastoCategoriaPromedio,
    ahorroMensualRecorte,
    ahorroAnualRecorte,
    gastoCategoriaProyectada,

    ingresosBase: contexto.ingresosBase,
    gastosBase: contexto.gastosBase,
    gastosProyectados,
    flujoLibreActual: contexto.flujoLibreActual,
    flujoLibreProyectado,
    disponibleParaCuota,
    diferenciaMensual,

    viable,
    alcanzaCuota,
    diagnostico,
    mesesParaObjetivo,
    fechaEstimada:
      mesesParaObjetivo === null
        ? null
        : sumarMeses(contexto.periodoReferencia, mesesParaObjetivo),
  };
}
