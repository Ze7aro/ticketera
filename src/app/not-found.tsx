import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Search } from "lucide-react";
export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-5 py-16">
      <EmptyState icon={<Search />} title="No encontramos esta página">
        <p>Revisá el enlace o volvé al inicio para consultar los torneos.</p>
        <Button asChild className="mt-6">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </EmptyState>
    </section>
  );
}
