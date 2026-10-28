"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, Search, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  checkInTicketAction,
  scanTicketAction,
  searchTicketsAction,
} from "@/app/scanner/actions";
import type { CheckInFormState } from "@/modules/check-ins/validation";

type EventOption = {
  id: string;
  name: string;
  startsAt: Date;
  timezone: string;
  venue: string;
};

const initialState: CheckInFormState = {};

export function ScannerWorkspace({ events }: { events: EventOption[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const selectedEvent = events.find((event) => event.id === eventId);
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">Torneo</span>
        <select
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          className="min-h-12 w-full rounded-lg border bg-card px-3"
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </label>
      {selectedEvent && (
        <div className="rounded-lg bg-muted p-3 text-sm leading-6">
          <p className="font-medium">{selectedEvent.name}</p>
          <p className="text-muted-foreground">
            {new Intl.DateTimeFormat("es-AR", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: selectedEvent.timezone,
            }).format(selectedEvent.startsAt)}
            {" · "}
            {selectedEvent.venue}
          </p>
        </div>
      )}
      <EventScanner key={eventId} eventId={eventId} />
    </div>
  );
}

function EventScanner({ eventId }: { eventId: string }) {
  const [searchState, searchAction, searching] = useActionState(
    searchTicketsAction,
    initialState,
  );
  const [scanState, scanAction, scanning] = useActionState(
    scanTicketAction,
    initialState,
  );
  const [checkInState, checkInAction, checkingIn] = useActionState(
    checkInTicketAction,
    initialState,
  );
  const [cameraError, setCameraError] = useState("");
  const scanForm = useRef<HTMLFormElement>(null);
  const tokenInput = useRef<HTMLInputElement>(null);

  function submitDetectedValue(value: string) {
    if (!tokenInput.current || !scanForm.current) return;
    tokenInput.current.value = value;
    scanForm.current.requestSubmit();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <Camera aria-hidden="true" className="text-primary" />
          <div>
            <h2 className="font-semibold">Escanear entrada</h2>
            <p className="text-sm text-muted-foreground">
              Apuntá la cámara al código QR de la entrada.
            </p>
          </div>
        </div>
        <CameraReader
          onDetected={submitDetectedValue}
          onError={setCameraError}
        />
        {cameraError && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            {cameraError}
          </p>
        )}
        <form ref={scanForm} action={scanAction} className="mt-4 space-y-3">
          <input type="hidden" name="eventId" value={eventId} />
          <label className="block text-sm font-medium" htmlFor="scan-token">
            O pegá el contenido del QR
          </label>
          <input
            ref={tokenInput}
            id="scan-token"
            name="token"
            required
            maxLength={2048}
            autoComplete="off"
            placeholder="Código o enlace de la entrada"
            className="min-h-12 w-full rounded-lg border bg-background px-3"
          />
          <Button disabled={scanning} className="w-full sm:w-auto">
            <ScanLine aria-hidden="true" />
            {scanning ? "Validando…" : "Validar entrada"}
          </Button>
        </form>
        <CheckInResult state={scanState} />
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <Search aria-hidden="true" className="text-primary" />
          <div>
            <h2 className="font-semibold">Búsqueda manual</h2>
            <p className="text-sm text-muted-foreground">
              Buscá por número de entrada o nombre del asistente.
            </p>
          </div>
        </div>
        <form
          action={searchAction}
          className="space-y-3 sm:flex sm:gap-3 sm:space-y-0"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <label className="sr-only" htmlFor="ticket-search">
            Número de entrada o nombre del asistente
          </label>
          <input
            id="ticket-search"
            name="query"
            minLength={3}
            maxLength={100}
            required
            autoComplete="off"
            placeholder="Número o nombre (3 caracteres mínimo)"
            className="min-h-12 w-full rounded-lg border bg-background px-3"
          />
          <Button
            variant="outline"
            disabled={searching}
            className="w-full sm:w-auto"
          >
            {searching ? "Buscando…" : "Buscar"}
          </Button>
        </form>
        {searchState.error && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {searchState.error}
          </p>
        )}
        {searchState.results && (
          <div className="mt-4 space-y-3" aria-live="polite">
            {searchState.results.length ? (
              searchState.results.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-lg border p-3 sm:flex sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold">
                      {ticket.attendeeName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ticket.number} · {ticket.ticketType} ·{" "}
                      {ticketStatus(ticket.status)}
                    </p>
                  </div>
                  <form action={checkInAction} className="mt-3 sm:mt-0">
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <Button
                      variant="outline"
                      disabled={checkingIn}
                      className="w-full sm:w-auto"
                    >
                      {ticket.status === "VALID"
                        ? "Registrar ingreso"
                        : "Comprobar estado"}
                    </Button>
                  </form>
                </article>
              ))
            ) : (
              <p className="rounded-lg bg-muted p-3 text-sm">
                No encontramos entradas con esos datos para este torneo.
              </p>
            )}
          </div>
        )}
        <CheckInResult state={checkInState} />
      </section>
    </div>
  );
}

function ticketStatus(status: "VALID" | "USED" | "CANCELLED") {
  if (status === "VALID") return "Disponible";
  if (status === "USED") return "Ya utilizada";
  return "Anulada";
}

function CheckInResult({ state }: { state: CheckInFormState }) {
  if (state.error)
    return (
      <p
        role="alert"
        className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"
      >
        {state.error}
      </p>
    );
  if (!state.checkIn) return null;
  const copy = {
    ACCEPTED: {
      title: "Ingreso registrado",
      detail: "Esta entrada es válida y se marcó como utilizada.",
      styles: "border-green-300 bg-green-50 text-green-950",
    },
    ALREADY_USED: {
      title: "Entrada ya utilizada",
      detail: "El ingreso de esta entrada ya fue registrado anteriormente.",
      styles: "border-amber-300 bg-amber-50 text-amber-950",
    },
    INVALID: {
      title: "Entrada no válida",
      detail: "No encontramos una entrada activa para este código y torneo.",
      styles: "border-red-300 bg-red-50 text-red-950",
    },
    CANCELLED: {
      title: "Entrada anulada",
      detail: "Esta entrada fue anulada y no permite el ingreso.",
      styles: "border-red-300 bg-red-50 text-red-950",
    },
    WRONG_EVENT: {
      title: "Pertenece a otro torneo",
      detail: "Elegí el torneo correspondiente para validar esta entrada.",
      styles: "border-amber-300 bg-amber-50 text-amber-950",
    },
  }[state.checkIn.result];
  return (
    <div
      role="status"
      aria-live="assertive"
      className={`mt-4 rounded-lg border p-4 ${copy.styles}`}
    >
      <p className="text-lg font-bold">{copy.title}</p>
      <p className="mt-1 text-sm leading-6">{copy.detail}</p>
      {state.checkIn.ticketNumber && (
        <p className="mt-3 border-t border-current/20 pt-3 text-sm font-medium">
          {state.checkIn.ticketNumber}
          {state.checkIn.attendeeName ? ` · ${state.checkIn.attendeeName}` : ""}
          {state.checkIn.ticketType ? ` · ${state.checkIn.ticketType}` : ""}
        </p>
      )}
    </div>
  );
}

function CameraReader({
  onDetected,
  onError,
}: {
  onDetected: (value: string) => void;
  onError: (message: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onDetectedRef = useRef(onDetected);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  function stop() {
    setActive(false);
    setCameraMessage("Cámara detenida.");
  }

  async function start() {
    setStarting(true);
    setCameraMessage("");
    onError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("La cámara requiere HTTPS y un navegador compatible.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      setCameraMessage("Cámara activa. Centrá el QR dentro del recuadro.");
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      onError(
        "No pudimos abrir la cámara. Revisá el permiso del navegador o usá la búsqueda manual.",
      );
    } finally {
      setStarting(false);
    }
  }

  // Frames stay on-device and are read only while the camera is active.
  useEffect(() => {
    if (!active) return;
    let frameId = 0;
    let disposed = false;
    let lastRead = 0;
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const scanFrame = (timestamp: number) => {
      if (disposed) return;
      if (
        timestamp - lastRead >= 150 &&
        videoElement?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA &&
        canvasElement
      ) {
        lastRead = timestamp;
        const context = canvasElement.getContext("2d", {
          willReadFrequently: true,
        });
        if (context) {
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          context.drawImage(
            videoElement,
            0,
            0,
            canvasElement.width,
            canvasElement.height,
          );
          const frame = context.getImageData(
            0,
            0,
            canvasElement.width,
            canvasElement.height,
          );
          const code = jsQR(frame.data, frame.width, frame.height, {
            inversionAttempts: "dontInvert",
          });
          if (code?.data) {
            setCameraMessage("QR detectado. Validando entrada…");
            onDetectedRef.current(code.data);
            setActive(false);
            return;
          }
        }
      }
      frameId = requestAnimationFrame(scanFrame);
    };
    frameId = requestAnimationFrame(scanFrame);
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoElement) videoElement.srcObject = null;
    };
  }, [active]);

  return (
    <div>
      <div
        className={
          active
            ? "overflow-hidden rounded-lg bg-black"
            : "pointer-events-none fixed left-0 top-0 size-px overflow-hidden opacity-0"
        }
      >
        <video
          ref={videoRef}
          className="aspect-video max-h-[55dvh] w-full object-contain"
          muted
          playsInline
          aria-label="Vista de cámara para escanear la entrada"
        />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={active ? "outline" : "default"}
          disabled={starting}
          onClick={active ? stop : start}
          className="w-full sm:w-auto"
        >
          {active
            ? "Detener cámara"
            : starting
              ? "Abriendo cámara…"
              : "Activar cámara"}
        </Button>
        {cameraMessage && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {cameraMessage}
          </p>
        )}
      </div>
    </div>
  );
}
