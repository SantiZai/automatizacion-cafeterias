import type { Metadata } from "next";
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
import { getUserCafe } from "@/lib/data/cafes";

export const metadata: Metadata = { title: "Inicio" };

const stats = [
  { label: "Visitas hoy", value: "0" },
  { label: "Clientes activos", value: "0" },
  { label: "Oportunidades", value: "0" },
];

const steps = [
  { label: "Creaste tu café y tu tarjeta de sellos", done: true },
  { label: "Imprimí el QR del mostrador", done: false },
  { label: "Hacé una visita de prueba con tu celular", done: false },
  { label: "Invitá a tu equipo", done: false },
];

export default async function DashboardPage() {
  const session = await requireSession();
  const cafe = await getUserCafe(session.uid);
  if (!cafe) redirect("/onboarding");

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
                <span className={step.done ? "text-muted-foreground line-through" : ""}>
                  {step.label}
                </span>
                {step.done ? (
                  <span className="sr-only">(completado)</span>
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
