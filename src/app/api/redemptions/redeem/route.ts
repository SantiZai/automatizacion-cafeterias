import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { isRedemptionExpired, normalizeRedemptionCode } from "@/domain/redemption";
import { getSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import { adminDb } from "@/lib/firebase/admin";
import { getActiveProgram } from "@/lib/data/programs";

const bodySchema = z.object({ code: z.string().min(6).max(12) });

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

// Confirma el canje: marca el código como usado y reinicia la tarjeta.
// Todo en una transacción para que un código no se canjee dos veces.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const cafe = await getUserCafe(session.uid);
  if (!cafe) {
    return NextResponse.json({ error: "Todavía no creaste tu café" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }
  const code = normalizeRedemptionCode(parsed.data.code);

  const program = await getActiveProgram(cafe.id);
  if (!program) {
    return NextResponse.json({ error: "No hay programa activo." }, { status: 404 });
  }

  const db = adminDb();
  try {
    const result = await db.runTransaction(async (tx) => {
      const redemptionRef = db.doc(`cafes/${cafe.id}/redemptions/${code}`);
      const redemptionSnap = await tx.get(redemptionRef);
      if (!redemptionSnap.exists) throw new Error("NO_EXISTE");

      const redemption = redemptionSnap.data()!;
      if (redemption.status === "redeemed") throw new Error("YA_CANJEADO");
      if (isRedemptionExpired(toDateOrNull(redemption.expiresAt) ?? new Date(0))) {
        throw new Error("VENCIDO");
      }

      const customerRef = db.doc(
        `cafes/${cafe.id}/customers/${redemption.customerId}`,
      );
      const cardRef = customerRef.collection("cards").doc(program.id);
      const [customerSnap, cardSnap] = [await tx.get(customerRef), await tx.get(cardRef)];

      const stamps = ((cardSnap.data()?.stamps as number) ?? 0) as number;
      if (stamps < program.stampsRequired) throw new Error("SIN_COMPLETAR");

      tx.set(
        redemptionRef,
        {
          status: "redeemed",
          redeemedAt: FieldValue.serverTimestamp(),
          redeemedByUid: session.uid,
          redeemedByName: session.name ?? session.email ?? "Equipo",
        },
        { merge: true },
      );
      tx.set(
        cardRef,
        {
          stamps: 0,
          completedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      const customerData = (customerSnap.data() ?? {}) as Record<string, unknown>;
      return {
        rewardName: (redemption.rewardName as string) ?? program.rewardName,
        customerName: (customerData.displayName as string) ?? "Cliente",
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const reason = (error as Error).message;
    if (reason === "YA_CANJEADO") {
      return NextResponse.json({ error: "Ese código ya fue canjeado." }, { status: 409 });
    }
    if (reason === "VENCIDO") {
      return NextResponse.json(
        { error: "Ese código venció. Pedile al cliente uno nuevo." },
        { status: 410 },
      );
    }
    if (reason === "SIN_COMPLETAR") {
      return NextResponse.json(
        { error: "La tarjeta ya no está completa." },
        { status: 409 },
      );
    }
    if (reason === "NO_EXISTE") {
      return NextResponse.json({ error: "Ese código no existe." }, { status: 404 });
    }
    console.error("[api/redemptions/redeem] falló el canje", error);
    return NextResponse.json(
      { error: "No pudimos confirmar el canje. Probá de nuevo." },
      { status: 500 },
    );
  }
}
