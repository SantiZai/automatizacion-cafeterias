import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import {
  formatRedemptionCode,
  generateRedemptionCode,
  redemptionExpiresAt,
} from "@/domain/redemption";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getActiveProgram } from "@/lib/data/programs";

const bodySchema = z.object({
  cafeId: z.string().min(1).max(64),
  idToken: z.string().min(20),
});

// Genera el código temporal de canje (2 min, un solo uso).
// Solo si la tarjeta está completa. El doc ID es el código: la unicidad
// la garantiza la transacción de lectura+escritura.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { cafeId, idToken } = parsed.data;

  let phoneUid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!(decoded as { phone_number?: string }).phone_number) {
      return NextResponse.json(
        { error: "Necesitás verificar tu teléfono para canjear." },
        { status: 401 },
      );
    }
    phoneUid = decoded.uid;
  } catch {
    return NextResponse.json(
      { error: "No pudimos verificar tu teléfono. Pedí el código de nuevo." },
      { status: 401 },
    );
  }

  const db = adminDb();
  const program = await getActiveProgram(cafeId);
  if (!program) {
    return NextResponse.json(
      { error: "Este café todavía no tiene tarjeta de sellos." },
      { status: 404 },
    );
  }

  const found = await db
    .collection(`cafes/${cafeId}/customers`)
    .where("personUid", "==", phoneUid)
    .limit(1)
    .get();
  const customer = found.docs[0];
  if (!customer) {
    return NextResponse.json({ error: "Todavía no tenés tarjeta en este café." }, { status: 404 });
  }

  const cardSnap = await customer.ref.collection("cards").doc(program.id).get();
  const stamps = ((cardSnap.data()?.stamps as number) ?? 0) as number;
  if (stamps < program.stampsRequired) {
    return NextResponse.json(
      { error: "Todavía no completás la tarjeta para canjear." },
      { status: 409 },
    );
  }

  const now = new Date();
  const expiresAt = redemptionExpiresAt(now);

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateRedemptionCode();
    const ref = db.doc(`cafes/${cafeId}/redemptions/${code}`);
    const existing = await ref.get();
    if (existing.exists) continue;
    await ref.set({
      customerId: customer.id,
      personUid: phoneUid,
      programId: program.id,
      rewardName: program.rewardName,
      status: "pending",
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({
      ok: true,
      code,
      formattedCode: formatRedemptionCode(code),
      expiresAt: expiresAt.toISOString(),
    });
  }

  return NextResponse.json(
    { error: "No pudimos generar el código. Probá de nuevo." },
    { status: 500 },
  );
}
