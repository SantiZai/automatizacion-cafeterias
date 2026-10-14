"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Preview = {
  ok: true;
  code: string;
  rewardName: string;
  customerName: string;
  visitCount: number;
};

export function RedeemClient() {
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{ rewardName: string; customerName: string } | null>(null);

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    if (looking) return;
    setLooking(true);
    setError(null);
    setPreview(null);
    setDone(null);
    try {
      const response = await fetch(
        `/api/redemptions/lookup?code=${encodeURIComponent(code.trim())}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as
        | (Preview & { error?: string })
        | { error?: string }
        | null;
      if (response.ok && data && "ok" in data) {
        setPreview(data);
      } else {
        setError(data?.error ?? "No encontramos ese código. Revisalo con el cliente.");
      }
    } catch (err) {
      console.error("[canjear] falló la búsqueda", err);
      setError("No pudimos buscar el código. Revisá tu conexión.");
    } finally {
      setLooking(false);
    }
  }

  async function handleConfirm() {
    if (!preview || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const response = await fetch("/api/redemptions/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: preview.code }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        rewardName?: string;
        customerName?: string;
        error?: string;
      } | null;
      if (response.ok && data?.ok) {
        setDone({
          rewardName: data.rewardName ?? preview.rewardName,
          customerName: data.customerName ?? preview.customerName,
        });
        setPreview(null);
        setCode("");
      } else {
        const message = data?.error ?? "No pudimos confirmar el canje.";
        setError(message);
        toast.error(message);
      }
    } catch (err) {
      console.error("[canjear] falló la confirmación", err);
      setError("No pudimos confirmar el canje. Probá de nuevo.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      {done ? (
        <Card>
          <CardHeader className="items-center text-center">
            <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent/20">
              <CheckCircle2 className="size-6 text-primary" aria-hidden="true" />
            </span>
            <CardTitle className="text-2xl">Canje listo</CardTitle>
            <CardDescription className="text-base">
              {done.rewardName} para {done.customerName}. La tarjeta empieza de
              nuevo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => setDone(null)}>
              Canjear otro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Código del cliente</CardTitle>
            <CardDescription>
              Pedile que te muestre o dicte el código de 6 letras. Vale 2 minutos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLookup} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="redeem-code">Código</Label>
                <Input
                  id="redeem-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="ABC-DEF"
                  autoComplete="off"
                  className="text-lg tracking-widest uppercase"
                  maxLength={12}
                  required
                />
              </div>
              <div>
                <Button type="submit" disabled={looking}>
                  {looking ? <Loader2 className="animate-spin" /> : null}
                  Buscar premio
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>¿Confirmar canje?</CardTitle>
            <CardDescription>
              {preview.rewardName} · {preview.customerName} ·{" "}
              {preview.visitCount} {preview.visitCount === 1 ? "visita" : "visitas"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={handleConfirm} disabled={confirming} size="lg">
              {confirming ? <Loader2 className="animate-spin" /> : null}
              Confirmar entrega
            </Button>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancelar
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
