"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import { approveClaim, rejectClaim } from "@/lib/data/claims";

async function requireCafe() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) throw new Error("SIN_CAFE");
  return { session, cafe };
}

function reviewerOf(session: { uid: string; name: string | null }) {
  return { uid: session.uid, name: session.name };
}

export async function approveClaimAction(claimId: string): Promise<void> {
  const { session, cafe } = await requireCafe();
  try {
    await approveClaim(cafe.id, claimId, reviewerOf(session));
  } catch (error) {
    console.error("approveClaimAction failed", error);
  }
  revalidatePath("/dashboard/aprobar");
}

export async function rejectClaimAction(claimId: string): Promise<void> {
  const { session, cafe } = await requireCafe();
  try {
    await rejectClaim(cafe.id, claimId, reviewerOf(session));
  } catch (error) {
    console.error("rejectClaimAction failed", error);
  }
  revalidatePath("/dashboard/aprobar");
}
