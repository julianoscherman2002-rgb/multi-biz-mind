import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  INTER_CHECKING_INITIAL,
  INTER_CHECKING_TX,
  INTER_PJ_INITIAL,
  INTER_PJ_TX,
  resolveDirection,
  type RawTx,
} from "./statements";


export type CompanyId = string;

export type Company = {
  id: CompanyId;
  name: string;
  segment: string;
  accent: string; // css color token value
};

export type Account = {
  id: string;
  companyId: CompanyId;
  name: string;
  bank: string;
  initialBalance: number;
};

export type Transaction = {
  id: string;
  companyId: CompanyId;
  accountId: string;
  date: string; // yyyy-mm-dd
  description: string;
  category: string;
  type: "in" | "out" | "invest";
  amount: number;
};

export type Task = {
  id: string;
  companyId: CompanyId;
  title: string;
  notes?: string;
  due?: string;
  priority: "baixa" | "media" | "alta";
  status: "todo" | "doing" | "done";
  gcalEventId?: string;
  gcalLink?: string;
};


export type Record_ = {
  id: string;
  companyId: CompanyId;
  kind: "cliente" | "processo" | "marca";
  name: string;
  detail: string;
  status: string;
};

export type DB = {
  companies: Company[];
  accounts: Account[];
  transactions: Transaction[];
  tasks: Task[];
  records: Record_[];
};

const uid = () => Math.random().toString(36).slice(2, 10);

const KEY = "gestao-multi-empresas-v2";


function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function seed(): DB {
  const companies: Company[] = [
    { id: "adv", name: "Advocacia", segment: "Escritório de advocacia", accent: "var(--brand-1)" },
    { id: "marcas", name: "Registro de Marcas", segment: "Propriedade intelectual", accent: "var(--brand-2)" },
    { id: "varejo", name: "Varejo ML", segment: "Mercado Livre", accent: "var(--brand-3)" },
  ];

  const accounts: Account[] = [
    { id: "a1", companyId: "adv", name: "Conta PJ Principal", bank: "Itaú", initialBalance: 0 },
    { id: "a2", companyId: "marcas", name: "Conta PJ", bank: "Nubank", initialBalance: 0 },
    {
      id: "inter-cc",
      companyId: "varejo",
      name: "Conta Corrente 516447238",
      bank: "Banco Inter",
      initialBalance: INTER_CHECKING_INITIAL,
    },
    {
      id: "inter-pj",
      companyId: "varejo",
      name: "Conta PJ 549605118",
      bank: "Banco Inter",
      initialBalance: INTER_PJ_INITIAL,
    },
  ];

  const fromStatement = (list: RawTx[], accountId: string): Transaction[] =>
    list.map((t) => {
      const { type, amount } = resolveDirection(t.description, t.amount);
      return {
        id: uid(),
        companyId: "varejo",
        accountId,
        date: t.date,
        description: t.description,
        category: t.category,
        type,
        amount,
      };
    });

  const transactions: Transaction[] = [
    ...fromStatement(INTER_CHECKING_TX, "inter-cc"),
    ...fromStatement(INTER_PJ_TX, "inter-pj"),
  ];


  const tasks: Task[] = [
    { id: uid(), companyId: "adv", title: "Protocolar petição inicial — caso Silva", priority: "alta", status: "todo", due: isoDaysAgo(-2) },
    { id: uid(), companyId: "adv", title: "Revisar contrato de honorários", priority: "media", status: "doing" },
    { id: uid(), companyId: "adv", title: "Audiência trabalhista — preparar", priority: "alta", status: "todo", due: isoDaysAgo(-6) },
    { id: uid(), companyId: "marcas", title: "Responder exigência INPI (proc. 923...)", priority: "alta", status: "todo", due: isoDaysAgo(-1) },
    { id: uid(), companyId: "marcas", title: "Enviar relatório de busca ao cliente", priority: "media", status: "done" },
    { id: uid(), companyId: "varejo", title: "Repor estoque dos 5 mais vendidos", priority: "alta", status: "doing" },
    { id: uid(), companyId: "varejo", title: "Ajustar preços com nova tarifa ML", priority: "media", status: "todo", due: isoDaysAgo(-4) },
    { id: uid(), companyId: "varejo", title: "Responder perguntas pendentes", priority: "baixa", status: "todo" },
  ];

  const records: Record_[] = [
    { id: uid(), companyId: "adv", kind: "cliente", name: "Construtora Vega", detail: "Contrato mensal — R$ 4.500", status: "Ativo" },
    { id: uid(), companyId: "adv", kind: "processo", name: "0012345-67.2025.8.26", detail: "Trabalhista — 2ª instância", status: "Em andamento" },
    { id: uid(), companyId: "marcas", kind: "marca", name: "CAFÉ AURORA", detail: "Classe 30 — depósito 04/2026", status: "Em exame" },
    { id: uid(), companyId: "marcas", kind: "cliente", name: "Aurora Alimentos", detail: "2 marcas em andamento", status: "Ativo" },
    { id: uid(), companyId: "varejo", kind: "cliente", name: "Loja oficial ML", detail: "Reputação verde", status: "Ativo" },
  ];

  return { companies, accounts, transactions, tasks, records };
}

type Ctx = {
  db: DB;
  ready: boolean;
  setDb: (fn: (prev: DB) => DB) => void;
  addTransaction: (t: Omit<Transaction, "id">) => void;
  addTransactions: (t: Omit<Transaction, "id">[]) => void;
  removeTransaction: (id: string) => void;
  addTask: (t: Omit<Task, "id">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addAccount: (a: Omit<Account, "id">) => void;
  removeAccount: (id: string) => void;
  addRecord: (r: Omit<Record_, "id">) => void;
  removeRecord: (id: string) => void;
  addCompany: (c: Omit<Company, "id">) => void;
  reset: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDbState] = useState<DB>(() => seed());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setDbState(JSON.parse(raw) as DB);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* ignore */
    }
  }, [db, ready]);

  const value = useMemo<Ctx>(() => {
    const setDb = (fn: (prev: DB) => DB) => setDbState((prev) => fn(prev));
    return {
      db,
      ready,
      setDb,
      addTransaction: (t) => setDb((p) => ({ ...p, transactions: [{ ...t, id: uid() }, ...p.transactions] })),
      addTransactions: (list) =>
        setDb((p) => ({ ...p, transactions: [...list.map((t) => ({ ...t, id: uid() })), ...p.transactions] })),
      removeTransaction: (id) => setDb((p) => ({ ...p, transactions: p.transactions.filter((t) => t.id !== id) })),
      addTask: (t) => setDb((p) => ({ ...p, tasks: [{ ...t, id: uid() }, ...p.tasks] })),
      updateTask: (id, patch) =>
        setDb((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTask: (id) => setDb((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== id) })),
      addAccount: (a) => setDb((p) => ({ ...p, accounts: [...p.accounts, { ...a, id: uid() }] })),
      removeAccount: (id) => setDb((p) => ({ ...p, accounts: p.accounts.filter((a) => a.id !== id) })),
      addRecord: (r) => setDb((p) => ({ ...p, records: [{ ...r, id: uid() }, ...p.records] })),
      removeRecord: (id) => setDb((p) => ({ ...p, records: p.records.filter((r) => r.id !== id) })),
      addCompany: (c) => setDb((p) => ({ ...p, companies: [...p.companies, { ...c, id: uid() }] })),
      reset: () => setDbState(seed()),
    };
  }, [db, ready]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

/* ---------- selectors / helpers ---------- */

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const brlExact = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y!.slice(2)}`;
}

export function weekKey(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function accountBalance(db: DB, accountId: string) {
  const acc = db.accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  return db.transactions
    .filter((t) => t.accountId === accountId)
    .reduce((sum, t) => sum + (t.type === "in" ? t.amount : -t.amount), acc.initialBalance);
}
