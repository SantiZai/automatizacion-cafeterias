import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

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
import { getCustomerDetail } from "@/lib/data/customers";
import { NotesForm } from "./notes-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Ficha de cliente" };

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

  const { id } = await params;
  const customer = await getCustomerDetail(cafe.id, id);
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Volver a clientes">
          <Link href="/dashboard/clientes">
            <ChevronLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold">{customer.displayName}</h1>
          <p className="mt-1 text-muted-foreground">
            {customer.phoneE164 || "Sin teléfono"} ·{" "}
            {customer.visitCount} {customer.visitCount === 1 ? "visita" : "visitas"}
            {customer.marketingOptIn ? " · Recibe promos" : null}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                Tarjeta: {customer.card.stamps} de {customer.card.required} sellos
              </CardTitle>
              <CardDescription>
                {customer.card.complete
                  ? `Premio listo: ${customer.rewardName}.`
                  : `Le faltan ${customer.card.remaining} para ${customer.rewardName}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div
                className="flex flex-wrap gap-2"
                role="img"
                aria-label={`${customer.card.stamps} de ${customer.card.required} sellos`}
              >
                {Array.from({ length: customer.card.required }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={
                      i < customer.card.stamps
                        ? "size-6 rounded-full bg-accent"
                        : "size-6 rounded-full border-2 border-dashed border-muted-foreground/40"
                    }
                  />
                ))}
              </div>
              {customer.card.nearReward && !customer.card.complete ? (
                <div>
                  <Badge variant="secondary">A un paso del premio</Badge>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pedido y gustos</CardTitle>
              <CardDescription>
                Lo que el equipo tiene que recordar cuando entra por la puerta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                customerId={customer.id}
                initialUsualOrder={customer.usualOrder}
                initialTastes={customer.tastes}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Notas del equipo</CardTitle>
              <CardDescription>
                Solo las ve tu equipo, nunca el cliente ni otros cafés.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <NotesForm customerId={customer.id} />
              {customer.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin notas todavía. Ej.: “Viene con su abuela los domingos”.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {customer.notes.map((note) => (
                    <li key={note.id} className="rounded-lg bg-muted p-3">
                      <p className="text-sm leading-relaxed">{note.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {note.authorName ?? "Equipo"} · {formatDateTime(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimas visitas</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.visits.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin visitas registradas.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {customer.visits.map((visit) => (
                    <li
                      key={visit.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span>{visit.locationName ?? "Mostrador"}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatDateTime(visit.visitedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
