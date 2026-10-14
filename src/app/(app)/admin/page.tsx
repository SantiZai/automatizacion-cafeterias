import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/admin";
import { listCafes } from "@/lib/data/cafes";
import { AddAccountForm, NewCafeForm } from "./admin-forms";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  await requireAdmin();
  const cafes = await listCafes();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Administración</h1>
        <p className="mt-1 text-muted-foreground">
          Solo vos: acá se crean los cafés y sus cuentas. Cada local entra con
          su mail y contraseña en varias pantallas a la vez sin problema.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo café + cuenta</CardTitle>
          <CardDescription>
            Crea el café, su local, su promo y la cuenta del local con rol
            dueño. Si el mail ya existe, se vincula sin cambiar la contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewCafeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuenta para un café existente</CardTitle>
          <CardDescription>
            Agrega una cuenta con el rol que elijas. Sirve para dar acceso o
            para cambiar de responsable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddAccountForm cafes={cafes.map((c) => ({ id: c.id, name: c.name }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cafés ({cafes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cafes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay cafés. Creá el primero arriba.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cafes.map((cafe) => (
                <li
                  key={cafe.id}
                  className="flex flex-wrap items-baseline gap-x-3 rounded-xl border bg-card p-3"
                >
                  <span className="font-medium">{cafe.name}</span>
                  <span className="text-sm text-muted-foreground">{cafe.slug}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {cafe.id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
