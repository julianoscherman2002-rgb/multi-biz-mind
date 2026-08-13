import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader, useWorkspace } from "@/components/AppShell";
import { brlExact, monthKey, monthLabel, useStore, type Transaction } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Órbita" },
      { name: "description", content: "Lançamentos, importação de extratos CSV e resultado por mês." },
      { property: "og:title", content: "Financeiro — Órbita" },
      { property: "og:description", content: "Lançamentos e importação de extratos por empresa." },
    ],
  }),
  component: () => (
    <AppShell>
      <Financeiro />
    </AppShell>
  ),
});

function Financeiro() {
  const { db, addTransaction, addTransactions, removeTransaction } = useStore();
  const { companyId } = useWorkspace();
  const [mes, setMes] = useState("todos");
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(
    () =>
      db.transactions
        .filter((t) => companyId === "all" || t.companyId === companyId)
        .filter((t) => mes === "todos" || monthKey(t.date) === mes)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.transactions, companyId, mes],
  );

  const meses = useMemo(
    () => [...new Set(db.transactions.map((t) => monthKey(t.date)))].sort().reverse(),
    [db.transactions],
  );

  const entradas = list.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const saidas = list.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);

  function handleCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = text.split(/\r?\n/).filter((r) => r.trim());
      const targetCompany = companyId === "all" ? db.companies[0]!.id : companyId;
      const account =
        db.accounts.find((a) => a.companyId === targetCompany) ?? db.accounts[0];
      if (!account) {
        toast.error("Cadastre uma conta bancária antes de importar.");
        return;
      }
      const parsed: Omit<Transaction, "id">[] = [];
      for (const [i, row] of rows.entries()) {
        const cols = row.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.length < 3) continue;
        const [dateRaw, desc, valueRaw] = cols;
        if (i === 0 && !/\d/.test(dateRaw ?? "")) continue; // cabeçalho
        const date = normalizeDate(dateRaw ?? "");
        const value = parseValue(valueRaw ?? "");
        if (!date || Number.isNaN(value) || value === 0) continue;
        parsed.push({
          companyId: targetCompany,
          accountId: account.id,
          date,
          description: desc || "Importado",
          category: "Importado",
          type: value >= 0 ? "in" : "out",
          amount: Math.abs(value),
        });
      }
      if (parsed.length === 0) {
        toast.error("Nenhuma linha válida encontrada. Use: data;descrição;valor");
        return;
      }
      addTransactions(parsed);
      toast.success(`${parsed.length} lançamento(s) importado(s).`);
    };
    reader.readAsText(file);
  }

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Lançamentos manuais e importação de extratos"
        action={
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCsv(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Importar CSV
            </Button>
            <NovoLancamento onAdd={addTransaction} />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Entradas" value={brlExact(entradas)} color="var(--color-positive)" />
        <Stat label="Saídas" value={brlExact(saidas)} color="var(--color-negative)" />
        <Stat label="Resultado" value={brlExact(entradas - saidas)} />
      </div>

      <div className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p className="text-sm font-medium">{list.length} lançamento(s)</p>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-5 py-2 font-medium">Data</th>
                <th className="px-5 py-2 font-medium">Descrição</th>
                <th className="px-5 py-2 font-medium">Empresa</th>
                <th className="px-5 py-2 text-right font-medium">Valor</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 300).map((t) => {
                const c = db.companies.find((x) => x.id === t.companyId);
                return (
                  <tr key={t.id} className="border-t border-border/70">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">
                      {new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-2.5">
                      {t.description}
                      <span className="ml-2 text-xs text-muted-foreground">{t.category}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge variant="secondary" className="gap-1.5 font-normal">
                        <span className="size-2 rounded-full" style={{ background: c?.accent }} />
                        {c?.name}
                      </Badge>
                    </td>
                    <td
                      className="whitespace-nowrap px-5 py-2.5 text-right font-medium tabular-nums"
                      style={{
                        color: t.type === "in" ? "var(--color-positive)" : "var(--color-negative)",
                      }}
                    >
                      {t.type === "in" ? "+" : "−"} {brlExact(t.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => removeTransaction(t.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Excluir lançamento"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Formato do CSV: <code>data;descrição;valor</code> — valores negativos viram saídas.
      </p>
    </>
  );
}

function normalizeDate(v: string) {
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return v.slice(0, 10);
  return "";
}

function parseValue(v: string) {
  const clean = v.replace(/[R$\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  return Number(clean);
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function NovoLancamento({ onAdd }: { onAdd: (t: Omit<Transaction, "id">) => void }) {
  const { db } = useStore();
  const { companyId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [empresa, setEmpresa] = useState(companyId === "all" ? db.companies[0]!.id : companyId);
  const [tipo, setTipo] = useState<"in" | "out">("in");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  const contas = db.accounts.filter((a) => a.companyId === empresa);
  const [conta, setConta] = useState(contas[0]?.id ?? "");

  function submit() {
    const amount = parseValue(valor);
    const accountId = contas.find((c) => c.id === conta)?.id ?? contas[0]?.id;
    if (!descricao || !amount || !accountId) {
      toast.error("Preencha descrição, valor e conta.");
      return;
    }
    onAdd({
      companyId: empresa,
      accountId,
      date: data,
      description: descricao,
      category: categoria || (tipo === "in" ? "Receita" : "Despesa"),
      type: tipo,
      amount: Math.abs(amount),
    });
    toast.success("Lançamento adicionado.");
    setDescricao("");
    setValor("");
    setCategoria("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Lançamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Registre uma entrada ou saída de uma das empresas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Empresa</Label>
            <Select
              value={empresa}
              onValueChange={(v) => {
                setEmpresa(v);
                setConta(db.accounts.find((a) => a.companyId === v)?.id ?? "");
              }}
            >
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
            <Label>Conta</Label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {contas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "in" | "out")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Entrada</SelectItem>
                <SelectItem value="out">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Honorários cliente X" />
          </div>
          <div className="grid gap-2">
            <Label>Categoria</Label>
            <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Honorários" />
          </div>
          <div className="grid gap-2">
            <Label>Valor (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="1500,00" inputMode="decimal" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
