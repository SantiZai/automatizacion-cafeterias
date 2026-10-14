import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import {
  cardProgress,
  dayKey,
  evaluateStampAttempt,
} from "@/domain/stamps";
import { qrWindowFromToken, visitDocId } from "@/domain/visits";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getActiveProgram } from "@/lib/data/programs";
import { verifyCafeQrToken } from "@/lib/server/qr";

const bodySchema = z.object({
  qrToken: z.string().min(10).max(500),
  idToken: z.string().min(20),
  displayName: z.string().trim().min(2).max(60).optional(),
  marketingOptIn: z.boolean().optional().default(false),
});

class AntifraudError extends Error {
  constructor(
    public reason: "too_soon" | "daily_limit",
    public retryAt?: Date,
  ) {
    super(reason);
  }
}

// El cliente abre /v/[token] (validación estricta: ventana actual + anterior)
// y después completa nombre + teléfono + OTP, lo que suele tardar 1-4 min.
// Si el POST exigiera el mismo margen, el token vence en medio del alta
// y devuelve 410. Por eso acá se aceptan ventanas más viejas: el antifraude
// (1 sello/día, minutos mínimos) sigue bloqueando el abuso con fotos.
const SCAN_QR_GRACE_WINDOWS = 10;

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

// Registra una visita escaneada por el cliente.
// El QR se valida por firma y vigencia; el cliente se autentica con Phone Auth.
// Idempotente por cliente + ventana de QR: reintentar no duplica sellos.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { qrToken, idToken, displayName, marketingOptIn } = parsed.data;
  const now = new Date();

  // 1. QR: firma y vigencia (con gracia amplia para el flujo de OTP)
  let verification: ReturnType<typeof verifyCafeQrToken>;
  try {
    verification = verifyCafeQrToken(qrToken, now, SCAN_QR_GRACE_WINDOWS);
  } catch {
    console.error("[api/visits/scan] falta QR_SIGNING_SECRET");
    return NextResponse.json(
      { error: "No pudimos validar el QR. Probá de nuevo en un momento." },
      { status: 500 },
    );
  }
  if (!verification.valid) {
    if (verification.reason === "expired") {
      try {
        const parts = qrToken.split(".");
        const tokenWindow = Number(parts[2]);
        const currentWindow = Math.floor(now.getTime() / 1000 / 60);
        console.error(
          `[api/visits/scan] QR expirado tokenWindow=${parts[2]} currentWindow=${currentWindow} diff=${currentWindow - tokenWindow} cafe=${parts[0]} loc=${parts[1]}`,
        );
      } catch {
        console.error("[api/visits/scan] QR expirado (token ilegible)");
      }
      return NextResponse.json(
        {
          error: "Este código ya se renovó. Escaneá de nuevo el QR del mostrador.",
          reason: "expired",
        },
        { status: 410 },
      );
    }
    return NextResponse.json(
      { error: "Este código no es válido.", reason: verification.reason },
      { status: 400 },
    );
  }
  const qrWindow = qrWindowFromToken(qrToken);
  if (!qrWindow) {
    return NextResponse.json({ error: "Este código no es válido." }, { status: 400 });
  }
  const { cafeId, locationId } = verification;

  // 2. Cliente: ID token de Phone Auth
  let phoneUid: string;
  let phoneE164: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const phone = (decoded as { phone_number?: string }).phone_number;
    if (!phone) {
      return NextResponse.json(
        { error: "Necesitás verificar tu teléfono para sumar sellos." },
        { status: 401 },
      );
    }
    phoneUid = decoded.uid;
    phoneE164 = phone;
  } catch {
    return NextResponse.json(
      { error: "No pudimos verificar tu teléfono. Pedí el código de nuevo." },
      { status: 401 },
    );
  }

  // 3. Configuración del café (lecturas fuera de la transacción)
  const db = adminDb();
  const [cafeSnap, locationSnap, program] = await Promise.all([
    db.doc(`cafes/${cafeId}`).get(),
    db.doc(`cafes/${cafeId}/locations/${locationId}`).get(),
    getActiveProgram(cafeId),
  ]);
  if (!cafeSnap.exists || !locationSnap.exists) {
    return NextResponse.json(
      { error: "Este café ya no está disponible." },
      { status: 404 },
    );
  }
  if (!program) {
    return NextResponse.json(
      { error: "Este café todavía no tiene tarjeta de sellos." },
      { status: 404 },
    );
  }
  const timezone =
    (cafeSnap.data()?.timezone as string) ?? "America/Argentina/Buenos_Aires";

  // Cliente nuevo sin nombre: se pide antes de abrir la transacción.
  if (!displayName) {
    const check = await db
      .collection(`cafes/${cafeId}/customers`)
      .where("personUid", "==", phoneUid)
      .limit(1)
      .get();
    if (check.empty) {
      return NextResponse.json(
        { error: "Contanos tu nombre para crear tu tarjeta." },
        { status: 400 },
      );
    }
  }

  // 4. Transacción: cliente + tarjeta + visita
  try {
    const result = await db.runTransaction(async (tx) => {
      const customersCol = db.collection(`cafes/${cafeId}/customers`);

      const found = await tx.get(
        customersCol.where("personUid", "==", phoneUid).limit(1),
      );
      const existing = found.docs[0] ?? null;

      const customerId = existing?.id ?? customersCol.doc().id;
      const customerRef = customersCol.doc(customerId);
      const cardRef = customerRef.collection("cards").doc(program.id);
      const visitRef = db.doc(
        `cafes/${cafeId}/visits/${visitDocId(customerId, qrWindow)}`,
      );

      const cardSnap = await tx.get(cardRef);
      const visitSnap = await tx.get(visitRef);

      const cardData = (cardSnap.data() ?? {}) as {
        stamps?: number;
        currentDayKey?: string;
        stampsToday?: number;
        lastStampAt?: unknown;
        completedAt?: unknown;
      };
      const prevStamps = cardData.stamps ?? 0;

      // Reintento con el mismo QR: devolver el progreso sin duplicar
      if (visitSnap.exists) {
        const progress = cardProgress(prevStamps, program.stampsRequired);
        return {
          alreadyCounted: true as const,
          customerId,
          visitId: visitSnap.id,
          stamps: progress.stamps,
          progress,
        };
      }

      const todayKey = dayKey(now, timezone);
      const sameDay = cardData.currentDayKey === todayKey;
      const stampsToday = sameDay ? (cardData.stampsToday ?? 0) : 0;
      const lastStampAt = toDateOrNull(cardData.lastStampAt);

      const attempt = evaluateStampAttempt({
        now,
        lastStampAt,
        stampsToday,
        rules: {
          stampsRequired: program.stampsRequired,
          minMinutesBetweenStamps: program.minMinutesBetweenStamps,
          maxStampsPerDay: program.maxStampsPerDay,
        },
      });
      if (!attempt.ok) {
        if (attempt.reason === "too_soon") {
          throw new AntifraudError("too_soon", attempt.retryAt);
        }
        throw new AntifraudError("daily_limit");
      }

      const newStamps = Math.min(prevStamps + 1, program.stampsRequired);
      const complete = newStamps >= program.stampsRequired;
      const idempotencyKey = `${customerId}_${qrWindow}`;

      tx.set(visitRef, {
        customerId,
        personUid: phoneUid,
        phoneE164,
        locationId,
        programId: program.id,
        method: "customer_scan",
        visitedAt: FieldValue.serverTimestamp(),
        dayKey: todayKey,
        idempotencyKey,
        qrWindow,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.set(
        cardRef,
        {
          programId: program.id,
          stamps: newStamps,
          currentDayKey: todayKey,
          stampsToday: stampsToday + 1,
          lastStampAt: FieldValue.serverTimestamp(),
          completedAt: complete
            ? (cardData.completedAt ?? FieldValue.serverTimestamp())
            : null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      const prevCustomer = (existing?.data() ?? {}) as {
        displayName?: string;
        marketingOptIn?: boolean;
        marketingOptInAt?: unknown;
        visitCount?: number;
      };
      const isNewCustomer = !existing;
      tx.set(
        customerRef,
        {
          personUid: phoneUid,
          phoneE164,
          displayName: displayName ?? prevCustomer.displayName ?? "Cliente",
          visitCount: (prevCustomer.visitCount ?? 0) + 1,
          lastVisitAt: FieldValue.serverTimestamp(),
          status: "active",
          // El consentimiento solo se eleva por acá; la baja vive en el perfil.
          marketingOptIn: prevCustomer.marketingOptIn || marketingOptIn,
          marketingOptInAt:
            !prevCustomer.marketingOptIn && marketingOptIn
              ? FieldValue.serverTimestamp()
              : (prevCustomer.marketingOptInAt ?? null),
          updatedAt: FieldValue.serverTimestamp(),
          ...(isNewCustomer
            ? { createdAt: FieldValue.serverTimestamp() }
            : null),
        },
        { merge: true },
      );

      const progress = cardProgress(newStamps, program.stampsRequired);
      return {
        alreadyCounted: false as const,
        customerId,
        visitId: visitRef.id,
        stamps: progress.stamps,
        progress,
      };
    });

    return NextResponse.json({
      ok: true,
      ...result,
      required: program.stampsRequired,
      rewardName: program.rewardName,
    });
  } catch (error) {
    if (error instanceof AntifraudError) {
      if (error.reason === "too_soon") {
        return NextResponse.json(
          {
            error: "Ya sumaste un sello hace poco. Te esperamos en un rato.",
            reason: "too_soon",
            retryAt: error.retryAt?.toISOString() ?? null,
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        {
          error: "Ya sumaste tu sello de hoy. ¡Te esperamos mañana!",
          reason: "daily_limit",
        },
        { status: 429 },
      );
    }
    console.error("[api/visits/scan] falló el registro", error);
    return NextResponse.json(
      { error: "No pudimos sumar tu sello. Probá de nuevo en un momento." },
      { status: 500 },
    );
  }
}
