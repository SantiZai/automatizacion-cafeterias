"use client";

import { useEffect, useRef, useState } from "react";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  type User,
} from "firebase/auth";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { formatRedemptionCode } from "@/domain/redemption";
import { getFirebaseAuth } from "@/lib/firebase/client";

type ScanResult = {
  ok: true;
  alreadyCounted: boolean;
  visitId: string;
  stamps: number;
  required: number;
  rewardName: string;
  progress: {
    stamps: number;
    required: number;
    remaining: number;
    complete: boolean;
    nearReward: boolean;
  };
};

type ScanError = { message: string; reason?: string };

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  const normalized = cleaned.startsWith("00")
    ? `+${cleaned.slice(2)}`
    : cleaned;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

export function VisitFlow({
  qrToken,
  cafeId,
  cafeName,
  locationName,
}: {
  qrToken: string;
  cafeId: string;
  cafeName: string;
  locationName: string;
}) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [step, setStep] = useState<"join" | "otp" | "done">("join");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [otp, setOtp] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<ScanError | null>(null);
  const [redeem, setRedeem] = useState<
    | { stage: "idle" }
    | { stage: "creating" }
    | { stage: "code"; code: string; expiresAt: string }
    | { stage: "redeemed" }
    | { stage: "expired" }
    | { stage: "error"; message: string }
  >({ stage: "idle" });
  const [redeemNow, setRedeemNow] = useState(() => Date.now());
  const [claim, setClaim] = useState<
    | { stage: "idle" }
    | { stage: "creating" }
    | { stage: "pending"; kind: string }
    | { stage: "error"; message: string }
  >({ stage: "idle" });

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const autoScannedRef = useRef(false);
  const idTokenRef = useRef<string | null>(null);

  // Sesión de teléfono persistida (Firebase Auth la guarda en el navegador).
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user?.phoneNumber ? user : null);
      setAuthReady(true);
    });
    return () => {
      unsubscribe();
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  async function scanWithToken(idToken: string) {
    idTokenRef.current = idToken;
    setScanning(true);
    setScanError(null);
    try {
      const response = await fetch("/api/visits/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken,
          idToken,
          displayName: displayName.trim() || undefined,
          marketingOptIn: optIn,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | (ScanResult & { error?: string; reason?: string })
        | { error?: string; reason?: string }
        | null;

      if (response.ok && data && "ok" in data) {
        setResult(data);
        setStep("done");
        return;
      }

      const message =
        (data as { error?: string })?.error ??
        "No pudimos sumar tu sello. Probá de nuevo en un momento.";
      const reason = (data as { reason?: string })?.reason;
      setScanError({ message, reason });
      // Siempre a la pantalla final: si no, la visita recurrente queda en el
      // spinner para siempre (el antifraude responde 429 con motivo).
      setStep("done");
      const terminalReasons = ["expired", "daily_limit", "too_soon"];
      if (reason && !terminalReasons.includes(reason)) toast.error(message);
    } catch (error) {
      console.error("[v] falló el registro", error);
      const message = "No pudimos sumar tu sello. Revisá tu conexión.";
      setScanError({ message });
      setStep("done");
    } finally {
      setScanning(false);
    }
  }

  // Visita recurrente: si ya hay sesión, sumar el sello sin pedir nada.
  useEffect(() => {
    if (!authReady || !authUser || autoScannedRef.current || result) return;
    autoScannedRef.current = true;
    const timeout = setTimeout(() => {
      authUser
        .getIdToken()
        .then((idToken) => scanWithToken(idToken))
        .catch(() => {
          setScanError({
            message: "No pudimos verificar tu sesión. Pedí el código de nuevo.",
          });
        });
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, authUser]);

  function ensureRecaptcha(): RecaptchaVerifier {
    if (recaptchaRef.current) return recaptchaRef.current;
    const auth = getFirebaseAuth();
    recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
    return recaptchaRef.current;
  }

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    const name = displayName.trim();
    if (name.length < 2) {
      setFieldError("Contanos tu nombre (mínimo 2 letras).");
      return;
    }
    const phoneE164 = normalizePhone(phone);
    if (!phoneE164) {
      setFieldError(
        "Revisá tu número: tiene que ir con código de país, ej. +54 9 11 1234 5678.",
      );
      return;
    }
    setFieldError(null);
    setSending(true);
    try {
      const verifier = ensureRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(
        getFirebaseAuth(),
        phoneE164,
        verifier,
      );
      setStep("otp");
      toast.success("Te mandamos un código por SMS. Ingresalo acá.");
    } catch (error) {
      console.error("[v] no se pudo mandar el SMS", error);
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setFieldError(
        "No pudimos mandarte el código. Revisá el número e intentá de nuevo.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleConfirmCode(event: React.FormEvent) {
    event.preventDefault();
    if (confirming || !confirmationRef.current) return;
    if (!/^\d{4,8}$/.test(otp.trim())) {
      setFieldError("El código tiene entre 4 y 8 números.");
      return;
    }
    setFieldError(null);
    setConfirming(true);
    try {
      const credential = await confirmationRef.current.confirm(otp.trim());
      const idToken = await credential.user.getIdToken();
      setAuthUser(credential.user);
      await scanWithToken(idToken);
    } catch (error) {
      console.error("[v] código inválido", error);
      setFieldError("Ese código no coincide. Revisalo e intentá de nuevo.");
    } finally {
      setConfirming(false);
    }
  }

  function handleRetry() {
    const idToken = idTokenRef.current;
    if (!idToken) {
      setScanError({ message: "Tu sesión venció. Recargá la página." });
      return;
    }
    void scanWithToken(idToken);
  }

  async function handleClaim(kind: "google_review" | "instagram_story") {
    const idToken = idTokenRef.current;
    if (!idToken) {
      setClaim({ stage: "error", message: "Tu sesión venció. Recargá la página." });
      return;
    }
    setClaim({ stage: "creating" });
    try {
      const response = await fetch("/api/claims/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeId, idToken, kind }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (response.ok && data?.ok) {
        setClaim({ stage: "pending", kind });
      } else {
        setClaim({
          stage: "error",
          message: data?.error ?? "No pudimos pedir el sello extra. Probá de nuevo.",
        });
      }
    } catch (error) {
      console.error("[v] falló el pedido de sello extra", error);
      setClaim({
        stage: "error",
        message: "No pudimos pedir el sello extra. Revisá tu conexión.",
      });
    }
  }

  async function handleCreateCode() {
    const idToken = idTokenRef.current;
    if (!idToken) {
      setRedeem({ stage: "error", message: "Tu sesión venció. Recargá la página." });
      return;
    }
    setRedeem({ stage: "creating" });
    try {
      const response = await fetch("/api/redemptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeId, idToken }),
      });
      const data = (await response.json().catch(() => null)) as {
        code?: string;
        expiresAt?: string;
        error?: string;
      } | null;
      if (response.ok && data?.code && data?.expiresAt) {
        setRedeem({ stage: "code", code: data.code, expiresAt: data.expiresAt });
        setRedeemNow(Date.now());
      } else {
        setRedeem({
          stage: "error",
          message: data?.error ?? "No pudimos generar el código. Probá de nuevo.",
        });
      }
    } catch (error) {
      console.error("[v] falló el código de canje", error);
      setRedeem({
        stage: "error",
        message: "No pudimos generar el código. Revisá tu conexión.",
      });
    }
  }

  // Espera del canje: pregunta el estado cada 5 s hasta que se confirme o venza.
  const redeemLiveRef = useRef({ cafeId, code: "", active: false });
  useEffect(() => {
    redeemLiveRef.current = {
      cafeId,
      code: redeem.stage === "code" ? redeem.code : "",
      active: redeem.stage === "code",
    };
  });

  useEffect(() => {
    const id = setInterval(() => {
      setRedeemNow(Date.now());
      const live = redeemLiveRef.current;
      const idToken = idTokenRef.current;
      if (!live.active || !live.code || !idToken) return;
      void fetch("/api/redemptions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeId: live.cafeId, idToken, code: live.code }),
      })
        .then((res) => res.json().catch(() => null) as Promise<{ status?: string } | null>)
        .then((data) => {
          if (data?.status === "redeemed") setRedeem({ stage: "redeemed" });
          else if (data?.status === "expired") setRedeem({ stage: "expired" });
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // --- Pantalla final: tarjeta, premio cercano o errores terminales ---
  if (step === "done" && (result || scanError)) {
    if (result) {
      const { progress, rewardName, alreadyCounted } = result;
      return (
        <Card>
          <CardHeader className="items-center text-center">
            <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent/20">
              <CheckCircle2 className="size-6 text-primary" aria-hidden="true" />
            </span>
            <CardTitle className="text-2xl">
              {alreadyCounted
                ? "Este QR ya sumó tu sello"
                : progress.complete
                  ? "¡Premio desbloqueado!"
                  : "¡Sello sumado!"}
            </CardTitle>
            <CardDescription className="text-base">
              {cafeName} · {locationName}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div
              className="flex flex-wrap justify-center gap-2"
              role="img"
              aria-label={`${progress.stamps} de ${progress.required} sellos`}
            >
              {Array.from({ length: progress.required }, (_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={
                    i < progress.stamps
                      ? "size-6 rounded-full bg-accent"
                      : "size-6 rounded-full border-2 border-dashed border-muted-foreground/40"
                  }
                />
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {progress.complete ? (
                <>Mostrá esta pantalla en el mostrador para canjear: {rewardName}.</>
              ) : (
                <>
                  Llevás {progress.stamps} de {progress.required} sellos. Te
                  faltan {progress.remaining} para {rewardName}.
                </>
              )}
            </p>
            {progress.nearReward && !progress.complete ? (
              <Badge variant="secondary">¡Te falta poco!</Badge>
            ) : null}
            {!progress.complete ? (
              <div className="flex w-full flex-col items-center gap-3 border-t pt-4">
                <p className="text-sm font-medium">Sumá sellos extra</p>
                {claim.stage === "pending" ? (
                  <p role="status" className="text-center text-sm text-muted-foreground">
                    Pedido enviado. Mostralo en el mostrador para que te lo
                    aprueben y sumás al instante.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={claim.stage === "creating"}
                        onClick={() => handleClaim("google_review")}
                      >
                        {claim.stage === "creating" ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : null}
                        Reseña en Google +2
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={claim.stage === "creating"}
                        onClick={() => handleClaim("instagram_story")}
                      >
                        {claim.stage === "creating" ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : null}
                        Historia +1
                      </Button>
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      Dejá la reseña o subí la historia y pedilo acá. El equipo
                      lo confirma en el momento.
                    </p>
                  </>
                )}
                {claim.stage === "error" ? (
                  <p role="alert" className="text-center text-sm text-destructive">
                    {claim.message}
                  </p>
                ) : null}
              </div>
            ) : null}
            {progress.complete ? (
              <div className="flex w-full flex-col items-center gap-3 border-t pt-4">
                {redeem.stage === "idle" || redeem.stage === "error" ? (
                  <>
                    {redeem.stage === "error" ? (
                      <p role="alert" className="text-sm text-destructive">
                        {redeem.message}
                      </p>
                    ) : null}
                    <Button onClick={handleCreateCode} size="lg">
                      Generar código de canje
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Vale 2 minutos. Mostralo en el mostrador.
                    </p>
                  </>
                ) : null}
                {redeem.stage === "creating" ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Generando tu código…
                  </p>
                ) : null}
                {redeem.stage === "code" ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Mostrá este código en el mostrador:
                    </p>
                    <p
                      className="text-4xl font-bold tracking-widest tabular-nums"
                      aria-live="polite"
                    >
                      {formatRedemptionCode(redeem.code)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Se vence en{" "}
                      {(() => {
                        const left = Math.max(
                          0,
                          Math.round(
                            (new Date(redeem.expiresAt).getTime() - redeemNow) / 1000,
                          ),
                        );
                        return `0:${String(Math.min(left, 99)).padStart(2, "0")}`;
                      })()}
                      . Quedate en esta pantalla hasta que te lo confirmen.
                    </p>
                  </>
                ) : null}
                {redeem.stage === "redeemed" ? (
                  <p role="status" className="text-center font-medium">
                    ¡Disfrutalo! Tu tarjeta empieza de nuevo.
                  </p>
                ) : null}
                {redeem.stage === "expired" ? (
                  <>
                    <p role="alert" className="text-sm text-destructive">
                      El código venció. Generá uno nuevo en el mostrador.
                    </p>
                    <Button onClick={handleCreateCode} variant="outline">
                      Generar otro código
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    const terminal = scanError?.reason === "expired" || scanError?.reason === "daily_limit" || scanError?.reason === "too_soon";
    const isExpired = scanError?.reason === "expired";
    const isRateLimited =
      scanError?.reason === "daily_limit" || scanError?.reason === "too_soon";
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle className="text-2xl">
            {isExpired
              ? "Este código ya se renovó"
              : isRateLimited
                ? "Por hoy ya sumaste"
                : "No pudimos sumar tu sello"}
          </CardTitle>
          <CardDescription className="text-base">
            {isExpired
              ? "Tardaste más de 10 minutos en verificar el teléfono y el QR se renovó. Volvé al mostrador y escaneá el código actual con la cámara."
              : scanError?.message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {isRateLimited ? (
            <div className="flex w-full flex-col items-center gap-3 border-t pt-4">
              <p className="text-sm font-medium">Igual podés sumar sellos extra</p>
              {claim.stage === "pending" ? (
                <p role="status" className="text-center text-sm text-muted-foreground">
                  Pedido enviado. Mostralo en el mostrador para que te lo
                  aprueben y sumás al instante.
                </p>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={claim.stage === "creating"}
                    onClick={() => handleClaim("google_review")}
                  >
                    Reseña en Google +2
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={claim.stage === "creating"}
                    onClick={() => handleClaim("instagram_story")}
                  >
                    Historia +1
                  </Button>
                </div>
              )}
              {claim.stage === "error" ? (
                <p role="alert" className="text-center text-sm text-destructive">
                  {claim.message}
                </p>
              ) : null}
            </div>
          ) : null}
          {!terminal ? (
            <Button onClick={handleRetry} disabled={scanning} size="lg">
              {scanning ? <Loader2 className="animate-spin" /> : null}
              Probar de nuevo
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (scanning) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Sumando tu sello…</p>
        </CardContent>
      </Card>
    );
  }

  // --- Paso 2: código SMS ---
  if (step === "otp") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Ingresá el código</CardTitle>
          <CardDescription>
            Te lo mandamos por SMS al {phone}. Tarda hasta un minuto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConfirmCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="otp">Código</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                aria-invalid={Boolean(fieldError)}
                required
              />
            </div>
            {fieldError ? (
              <p role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            ) : null}
            {isEmulator ? (
              <p className="text-xs text-muted-foreground">
                En desarrollo, el código se ve en el emulador de Auth
                (http://localhost:4000/auth).
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={confirming}>
              {confirming ? <Loader2 className="animate-spin" /> : null}
              Confirmar y sumar sello
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("join");
                setOtp("");
                setFieldError(null);
              }}
            >
              Cambiar número
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // --- Paso 1: nombre + teléfono + consentimiento ---
  if (authReady && authUser) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Sumando tu sello…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Sumá sellos en {cafeName}</CardTitle>
        <CardDescription>
          {locationName} · Escribí tu nombre y tu número una sola vez. Después,
          cada escaneo suma directo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSendCode} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Tu nombre</Label>
            <Input
              id="displayName"
              autoComplete="given-name"
              placeholder="Lucía"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Tu celular (con código de país)</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+54 9 11 1234 5678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(event) => setOptIn(event.target.checked)}
              className="mt-1 size-4 accent-primary"
            />
            <span className="text-muted-foreground">
              Quiero recibir novedades y promos por WhatsApp (opcional, podés
              darte de baja cuando quieras).
            </span>
          </label>
          {fieldError ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={sending}>
            {sending ? <Loader2 className="animate-spin" /> : null}
            Mandame el código
          </Button>
          <div id="recaptcha-container" aria-hidden="true" />
        </form>
      </CardContent>
    </Card>
  );
}
