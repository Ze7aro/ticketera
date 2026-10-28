import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ticketQr } from "./presentation";
import { formatEventDate } from "@/lib/format";
import type { TicketView } from "./service";
import { AppError } from "@/lib/errors";
function lines(text: string, font: PDFFont, size: number, width: number) {
  const supported = new Set(font.getCharacterSet());
  const normalized = Array.from(text.normalize("NFC"))
    .map((char) =>
      char === "\n" ? char : supported.has(char.codePointAt(0)!) ? char : "?",
    )
    .join("");
  const result: string[] = [];
  for (const paragraph of normalized.split(/\r?\n/)) {
    let line = "";
    for (const char of paragraph) {
      if (font.widthOfTextAtSize(line + char, size) > width) {
        result.push(line.trimEnd());
        line = "";
      }
      line += char;
    }
    result.push(line.trim());
  }
  return result;
}
export async function createTicketPdf(ticket: TicketView) {
  if (!ticket.usable)
    throw new AppError(
      "INVALID_TICKET",
      "Esta entrada no está habilitada para ingresar.",
      409,
    );
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fontBytes = await readFile(
    path.join(
      process.cwd(),
      "node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff",
    ),
  );
  const font = await document.embedFont(fontBytes, { subset: true });
  const green = rgb(0.12, 0.28, 0.23),
    ink = rgb(0.1, 0.14, 0.13);
  let page: PDFPage,
    y = 0;
  const addPage = () => {
    page = document.addPage([595.28, 841.89]);
    page.drawRectangle({
      x: 0,
      y: 751.89,
      width: 595.28,
      height: 90,
      color: green,
    });
    page.drawText("KENSHUKAN", {
      x: 40,
      y: 795,
      font,
      size: 21,
      color: rgb(1, 1, 1),
    });
    page.drawText("ENTRADA DIGITAL / KARATE", {
      x: 40,
      y: 773,
      font,
      size: 10,
      color: rgb(1, 1, 1),
    });
    page.drawText(`Página ${document.getPageCount()}`, {
      x: 40,
      y: 26,
      font,
      size: 9,
      color: ink,
    });
    y = 720;
  };
  const write = (value: string, size = 12, gap = 10) => {
    for (const line of lines(value, font, size, 515)) {
      if (y < 60) addPage();
      page.drawText(line, { x: 40, y, font, size, color: ink });
      y -= size * 1.45;
    }
    y -= gap;
  };
  addPage();
  write(ticket.event.name, 23, 12);
  write(formatEventDate(ticket.event.startsAt, ticket.event.timezone), 12);
  write(`${ticket.event.venue}\n${ticket.event.address}`, 12);
  write(`Entrada ${ticket.number}`, 14);
  write(`${ticket.typeName}\nTitular: ${ticket.attendeeName}`, 12);
  if (y < 315) addPage();
  const qr = await document.embedPng(await ticketQr(ticket.token));
  page!.drawImage(qr, { x: 197.64, y: y - 200, width: 200, height: 200 });
  y -= 225;
  write("Válida para un único ingreso. No compartas este código QR.", 11);
  write("La validez se comprueba en el control de acceso.", 10);
  write("Condiciones de acceso", 12, 6);
  write(ticket.event.conditions, 10, 0);
  document.setTitle(`Entrada ${ticket.number}`);
  document.setAuthor("Kenshukan");
  return document.save();
}
