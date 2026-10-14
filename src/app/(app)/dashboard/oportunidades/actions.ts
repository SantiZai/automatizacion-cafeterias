"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import {
  evaluateOpportunities,
  setOpportunityStatus,
} from "@/lib/data/opportunities";

export type OpportunitiesActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
};

async function requireCafe() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) throw new Error("SIN_CAFE");
  return { session, cafe };
}

export async function refreshOpportunitiesAction(): Promise<void> {
  const { cafe } = await requireCafe();
  try {
    await evaluateOpportunities(cafe.id);
  } catch (error) {
    console.error("refreshOpportunitiesAction failed", error);
  }
  revalidatePath("/dashboard/oportunidades");
  revalidatePath("/dashboard");
}

export async function dismissOpportunityAction(
  opportunityId: string,
): Promise<void> {
  const { cafe } = await requireCafe();
  try {
    await setOpportunityStatus(cafe.id, opportunityId, "dismissed");
  } catch (error) {
    console.error("dismissOpportunityAction failed", error);
  }
  revalidatePath("/dashboard/oportunidades");
  revalidatePath("/dashboard");
}

export async function markOpportunitySentAction(
  opportunityId: string,
): Promise<void> {
  const { cafe } = await requireCafe();
  try {
    await setOpportunityStatus(cafe.id, opportunityId, "sent");
  } catch (error) {
    console.error("markOpportunitySentAction failed", error);
  }
  revalidatePath("/dashboard/oportunidades");
  revalidatePath("/dashboard");
}
