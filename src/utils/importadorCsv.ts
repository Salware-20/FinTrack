/**
 * Motor de importación de estados de cuenta bancarios en CSV.
 *
 * Este módulo es puro: no conoce Dexie, React ni la sesión. Recibe el texto del
 * archivo y un contexto (categorías reales del usuario y movimientos ya
 * guardados en la cuenta) y devuelve las filas detectadas. El servicio es quien
 * valida la cuenta y persiste los movimientos.
 *
 * Soporta los formatos habituales de los bancos de Costa Rica:
 * - separador coma (`,`) o punto y coma (`;`) detectado automáticamente;
 * - campos entre comillas con separadores o saltos de línea internos;
 * - fechas `DD/MM/YYYY`, `YYYY-MM-DD` y variantes con hora;
 * - montos `₡1.234,56`, `1,234.56`, `(12.500,00)` o con signo;
 * - columnas separadas de Débito/Crédito o un monto único;
 * - filas de metadatos (nombre, IBAN, saldos) antes de la cabecera y filas de
 *   totales al final, que se ignoran.
 */

import { ErrorValidacion } from '../models/errores';
import { MetodoPago, TipoTransaccion } from '../models/tipos';
import type { Categoria } from '../models/Categoria';
import type { Transaccion } from '../models/Transaccion';
import type { FilaCsvDetectada } from '../models/tipos';
import { redondearMonto } from './numeros';

/** Máximo de movimientos aceptados en una sola importación. */
const MAXIMO_FILAS = 2000;

/** Filas que se inspeccionan al buscar la cabecera del archivo. */
const MAXIMO_FILAS_ESCANEO_CABECERA = 25;

/** Contexto que el servicio arma antes de llamar al motor. */
export interface ContextoDeteccion {
  cuentaId: string;
  /** Categorías reales del usuario (para mapear nombres → ids). */
  categorias: Categoria[];
  /** Movimientos ya guardados en esa cuenta (para detectar duplicados). */
  transaccionesExistentes: Transaccion[];
}

/** Índices de las columnas reconocidas; -1 cuando no existe. */
interface MapaColumnas {
  fecha: number;
  descripcion: number;
  debito: number;
  credito: number;
  monto: number;
  tipo: number;
}

interface ReglaCategoria {
  /** Palabras clave normalizadas (sin acentos ni mayúsculas). */
  claves: readonly string[];
  /** Nombre de la categoría destino; se resuelve contra las reales. */
  categoria: string;
  /** Tipos a los que aplica; por defecto solo gasto. */
  tipos?: readonly TipoTransaccion[];
  /** Método de pago que implica la regla, si aplica. */
  metodoPago?: MetodoPago;
}

// ---------------------------------------------------------------------------
// Normalización de texto
// ---------------------------------------------------------------------------

/** Minúsculas, sin acentos, sin puntuación y con espacios colapsados. */
function normalizarTexto(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Fechas y montos no deben pasar por `normalizarTexto`: se limpian aparte. */
function limpiarNumero(valor: string): string {
  return valor
    .replace(/["']/g, '')
    .replace(/[₡$€\s\u00a0]/g, '')
    .replace(/crc|usd|colones|dolares/gi, '');
}

// ---------------------------------------------------------------------------
// Detección de separador y tokenizador CSV
// ---------------------------------------------------------------------------

/** Cuenta un separador ignorando lo que está entre comillas. */
function contarSeparadores(linea: string, separador: ',' | ';'): number {
  let total = 0;
  let enComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (caracter === '"') {
      if (enComillas && linea[i + 1] === '"') {
        i += 1;
      } else {
        enComillas = !enComillas;
      }
      continue;
    }
    if (!enComillas && caracter === separador) total += 1;
  }

  return total;
}

/** Elige `;` solo si aparece más veces que `,` en la muestra. */
export function detectarSeparador(lineas: string[]): ',' | ';' {
  const muestra = lineas.slice(0, 5);
  const comas = muestra.reduce((total, linea) => total + contarSeparadores(linea, ','), 0);
  const puntos = muestra.reduce((total, linea) => total + contarSeparadores(linea, ';'), 0);
  return puntos > comas ? ';' : ',';
}

/**
 * Convierte el CSV en filas de celdas recortadas.
 * Respeta comillas, comillas escapadas (`""`) y saltos de línea internos.
 */
export function parsearCsv(contenido: string, separador: ',' | ';'): string[][] {
  const texto = contenido
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let enComillas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i];

    if (caracter === '"') {
      if (enComillas && texto[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else {
        enComillas = !enComillas;
      }
      continue;
    }

    if (!enComillas && caracter === separador) {
      fila.push(celda.trim());
      celda = '';
      continue;
    }

    if (!enComillas && caracter === '\n') {
      fila.push(celda.trim());
      if (fila.some((valor) => valor.length > 0)) filas.push(fila);
      fila = [];
      celda = '';
      continue;
    }

    celda += caracter;
  }

  fila.push(celda.trim());
  if (fila.some((valor) => valor.length > 0)) filas.push(fila);

  return filas;
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/**
 * Normaliza una fecha de banco a `AAAA-MM-DD`.
 *
 * Acepta `DD/MM/YYYY`, `YYYY-MM-DD`, separadores `-`, `/` o `.`, años de dos
 * dígitos y sufijos de hora. Si el mes resultante no existe pero el día sí,
 * interpreta el valor como `MM/DD/YYYY` (archivos de origen estadounidense).
 * Devuelve `null` si la fecha no es reconocible o no existe en el calendario.
 */
export function normalizarFechaCruda(valor: string): string | null {
  const limpia = valor.replace(/["']/g, '').trim();
  if (!limpia) return null;

  const soloFecha = limpia.split(/[T\s]/)[0];
  if (!soloFecha) return null;

  let anio: number;
  let mes: number;
  let dia: number;

  const iso = soloFecha.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const diaPrimero = soloFecha.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);

  if (iso) {
    anio = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else if (diaPrimero) {
    dia = Number(diaPrimero[1]);
    mes = Number(diaPrimero[2]);
    anio = Number(diaPrimero[3]);
    if (anio < 100) anio += 2000;
    if (mes > 12 && dia <= 12) {
      const intercambio = mes;
      mes = dia;
      dia = intercambio;
    }
  } else {
    return null;
  }

  if (!anio || !mes || !dia) return null;

  const fecha = new Date(anio, mes - 1, dia);
  const esReal =
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia;
  if (!esReal) return null;

  return `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

// ---------------------------------------------------------------------------
// Montos
// ---------------------------------------------------------------------------

/**
 * Normaliza un monto bancario y conserva el signo.
 *
 * Reglas: quita símbolos y letras de moneda, acepta negativos entre paréntesis
 * o con guion final. Cuando hay coma y punto, el último es el decimal; con un
 * solo separador repetido o seguido de tres dígitos se asume separador de miles
 * (convención costarricense). Devuelve `null` si no es un número.
 */
export function normalizarMontoCrudo(valor: string): number | null {
  let texto = valor.trim();
  if (!texto) return null;

  let negativo = false;
  if (/^\(.*\)$/.test(texto)) {
    negativo = true;
    texto = texto.slice(1, -1);
  }

  texto = limpiarNumero(texto);

  if (texto.endsWith('-')) {
    negativo = true;
    texto = texto.slice(0, -1);
  }
  if (texto.startsWith('-')) {
    negativo = true;
    texto = texto.slice(1);
  }
  if (texto.startsWith('+')) texto = texto.slice(1);

  if (!texto) return null;

  const ultimaComa = texto.lastIndexOf(',');
  const ultimoPunto = texto.lastIndexOf('.');
  let normalizado: string;

  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const decimalEsComa = ultimaComa > ultimoPunto;
    const miles = decimalEsComa ? '.' : ',';
    const decimal = decimalEsComa ? ',' : '.';
    normalizado = texto.split(miles).join('').replace(decimal, '.');
  } else if (ultimaComa >= 0 || ultimoPunto >= 0) {
    const separador = ultimaComa >= 0 ? ',' : '.';
    const partes = texto.split(separador);
    const ultima = partes[partes.length - 1] ?? '';
    const esMiles = partes.length > 2 || (partes.length === 2 && ultima.length === 3);
    normalizado = esMiles
      ? partes.join('')
      : `${partes.slice(0, -1).join('')}.${ultima}`;
  } else {
    normalizado = texto;
  }

  const numero = Number.parseFloat(normalizado);
  if (!Number.isFinite(numero)) return null;

  return negativo ? -Math.abs(numero) : numero;
}

// ---------------------------------------------------------------------------
// Cabecera y mapeo de columnas
// ---------------------------------------------------------------------------

/**
 * Sinónimos por campo. El orden importa: `tipo` se resuelve antes que
 * `descripcion` para que "tipo de transacción" no se confunda con una
 * descripción, y los montos antes que la descripción.
 */
const SINONIMOS: ReadonlyArray<{
  campo: keyof MapaColumnas;
  palabras: readonly string[];
}> = [
  { campo: 'fecha', palabras: ['fecha', 'date'] },
  { campo: 'debito', palabras: ['debito', 'cargo', 'retiro'] },
  { campo: 'credito', palabras: ['credito', 'abono', 'deposito'] },
  { campo: 'monto', palabras: ['monto', 'importe', 'valor', 'cantidad', 'amount'] },
  { campo: 'tipo', palabras: ['tipo', 'naturaleza'] },
  {
    campo: 'descripcion',
    palabras: [
      'descripcion',
      'detalle',
      'concepto',
      'referencia',
      'documento',
      'comercio',
    ],
  },
];

/** Compara una cabecera normalizada contra un sinónimo por palabras completas. */
function coincideCabecera(texto: string, palabra: string): boolean {
  return (
    texto === palabra ||
    texto.startsWith(`${palabra} `) ||
    texto.endsWith(` ${palabra}`) ||
    texto.includes(` ${palabra} `)
  );
}

/** Verdadero si la fila parece una cabecera y no una fila de datos. */
function esFilaCabecera(fila: string[]): boolean {
  if (fila.some((celda) => normalizarFechaCruda(celda) !== null)) return false;

  let coincidencias = 0;
  for (const celda of fila) {
    const texto = normalizarTexto(celda);
    if (!texto) continue;
    const reconocida = SINONIMOS.some(({ palabras }) =>
      palabras.some((palabra) => coincideCabecera(texto, palabra)),
    );
    if (reconocida) coincidencias += 1;
  }

  return coincidencias >= 2;
}

function mapearCabecera(cabecera: string[]): MapaColumnas {
  const mapa: MapaColumnas = {
    fecha: -1,
    descripcion: -1,
    debito: -1,
    credito: -1,
    monto: -1,
    tipo: -1,
  };
  const usados = new Set<number>();

  for (const { campo, palabras } of SINONIMOS) {
    for (let i = 0; i < cabecera.length; i += 1) {
      if (usados.has(i)) continue;
      const texto = normalizarTexto(cabecera[i]);
      if (!texto) continue;
      if (palabras.some((palabra) => coincideCabecera(texto, palabra))) {
        mapa[campo] = i;
        usados.add(i);
        break;
      }
    }
  }

  return mapa;
}

/** Columnas numéricas que nunca tienen valor a la vez (Débito/Crédito). */
function sonComplementarias(filas: string[][], a: number, b: number): boolean {
  return filas.every((fila) => {
    const valorA = (fila[a] ?? '').trim();
    const valorB = (fila[b] ?? '').trim();
    return !valorA || !valorB;
  });
}

/**
 * Infiere las columnas cuando el archivo no trae cabecera reconocible.
 * Usa las primeras filas: la columna con más fechas, las columnas numéricas y
 * la columna de texto más larga.
 */
function inferirColumnas(filas: string[][]): MapaColumnas {
  const mapa: MapaColumnas = {
    fecha: -1,
    descripcion: -1,
    debito: -1,
    credito: -1,
    monto: -1,
    tipo: -1,
  };
  const muestra = filas.slice(0, MAXIMO_FILAS_ESCANEO_CABECERA);
  const ancho = muestra.reduce((maximo, fila) => Math.max(maximo, fila.length), 0);
  if (ancho === 0) return mapa;

  const fechas = new Array<number>(ancho).fill(0);
  const numeros = new Array<number>(ancho).fill(0);
  const textoLargo = new Array<number>(ancho).fill(0);

  for (const fila of muestra) {
    for (let i = 0; i < ancho; i += 1) {
      const celda = (fila[i] ?? '').trim();
      if (!celda) continue;
      if (normalizarFechaCruda(celda) !== null) {
        fechas[i] += 1;
        continue;
      }
      if (normalizarMontoCrudo(celda) !== null) {
        numeros[i] += 1;
        continue;
      }
      textoLargo[i] += celda.length;
    }
  }

  let indiceFecha = -1;
  for (let i = 0; i < ancho; i += 1) {
    if (fechas[i] === 0) continue;
    if (indiceFecha < 0 || fechas[i] > fechas[indiceFecha]) indiceFecha = i;
  }
  mapa.fecha = indiceFecha;

  const numericas: number[] = [];
  for (let i = 0; i < ancho; i += 1) {
    if (i === indiceFecha) continue;
    if (numeros[i] > 0) numericas.push(i);
  }

  const asignarMontos = (candidatas: number[]): void => {
    if (candidatas.length === 0) return;
    if (candidatas.length === 1) {
      mapa.monto = candidatas[0];
      return;
    }
    if (
      candidatas.length === 2 &&
      sonComplementarias(muestra, candidatas[0], candidatas[1])
    ) {
      mapa.debito = candidatas[0];
      mapa.credito = candidatas[1];
      return;
    }
    mapa.monto = candidatas[0];
  };

  if (numericas.length >= 3) {
    // La última columna numérica suele ser el saldo acumulado.
    asignarMontos(numericas.slice(0, numericas.length - 1));
  } else {
    asignarMontos(numericas);
  }

  const numericasUsadas = new Set(numericas);
  let indiceDescripcion = -1;
  for (let i = 0; i < ancho; i += 1) {
    if (i === indiceFecha || numericasUsadas.has(i)) continue;
    if (textoLargo[i] === 0) continue;
    if (indiceDescripcion < 0 || textoLargo[i] > textoLargo[indiceDescripcion]) {
      indiceDescripcion = i;
    }
  }
  mapa.descripcion = indiceDescripcion;

  return mapa;
}

/** Completa con inferencia los campos que la cabecera no aportó. */
function completarMapa(mapa: MapaColumnas, datos: string[][]): MapaColumnas {
  const inferido = inferirColumnas(datos);
  const completado: MapaColumnas = { ...mapa };

  if (completado.fecha < 0) completado.fecha = inferido.fecha;
  if (completado.descripcion < 0) completado.descripcion = inferido.descripcion;
  if (
    completado.monto < 0 &&
    completado.debito < 0 &&
    completado.credito < 0
  ) {
    completado.monto = inferido.monto;
    completado.debito = inferido.debito;
    completado.credito = inferido.credito;
  }

  return completado;
}

// ---------------------------------------------------------------------------
// Tipo de movimiento
// ---------------------------------------------------------------------------

const INDICADORES_INGRESO: readonly string[] = [
  'deposito',
  'abono',
  'salario',
  'planilla',
  'nomina',
  'aguinaldo',
  'transferencia recibida',
  'sinpe de',
  'sinpe recibido',
  'devolucion',
  'reembolso',
  'intereses',
  'dividendo',
  'outsourcing',
];

function tipoDesdeTexto(valor: string): TipoTransaccion | null {
  const texto = normalizarTexto(valor);
  if (!texto) return null;

  if (texto === 'c' || texto === 'cr') return TipoTransaccion.Ingreso;
  if (texto === 'd' || texto === 'db') return TipoTransaccion.Gasto;

  const ingresos = ['credito', 'abono', 'deposito', 'entrada', 'ingreso', 'recibido'];
  if (ingresos.some((clave) => contieneClave(texto, clave))) {
    return TipoTransaccion.Ingreso;
  }

  const gastos = ['debito', 'cargo', 'retiro', 'salida', 'gasto', 'pago', 'compra'];
  if (gastos.some((clave) => contieneClave(texto, clave))) {
    return TipoTransaccion.Gasto;
  }

  return null;
}

/** Descripción de la fila; si viene vacía se usa el primer texto útil. */
function leerDescripcion(fila: string[], mapa: MapaColumnas): string {
  const valor = mapa.descripcion >= 0 ? (fila[mapa.descripcion] ?? '').trim() : '';
  if (valor) return valor;

  for (const celda of fila) {
    const texto = celda.trim();
    if (!texto) continue;
    if (normalizarFechaCruda(texto) !== null) continue;
    if (normalizarMontoCrudo(texto) !== null) continue;
    return texto;
  }

  return 'Movimiento importado';
}

/**
 * Resuelve monto y tipo de una fila.
 * Precedencia: columna de tipo > columnas Débito/Crédito > monto único.
 */
function resolverMonto(
  fila: string[],
  mapa: MapaColumnas,
  descripcion: string,
): { monto: number; tipo: TipoTransaccion } | null {
  const debito =
    mapa.debito >= 0 ? normalizarMontoCrudo(fila[mapa.debito] ?? '') : null;
  const credito =
    mapa.credito >= 0 ? normalizarMontoCrudo(fila[mapa.credito] ?? '') : null;
  const unico =
    mapa.monto >= 0 ? normalizarMontoCrudo(fila[mapa.monto] ?? '') : null;
  const tipoTexto =
    mapa.tipo >= 0 ? tipoDesdeTexto(fila[mapa.tipo] ?? '') : null;

  const buscarCantidad = (): number | null => {
    if (credito !== null && credito !== 0) return credito;
    if (debito !== null && debito !== 0) return debito;
    if (unico !== null && unico !== 0) return unico;
    return null;
  };

  if (tipoTexto) {
    const cantidad = buscarCantidad();
    if (cantidad === null) return null;
    return { monto: Math.abs(cantidad), tipo: tipoTexto };
  }

  if (credito !== null && credito !== 0) {
    return { monto: Math.abs(credito), tipo: TipoTransaccion.Ingreso };
  }
  if (debito !== null && debito !== 0) {
    return { monto: Math.abs(debito), tipo: TipoTransaccion.Gasto };
  }
  if (unico === null || unico === 0) return null;

  if (unico < 0) {
    return { monto: Math.abs(unico), tipo: TipoTransaccion.Gasto };
  }

  const texto = normalizarTexto(descripcion);
  const esIngreso = INDICADORES_INGRESO.some((clave) =>
    contieneClave(texto, clave),
  );

  return {
    monto: Math.abs(unico),
    tipo: esIngreso ? TipoTransaccion.Ingreso : TipoTransaccion.Gasto,
  };
}

// ---------------------------------------------------------------------------
// Coincidencia de palabras clave
// ---------------------------------------------------------------------------

/**
 * Verdadero si el texto contiene la clave.
 *
 * Las claves de tres caracteres o menos (`uno`, `bar`, `max`, `rey`, `aya`,
 * `ice`) exigen token completo para evitar falsos positivos; las más largas
 * admiten prefijo (`gasolin` → `gasolinera`). Las claves multi-palabra se
 * buscan como frase.
 */
function contieneClave(texto: string, clave: string): boolean {
  if (clave.includes(' ')) {
    return ` ${texto} `.includes(` ${clave} `);
  }

  const tokens = texto.split(' ').filter(Boolean);
  if (clave.length <= 3) {
    return tokens.some((token) => token === clave);
  }
  return tokens.some((token) => token.startsWith(clave));
}

// ---------------------------------------------------------------------------
// Reglas de auto-categorización
// ---------------------------------------------------------------------------

/**
 * Reglas ordenadas de lo más específico a lo más genérico. La primera
 * coincidencia compatible con el tipo de la fila gana. Los nombres de
 * categoría se resuelven contra las categorías reales del usuario
 * (ver `db/semilla.ts`), con respaldo a "Otros gastos/ingresos".
 */
const REGLAS_CATEGORIA: readonly ReglaCategoria[] = [
  // --- Ingresos ---
  {
    claves: ['salario', 'planilla', 'nomina', 'aguinaldo', 'pago de salario'],
    categoria: 'Salario',
    tipos: [TipoTransaccion.Ingreso],
    metodoPago: MetodoPago.Transferencia,
  },
  {
    claves: ['outsourcing', 'honorarios', 'servicios profesionales', 'factura'],
    categoria: 'Outsourcing',
    tipos: [TipoTransaccion.Ingreso],
    metodoPago: MetodoPago.Transferencia,
  },
  {
    claves: [
      'sinpe movil',
      'sinpe de',
      'sinpe recibido',
      'transferencia recibida',
      'deposito',
    ],
    categoria: 'SINPE Móvil',
    tipos: [TipoTransaccion.Ingreso],
    metodoPago: MetodoPago.Sinpe,
  },

  // --- Gastos: delivery ---
  {
    claves: ['uber eats', 'pedidos ya', 'glovo', 'rappi'],
    categoria: 'Servicios express',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: ['uber', 'didi', 'cabify', 'indriver', 'in driver', 'taxi'],
    categoria: 'Didi / Uber',
    metodoPago: MetodoPago.Tarjeta,
  },

  // --- Gastos: transporte y combustible ---
  {
    claves: [
      'gasolinera',
      'gasolina',
      'combustible',
      'servicentro',
      'delta',
      'uno',
      'total',
      'petro',
      'recope',
      'shell',
      'texaco',
      'bomba',
    ],
    categoria: 'Gasolina',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: ['bus', 'tren', 'incofer', 'transporte publico'],
    categoria: 'Bus / Tren',
    metodoPago: MetodoPago.Efectivo,
  },
  {
    claves: ['taller', 'repuesto', 'mecanico', 'lubricentro', 'mantenimiento'],
    categoria: 'Mantenimiento',
    metodoPago: MetodoPago.Tarjeta,
  },

  // --- Gastos: alimentación ---
  {
    claves: [
      'supermercado',
      'automercado',
      'walmart',
      'pali',
      'maxi pali',
      'mas x menos',
      'perimercado',
      'megasuper',
      'price smart',
      'pricesmart',
      'jumbo',
      'rey',
      'bm',
    ],
    categoria: 'Supermercado',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: ['minisuper', 'mini super', 'abarrotes', 'pulperia'],
    categoria: 'Minisúper',
    metodoPago: MetodoPago.Efectivo,
  },
  {
    claves: ['cafeteria', 'cafe', 'starbucks', 'soda', 'panaderia'],
    categoria: 'Cafetería',
    metodoPago: MetodoPago.Efectivo,
  },
  {
    claves: [
      'restaurante',
      'pizza',
      'mcdonald',
      'burger',
      'kfc',
      'subway',
      'wings',
      'bar',
      'food',
    ],
    categoria: 'Restaurante',
    metodoPago: MetodoPago.Tarjeta,
  },

  // --- Gastos: servicios del hogar ---
  {
    claves: [
      'ice electricidad',
      'cnfl',
      'coopeguanacaste',
      'coopealfaro',
      'electricidad',
      'luz',
      'energia',
    ],
    categoria: 'Luz',
    metodoPago: MetodoPago.Transferencia,
  },
  {
    claves: ['aya', 'acueducto', 'acueductos', 'agua'],
    categoria: 'Agua',
    metodoPago: MetodoPago.Transferencia,
  },
  {
    claves: [
      'kolbi',
      'claro',
      'movistar',
      'libertad',
      'ice celular',
      'telefonia',
      'celular',
      'postpago',
    ],
    categoria: 'Celular',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: ['internet', 'fibra', 'banda ancha', 'cable onda'],
    categoria: 'Internet',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: [
      'cable',
      'tigo',
      'sky',
      'netflix',
      'spotify',
      'disney',
      'hbo',
      'prime video',
      'youtube premium',
    ],
    categoria: 'Cable',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: [
      'microsoft',
      'adobe',
      'apple',
      'google',
      'github',
      'openai',
      'chatgpt',
      'software',
      'licencia',
    ],
    categoria: 'Software',
    metodoPago: MetodoPago.Tarjeta,
  },

  // --- Gastos: salud y otros ---
  {
    claves: ['farmacia', 'fischel', 'farma'],
    categoria: 'Farmacia',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: ['clinica', 'hospital', 'laboratorio', 'medico', 'consulta'],
    categoria: 'Consulta médica',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: [
      'amazon',
      'ebay',
      'tienda',
      'almacen',
      'siman',
      'zara',
      'ropa',
      'compras',
      'ferreteria',
    ],
    categoria: 'Compras',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: ['veterinaria', 'mascota', 'pet shop', 'agropecuaria'],
    categoria: 'Mascotas',
    metodoPago: MetodoPago.Tarjeta,
  },
  {
    claves: [
      'universidad',
      'colegio',
      'escuela',
      'matricula',
      'curso',
      'udemy',
      'coursera',
    ],
    categoria: 'Educación',
    metodoPago: MetodoPago.Transferencia,
  },
  {
    claves: ['cine', 'cinema', 'teatro', 'concierto', 'steam', 'juego'],
    categoria: 'Ocio',
    metodoPago: MetodoPago.Tarjeta,
  },

  // --- Gastos: SINPE enviado ---
  {
    claves: ['sinpe', 'sinpe movil'],
    categoria: 'Otros gastos',
    metodoPago: MetodoPago.Sinpe,
  },
];

const REGLAS_METODO_PAGO: ReadonlyArray<{
  metodo: MetodoPago;
  claves: readonly string[];
}> = [
  { metodo: MetodoPago.Sinpe, claves: ['sinpe'] },
  {
    metodo: MetodoPago.Transferencia,
    claves: ['transferencia', 'transfer', 'ach', 'lbtr', 'deposito', 'planilla'],
  },
  {
    metodo: MetodoPago.Tarjeta,
    claves: ['tarjeta', 'visa', 'mastercard', 'pos', 'compra', 'debito automatico'],
  },
  {
    metodo: MetodoPago.Efectivo,
    claves: ['cajero', 'atm', 'retiro', 'efectivo'],
  },
];

function reglaCoincidente(
  texto: string,
  tipo: TipoTransaccion,
): ReglaCategoria | null {
  for (const regla of REGLAS_CATEGORIA) {
    const tipos = regla.tipos ?? [TipoTransaccion.Gasto];
    if (!tipos.includes(tipo)) continue;
    if (regla.claves.some((clave) => contieneClave(texto, clave))) {
      return regla;
    }
  }
  return null;
}

/** Primera categoría del tipo, en orden alfabético (mismo que el servicio). */
function primeraDelTipo(
  tipo: TipoTransaccion,
  categorias: Categoria[],
): string {
  const delTipo = categorias
    .filter((categoria) => categoria.tipo === tipo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return delTipo[0]?.id ?? '';
}

/**
 * Busca la categoría real más parecida al nombre indicado.
 * Cadena: exacta → nombre completo → parcial; '' si no hay ninguna.
 */
function resolverCategoria(
  nombre: string,
  tipo: TipoTransaccion,
  categorias: Categoria[],
): string {
  const objetivo = normalizarTexto(nombre);
  const delTipo = categorias.filter((categoria) => categoria.tipo === tipo);

  const exacta = delTipo.find(
    (categoria) => normalizarTexto(categoria.nombre) === objetivo,
  );
  if (exacta) return exacta.id;

  const completa = delTipo.find((categoria) => {
    const nombreCompleto = normalizarTexto(categoria.nombreCompleto(categorias));
    return (
      nombreCompleto === objetivo ||
      nombreCompleto.endsWith(` ${objetivo}`)
    );
  });
  if (completa) return completa.id;

  const parcial = delTipo.find((categoria) => {
    const nombreCategoria = normalizarTexto(categoria.nombre);
    return (
      nombreCategoria.includes(objetivo) || objetivo.includes(nombreCategoria)
    );
  });
  if (parcial) return parcial.id;

  return '';
}

/**
 * Categoría sugerida para una descripción según el diccionario de palabras
 * clave, resuelta contra las categorías reales del usuario.
 */
export function sugerirCategoria(
  descripcion: string,
  tipo: TipoTransaccion,
  categorias: Categoria[],
): string {
  const texto = normalizarTexto(descripcion);
  const regla = reglaCoincidente(texto, tipo);

  if (regla) {
    const id = resolverCategoria(regla.categoria, tipo, categorias);
    if (id) return id;
  }

  const respaldo = resolverCategoria(
    tipo === TipoTransaccion.Ingreso ? 'Otros ingresos' : 'Otros gastos',
    tipo,
    categorias,
  );

  return respaldo || primeraDelTipo(tipo, categorias);
}

/** Método de pago inferido por palabras clave; `otro` si no hay pistas. */
export function sugerirMetodoPago(descripcion: string): MetodoPago {
  const texto = normalizarTexto(descripcion);

  for (const regla of REGLAS_METODO_PAGO) {
    if (regla.claves.some((clave) => contieneClave(texto, clave))) {
      return regla.metodo;
    }
  }

  return MetodoPago.Otro;
}

// ---------------------------------------------------------------------------
// Duplicados
// ---------------------------------------------------------------------------

const PALABRAS_IGNORADAS = new Set([
  'pago',
  'pagos',
  'compra',
  'compras',
  'debito',
  'credito',
  'transferencia',
  'sinpe',
  'movil',
  'para',
  'desde',
  'este',
  'esta',
  'con',
  'por',
  'del',
  'las',
  'los',
  'una',
  'unas',
  'unos',
  'movimiento',
]);

function huella(fecha: string, tipo: TipoTransaccion, monto: number): string {
  return `${fecha}|${tipo}|${redondearMonto(monto).toFixed(2)}`;
}

function tokensSignificativos(texto: string): string[] {
  return texto
    .split(' ')
    .filter((token) => token.length >= 4 && !PALABRAS_IGNORADAS.has(token));
}

/**
 * Compara descripciones para confirmar un posible duplicado: igualdad o al
 * menos una palabra significativa en común. Evita marcar dos consumos
 * legítimos del mismo monto y día en comercios distintos.
 */
function sonDescripcionesSimilares(a: string, b: string): boolean {
  const normalizadaA = normalizarTexto(a);
  const normalizadaB = normalizarTexto(b);

  if (!normalizadaA || !normalizadaB) return true;
  if (normalizadaA === normalizadaB) return true;

  const tokensA = tokensSignificativos(normalizadaA);
  if (tokensA.length === 0) return false;

  const tokensB = new Set(tokensSignificativos(normalizadaB));
  return tokensA.some((token) => tokensB.has(token));
}

function indexarExistentes(
  contexto: ContextoDeteccion,
): Map<string, Transaccion[]> {
  const indice = new Map<string, Transaccion[]>();

  for (const transaccion of contexto.transaccionesExistentes) {
    if (transaccion.cuentaId !== contexto.cuentaId) continue;
    const clave = huella(transaccion.fecha, transaccion.tipo, transaccion.monto);
    const lista = indice.get(clave);
    if (lista) lista.push(transaccion);
    else indice.set(clave, [transaccion]);
  }

  return indice;
}

// ---------------------------------------------------------------------------
// API principal
// ---------------------------------------------------------------------------

/**
 * Detecta los movimientos de un CSV bancario.
 *
 * - Busca la cabecera en las primeras 25 filas e ignora los metadatos previos.
 * - Descarta filas sin fecha válida o sin monto (totales, notas, encabezados
 *   repetidos).
 * - Marca `posibleDuplicado` si coincide con un movimiento de la cuenta o con
 *   otra fila del mismo archivo.
 *
 * Lanza `ErrorValidacion` (campo `csv`) si el archivo no es reconocible.
 */
export function detectarFilasCsv(
  contenido: string,
  contexto: ContextoDeteccion,
): FilaCsvDetectada[] {
  const lineas = contenido
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const muestra = lineas
    .filter((linea) => linea.trim().length > 0)
    .slice(0, 5);

  const separadores = muestra.reduce(
    (total, linea) =>
      total + contarSeparadores(linea, ',') + contarSeparadores(linea, ';'),
    0,
  );

  if (separadores === 0) {
    throw new ErrorValidacion(
      'No se reconoce el formato del CSV. Se esperaba un separador coma (,) o punto y coma (;).',
      'csv',
    );
  }

  const separador = detectarSeparador(muestra);
  const filas = parsearCsv(contenido, separador);

  if (filas.length === 0) {
    throw new ErrorValidacion('El archivo no contiene filas de datos.', 'csv');
  }

  // La cabecera puede estar precedida por metadatos del banco.
  let indiceCabecera = -1;
  const limite = Math.min(filas.length, MAXIMO_FILAS_ESCANEO_CABECERA);
  for (let i = 0; i < limite; i += 1) {
    if (esFilaCabecera(filas[i])) {
      indiceCabecera = i;
      break;
    }
  }

  const datos =
    indiceCabecera >= 0 ? filas.slice(indiceCabecera + 1) : filas;
  const mapaBase =
    indiceCabecera >= 0
      ? mapearCabecera(filas[indiceCabecera])
      : inferirColumnas(datos);
  const mapa = completarMapa(mapaBase, datos);

  if (mapa.fecha < 0) {
    throw new ErrorValidacion(
      'No se encontró una columna de fechas en el archivo.',
      'csv',
    );
  }
  if (mapa.monto < 0 && mapa.debito < 0 && mapa.credito < 0) {
    throw new ErrorValidacion(
      'No se encontró una columna de montos en el archivo.',
      'csv',
    );
  }
  if (datos.length > MAXIMO_FILAS) {
    throw new ErrorValidacion(
      `El archivo supera el máximo de ${MAXIMO_FILAS} movimientos por importación.`,
      'csv',
    );
  }

  const existentes = indexarExistentes(contexto);
  const vistas = new Set<string>();
  const resultado: FilaCsvDetectada[] = [];

  datos.forEach((fila, indice) => {
    const numeroFila = indice + 1;

    const fecha = normalizarFechaCruda(fila[mapa.fecha] ?? '');
    if (!fecha) return;

    const descripcion = leerDescripcion(fila, mapa);
    const resolucion = resolverMonto(fila, mapa, descripcion);
    if (!resolucion) return;

    const texto = normalizarTexto(descripcion);
    const regla = reglaCoincidente(texto, resolucion.tipo);
    const categoriaIdSugerida = sugerirCategoria(
      descripcion,
      resolucion.tipo,
      contexto.categorias,
    );
    const metodoPagoSugerido =
      regla?.metodoPago ?? sugerirMetodoPago(descripcion);

    const avisos: string[] = [];
    let posibleDuplicado = false;

    const clave = huella(fecha, resolucion.tipo, resolucion.monto);
    const coincidencias = existentes.get(clave) ?? [];
    if (
      coincidencias.some((existente) =>
        sonDescripcionesSimilares(descripcion, existente.descripcion),
      )
    ) {
      posibleDuplicado = true;
      avisos.push('Coincide con un movimiento ya registrado.');
    }

    const claveArchivo = `${clave}|${texto}`;
    if (vistas.has(claveArchivo)) {
      posibleDuplicado = true;
      avisos.push('Fila repetida dentro del archivo.');
    }
    vistas.add(claveArchivo);

    if (!categoriaIdSugerida) {
      avisos.push('No hay una categoría de este tipo; asígnele una.');
    }

    resultado.push({
      id: `csv-${numeroFila}`,
      fecha,
      descripcion,
      monto: redondearMonto(resolucion.monto),
      tipo: resolucion.tipo,
      categoriaIdSugerida,
      metodoPagoSugerido,
      posibleDuplicado,
      numeroFila,
      ...(avisos.length > 0 ? { advertencia: avisos.join(' · ') } : {}),
    });
  });

  if (resultado.length === 0) {
    throw new ErrorValidacion(
      'No se reconoció ningún movimiento válido en el archivo.',
      'csv',
    );
  }

  return resultado;
}
