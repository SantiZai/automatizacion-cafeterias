import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ChevronLeft, X } from "lucide-react";

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
import { listPendingClaims } from "@/lib/data/claims";
import { approveClaimAction, rejectClaimAction } from "./actions";

export const metadata: Metadata = { title: "Aprobar sellos extra" };

const KIND_LABEL: Record<string, string> = {
  google_review: "Reseña en Google · +2",
  instagram_story: "Historia · +1",
};

export default async function ApprovePage() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

  const pending = await listPendingClaims(cafe.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Volver al inicio">
          <Link href="/dashboard">
            <ChevronLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Aprobar sellos extra</h1>
          <p className="mt-1 text-muted-foreground">
            El cliente dice que dejó reseña o subió historia. Vos confirmás en
            el mostrador con un toque.
          </p>
        </div>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin pendientes</CardTitle>
            <CardDescription>
              Cuando un cliente pida sellos extra desde su tarjeta, lo ves acá.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {pending.map((claim) => (
            <li key={claim.id}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {KIND_LABEL[claim.kind] ?? claim.kind}
                    </Badge>
                    <CardTitle className="text-xl">{claim.displayName}</CardTitle>
                  </div>
                  <CardDescription>
                    Pide +{claim.stampsRequested}{" "}
                    {claim.stampsRequested === 1 ? "sello" : "sellos"}
                    {claim.evidenceUrl ? ` · ${claim.evidenceUrl}` : " · sin link"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <form action={approveClaimAction.bind(null, claim.id)}>
                    <Button type="submit" size="sm">
                      <Check aria-hidden="true" />
                      Aprobar +{claim.stampsRequested}
                    </Button>
                  </form>
                  <form action={rejectClaimAction.bind(null, claim.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      <X aria-hidden="true" />
                      Rechazar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
