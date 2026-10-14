import "server-only";

import { adminDb } from "@/lib/firebase/admin";

export type CafeSummary = {
  id: string;
  name: string;
  slug: string;
  plan: "essential" | "growth" | "network";
  timezone: string;
};

export type CafeLocation = {
  id: string;
  name: string;
};

/** Lista los locales del café, ordenados por fecha de creación. */
export async function getCafeLocations(cafeId: string): Promise<CafeLocation[]> {
  const db = adminDb();
  const snap = await db
    .collection(`cafes/${cafeId}/locations`)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    name: (doc.data().name as string) ?? "Local",
  }));
}
/** Devuelve el café principal del usuario, o null si todavía no creó uno. */
export async function getUserCafe(uid: string): Promise<CafeSummary | null> {
  const db = adminDb();

  const userSnap = await db.doc(`users/${uid}`).get();
  const cafeId = userSnap.data()?.defaultCafeId as string | undefined;
  if (!cafeId) return null;

  const cafeSnap = await db.doc(`cafes/${cafeId}`).get();
  if (!cafeSnap.exists) return null;

  const data = cafeSnap.data()!;
  return {
    id: cafeSnap.id,
    name: data.name,
    slug: data.slug,
    plan: data.plan,
    timezone: data.timezone,
  };
}
