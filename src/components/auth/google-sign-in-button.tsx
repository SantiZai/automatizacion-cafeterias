"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getFirebaseAuth } from "@/lib/firebase/client";

// Mensajes claros para los errores más comunes al configurar Firebase
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-api-key":
    "Falta la configuración de Firebase. Revisá que exista .env.local y reiniciá el servidor de desarrollo.",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
    "La API key de Firebase no es válida. Revisá NEXT_PUBLIC_FIREBASE_API_KEY en .env.local.",
  "auth/network-request-failed":
    "No se pudo conectar con Firebase. Si usás emuladores, ¿están corriendo?",
  "auth/popup-blocked":
    "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes e intentá de nuevo.",
  "auth/unauthorized-domain":
    "Este dominio no está autorizado en Firebase Authentication.",
  "auth/operation-not-allowed":
    "El acceso con Google no está habilitado en Firebase Authentication.",
  "auth/configuration-not-found":
    "Authentication no está activado en tu proyecto de Firebase.",
};

class SessionError extends Error {
  constructor(public status: number) {
    super(`session-${status}`);
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function GoogleSignInButton({ next }: { next: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
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
      // El detalle completo queda en la consola del navegador (F12)
      console.error("[login] error al iniciar sesión", error);

      const code = (error as { code?: string }).code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setLoading(false);
        return;
      }

      if (error instanceof SessionError) {
        toast.error(
          `El servidor no pudo crear la sesión (${error.status}). Mirá la terminal donde corre el servidor.`,
        );
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
    <Button
      type="button"
      size="lg"
      variant="outline"
      className="w-full"
      onClick={handleSignIn}
      disabled={loading}
    >
      {loading ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
      Continuar con Google
    </Button>
  );
}