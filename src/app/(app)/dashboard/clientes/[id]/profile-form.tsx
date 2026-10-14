"use client";

import { useActionState, useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction, type CustomerActionState } from "./actions";

export function ProfileForm({
  customerId,
  initialUsualOrder,
  initialTastes,
}: {
  customerId: string;
  initialUsualOrder: string | null;
  initialTastes: string[];
}) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(
    updateProfileAction.bind(null, customerId),
    {},
  );
  const [tastes, setTastes] = useState<string[]>(initialTastes);
  const [draft, setDraft] = useState("");

  function addTaste() {
    const value = draft.trim();
    if (!value || tastes.length >= 20) return;
    if (tastes.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    setTastes([...tastes, value.slice(0, 40)]);
    setDraft("");
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="usualOrder">Pedido habitual</Label>
        <Input
          id="usualOrder"
          name="usualOrder"
          defaultValue={initialUsualOrder ?? ""}
          placeholder="Latte con medialunas"
          maxLength={120}
        />
        {state.fieldErrors?.usualOrder ? (
          <p className="text-sm text-destructive">{state.fieldErrors.usualOrder}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="taste-draft">Gustos</Label>
        <div className="flex gap-2">
          <Input
            id="taste-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Sin azúcar, leche de almendras…"
            maxLength={40}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTaste();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addTaste}>
            Agregar
          </Button>
        </div>
        <input type="hidden" name="tastes" value={JSON.stringify(tastes)} />
        {tastes.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Gustos guardados">
            {tastes.map((taste) => (
              <li
                key={taste}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
              >
                {taste}
                <button
                  type="button"
                  onClick={() => setTastes(tastes.filter((t) => t !== taste))}
                  aria-label={`Quitar ${taste}`}
                  className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {state.fieldErrors?.tastes ? (
          <p className="text-sm text-destructive">{state.fieldErrors.tastes}</p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          Guardado.
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Guardar ficha
        </Button>
      </div>
    </form>
  );
}
