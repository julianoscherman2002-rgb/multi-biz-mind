import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, TrendingUp, Wallet } from "lucide-react";
import { AppShell, PageHeader, useWorkspace } from "@/components/AppShell";
import {
  accountBalance,
  brl,
  monthKey,
  monthLabel,
  useStore,
  weekKey,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function Dashboard() {
  const { db } = useStore();
  const { companyId } = useWorkspace();

  const txs = useMemo(
    () => db.transactions.filter((t) => companyId === "all" || t.companyId === companyId),
    [db.transactions, companyId],
  );

  const monthly = useMemo(() => {
    const map = new Map<string, { key: string; entradas: number; saidas: number }>();
    for (const t of txs) {
      const k = monthKey(t.date);
      const row = map.get(k) ?? { key: k, entradas: 0, saidas: 0 };
      if (t.type === "in") row.entradas += t.amount;
      else row.saidas += t.amount;
      map.set(k, row);
    }
    return [...map.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ ...r, mes: monthLabel(r.key), saldo: r.entradas - r.saidas }));
  }, [txs]);

  const weekly = useMemo(() => {
    const map = new Map<string, { key: string; entradas: number; saidas: number }>();
    for (const t of txs) {
      const k = weekKey(t.date);
      const row = map.get(k) ?? { key: k, entradas: 0, saidas: 0 };
      if (t.type === "in") row.entradas += t.amount;
      else row.saidas += t.amount;
      map.set(k, row);
    }
    return [...map.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-9)
      .map((r) => ({ ...r, semana: r.key.slice(8) + "/" + r.key.slice(5, 7) }));
  }, [txs]);

  const totals = useMemo(() => {
    const entradas = txs.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
    const saidas = txs.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);
    const meses = Math.max(monthly.length, 1);
    return { entradas, saidas, saldo: entradas - saidas, mediaMensal: (entradas - saidas) / meses, meses };
  }, [txs, monthly.length]);

  const porEmpresa = useMemo(
    () =>
      db.companies.map((c) => {
        const list = db.transactions.filter((t) => t.companyId === c.id);
        const entradas = list.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
        const saidas = list.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);
        return { name: c.name, entradas, saidas, resultado: entradas - saidas, accent: c.accent };
      }),
    [db],
  );

  const saldoContas = useMemo(
    () =>
      db.accounts
        .filter((a) => companyId === "all" || a.companyId === companyId)
        .reduce((s, a) => s + accountBalance(db, a.id), 0),
    [db, companyId],
  );

  const pendentes = db.tasks.filter(
    (t) => t.status !== "done" && (companyId === "all" || t.companyId === companyId),
  );

  const ultimoMes = monthly.at(-1);
  const penultimo = monthly.at(-2);
  const variacao =
    ultimoMes && penultimo && penultimo.entradas > 0
      ? ((ultimoMes.entradas - penultimo.entradas) / penultimo.entradas) * 100
      : 0;

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle={
          companyId === "all"
            ? "Consolidado das suas empresas nos últimos meses"
            : db.companies.find((c) => c.id === companyId)?.segment
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Saldo em contas"
          value={brl(saldoContas)}
          icon={<Wallet className="size-4" />}
          hint={`${db.accounts.filter((a) => companyId === "all" || a.companyId === companyId).length} conta(s)`}
        />
        <Kpi
          label="Entradas (período)"
          value={brl(totals.entradas)}
          tone="positive"
          icon={<ArrowUpRight className="size-4" />}
          hint={`${variacao >= 0 ? "+" : ""}${variacao.toFixed(1)}% vs. mês anterior`}
        />
        <Kpi
          label="Saídas (período)"
          value={brl(totals.saidas)}
          tone="negative"
          icon={<ArrowDownRight className="size-4" />}
          hint={`${totals.meses} meses de histórico`}
        />
        <Kpi
          label="Média mensal (líquido)"
          value={brl(totals.mediaMensal)}
          icon={<TrendingUp className="size-4" />}
          hint={`Resultado total ${brl(totals.saldo)}`}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <h2 className="font-display text-lg">Mês a mês</h2>
          <p className="mb-4 text-xs text-muted-foreground">Entradas e saídas consolidadas</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ left: 4, right: 4 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-positive)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-positive)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-negative)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-negative)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={40}
                />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="entradas"
                  stroke="var(--color-positive)"
                  fill="url(#gIn)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="saidas"
                  stroke="var(--color-negative)"
                  fill="url(#gOut)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface p-5">
          <h2 className="font-display text-lg">Resultado por empresa</h2>
          <p className="mb-4 text-xs text-muted-foreground">Participação no resultado líquido</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={porEmpresa}
                  dataKey="resultado"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {porEmpresa.map((p) => (
                    <Cell key={p.name} fill={p.accent} stroke="var(--color-card)" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-2 text-sm">
            {porEmpresa.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2.5 rounded-full" style={{ background: p.accent }} />
                  {p.name}
                </span>
                <span className="font-medium tabular-nums">{brl(p.resultado)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <h2 className="font-display text-lg">Semana a semana</h2>
          <p className="mb-4 text-xs text-muted-foreground">Últimas 9 semanas</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="semana" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  formatter={(v: number) => brl(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                  }}
                />
                <Bar dataKey="entradas" fill="var(--color-positive)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saidas" fill="var(--color-negative)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Pendências</h2>
            <Link to="/tarefas" className="text-xs font-medium text-primary hover:underline">
              ver todas
            </Link>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">{pendentes.length} tarefa(s) em aberto</p>
          <ul className="space-y-3">
            {pendentes.slice(0, 6).map((t) => {
              const c = db.companies.find((x) => x.id === t.companyId);
              return (
                <li key={t.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium leading-snug">{t.title}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: c?.accent }} />
                    {c?.name}
                    {t.due && <span>· vence {new Date(t.due + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                  </p>
                </li>
              );
            })}
            {pendentes.length === 0 && (
              <li className="text-sm text-muted-foreground">Nada pendente por aqui.</li>
            )}
          </ul>
        </div>
      </section>
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p
        className="mt-2 font-display text-2xl tabular-nums"
        style={
          tone
            ? { color: tone === "positive" ? "var(--color-positive)" : "var(--color-negative)" }
            : undefined
        }
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
