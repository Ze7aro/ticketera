import Link from "next/link";
export function Pagination({
  page,
  hasNext,
  basePath,
  query = {},
}: {
  page: number;
  hasNext: boolean;
  basePath: string;
  query?: Record<string, string>;
}) {
  const pageHref = (nextPage: number) => {
    const search = new URLSearchParams({ ...query, page: String(nextPage) });
    return `${basePath}?${search.toString()}`;
  };
  return (
    <nav
      aria-label="Paginación"
      className="mt-6 flex flex-wrap items-center gap-4 text-sm"
    >
      {page > 1 && (
        <Link
          className="inline-flex min-h-11 items-center rounded-lg border px-4"
          href={pageHref(page - 1)}
        >
          Anterior
        </Link>
      )}
      <span>Página {page}</span>
      {hasNext && (
        <Link
          className="inline-flex min-h-11 items-center rounded-lg border px-4"
          href={pageHref(page + 1)}
        >
          Siguiente
        </Link>
      )}
    </nav>
  );
}
export function parsePage(value: string | string[] | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 100000
    ? number
    : 1;
}
