"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Copy, Loader2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { QR_TTL_SECONDS } from "@/domain/qr-token";
import type { CafeLocation } from "@/lib/data/cafes";

type QrPayload = {
  token: string;
  scanUrl: string;
  expiresAt: string;
  ttlSeconds: number;
};

function secondsLeftUntil(expiresAt: string, now: number): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
}

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  return `0:${String(clamped).padStart(2, "0")}`;
}

export function QrDisplay({
  cafeName,
  locations,
  initialLocationId,
  initialQr,
}: {
  cafeName: string;
  locations: CafeLocation[];
  initialLocationId: string;
  initialQr: QrPayload;
}) {
  const [locationId, setLocationId] = useState(initialLocationId);
  const [qr, setQr] = useState<QrPayload>(initialQr);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const qrTokenRef = useRef(initialQr.token);

  const locationName =
    locations.find((loc) => loc.id === locationId)?.name ?? "Mostrador";

  const refresh = useCallback(
    async (nextLocationId: string, opts?: { notify?: boolean }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRefreshing(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/cafe/qr?locationId=${encodeURIComponent(nextLocationId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error(`qr-${response.status}`);
        const data = (await response.json()) as QrPayload;
        const isSameQr = data.token === qrTokenRef.current;
        qrTokenRef.current = data.token;
        setQr(data);
        setNow(Date.now());
        if (opts?.notify) {
          if (isSameQr) {
            const leftSeconds = secondsLeftUntil(data.expiresAt, Date.now());
            toast.success(
              `Ya tenés el QR vigente. Se renueva solo en ${formatCountdown(leftSeconds)}.`,
            );
          } else {
            toast.success("QR renovado.");
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        console.error("[qr] no se pudo renovar", err);
        const message =
          "No pudimos renovar el QR. Revisá tu conexión e intentá de nuevo.";
        setError(message);
        toast.error(message);
      } finally {
        if (abortRef.current === controller) setRefreshing(false);
      }
    },
    [],
  );

  // Reloj de 1 s + renovación automática al vencer.
  // El refresh vive dentro del callback del intervalo (sistema externo),
  // no directo en el cuerpo del efecto.
  const liveRef = useRef({ locationId, refreshing, error, expiresAt: qr.expiresAt });

  useEffect(() => {
    liveRef.current = { locationId, refreshing, error, expiresAt: qr.expiresAt };
  });

  useEffect(() => {
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      const live = liveRef.current;
      if (
        secondsLeftUntil(live.expiresAt, current) <= 0 &&
        !live.refreshing &&
        !live.error
      ) {
        void refresh(live.locationId);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  // Si el QR del servidor llega vencido (pestaña abierta), renovar al montar.
  useEffect(() => {
    if (secondsLeftUntil(initialQr.expiresAt, Date.now()) <= 0) {
      const timeout = setTimeout(() => {
        void refresh(initialLocationId);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [initialQr.expiresAt, initialLocationId, refresh]);

  function handleLocationChange(nextLocationId: string) {
    setLocationId(nextLocationId);
    void refresh(nextLocationId);
  }

  function handleManualRefresh() {
    void refresh(locationId, { notify: true });
  }

  const left = secondsLeftUntil(qr.expiresAt, now);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(qr.scanUrl);
      toast.success(
        "Link copiado. Ojo: vence en menos de 1 minuto. Para clientes, que escaneen el QR en pantalla.",
      );
    } catch {
      toast.error("No pudimos copiar el link en este navegador.");
    }
  }

  const progress = Math.min(100, (left / (qr.ttlSeconds || QR_TTL_SECONDS)) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] print:hidden">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl">{cafeName}</CardTitle>
            <CardDescription>
              {locationName} · Mostrá este código en el mostrador. Se renueva
              solo cada 60 segundos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5 pb-8">
            <div
              className="rounded-2xl border bg-white p-5 shadow-sm"
              role="img"
              aria-label={`Código QR de ${cafeName} para sumar sellos`}
            >
              <QRCode value={qr.scanUrl} size={248} />
            </div>

            <div className="w-full max-w-xs" aria-live="polite">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Se renueva en</span>
                <span className="font-semibold tabular-nums">
                  {formatCountdown(left)}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={qr.ttlSeconds || QR_TTL_SECONDS}
                aria-valuenow={left}
                aria-label="Tiempo hasta renovar el QR"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-center text-sm text-destructive">
                {error}{" "}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={handleManualRefresh}
                >
                  Probar de nuevo
                </button>
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleManualRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
                Renovar ahora
              </Button>
              <Button type="button" variant="outline" onClick={handleCopy}>
                <Copy />
                Copiar link
              </Button>
              <Button type="button" onClick={() => window.print()}>
                <Printer />
                Imprimir
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {locations.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Local</CardTitle>
                <CardDescription>
                  Cada local tiene su propio QR.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="location">Elegí el local en pantalla</Label>
                <select
                  id="location"
                  value={locationId}
                  onChange={(event) => handleLocationChange(event.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>¿Cómo se usa?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                1. Dejá esta pantalla abierta en la tablet del mostrador, con
                brillo alto.
              </p>
              <p>
                2. El cliente escanea con la cámara del celular y suma su
                sello sin instalar nada.
              </p>
              <p>
                3. Si alguien le saca una foto al QR, no le sirve: deja de
                funcionar al renovarse.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Versión imprimible: solo aparece al imprimir o guardar como PDF */}
      <div className="hidden print:block">
        <div className="flex min-h-[90vh] flex-col items-center justify-center gap-6 text-center">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">
            {locationName}
          </p>
          <h1 className="text-4xl font-semibold">{cafeName}</h1>
          <p className="text-lg text-muted-foreground">
            Escaneá con tu cámara y sumá sellos
          </p>
          <QRCode value={qr.scanUrl} size={420} />
          <p className="max-w-md text-sm text-muted-foreground">
            Este código impreso también suma sellos. Para mayor seguridad,
            mostrá el QR de la pantalla: cambia cada 60 segundos.
          </p>
        </div>
      </div>
    </div>
  );
}
