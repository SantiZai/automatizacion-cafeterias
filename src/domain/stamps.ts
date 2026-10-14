/**
 * Reglas de negocio de los sellos. Funciones puras: sin base de datos ni red,
 * para poder probarlas fácilmente y reutilizarlas desde cualquier capa.
 */

export type StampRules = {
  /** Sellos necesarios para completar la tarjeta */
  stampsRequired: number;
  /** Intervalo mínimo entre dos sellos del mismo cliente */
  minMinutesBetweenStamps: number;
  /** Máximo de sellos por día calendario del café */
  maxStampsPerDay: number;
};

export const DEFAULT_STAMP_RULES: StampRules = {
  stampsRequired: 8,
  minMinutesBetweenStamps: 240,
  maxStampsPerDay: 1,
};

export type StampAttempt = {
  now: Date;
  /** Fecha del último sello del cliente en este programa (null si es el primero) */
  lastStampAt: Date | null;
  /** Sellos que ya sumó hoy (según la zona horaria del café) */
  stampsToday: number;
  rules: StampRules;
};

export type StampAttemptResult =
  | { ok: true }
  | { ok: false; reason: "too_soon"; retryAt: Date }
  | { ok: false; reason: "daily_limit" };

/** Decide si un cliente puede sumar un sello ahora (antifraude básico). */
export function evaluateStampAttempt(attempt: StampAttempt): StampAttemptResult {
  const { now, lastStampAt, stampsToday, rules } = attempt;

  if (stampsToday >= rules.maxStampsPerDay) {
    return { ok: false, reason: "daily_limit" };
  }

  if (lastStampAt) {
    const retryAt = new Date(
      lastStampAt.getTime() + rules.minMinutesBetweenStamps * 60_000,
    );
    if (now < retryAt) {
      return { ok: false, reason: "too_soon", retryAt };
    }
  }

  return { ok: true };
}

export type CardProgress = {
  stamps: number;
  required: number;
  remaining: number;
  complete: boolean;
  /** Le falta poco para el premio (oportunidad "premio cercano") */
  nearReward: boolean;
};

export function cardProgress(
  stamps: number,
  required: number,
  nearThreshold = 1,
): CardProgress {
  const safeStamps = Math.max(0, Math.floor(stamps));
  const remaining = Math.max(required - safeStamps, 0);
  return {
    stamps: Math.min(safeStamps, required),
    required,
    remaining,
    complete: remaining === 0,
    nearReward: remaining > 0 && remaining <= nearThreshold,
  };
}

/** Clave de día (YYYY-MM-DD) en la zona horaria del café. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Ajusta una tarjeta cuando cambia el requerido de la promo.
 * Si el cliente supera el nuevo tope, queda en el tope (lista para canjear);
 * si no, mantiene los que tenía.
 */
export function adjustStampsToRequirement(
  prevStamps: number,
  newRequired: number,
): { stamps: number; complete: boolean } {
  const stamps = Math.min(Math.max(0, Math.floor(prevStamps)), newRequired);
  return { stamps, complete: stamps >= newRequired };
}
