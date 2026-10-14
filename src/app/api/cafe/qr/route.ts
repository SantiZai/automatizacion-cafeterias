import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { getCafeLocations, getUserCafe } from "@/lib/data/cafes";
import { appOrigin, createCafeQr } from "@/lib/server/qr";

const querySchema = z.object({
  locationId: z.string().min(1).max(64).optional(),
});

function originOf(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

// Devuelve el QR vigente del mostrador. El navegador lo refresca cada 60 s.
// El café se deriva de la sesión (no se acepta cafeId del cliente).
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    locationId: new URL(request.url).searchParams.get("locationId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const cafe = await getUserCafe(session.uid);
  if (!cafe) {
    return NextResponse.json(
      { error: "Todavía no creaste tu café" },
      { status: 404 },
    );
  }

  const locations = await getCafeLocations(cafe.id);
  if (locations.length === 0) {
    return NextResponse.json(
      { error: "Tu café no tiene locales. Creá uno para mostrar el QR." },
      { status: 404 },
    );
  }

  const location =
    locations.find((loc) => loc.id === parsed.data.locationId) ?? locations[0];

  try {
    const qr = createCafeQr(cafe.id, location.id, appOrigin(originOf(request)));
    return NextResponse.json({
      cafeId: cafe.id,
      cafeName: cafe.name,
      locationId: location.id,
      locationName: location.name,
      ...qr,
    });
  } catch (error) {
    console.error("[api/cafe/qr] no se pudo firmar el QR", error);
    return NextResponse.json(
      { error: "No pudimos generar el QR. Probá de nuevo en un momento." },
      { status: 500 },
    );
  }
}
