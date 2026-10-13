import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Logo } from "@/components/brand/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/constants";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);

  // Si ya hay una sesión válida, no mostramos el login
  if (await getSession()) redirect(next);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12">
      <Logo />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Ingresá a tu cafetería</CardTitle>
          <CardDescription>
            Usá tu cuenta de Google para entrar o crear tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <GoogleSignInButton next={next} />
          <p className="text-center text-xs text-muted-foreground">
            Al continuar aceptás los términos del servicio y la política de
            privacidad.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
