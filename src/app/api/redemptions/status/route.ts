import { NextResponse } from "next/server";
import { z } from "zod";

import { isRedemptionExpired } from "@/domain/redemption";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const bodySchema = z.object({
  cafeId: z.string().min(1).max(64),
  idToken: z.string().min(20),
  code: z.string().min(6).max(12),
});

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

// Estado del código para la espera del cliente (pending | redeemed | expired).
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { cafeId, idToken, code } = parsed.data;

  let phoneUid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    phoneUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const snap = await adminDb()
    .doc(`cafes/${cafeId}/redemptions/${code.toUpperCase().replace(/[\s\-]/g, "")}`)
    .get();
  if (!snap.exists || snap.data()?.personUid !== phoneUid) {
    return NextResponse.json({ status: "not_found" });
  }

  const data = snap.data()!;
  if (data.status === "redeemed") {
    return NextResponse.json({ status: "redeemed" });
  }
  const expiresAt = toDateOrNull(data.expiresAt);
  if (!expiresAt || isRedemptionExpired(expiresAt)) {
    return NextResponse.json({ status: "expired" });
  }
  return NextResponse.json({
    status: "pending",
    expiresAt: expiresAt.toISOString(),
  });
}
