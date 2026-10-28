"use client";
import { Button } from "@/components/ui/button";
export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      Imprimir entrada
    </Button>
  );
}
