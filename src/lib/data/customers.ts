import "server-only";

import { dayKey } from "@/domain/stamps";
import { filterCustomers } from "@/domain/customers";
import { adminDb } from "@/lib/firebase/admin";
import { getActiveProgram } from "./programs";

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export type CustomerSummary = {
  id: string;
  displayName: string;
  phoneE164: string;
  visitCount: number;
  lastVisitAt: string | null;
  status: string;
};

export type CustomerNote = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string | null;
};

export type CustomerVisit = {
  id: string;
  locationId: string;
  locationName: string | null;
  visitedAt: string | null;
};

export type CustomerCard = {
  stamps: number;
  required: number;
  remaining: number;
  complete: boolean;
  nearReward: boolean;
};

export type CustomerDetail = CustomerSummary & {
  usualOrder: string | null;
  tastes: string[];
  marketingOptIn: boolean;
  card: CustomerCard;
  rewardName: string;
  notes: CustomerNote[];
  visits: CustomerVisit[];
};

/** Últimos 50 por visita, filtrados en memoria por nombre o teléfono. */
export async function searchCustomers(
  cafeId: string,
  query: string,
): Promise<CustomerSummary[]> {
  const db = adminDb();
  const snap = await db
    .collection(`cafes/${cafeId}/customers`)
    .orderBy("lastVisitAt", "desc")
    .limit(50)
    .get();

  const all: CustomerSummary[] = snap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      displayName: (data.displayName as string) ?? "Cliente",
      phoneE164: (data.phoneE164 as string) ?? "",
      visitCount: (data.visitCount as number) ?? 0,
      lastVisitAt: isoOrNull(data.lastVisitAt),
      status: (data.status as string) ?? "active",
    };
  });
  return filterCustomers(all, query);
}

export async function getCustomerDetail(
  cafeId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const db = adminDb();
  const program = await getActiveProgram(cafeId);

  const customerRef = db.doc(`cafes/${cafeId}/customers/${customerId}`);
  const [customerSnap, notesSnap, visitsSnap, locationsSnap] = await Promise.all([
    customerRef.get(),
    customerRef.collection("notes").orderBy("createdAt", "desc").limit(50).get(),
    db
      .collection(`cafes/${cafeId}/visits`)
      .where("customerId", "==", customerId)
      .orderBy("visitedAt", "desc")
      .limit(20)
      .get(),
    db.collection(`cafes/${cafeId}/locations`).get(),
  ]);
  if (!customerSnap.exists) return null;

  const data = customerSnap.data() as Record<string, unknown>;
  const locationNames = new Map(
    locationsSnap.docs.map((doc) => [doc.id, (doc.data().name as string) ?? null]),
  );

  let card: CustomerCard = {
    stamps: 0,
    required: program?.stampsRequired ?? 8,
    remaining: program?.stampsRequired ?? 8,
    complete: false,
    nearReward: false,
  };
  if (program) {
    const cardSnap = await customerRef.collection("cards").doc(program.id).get();
    const stamps = ((cardSnap.data()?.stamps as number) ?? 0) as number;
    const required = program.stampsRequired;
    const remaining = Math.max(required - stamps, 0);
    card = {
      stamps: Math.min(stamps, required),
      required,
      remaining,
      complete: remaining === 0,
      nearReward: remaining > 0 && remaining <= 1,
    };
  }

  return {
    id: customerSnap.id,
    displayName: (data.displayName as string) ?? "Cliente",
    phoneE164: (data.phoneE164 as string) ?? "",
    visitCount: (data.visitCount as number) ?? 0,
    lastVisitAt: isoOrNull(data.lastVisitAt),
    status: (data.status as string) ?? "active",
    usualOrder: (data.usualOrder as string) ?? null,
    tastes: Array.isArray(data.tastes) ? (data.tastes as string[]) : [],
    marketingOptIn: Boolean(data.marketingOptIn),
    card,
    rewardName: program?.rewardName ?? "Premio",
    notes: notesSnap.docs.map((doc) => {
      const note = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        body: (note.body as string) ?? "",
        authorName: (note.authorName as string) ?? null,
        createdAt: isoOrNull(note.createdAt),
      };
    }),
    visits: visitsSnap.docs.map((doc) => {
      const visit = doc.data() as Record<string, unknown>;
      const locationId = (visit.locationId as string) ?? "";
      return {
        id: doc.id,
        locationId,
        locationName: locationNames.get(locationId) ?? null,
        visitedAt: isoOrNull(visit.visitedAt),
      };
    }),
  };
}

export type DashboardStats = {
  visitsToday: number;
  activeCustomers: number;
  totalVisits: number;
};

/** Contadores baratos con agregaciones (no leen los documentos). */
export async function getDashboardStats(
  cafeId: string,
  timezone: string,
  now: Date = new Date(),
): Promise<DashboardStats> {
  const db = adminDb();
  const today = dayKey(now, timezone);
  const [visitsToday, activeCustomers, totalVisits] = await Promise.all([
    db
      .collection(`cafes/${cafeId}/visits`)
      .where("dayKey", "==", today)
      .count()
      .get(),
    db
      .collection(`cafes/${cafeId}/customers`)
      .where("status", "==", "active")
      .count()
      .get(),
    db.collection(`cafes/${cafeId}/visits`).count().get(),
  ]);
  return {
    visitsToday: visitsToday.data().count,
    activeCustomers: activeCustomers.data().count,
    totalVisits: totalVisits.data().count,
  };
}
