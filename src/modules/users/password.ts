import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const N = 131072;
const r = 8;
const p = 1;
const keyLength = 64;
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      { N, r, p, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt$${N}$${r}$${p}$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split("$");
  if (
    parts.length !== 6 ||
    parts[0] !== "scrypt" ||
    parts[1] !== String(N) ||
    parts[2] !== String(r) ||
    parts[3] !== String(p) ||
    !/^[a-f0-9]{32}$/.test(parts[4] ?? "") ||
    !/^[a-f0-9]{128}$/.test(parts[5] ?? "")
  )
    return false;
  const actual = await derive(password, parts[4]!);
  return timingSafeEqual(actual, Buffer.from(parts[5]!, "hex"));
}
// A missing account still incurs a password derivation, without exposing whether it exists.
export const dummyHash = `scrypt$${N}$${r}$${p}$${"0".repeat(32)}$${"0".repeat(128)}`;
