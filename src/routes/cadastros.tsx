import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader, useWorkspace } from "@/components/AppShell";
import { useStore, type Record_ } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/cadastros")({
  head: () => ({
    meta: [
      { title: "Clientes, processos e marcas — Órbita" },
      { name: "description", content: "Cadastros do escritório de advocacia, do registro de marcas e do varejo." },
      { property: "og:title", content: "Clientes, processos e marcas — Órbita" },
      { property: "og:description", content: "Base de clientes, processos e marcas por empresa." },
    ],
  }),
  component: () => (
    <AppShell>
      <Cadastros />
    </AppShell>
  ),
});

const kinds: { key: Record_["kind"] | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "cliente", label: "Clientes" },
  { key: "processo", label: "Processos" },
  { key: "marca", label: "Marcas" },
];

function Cadastros() {
  const { db, addRecord, removeRecord } = useStore();
  const { companyId } = useWorkspace();
  const [tab, setTab] = useState<string>("todos");

  const list = db.records
    .filter((r) => companyId === "all" || r.companyId === companyId)
    .filter((r) => tab === "todos" || r.kind === tab);

  return (
    <>
      <PageHeader
        title="Cadastros"
        subtitle="Clientes, processos e marcas de cada empresa"
        action={<NovoRegistro onAdd={addRecord} />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {kinds.map((k) => (
            <TabsTrigger key={k.key} value={k.key}>
              {k.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => {
              const c = db.companies.find((x) => x.id === r.companyId);
              return (
                <article key={r.id} className="surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="size-2 rounded-full" style={{ background: c?.accent }} />
                        {c?.name}
                      </p>
                      <h2 className="mt-1 text-base font-semibold leading-snug">{r.name}</h2>
                    </div>
                    <button
                      onClick={() => removeRecord(r.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Remover cadastro"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.detail}</p>
                  <div className="mt-3 flex gap-2">
                    <Badge variant="outline" className="capitalize">
                      {r.kind}
                    </Badge>
                    <Badge variant="secondary">{r.status}</Badge>
                  </div>
                </article>
              );
            })}
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum cadastro neste filtro.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function NovoRegistro({ onAdd }: { onAdd: (r: Omit<Record_, "id">) => void }) {
  const { db } = useStore();
  const { companyId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [empresa, setEmpresa] = useState(companyId === "all" ? db.companies[0]!.id : companyId);
  const [kind, setKind] = useState<Record_["kind"]>("cliente");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState("Ativo");

  function submit() {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    onAdd({ companyId: empresa, kind, name: name.trim(), detail, status });
    toast.success("Cadastro adicionado.");
    setName("");
    setDetail("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Novo cadastro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cadastro</DialogTitle>
          <DialogDescription>Cliente, processo judicial ou marca em registro.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Record_["kind"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="processo">Processo</SelectItem>
                <SelectItem value="marca">Marca</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Nome / número</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Construtora Vega" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Detalhe</Label>
            <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Contrato mensal — R$ 4.500" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Status</Label>
            <Input value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
