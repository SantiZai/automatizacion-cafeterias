"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import { adminDb } from "@/lib/firebase/admin";

export type CustomerActionState = {
  error?: string;
  ok?: boolean;
  fieldErrors?: Record<string, string>;
};

async function requireCafeCustomer(customerId: string) {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) throw new Error("SIN_CAFE");
  const db = adminDb();
  const ref = db.doc(`cafes/${cafe.id}/customers/${customerId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("NO_ENCONTRADO");
  return { session, cafe, ref };
}

const profileSchema = z.object({
  usualOrder: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .optional()
    .transform((v) => (v === "" ? null : v)),
  tastes: z
    .string()
    .max(2000)
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          ctx.addIssue({ code: "custom", message: "Gustos inválidos" });
          return z.NEVER;
        }
        const tastes = parsed
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 20);
        if (tastes.some((t) => t.length > 40)) {
          ctx.addIssue({ code: "custom", message: "Cada gusto: máximo 40 caracteres" });
          return z.NEVER;
        }
        return tastes;
      } catch {
        ctx.addIssue({ code: "custom", message: "Gustos inválidos" });
        return z.NEVER;
      }
    }),
});

export async function updateProfileAction(
  customerId: string,
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    await requireSession();
  } catch {
    return { error: "Iniciá sesión de nuevo." };
  }

  const parsed = profileSchema.safeParse({
    usualOrder: formData.get("usualOrder"),
    tastes: formData.get("tastes"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  try {
    const { cafe, ref } = await requireCafeCustomer(customerId);
    await ref.set(
      {
        usualOrder: parsed.data.usualOrder,
        tastes: parsed.data.tastes,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    revalidatePath(`/dashboard/clientes/${customerId}`);
    revalidatePath("/dashboard/clientes");
    void cafe;
    return { ok: true };
  } catch (error) {
    if ((error as Error).message === "NO_ENCONTRADO") {
      return { error: "Ese cliente ya no existe." };
    }
    console.error("updateProfileAction failed", error);
    return { error: "No pudimos guardar. Probá de nuevo en un momento." };
  }
}

const noteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escribí la nota")
    .max(500, "Máximo 500 caracteres"),
});

export async function addNoteAction(
  customerId: string,
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const session = await requireSession();
  const parsed = noteSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { fieldErrors: { body: parsed.error.issues[0]?.message ?? "Nota inválida" } };
  }

  try {
    const { ref } = await requireCafeCustomer(customerId);
    await ref.collection("notes").add({
      body: parsed.data.body,
      authorUid: session.uid,
      authorName: session.name ?? session.email ?? "Equipo",
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(`/dashboard/clientes/${customerId}`);
    return { ok: true };
  } catch (error) {
    if ((error as Error).message === "NO_ENCONTRADO") {
      return { error: "Ese cliente ya no existe." };
    }
    console.error("addNoteAction failed", error);
    return { error: "No pudimos guardar la nota. Probá de nuevo." };
  }
}
