import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import { RedeemClient } from "./redeem-client";

export const metadata: Metadata = { title: "Canjear premio" };

export default async function RedeemPage() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Volver al inicio">
          <Link href="/dashboard">
            <ChevronLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Canjear premio</h1>
          <p className="mt-1 text-muted-foreground">
            El cliente te muestra su código y vos lo confirmás acá.
          </p>
        </div>
      </div>

      <RedeemClient />
    </div>
  );
}
