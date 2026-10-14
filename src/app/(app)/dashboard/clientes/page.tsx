import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireSession } from "@/lib/auth/session";
import { getUserCafe } from "@/lib/data/cafes";
import { searchCustomers } from "@/lib/data/customers";

export const metadata: Metadata = { title: "Clientes" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function relativeDay(iso: string | null): string {
  if (!iso) return "sin visitas aún";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

  const q = ((await searchParams).q ?? "").trim();
  const customers = await searchCustomers(cafe.id, q);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Clientes</h1>
        <p className="mt-1 text-muted-foreground">
          Quién viene, cada cuánto y qué le gusta.
        </p>
      </div>

      <form method="get" className="relative max-w-md" role="search">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o teléfono…"
          aria-label="Buscar cliente"
          className="pl-9"
        />
      </form>

      {customers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{q ? "Sin coincidencias" : "Todavía no hay clientes"}</CardTitle>
            <CardDescription>
              {q
                ? `Nadie coincide con “${q}”. Probá con otro nombre o teléfono.`
                : "Cuando tus clientes escaneen el QR, vas a verlos acá con sus visitas y gustos."}
            </CardDescription>
          </CardHeader>
          {!q ? (
            <CardContent>
              <Link
                href="/dashboard/qr"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Mostrar el QR del mostrador
              </Link>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/dashboard/clientes/${customer.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/20 font-semibold text-primary"
                >
                  {initials(customer.displayName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {customer.displayName}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {customer.visitCount}{" "}
                    {customer.visitCount === 1 ? "visita" : "visitas"} ·{" "}
                    {relativeDay(customer.lastVisitAt)}
                  </span>
                </span>
                {customer.status !== "active" ? (
                  <Badge variant="secondary">{customer.status}</Badge>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
