import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

/**
 * Genera los iconos de la PWA a partir del logotipo en pixel art.
 *
 * Lee `assets/logotipo.png` (o `src/assets/Logotipo.png`, PNG de 16 x 16)
 * sin dependencias externas: el decodificador usa `node:zlib`.
 *
 * Produce:
 *   - `public/favicon.svg`        Un `<rect>` por píxel no transparente.
 *   - `public/pwa-192x192.png`    Escalado exacto 12x (Nearest Neighbor).
 *   - `public/pwa-512x512.png`    Escalado exacto 32x (Nearest Neighbor).
 *
 * Se ejecuta manualmente cuando cambie el logotipo:
 *
 *   node scripts/generar-iconos.mjs
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'public');

const CANDIDATOS_LOGO = [
  join(RAIZ, 'assets', 'logotipo.png'),
  join(RAIZ, 'src', 'assets', 'Logotipo.png'),
];

const FACTORES_PWA = [12, 32];

const FIRMA_PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Devuelve la ruta del primer logotipo que exista. */
function rutaLogo() {
  for (const candidato of CANDIDATOS_LOGO) {
    if (existsSync(candidato)) return candidato;
  }
  throw new Error(
    `No se encontró el logotipo. Rutas buscadas:\n  ${CANDIDATOS_LOGO.join('\n  ')}`,
  );
}

/**
 * Aplica el filtro PNG a una fila de bytes, in situ.
 *
 * @param {Buffer} fila Bytes de la fila (sin el byte de filtro).
 * @param {Buffer} previa Fila anterior ya desfiltrada.
 * @param {number} filtro Tipo de filtro (0–4).
 * @param {number} bpp Bytes por píxel.
 */
function desfiltrarFila(fila, previa, filtro, bpp) {
  for (let x = 0; x < fila.length; x += 1) {
    const izquierda = x >= bpp ? fila[x - bpp] : 0;
    const arriba = previa[x];
    const arribaIzquierda = x >= bpp ? previa[x - bpp] : 0;

    switch (filtro) {
      case 0:
        break;
      case 1:
        fila[x] = (fila[x] + izquierda) & 0xff;
        break;
      case 2:
        fila[x] = (fila[x] + arriba) & 0xff;
        break;
      case 3:
        fila[x] = (fila[x] + ((izquierda + arriba) >> 1)) & 0xff;
        break;
      case 4: {
        const p = izquierda + arriba - arribaIzquierda;
        const pa = Math.abs(p - izquierda);
        const pb = Math.abs(p - arriba);
        const pc = Math.abs(p - arribaIzquierda);
        const predictor =
          pa <= pb && pa <= pc ? izquierda : pb <= pc ? arriba : arribaIzquierda;
        fila[x] = (fila[x] + predictor) & 0xff;
        break;
      }
      default:
        throw new Error(`Filtro PNG desconocido: ${filtro}`);
    }
  }
}

/**
 * Decodifica un PNG de 8 bits (color 0, 2, 3, 4 o 6, sin entrelazado)
 * y devuelve sus píxeles en RGBA.
 *
 * @param {string} ruta
 * @returns {{ ancho: number, alto: number, pixeles: Buffer }}
 */
function leerPng(ruta) {
  const datos = readFileSync(ruta);
  if (datos.length < 8 || !datos.subarray(0, 8).equals(FIRMA_PNG)) {
    throw new Error(`El archivo no es un PNG válido: ${ruta}`);
  }

  let posicion = 8;
  let cabecera = null;
  let paleta = null;
  let transparencia = null;
  const bloquesIdat = [];

  while (posicion + 8 <= datos.length) {
    const largo = datos.readUInt32BE(posicion);
    const tipo = datos.toString('ascii', posicion + 4, posicion + 8);
    const cuerpo = datos.subarray(posicion + 8, posicion + 8 + largo);
    posicion += 12 + largo;

    if (tipo === 'IHDR') {
      cabecera = {
        ancho: cuerpo.readUInt32BE(0),
        alto: cuerpo.readUInt32BE(4),
        bits: cuerpo[8],
        color: cuerpo[9],
        entrelazado: cuerpo[12],
      };
    } else if (tipo === 'PLTE') {
      paleta = cuerpo;
    } else if (tipo === 'tRNS') {
      transparencia = cuerpo;
    } else if (tipo === 'IDAT') {
      bloquesIdat.push(cuerpo);
    } else if (tipo === 'IEND') {
      break;
    }
  }

  if (!cabecera) throw new Error('El PNG no tiene cabecera IHDR');
  const { ancho, alto, bits, color, entrelazado } = cabecera;

  if (entrelazado !== 0) throw new Error('El PNG entrelazado (Adam7) no está soportado');
  if (bits !== 8) throw new Error(`Solo se admite PNG de 8 bits por canal (recibido: ${bits})`);

  const CANALES = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const canales = CANALES[color];
  if (!canales) throw new Error(`Tipo de color PNG no soportado: ${color}`);

  const crudo = inflateSync(Buffer.concat(bloquesIdat));
  const bytesFila = ancho * canales;
  const pixeles = Buffer.alloc(ancho * alto * 4);
  let previa = Buffer.alloc(bytesFila);

  for (let y = 0; y < alto; y += 1) {
    const inicio = y * (bytesFila + 1);
    const filtro = crudo[inicio];
    const fila = Buffer.from(crudo.subarray(inicio + 1, inicio + 1 + bytesFila));
    desfiltrarFila(fila, previa, filtro, canales);

    for (let x = 0; x < ancho; x += 1) {
      const i = x * canales;
      const o = (y * ancho + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 255;

      switch (color) {
        case 6:
          r = fila[i];
          g = fila[i + 1];
          b = fila[i + 2];
          a = fila[i + 3];
          break;
        case 2:
          r = fila[i];
          g = fila[i + 1];
          b = fila[i + 2];
          break;
        case 0:
          r = fila[i];
          g = fila[i];
          b = fila[i];
          break;
        case 4:
          r = fila[i];
          g = fila[i];
          b = fila[i];
          a = fila[i + 1];
          break;
        case 3: {
          const indice = fila[i];
          if (paleta && indice * 3 + 2 < paleta.length) {
            r = paleta[indice * 3];
            g = paleta[indice * 3 + 1];
            b = paleta[indice * 3 + 2];
          }
          if (transparencia && indice < transparencia.length) {
            a = transparencia[indice];
          }
          break;
        }
        default:
          break;
      }

      pixeles[o] = r;
      pixeles[o + 1] = g;
      pixeles[o + 2] = b;
      pixeles[o + 3] = a;
    }

    previa = fila;
  }

  return { ancho, alto, pixeles };
}

/** Formatea un canal de color como dos dígitos hexadecimales. */
function hexCanal(valor) {
  return valor.toString(16).padStart(2, '0');
}

/**
 * Construye el favicon SVG: un rectángulo de 1 x 1 por píxel visible.
 *
 * @param {{ ancho: number, alto: number, pixeles: Buffer }} imagen
 */
function crearFaviconSvg({ ancho, alto, pixeles }) {
  const rectangulos = [];

  for (let y = 0; y < alto; y += 1) {
    for (let x = 0; x < ancho; x += 1) {
      const i = (y * ancho + x) * 4;
      const alfa = pixeles[i + 3];
      if (alfa === 0) continue;

      const color = `#${hexCanal(pixeles[i])}${hexCanal(pixeles[i + 1])}${hexCanal(pixeles[i + 2])}`;
      const opacidad =
        alfa === 255 ? '' : ` fill-opacity="${(alfa / 255).toFixed(3)}"`;
      rectangulos.push(
        `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"${opacidad}/>`,
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" shape-rendering="crispEdges">`,
    rectangulos.join(''),
    '</svg>',
    '',
  ].join('');
}

/**
 * Amplía la imagen con Nearest Neighbor: cada píxel se repite `factor` veces.
 *
 * @param {{ ancho: number, alto: number, pixeles: Buffer }} imagen
 * @param {number} factor
 */
function ampliarNearestNeighbor({ ancho, alto, pixeles }, factor) {
  const anchoDestino = ancho * factor;
  const altoDestino = alto * factor;
  const destino = Buffer.alloc(anchoDestino * altoDestino * 4);

  for (let y = 0; y < alto; y += 1) {
    for (let x = 0; x < ancho; x += 1) {
      const origen = (y * ancho + x) * 4;
      const r = pixeles[origen];
      const g = pixeles[origen + 1];
      const b = pixeles[origen + 2];
      const a = pixeles[origen + 3];

      for (let dy = 0; dy < factor; dy += 1) {
        const fila = (y * factor + dy) * anchoDestino;
        for (let dx = 0; dx < factor; dx += 1) {
          const o = (fila + x * factor + dx) * 4;
          destino[o] = r;
          destino[o + 1] = g;
          destino[o + 2] = b;
          destino[o + 3] = a;
        }
      }
    }
  }

  return { ancho: anchoDestino, alto: altoDestino, pixeles: destino };
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
    FIRMA_PNG,
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(filas, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

const logo = leerPng(rutaLogo());
if (logo.ancho !== logo.alto) {
  throw new Error(`El logotipo debe ser cuadrado (recibido: ${logo.ancho} x ${logo.alto})`);
}

mkdirSync(SALIDA, { recursive: true });

const svg = crearFaviconSvg(logo);
const archivoSvg = join(SALIDA, 'favicon.svg');
writeFileSync(archivoSvg, svg);
console.log(`Generado ${archivoSvg} (${svg.length} bytes)`);

for (const factor of FACTORES_PWA) {
  const lado = logo.ancho * factor;
  const escalado = ampliarNearestNeighbor(logo, factor);
  const archivo = join(SALIDA, `pwa-${lado}x${lado}.png`);
  const png = crearPng(lado, escalado.pixeles);
  writeFileSync(archivo, png);
  console.log(`Generado ${archivo} (${png.length} bytes)`);
}
