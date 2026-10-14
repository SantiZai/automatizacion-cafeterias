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

type CardSummary = {
  cafeId: string;
  cafeName: string;
  customerId: string;
  stamps: number;
  required: number;
  remaining: number;
  complete: boolean;
  nearReward: boolean;
  rewardName: string;
};

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  const normalized = cleaned.startsWith("00")
    ? `+${cleaned.slice(2)}`
    : cleaned;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

export function TarjetaClient() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [step, setStep] = useState<"phone" | "otp" | "cards">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cards, setCards] = useState<CardSummary[] | null>(null);
  const [cardsError, setCardsError] = useState<string | null>(null);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

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

  async function loadCards(user: User) {
    setLoadingCards(true);
    setCardsError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/cards/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        cards?: CardSummary[];
        error?: string;
      } | null;
      if (response.ok && data?.ok && data.cards) {
        setCards(data.cards);
        setStep("cards");
      } else {
        setCardsError(data?.error ?? "No pudimos traer tus tarjetas.");
      }
    } catch {
      setCardsError("No pudimos traer tus tarjetas. Revisá tu conexión.");
    } finally {
      setLoadingCards(false);
    }
  }

  // Sesión existente: entra directo a las tarjetas.
  useEffect(() => {
    if (!authReady || !authUser || step !== "phone" || cards) return;
    const timeout = setTimeout(() => {
      if (authUser) void loadCards(authUser);
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
      console.error("[tarjeta] no se pudo mandar el SMS", error);
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
      setAuthUser(credential.user);
      await loadCards(credential.user);
    } catch (error) {
      console.error("[tarjeta] código inválido", error);
      setFieldError("Ese código no coincide. Revisalo e intentá de nuevo.");
    } finally {
      setConfirming(false);
    }
  }

  if (step === "cards" && cards) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Mis tarjetas</h1>
          <p className="mt-1 text-muted-foreground">
            Tus sellos, siempre con vos. Agregá esta página a tu inicio.
          </p>
        </div>
        {cards.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Todavía no tenés tarjetas</CardTitle>
              <CardDescription>
                Escaneá el QR del mostrador de tu café para sumar tu primer
                sello.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          cards.map((card) => (
            <CardItem
              key={`${card.cafeId}-${card.customerId}`}
              card={card}
              getUser={() => authUser}
              onChanged={() => {
                if (authUser) void loadCards(authUser);
              }}
            />
          ))
        )}
      </div>
    );
  }

  if (loadingCards) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Buscando tus tarjetas…</p>
        </CardContent>
      </Card>
    );
  }

  if (cardsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">No pudimos entrar</CardTitle>
          <CardDescription>{cardsError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              setCardsError(null);
              if (authUser) void loadCards(authUser);
            }}
          >
            Probar de nuevo
          </Button>
        </CardContent>
      </Card>
    );
  }

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
            <Button type="submit" size="lg" disabled={confirming || loadingCards}>
              {confirming || loadingCards ? <Loader2 className="animate-spin" /> : null}
              Ver mis tarjetas
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("phone");
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

  if (authReady && authUser) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Buscando tus tarjetas…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Mis tarjetas</CardTitle>
        <CardDescription>
          Entrá con tu número una sola vez y llevá tus sellos en el celu, sin
          apps ni QR.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSendCode} className="flex flex-col gap-4" noValidate>
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

function CardItem({
  card,
  getUser,
  onChanged,
}: {
  card: CardSummary;
  getUser: () => User | null;
  onChanged: () => void;
}) {
  const [redeem, setRedeem] = useState<
    | { stage: "idle" }
    | { stage: "creating" }
    | { stage: "code"; code: string; expiresAt: string }
    | { stage: "redeemed" }
    | { stage: "expired" }
    | { stage: "error"; message: string }
  >({ stage: "idle" });
  const [claim, setClaim] = useState<
    | { stage: "idle" }
    | { stage: "creating" }
    | { stage: "pending" }
    | { stage: "error"; message: string }
  >({ stage: "idle" });
  const [redeemNow, setRedeemNow] = useState(() => Date.now());

  async function idToken(): Promise<string | null> {
    const user = getUser();
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }

  async function handleCreateCode() {
    const token = await idToken();
    if (!token) {
      setRedeem({ stage: "error", message: "Tu sesión venció. Recargá la página." });
      return;
    }
    setRedeem({ stage: "creating" });
    try {
      const response = await fetch("/api/redemptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeId: card.cafeId, idToken: token }),
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
    } catch {
      setRedeem({
        stage: "error",
        message: "No pudimos generar el código. Revisá tu conexión.",
      });
    }
  }

  async function handleClaim(kind: "google_review" | "instagram_story") {
    const token = await idToken();
    if (!token) {
      setClaim({ stage: "error", message: "Tu sesión venció. Recargá la página." });
      return;
    }
    setClaim({ stage: "creating" });
    try {
      const response = await fetch("/api/claims/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeId: card.cafeId, idToken: token, kind }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (response.ok && data?.ok) {
        setClaim({ stage: "pending" });
        toast.success("Pedido enviado. Mostralo en el mostrador.");
      } else {
        setClaim({
          stage: "error",
          message: data?.error ?? "No pudimos pedir el sello extra.",
        });
      }
    } catch {
      setClaim({
        stage: "error",
        message: "No pudimos pedir el sello extra. Revisá tu conexión.",
      });
    }
  }

  const redeemLiveRef = useRef({ cafeId: card.cafeId, code: "", active: false });
  useEffect(() => {
    redeemLiveRef.current = {
      cafeId: card.cafeId,
      code: redeem.stage === "code" ? redeem.code : "",
      active: redeem.stage === "code",
    };
  });

  useEffect(() => {
    const id = setInterval(() => {
      setRedeemNow(Date.now());
      const live = redeemLiveRef.current;
      if (!live.active || !live.code) return;
      const user = getUser();
      if (!user) return;
      void user
        .getIdToken()
        .then((token) =>
          fetch("/api/redemptions/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cafeId: live.cafeId, idToken: token, code: live.code }),
          }),
        )
        .then((res) => res.json().catch(() => null) as Promise<{ status?: string } | null>)
        .then((data) => {
          if (data?.status === "redeemed") {
            setRedeem({ stage: "redeemed" });
            onChanged();
          } else if (data?.status === "expired") setRedeem({ stage: "expired" });
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent/20">
          <CheckCircle2 className="size-6 text-primary" aria-hidden="true" />
        </span>
        <CardTitle className="text-2xl">{card.cafeName}</CardTitle>
        <CardDescription className="text-base">
          {card.complete ? (
            <>¡Premio desbloqueado! Mostrá esta pantalla en el mostrador.</>
          ) : (
            <>
              Llevás {card.stamps} de {card.required} sellos. Te faltan{" "}
              {card.remaining} para {card.rewardName}.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div
          className="flex flex-wrap justify-center gap-2"
          role="img"
          aria-label={`${card.stamps} de ${card.required} sellos en ${card.cafeName}`}
        >
          {Array.from({ length: card.required }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={
                i < card.stamps
                  ? "size-6 rounded-full bg-accent"
                  : "size-6 rounded-full border-2 border-dashed border-muted-foreground/40"
              }
            />
          ))}
        </div>
        {card.nearReward && !card.complete ? (
          <Badge variant="secondary">¡Te falta poco!</Badge>
        ) : null}

        {card.complete ? (
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
        ) : (
          <div className="flex w-full flex-col items-center gap-3 border-t pt-4">
            <p className="text-sm font-medium">Sumá sellos extra</p>
            {claim.stage === "pending" ? (
              <p role="status" className="text-center text-sm text-muted-foreground">
                Pedido enviado. Mostralo en el mostrador para que te lo aprueben.
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
        )}
      </CardContent>
    </Card>
  );
}
