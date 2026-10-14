"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addAccountToCafeAction,
  createCafeWithAccountAction,
  type AdminActionState,
} from "./actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function Result({ state }: { state: AdminActionState }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          {state.message ?? "Listo."}
        </p>
      ) : null}
    </>
  );
}

export function NewCafeForm() {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    createCafeWithAccountAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cafeName">Nombre del café</Label>
          <Input id="cafeName" name="cafeName" placeholder="Café del Barrio" maxLength={60} required />
          <FieldError message={state.fieldErrors?.cafeName} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ownerName">Responsable</Label>
          <Input id="ownerName" name="ownerName" placeholder="María" maxLength={60} required />
          <FieldError message={state.fieldErrors?.ownerName} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Mail de la cuenta</Label>
          <Input id="email" name="email" type="email" placeholder="cafe@mail.com" maxLength={120} required />
          <FieldError message={state.fieldErrors?.email} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tempPassword">Contraseña inicial (vacío = genero una)</Label>
          <Input id="tempPassword" name="tempPassword" type="text" autoComplete="off" placeholder="Se genera sola" maxLength={64} />
          <FieldError message={state.fieldErrors?.tempPassword} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="stampsRequired">Sellos para el premio</Label>
          <Input id="stampsRequired" name="stampsRequired" type="number" min={4} max={15} defaultValue={8} required />
          <FieldError message={state.fieldErrors?.stampsRequired} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rewardName">Premio</Label>
          <Input id="rewardName" name="rewardName" placeholder="Café gratis" maxLength={80} required />
          <FieldError message={state.fieldErrors?.rewardName} />
        </div>
      </div>
      <Result state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Crear café + cuenta
        </Button>
      </div>
    </form>
  );
}

export function AddAccountForm({ cafes }: { cafes: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    addAccountToCafeAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cafeId">Café</Label>
          <select
            id="cafeId"
            name="cafeId"
            required
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="">Elegí el café…</option>
            {cafes.map((cafe) => (
              <option key={cafe.id} value={cafe.id}>
                {cafe.name}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.cafeId} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">Rol</Label>
          <select
            id="role"
            name="role"
            defaultValue="owner"
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="owner">Dueño</option>
            <option value="manager">Encargado</option>
            <option value="staff">Staff</option>
          </select>
          <FieldError message={state.fieldErrors?.role} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="accountName">Nombre</Label>
          <Input id="accountName" name="ownerName" placeholder="María" maxLength={60} required />
          <FieldError message={state.fieldErrors?.ownerName} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="accountEmail">Mail</Label>
          <Input id="accountEmail" name="email" type="email" placeholder="cafe@mail.com" maxLength={120} required />
          <FieldError message={state.fieldErrors?.email} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="accountPassword">Contraseña inicial (vacío = genero una)</Label>
          <Input id="accountPassword" name="tempPassword" type="text" autoComplete="off" placeholder="Se genera sola" maxLength={64} />
          <FieldError message={state.fieldErrors?.tempPassword} />
        </div>
      </div>
      <Result state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Crear cuenta
        </Button>
      </div>
    </form>
  );
}
