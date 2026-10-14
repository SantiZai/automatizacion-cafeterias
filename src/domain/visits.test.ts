import { describe, expect, it } from "vitest";

import {
  idempotencyKeyFor,
  qrWindowFromToken,
  visitDocId,
} from "./visits";

describe("registro de visita", () => {
  it("extrae la ventana de un token válido", () => {
    expect(qrWindowFromToken("cafe1.loc1.123456.firma")).toBe("123456");
  });

  it("devuelve null con tokens mal formados", () => {
    expect(qrWindowFromToken("hola")).toBeNull();
    expect(qrWindowFromToken("a.b.c.d")).toBeNull();
    expect(qrWindowFromToken("a.b.no-es-ventana.firma")).toBeNull();
  });

  it("genera un ID determinista por cliente y ventana", () => {
    expect(visitDocId("cli123", "999")).toBe("cli123_999");
    expect(visitDocId("cli123", "999")).toBe(visitDocId("cli123", "999"));
    expect(visitDocId("cli123", "999")).not.toBe(visitDocId("cli123", "1000"));
    expect(visitDocId("cli123", "999")).not.toBe(visitDocId("otro", "999"));
  });

  it("la clave de idempotencia coincide con el ID del documento", () => {
    expect(idempotencyKeyFor("cli123", "999")).toBe(visitDocId("cli123", "999"));
  });
});
