import "server-only";

import {
  computeMetrics,
  type CafeMetrics,
  type MetricsClaim,
  type MetricsCustomer,
  type MetricsOpportunity,
  type MetricsRedemption,
  type MetricsVisit,
} from "@/domain/metrics";
import { adminDb } from "@/lib/firebase/admin";

function dateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export type MetricsWithNames = CafeMetrics & {
  locationNames: Record<string, string>;
};

/** Agrega visitas, clientes, canjes, reclamos y oportunidades (topes del plan Esencial). */
export async function getMetrics(
  cafeId: string,
  now: Date = new Date(),
): Promise<MetricsWithNames> {
  const db = adminDb();
  const [customersSnap, visitsSnap, redemptionsSnap, claimsSnap, oppsSnap, locationsSnap] =
    await Promise.all([
      db.collection(`cafes/${cafeId}/customers`).limit(500).get(),
      db
        .collection(`cafes/${cafeId}/visits`)
        .orderBy("visitedAt", "desc")
        .limit(1000)
        .get(),
      db.collection(`cafes/${cafeId}/redemptions`).limit(200).get(),
      db
        .collection(`cafes/${cafeId}/claims`)
        .where("status", "==", "approved")
        .limit(200)
        .get(),
      db
        .collection(`cafes/${cafeId}/opportunities`)
        .where("status", "==", "sent")
        .limit(100)
        .get(),
      db.collection(`cafes/${cafeId}/locations`).get(),
    ]);

  const customers: MetricsCustomer[] = customersSnap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      createdAt: dateOrNull(data.createdAt) ?? dateOrNull(data.lastVisitAt),
      lastVisitAt: dateOrNull(data.lastVisitAt),
      visitCount: (data.visitCount as number) ?? 0,
      status: (data.status as string) ?? "active",
    };
  });

  const visits: MetricsVisit[] = visitsSnap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      visitedAt: dateOrNull(data.visitedAt),
      locationId: (data.locationId as string) ?? "",
    };
  });

  const redemptions: MetricsRedemption[] = redemptionsSnap.docs.map((doc) => ({
    status: (doc.data().status as string) ?? "pending",
  }));

  const claims: MetricsClaim[] = claimsSnap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      kind: (data.kind as string) ?? "",
      status: "approved",
      decidedAt: dateOrNull(data.decidedAt),
    };
  });

  const opportunities: MetricsOpportunity[] = oppsSnap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      customerId: (data.customerId as string) ?? "",
      status: "sent",
      sentAt: dateOrNull(data.updatedAt) ?? dateOrNull(data.detectedAt),
    };
  });

  const locationNames: Record<string, string> = {};
  for (const doc of locationsSnap.docs) {
    locationNames[doc.id] = (doc.data().name as string) ?? "Local";
  }

  return { ...computeMetrics({ customers, visits, redemptions, claims, opportunities }, now), locationNames };
}
