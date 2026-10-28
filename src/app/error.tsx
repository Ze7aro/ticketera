"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert" className="mx-auto max-w-xl px-5 py-20">
      <h1 className="text-3xl font-semibold">No pudimos cargar esta página</h1>
      <p className="my-6 text-muted-foreground">
        Intentá nuevamente en unos instantes.
      </p>
      <Button onClick={reset}>Volver a intentar</Button>
    </section>
  );
}
