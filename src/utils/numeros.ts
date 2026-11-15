/** Utilidades numéricas compartidas por modelos y servicios. */

/** Redondea un monto a la cantidad de decimales indicada (2 por defecto). */
export function redondearMonto(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/** Suma una lista de números redondeando el resultado. */
export function sumarMontos(valores: number[]): number {
  return redondearMonto(valores.reduce((total, valor) => total + valor, 0));
}
