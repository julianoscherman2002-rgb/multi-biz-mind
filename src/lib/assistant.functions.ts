import { createServerFn } from "@tanstack/react-start";

export type ChatMsg = { role: "user" | "assistant"; content: string };

type Input = { messages: ChatMsg[]; context?: string; system?: string };

/**
 * Assistente de IA (Lovable AI Gateway, Responses API).
 * Sempre em streaming no servidor; devolve o texto final para o cliente.
 */
export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => {
    if (!Array.isArray(data?.messages) || data.messages.length === 0) {
      throw new Error("Nenhuma mensagem enviada.");
    }
    return {
      messages: data.messages.slice(-20),
      context: data.context ?? "",
      system: data.system ?? "",
    };
  })
  .handler(async ({ data }): Promise<{ text: string; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { text: "", error: "IA não configurada neste projeto." };

    const instructions = [
      "Você é o assistente do Órbita, um sistema de gestão de três empresas de um mesmo sócio:",
      "um escritório de advocacia, uma empresa de registro de marcas e um varejo no Mercado Livre.",
      "Responda sempre em português do Brasil, de forma direta e prática.",
      "Ajude a priorizar tarefas, organizar finanças, sugerir próximos passos e planejar a semana.",
      "Use os dados do sistema fornecidos abaixo quando forem relevantes; nunca invente números.",
      "Seja conciso: bullets curtos, no máximo ~200 palavras, salvo pedido explícito de detalhe.",
      data.system,
      data.context ? `\n\nDADOS ATUAIS DO SISTEMA:\n${data.context}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.6-sol",
          instructions,
          input: data.messages.map((m) => ({
            role: m.role,
            content: [
              {
                type: m.role === "assistant" ? "output_text" : "input_text",
                text: m.content,
              },
            ],
          })),
          stream: true,
          store: false,
          reasoning: { effort: "low", summary: "auto" },
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        console.error(`AI gateway ${res.status}: ${body.slice(0, 500)}`);
        if (res.status === 429) return { text: "", error: "Limite de uso da IA atingido. Tente em instantes." };
        if (res.status === 402) return { text: "", error: "Créditos de IA esgotados." };
        return { text: "", error: "A IA não respondeu agora. Tente novamente." };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let reasoning = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") text += ev.delta;
            else if (ev.type === "response.reasoning_summary_text.delta" && typeof ev.delta === "string")
              reasoning += ev.delta;
          } catch {
            /* ignore keepalive / partial */
          }
        }
      }

      if (!text.trim()) return { text: reasoning.trim() || "Não consegui formular uma resposta agora." };
      return { text: text.trim() };
    } catch (err) {
      console.error("assistant error", err);
      return { text: "", error: "Falha ao falar com a IA." };
    }
  });
