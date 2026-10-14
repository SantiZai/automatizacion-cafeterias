import { NextResponse } from "next/server";

import { isRedemptionExpired, normalizeRedemptionCode } from "@/domain/redemption";
import { getSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import { adminDb } from "@/lib/firebase/admin";

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

// Vista previa para la confirmación del staff:
// "Café con medialunas · Lucía · ¿Confirmar?"
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const cafe = await getUserCafe(session.uid);
  if (!cafe) {
    return NextResponse.json({ error: "Todavía no creaste tu café" }, { status: 404 });
  }

  const code = normalizeRedemptionCode(
    new URL(request.url).searchParams.get("code") ?? "",
  );
  if (!code) {
    return NextResponse.json({ error: "Escribí el código del cliente." }, { status: 400 });
  }

  const db = adminDb();
  const redemption = await db.doc(`cafes/${cafe.id}/redemptions/${code}`).get();
  if (!redemption.exists) {
    return NextResponse.json(
      { error: "Ese código no existe. Pedile al cliente que lo revise." },
      { status: 404 },
    );
  }
  const data = redemption.data()!;

  if (data.status === "redeemed") {
    return NextResponse.json(
      { error: "Ese código ya fue canjeado." },
      { status: 409 },
    );
  }
  if (isRedemptionExpired(toDateOrNull(data.expiresAt) ?? new Date(0))) {
    return NextResponse.json(
      { error: "Ese código venció. Pedile al cliente uno nuevo." },
      { status: 410 },
    );
  }

  const customer = await db.doc(`cafes/${cafe.id}/customers/${data.customerId}`).get();
  const customerData = (customer.data() ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    ok: true,
    code,
    rewardName: (data.rewardName as string) ?? "Premio",
    customerName: (customerData.displayName as string) ?? "Cliente",
    visitCount: (customerData.visitCount as number) ?? 0,
    expiresAt: toDateOrNull(data.expiresAt)?.toISOString() ?? null,
  });
}
