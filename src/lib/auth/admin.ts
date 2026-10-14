import "server-only";

import { redirect } from "next/navigation";

import { requireSession } from "./session";

/** Mails que administran la plataforma (coma separados en ADMIN_EMAILS). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/** Solo el administrador: crea cafés y cuentas. */
export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminEmail(session.email)) redirect("/dashboard");
  return session;
}
