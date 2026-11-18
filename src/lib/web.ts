import { isBlockedHostname } from "@/lib/endpoint";
import type { WebSource } from "@/lib/types";

const UA = "Lucent/1.0 (research; +https://lucent.app)";
const PAGE_CAP = 700_000;
const TEXT_CAP = 7_000;
const SEARCH_CAP = 6;

type Research = { text: string; sources: WebSource[] };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")].filter(
    (h): h is string => !!h,
  );
  if (hosts.length === 0) return true;
  return hosts.some((h) => h === originHost);
}

function decodeXml(value: string): string {
  let current = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let pass = 0; pass < 3; pass += 1) {
    const next = current
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
      .replace(/"/g, '"')
      .replace(/'|&#39;/g, "'")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&/g, "&");
    if (next === current) break;
    current = next;
  }
  return current;
}

export function htmlToText(html: string): string {
  return decodeXml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return match?.[1] ? decodeXml(match[1]).trim() : "";
}

export function parseRss(xml: string): WebSource[] {
  const sources: WebSource[] = [];
  for (const block of xml.split(/<item\b/i).slice(1)) {
    const title = htmlToText(tag(block, "title")).slice(0, 180);
    const url = tag(block, "link").replace(/\s+/g, "");
    const snippet = htmlToText(tag(block, "description")).slice(0, 320);
    if (!title || !/^https?:\/\//i.test(url)) continue;
    sources.push({ title, url, snippet });
    if (sources.length >= SEARCH_CAP) break;
  }
  return sources;
}

function isIp(hostname: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
}

function isPrivateAddress(address: string): boolean {
  let ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip.includes(":")) {
    return ip === "::" || ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd");
  }
  return isBlockedHostname(ip);
}

export function unsafeHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    return true;
  }
  return isIp(host) && isPrivateAddress(host);
}

async function assertPublic(url: URL): Promise<void> {
  if (url.username || url.password) throw new Error("Ссылка с паролем запрещена");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Только http и https");
  if (unsafeHostname(url.hostname)) throw new Error("Локальные и служебные адреса закрыты");
  const { lookup } = await import("node:dns/promises");
  let records: { address: string }[] = [];
  try {
    records = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Адрес не найден");
  }
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Этот адрес недоступен");
  }
}

async function fetchPublic(start: URL, signal: AbortSignal): Promise<{ url: URL; response: Response }> {
  let current = start;
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublic(current);
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.8,*/*;q=0.2",
        "Accept-Language": "ru,en;q=0.8",
        "User-Agent": UA,
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) throw new Error("Редирект без адреса");
      current = new URL(location, current);
      continue;
    }
    return { url: current, response };
  }
  throw new Error("Слишком много редиректов");
}

async function readBody(response: Response): Promise<string> {
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (type && !/text\/|json|xml|javascript|svg/.test(type)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Страница не текстовая");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < PAGE_CAP) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(Math.min(total, PAGE_CAP));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, bytes.length - offset);
    if (take <= 0) break;
    bytes.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  const charset = /charset=([^;\s]+)/i.exec(type)?.[1]?.replace(/["']/g, "") || "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function wikiSources(json: unknown): WebSource[] {
  if (!json || typeof json !== "object") return [];
  const pages = (json as { query?: { pages?: Record<string, Record<string, unknown>> } }).query?.pages;
  if (!pages) return [];
  return Object.values(pages)
    .map((page) => ({
      index: typeof page.index === "number" ? page.index : 99,
      title: typeof page.title === "string" ? page.title : "",
      url: typeof page.fullurl === "string" ? page.fullurl : "",
      snippet: typeof page.extract === "string" ? page.extract.replace(/\s+/g, " ").trim().slice(0, 320) : "",
    }))
    .filter((page) => page.title && /^https?:\/\//i.test(page.url))
    .sort((a, b) => a.index - b.index)
    .slice(0, 3)
    .map(({ title, url, snippet }) => ({ title, url, snippet }));
}

async function wiki(query: string, lang: "ru" | "en", signal: AbortSignal): Promise<WebSource[]> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "3");
  url.searchParams.set("prop", "extracts|info");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exchars", "320");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { signal, headers: { Accept: "application/json", "User-Agent": UA } });
  if (!response.ok) return [];
  return wikiSources(await response.json());
}

async function bing(query: string, signal: AbortSignal): Promise<WebSource[]> {
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "rss");
  url.searchParams.set("count", "6");
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": UA },
  });
  if (!response.ok) return [];
  return parseRss(await response.text());
}

function dedupe(sources: WebSource[]): WebSource[] {
  const seen = new Set<string>();
  const out: WebSource[] = [];
  for (const source of sources) {
    let key = source.url;
    try {
      const url = new URL(source.url);
      if (unsafeHostname(url.hostname)) continue;
      key = `${url.hostname}${url.pathname}`.replace(/\/$/, "");
    } catch {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
    if (out.length >= SEARCH_CAP) break;
  }
  return out;
}

function formatSources(query: string, sources: WebSource[]): string {
  if (!sources.length) return `По запросу «${query}» ничего не нашлось.`;
  const lines = sources.map((source, index) => {
    const snippet = source.snippet ? `\n${source.snippet}` : "";
    return `[${index + 1}] ${source.title}\n${source.url}${snippet}`;
  });
  return `Результаты поиска «${query}»:\n\n${lines.join("\n\n")}`;
}

async function search(query: string, signal: AbortSignal): Promise<Research> {
  const clean = query.replace(/\s+/g, " ").trim().slice(0, 240);
  if (clean.length < 2) return { text: "Слишком короткий запрос.", sources: [] };
  const langs: Array<"ru" | "en"> = /[а-яё]/i.test(clean) ? ["ru", "en"] : ["en", "ru"];
  const jobs = await Promise.all([
    bing(clean, signal).catch(() => [] as WebSource[]),
    ...langs.map((lang) => wiki(clean, lang, signal).catch(() => [] as WebSource[])),
  ]);
  const sources = dedupe(jobs.flat());
  return { text: formatSources(clean, sources), sources };
}

async function readPage(raw: string, signal: AbortSignal): Promise<Research> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { text: "Некорректный URL.", sources: [] };
  }
  try {
    const { url: finalUrl, response } = await fetchPublic(url, signal);
    const body = await readBody(response);
    const title = htmlToText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] || finalUrl.hostname).slice(0, 180);
    const text = htmlToText(body).slice(0, TEXT_CAP);
    if (!response.ok && !text) return { text: `Страница ответила ${response.status}.`, sources: [] };
    const source: WebSource = { title: title || finalUrl.hostname, url: finalUrl.toString(), snippet: text.slice(0, 220) };
    const prefix = response.ok ? "" : `HTTP ${response.status}\n`;
    return {
      text: `${prefix}${source.title}\n${source.url}\n\n${text || "На странице нет текста."}`,
      sources: [source],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось открыть страницу";
    return { text: message, sources: [] };
  }
}

export async function handleWeb(request: Request): Promise<Response> {
  if (!originAllowed(request)) return json({ error: { message: "Запрос отклонён" } }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: "Ожидался JSON" } }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: { message: "Ожидался объект" } }, 400);
  const record = body as { action?: unknown; query?: unknown; url?: unknown };
  const timeout = AbortSignal.timeout(18_000);
  const signals = [timeout];
  if (request.signal) signals.push(request.signal);
  const signal = AbortSignal.any(signals);
  try {
    if (record.action === "search") {
      if (typeof record.query !== "string") return json({ error: { message: "Нужен query" } }, 400);
      return json(await search(record.query, signal));
    }
    if (record.action === "read") {
      if (typeof record.url !== "string" || record.url.length > 2000) return json({ error: { message: "Нужен url" } }, 400);
      return json(await readPage(record.url, signal));
    }
    return json({ error: { message: "Неизвестное действие" } }, 400);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") return json({ error: { message: "Интернет не ответил вовремя" } }, 504);
    return json({ error: { message: "Не удалось выйти в интернет" } }, 502);
  }
}
