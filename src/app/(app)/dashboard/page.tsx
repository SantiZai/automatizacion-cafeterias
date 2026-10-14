import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { getUserCafe } from "@/lib/data/cafes";
import { getDashboardStats } from "@/lib/data/customers";
import { countOpenOpportunities } from "@/lib/data/opportunities";

export const metadata: Metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

  const statsData = await getDashboardStats(cafe.id, cafe.timezone);
  const openOpportunities = await countOpenOpportunities(cafe.id);
  const showAdmin = isAdminEmail(session.email);
  const stats = [
    { label: "Visitas hoy", value: String(statsData.visitsToday) },
    { label: "Clientes activos", value: String(statsData.activeCustomers) },
    { label: "Oportunidades", value: String(openOpportunities) },
  ];
  const hasVisit = statsData.totalVisits > 0;
  const steps = [
    { label: "Creaste tu café y tu tarjeta de sellos", done: true, href: null as string | null },
    { label: "Mostrá el QR del mostrador", done: false, href: "/dashboard/qr" as string | null },
    hasVisit
      ? { label: "Sumaste tu primera visita", done: true, href: null as string | null }
      : { label: "Hacé una visita de prueba con tu celular", done: false, href: "/dashboard/qr" as string | null },
    { label: "Conocé a tus clientes", done: false, href: (hasVisit ? "/dashboard/clientes" : null) as string | null },
  ];

  const firstName = session.name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold">
          {firstName ? `Hola, ${firstName}` : "Hola"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Así va <span className="font-medium text-foreground">{cafe.name}</span> hoy.
        </p>
      </div>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-2">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-4xl tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section aria-label="Accesos" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/oportunidades"
          className="rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          Oportunidades
          <span className="block text-sm font-normal text-muted-foreground">
            {openOpportunities === 0
              ? "Sin pendientes por ahora"
              : `${openOpportunities} para revisar`}
          </span>
        </Link>
        <Link
          href="/dashboard/qr"
          className="rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          QR del mostrador
          <span className="block text-sm font-normal text-muted-foreground">
            Para la tablet o para imprimir
          </span>
        </Link>
        <Link
          href="/dashboard/clientes"
          className="rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          Clientes
          <span className="block text-sm font-normal text-muted-foreground">
            Fichas, gustos y notas
          </span>
        </Link>
        <Link
          href="/dashboard/canjear"
          className="rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          Canjear premio
          <span className="block text-sm font-normal text-muted-foreground">
            Validá el código del cliente
          </span>
        </Link>
        <Link
          href="/dashboard/aprobar"
          className="rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          Aprobar sellos
          <span className="block text-sm font-normal text-muted-foreground">
            Reseñas e historias pendientes
          </span>
        </Link>
        <Link
          href="/dashboard/programa"
          className="rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          Promo de sellos
          <span className="block text-sm font-normal text-muted-foreground">
            Sellos, premio y antifraude
          </span>
        </Link>
        <Link
          href="/dashboard/cuenta"
          className="rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          Mi cuenta
          <span className="block text-sm font-normal text-muted-foreground">
            Cambiar contraseña
          </span>
        </Link>
        <Link
          href="/dashboard/metricas"
          className="rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          Métricas
          <span className="block text-sm font-normal text-muted-foreground">
            Retención y frecuencia
          </span>
        </Link>
        {showAdmin ? (
          <Link
            href="/admin"
            className="rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            Administración
            <span className="block text-sm font-normal text-muted-foreground">
              Cafés y cuentas
            </span>
          </Link>
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Primeros pasos</CardTitle>
          <CardDescription>
            Completá estos pasos para que tus clientes empiecen a sumar sellos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-3">
                {step.done ? (
                  <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" aria-hidden="true" />
                )}
                {step.href && !step.done ? (
                  <Link
                    href={step.href}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {step.label}
                  </Link>
                ) : (
                  <span className={step.done ? "text-muted-foreground line-through" : ""}>
                    {step.label}
                  </span>
                )}
                {step.done ? (
                  <span className="sr-only">(completado)</span>
                ) : step.href ? (
                  <Badge variant="secondary" className="ml-auto">
                    Ver ahora
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-auto">
                    Próximamente
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
