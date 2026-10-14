/**
 * Sellos extra por reseña / historia (puro, testeado).
 * El staff aprueba en el mostrador: esa aprobación es la verificación.
 */

export type ClaimKind = "google_review" | "instagram_story";
export type ClaimStatus = "pending" | "approved" | "rejected";

export const REVIEW_STAMPS = 2;
export const STORY_STAMPS = 1;
/** Un premio por tipo cada X días por cliente (antifraude). */
export const CLAIM_COOLDOWN_DAYS = 30;

export function awardFor(kind: ClaimKind): number {
  return kind === "google_review" ? REVIEW_STAMPS : STORY_STAMPS;
}

export function isValidClaimKind(value: unknown): value is ClaimKind {
  return value === "google_review" || value === "instagram_story";
}

/** Suma el bonus topando en el requerido (nunca lo pasa). */
export function applyBonusStamps(input: {
  prevStamps: number;
  required: number;
  award: number;
}): { newStamps: number; awarded: number; complete: boolean } {
  const safePrev = Math.max(0, Math.floor(input.prevStamps));
  const newStamps = Math.min(safePrev + Math.max(input.award, 0), input.required);
  return {
    newStamps,
    awarded: newStamps - safePrev,
    complete: newStamps >= input.required,
  };
}

/** ¿Hay un aprobado reciente que bloquee un reclamo nuevo? */
export function isCooldownActive(input: {
  lastApprovedAt: Date | null;
  now: Date;
  cooldownDays?: number;
}): { active: boolean; retryAt: Date | null } {
  if (!input.lastApprovedAt) return { active: false, retryAt: null };
  const cooldown = input.cooldownDays ?? CLAIM_COOLDOWN_DAYS;
  const retryAt = new Date(
    input.lastApprovedAt.getTime() + cooldown * 86_400_000,
  );
  return input.now < retryAt
    ? { active: true, retryAt }
    : { active: false, retryAt: null };
}
