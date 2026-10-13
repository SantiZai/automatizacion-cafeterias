import { NextResponse } from "next/server";
import { z } from "zod";

import { adminAuth } from "@/lib/firebase/admin";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";

const bodySchema = z.object({ idToken: z.string().min(20) });

// Crea la cookie de sesión a partir del ID token que entrega Firebase Auth
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  try {
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(parsed.data.idToken);

    // Solo se canjea un token de un inicio de sesión reciente (últimos 5 minutos)
    const secondsSinceSignIn = Date.now() / 1000 - decoded.auth_time;
    if (secondsSinceSignIn > 5 * 60) {
      return NextResponse.json(
        { error: "Volvé a iniciar sesión" },
        { status: 401 },
      );
    }

    const sessionCookie = await auth.createSessionCookie(parsed.data.idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    // Queda en la terminal del servidor para poder diagnosticar
    console.error("[auth/session] no se pudo crear la sesión", error);
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}

// Cierra sesión: borra la cookie
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}