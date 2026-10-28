export function validAppUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}
export function authConfigured() {
  return (
    !!process.env.DATABASE_URL &&
    (process.env.AUTH_SECRET?.length ?? 0) >= 32 &&
    validAppUrl(process.env.APP_URL)
  );
}
