/* Extratos reais importados (Banco Inter) + utilitários de parsing. */

export type RawTx = {
  date: string; // yyyy-mm-dd
  description: string;
  category: string;
  amount: number; // positivo = entrada, negativo = saída
};

/** Saídas de Amazon são estornos/repasses e devem entrar como receita. */
export function isAmazonCredit(description: string) {
  return /amazon|amzn/i.test(description);
}

/** Aplica a regra de conversão e devolve tipo + valor absoluto. */
export function resolveDirection(description: string, amount: number) {
  const type: "in" | "out" = amount >= 0 || isAmazonCredit(description) ? "in" : "out";
  return { type, amount: Math.abs(amount) };
}

function categorize(desc: string): string {
  const d = desc.toLowerCase();
  if (isAmazonCredit(d)) return "Vendas Amazon";
  if (d.includes("aplicacao") || d.includes("cdb")) return "Aplicação";
  if (d.includes("pix recebido")) return "Pix recebido";
  if (d.includes("pix enviado")) return "Pix enviado";
  if (d.includes("debito") || d.includes("compra")) return "Compras / débito";
  return "Outros";
}

export function toRaw(date: string, description: string, amount: number): RawTx {
  return { date, description, category: categorize(description), amount };
}

/* ---------- Conta Inter 516447238 (10/07/2026 a 10/08/2026) ---------- */
export const INTER_CHECKING_INITIAL = 61786.38; // saldo em 10/07 para fechar 12.048,65 em 10/08

export const INTER_CHECKING_TX: RawTx[] = [
  toRaw("2026-08-04", "Pix recebido — Gianmarco Luiz Pereira Tizzot Sociedade", 6000),
  toRaw("2026-08-04", "Pix recebido — MBM Comercio Digital Ltda", 1800),
  toRaw("2026-08-01", "Compra no débito — Açougue Rio Grande", -520.36),
  toRaw("2026-08-01", "Compra no débito — Açougue Rio Grande", -219.9),
  toRaw("2026-07-23", "Pix enviado — Denise Cerutte de Almeida", -1000),
  toRaw("2026-07-20", "Compra no débito — Requinte Sabores", -115.75),
  toRaw("2026-07-18", "Compra no débito — Posto Florida", -69.97),
  toRaw("2026-07-17", "Compra no débito — Capim Leão Bar e Brasa", -182.16),
  toRaw("2026-07-17", "Compra no débito — Jardim Ambiental", -40),
  toRaw("2026-07-16", "Compra no débito — MiaTrattoria", -267.19),
  toRaw("2026-07-15", "Compra no débito — Festval Cabral", -82.5),
  toRaw("2026-07-15", "Compra no débito — Kopenhagen Cabral", -39.9),
  toRaw("2026-07-12", "Aplicação — CDB DI LIQ Banco Inter", -55000),
];

/* ---------- Conta Inter 549605118 (13/05/2026 a 10/08/2026) ---------- */
export const INTER_PJ_INITIAL = 0; // saldo inicial do período; fecha em 937,77

export const INTER_PJ_TX: RawTx[] = [
  toRaw("2026-08-05", "Pix recebido interno", 7235.06),
  toRaw("2026-08-06", "Pix recebido", 600),
  toRaw("2026-08-06", "Pix recebido interno", 700),
  toRaw("2026-08-06", "Pix recebido", 0.01),
  toRaw("2026-08-07", "Pix recebido", 600),
  toRaw("2026-08-08", "Pix enviado", -2399.1),
  toRaw("2026-08-08", "Pix enviado", -2399.1),
  toRaw("2026-08-08", "Pix enviado", -2399.1),
  toRaw("2026-08-08", "Pix enviado", -1000),
];

/* ---------- Parsers de arquivo ---------- */

function ofxDate(v: string) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

export function parseOfx(text: string): RawTx[] {
  const out: RawTx[] = [];
  for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
    const block = m[1] ?? "";
    const field = (k: string) =>
      (block.match(new RegExp(`<${k}>([^<\\r\\n]*)`, "i"))?.[1] ?? "").trim();
    const date = ofxDate(field("DTPOSTED"));
    const amount = Number(field("TRNAMT"));
    const desc =
      field("MEMO").replace(/"/g, "") || field("NAME") || field("TRNTYPE") || "Lançamento";
    if (!date || !Number.isFinite(amount) || amount === 0) continue;
    out.push(toRaw(date, desc, amount));
  }
  return out;
}
