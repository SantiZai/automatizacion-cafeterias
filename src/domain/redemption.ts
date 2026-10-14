import { randomInt } from "node:crypto";

/**
 * Códigos de canje: cortos para dictarlos en el mostrador, de un solo uso
 * y con vencimiento de 2 minutos (flujo 10.4 del plan).
 * Son opacos y aleatorios: la validez vive en Firestore, no en el código.
 */

export const REDEMPTION_TTL_SECONDS = 120;
export const REDEMPTION_CODE_LENGTH = 6;

// Sin caracteres confusos (0/O, 1/I).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRedemptionCode(): string {
  let code = "";
  for (let i = 0; i < REDEMPTION_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Normaliza lo que escribe el staff: mayúsculas, sin espacios ni guiones. */
export function normalizeRedemptionCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-]/g, "");
}

export function isValidRedemptionCode(code: string): boolean {
  return (
    code.length === REDEMPTION_CODE_LENGTH &&
    [...code].every((ch) => ALPHABET.includes(ch))
  );
}

/** Presenta el código en dos grupos (ABC-DEF) para leerlo en voz alta. */
export function formatRedemptionCode(code: string): string {
  return code.length === REDEMPTION_CODE_LENGTH
    ? `${code.slice(0, 3)}-${code.slice(3)}`
    : code;
}

export function redemptionExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + REDEMPTION_TTL_SECONDS * 1000);
}

export function isRedemptionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}
