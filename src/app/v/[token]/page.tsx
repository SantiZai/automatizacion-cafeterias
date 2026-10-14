import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCafeQrToken } from "@/lib/server/qr";
import { VisitFlow } from "./visit-flow";

export const metadata: Metadata = { title: "Sumá sellos" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-6 py-12">
      <Logo href="/" />
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

export default async function VisitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);

  let verification: ReturnType<typeof verifyCafeQrToken>;
  try {
    verification = verifyCafeQrToken(decoded);
  } catch (error) {
    console.error("[v/token] falta QR_SIGNING_SECRET", error);
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">No pudimos validar el QR</CardTitle>
            <CardDescription>
              Probá de nuevo en un momento. Si sigue pasando, avisale al equipo
              del café.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (!verification.valid) {
    const expired = verification.reason === "expired";
    return (
      <Shell>
        <Card>
          <CardHeader className="items-center text-center">
            <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              {expired ? (
                <RefreshCw className="size-6 text-primary" aria-hidden="true" />
              ) : (
                <TriangleAlert
                  className="size-6 text-warning"
                  aria-hidden="true"
                />
              )}
            </span>
            <CardTitle className="text-2xl">
              {expired ? "Este código ya se renovó" : "Este código no es válido"}
            </CardTitle>
            <CardDescription className="text-base">
              {expired
                ? "El QR del mostrador cambia cada 60 segundos. Escaneá de nuevo el código que está en pantalla."
                : "Escaneá el QR del mostrador con la cámara de tu celular para sumar sellos."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <Button asChild size="lg">
              <Link href="/">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const db = adminDb();
  const [cafeSnap, locationSnap] = await Promise.all([
    db.doc(`cafes/${verification.cafeId}`).get(),
    db.doc(`cafes/${verification.cafeId}/locations/${verification.locationId}`).get(),
  ]);

  if (!cafeSnap.exists) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Este café ya no está disponible</CardTitle>
            <CardDescription>
              El código es válido pero el café no existe. Avisale al equipo del
              local.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  const cafeName = (cafeSnap.data()?.name as string) ?? "tu café";
  const locationName = locationSnap.exists
    ? ((locationSnap.data()?.name as string) ?? "Mostrador")
    : "Mostrador";

  return (
    <Shell>
      <VisitFlow
        qrToken={decoded}
        cafeId={verification.cafeId}
        cafeName={cafeName}
        locationName={locationName}
      />
    </Shell>
  );
}
