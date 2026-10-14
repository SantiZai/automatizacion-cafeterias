import { describe, expect, it } from "vitest";

import {
  DEFAULT_STAMP_RULES,
  adjustStampsToRequirement,
  cardProgress,
  dayKey,
  evaluateStampAttempt,
} from "./stamps";

const rules = { ...DEFAULT_STAMP_RULES };
const now = new Date("2026-10-13T15:00:00Z");

describe("evaluateStampAttempt", () => {
  it("permite el primer sello", () => {
    expect(
      evaluateStampAttempt({ now, lastStampAt: null, stampsToday: 0, rules }),
    ).toEqual({ ok: true });
  });

  it("rechaza si ya llegó al máximo diario", () => {
    const result = evaluateStampAttempt({
      now,
      lastStampAt: new Date("2026-10-13T08:00:00Z"),
      stampsToday: 1,
      rules,
    });
    expect(result).toEqual({ ok: false, reason: "daily_limit" });
  });

  it("rechaza si no pasó el intervalo mínimo e informa cuándo reintentar", () => {
    const last = new Date("2026-10-13T13:00:00Z");
    const result = evaluateStampAttempt({
      now,
      lastStampAt: last,
      stampsToday: 0,
      rules: { ...rules, maxStampsPerDay: 3 },
    });
    expect(result).toEqual({
      ok: false,
      reason: "too_soon",
      retryAt: new Date("2026-10-13T17:00:00Z"),
    });
  });

  it("permite justo cuando se cumple el intervalo", () => {
    const last = new Date("2026-10-13T11:00:00Z");
    const result = evaluateStampAttempt({
      now,
      lastStampAt: last,
      stampsToday: 0,
      rules: { ...rules, maxStampsPerDay: 3 },
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("cardProgress", () => {
  it("calcula los sellos restantes", () => {
    expect(cardProgress(5, 8)).toMatchObject({
      remaining: 3,
      complete: false,
      nearReward: false,
    });
  });

  it("detecta premio cercano a un sello", () => {
    expect(cardProgress(7, 8).nearReward).toBe(true);
  });

  it("marca la tarjeta completa y no excede el total", () => {
    expect(cardProgress(10, 8)).toMatchObject({
      stamps: 8,
      remaining: 0,
      complete: true,
      nearReward: false,
    });
  });

  it("ignora valores negativos", () => {
    expect(cardProgress(-3, 8).stamps).toBe(0);
  });
});

describe("adjustStampsToRequirement", () => {
  it("fija en el tope al que supera el nuevo requerido", () => {
    expect(adjustStampsToRequirement(9, 6)).toEqual({
      stamps: 6,
      complete: true,
    });
  });

  it("mantiene los que tenía si no llega al tope", () => {
    expect(adjustStampsToRequirement(4, 8)).toEqual({
      stamps: 4,
      complete: false,
    });
  });

  it("con subir el requerido nadie pierde sellos", () => {
    expect(adjustStampsToRequirement(8, 10)).toEqual({
      stamps: 8,
      complete: false,
    });
  });
});

describe("dayKey", () => {
  it("usa la zona horaria del café y no la del servidor", () => {
    // 23:30 del 13/10 en Buenos Aires ya es 14/10 en UTC
    const lateNight = new Date("2026-10-14T02:30:00Z");
    expect(dayKey(lateNight, "America/Argentina/Buenos_Aires")).toBe("2026-10-13");
    expect(dayKey(lateNight, "UTC")).toBe("2026-10-14");
  });
});
