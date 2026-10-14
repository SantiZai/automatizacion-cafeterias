/**
 * Métricas del café (puras, testeadas).
 * Definiciones:
 * - Activo: visitó en los últimos 30 días.
 * - En riesgo: 2+ visitas y más de 14 días sin venir.
 * - Retención N días: de los que se sumaron hace N+ días, % que volvió (2+ visitas).
 * - Recuperado: oportunidad marcada enviada y el cliente volvió después.
 * - Tasa de canje: canjeados sobre códigos generados.
 */

export const ACTIVE_DAYS = 30;
export const RISK_DAYS = 14;

const DAY_MS = 86_400_000;

export type MetricsCustomer = {
  id: string;
  createdAt: Date | null;
  lastVisitAt: Date | null;
  visitCount: number;
  status: string;
};

export type MetricsVisit = {
  visitedAt: Date | null;
  locationId: string;
};

export type MetricsRedemption = {
  status: string;
};

export type MetricsClaim = {
  kind: string;
  status: string;
  decidedAt: Date | null;
};

export type MetricsOpportunity = {
  customerId: string;
  status: string;
  sentAt: Date | null;
};

export type LocationCohort = { month: string; total: number; returned: number; rate: number };
export type LocationStat = { locationId: string; visits: number };

export type CafeMetrics = {
  totalCustomers: number;
  activeCustomers: number;
  visitsLast30d: number;
  frequency: number;
  atRisk: number;
  retention30: { rate: number; eligible: number };
  retention60: { rate: number; eligible: number };
  retention90: { rate: number; eligible: number };
  recovered: number;
  redemptionsCreated: number;
  redemptionsRedeemed: number;
  redemptionRate: number;
  reviewsLast30d: number;
  storiesLast30d: number;
  byLocation: LocationStat[];
  cohorts: LocationCohort[];
};

function daysAgo(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

function retention(
  customers: MetricsCustomer[],
  now: Date,
  minAgeDays: number,
): { rate: number; eligible: number } {
  const eligible = customers.filter((c) => {
    const age = c.createdAt ? daysAgo(c.createdAt, now) : null;
    // Sin fecha de alta se usa la última visita como aproximación
    const fallback = age === null ? daysAgo(c.lastVisitAt, now) : age;
    return (fallback ?? 0) >= minAgeDays;
  });
  if (eligible.length === 0) return { rate: 0, eligible: 0 };
  const returned = eligible.filter((c) => c.visitCount >= 2).length;
  return { rate: Math.round((returned / eligible.length) * 100), eligible: eligible.length };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function computeMetrics(
  input: {
    customers: MetricsCustomer[];
    visits: MetricsVisit[];
    redemptions: MetricsRedemption[];
    claims: MetricsClaim[];
    opportunities: MetricsOpportunity[];
  },
  now: Date = new Date(),
): CafeMetrics {
  const { customers, visits, redemptions, claims, opportunities } = input;

  const recentVisits = visits.filter(
    (v) => v.visitedAt && now.getTime() - v.visitedAt.getTime() <= ACTIVE_DAYS * DAY_MS,
  );
  const activeIds = new Set(
    customers
      .filter((c) => {
        const age = daysAgo(c.lastVisitAt, now);
        return age !== null && age <= ACTIVE_DAYS;
      })
      .map((c) => c.id),
  );

  const atRisk = customers.filter((c) => {
    if (c.status !== "active" || c.visitCount < 2) return false;
    const age = daysAgo(c.lastVisitAt, now);
    return age !== null && age > RISK_DAYS;
  }).length;

  const lastVisitByCustomer = new Map(
    customers.map((c) => [c.id, c.lastVisitAt] as const),
  );
  const recoveredCustomers = new Set<string>();
  for (const opp of opportunities) {
    if (opp.status !== "sent" || !opp.sentAt) continue;
    const last = lastVisitByCustomer.get(opp.customerId);
    if (last && last.getTime() > opp.sentAt.getTime()) {
      recoveredCustomers.add(opp.customerId);
    }
  }

  const redeemed = redemptions.filter((r) => r.status === "redeemed").length;

  const recentClaims = claims.filter(
    (c) =>
      c.status === "approved" &&
      c.decidedAt &&
      now.getTime() - c.decidedAt.getTime() <= ACTIVE_DAYS * DAY_MS,
  );

  const byLocationMap = new Map<string, number>();
  for (const visit of recentVisits) {
    const key = visit.locationId || "sin-local";
    byLocationMap.set(key, (byLocationMap.get(key) ?? 0) + 1);
  }
  const byLocation = [...byLocationMap.entries()]
    .map(([locationId, count]) => ({ locationId, visits: count }))
    .sort((a, b) => b.visits - a.visits);

  // Cohortes: últimos 6 meses por fecha de alta
  const buckets = new Map<string, { total: number; returned: number }>();
  const oldest = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  for (const customer of customers) {
    const start = customer.createdAt ?? customer.lastVisitAt;
    if (!start || start < oldest) continue;
    const key = monthKey(start);
    const bucket = buckets.get(key) ?? { total: 0, returned: 0 };
    bucket.total += 1;
    if (customer.visitCount >= 2) bucket.returned += 1;
    buckets.set(key, bucket);
  }
  const cohorts = [...buckets.entries()]
    .map(([month, b]) => ({
      month,
      total: b.total,
      returned: b.returned,
      rate: b.total === 0 ? 0 : Math.round((b.returned / b.total) * 100),
    }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));

  return {
    totalCustomers: customers.length,
    activeCustomers: activeIds.size,
    visitsLast30d: recentVisits.length,
    frequency:
      activeIds.size === 0
        ? 0
        : Math.round((recentVisits.length / activeIds.size) * 10) / 10,
    atRisk,
    retention30: retention(customers, now, 30),
    retention60: retention(customers, now, 60),
    retention90: retention(customers, now, 90),
    recovered: recoveredCustomers.size,
    redemptionsCreated: redemptions.length,
    redemptionsRedeemed: redeemed,
    redemptionRate:
      redemptions.length === 0
        ? 0
        : Math.round((redeemed / redemptions.length) * 100),
    reviewsLast30d: recentClaims.filter((c) => c.kind === "google_review").length,
    storiesLast30d: recentClaims.filter((c) => c.kind === "instagram_story").length,
    byLocation,
    cohorts,
  };
}
