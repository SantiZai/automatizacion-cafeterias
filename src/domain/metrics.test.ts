import { describe, expect, it } from "vitest";

import { computeMetrics } from "./metrics";

const now = new Date("2026-10-14T15:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("métricas", () => {
  it("cuenta activos, visitas y frecuencia de 30 días", () => {
    const result = computeMetrics(
      {
        customers: [
          { id: "a", createdAt: daysAgo(40), lastVisitAt: daysAgo(2), visitCount: 5, status: "active" },
          { id: "b", createdAt: daysAgo(50), lastVisitAt: daysAgo(40), visitCount: 3, status: "active" },
        ],
        visits: [
          { visitedAt: daysAgo(2), locationId: "l1" },
          { visitedAt: daysAgo(5), locationId: "l1" },
          { visitedAt: daysAgo(60), locationId: "l1" },
        ],
        redemptions: [],
        claims: [],
        opportunities: [],
      },
      now,
    );
    expect(result.activeCustomers).toBe(1);
    expect(result.visitsLast30d).toBe(2);
    expect(result.frequency).toBe(2);
    expect(result.byLocation).toEqual([{ locationId: "l1", visits: 2 }]);
  });

  it("detecta en riesgo y recuperados", () => {
    const result = computeMetrics(
      {
        customers: [
          { id: "a", createdAt: daysAgo(60), lastVisitAt: daysAgo(20), visitCount: 4, status: "active" },
          { id: "b", createdAt: daysAgo(60), lastVisitAt: daysAgo(3), visitCount: 4, status: "active" },
        ],
        visits: [],
        redemptions: [],
        claims: [],
        opportunities: [
          { customerId: "b", status: "sent", sentAt: daysAgo(10) },
          { customerId: "a", status: "sent", sentAt: daysAgo(5) },
        ],
      },
      now,
    );
    // a sigue sin venir desde antes del envío; b volvió después
    expect(result.atRisk).toBe(1);
    expect(result.recovered).toBe(1);
  });

  it("calcula retención y tasa de canje", () => {
    const result = computeMetrics(
      {
        customers: [
          { id: "a", createdAt: daysAgo(40), lastVisitAt: daysAgo(2), visitCount: 3, status: "active" },
          { id: "b", createdAt: daysAgo(40), lastVisitAt: daysAgo(35), visitCount: 1, status: "active" },
          { id: "c", createdAt: daysAgo(5), lastVisitAt: daysAgo(1), visitCount: 1, status: "active" },
        ],
        visits: [],
        redemptions: [{ status: "redeemed" }, { status: "pending" }],
        claims: [
          { kind: "google_review", status: "approved", decidedAt: daysAgo(3) },
          { kind: "instagram_story", status: "approved", decidedAt: daysAgo(40) },
        ],
        opportunities: [],
      },
      now,
    );
    expect(result.retention30).toEqual({ rate: 50, eligible: 2 });
    expect(result.retention60.eligible).toBe(0);
    expect(result.redemptionRate).toBe(50);
    expect(result.reviewsLast30d).toBe(1);
    expect(result.storiesLast30d).toBe(0);
  });

  it("arma cohortes por mes de alta", () => {
    const result = computeMetrics(
      {
        customers: [
          { id: "a", createdAt: new Date("2026-09-05T00:00:00Z"), lastVisitAt: daysAgo(2), visitCount: 2, status: "active" },
          { id: "b", createdAt: new Date("2026-09-06T00:00:00Z"), lastVisitAt: daysAgo(30), visitCount: 1, status: "active" },
        ],
        visits: [],
        redemptions: [],
        claims: [],
        opportunities: [],
      },
      now,
    );
    expect(result.cohorts).toEqual([
      { month: "2026-09", total: 2, returned: 1, rate: 50 },
    ]);
  });
});
