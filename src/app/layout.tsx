import type { Metadata } from "next";
import Link from "next/link";
import { Ticket } from "lucide-react";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Kenshukan · Entradas", template: "%s | Kenshukan" },
  description: "Entradas para torneos de karate Kenshukan.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-4"
        >
          Saltar al contenido
        </a>
        <header className="border-b border-border bg-background">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
            <Link
              href="/"
              aria-label="Kenshukan, inicio"
              className="flex min-h-11 items-center gap-3"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-white">
                <Ticket aria-hidden="true" size={22} />
              </span>
              <span>
                <span className="block text-lg font-bold tracking-tight">
                  KENSHUKAN
                </span>
                <span className="block text-[10px] font-semibold tracking-[0.23em] text-muted-foreground">
                  ENTRADAS · KARATE
                </span>
              </span>
            </Link>
            <nav aria-label="Principal">
              <Link
                href="/#torneos"
                className="inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
              >
                Torneos
              </Link>
            </nav>
          </div>
        </header>
        <main id="contenido">{children}</main>
        <footer className="mx-auto flex max-w-6xl flex-col gap-2 border-t px-5 py-7 text-xs leading-6 text-muted-foreground sm:flex-row sm:justify-between sm:px-8">
          <p>Kenshukan · Torneos de karate</p>
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 items-center underline"
          >
            Acceso del equipo
          </Link>
        </footer>
      </body>
    </html>
  );
}
