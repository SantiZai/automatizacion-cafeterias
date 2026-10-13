import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * QR rotativo del mostrador.
 * Formato: {cafeId}.{locationId}.{ventana}.{firma}
 * - La ventana cambia cada QR_TTL_SECONDS, así una foto del QR deja de servir.
 * - La firma es HMAC-SHA256 con un secreto del servidor.
 * - Se acepta la ventana actual y la anterior (margen para escaneos en el cambio).
 */

export const QR_TTL_SECONDS = 60;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type QrPayload = { cafeId: string; locationId: string };

export type QrVerification =
  | ({ valid: true } & QrPayload)
  | { valid: false; reason: "malformed" | "expired" | "bad_signature" };

function assertSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("QR_SIGNING_SECRET debe tener al menos 32 caracteres");
  }
}

function windowOf(now: Date, ttlSeconds: number) {
  return Math.floor(now.getTime() / 1000 / ttlSeconds);
}

function sign(secret: string, payload: QrPayload, window: number) {
  return createHmac("sha256", secret)
    .update(`${payload.cafeId}.${payload.locationId}.${window}`)
    .digest("base64url");
}

export function createQrToken(
  payload: QrPayload,
  secret: string,
  now: Date = new Date(),
  ttlSeconds: number = QR_TTL_SECONDS,
): string {
  assertSecret(secret);
  if (!ID_PATTERN.test(payload.cafeId) || !ID_PATTERN.test(payload.locationId)) {
    throw new Error("Identificadores inválidos para el QR");
  }
  const window = windowOf(now, ttlSeconds);
  return `${payload.cafeId}.${payload.locationId}.${window}.${sign(secret, payload, window)}`;
}

export function verifyQrToken(
  token: string,
  secret: string,
  now: Date = new Date(),
  ttlSeconds: number = QR_TTL_SECONDS,
): QrVerification {
  assertSecret(secret);

  const parts = token.split(".");
  if (parts.length !== 4) return { valid: false, reason: "malformed" };

  const [cafeId, locationId, windowRaw, signature] = parts;
  if (!ID_PATTERN.test(cafeId) || !ID_PATTERN.test(locationId)) {
    return { valid: false, reason: "malformed" };
  }
  if (!/^\d{1,12}$/.test(windowRaw)) return { valid: false, reason: "malformed" };

  const window = Number(windowRaw);
  const current = windowOf(now, ttlSeconds);

  // Firma primero: no revelamos si la ventana era válida con una firma falsa
  const expected = Buffer.from(sign(secret, { cafeId, locationId }, window));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { valid: false, reason: "bad_signature" };
  }

  if (window > current || window < current - 1) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, cafeId, locationId };
}
