import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { applyBonusStamps, type ClaimKind, type ClaimStatus } from "@/domain/engagement";
import { cardProgress } from "@/domain/stamps";
import { adminDb } from "@/lib/firebase/admin";
import { getActiveProgram } from "./programs";

export type ClaimSummary = {
  id: string;
  customerId: string;
  displayName: string;
  kind: ClaimKind;
  status: ClaimStatus;
  stampsRequested: number;
  stampsAwarded: number | null;
  evidenceUrl: string | null;
  createdAt: string | null;
};

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/** Cola del staff: pendientes más viejos primero. */
export async function listPendingClaims(cafeId: string): Promise<ClaimSummary[]> {
  const db = adminDb();
  const snap = await db
    .collection(`cafes/${cafeId}/claims`)
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .limit(50)
    .get();
  return snap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      customerId: (data.customerId as string) ?? "",
      displayName: (data.displayName as string) ?? "Cliente",
      kind: (data.kind as ClaimKind) ?? "google_review",
      status: "pending" as const,
      stampsRequested: (data.stampsRequested as number) ?? 1,
      stampsAwarded: (data.stampsAwarded as number | null) ?? null,
      evidenceUrl: (data.evidenceUrl as string | null) ?? null,
      createdAt: isoOrNull(data.createdAt),
    };
  });
}

export async function countPendingClaims(cafeId: string): Promise<number> {
  const db = adminDb();
  const snap = await db
    .collection(`cafes/${cafeId}/claims`)
    .where("status", "==", "pending")
    .count()
    .get();
  return snap.data().count;
}

export type DecideClaimResult = {
  awarded: number;
  stamps: number;
  required: number;
  complete: boolean;
};

/**
 * Aprueba en transacción: reclamo + tarjeta juntos (doble aprobación imposible).
 * El bonus NO toca lastStampAt/stampsToday: no bloquea la próxima visita.
 */
export async function approveClaim(
  cafeId: string,
  claimId: string,
  reviewer: { uid: string; name: string | null },
): Promise<DecideClaimResult> {
  const db = adminDb();
  const program = await getActiveProgram(cafeId);
  if (!program) throw new Error("SIN_PROGRAMA");

  return db.runTransaction(async (tx) => {
    const claimRef = db.doc(`cafes/${cafeId}/claims/${claimId}`);
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) throw new Error("NO_ENCONTRADO");
    const claim = claimSnap.data() as Record<string, unknown>;
    if (claim.status !== "pending") throw new Error("YA_DECIDIDO");

    const customerId = claim.customerId as string;
    const customerRef = db.doc(`cafes/${cafeId}/customers/${customerId}`);
    const cardRef = customerRef.collection("cards").doc(program.id);
    const cardSnap = await tx.get(cardRef);
    const prevStamps = ((cardSnap.data()?.stamps as number) ?? 0) as number;
    const requested = ((claim.stampsRequested as number) ?? 1) as number;

    const bonus = applyBonusStamps({
      prevStamps,
      required: program.stampsRequired,
      award: requested,
    });
    const progress = cardProgress(bonus.newStamps, program.stampsRequired);

    tx.set(
      cardRef,
      {
        programId: program.id,
        stamps: bonus.newStamps,
        completedAt: bonus.complete
          ? (cardSnap.data()?.completedAt ?? FieldValue.serverTimestamp())
          : null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(
      claimRef,
      {
        status: "approved",
        stampsAwarded: bonus.awarded,
        reviewedByUid: reviewer.uid,
        reviewedByName: reviewer.name,
        decidedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      awarded: bonus.awarded,
      stamps: progress.stamps,
      required: progress.required,
      complete: progress.complete,
    };
  });
}

export async function rejectClaim(
  cafeId: string,
  claimId: string,
  reviewer: { uid: string; name: string | null },
): Promise<void> {
  const db = adminDb();
  const claimRef = db.doc(`cafes/${cafeId}/claims/${claimId}`);
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) throw new Error("NO_ENCONTRADO");
  if ((claimSnap.data()?.status as string) !== "pending") {
    throw new Error("YA_DECIDIDO");
  }
  await claimRef.set(
    {
      status: "rejected",
      stampsAwarded: 0,
      reviewedByUid: reviewer.uid,
      reviewedByName: reviewer.name,
      decidedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
