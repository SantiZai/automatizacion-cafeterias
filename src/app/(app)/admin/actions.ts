"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { DEFAULT_STAMP_RULES } from "@/domain/stamps";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export type AdminActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const passwordSchema = z
  .string()
  .max(64, "Máximo 64 caracteres")
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v : undefined))
  .refine((v) => v === undefined || v.length >= 8, {
    message: "Mínimo 8 caracteres",
  });

function tempPassword(provided: string | undefined): string {
  if (provided) return provided;
  return randomBytes(12).toString("base64url").slice(0, 12);
}

/** Crea el usuario de Auth o devuelve el existente (por mail). */
async function ensureAuthUser(
  email: string,
  password: string,
  displayName: string,
): Promise<{ uid: string; created: boolean }> {
  const auth = adminAuth();
  try {
    const user = await auth.createUser({ email, password, displayName });
    return { uid: user.uid, created: true };
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/email-already-exists") {
      throw error;
    }
    const existing = await auth.getUserByEmail(email);
    return { uid: existing.uid, created: false };
  }
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

const newCafeSchema = z.object({
  cafeName: z.string().trim().min(2, "Escribí el nombre del café").max(60, "Máximo 60 caracteres"),
  ownerName: z.string().trim().min(2, "Escribí el nombre del responsable").max(60, "Máximo 60 caracteres"),
  email: z.string().trim().email("Mail inválido").max(120, "Máximo 120 caracteres"),
  tempPassword: passwordSchema,
  stampsRequired: z.coerce
    .number({ message: "Ingresá un número" })
    .int("Tiene que ser un número entero")
    .min(4, "Mínimo 4 sellos")
    .max(15, "Máximo 15 sellos"),
  rewardName: z.string().trim().min(2, "Contanos cuál es el premio").max(80, "Máximo 80 caracteres"),
});

/** Crea café + local + programa + cuenta en una transacción. */
export async function createCafeWithAccountAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const parsed = newCafeSchema.safeParse({
    cafeName: formData.get("cafeName"),
    ownerName: formData.get("ownerName"),
    email: formData.get("email"),
    tempPassword: formData.get("tempPassword"),
    stampsRequired: formData.get("stampsRequired"),
    rewardName: formData.get("rewardName"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { cafeName, ownerName, email, stampsRequired, rewardName } = parsed.data;
  const password = tempPassword(parsed.data.tempPassword);

  try {
    const { uid, created } = await ensureAuthUser(email, password, ownerName);
    const db = adminDb();

    await db.runTransaction(async (tx) => {
      const userRef = db.doc(`users/${uid}`);
      const cafeRef = db.collection("cafes").doc();
      const slug = `${slugify(cafeName) || "cafe"}-${cafeRef.id.slice(0, 4).toLowerCase()}`;
      const now = FieldValue.serverTimestamp();

      tx.set(cafeRef, {
        name: cafeName,
        slug,
        plan: "essential",
        timezone: "America/Argentina/Buenos_Aires",
        ownerUid: uid,
        settings: { opportunityMode: "manual" },
        createdAt: now,
      });
      tx.set(cafeRef.collection("members").doc(uid), {
        role: "owner",
        email,
        name: ownerName,
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
        { email, displayName: ownerName, defaultCafeId: cafeRef.id, createdAt: now },
        { merge: true },
      );
    });

    revalidatePath("/admin");
    return {
      ok: true,
      message: created
        ? `Listo: ${cafeName} + cuenta ${email} (contraseña: ${password}). Pasala al local.`
        : `Café ${cafeName} creado y vinculado a la cuenta existente ${email}. La contraseña no cambió.`,
    };
  } catch (error) {
    console.error("createCafeWithAccountAction failed", error);
    return { error: "No pudimos crear el café. Probá de nuevo en un momento." };
  }
}

const accountSchema = z.object({
  cafeId: z.string().min(1, "Elegí el café").max(64),
  ownerName: z.string().trim().min(2, "Escribí el nombre").max(60, "Máximo 60 caracteres"),
  email: z.string().trim().email("Mail inválido").max(120, "Máximo 120 caracteres"),
  tempPassword: passwordSchema,
  role: z.enum(["owner", "manager", "staff"]),
});

/** Agrega una cuenta (nueva o existente) a un café existente. */
export async function addAccountToCafeAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const parsed = accountSchema.safeParse({
    cafeId: formData.get("cafeId"),
    ownerName: formData.get("ownerName"),
    email: formData.get("email"),
    tempPassword: formData.get("tempPassword"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { cafeId, ownerName, email, role } = parsed.data;
  const password = tempPassword(parsed.data.tempPassword);

  try {
    const { uid, created } = await ensureAuthUser(email, password, ownerName);
    const db = adminDb();
    const cafeSnap = await db.doc(`cafes/${cafeId}`).get();
    if (!cafeSnap.exists) return { error: "Ese café no existe." };

    const now = FieldValue.serverTimestamp();
    await Promise.all([
      db.doc(`cafes/${cafeId}/members/${uid}`).set(
        { role, email, name: ownerName, createdAt: now },
        { merge: true },
      ),
      db.doc(`users/${uid}`).set(
        { email, displayName: ownerName, defaultCafeId: cafeId, createdAt: now },
        { merge: true },
      ),
    ]);

    revalidatePath("/admin");
    return {
      ok: true,
      message: created
        ? `Cuenta ${email} agregada como ${role} (contraseña: ${password}).`
        : `La cuenta ${email} ya existía: se agregó como ${role} sin cambiar la contraseña.`,
    };
  } catch (error) {
    console.error("addAccountToCafeAction failed", error);
    return { error: "No pudimos crear la cuenta. Probá de nuevo en un momento." };
  }
}
