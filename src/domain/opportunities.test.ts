import { describe, expect, it } from "vitest";

import {
  buildOpportunityMessage,
  detectAbsence,
  detectBirthday,
  detectNearReward,
  opportunityDocId,
} from "./opportunities";

const now = new Date("2026-10-14T15:00:00Z");

describe("oportunidades", () => {
  it("detecta ausencia con 2+ visitas y 14 días o más", () => {
    const last = new Date("2026-09-20T15:00:00Z");
    expect(
      detectAbsence({ lastVisitAt: last, visitCount: 5, status: "active", now }),
    ).toMatchObject({ absent: true });
  });

  it("no marca ausencia con 1 sola visita ni sin fecha", () => {
    expect(
      detectAbsence({ lastVisitAt: null, visitCount: 0, status: "active", now })
        .absent,
    ).toBe(false);
    expect(
      detectAbsence({
        lastVisitAt: new Date("2026-09-01T00:00:00Z"),
        visitCount: 1,
        status: "active",
        now,
      }).absent,
    ).toBe(false);
  });

  it("no marca ausencia reciente ni clientes inactivos", () => {
    const yesterday = new Date(now.getTime() - 86_400_000);
    expect(
      detectAbsence({ lastVisitAt: yesterday, visitCount: 4, status: "active", now })
        .absent,
    ).toBe(false);
    expect(
      detectAbsence({
        lastVisitAt: new Date("2026-08-01T00:00:00Z"),
        visitCount: 9,
        status: "lost",
        now,
      }).absent,
    ).toBe(false);
  });

  it("detecta premio cercano con 1 o 2 restantes", () => {
    expect(detectNearReward({ stamps: 7, required: 8 })).toMatchObject({
      near: true,
      remaining: 1,
    });
    expect(detectNearReward({ stamps: 6, required: 8 }).near).toBe(true);
    expect(detectNearReward({ stamps: 3, required: 8 }).near).toBe(false);
    expect(detectNearReward({ stamps: 8, required: 8 }).near).toBe(false);
  });

  it("detecta cumpleaños por mes y día", () => {
    expect(
      detectBirthday({
        birthday: "1990-10-14",
        now,
        timeZone: "America/Argentina/Buenos_Aires",
      }),
    ).toBe(true);
    expect(
      detectBirthday({
        birthday: "10-14",
        now,
        timeZone: "America/Argentina/Buenos_Aires",
      }),
    ).toBe(true);
    expect(
      detectBirthday({
        birthday: "1990-01-01",
        now,
        timeZone: "America/Argentina/Buenos_Aires",
      }),
    ).toBe(false);
    expect(
      detectBirthday({ birthday: null, now, timeZone: "America/Argentina/Buenos_Aires" }),
    ).toBe(false);
  });

  it("arma mensajes en rioplatense con el nombre de pila", () => {
    expect(
      buildOpportunityMessage({
        kind: "absence",
        customerName: "Lucía Gómez",
        cafeName: "Café del Barrio",
        daysSince: 20,
      }),
    ).toContain("Hola, Lucía");
    expect(
      buildOpportunityMessage({
        kind: "near_reward",
        customerName: "Santiago",
        cafeName: "Café del Barrio",
        rewardName: "Café gratis",
        remaining: 1,
      }),
    ).toContain("Te faltan 1 sellos");
  });

  it("el ID es determinista por cliente + tipo + período", () => {
    expect(opportunityDocId("c1", "absence", "2026-10-14")).toBe(
      "c1_absence_2026-10-14",
    );
  });
});
