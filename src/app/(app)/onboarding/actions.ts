"use server";

import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_STAMP_RULES } from "@/domain/stamps";
import type { OnboardingState } from "./state";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribí el nombre de tu café")
    .max(60, "Máximo 60 caracteres"),
  stampsRequired: z.coerce
    .number({ message: "Ingresá un número" })
    .int("Tiene que ser un número entero")
    .min(4, "Mínimo 4 sellos")
    .max(15, "Máximo 15 sellos"),
  rewardName: z
    .string()
    .trim()
    .min(2, "Contanos cuál es el premio")
    .max(80, "Máximo 80 caracteres"),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function createCafeAction(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await requireSession();
  if (!isAdminEmail(session.email)) {
    return { error: "Solo el administrador puede crear cafés." };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    stampsRequired: formData.get("stampsRequired"),
    rewardName: formData.get("rewardName"),
  });

  if (!parsed.success) {
    const fieldErrors: OnboardingState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<OnboardingState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const { name, stampsRequired, rewardName } = parsed.data;
  const db = adminDb();

  try {
    // Transacción: si el usuario aprieta dos veces, no se crean dos cafés
    await db.runTransaction(async (tx) => {
      const userRef = db.doc(`users/${session.uid}`);
      const userSnap = await tx.get(userRef);
      if (userSnap.data()?.defaultCafeId) return;

      const cafeRef = db.collection("cafes").doc();
      const slug = `${slugify(name) || "cafe"}-${cafeRef.id.slice(0, 4).toLowerCase()}`;
      const now = FieldValue.serverTimestamp();

      tx.set(cafeRef, {
        name,
        slug,
        plan: "essential",
        timezone: "America/Argentina/Buenos_Aires",
        ownerUid: session.uid,
        settings: { opportunityMode: "manual" },
        createdAt: now,
      });

      tx.set(cafeRef.collection("members").doc(session.uid), {
        role: "owner",
        email: session.email,
        name: session.name,
        createdAt: now,
      });

      tx.set(cafeRef.collection("locations").doc(), {
        name: "Local principal",
        googlePlaceId: null,
        instagramHandle: null,
        createdAt: now,
      });

      tx.set(cafeRef.collection("programs").doc(), {
        name: "Tarjeta de sellos",
        stampsRequired,
        minMinutesBetweenStamps: DEFAULT_STAMP_RULES.minMinutesBetweenStamps,
        maxStampsPerDay: DEFAULT_STAMP_RULES.maxStampsPerDay,
        rewards: [{ name: rewardName, atStamp: stampsRequired }],
        active: true,
        createdAt: now,
      });

      tx.set(
        userRef,
        {
          email: session.email,
          displayName: session.name,
          defaultCafeId: cafeRef.id,
          createdAt: now,
        },
        { merge: true },
      );
    });
  } catch (error) {
    console.error("createCafeAction failed", error);
    return { error: "No pudimos crear tu café. Probá de nuevo en un momento." };
  }

  redirect("/dashboard");
}
