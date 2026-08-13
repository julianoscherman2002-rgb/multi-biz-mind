import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

async function gcal(path: string, init?: RequestInit) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Google Calendar não está conectado neste projeto.");
  }
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Calendar request failed [${res.status}]: ${body}`);
    throw new Error(`Google Calendar respondeu ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // iso date or datetime
  allDay: boolean;
  htmlLink?: string;
};

/** Eventos dos próximos N dias na agenda principal. */
export const listUpcomingEvents = createServerFn({ method: "GET" })
  .inputValidator((input: { days?: number } | undefined) => ({ days: input?.days ?? 30 }))
  .handler(async ({ data }): Promise<{ events: CalendarEvent[]; error?: string }> => {
    try {
      const now = new Date();
      const max = new Date(now.getTime() + data.days * 86400000);
      const qs = new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: max.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
      });
      const json = await gcal(`/calendars/primary/events?${qs.toString()}`);
      const events: CalendarEvent[] = (json.items ?? []).map((e: any) => ({
        id: e.id,
        title: e.summary ?? "(sem título)",
        start: e.start?.dateTime ?? e.start?.date ?? "",
        allDay: Boolean(e.start?.date),
        htmlLink: e.htmlLink,
      }));
      return { events };
    } catch (err) {
      return { events: [], error: err instanceof Error ? err.message : "Falha ao ler a agenda." };
    }
  });

/** Cria (ou atualiza) um evento de dia inteiro para uma tarefa com prazo. */
export const upsertTaskEvent = createServerFn({ method: "POST" })
  .inputValidator((input: {
    title: string;
    due: string; // yyyy-mm-dd
    notes?: string;
    eventId?: string;
  }) => {
    if (!input?.title?.trim()) throw new Error("Título obrigatório.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.due ?? "")) throw new Error("Prazo inválido.");
    return input;
  })
  .handler(async ({ data }): Promise<{ eventId?: string; htmlLink?: string; error?: string }> => {
    try {
      const end = new Date(data.due + "T00:00:00Z");
      end.setUTCDate(end.getUTCDate() + 1);
      const body = {
        summary: data.title,
        description: data.notes ?? "Criado pelo Órbita",
        start: { date: data.due },
        end: { date: end.toISOString().slice(0, 10) },
      };
      const json = data.eventId
        ? await gcal(`/calendars/primary/events/${encodeURIComponent(data.eventId)}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await gcal(`/calendars/primary/events`, { method: "POST", body: JSON.stringify(body) });
      return { eventId: json.id, htmlLink: json.htmlLink };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Falha ao criar evento." };
    }
  });

/** Remove o evento vinculado a uma tarefa. */
export const deleteTaskEvent = createServerFn({ method: "POST" })
  .inputValidator((input: { eventId: string }) => {
    if (!input?.eventId) throw new Error("eventId obrigatório.");
    return input;
  })
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const lovableKey = process.env["LOVABLE_API_KEY"];
      const connKey = process.env["GOOGLE_CALENDAR_API_KEY"];
      const res = await fetch(
        `${GATEWAY}/calendars/primary/events/${encodeURIComponent(data.eventId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": connKey ?? "",
          },
        },
      );
      if (!res.ok && res.status !== 410 && res.status !== 404) {
        const body = await res.text();
        console.error(`Google Calendar delete failed [${res.status}]: ${body}`);
        return { ok: false, error: `Google Calendar respondeu ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Falha ao excluir evento." };
    }
  });
