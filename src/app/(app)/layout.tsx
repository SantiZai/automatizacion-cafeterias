import { Logo } from "@/components/brand/logo";
import { SignOutMenuItem } from "@/components/auth/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requireSession } from "@/lib/auth/session";

function initials(name: string | null, email: string | null) {
  const source = name ?? email ?? "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <Logo href="/dashboard" />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
              aria-label="Abrir menú de usuario"
            >
              <Avatar>
                {session.picture ? (
                  <AvatarImage src={session.picture} alt="" referrerPolicy="no-referrer" />
                ) : null}
                <AvatarFallback>{initials(session.name, session.email)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <span className="block truncate">{session.name ?? "Mi cuenta"}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {session.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <SignOutMenuItem />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
