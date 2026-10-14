import { describe, expect, it } from "vitest";

import { filterCustomers } from "./customers";

const customers = [
  { id: "1", displayName: "Lucía Fernández", phoneE164: "+5491112345678" },
  { id: "2", displayName: "Santiago", phoneE164: "+5491187654321" },
  { id: "3", displayName: "Martín", phoneE164: "+541112345678" },
];

describe("búsqueda de clientes", () => {
  it("sin query devuelve todo", () => {
    expect(filterCustomers(customers, "")).toHaveLength(3);
  });

  it("busca por nombre sin importar acentos ni mayúsculas", () => {
    expect(filterCustomers(customers, "lucia").map((c) => c.id)).toEqual(["1"]);
    expect(filterCustomers(customers, "SANTI").map((c) => c.id)).toEqual(["2"]);
  });

  it("busca por teléfono ignorando espacios y guiones", () => {
    expect(filterCustomers(customers, "+54 91-18 765-4321").map((c) => c.id)).toEqual([
      "2",
    ]);
  });

  it("devuelve vacío si no hay coincidencia", () => {
    expect(filterCustomers(customers, "valentina")).toHaveLength(0);
  });
});
