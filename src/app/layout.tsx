import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "Cafelink",
    template: "%s · Cafelink",
  },
  description:
    "Conocé mejor a tus clientes y dales razones para volver. Fidelización para cafeterías.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Cafelink",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#6f4a2f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
