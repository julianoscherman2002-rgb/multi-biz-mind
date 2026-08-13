import { Link, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Wallet,
  ListChecks,
  Landmark,
  FolderKanban,
  Circle,
  Sparkles,
  ClipboardCheck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type WorkspaceCtx = { companyId: string; setCompanyId: (id: string) => void };
const Ctx = createContext<WorkspaceCtx>({ companyId: "all", setCompanyId: () => {} });
export const useWorkspace = () => useContext(Ctx);

const nav = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/controle-geral", label: "Controle geral", icon: ClipboardCheck },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/contas", label: "Contas", icon: Landmark },
  { to: "/cadastros", label: "Cadastros", icon: FolderKanban },
  { to: "/assistente", label: "Assistente", icon: Sparkles },
] as const;


export function AppShell({ children }: { children: ReactNode }) {
  const { db } = useStore();
  const [companyId, setCompanyId] = useState("all");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Ctx.Provider value={{ companyId, setCompanyId }}>
      <div className="min-h-screen md:flex">
        <aside className="bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 flex flex-col">
          <div className="px-5 py-6">
            <p className="font-display text-2xl leading-none text-sidebar-accent-foreground">Órbita</p>
            <p className="mt-1 text-xs text-sidebar-foreground/60">gestão multi-empresas</p>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
            {nav.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto hidden px-3 pb-6 md:block">
            <p className="px-3 pb-2 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">
              Workspaces
            </p>
            <div className="space-y-1">
              <WorkspaceButton
                label="Todas as empresas"
                active={companyId === "all"}
                onClick={() => setCompanyId("all")}
              />
              {db.companies.map((c) => (
                <WorkspaceButton
                  key={c.id}
                  label={c.name}
                  color={c.accent}
                  active={companyId === c.id}
                  onClick={() => setCompanyId(c.id)}
                />
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="border-b border-border bg-card/60 px-4 py-3 md:hidden">
            <div className="flex gap-2 overflow-x-auto">
              <Chip label="Todas" active={companyId === "all"} onClick={() => setCompanyId("all")} />
              {db.companies.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  active={companyId === c.id}
                  onClick={() => setCompanyId(c.id)}
                />
              ))}
            </div>
          </div>
          <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function WorkspaceButton({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
      )}
    >
      <Circle
        className="size-2.5"
        style={color ? { color, fill: color } : { color: "currentColor", fill: "currentColor" }}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string | undefined; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
