import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { dayKey } from "@/domain/stamps";
import {
  ABSENCE_THRESHOLD_DAYS,
  buildOpportunityMessage,
  detectAbsence,
  detectBirthday,
  detectNearReward,
  opportunityDocId,
  type OpportunityKind,
  type OpportunityStatus,
} from "@/domain/opportunities";
import { adminDb } from "@/lib/firebase/admin";
import { getActiveProgram } from "./programs";

export type Opportunity = {
  id: string;
  customerId: string;
  displayName: string;
  phoneE164: string | null;
  marketingOptIn: boolean;
  kind: OpportunityKind;
  status: OpportunityStatus;
  message: string;
  periodKey: string;
  daysSince: number | null;
  remaining: number | null;
  detectedAt: string | null;
};

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function dateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/** Bandeja del dueño: abiertas primero, más recientes arriba. */
export async function listOpportunities(
  cafeId: string,
  status: OpportunityStatus = "open",
): Promise<Opportunity[]> {
  const db = adminDb();
  const snap = await db
    .collection(`cafes/${cafeId}/opportunities`)
    .where("status", "==", status)
    .orderBy("detectedAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      customerId: (data.customerId as string) ?? "",
      displayName: (data.displayName as string) ?? "Cliente",
      phoneE164: (data.phoneE164 as string | null) ?? null,
      marketingOptIn: Boolean(data.marketingOptIn),
      kind: (data.kind as OpportunityKind) ?? "absence",
      status: (data.status as OpportunityStatus) ?? "open",
      message: (data.message as string) ?? "",
      periodKey: (data.periodKey as string) ?? "",
      daysSince: (data.daysSince as number | null) ?? null,
      remaining: (data.remaining as number | null) ?? null,
      detectedAt: isoOrNull(data.detectedAt),
    };
  });
}

export async function countOpenOpportunities(cafeId: string): Promise<number> {
  const db = adminDb();
  const snap = await db
    .collection(`cafes/${cafeId}/opportunities`)
    .where("status", "==", "open")
    .count()
    .get();
  return snap.data().count;
}

type EvaluateResult = { checked: number; created: number };

/**
 * Recorre hasta 100 clientes y crea las oportunidades que falten.
 * Idempotente: el ID es {customerId}_{kind}_{periodKey}, si ya existe no se pisa.
 * En Esencial el mensaje se copia a mano (el envío por WhatsApp viene en F4).
 */
export async function evaluateOpportunities(
  cafeId: string,
  now: Date = new Date(),
): Promise<EvaluateResult> {
  const db = adminDb();
  const [cafeSnap, program, customersSnap] = await Promise.all([
    db.doc(`cafes/${cafeId}`).get(),
    getActiveProgram(cafeId),
    db
      .collection(`cafes/${cafeId}/customers`)
      .where("status", "==", "active")
      .orderBy("lastVisitAt", "asc")
      .limit(100)
      .get(),
  ]);
  if (!cafeSnap.exists) return { checked: 0, created: 0 };

  const cafeData = cafeSnap.data() as Record<string, unknown>;
  const cafeName = (cafeData.name as string) ?? "tu café";
  const timezone =
    (cafeData.timezone as string) ?? "America/Argentina/Buenos_Aires";
  const todayKey = dayKey(now, timezone);

  let created = 0;

  for (const customerDoc of customersSnap.docs) {
    const customer = customerDoc.data() as Record<string, unknown>;
    const displayName = (customer.displayName as string) ?? "Cliente";
    const phoneE164 = (customer.phoneE164 as string | null) ?? null;
    const marketingOptIn = Boolean(customer.marketingOptIn);
    const lastVisitAt = dateOrNull(customer.lastVisitAt);
    const visitCount = (customer.visitCount as number) ?? 0;
    const birthday =
      (customer.birthday as string | null | undefined) ?? null;

    const candidates: Array<{
      kind: OpportunityKind;
      periodKey: string;
      message: string;
      daysSince: number | null;
      remaining: number | null;
    }> = [];

    // 1. Ausencia: 2+ visitas y 14+ días sin venir
    const absence = detectAbsence({
      lastVisitAt,
      visitCount,
      status: (customer.status as string) ?? "active",
      now,
      thresholdDays: ABSENCE_THRESHOLD_DAYS,
    });
    if (absence.absent) {
      candidates.push({
        kind: "absence",
        periodKey: todayKey,
        message: buildOpportunityMessage({
          kind: "absence",
          customerName: displayName,
          cafeName,
          daysSince: absence.daysSince,
        }),
        daysSince: absence.daysSince,
        remaining: null,
      });
    }

    // 2. Premio cercano: tarjeta con 1 o 2 restantes
    if (program) {
      const cardSnap = await customerDoc.ref
        .collection("cards")
        .doc(program.id)
        .get();
      const stamps = ((cardSnap.data()?.stamps as number) ?? 0) as number;
      const near = detectNearReward({
        stamps,
        required: program.stampsRequired,
      });
      if (near.near) {
        candidates.push({
          kind: "near_reward",
          // Estable por nivel de sellos: no se duplica cada día
          periodKey: `s${Math.min(stamps, program.stampsRequired)}of${program.stampsRequired}`,
          message: buildOpportunityMessage({
            kind: "near_reward",
            customerName: displayName,
            cafeName,
            rewardName: program.rewardName,
            remaining: near.remaining,
          }),
          daysSince: null,
          remaining: near.remaining,
        });
      }
    }

    // 3. Cumpleaños (solo si el cliente tiene fecha cargada)
    if (detectBirthday({ birthday, now, timeZone: timezone })) {
      candidates.push({
        kind: "birthday",
        periodKey: todayKey,
        message: buildOpportunityMessage({
          kind: "birthday",
          customerName: displayName,
          cafeName,
        }),
        daysSince: null,
        remaining: null,
      });
    }

    for (const candidate of candidates) {
      const docId = opportunityDocId(
        customerDoc.id,
        candidate.kind,
        candidate.periodKey,
      );
      const ref = db.doc(`cafes/${cafeId}/opportunities/${docId}`);
      const existing = await ref.get();
      if (existing.exists) continue;
      await ref.create({
        customerId: customerDoc.id,
        displayName,
        phoneE164,
        marketingOptIn,
        kind: candidate.kind,
        status: "open",
        message: candidate.message,
        periodKey: candidate.periodKey,
        daysSince: candidate.daysSince,
        remaining: candidate.remaining,
        detectedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
      created += 1;
    }
  }

  return { checked: customersSnap.size, created };
}

export async function setOpportunityStatus(
  cafeId: string,
  opportunityId: string,
  status: Extract<OpportunityStatus, "sent" | "dismissed">,
): Promise<void> {
  const db = adminDb();
  await db.doc(`cafes/${cafeId}/opportunities/${opportunityId}`).set(
    {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
