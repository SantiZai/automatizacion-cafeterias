export const SESSION_COOKIE = "__session";

// 5 días. Firebase permite entre 5 minutos y 14 días.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

/** Solo se aceptan rutas internas como destino de redirección (evita open redirect). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
