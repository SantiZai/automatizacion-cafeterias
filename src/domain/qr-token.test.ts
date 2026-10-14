import { describe, expect, it } from "vitest";

import { QR_TTL_SECONDS, createQrToken, extractQrPayload, verifyQrToken } from "./qr-token";

const secret = "x".repeat(40);
const payload = { cafeId: "cafe123", locationId: "loc456" };
const t0 = new Date("2026-10-13T15:00:10Z");

describe("QR rotativo", () => {
  it("un token recién creado es válido", () => {
    const token = createQrToken(payload, secret, t0);
    expect(verifyQrToken(token, secret, t0)).toEqual({ valid: true, ...payload });
  });

  it("sigue siendo válido en la ventana siguiente (margen de escaneo)", () => {
    const token = createQrToken(payload, secret, t0);
    const later = new Date(t0.getTime() + QR_TTL_SECONDS * 1000);
    expect(verifyQrToken(token, secret, later).valid).toBe(true);
  });

  it("vence después de dos ventanas", () => {
    const token = createQrToken(payload, secret, t0);
    const later = new Date(t0.getTime() + QR_TTL_SECONDS * 2 * 1000);
    expect(verifyQrToken(token, secret, later)).toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("acepta ventanas viejas si se pide gracia amplia (flujo OTP del scan)", () => {
    const token = createQrToken(payload, secret, t0);
    const fiveMinLater = new Date(t0.getTime() + QR_TTL_SECONDS * 5 * 1000);
    expect(verifyQrToken(token, secret, fiveMinLater).valid).toBe(false);
    expect(
      verifyQrToken(token, secret, fiveMinLater, QR_TTL_SECONDS, 10).valid,
    ).toBe(true);
  });

  it("rechaza un token de una ventana futura", () => {
    const future = new Date(t0.getTime() + QR_TTL_SECONDS * 5 * 1000);
    const token = createQrToken(payload, secret, future);
    expect(verifyQrToken(token, secret, t0)).toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("rechaza una firma alterada", () => {
    const token = createQrToken(payload, secret, t0);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyQrToken(tampered, secret, t0)).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  it("rechaza si se cambia el local sin re-firmar", () => {
    const token = createQrToken(payload, secret, t0);
    const swapped = token.replace("loc456", "loc999");
    expect(verifyQrToken(swapped, secret, t0).valid).toBe(false);
  });

  it("rechaza un token firmado con otro secreto", () => {
    const token = createQrToken(payload, "y".repeat(40), t0);
    expect(verifyQrToken(token, secret, t0)).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  it("rechaza tokens mal formados", () => {
    expect(verifyQrToken("hola", secret, t0)).toEqual({
      valid: false,
      reason: "malformed",
    });
    expect(verifyQrToken("a.b.c.d", secret, t0)).toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("exige un secreto largo", () => {
    expect(() => createQrToken(payload, "corto", t0)).toThrow();
  });

  it("extrae el payload de un token vencido si la firma es válida", () => {
    const token = createQrToken(payload, secret, t0);
    const expiredAt = new Date(t0.getTime() + QR_TTL_SECONDS * 60 * 1000);
    expect(verifyQrToken(token, secret, expiredAt).valid).toBe(false);
    expect(extractQrPayload(token, secret)).toEqual(payload);
  });

  it("no extrae nada si la firma es trucha", () => {
    const token = createQrToken(payload, secret, t0);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(extractQrPayload(tampered, secret)).toBeNull();
    expect(extractQrPayload("hola", secret)).toBeNull();
  });
});
