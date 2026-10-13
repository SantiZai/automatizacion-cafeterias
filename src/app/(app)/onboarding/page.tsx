import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Creá tu café" };

export default async function OnboardingPage() {
  const session = await requireSession();
  if (await getUserCafe(session.uid)) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Empecemos por tu café</CardTitle>
          <CardDescription>
            Con tres datos armamos tu primera tarjeta de sellos. Después podés
            cambiarlo cuando quieras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}
