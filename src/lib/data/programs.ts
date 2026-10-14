import "server-only";

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
