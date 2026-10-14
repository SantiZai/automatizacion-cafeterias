/**
 * Búsqueda de clientes en memoria (puras, testeadas).
 * Con <500 clientes por café (plan Esencial) filtrar 50 recientes en el
 * servidor alcanza y evita un motor de búsqueda externo. Si el café crece,
 * mover a un índice dedicado sin cambiar la UI.
 */

export type CustomerSearchItem = {
  id: string;
  displayName: string;
  phoneE164: string;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s\-().]/g, "");
}

/** Filtra por nombre o teléfono (insensible a acentos, espacios y guiones). */
export function filterCustomers<T extends CustomerSearchItem>(
  customers: T[],
  query: string,
): T[] {
  const q = normalize(query.trim());
  if (!q) return customers;
  return customers.filter(
    (c) => normalize(c.displayName).includes(q) || normalize(c.phoneE164).includes(q),
  );
}
