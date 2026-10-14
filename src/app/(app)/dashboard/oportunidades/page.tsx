import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { listOpportunities } from "@/lib/data/opportunities";
import {
  dismissOpportunityAction,
  markOpportunitySentAction,
  refreshOpportunitiesAction,
} from "./actions";
import { CopyMessageButton } from "./copy-button";

export const metadata: Metadata = { title: "Oportunidades" };

const KIND_LABEL: Record<string, string> = {
  absence: "Hace días que no viene",
  near_reward: "A un paso del premio",
  birthday: "Cumpleaños",
};

export default async function OpportunitiesPage() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

  const opportunities = await listOpportunities(cafe.id, "open");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Volver al inicio">
          <Link href="/dashboard">
            <ChevronLeft />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold">Oportunidades</h1>
          <p className="mt-1 text-muted-foreground">
            Clientes para invitar a volver, con el mensaje ya listo.
          </p>
        </div>
        <form action={refreshOpportunitiesAction}>
          <Button type="submit" variant="outline">
            <RefreshCw aria-hidden="true" />
            Buscar
          </Button>
        </form>
      </div>

      {opportunities.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Todo en orden</CardTitle>
            <CardDescription>
              Hoy no hay clientes por recuperar. Tocá Buscar para revisar de
              nuevo: miramos ausencias de 14+ días, premios a 1-2 sellos y
              cumpleaños.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/clientes"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver clientes
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {opportunities.map((opp) => (
            <li key={opp.id}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {KIND_LABEL[opp.kind] ?? opp.kind}
                    </Badge>
                    <CardTitle className="text-xl">{opp.displayName}</CardTitle>
                  </div>
                  <CardDescription>
                    {opp.kind === "absence" && opp.daysSince != null
                      ? `Hace ${opp.daysSince} días que no viene · `
                      : null}
                    {opp.kind === "near_reward" && opp.remaining != null
                      ? `Le faltan ${opp.remaining} sellos · `
                      : null}
                    Tocá Copiar y mandalo por WhatsApp a mano. Después marcalo
                    como enviado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="rounded-xl bg-muted p-4 text-[15px] leading-relaxed">
                    “{opp.message}”
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <CopyMessageButton message={opp.message} />
                    <form action={markOpportunitySentAction.bind(null, opp.id)}>
                      <Button type="submit" size="sm">
                        Marcar enviado
                      </Button>
                    </form>
                    <form action={dismissOpportunityAction.bind(null, opp.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Descartar
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
