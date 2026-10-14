"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addNoteAction, type CustomerActionState } from "./actions";

export function NotesForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(
    addNoteAction.bind(null, customerId),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Limpia el campo después de guardar (la acción devuelve ok:true).
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="note-body">Agregar nota</Label>
        <textarea
          id="note-body"
          name="body"
          rows={2}
          maxLength={500}
          placeholder="Domingos con su abuela Ana, mesa de la ventana…"
          aria-invalid={Boolean(state.fieldErrors?.body)}
          className="min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
        {state.fieldErrors?.body ? (
          <p className="text-sm text-destructive">{state.fieldErrors.body}</p>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Las notas las ve solo tu equipo. Evitá datos sensibles (salud, religión,
        etc.): alcanzan gustos y hábitos de visita.
      </p>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          Nota guardada.
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Guardar nota
        </Button>
      </div>
    </form>
  );
}
