import { accountBalance, brl, monthKey, type DB } from "@/lib/store";

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function briefingData(db: DB) {
  const today = todayISO();
  const in7 = addDays(today, 7);
  const pend = db.tasks.filter((t) => t.status !== "done");

  const atrasadas = pend.filter((t) => t.due && t.due < today);
  const hoje = pend.filter((t) => t.due === today);
  const semana = pend.filter((t) => t.due && t.due > today && t.due <= in7);
  const semPrazo = pend.filter((t) => !t.due);

  const mk = monthKey(today);
  const mes = db.transactions.filter((t) => monthKey(t.date) === mk);
  const entradas = mes.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const saidas = mes.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);
  const investido = mes.filter((t) => t.type === "invest").reduce((s, t) => s + t.amount, 0);

  const porEmpresa = db.companies.map((c) => {
    const tx = mes.filter((t) => t.companyId === c.id);
    const e = tx.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
    const s = tx.filter((t) => t.type === "out").reduce((s2, t) => s2 + t.amount, 0);
    const inv = tx.filter((t) => t.type === "invest").reduce((s2, t) => s2 + t.amount, 0);
    return {
      company: c,
      entradas: e,
      saidas: s,
      investido: inv,
      resultado: e - s,
      pendentes: pend.filter((t) => t.companyId === c.id).length,
      atrasadas: atrasadas.filter((t) => t.companyId === c.id).length,
      saldo: db.accounts
        .filter((a) => a.companyId === c.id)
        .reduce((sum, a) => sum + accountBalance(db, a.id), 0),
    };
  });

  return {
    today,
    atrasadas,
    hoje,
    semana,
    semPrazo,
    entradas,
    saidas,
    investido,
    resultado: entradas - saidas,
    porEmpresa,
  };
}

/** Resumo textual dos dados, usado como contexto para a IA. */
export function contextForAI(db: DB) {
  const b = briefingData(db);
  const nome = (id: string) => db.companies.find((c) => c.id === id)?.name ?? id;
  const lista = (arr: typeof b.atrasadas) =>
    arr.length === 0
      ? "nenhuma"
      : arr
          .slice(0, 20)
          .map((t) => `- [${nome(t.companyId)}] ${t.title} (prioridade ${t.priority}${t.due ? `, prazo ${t.due}` : ""})`)
          .join("\n");

  return [
    `Data de hoje: ${b.today}`,
    `Mês atual — entradas ${brl(b.entradas)}, saídas ${brl(b.saidas)}, resultado ${brl(b.resultado)}, investimentos/aplicações ${brl(b.investido)} (não são despesa).`,
    "Por empresa (mês atual):",
    ...b.porEmpresa.map(
      (p) =>
        `- ${p.company.name} (${p.company.segment}): entradas ${brl(p.entradas)}, saídas ${brl(p.saidas)}, resultado ${brl(
          p.resultado,
        )}, saldo em contas ${brl(p.saldo)}, ${p.pendentes} tarefas pendentes (${p.atrasadas} atrasadas).`,
    ),
    `\nTarefas ATRASADAS:\n${lista(b.atrasadas)}`,
    `\nTarefas de HOJE:\n${lista(b.hoje)}`,
    `\nTarefas dos PRÓXIMOS 7 DIAS:\n${lista(b.semana)}`,
    `\nTarefas SEM PRAZO:\n${lista(b.semPrazo)}`,
  ].join("\n");
}
