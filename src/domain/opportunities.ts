/**
 * Motor de oportunidades (puro, testeado).
 * Detecta momentos para invitar a volver: ausencia, premio cercano y cumpleaños.
 * La persistencia (sin duplicados por período) vive en `lib/data/opportunities`.
 */

export type OpportunityKind = "absence" | "near_reward" | "birthday";
export type OpportunityStatus = "open" | "sent" | "dismissed";

export const ABSENCE_THRESHOLD_DAYS = 14;
export const NEAR_REWARD_THRESHOLD = 2;

export function opportunityDocId(
  customerId: string,
  kind: OpportunityKind,
  periodKey: string,
): string {
  return `${customerId}_${kind}_${periodKey}`;
}

/** Días completos entre dos fechas (siempre >= 0). */
export function daysBetween(from: Date, to: Date): number {
  return Math.max(
    0,
    Math.floor((to.getTime() - from.getTime()) / 86_400_000),
  );
}

export function detectAbsence(input: {
  lastVisitAt: Date | null;
  visitCount: number;
  status: string;
  now: Date;
  thresholdDays?: number;
}): { absent: boolean; daysSince: number | null } {
  const threshold = input.thresholdDays ?? ABSENCE_THRESHOLD_DAYS;
  if (input.status !== "active") return { absent: false, daysSince: null };
  if (!input.lastVisitAt || input.visitCount < 2) {
    return { absent: false, daysSince: null };
  }
  const daysSince = daysBetween(input.lastVisitAt, input.now);
  return { absent: daysSince >= threshold, daysSince };
}

export function detectNearReward(input: {
  stamps: number;
  required: number;
  threshold?: number;
}): { near: boolean; remaining: number } {
  const threshold = input.threshold ?? NEAR_REWARD_THRESHOLD;
  const remaining = Math.max(input.required - Math.max(input.stamps, 0), 0);
  return {
    near: remaining > 0 && remaining <= threshold,
    remaining,
  };
}

/** Cumpleaños en formato ISO (YYYY-MM-DD) o MM-DD. Compara mes/día en la zona del café. */
export function detectBirthday(input: {
  birthday: string | null | undefined;
  now: Date;
  timeZone: string;
}): boolean {
  if (!input.birthday) return false;
  const trimmed = input.birthday.trim();
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed) ?? /^(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return false;
  const monthDay =
    match.length === 4 ? `${match[2]}-${match[3]}` : `${match[1]}-${match[2]}`;

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: input.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(input.now);
  // "en-CA" devuelve YYYY-MM-DD; nos quedamos con MM-DD
  return today.slice(5) === monthDay;
}

export function buildOpportunityMessage(input: {
  kind: OpportunityKind;
  customerName: string;
  cafeName: string;
  rewardName?: string;
  remaining?: number;
  daysSince?: number | null;
}): string {
  const firstName = input.customerName.split(" ")[0] || input.customerName;
  switch (input.kind) {
    case "absence": {
      const days = input.daysSince ?? ABSENCE_THRESHOLD_DAYS;
      return (
        `Hola, ${firstName}. Hace ${days} días que no te vemos por ${input.cafeName} ` +
        `y se te extraña. Si te dan ganas de pasar, te esperamos como siempre.`
      );
    }
    case "near_reward":
      return (
        `Hola, ${firstName}. Te faltan ${input.remaining ?? 1} sellos para ` +
        `${input.rewardName ?? "tu premio"} en ${input.cafeName}. Pasá cuando quieras y lo sumamos.`
      );
    case "birthday":
      return (
        `Hola, ${firstName}. ¡Feliz cumpleaños! Te desea el equipo de ${input.cafeName}. ` +
        `Pasá a festejar que te espera algo rico.`
      );
  }
}
