import { CONFIG_APP } from '../config/app';

/**
 * Utilidades criptográficas basadas en Web Crypto (sin dependencias).
 *
 * Las contraseñas y los códigos de recuperación NUNCA se guardan en claro:
 * se almacena un hash PBKDF2-SHA256 con sal aleatoria por credencial.
 */

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codificador = new TextEncoder();

function bytesABase64(bytes: Uint8Array): string {
  let binario = '';
  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }
  return btoa(binario);
}

function base64ABytes(texto: string): Uint8Array<ArrayBuffer> {
  const binario = atob(texto);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }
  return bytes;
}

/** Genera una sal aleatoria codificada en base64. */
export function generarSal(longitudBytes = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(longitudBytes));
  return bytesABase64(bytes);
}

/** Deriva el hash PBKDF2-SHA256 de un secreto con la sal indicada. */
export async function derivarHash(secreto: string, salBase64: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    codificador.encode(secreto),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ABytes(salBase64),
      iterations: CONFIG_APP.iteracionesHash,
      hash: 'SHA-256',
    },
    material,
    256,
  );

  return bytesABase64(new Uint8Array(bits));
}

/** Compara dos cadenas en tiempo constante para evitar filtraciones por tiempo. */
function igualdadConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diferencia = 0;
  for (let indice = 0; indice < a.length; indice += 1) {
    diferencia |= a.charCodeAt(indice) ^ b.charCodeAt(indice);
  }
  return diferencia === 0;
}

/** Verifica un secreto contra el hash y la sal guardados. */
export async function verificarHash(
  secreto: string,
  salBase64: string,
  hashGuardado: string,
): Promise<boolean> {
  const hashCalculado = await derivarHash(secreto, salBase64);
  return igualdadConstante(hashCalculado, hashGuardado);
}

/** Normaliza el código de recuperación: mayúsculas y sin guiones ni espacios. */
export function normalizarCodigoRecuperacion(codigo: string): string {
  return codigo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Genera un código de recuperación legible de 12 caracteres.
 * Se muestra agrupado como XXXX-XXXX-XXXX.
 */
export function generarCodigoRecuperacion(): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(CONFIG_APP.longitudCodigoRecuperacion),
  );
  let codigo = '';

  for (const byte of bytes) {
    codigo += ALFABETO_CODIGO[byte % ALFABETO_CODIGO.length];
  }

  return formatearCodigoRecuperacion(codigo);
}

/** Agrupa un código en bloques de cuatro caracteres. */
export function formatearCodigoRecuperacion(codigo: string): string {
  const limpio = normalizarCodigoRecuperacion(codigo);
  return limpio.match(/.{1,4}/g)?.join('-') ?? limpio;
}

/** Lleva un correo a su forma canónica: minúsculas y sin espacios. */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}
