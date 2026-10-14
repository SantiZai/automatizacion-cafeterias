"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProgramAction, type ProgramActionState } from "./actions";

export function ProgramForm({
  initialStampsRequired,
  initialRewardName,
  initialMinMinutes,
  initialMaxPerDay,
}: {
  initialStampsRequired: number;
  initialRewardName: string;
  initialMinMinutes: number;
  initialMaxPerDay: number;
}) {
  const [state, formAction, pending] = useActionState<ProgramActionState, FormData>(
    updateProgramAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="stampsRequired">Sellos para el premio</Label>
          <Input
            id="stampsRequired"
            name="stampsRequired"
            type="number"
            min={4}
            max={15}
            defaultValue={initialStampsRequired}
            required
          />
          {state.fieldErrors?.stampsRequired ? (
            <p className="text-sm text-destructive">{state.fieldErrors.stampsRequired}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rewardName">Premio</Label>
          <Input
            id="rewardName"
            name="rewardName"
            defaultValue={initialRewardName}
            placeholder="Café con medialunas gratis"
            maxLength={80}
            required
          />
          {state.fieldErrors?.rewardName ? (
            <p className="text-sm text-destructive">{state.fieldErrors.rewardName}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="minMinutesBetweenStamps">Minutos entre sellos</Label>
          <Input
            id="minMinutesBetweenStamps"
            name="minMinutesBetweenStamps"
            type="number"
            min={0}
            max={1440}
            defaultValue={initialMinMinutes}
            required
          />
          {state.fieldErrors?.minMinutesBetweenStamps ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.minMinutesBetweenStamps}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="maxStampsPerDay">Sellos por día (máx.)</Label>
          <Input
            id="maxStampsPerDay"
            name="maxStampsPerDay"
            type="number"
            min={1}
            max={10}
            defaultValue={initialMaxPerDay}
            required
          />
          {state.fieldErrors?.maxStampsPerDay ? (
            <p className="text-sm text-destructive">{state.fieldErrors.maxStampsPerDay}</p>
          ) : null}
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          {state.message ?? "Promo guardada."}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Guardar promo
        </Button>
      </div>
    </form>
  );
}
