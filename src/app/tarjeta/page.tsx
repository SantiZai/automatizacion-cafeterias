import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { TarjetaClient } from "./tarjeta-client";

export const metadata: Metadata = { title: "Mi tarjeta" };

export default function TarjetaPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-6 py-12">
      <Logo href="/" />
      <div className="w-full max-w-md">
        <TarjetaClient />
      </div>
    </main>
  );
}
