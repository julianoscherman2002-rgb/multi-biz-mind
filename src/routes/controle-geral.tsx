import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Sparkles, Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useStore, brl, type Task } from "@/lib/store";
import { briefingData, contextForAI } from "@/lib/briefing";
import { askAssistant } from "@/lib/assistant.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/controle-geral")({
  head: () => ({
    meta: [
      { title: "Controle geral — briefing diário — Órbita" },
      {
        name: "description",
        content: "Briefing diário com obrigações atrasadas, tarefas do dia, semana e resultado de cada empresa.",
      },
      { property: "og:title", content: "Controle geral — briefing diário" },
      { property: "og:description", content: "Tudo que exige sua atenção hoje, nas três empresas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <ControleGeral />
    </AppShell>
  ),
});

function ControleGeral() {
  const { db } = useStore();
  const b = useMemo(() => briefingData(db), [db]);
  const [resumo, setResumo] = useState("");
  const [loading, setLoading] = useState(false);

  const hojeLabel = new Date(b.today + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  async function gerarResumo() {
    setLoading(true);
    const res = await askAssistant({
      data: {
        messages: [
          {
            role: "user",
            content:
              "Faça meu briefing diário: o que é urgente hoje, o que pode esperar, riscos financeiros do mês e 3 próximos passos concretos.",
          },
        ],
        context: contextForAI(db),
      },
    }).catch(() => ({ text: "", error: "Falha de conexão com a IA." }));
    setLoading(false);
    if (res.error || !res.text) {
      toast.error(res.error ?? "Não consegui gerar o briefing.");
      return;
    }
    setResumo(res.text);
  }

  return (
    <>
      <PageHeader
        title="Controle geral"
        subtitle={`Briefing de ${hojeLabel}`}
        action={
          <Button onClick={gerarResumo} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Briefing com IA
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Entradas do mês" value={brl(b.entradas)} icon={<TrendingUp className="size-4" />} />
        <Kpi label="Saídas do mês" value={brl(b.saidas)} icon={<TrendingDown className="size-4" />} />
        <Kpi
          label="Resultado do mês"
          value={brl(b.resultado)}
          icon={<Wallet className="size-4" />}
          tone={b.resultado >= 0 ? "positive" : "negative"}
        />
        <Kpi
          label="Obrigações atrasadas"
          value={String(b.atrasadas.length)}
          icon={<AlertTriangle className="size-4" />}
          tone={b.atrasadas.length ? "negative" : "positive"}
        />
      </div>

      {resumo && (
        <section className="surface mt-5 p-5">
          <h2 className="font-display text-lg">Briefing do assistente</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{resumo}</p>
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Bloco titulo="Atrasadas" tasks={b.atrasadas} vazio="Nada atrasado — ótimo." destaque />
        <Bloco titulo="Para hoje" tasks={b.hoje} vazio="Nenhuma tarefa marcada para hoje." />
        <Bloco titulo="Próximos 7 dias" tasks={b.semana} vazio="Semana livre por enquanto." />
      </div>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-lg">Situação por empresa</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {b.porEmpresa.map((p) => (
            <div key={p.company.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: p.company.accent }} />
                <p className="font-medium">{p.company.name}</p>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <Linha k="Resultado do mês" v={brl(p.resultado)} />
                <Linha k="Saldo em contas" v={brl(p.saldo)} />
                <Linha k="Tarefas pendentes" v={`${p.pendentes} (${p.atrasadas} atrasadas)`} />
              </dl>
            </div>
          ))}
        </div>
      </section>

      {b.semPrazo.length > 0 && (
        <section className="surface mt-5 p-5">
          <h2 className="font-display text-lg">Sem prazo definido</h2>
          <p className="text-xs text-muted-foreground">Defina um prazo para não perder de vista.</p>
          <ul className="mt-3 space-y-2">
            {b.semPrazo.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{t.title}</span>
                <Badge variant="secondary" className="font-normal">
                  {db.companies.find((c) => c.id === t.companyId)?.name}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className="mt-2 font-display text-2xl"
        style={tone ? { color: `var(--color-${tone})` } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function Bloco({
  titulo,
  tasks,
  vazio,
  destaque,
}: {
  titulo: string;
  tasks: Task[];
  vazio: string;
  destaque?: boolean;
}) {
  const { db } = useStore();
  return (
    <section className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg">{titulo}</h2>
        <span
          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          style={destaque && tasks.length ? { color: "var(--color-negative)" } : undefined}
        >
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <article key={t.id} className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-medium leading-snug">{t.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="gap-1.5 font-normal">
                <span
                  className="size-2 rounded-full"
                  style={{ background: db.companies.find((c) => c.id === t.companyId)?.accent }}
                />
                {db.companies.find((c) => c.id === t.companyId)?.name}
              </Badge>
              <span>prioridade {t.priority}</span>
              {t.due && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {new Date(t.due + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </article>
        ))}
        {tasks.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {vazio}
          </p>
        )}
      </div>
    </section>
  );
}
