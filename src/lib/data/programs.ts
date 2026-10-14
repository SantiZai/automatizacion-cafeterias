import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { adjustStampsToRequirement } from "@/domain/stamps";
import { adminDb } from "@/lib/firebase/admin";

export type LoyaltyProgram = {
  id: string;
  name: string;
  stampsRequired: number;
  minMinutesBetweenStamps: number;
  maxStampsPerDay: number;
  rewardName: string;
};

/** Devuelve el programa activo del café (el primero por fecha de creación). */
export async function getActiveProgram(
  cafeId: string,
): Promise<LoyaltyProgram | null> {
  const db = adminDb();
  const snap = await db
    .collection(`cafes/${cafeId}/programs`)
    .where("active", "==", true)
    .orderBy("createdAt", "asc")
    .limit(1)
    .get();
  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data() as {
    name?: string;
    stampsRequired?: number;
    minMinutesBetweenStamps?: number;
    maxStampsPerDay?: number;
    rewards?: { name?: string }[];
  };
  return {
    id: doc.id,
    name: data.name ?? "Tarjeta de sellos",
    stampsRequired: data.stampsRequired ?? 8,
    minMinutesBetweenStamps: data.minMinutesBetweenStamps ?? 240,
    maxStampsPerDay: data.maxStampsPerDay ?? 1,
    rewardName: data.rewards?.[0]?.name ?? "Premio",
  };
}

export type UpdateProgramInput = {
  stampsRequired: number;
  rewardName: string;
  minMinutesBetweenStamps: number;
  maxStampsPerDay: number;
};

/**
 * Actualiza la promo y ajusta las tarjetas existentes.
 * Quien supera el nuevo tope queda en el tope (lista para canjear);
 * el resto mantiene sus sellos. Si al subir el requerido una tarjeta
 * deja de estar completa, se le limpia el completado.
 * Devuelve cuántas tarjetas se tocaron.
 */
export async function updateProgram(
  cafeId: string,
  input: UpdateProgramInput,
): Promise<{ adjustedCards: number }> {
  const db = adminDb();
  const program = await getActiveProgram(cafeId);
  if (!program) throw new Error("SIN_PROGRAMA");

  const programRef = db.doc(`cafes/${cafeId}/programs/${program.id}`);
  await programRef.set(
    {
      stampsRequired: input.stampsRequired,
      minMinutesBetweenStamps: input.minMinutesBetweenStamps,
      maxStampsPerDay: input.maxStampsPerDay,
      rewards: [{ name: input.rewardName, atStamp: input.stampsRequired }],
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const cardsQuery = db
    .collection(`cafes/${cafeId}/customers`)
    .limit(500)
    .get();
  const customersSnap = await cardsQuery;

  let batch = db.batch();
  let pending = 0;
  let adjustedCards = 0;
  const commits: Promise<unknown>[] = [];
  const flush = () => {
    if (pending === 0) return;
    commits.push(batch.commit());
    batch = db.batch();
    pending = 0;
  };

  for (const customerDoc of customersSnap.docs) {
    const cardRef = customerDoc.ref.collection("cards").doc(program.id);
    const cardSnap = await cardRef.get();
    if (!cardSnap.exists) continue;
    const prevStamps = ((cardSnap.data()?.stamps as number) ?? 0) as number;
    const prevCompletedAt = cardSnap.data()?.completedAt ?? null;
    const adjusted = adjustStampsToRequirement(prevStamps, input.stampsRequired);
    const shouldComplete = adjusted.complete;
    const wasComplete = prevCompletedAt != null;
    if (adjusted.stamps === prevStamps && shouldComplete === wasComplete) {
      continue;
    }
    batch.set(
      cardRef,
      {
        stamps: adjusted.stamps,
        completedAt: shouldComplete
          ? (prevCompletedAt ?? FieldValue.serverTimestamp())
          : null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    pending += 1;
    adjustedCards += 1;
    if (pending >= 400) flush();
  }
  flush();
  await Promise.all(commits);

  return { adjustedCards };
}
