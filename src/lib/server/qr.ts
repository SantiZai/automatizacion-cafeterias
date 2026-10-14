import "server-only";

import { createQrToken, QR_TTL_SECONDS, verifyQrToken } from "@/domain/qr-token";

/** Origen público para los QR. Permite probar desde el celular con una URL de LAN/túnel. */
export function appOrigin(fallbackOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return fallbackOrigin.replace(/\/$/, "");
}

export function verifyCafeQrToken(
  token: string,
  now: Date = new Date(),
  graceWindows: number = 1,
): ReturnType<typeof verifyQrToken> {
  return verifyQrToken(token, getQrSigningSecret(), now, QR_TTL_SECONDS, graceWindows);
}

function getQrSigningSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error(
      "Falta QR_SIGNING_SECRET en el servidor (mínimo 32 caracteres).",
    );
  }
  return secret;
}

export type CafeQr = {
  token: string;
  scanUrl: string;
  expiresAt: string;
  ttlSeconds: number;
};

/**
 * Genera el QR rotativo del mostrador para un local.
 * El QR codifica la URL pública /v/{token} que el cliente escanea.
 * Solo se usa en el servidor: nunca expongas el secreto al navegador.
 */
export function createCafeQr(
  cafeId: string,
  locationId: string,
  origin: string,
  now: Date = new Date(),
): CafeQr {
  const token = createQrToken(
    { cafeId, locationId },
    getQrSigningSecret(),
    now,
  );
  const window = Math.floor(now.getTime() / 1000 / QR_TTL_SECONDS);
  const expiresAt = new Date((window + 1) * QR_TTL_SECONDS * 1000);

  return {
    token,
    scanUrl: `${origin.replace(/\/$/, "")}/v/${token}`,
    expiresAt: expiresAt.toISOString(),
    ttlSeconds: QR_TTL_SECONDS,
  };
}
