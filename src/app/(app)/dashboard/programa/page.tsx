import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import { getActiveProgram } from "@/lib/data/programs";
import { ProgramForm } from "./program-form";

export const metadata: Metadata = { title: "Promo de sellos" };

export default async function ProgramPage() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

  const program = await getActiveProgram(cafe.id);
  if (!program) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Volver al inicio">
          <Link href="/dashboard">
            <ChevronLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Promo de sellos</h1>
          <p className="mt-1 text-muted-foreground">
            Cambiá la promo y se actualiza en todos lados al guardar.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{program.name}</CardTitle>
          <CardDescription>
            Si bajás los sellos necesarios, quien los supere queda en el tope
            listo para canjear. El resto mantiene los que tenía. Si subís el
            requerido, nadie pierde sellos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProgramForm
            initialStampsRequired={program.stampsRequired}
            initialRewardName={program.rewardName}
            initialMinMinutes={program.minMinutesBetweenStamps}
            initialMaxPerDay={program.maxStampsPerDay}
          />
        </CardContent>
      </Card>
    </div>
  );
}
