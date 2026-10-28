"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function RefreshOrder({
  expiresAt,
  pending,
}: {
  expiresAt: string;
  pending: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    const timeout = setTimeout(
      () => router.refresh(),
      Math.max(1000, new Date(expiresAt).getTime() - Date.now() + 1000),
    );
    return () => clearTimeout(timeout);
  }, [expiresAt, pending, router]);
  return (
    <Button type="button" variant="outline" onClick={() => router.refresh()}>
      Actualizar estado
    </Button>
  );
}
