import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import {
  CLAIM_COOLDOWN_DAYS,
  awardFor,
  isCooldownActive,
  isValidClaimKind,
} from "@/domain/engagement";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getActiveProgram } from "@/lib/data/programs";

const bodySchema = z.object({
  cafeId: z.string().min(1).max(64),
  idToken: z.string().min(20),
  kind: z.string().min(1).max(32),
  evidenceUrl: z.string().trim().max(500).optional(),
});

// El cliente pide un sello extra; el staff lo aprueba en el mostrador.
// Idempotente por pendiente: si ya hay uno abierto del mismo tipo, se devuelve.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { cafeId, idToken, kind: rawKind, evidenceUrl } = parsed.data;
  if (!isValidClaimKind(rawKind)) {
    return NextResponse.json({ error: "Tipo de reclamo inválido" }, { status: 400 });
  }
  const kind = rawKind;
  const now = new Date();

  // 1. Cliente: ID token de Phone Auth
  let phoneUid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const phone = (decoded as { phone_number?: string }).phone_number;
    if (!phone) {
      return NextResponse.json(
        { error: "Necesitás verificar tu teléfono para pedir sellos extra." },
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
  const [cafeSnap, program] = await Promise.all([
    db.doc(`cafes/${cafeId}`).get(),
    getActiveProgram(cafeId),
  ]);
  if (!cafeSnap.exists) {
    return NextResponse.json({ error: "Este café ya no está disponible." }, { status: 404 });
  }
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
  const customerDoc = found.docs[0];
  if (!customerDoc) {
    return NextResponse.json(
      { error: "Primero sumá un sello escaneando el QR." },
      { status: 404 },
    );
  }

  const claimsCol = db.collection(`cafes/${cafeId}/claims`);

  // Pendiente existente del mismo tipo: devolverlo sin duplicar
  const pendingSnap = await claimsCol
    .where("customerId", "==", customerDoc.id)
    .where("kind", "==", kind)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!pendingSnap.empty) {
    const existing = pendingSnap.docs[0];
    return NextResponse.json({
      ok: true,
      alreadyPending: true,
      claimId: existing.id,
      status: "pending",
      stampsRequested: (existing.data().stampsRequested as number) ?? awardFor(kind),
    });
  }

  // Cooldown: un aprobado por tipo cada 30 días
  const approvedSnap = await claimsCol
    .where("customerId", "==", customerDoc.id)
    .where("kind", "==", kind)
    .where("status", "==", "approved")
    .orderBy("decidedAt", "desc")
    .limit(1)
    .get();
  const lastApprovedDoc = approvedSnap.docs[0];
  const lastApprovedAt = lastApprovedDoc
    ? toDateOrNull(lastApprovedDoc.data().decidedAt)
    : null;
  const cooldown = isCooldownActive({ lastApprovedAt, now });
  if (cooldown.active) {
    return NextResponse.json(
      {
        error: `Ya te dimos este premio hace poco. Podés pedirlo de nuevo en unos días.`,
        reason: "cooldown",
        retryAt: cooldown.retryAt?.toISOString() ?? null,
      },
      { status: 429 },
    );
  }

  const ref = claimsCol.doc();
  await ref.set({
    customerId: customerDoc.id,
    personUid: phoneUid,
    displayName: (customerDoc.data().displayName as string) ?? "Cliente",
    kind,
    status: "pending",
    stampsRequested: awardFor(kind),
    programId: program.id,
    evidenceUrl: evidenceUrl?.trim() ? evidenceUrl.trim() : null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    ok: true,
    alreadyPending: false,
    claimId: ref.id,
    status: "pending",
    stampsRequested: awardFor(kind),
    cooldownDays: CLAIM_COOLDOWN_DAYS,
  });
}

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}
