import Link from "next/link";
import { Coffee } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-heading text-xl font-semibold", className)}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Coffee className="size-4" aria-hidden="true" />
      </span>
      Cafelink
    </Link>
  );
}
