/** Utilidades para descargar archivos generados en el navegador. */

/** Descarga un texto como archivo (CSV, JSON, TXT). */
export function descargarTexto(
  nombreArchivo: string,
  contenido: string,
  tipoMime = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([contenido], { type: tipoMime });
  descargarBlob(nombreArchivo, blob);
}

/** Descarga cualquier Blob con el nombre indicado. */
export function descargarBlob(nombreArchivo: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** Lee un archivo de texto del usuario (por ejemplo, un respaldo JSON). */
export function leerArchivoTexto(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result ?? ''));
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.readAsText(archivo);
  });
}

/** Nombre de archivo con la fecha de hoy: "respaldo-2026-11-15". */
export function nombreConFecha(prefijo: string, extension: string): string {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${prefijo}-${anio}-${mes}-${dia}.${extension}`;
}
