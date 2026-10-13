"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function SignOutMenuItem() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(getFirebaseAuth()).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenuItem onSelect={handleSignOut}>
      <LogOut />
      Cerrar sesión
    </DropdownMenuItem>
  );
}
