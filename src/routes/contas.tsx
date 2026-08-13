import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader, useWorkspace } from "@/components/AppShell";
import { accountBalance, brlExact, useStore, type Account } from "@/lib/store";
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

export const Route = createFileRoute("/contas")({
  head: () => ({
    meta: [
      { title: "Contas bancárias — Órbita" },
      { name: "description", content: "Saldos por conta e por empresa, atualizados pelos lançamentos." },
      { property: "og:title", content: "Contas bancárias — Órbita" },
      { property: "og:description", content: "Saldos e movimentação por conta bancária." },
    ],
  }),
  component: () => (
    <AppShell>
      <Contas />
    </AppShell>
  ),
});

function Contas() {
  const { db, addAccount, removeAccount } = useStore();
  const { companyId } = useWorkspace();

  const accounts = db.accounts.filter((a) => companyId === "all" || a.companyId === companyId);
  const total = accounts.reduce((s, a) => s + accountBalance(db, a.id), 0);

  return (
    <>
      <PageHeader
        title="Contas bancárias"
        subtitle={`Saldo consolidado ${brlExact(total)}`}
        action={<NovaConta onAdd={addAccount} />}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => {
          const c = db.companies.find((x) => x.id === a.companyId);
          const saldo = accountBalance(db, a.id);
          const movs = db.transactions.filter((t) => t.accountId === a.id).length;
          return (
            <article key={a.id} className="surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: c?.accent }} />
                    {c?.name}
                  </p>
                  <h2 className="mt-1 font-display text-lg">{a.name}</h2>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="size-3.5" /> {a.bank}
                  </p>
                </div>
                <button
                  onClick={() => removeAccount(a.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Remover conta"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <p
                className="mt-4 font-display text-2xl tabular-nums"
                style={{ color: saldo >= 0 ? "var(--color-positive)" : "var(--color-negative)" }}
              >
                {brlExact(saldo)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Saldo inicial {brlExact(a.initialBalance)} · {movs} movimentações
              </p>
            </article>
          );
        })}
        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada neste workspace.</p>
        )}
      </div>
    </>
  );
}

function NovaConta({ onAdd }: { onAdd: (a: Omit<Account, "id">) => void }) {
  const { db } = useStore();
  const { companyId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [empresa, setEmpresa] = useState(companyId === "all" ? db.companies[0]!.id : companyId);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [saldo, setSaldo] = useState("");

  function submit() {
    if (!name.trim() || !bank.trim()) {
      toast.error("Informe nome e banco.");
      return;
    }
    onAdd({
      companyId: empresa,
      name: name.trim(),
      bank: bank.trim(),
      initialBalance: Number(saldo.replace(/\./g, "").replace(",", ".")) || 0,
    });
    toast.success("Conta cadastrada.");
    setName("");
    setBank("");
    setSaldo("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nova conta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta bancária</DialogTitle>
          <DialogDescription>O saldo é recalculado com base nos lançamentos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
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
            <Label>Nome da conta</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Conta PJ Principal" />
          </div>
          <div className="grid gap-2">
            <Label>Banco</Label>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Itaú" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Saldo inicial (R$)</Label>
            <Input value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="10000,00" inputMode="decimal" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
