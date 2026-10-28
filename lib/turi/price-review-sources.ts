import { isIP } from "node:net";
import { z } from "zod";
import { seal, unseal } from "./security";
import { priceReviewInputSchema } from "./price-reviews";

const TTL = 15 * 60 * 1000;
const MAX_EVIDENCE = 1600;
export const priceReviewToolInputSchema = priceReviewInputSchema.extend({
  sourceProof: z.string().min(1).max(12000),
});
const proofSchema = z.object({
  purpose: z.literal("turi.price-search-evidence.v1"),
  sessionId: z.string().min(1).max(200),
  sourceUrl: z.string().max(2000),
  sourceTitle: z.string().max(200),
  evidence: z.string().min(1).max(MAX_EVIDENCE),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
}).strict();
export type SearchSourceProof = {
  sourceUrl: string;
  sourceTitle: string;
  evidence: string;
  sourceProof: string;
  expiresAt: string;
};
const whitespace = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

/** Pure URL identity check, never a fetch or DNS request. Meaningful query
 * parameters stay bound; fragments and analytics parameters do not change a page.
 */
function sourceIdentity(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !url.hostname.includes(".") || isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
      /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname) ||
      /google\.[^/]+\/maps|maps\.google|bing\.com\/search|google\.[^/]+\/search/i.test(url.href)) return;
    url.hash = "";
    for (const name of [...url.searchParams.keys()]) if (/^utm_/i.test(name)) url.searchParams.delete(name);
    url.searchParams.sort();
    return url.href;
  } catch { return; }
}

const citationSchema = z.object({
  type: z.literal("url_citation"), url: z.string(), title: z.string(),
  start_index: z.number().int().nonnegative(), end_index: z.number().int().positive(),
});
const outputTextSchema = z.object({ type: z.literal("output_text"), text: z.string().max(80000), annotations: z.array(z.unknown()).max(200) });
const messageSchema = z.object({ type: z.literal("message"), content: z.array(z.unknown()).max(20) });
const searchSchema = z.object({
  type: z.literal("web_search_call"), status: z.literal("completed"),
  action: z.object({ type: z.literal("search").optional(), sources: z.array(z.object({ type: z.literal("url"), url: z.string() })).max(200) }),
});

const openPageSchema = z.object({
  type: z.literal("web_search_call"), status: z.literal("completed"),
  action: z.object({ type: z.literal("open_page"), url: z.string().max(2000) }),
});

/** Mint only from provider output received by search_travel, not from tool args.
 * A paragraph must cite one URL returned in search sources or explicitly opened.
 * Open-page actions require the exact HTTPS URL in the citation, never a ref ID.
 * URL lists, uncited text and paragraphs mixing sources cannot authorize a card.
 */
export function createSearchSourceProofs(sessionId: string, output: readonly unknown[], now = Date.now()): SearchSourceProof[] {
  const consulted = new Set<string>();
  const opened = new Set<string>();
  for (const item of output.slice(0, 80)) {
    const search = searchSchema.safeParse(item);
    if (search.success) for (const source of search.data.action.sources) {
      const identity = sourceIdentity(source.url);
      if (identity) consulted.add(identity);
    }
    const page = openPageSchema.safeParse(item);
    if (page.success && sourceIdentity(page.data.action.url)) opened.add(page.data.action.url);
  }
  if (!consulted.size && !opened.size) return [];
  const proofs: SearchSourceProof[] = [];
  const seen = new Set<string>();
  for (const item of output.slice(0, 80)) {
    const message = messageSchema.safeParse(item);
    if (!message.success) continue;
    for (const value of message.data.content) {
      const content = outputTextSchema.safeParse(value);
      if (!content.success) continue;
      const { text, annotations } = content.data;
      const citations: (z.infer<typeof citationSchema> & { identity: string })[] = [];
      let malformed = false;
      for (const annotation of annotations) {
        if (!annotation || typeof annotation !== "object" || !("type" in annotation) || annotation.type !== "url_citation") continue;
        const citation = citationSchema.safeParse(annotation);
        const identity = citation.success ? sourceIdentity(citation.data.url) : undefined;
        if (!citation.success || !identity || citation.data.start_index >= citation.data.end_index || citation.data.end_index > text.length) { malformed = true; break; }
        citations.push({ ...citation.data, identity });
      }
      if (malformed) continue;
      for (const citation of citations) {
        if (!consulted.has(citation.identity) && !opened.has(citation.url)) continue;
        const paragraphStart = text.lastIndexOf("\n\n", citation.start_index);
        const start = paragraphStart < 0 ? 0 : paragraphStart + 2;
        const paragraphEnd = text.indexOf("\n\n", citation.end_index);
        const end = paragraphEnd < 0 ? text.length : paragraphEnd;
        const related = citations.filter(source => source.start_index < end && source.end_index > start);
        if (new Set(related.map(source => source.identity)).size !== 1 || related.some(source => source.start_index < start || source.end_index > end)) continue;
        let evidence = text.slice(start, end);
        for (const source of [...related].sort((a, b) => b.start_index - a.start_index))
          evidence = evidence.slice(0, source.start_index - start) + evidence.slice(source.end_index - start);
        evidence = whitespace(evidence);
        if (!evidence || evidence.length > MAX_EVIDENCE) continue;
        const fingerprint = `${citation.identity}\n${evidence}`;
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        const sourceTitle = citation.title.slice(0, 200);
        const expiresAt = now + TTL;
        proofs.push({ sourceUrl: citation.identity, sourceTitle, evidence, expiresAt: new Date(expiresAt).toISOString(),
          sourceProof: seal({ purpose: "turi.price-search-evidence.v1", sessionId, sourceUrl: citation.identity, sourceTitle, evidence, issuedAt: now, expiresAt }) });
        if (proofs.length >= 8) return proofs;
      }
    }
  }
  return proofs;
}

const currencyMarkers: Record<string, string> = {
  BRL: "(?:BRL|R\\s*\\$)", USD: "(?:USD|US\\s*\\$|U\\s*\\$D)",
  ARS: "(?:ARS|AR\\s*\\$)", EUR: "(?:EUR|€)", UYU: "UYU", CLP: "CLP", MXN: "MXN",
};
const numberPattern = "\\d+(?:[.,]\\d+)*";
function monetaryNumber(value: string): number | undefined {
  if (!/^\d+(?:[.,]\d+)*$/.test(value)) return;
  const separators = [...value.matchAll(/[.,]/g)];
  if (!separators.length) return Number(value);
  const last = separators[separators.length - 1].index!;
  const digitsAfter = value.length - last - 1;
  if (digitsAfter === 3) return Number(value.replace(/[.,]/g, ""));
  if (digitsAfter < 1 || digitsAfter > 2) return;
  return Number(value.slice(0, last).replace(/[.,]/g, "") + "." + value.slice(last + 1));
}

/** Money must be attached to the requested currency. Calendar years, ages,
 * quantities and opening hours elsewhere in a paragraph are not prices.
 */
export function supportedMonetaryAmounts(evidence: string, currency: string): number[] {
  const marker = currencyMarkers[currency];
  if (!marker) return [];
  const found: number[] = [];
  const prefix = new RegExp(`(?:^|[^A-Za-z])${marker}\\s*(${numberPattern})(?:\\s*(?:a|até|hasta|[-–—])\\s*(?:${marker}\\s*)?(${numberPattern}))?`, "gi");
  const suffix = new RegExp(`(?:^|[^\\d.,])(${numberPattern})(?:\\s*(?:a|até|hasta|[-–—])\\s*(${numberPattern}))?\\s*${marker}(?=$|[^A-Za-z])`, "gi");
  for (const pattern of [prefix, suffix]) for (const match of evidence.matchAll(pattern))
    for (const value of match.slice(1)) {
      const amount = value ? monetaryNumber(value) : undefined;
      if (amount !== undefined && Number.isFinite(amount)) found.push(amount);
    }
  return found;
}

export function backedPriceReviewInput(sessionId: string, input: unknown, now = Date.now()): z.infer<typeof priceReviewInputSchema> {
  const parsed = priceReviewToolInputSchema.safeParse(input);
  if (!parsed.success) throw new Error("Falta evidencia de búsqueda verificable o hay campos inválidos. Buscá con search_travel y usá su sourceProof y un fragmento literal; si falta información, preguntá.");
  let proof: z.infer<typeof proofSchema>;
  try { proof = proofSchema.parse(unseal(parsed.data.sourceProof)); }
  catch { throw new Error("La evidencia de búsqueda no es válida. Volvé a buscar con search_travel; no inventes una referencia."); }
  if (proof.sessionId !== sessionId || sourceIdentity(parsed.data.sourceUrl) !== proof.sourceUrl ||
    proof.expiresAt <= now || proof.issuedAt > now || proof.expiresAt - proof.issuedAt !== TTL)
    throw new Error("La evidencia venció o no corresponde a esta sesión y fuente. Volvé a buscar con search_travel.");
  const evidence = whitespace(parsed.data.evidence);
  if (!whitespace(proof.evidence).toLocaleLowerCase("es").includes(evidence.toLocaleLowerCase("es")))
    throw new Error("La evidencia no coincide con el texto recibido de la búsqueda. Copiá un fragmento literal de esa fuente o buscá de nuevo.");
  const amounts = supportedMonetaryAmounts(evidence, parsed.data.currency);
  if (![parsed.data.referenceMin, parsed.data.referenceMax].every(amount => amounts.some(value => Math.abs(amount - value) < 0.001)))
    throw new Error("Los dos importes y su moneda deben estar respaldados juntos en la evidencia de búsqueda firmada. Buscá precios publicados o preguntá por el dato faltante; no uses horarios, edades ni rangos inventados.");
  // Strip the transport-only proof. It must never become a persisted widget.
  return priceReviewInputSchema.parse({ ...parsed.data, evidence, sourceUrl: proof.sourceUrl, sourceTitle: proof.sourceTitle });
}
