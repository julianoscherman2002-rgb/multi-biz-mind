import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { contextForAI } from "@/lib/briefing";
import { askAssistant, type ChatMsg } from "@/lib/assistant.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistente")({
  head: () => ({
    meta: [
      { title: "Assistente de IA — Órbita" },
      {
        name: "description",
        content: "Converse com um assistente de IA que conhece suas empresas, tarefas e finanças.",
      },
      { property: "og:title", content: "Assistente de IA — Órbita" },
      { property: "og:description", content: "Seu auxiliar para priorizar tarefas e organizar as empresas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <Assistente />
    </AppShell>
  ),
});

const KEY = "orbita.chat.v1";

const sugestoes = [
  "Monte meu plano de hoje priorizando o que está atrasado",
  "Como está o resultado de cada empresa neste mês?",
  "Quais tarefas eu deveria delegar ou adiar?",
  "Me ajude a organizar a semana das 3 empresas",
];

function Assistente() {
  const { db } = useStore();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setMessages(JSON.parse(raw) as ChatMsg[]);
    } catch {
      /* ignore */
    }
    taRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function enviar(texto?: string) {
    const content = (texto ?? input).trim();
    if (!content || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    taRef.current?.focus();

    const res = await askAssistant({ data: { messages: next, context: contextForAI(db) } }).catch(() => ({
      text: "",
      error: "Falha de conexão com a IA.",
    }));
    setLoading(false);
    taRef.current?.focus();

    if (res.error || !res.text) {
      toast.error(res.error ?? "A IA não respondeu.");
      return;
    }
    setMessages((m) => [...m, { role: "assistant", content: res.text }]);
  }

  return (
    <>
      <PageHeader
        title="Assistente"
        subtitle="Seu auxiliar com IA — ele enxerga suas tarefas, contas e lançamentos"
        action={
          messages.length > 0 ? (
            <Button variant="outline" onClick={() => setMessages([])}>
              <Trash2 className="size-4" /> Nova conversa
            </Button>
          ) : undefined
        }
      />

      <section className="surface flex h-[calc(100vh-16rem)] min-h-[26rem] flex-col p-4">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Sparkles className="size-8 text-muted-foreground" />
              <p className="max-w-md text-sm text-muted-foreground">
                Pergunte qualquer coisa sobre as três empresas. Ele já conhece seus números do mês e suas
                pendências.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {sugestoes.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> pensando...
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="mt-4 flex items-end gap-2 border-t border-border pt-4">
          <Textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            placeholder="Pergunte ao seu auxiliar... (Enter envia)"
            className="max-h-40 min-h-11 resize-none"
          />
          <Button onClick={() => void enviar()} disabled={loading || !input.trim()} size="icon" className="size-11">
            <Send className="size-4" />
          </Button>
        </div>
      </section>
    </>
  );
}
