import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        {icon}
      </div>
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <div className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
