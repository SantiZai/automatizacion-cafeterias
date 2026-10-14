import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { getCafeLocations, getUserCafe } from "@/lib/data/cafes";
import { appOrigin, createCafeQr } from "@/lib/server/qr";
import { QrDisplay } from "./qr-display";

export const metadata: Metadata = { title: "QR del mostrador" };

async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export default async function QrPage() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

  const locations = await getCafeLocations(cafe.id);
  if (locations.length === 0) redirect("/dashboard");

  const first = locations[0];
  const initialQr = createCafeQr(
    cafe.id,
    first.id,
    appOrigin(await originFromHeaders()),
  );

  return (
    <div className="flex flex-col gap-6 print:gap-0">
      <div className="flex items-center gap-3 print:hidden">
        <Button asChild variant="ghost" size="icon" aria-label="Volver al inicio">
          <Link href="/dashboard">
            <ChevronLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">QR del mostrador</h1>
          <p className="mt-1 text-muted-foreground">
            El código que tus clientes escanean para sumar sellos.
          </p>
        </div>
      </div>

      <QrDisplay
        cafeName={cafe.name}
        locations={locations}
        initialLocationId={first.id}
        initialQr={initialQr}
      />
    </div>
  );
}
