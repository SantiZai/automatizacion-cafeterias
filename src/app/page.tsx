import Link from "next/link";
import { BellRing, NotebookPen, QrCode } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: QrCode,
    title: "Sellos por QR, sin descargas",
    text: "Tus clientes escanean el código del mostrador y suman sellos desde el navegador. Sin app y sin tarjetas de papel.",
  },
  {
    icon: NotebookPen,
    title: "Cada cliente, recordado",
    text: "Pedido habitual, gustos y notas del equipo en una ficha. Que quien atiende sepa quién entra por la puerta.",
  },
  {
    icon: BellRing,
    title: "El momento justo para invitar",
    text: "Cumpleaños, ausencias y premios cercanos aparecen con el mensaje listo para enviar por WhatsApp.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/login">Ingresar</Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        <section className="py-16 text-center md:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold text-balance md:text-6xl">
            Convertí cada visita en un cliente que vuelve
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">
            Sellos por QR, memoria de cada cliente y mensajes preparados para tu
            cafetería. Todo en un solo lugar y pensado para el mostrador.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">Empezar gratis</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#como-funciona">Cómo funciona</a>
            </Button>
          </div>
        </section>

        <section id="como-funciona" className="grid gap-4 pb-20 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <CardHeader>
                <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-accent/20">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                </span>
                <CardTitle>{title}</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  {text}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Cafelink · Hecho en Argentina
      </footer>
    </div>
  );
}
