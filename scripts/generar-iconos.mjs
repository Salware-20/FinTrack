import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

/**
 * Genera los iconos PNG de la PWA sin dependencias externas.
 *
 * Dibuja un cuadrado redondeado azul con tres barras blancas ascendentes
 * (barras de un gráfico) y lo escribe como PNG RGBA usando `node:zlib`.
 * Se ejecuta manualmente cuando haga falta regenerarlos:
 *
 *   node scripts/generar-iconos.mjs
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'public');

const AZUL = [13, 110, 253]; // #0d6efd, mismo theme_color del manifiesto
const BLANCO = [255, 255, 255];

// Diseño en un lienzo lógico de 512 x 512; se escala a cada tamaño final.
const DISENO = 512;
const BARRAS = [
  { x0: 138, y0: 294, x1: 196, y1: 394, r: 20 },
  { x0: 226, y0: 236, x1: 284, y1: 394, r: 20 },
  { x0: 314, y0: 172, x1: 372, y1: 394, r: 20 },
];
const BASE = { x0: 120, y0: 400, x1: 392, y1: 412, r: 6 };

/** Verdadero si el punto cae dentro de un rectángulo de esquinas redondeadas. */
function dentroRedondeado(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;

  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Color RGBA de un punto del diseño original (coordenadas 0–512). */
function colorEn(x, y) {
  if (!dentroRedondeado(x, y, 0, 0, DISENO, DISENO, 112)) {
    return [0, 0, 0, 0];
  }

  const enBarra = BARRAS.some((barra) =>
    dentroRedondeado(x, y, barra.x0, barra.y0, barra.x1, barra.y1, barra.r),
  );
  const enBase = dentroRedondeado(
    x,
    y,
    BASE.x0,
    BASE.y0,
    BASE.x1,
    BASE.y1,
    BASE.r,
  );

  return [...(enBarra || enBase ? BLANCO : AZUL), 255];
}

/** Rasteriza el icono con supermuestreo 4x para bordes suaves. */
function rasterizar(tamano) {
  const muestras = 4;
  const grande = tamano * muestras;
  const pixeles = Buffer.alloc(tamano * tamano * 4);

  for (let py = 0; py < tamano; py += 1) {
    for (let px = 0; px < tamano; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let alfa = 0;

      for (let sy = 0; sy < muestras; sy += 1) {
        for (let sx = 0; sx < muestras; sx += 1) {
          const x = ((px * muestras + sx + 0.5) / grande) * DISENO;
          const y = ((py * muestras + sy + 0.5) / grande) * DISENO;
          const [cr, cg, cb, ca] = colorEn(x, y);
          const factor = ca / 255;

          r += cr * factor;
          g += cg * factor;
          b += cb * factor;
          alfa += factor;
        }
      }

      const total = muestras * muestras;
      const indice = (py * tamano + px) * 4;
      pixeles[indice] = alfa > 0 ? Math.round(r / alfa) : 0;
      pixeles[indice + 1] = alfa > 0 ? Math.round(g / alfa) : 0;
      pixeles[indice + 2] = alfa > 0 ? Math.round(b / alfa) : 0;
      pixeles[indice + 3] = Math.round((alfa / total) * 255);
    }
  }

  return pixeles;
}

const TABLA_CRC = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  TABLA_CRC[n] = c >>> 0;
}

function crc32(datos) {
  let c = 0xffffffff;
  for (const byte of datos) {
    c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);

  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));

  return Buffer.concat([largo, cuerpo, crc]);
}

function crearPng(tamano, pixeles) {
  const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamano, 0);
  ihdr.writeUInt32BE(tamano, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compresión deflate
  ihdr[11] = 0; // filtro adaptativo por scanline
  ihdr[12] = 0; // sin entrelazado

  const filas = Buffer.alloc(tamano * (tamano * 4 + 1));
  for (let y = 0; y < tamano; y += 1) {
    const destino = y * (tamano * 4 + 1);
    filas[destino] = 0; // filtro "None"
    pixeles.copy(filas, destino + 1, y * tamano * 4, (y + 1) * tamano * 4);
  }

  return Buffer.concat([
    firma,
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(filas, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(SALIDA, { recursive: true });

for (const tamano of [192, 512]) {
  const archivo = join(SALIDA, `pwa-${tamano}x${tamano}.png`);
  const png = crearPng(tamano, rasterizar(tamano));
  writeFileSync(archivo, png);
  console.log(`Generado ${archivo} (${png.length} bytes)`);
}
