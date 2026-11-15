import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CONFIG_APP } from '../config/app';
import type { EstadoResultados, ResumenPorCategoria } from '../models/tipos';
import { formatearFecha } from './formato';

/**
 * Generación de reportes en PDF.
 *
 * Se usa texto y tablas nativas (jsPDF + AutoTable), no capturas de pantalla:
 * el resultado es nítido, seleccionable y pesa poco.
 *
 * Los montos se escriben como "CRC 1 234,56" porque la fuente estándar de
 * jsPDF no incluye el símbolo del colón (₡).
 */

function montoPdf(valor: number): string {
  return `CRC ${valor.toLocaleString(CONFIG_APP.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface OpcionesReporte {
  titulo: string;
  usuario: string;
  desde: string;
  hasta: string;
  generadoEn?: Date;
}

function crearDocumento(opciones: OpcionesReporte): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const generado = opciones.generadoEn ?? new Date();

  doc.setFillColor(33, 37, 41);
  doc.rect(0, 0, 210, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`${CONFIG_APP.nombre} · ${opciones.titulo}`, 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Reporte financiero generado localmente', 14, 18);

  doc.setTextColor(33, 37, 41);
  doc.setFontSize(9);
  doc.text(`Usuario: ${opciones.usuario}`, 14, 32);
  doc.text(
    `Periodo: ${formatearFecha(opciones.desde)} al ${formatearFecha(opciones.hasta)}`,
    14,
    37,
  );
  doc.text(
    `Generado: ${generado.toLocaleString(CONFIG_APP.locale)}`,
    14,
    42,
  );

  return doc;
}

function pieDePagina(doc: jsPDF): void {
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text(
      `Documento generado por ${CONFIG_APP.nombre}. Los datos residen en este equipo.`,
      14,
      290,
    );
    doc.text(`Página ${pagina} de ${paginas}`, 190, 290, { align: 'right' });
  }
}

/** Estado de resultados: ingresos, gastos y utilidad del periodo. */
export function generarPdfEstadoResultados(
  estado: EstadoResultados,
  usuario: string,
): jsPDF {
  const doc = crearDocumento({
    titulo: 'Estado de resultados',
    usuario,
    desde: estado.desde,
    hasta: estado.hasta,
  });

  const ingresos = estado.filas.filter((fila) => fila.tipo === 'ingreso');
  const gastos = estado.filas.filter((fila) => fila.tipo === 'gasto');

  const cuerpo: string[][] = [];
  if (ingresos.length > 0) {
    cuerpo.push(['INGRESOS', '', '']);
    for (const fila of ingresos) {
      cuerpo.push([fila.nombre, montoPdf(fila.total), '']);
    }
    cuerpo.push(['Total de ingresos', montoPdf(estado.totalIngresos), '']);
  }
  if (gastos.length > 0) {
    cuerpo.push(['GASTOS', '', '']);
    for (const fila of gastos) {
      cuerpo.push([fila.nombre, montoPdf(fila.total), '']);
    }
    cuerpo.push(['Total de gastos', montoPdf(estado.totalGastos), '']);
  }

  autoTable(doc, {
    startY: 48,
    head: [['Concepto', 'Monto', '']],
    body: cuerpo,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [13, 110, 253], textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { cellWidth: 5 } },
    didParseCell: (datos) => {
      const texto = String(datos.cell.raw ?? '');
      if (texto === 'INGRESOS' || texto === 'GASTOS') {
        datos.cell.styles.fontStyle = 'bold';
        datos.cell.styles.fillColor = [233, 236, 239];
      }
      if (texto.startsWith('Total de')) {
        datos.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } })
    .lastAutoTable?.finalY ?? 60;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Utilidad del periodo: ${montoPdf(estado.utilidad)}`, 14, finalY + 12);

  pieDePagina(doc);
  return doc;
}

/** Gastos por categoría (incluye porcentaje sobre el total de gastos). */
export function generarPdfGastosPorCategoria(
  categorias: ResumenPorCategoria[],
  desde: string,
  hasta: string,
  usuario: string,
): jsPDF {
  const doc = crearDocumento({
    titulo: 'Gastos por categoría',
    usuario,
    desde,
    hasta,
  });

  const gastos = categorias
    .filter((categoria) => categoria.tipo === 'gasto')
    .sort((a, b) => b.total - a.total);
  const total = gastos.reduce((suma, categoria) => suma + categoria.total, 0);

  autoTable(doc, {
    startY: 48,
    head: [['Categoría', 'Movimientos', 'Total', '% del gasto']],
    body: gastos.map((categoria) => [
      categoria.nombre,
      String(categoria.cantidad),
      montoPdf(categoria.total),
      `${categoria.porcentaje.toFixed(1)} %`,
    ]),
    foot: [['Total', '', montoPdf(total), '100 %']],
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [220, 53, 69], textColor: 255 },
    footStyles: { fillColor: [233, 236, 239], textColor: 33, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  });

  pieDePagina(doc);
  return doc;
}
