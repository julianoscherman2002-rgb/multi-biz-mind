import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, CalendarClock, CalendarPlus, RefreshCw, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader, useWorkspace } from "@/components/AppShell";
import { useStore, type Task } from "@/lib/store";
import { listUpcomingEvents, upsertTaskEvent, deleteTaskEvent } from "@/lib/calendar.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas por empresa — Órbita" },
      { name: "description", content: "Workspace de pendências separado por empresa, com prazos e prioridades." },
      { property: "og:title", content: "Tarefas por empresa — Órbita" },
      { property: "og:description", content: "Kanban de pendências por empresa." },
    ],
  }),
  component: () => (
    <AppShell>
      <Tarefas />
    </AppShell>
  ),
});

const colunas: { key: Task["status"]; label: string }[] = [
  { key: "todo", label: "A fazer" },
  { key: "doing", label: "Em andamento" },
  { key: "done", label: "Concluído" },
];

const prioridadeCor: Record<Task["priority"], string> = {
  alta: "var(--color-negative)",
  media: "var(--color-brand-3)",
  baixa: "var(--color-brand-2)",
};

function Tarefas() {
  const { db, addTask, updateTask, removeTask } = useStore();
  const { companyId } = useWorkspace();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Task["status"] | null>(null);


  const agenda = useQuery({
    queryKey: ["gcal-events"],
    queryFn: () => listUpcomingEvents({ data: { days: 30 } }),
    staleTime: 60_000,
  });

  const tasks = useMemo(
    () => db.tasks.filter((t) => companyId === "all" || t.companyId === companyId),
    [db.tasks, companyId],
  );

  async function sincronizar(t: Task) {
    if (!t.due) {
      toast.error("Defina um prazo para enviar ao Google Calendar.");
      return;
    }
    setSyncing(t.id);
    const res = await upsertTaskEvent({
      data: {
        title: t.title,
        due: t.due,
        ...(t.notes ? { notes: t.notes } : {}),
        ...(t.gcalEventId ? { eventId: t.gcalEventId } : {}),
      },
    });
    setSyncing(null);
    if (res.error || !res.eventId) {
      toast.error(res.error ?? "Não foi possível sincronizar.");
      return;
    }
    updateTask(t.id, { gcalEventId: res.eventId, ...(res.htmlLink ? { gcalLink: res.htmlLink } : {}) });
    toast.success("Tarefa enviada para o Google Calendar.");
    agenda.refetch();
  }

  async function excluir(t: Task) {
    if (t.gcalEventId) await deleteTaskEvent({ data: { eventId: t.gcalEventId } });
    removeTask(t.id);
    agenda.refetch();
  }

  async function sincronizarTodas() {
    const pend = tasks.filter((t) => t.due && t.status !== "done");
    if (pend.length === 0) {
      toast.info("Nenhuma tarefa com prazo para sincronizar.");
      return;
    }
    for (const t of pend) await sincronizar(t);
  }

  return (
    <>
      <PageHeader
        title="Tarefas"
        subtitle={
          companyId === "all"
            ? "Pendências de todas as empresas — use o workspace lateral para focar em uma"
            : `Workspace: ${db.companies.find((c) => c.id === companyId)?.name}`
        }
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={sincronizarTodas}>
              <RefreshCw className="size-4" /> Sincronizar agenda
            </Button>
            <NovaTarefa onAdd={addTask} />
          </div>
        }
      />


      <div className="grid gap-5 md:grid-cols-3">
        {colunas.map((col) => {
          const list = tasks.filter((t) => t.status === col.key);
          return (
            <section key={col.key} className="surface flex flex-col p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg">{col.label}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {list.length}
                </span>
              </div>
              <div className="space-y-3">
                {list.map((t) => {
                  const c = db.companies.find((x) => x.id === t.companyId);
                  const atrasada =
                    t.due && t.status !== "done" && t.due < new Date().toISOString().slice(0, 10);
                  return (
                    <article key={t.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm font-medium leading-snug",
                            t.status === "done" && "text-muted-foreground line-through",
                          )}
                        >
                          {t.title}
                        </p>
                        <button
                          onClick={() => excluir(t)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label="Excluir tarefa"
                        >
                          <Trash2 className="size-3.5" />
                        </button>

                      </div>
                      {t.notes && <p className="mt-1 text-xs text-muted-foreground">{t.notes}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1.5 font-normal">
                          <span className="size-2 rounded-full" style={{ background: c?.accent }} />
                          {c?.name}
                        </Badge>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            color: prioridadeCor[t.priority],
                            background: "color-mix(in oklab, currentColor 12%, transparent)",
                          }}
                        >
                          {t.priority}
                        </span>
                        {t.due && (
                          <span
                            className="flex items-center gap-1 text-[11px]"
                            style={{ color: atrasada ? "var(--color-negative)" : undefined }}
                          >
                            <CalendarClock className="size-3" />
                            {new Date(t.due + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {colunas
                          .filter((x) => x.key !== t.status)
                          .map((x) => (
                            <Button
                              key={x.key}
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => updateTask(t.id, { status: x.key })}
                            >
                              → {x.label}
                            </Button>
                          ))}
                        {t.due && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={syncing === t.id}
                            onClick={() => sincronizar(t)}
                          >
                            {t.gcalEventId ? (
                              <Check className="size-3" />
                            ) : (
                              <CalendarPlus className="size-3" />
                            )}
                            {t.gcalEventId ? "Na agenda" : "Google Calendar"}
                          </Button>
                        )}
                        {t.gcalLink && (
                          <a
                            href={t.gcalLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-7 items-center gap-1 px-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="size-3" /> abrir
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
                {list.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Nada aqui
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="surface mt-5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg">Agenda do Google — próximos 30 dias</h2>
            <p className="text-xs text-muted-foreground">
              Eventos da sua conta Google conectada, ao lado das tarefas.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => agenda.refetch()}>
            <RefreshCw className={cn("size-3.5", agenda.isFetching && "animate-spin")} /> Atualizar
          </Button>
        </div>
        {agenda.data?.error && (
          <p className="text-xs text-[var(--color-negative)]">{agenda.data.error}</p>
        )}
        {!agenda.data?.error && (agenda.data?.events.length ?? 0) === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {agenda.isLoading ? "Carregando agenda..." : "Nenhum evento nos próximos 30 dias"}
          </p>
        )}
        <ul className="divide-y divide-border">
          {(agenda.data?.events ?? []).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm">{e.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {e.start &&
                  new Date(e.allDay ? e.start + "T00:00:00" : e.start).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    ...(e.allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
                  })}
                {e.htmlLink && (
                  <a href={e.htmlLink} target="_blank" rel="noreferrer" className="hover:text-foreground">
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );

}

function NovaTarefa({ onAdd }: { onAdd: (t: Omit<Task, "id">) => void }) {
  const { db } = useStore();
  const { companyId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [empresa, setEmpresa] = useState(companyId === "all" ? db.companies[0]!.id : companyId);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("media");

  function submit() {
    if (!title.trim()) {
      toast.error("Dê um título para a tarefa.");
      return;
    }
    onAdd({
      companyId: empresa,
      title: title.trim(),
      priority,
      status: "todo",
      ...(notes ? { notes } : {}),
      ...(due ? { due } : {}),
    });
    toast.success("Tarefa criada.");
    setTitle("");
    setNotes("");
    setDue("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nova tarefa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Ela ficará no workspace da empresa escolhida.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Protocolar recurso..." />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Empresa</Label>
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {db.companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Prazo</Label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Criar tarefa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
