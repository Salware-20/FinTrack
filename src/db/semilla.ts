import { CONFIG_APP } from '../config/app';
import type { DatosCategoria } from '../models/Categoria';
import type { DatosCuenta } from '../models/Cuenta';
import { TipoCuenta } from '../models/tipos';
import type { TipoTransaccion } from '../models/tipos';
import type { RegistroConfiguracion } from './baseDatos';

/**
 * Datos iniciales que recibe cada usuario al registrarse.
 *
 * Las categorÃ­as estÃ¡n pensadas para el caso del cliente: salario,
 * outsourcing por SINPE y efectivo, servicios del hogar, suscripciones,
 * alimentaciÃ³n (supermercado, minisÃºper, cafeterÃ­a, restaurante, express)
 * y transporte (Didi/Uber, gasolina).
 */

interface DefinicionCategoria {
  clave: string;
  nombre: string;
  tipo: TipoTransaccion;
  icono: string;
  color: string;
  padre?: string;
}

const DEFINICIONES: DefinicionCategoria[] = [
  // Ingresos
  { clave: 'salario', nombre: 'Salario', tipo: 'ingreso', icono: 'ðŸ’¼', color: '#198754' },
  { clave: 'outsourcing', nombre: 'Outsourcing', tipo: 'ingreso', icono: 'ðŸ§‘â€ðŸ’»', color: '#20c997' },
  { clave: 'outsourcing-sinpe', nombre: 'SINPE MÃ³vil', tipo: 'ingreso', icono: 'ðŸ“²', color: '#20c997', padre: 'outsourcing' },
  { clave: 'outsourcing-efectivo', nombre: 'Efectivo', tipo: 'ingreso', icono: 'ðŸ’µ', color: '#20c997', padre: 'outsourcing' },
  { clave: 'inversiones', nombre: 'Inversiones', tipo: 'ingreso', icono: 'ðŸ“ˆ', color: '#0dcaf0' },
  { clave: 'otros-ingresos', nombre: 'Otros ingresos', tipo: 'ingreso', icono: 'âž•', color: '#6f42c1' },

  // Gastos: servicios del hogar
  { clave: 'servicios', nombre: 'Servicios', tipo: 'gasto', icono: 'ðŸ’¡', color: '#0d6efd' },
  { clave: 'luz', nombre: 'Luz', tipo: 'gasto', icono: 'ðŸ”Œ', color: '#0d6efd', padre: 'servicios' },
  { clave: 'agua', nombre: 'Agua', tipo: 'gasto', icono: 'ðŸš¿', color: '#0d6efd', padre: 'servicios' },
  { clave: 'celular', nombre: 'Celular', tipo: 'gasto', icono: 'ðŸ“±', color: '#0d6efd', padre: 'servicios' },
  { clave: 'cable', nombre: 'Cable', tipo: 'gasto', icono: 'ðŸ“º', color: '#0d6efd', padre: 'servicios' },
  { clave: 'internet', nombre: 'Internet', tipo: 'gasto', icono: 'ðŸŒ', color: '#0d6efd', padre: 'servicios' },

  // Gastos: suscripciones
  { clave: 'suscripciones', nombre: 'Suscripciones', tipo: 'gasto', icono: 'ðŸ”', color: '#6610f2' },
  { clave: 'streaming', nombre: 'Streaming', tipo: 'gasto', icono: 'ðŸŽ¬', color: '#6610f2', padre: 'suscripciones' },
  { clave: 'software', nombre: 'Software', tipo: 'gasto', icono: 'ðŸ’»', color: '#6610f2', padre: 'suscripciones' },

  // Gastos: alimentaciÃ³n
  { clave: 'alimentacion', nombre: 'AlimentaciÃ³n', tipo: 'gasto', icono: 'ðŸ½ï¸', color: '#dc3545' },
  { clave: 'supermercado', nombre: 'Supermercado', tipo: 'gasto', icono: 'ðŸ›’', color: '#dc3545', padre: 'alimentacion' },
  { clave: 'minisuper', nombre: 'MinisÃºper', tipo: 'gasto', icono: 'ðŸª', color: '#dc3545', padre: 'alimentacion' },
  { clave: 'cafeteria', nombre: 'CafeterÃ­a', tipo: 'gasto', icono: 'â˜•', color: '#dc3545', padre: 'alimentacion' },
  { clave: 'restaurante', nombre: 'Restaurante', tipo: 'gasto', icono: 'ðŸ´', color: '#dc3545', padre: 'alimentacion' },
  { clave: 'express', nombre: 'Servicios express', tipo: 'gasto', icono: 'ðŸ›µ', color: '#dc3545', padre: 'alimentacion' },

  // Gastos: transporte
  { clave: 'transporte', nombre: 'Transporte', tipo: 'gasto', icono: 'ðŸš—', color: '#fd7e14' },
  { clave: 'uber-didi', nombre: 'Didi / Uber', tipo: 'gasto', icono: 'ðŸš•', color: '#fd7e14', padre: 'transporte' },
  { clave: 'gasolina', nombre: 'Gasolina', tipo: 'gasto', icono: 'â›½', color: '#fd7e14', padre: 'transporte' },
  { clave: 'bus', nombre: 'Bus / Tren', tipo: 'gasto', icono: 'ðŸšŒ', color: '#fd7e14', padre: 'transporte' },
  { clave: 'mantenimiento', nombre: 'Mantenimiento', tipo: 'gasto', icono: 'ðŸ”§', color: '#fd7e14', padre: 'transporte' },

  // Gastos: otros
  { clave: 'salud', nombre: 'Salud', tipo: 'gasto', icono: 'ðŸ©º', color: '#d63384' },
  { clave: 'farmacia', nombre: 'Farmacia', tipo: 'gasto', icono: 'ðŸ’Š', color: '#d63384', padre: 'salud' },
  { clave: 'consulta', nombre: 'Consulta mÃ©dica', tipo: 'gasto', icono: 'ðŸ¥', color: '#d63384', padre: 'salud' },
  { clave: 'educacion', nombre: 'EducaciÃ³n', tipo: 'gasto', icono: 'ðŸŽ“', color: '#0b7285' },
  { clave: 'ocio', nombre: 'Ocio', tipo: 'gasto', icono: 'ðŸŽ‰', color: '#7952b3' },
  { clave: 'compras', nombre: 'Compras', tipo: 'gasto', icono: 'ðŸ›ï¸', color: '#6c757d' },
  { clave: 'mascotas', nombre: 'Mascotas', tipo: 'gasto', icono: 'ðŸ¾', color: '#b08968' },
  { clave: 'otros-gastos', nombre: 'Otros gastos', tipo: 'gasto', icono: 'ðŸ“¦', color: '#343a40' },
];

/**
 * CategorÃ­as base para un usuario reciÃ©n registrado.
 * Los ids incluyen el usuario para que sean Ãºnicos entre cuentas.
 */
export function crearCategoriasBase(usuarioId: string): DatosCategoria[] {
  const idsPorClave = new Map<string, string>();

  for (const definicion of DEFINICIONES) {
    idsPorClave.set(definicion.clave, `cat-${usuarioId}-${definicion.clave}`);
  }

  return DEFINICIONES.map((definicion) => ({
    id: idsPorClave.get(definicion.clave) as string,
    usuarioId,
    nombre: definicion.nombre,
    tipo: definicion.tipo,
    padreId: definicion.padre ? (idsPorClave.get(definicion.padre) as string) : null,
    color: definicion.color,
    icono: definicion.icono,
  }));
}

/** Cuenta de efectivo inicial para empezar a registrar de inmediato. */
export function crearCuentaInicial(usuarioId: string): DatosCuenta {
  return {
    id: `cta-${usuarioId}-efectivo`,
    usuarioId,
    nombre: 'Efectivo',
    tipo: TipoCuenta.Efectivo,
    saldoInicial: 0,
    moneda: CONFIG_APP.moneda,
    institucion: '',
    color: '#198754',
    icono: 'ðŸ’µ',
    activa: true,
    creadoEn: new Date().toISOString(),
  };
}

/** Preferencias iniciales del usuario. */
export function crearConfiguracionInicial(usuarioId: string): RegistroConfiguracion {
  return {
    usuarioId,
    moneda: CONFIG_APP.moneda,
    locale: CONFIG_APP.locale,
    tema: 'claro',
    metaAhorroMensual: 0,
  };
}
