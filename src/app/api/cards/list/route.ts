import { NextResponse } from "next/server";
import { z } from "zod";

import { cardProgress } from "@/domain/stamps";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getActiveProgram } from "@/lib/data/programs";

const bodySchema = z.object({
  idToken: z.string().min(20),
});

// Todas las tarjetas del teléfono en todos sus cafés.
// Es la base del portal /tarjeta: la tarjeta persistente en el celu.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  let phoneUid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(parsed.data.idToken);
    if (!(decoded as { phone_number?: string }).phone_number) {
      return NextResponse.json(
        { error: "Necesitás verificar tu teléfono para ver tus tarjetas." },
        { status: 401 },
      );
    }
    phoneUid = decoded.uid;
  } catch {
    return NextResponse.json(
      { error: "Tu sesión venció. Pedí el código de nuevo." },
      { status: 401 },
    );
  }

  const db = adminDb();
  const found = await db
    .collectionGroup("customers")
    .where("personUid", "==", phoneUid)
    .limit(20)
    .get();

  const cards = await Promise.all(
    found.docs.map(async (customerDoc) => {
      const cafeId = customerDoc.ref.parent.parent?.id;
      if (!cafeId) return null;
      const [cafeSnap, program] = await Promise.all([
        db.doc(`cafes/${cafeId}`).get(),
        getActiveProgram(cafeId),
      ]);
      if (!cafeSnap.exists || !program) return null;
      const cardSnap = await customerDoc.ref
        .collection("cards")
        .doc(program.id)
        .get();
      const stamps = ((cardSnap.data()?.stamps as number) ?? 0) as number;
      const progress = cardProgress(stamps, program.stampsRequired);
      return {
        cafeId,
        cafeName: (cafeSnap.data()?.name as string) ?? "Tu café",
        customerId: customerDoc.id,
        stamps: progress.stamps,
        required: program.stampsRequired,
        remaining: progress.remaining,
        complete: progress.complete,
        nearReward: progress.nearReward,
        rewardName: program.rewardName,
      };
    }),
  );

  return NextResponse.json({
    ok: true,
    cards: cards.filter((c) => c !== null),
  });
}
