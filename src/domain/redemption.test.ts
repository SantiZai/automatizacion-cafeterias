import { describe, expect, it } from "vitest";

import {
  REDEMPTION_CODE_LENGTH,
  formatRedemptionCode,
  generateRedemptionCode,
  isRedemptionExpired,
  isValidRedemptionCode,
  normalizeRedemptionCode,
  redemptionExpiresAt,
} from "./redemption";

describe("códigos de canje", () => {
  it("genera códigos válidos de 6 caracteres", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRedemptionCode();
      expect(code).toHaveLength(REDEMPTION_CODE_LENGTH);
      expect(isValidRedemptionCode(code)).toBe(true);
    }
  });

  it("normaliza lo que escribe el staff", () => {
    expect(normalizeRedemptionCode("abc-def")).toBe("ABCDEF");
    expect(normalizeRedemptionCode(" abc 123 ")).toBe("ABC123");
  });

  it("rechaza códigos con caracteres confusos o largo incorrecto", () => {
    expect(isValidRedemptionCode("ABC01I")).toBe(false);
    expect(isValidRedemptionCode("ABCDE")).toBe(false);
    expect(isValidRedemptionCode("ABCDEF!")).toBe(false);
  });

  it("formatea en dos grupos para dictarlo", () => {
    expect(formatRedemptionCode("ABCDEF")).toBe("ABC-DEF");
  });

  it("vence a los 2 minutos", () => {
    const now = new Date("2026-10-13T15:00:00Z");
    const expiresAt = redemptionExpiresAt(now);
    expect(expiresAt.getTime() - now.getTime()).toBe(120_000);
    expect(isRedemptionExpired(expiresAt, now)).toBe(false);
    expect(
      isRedemptionExpired(expiresAt, new Date(now.getTime() + 121_000)),
    ).toBe(true);
  });
});
