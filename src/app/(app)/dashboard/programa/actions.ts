"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import { updateProgram } from "@/lib/data/programs";

export type ProgramActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

const schema = z.object({
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
  minMinutesBetweenStamps: z.coerce
    .number({ message: "Ingresá un número" })
    .int("Tiene que ser un número entero")
    .min(0, "Mínimo 0 minutos")
    .max(1440, "Máximo 1440 minutos"),
  maxStampsPerDay: z.coerce
    .number({ message: "Ingresá un número" })
    .int("Tiene que ser un número entero")
    .min(1, "Mínimo 1 sello por día")
    .max(10, "Máximo 10 sellos por día"),
});

export async function updateProgramAction(
  _previous: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  try {
    await requireSession();
  } catch {
    return { error: "Iniciá sesión de nuevo." };
  }

  const parsed = schema.safeParse({
    stampsRequired: formData.get("stampsRequired"),
    rewardName: formData.get("rewardName"),
    minMinutesBetweenStamps: formData.get("minMinutesBetweenStamps"),
    maxStampsPerDay: formData.get("maxStampsPerDay"),
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
    const session = await requireSession();
    const cafe = await getUserCafe(session.uid);
    if (!cafe) return { error: "Todavía no creaste tu café." };

    const { adjustedCards } = await updateProgram(cafe.id, parsed.data);
    revalidatePath("/dashboard/programa");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message:
        adjustedCards === 0
          ? "Promo guardada. Ninguna tarjeta necesitó ajuste."
          : `Promo guardada. Ajustamos ${adjustedCards} ${adjustedCards === 1 ? "tarjeta" : "tarjetas"} al nuevo tope.`,
    };
  } catch (error) {
    console.error("updateProgramAction failed", error);
    return { error: "No pudimos guardar la promo. Probá de nuevo en un momento." };
  }
}
