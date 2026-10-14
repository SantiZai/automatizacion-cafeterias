import { describe, expect, it } from "vitest";

import {
  CLAIM_COOLDOWN_DAYS,
  applyBonusStamps,
  awardFor,
  isCooldownActive,
  isValidClaimKind,
} from "./engagement";

const now = new Date("2026-10-14T15:00:00Z");

describe("sellos extra", () => {
  it("premia reseña con 2 e historia con 1", () => {
    expect(awardFor("google_review")).toBe(2);
    expect(awardFor("instagram_story")).toBe(1);
  });

  it("valida el tipo de reclamo", () => {
    expect(isValidClaimKind("google_review")).toBe(true);
    expect(isValidClaimKind("instagram_story")).toBe(true);
    expect(isValidClaimKind("otro")).toBe(false);
  });

  it("topa el bonus en el requerido", () => {
    expect(applyBonusStamps({ prevStamps: 6, required: 8, award: 2 })).toEqual({
      newStamps: 8,
      awarded: 2,
      complete: true,
    });
    // Si falta 1 y el premio es de 2, solo suma 1
    expect(applyBonusStamps({ prevStamps: 7, required: 8, award: 2 })).toEqual({
      newStamps: 8,
      awarded: 1,
      complete: true,
    });
    expect(applyBonusStamps({ prevStamps: 3, required: 8, award: 1 })).toEqual({
      newStamps: 4,
      awarded: 1,
      complete: false,
    });
  });

  it("bloquea un segundo premio dentro del cooldown", () => {
    const recent = new Date(now.getTime() - 5 * 86_400_000);
    expect(
      isCooldownActive({ lastApprovedAt: recent, now }).active,
    ).toBe(true);
  });

  it("libera después del cooldown", () => {
    const old = new Date(
      now.getTime() - (CLAIM_COOLDOWN_DAYS + 1) * 86_400_000,
    );
    expect(isCooldownActive({ lastApprovedAt: old, now }).active).toBe(false);
    expect(isCooldownActive({ lastApprovedAt: null, now }).active).toBe(false);
  });
});
