import { FrecuenciaRecurrencia } from '../models/tipos';
import { aFechaISO } from './formato';

/** Datos mínimos de una regla para calcular sus ocurrencias. */
export interface ReglaRecurrente {
  frecuencia: FrecuenciaRecurrencia;
  /** Siguiente ocurrencia pendiente, AAAA-MM-DD. */
  proximaFecha: string;
  /** Día original del mes (1–31); solo se usa en frecuencias mensuales. */
  diaAncla: number;
  /** Última fecha permitida; `null` o vacío significa sin fin. */
  fechaFin?: string | null;
}

/** Resultado de planificar una regla hasta una fecha límite. */
export interface PlanOcurrencias {
  /** Fechas reales que deben generar una transacción, en orden ascendente. */
  fechas: string[];
  /** Siguiente ocurrencia después de la última planificada. */
  proximaFecha: string;
}

/** Cantidad de días que tiene un mes (1–12), sin depender de la zona horaria. */
function diasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

/**
 * Calcula la ocurrencia siguiente a una fecha.
 *
 * En frecuencias mensuales se usa el día de anclaje recortado al último día
 * del mes destino: 31 de enero → 28 de febrero → 31 de marzo. Así la serie no
 * se desplaza cuando un mes es más corto.
 */
export function siguienteOcurrencia(
  frecuencia: FrecuenciaRecurrencia,
  fecha: string,
  diaAncla: number = Number(fecha.slice(8, 10)),
): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);

  if (frecuencia === FrecuenciaRecurrencia.Diaria) {
    return aFechaISO(new Date(anio, mes - 1, dia + 1));
  }

  if (frecuencia === FrecuenciaRecurrencia.Semanal) {
    return aFechaISO(new Date(anio, mes - 1, dia + 7));
  }

  const siguienteMes = mes === 12 ? 1 : mes + 1;
  const siguienteAnio = mes === 12 ? anio + 1 : anio;
  const diaRecortado = Math.min(
    Math.max(diaAncla, 1),
    diasDelMes(siguienteAnio, siguienteMes),
  );

  return aFechaISO(new Date(siguienteAnio, siguienteMes - 1, diaRecortado));
}

/**
 * Enumera las ocurrencias vencidas de una regla hasta `limite` inclusive.
 *
 * Nunca devuelve fechas posteriores al límite ni a la fecha final de la regla.
 * El tope de seguridad evita bloquear la interfaz con reglas muy antiguas.
 */
export function planificarOcurrencias(
  regla: ReglaRecurrente,
  limite: string,
): PlanOcurrencias {
  const fechas: string[] = [];
  const fechaFin = regla.fechaFin ?? null;
  let actual = regla.proximaFecha;

  while (actual <= limite && (fechaFin === null || actual <= fechaFin)) {
    fechas.push(actual);
    actual = siguienteOcurrencia(regla.frecuencia, actual, regla.diaAncla);

    if (fechas.length >= 10_000) break;
  }

  return { fechas, proximaFecha: actual };
}
