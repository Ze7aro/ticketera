import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
const text = readFileSync(".env", "utf8");
const existing = parse(text).TICKET_ENCRYPTION_KEY;
if (existing && /^[a-f0-9]{64}$/i.test(existing))
  console.info("La clave de entradas ya existe; se conservó.");
else {
  if (existing)
    throw new Error(
      "Ya existe un valor de clave. Revisarlo sin reemplazarlo: las entradas previas dependen de él.",
    );
  writeFileSync(
    ".env",
    `${text.replace(/^TICKET_ENCRYPTION_KEY\s*=.*$/gm, "").trimEnd()}\nTICKET_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}\n`,
    { mode: 0o600 },
  );
  console.info(
    "Clave de entradas creada en .env. Respaldarla de forma segura; no compartirla ni reemplazarla.",
  );
}
