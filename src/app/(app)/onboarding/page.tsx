import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isAdminEmail } from "@/lib/auth/admin";
import { requireSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";

export const metadata: Metadata = { title: "Creá tu café" };

// El alta la hace el administrador desde /admin. Esta página solo avisa.
export default async function OnboardingPage() {
  const session = await requireSession();
  if (await getUserCafe(session.uid)) redirect("/dashboard");
  if (isAdminEmail(session.email)) redirect("/admin");

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Tu cuenta aún no tiene café</CardTitle>
          <CardDescription>
            Las cuentas las crea el administrador. Pedile que te asigne tu
            local y volvé a entrar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{session.email}</p>
        </CardContent>
      </Card>
    </div>
  );
}
