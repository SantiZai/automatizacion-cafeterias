"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseAuth } from "@/lib/firebase/client";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-api-key":
    "Falta la configuración de Firebase. Revisá que exista .env.local y reiniciá el servidor de desarrollo.",
  "auth/network-request-failed":
    "No se pudo conectar con Firebase. Si usás emuladores, ¿están corriendo?",
  "auth/operation-not-allowed":
    "El acceso con email no está habilitado en Firebase Authentication.",
  "auth/invalid-credential":
    "Mail o contraseña incorrectos. Revisalos e intentá de nuevo.",
  "auth/user-not-found":
    "Esa cuenta no existe. Pedile tu acceso al administrador.",
  "auth/wrong-password": "Contraseña incorrecta. Probá de nuevo.",
  "auth/too-many-requests":
    "Demasiados intentos. Esperá unos minutos e intentá de nuevo.",
};

class SessionError extends Error {
  constructor(public status: number) {
    super(`session-${status}`);
  }
}

export function EmailSignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) throw new SessionError(response.status);

      router.replace(next);
      router.refresh();
    } catch (error) {
      console.error("[login] error al iniciar sesión", error);
      const code = (error as { code?: string }).code;
      if (error instanceof SessionError && error.status === 403) {
        toast.error("Esa cuenta no tiene acceso al panel.");
      } else {
        toast.error(
          (code && AUTH_ERROR_MESSAGES[code]) ??
            `No pudimos iniciar sesión${code ? ` (${code})` : ""}. Probá de nuevo en un momento.`,
        );
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSignIn} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Mail del local</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="cafe@mail.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : null}
        Entrar
      </Button>
    </form>
  );
}
