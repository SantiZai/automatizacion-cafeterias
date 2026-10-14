/**
 * Lógica pura del registro de visita (sin Firestore ni red).
 * El Route Handler usa estas piezas dentro de una transacción.
 */

const WINDOW_PATTERN = /^\d{1,12}$/;

/** Extrae la ventana del QR de un token {cafeId}.{locationId}.{ventana}.{firma}. */
export function qrWindowFromToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  return WINDOW_PATTERN.test(parts[2]) ? parts[2] : null;
}

/**
 * ID determinista de la visita: un cliente suma como máximo un sello por
 * ventana de QR. Reintentos con el mismo QR devuelven la visita existente
 * sin duplicar sellos (idempotencia sin índices extra).
 */
export function visitDocId(customerId: string, qrWindow: string): string {
  return `${customerId}_${qrWindow}`;
}

/** Clave de idempotencia legible para auditoría. */
export function idempotencyKeyFor(customerId: string, qrWindow: string): string {
  return visitDocId(customerId, qrWindow);
}
