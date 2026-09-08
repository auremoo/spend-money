// spend-money — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
//
// Chiffrement au repos des données (AES-GCM 256 + PBKDF2-SHA256).
// Rien ici ne quitte le navigateur : la passphrase n'est jamais envoyée
// à GitHub ni écrite dans le dépôt.

const KDF_ITERATIONS = 250000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function bytesToB64(bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// base64 <-> texte UTF-8 (utilisé pour l'API GitHub et pour les liens)
export function utf8ToB64(str) {
  return bytesToB64(enc.encode(str));
}

export function b64ToUtf8(b64) {
  return dec.decode(b64ToBytes(b64));
}

async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Chiffre un objet JSON. Renvoie une enveloppe sérialisable. */
export async function encryptJSON(obj, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(obj))
  );
  return {
    alg: 'AES-GCM-256',
    kdf: { name: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS, salt: bytesToB64(salt) },
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(ct)
  };
}

/** Déchiffre une enveloppe produite par encryptJSON. */
export async function decryptJSON(envelope, passphrase) {
  const salt = b64ToBytes(envelope.kdf.salt);
  const iv = b64ToBytes(envelope.iv);
  const key = await deriveKey(passphrase, salt, envelope.kdf.iterations || KDF_ITERATIONS);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    b64ToBytes(envelope.ciphertext)
  );
  return JSON.parse(dec.decode(plain));
}
