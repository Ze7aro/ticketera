export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-6xl space-y-5 px-5 py-20">
      <span className="sr-only">Cargando página…</span>
      <div className="h-10 max-w-md animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-56 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
    </div>
  );
}
