import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "./constants";

export type Session = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

/**
 * Devuelve la sesión del usuario a partir de la cookie, o null.
 * Verifica firma, vencimiento y revocación contra Firebase Auth.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
      picture: (decoded.picture as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
});

/** Para páginas y acciones que requieren usuario autenticado. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
