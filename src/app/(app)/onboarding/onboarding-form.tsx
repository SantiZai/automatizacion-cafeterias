"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCafeAction } from "./actions";
import type { OnboardingState } from "./state";

const initialState: OnboardingState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createCafeAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre de tu café</Label>
        <Input
          id="name"
          name="name"
          placeholder="Café del Barrio"
          autoComplete="organization"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          required
        />
        {errors.name ? (
          <p id="name-error" className="text-sm text-destructive">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stampsRequired">¿Cuántos sellos completan la tarjeta?</Label>
        <Input
          id="stampsRequired"
          name="stampsRequired"
          type="number"
          inputMode="numeric"
          min={4}
          max={15}
          defaultValue={8}
          aria-invalid={Boolean(errors.stampsRequired)}
          aria-describedby={errors.stampsRequired ? "stamps-error" : undefined}
          required
        />
        {errors.stampsRequired ? (
          <p id="stamps-error" className="text-sm text-destructive">
            {errors.stampsRequired}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rewardName">¿Cuál es el premio?</Label>
        <Input
          id="rewardName"
          name="rewardName"
          defaultValue="Café gratis"
          aria-invalid={Boolean(errors.rewardName)}
          aria-describedby={errors.rewardName ? "reward-error" : undefined}
          required
        />
        {errors.rewardName ? (
          <p id="reward-error" className="text-sm text-destructive">
            {errors.rewardName}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Crear mi café
      </Button>
    </form>
  );
}
