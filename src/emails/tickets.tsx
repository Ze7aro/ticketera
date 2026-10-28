import React from "react";
/* eslint-disable @next/next/no-head-element -- Static email document, not a Next.js page. */
export function TicketsEmail({
  eventName,
  links,
}: {
  eventName: string;
  links: { number: string; url: string }[];
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body
        style={{
          margin: 0,
          backgroundColor: "#f7f7f3",
          color: "#182920",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <table role="presentation" width="100%">
          <tbody>
            <tr>
              <td align="center" style={{ padding: "24px 12px" }}>
                <table
                  role="presentation"
                  width="100%"
                  style={{
                    maxWidth: 560,
                    backgroundColor: "#ffffff",
                    borderRadius: 16,
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: 28 }}>
                        <p
                          style={{
                            color: "#234b3d",
                            fontSize: 13,
                            letterSpacing: 2,
                          }}
                        >
                          KENSHUKAN · ENTRADAS
                        </p>
                        <h1 style={{ fontSize: 26 }}>
                          Tus entradas están listas
                        </h1>
                        <p style={{ fontSize: 18 }}>{eventName}</p>
                        <p>
                          Abrí cada entrada para ver su QR y descargar el PDF.
                          Cada código permite el ingreso de una persona.
                        </p>
                        {links.map((link) => (
                          <p key={link.number} style={{ margin: "18px 0" }}>
                            <a
                              href={link.url}
                              style={{
                                display: "inline-block",
                                padding: "14px 18px",
                                backgroundColor: "#234b3d",
                                color: "#ffffff",
                                borderRadius: 8,
                                textDecoration: "none",
                              }}
                            >
                              Ver entrada {link.number}
                            </a>
                          </p>
                        ))}
                        <p>
                          No compartas estos enlaces ni los códigos QR. Podés
                          guardar los PDF en tu celular o imprimirlos antes de
                          asistir.
                        </p>
                        <p style={{ fontSize: 12, color: "#53645b" }}>
                          La validez de cada entrada se comprueba al ingresar.
                          Si el pago se revierte o la entrada se anula, un PDF
                          guardado no habilita el acceso.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
