import type { Categoria, Cuenta } from '../models'
import { MetodoPago, TipoTransaccion } from '../models'
import { finanzasService } from '../services'
import { aFechaISO } from '../utils/formato'

/** Crea 8 movimientos de prueba en la primera cuenta. Devuelve cuántos creó. */
export async function cargarEjemplos(categorias: Categoria[], cuentas: Cuenta[]): Promise<number> {
  const gastos = categorias.filter((c) => c.tipo === TipoTransaccion.Gasto)
  const ingresos = categorias.filter((c) => c.tipo === TipoTransaccion.Ingreso)
  const cuenta = cuentas.find((c) => c.activa) ?? cuentas[0]

  if (gastos.length === 0 || ingresos.length === 0 || !cuenta) {
    throw new Error('No hay categorías o cuentas disponibles para crear ejemplos.')
  }

  const hoy = new Date()
  const fecha = (diasAtras: number) =>
    aFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), Math.max(1, hoy.getDate() - diasAtras)))
  const idPorNombre = (nombre: string, respaldo: Categoria) =>
    categorias.find((c) => c.nombre === nombre)?.id ?? respaldo.id

  const ejemplos = [
    { dias: 0, monto: 950000, tipo: TipoTransaccion.Ingreso, categoria: idPorNombre('Salario', ingresos[0]), descripcion: 'Salario del mes', metodo: MetodoPago.Transferencia },
    { dias: 1, monto: 28500, tipo: TipoTransaccion.Gasto, categoria: idPorNombre('Supermercado', gastos[0]), descripcion: 'Supermercado semanal', metodo: MetodoPago.Tarjeta },
    { dias: 2, monto: 18000, tipo: TipoTransaccion.Gasto, categoria: idPorNombre('Gasolina', gastos[0]), descripcion: 'Recarga de combustible', metodo: MetodoPago.Tarjeta },
    { dias: 3, monto: 6500, tipo: TipoTransaccion.Gasto, categoria: idPorNombre('Cafetería', gastos[0]), descripcion: 'Cafetería', metodo: MetodoPago.Efectivo },
    { dias: 4, monto: 12800, tipo: TipoTransaccion.Gasto, categoria: idPorNombre('Didi / Uber', gastos[0]), descripcion: 'Didi al trabajo', metodo: MetodoPago.Sinpe },
    { dias: 5, monto: 42000, tipo: TipoTransaccion.Gasto, categoria: idPorNombre('Luz', gastos[0]), descripcion: 'Electricidad', metodo: MetodoPago.Transferencia },
    { dias: 6, monto: 22000, tipo: TipoTransaccion.Gasto, categoria: idPorNombre('Internet', gastos[0]), descripcion: 'Internet del hogar', metodo: MetodoPago.Tarjeta },
    { dias: 8, monto: 150000, tipo: TipoTransaccion.Ingreso, categoria: idPorNombre('Outsourcing', ingresos[0]), descripcion: 'Outsourcing por SINPE', metodo: MetodoPago.Sinpe },
  ]

  for (const e of ejemplos) {
    await finanzasService.crearTransaccion({
      monto: e.monto,
      tipo: e.tipo,
      fecha: fecha(e.dias),
      descripcion: e.descripcion,
      categoriaId: e.categoria,
      cuentaId: cuenta.id,
      metodoPago: e.metodo,
    })
  }
  return ejemplos.length
}
