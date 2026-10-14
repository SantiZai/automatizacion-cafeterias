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
import { getMetrics } from "@/lib/data/metrics";

export const metadata: Metadata = { title: "Métricas" };

function Bar({ value, max }: { value: number; max: number }) {
  const width = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
    </div>
  );
}

export default async function MetricsPage() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

  const metrics = await getMetrics(cafe.id);

  if (metrics.totalCustomers === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Volver al inicio">
            <Link href="/dashboard">
              <ChevronLeft />
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold">Métricas</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Todavía sin datos</CardTitle>
            <CardDescription>
              Cuando tus clientes escaneen el QR y sumen visitas, acá vas a ver
              retención, frecuencia y recuperados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/qr"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Mostrar el QR del mostrador
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = [
    { label: "Clientes activos", value: String(metrics.activeCustomers), hint: "Visitaron los últimos 30 días" },
    { label: "Visitas (30 días)", value: String(metrics.visitsLast30d), hint: "Sellos sumados" },
    { label: "Frecuencia", value: String(metrics.frequency), hint: "Visitas por activo por mes" },
    { label: "En riesgo", value: String(metrics.atRisk), hint: "14+ días sin venir" },
    { label: "Recuperados", value: String(metrics.recovered), hint: "Volvieron tras tu mensaje" },
    {
      label: "Tasa de canje",
      value: `${metrics.redemptionRate}%`,
      hint: `${metrics.redemptionsRedeemed} de ${metrics.redemptionsCreated} códigos`,
    },
  ];

  const retentions = [
    { label: "30 días", ...metrics.retention30 },
    { label: "60 días", ...metrics.retention60 },
    { label: "90 días", ...metrics.retention90 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Volver al inicio">
          <Link href="/dashboard">
            <ChevronLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Métricas</h1>
          <p className="mt-1 text-muted-foreground">
            Qué pasa en {cafe.name}, en números.
          </p>
        </div>
      </div>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((stat) => (
          <Card key={stat.label} className="gap-2">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-4xl tabular-nums">{stat.value}</CardTitle>
              <CardDescription>{stat.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Retención</CardTitle>
          <CardDescription>
            De los que se sumaron hace N días o más, cuántos volvieron al menos
            una vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {retentions.map((ret) => (
            <div key={ret.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{ret.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {ret.eligible === 0
                    ? "sin base todavía"
                    : `${ret.rate}% (${ret.eligible} clientes)`}
                </span>
              </div>
              <Bar value={ret.rate} max={100} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por local</CardTitle>
            <CardDescription>Visitas de los últimos 30 días.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {metrics.byLocation.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin visitas todavía.</p>
            ) : (
              metrics.byLocation.map((loc) => (
                <div key={loc.locationId} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">
                      {metrics.locationNames[loc.locationId] ?? "Mostrador"}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {loc.visits} {loc.visits === 1 ? "visita" : "visitas"}
                    </span>
                  </div>
                  <Bar value={loc.visits} max={metrics.byLocation[0]?.visits ?? 1} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Boca en boca</CardTitle>
            <CardDescription>Premios por reseñas e historias (30 días).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Reseñas en Google</span>
              <span className="tabular-nums text-muted-foreground">
                {metrics.reviewsLast30d}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Historias</span>
              <span className="tabular-nums text-muted-foreground">
                {metrics.storiesLast30d}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cohortes por mes de alta</CardTitle>
          <CardDescription>
            Cuántos de cada mes volvieron al menos una vez.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Mes</th>
                    <th className="py-2 pr-4 font-medium">Clientes</th>
                    <th className="py-2 pr-4 font-medium">Volvieron</th>
                    <th className="py-2 font-medium">Retención</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.cohorts.map((cohort) => (
                    <tr key={cohort.month} className="border-t">
                      <td className="py-2 pr-4 font-medium tabular-nums">{cohort.month}</td>
                      <td className="py-2 pr-4 tabular-nums">{cohort.total}</td>
                      <td className="py-2 pr-4 tabular-nums">{cohort.returned}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-24">
                            <Bar value={cohort.rate} max={100} />
                          </div>
                          <span className="tabular-nums text-muted-foreground">
                            {cohort.rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
