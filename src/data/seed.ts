import { Categoria } from '../models/Categoria';
import type { DatosCategoria } from '../models/Categoria';
import { Transaccion } from '../models/Transaccion';
import { Usuario } from '../models/Usuario';
import { MetodoPago, TipoTransaccion } from '../models/tipos';
import type { TipoTransaccion as TipoTransaccionType } from '../models/tipos';
import { aFechaISO } from '../utils/formato';

/**
 * Datos de demostración del mock.
 *
 * Las fechas se calculan respecto a "hoy" (0 a 85 días atrás) para que los
 * gráficos siempre muestren unos tres meses de historial, sin importar
 * cuándo se abra la aplicación.
 */

const CATEGORIAS_SEMILLA: DatosCategoria[] = [
  {
    id: 'cat-salario',
    nombre: 'Salario',
    tipo: TipoTransaccion.Ingreso,
    color: '#198754',
    icono: '💼',
  },
  {
    id: 'cat-freelance',
    nombre: 'Freelance',
    tipo: TipoTransaccion.Ingreso,
    color: '#20c997',
    icono: '🧑‍💻',
  },
  {
    id: 'cat-inversiones',
    nombre: 'Inversiones',
    tipo: TipoTransaccion.Ingreso,
    color: '#0dcaf0',
    icono: '📈',
  },
  {
    id: 'cat-otros-ingresos',
    nombre: 'Otros ingresos',
    tipo: TipoTransaccion.Ingreso,
    color: '#6f42c1',
    icono: '➕',
  },
  {
    id: 'cat-alimentacion',
    nombre: 'Alimentación',
    tipo: TipoTransaccion.Gasto,
    color: '#dc3545',
    icono: '🛒',
  },
  {
    id: 'cat-transporte',
    nombre: 'Transporte',
    tipo: TipoTransaccion.Gasto,
    color: '#fd7e14',
    icono: '🚗',
  },
  {
    id: 'cat-vivienda',
    nombre: 'Vivienda',
    tipo: TipoTransaccion.Gasto,
    color: '#d39e00',
    icono: '🏠',
  },
  {
    id: 'cat-servicios',
    nombre: 'Servicios públicos',
    tipo: TipoTransaccion.Gasto,
    color: '#0d6efd',
    icono: '💡',
  },
  {
    id: 'cat-salud',
    nombre: 'Salud',
    tipo: TipoTransaccion.Gasto,
    color: '#d63384',
    icono: '🩺',
  },
  {
    id: 'cat-educacion',
    nombre: 'Educación',
    tipo: TipoTransaccion.Gasto,
    color: '#6610f2',
    icono: '🎓',
  },
  {
    id: 'cat-ocio',
    nombre: 'Ocio y entretenimiento',
    tipo: TipoTransaccion.Gasto,
    color: '#7952b3',
    icono: '🎬',
  },
  {
    id: 'cat-compras',
    nombre: 'Compras',
    tipo: TipoTransaccion.Gasto,
    color: '#6c757d',
    icono: '🛍️',
  },
  {
    id: 'cat-otros-gastos',
    nombre: 'Otros gastos',
    tipo: TipoTransaccion.Gasto,
    color: '#343a40',
    icono: '📦',
  },
];

interface SemillaTransaccion {
  /** Días transcurridos desde hoy. */
  diasAtras: number;
  monto: number;
  tipo: TipoTransaccionType;
  descripcion: string;
  categoriaId: string;
  metodoPago: MetodoPago;
}

const TRANSACCIONES_SEMILLA: SemillaTransaccion[] = [
  // Ingresos: salario, freelance, inversiones y extras.
  { diasAtras: 2, monto: 950000, tipo: TipoTransaccion.Ingreso, descripcion: 'Salario del mes', categoriaId: 'cat-salario', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 32, monto: 950000, tipo: TipoTransaccion.Ingreso, descripcion: 'Salario del mes anterior', categoriaId: 'cat-salario', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 62, monto: 950000, tipo: TipoTransaccion.Ingreso, descripcion: 'Salario de hace dos meses', categoriaId: 'cat-salario', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 9, monto: 180000, tipo: TipoTransaccion.Ingreso, descripcion: 'Diseño de logo para cliente', categoriaId: 'cat-freelance', metodoPago: MetodoPago.Sinpe },
  { diasAtras: 38, monto: 250000, tipo: TipoTransaccion.Ingreso, descripcion: 'Mantenimiento de sitio web', categoriaId: 'cat-freelance', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 68, monto: 320000, tipo: TipoTransaccion.Ingreso, descripcion: 'Consultoría contable', categoriaId: 'cat-freelance', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 16, monto: 45000, tipo: TipoTransaccion.Ingreso, descripcion: 'Rendimiento de inversión', categoriaId: 'cat-inversiones', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 46, monto: 38000, tipo: TipoTransaccion.Ingreso, descripcion: 'Dividendos trimestrales', categoriaId: 'cat-inversiones', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 24, monto: 25000, tipo: TipoTransaccion.Ingreso, descripcion: 'Venta de artículos usados', categoriaId: 'cat-otros-ingresos', metodoPago: MetodoPago.Efectivo },

  // Gastos recurrentes.
  { diasAtras: 1, monto: 28500, tipo: TipoTransaccion.Gasto, descripcion: 'Supermercado semanal', categoriaId: 'cat-alimentacion', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 6, monto: 15300, tipo: TipoTransaccion.Gasto, descripcion: 'Feria del agricultor', categoriaId: 'cat-alimentacion', metodoPago: MetodoPago.Efectivo },
  { diasAtras: 12, monto: 32400, tipo: TipoTransaccion.Gasto, descripcion: 'Supermercado quincenal', categoriaId: 'cat-alimentacion', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 20, monto: 12800, tipo: TipoTransaccion.Gasto, descripcion: 'Almuerzo en restaurante', categoriaId: 'cat-alimentacion', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 35, monto: 41500, tipo: TipoTransaccion.Gasto, descripcion: 'Supermercado mensual', categoriaId: 'cat-alimentacion', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 55, monto: 38900, tipo: TipoTransaccion.Gasto, descripcion: 'Supermercado mensual', categoriaId: 'cat-alimentacion', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 75, monto: 36200, tipo: TipoTransaccion.Gasto, descripcion: 'Supermercado mensual', categoriaId: 'cat-alimentacion', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 3, monto: 18000, tipo: TipoTransaccion.Gasto, descripcion: 'Recarga de combustible', categoriaId: 'cat-transporte', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 10, monto: 4500, tipo: TipoTransaccion.Gasto, descripcion: 'Pasajes de bus', categoriaId: 'cat-transporte', metodoPago: MetodoPago.Efectivo },
  { diasAtras: 28, monto: 22000, tipo: TipoTransaccion.Gasto, descripcion: 'Mantenimiento del vehículo', categoriaId: 'cat-transporte', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 50, monto: 19500, tipo: TipoTransaccion.Gasto, descripcion: 'Recarga de combustible', categoriaId: 'cat-transporte', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 80, monto: 21000, tipo: TipoTransaccion.Gasto, descripcion: 'Recarga de combustible', categoriaId: 'cat-transporte', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 4, monto: 280000, tipo: TipoTransaccion.Gasto, descripcion: 'Alquiler del mes', categoriaId: 'cat-vivienda', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 34, monto: 280000, tipo: TipoTransaccion.Gasto, descripcion: 'Alquiler del mes anterior', categoriaId: 'cat-vivienda', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 64, monto: 280000, tipo: TipoTransaccion.Gasto, descripcion: 'Alquiler de hace dos meses', categoriaId: 'cat-vivienda', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 5, monto: 42000, tipo: TipoTransaccion.Gasto, descripcion: 'Electricidad', categoriaId: 'cat-servicios', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 5, monto: 22000, tipo: TipoTransaccion.Gasto, descripcion: 'Internet del hogar', categoriaId: 'cat-servicios', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 7, monto: 9800, tipo: TipoTransaccion.Gasto, descripcion: 'Agua potable', categoriaId: 'cat-servicios', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 33, monto: 45000, tipo: TipoTransaccion.Gasto, descripcion: 'Electricidad', categoriaId: 'cat-servicios', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 63, monto: 39500, tipo: TipoTransaccion.Gasto, descripcion: 'Electricidad', categoriaId: 'cat-servicios', metodoPago: MetodoPago.Transferencia },

  // Gastos variables.
  { diasAtras: 14, monto: 26000, tipo: TipoTransaccion.Gasto, descripcion: 'Consulta médica', categoriaId: 'cat-salud', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 44, monto: 18500, tipo: TipoTransaccion.Gasto, descripcion: 'Medicamentos', categoriaId: 'cat-salud', metodoPago: MetodoPago.Efectivo },
  { diasAtras: 8, monto: 60000, tipo: TipoTransaccion.Gasto, descripcion: 'Matrícula de curso', categoriaId: 'cat-educacion', metodoPago: MetodoPago.Transferencia },
  { diasAtras: 11, monto: 22000, tipo: TipoTransaccion.Gasto, descripcion: 'Cine y cena', categoriaId: 'cat-ocio', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 27, monto: 15000, tipo: TipoTransaccion.Gasto, descripcion: 'Suscripción de streaming', categoriaId: 'cat-ocio', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 57, monto: 15000, tipo: TipoTransaccion.Gasto, descripcion: 'Suscripción de streaming', categoriaId: 'cat-ocio', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 18, monto: 48000, tipo: TipoTransaccion.Gasto, descripcion: 'Zapatos y ropa', categoriaId: 'cat-compras', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 48, monto: 32000, tipo: TipoTransaccion.Gasto, descripcion: 'Accesorios para computadora', categoriaId: 'cat-compras', metodoPago: MetodoPago.Tarjeta },
  { diasAtras: 22, monto: 9500, tipo: TipoTransaccion.Gasto, descripcion: 'Regalo de cumpleaños', categoriaId: 'cat-otros-gastos', metodoPago: MetodoPago.Efectivo },
  { diasAtras: 40, monto: 12000, tipo: TipoTransaccion.Gasto, descripcion: 'Lavandería', categoriaId: 'cat-otros-gastos', metodoPago: MetodoPago.Efectivo },
];

/** Fecha local AAAA-MM-DD de hace N días. */
function fechaHaceDias(dias: number): string {
  const fecha = new Date();
  fecha.setHours(12, 0, 0, 0);
  fecha.setDate(fecha.getDate() - dias);
  return aFechaISO(fecha);
}

/** Usuario de demostración (reemplazable por Supabase Auth). */
export function crearUsuarioSemilla(): Usuario {
  return new Usuario({
    id: 'usr-demo',
    nombre: 'Ana Rodríguez Solís',
    correo: 'ana.rodriguez@correo.cr',
    moneda: 'CRC',
    creadoEn: '2026-01-05T14:00:00.000Z',
  });
}

/** Categorías iniciales de ingresos y gastos. */
export function crearCategoriasSemilla(): Categoria[] {
  return CATEGORIAS_SEMILLA.map((categoria) => new Categoria(categoria));
}

/** Transacciones de demostración repartidas en los últimos tres meses. */
export function crearTransaccionesSemilla(): Transaccion[] {
  return TRANSACCIONES_SEMILLA.map((semilla, indice) => {
    const fecha = fechaHaceDias(semilla.diasAtras);

    return new Transaccion({
      id: `trx-seed-${String(indice + 1).padStart(3, '0')}`,
      monto: semilla.monto,
      tipo: semilla.tipo,
      fecha,
      descripcion: semilla.descripcion,
      categoriaId: semilla.categoriaId,
      metodoPago: semilla.metodoPago,
      creadoEn: new Date(`${fecha}T12:00:00`).toISOString(),
    });
  });
}
