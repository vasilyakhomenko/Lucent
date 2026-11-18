import type { ApiMessage, Settings, ToolCall, Usage, WebSource } from "@/lib/types";

export type RunResult = {
  content: string;
  reasoning: string;
  finish?: string;
  usage?: Usage;
  toolCalls: ToolCall[];
};

type DeltaHandler = (content: string, reasoning: string) => void;

export const WEB_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the public web. Use for news, current facts, versions, prices, weather and documentation. Returns titles, URLs and snippets.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", description: "Search query in the user's language" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_page",
      description:
        "Read the readable text of one public http(s) page. Use when a search snippet is not enough. Never use local, private or non-http URLs.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string", description: "Absolute http or https URL" },
        },
        required: ["url"],
      },
    },
  },
];

export function buildPayload(opts: {
  model: string;
  messages: ApiMessage[];
  settings: Settings;
  stream: boolean;
  maxTokens?: number;
  tools?: boolean;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: opts.stream,
  };
  if (opts.tools) {
    payload.tools = WEB_TOOLS;
    payload.tool_choice = "auto";
  }
  if (opts.settings.minimal) return payload;
  payload.temperature = opts.settings.temperature;
  payload.top_p = opts.settings.topP;
  if (opts.settings.presencePenalty !== 0) payload.presence_penalty = opts.settings.presencePenalty;
  if (opts.settings.frequencyPenalty !== 0) payload.frequency_penalty = opts.settings.frequencyPenalty;
  const max = opts.maxTokens ?? opts.settings.maxTokens;
  if (max > 0) payload.max_tokens = max;
  return payload;
}

export function parseModelIds(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const record = json as { data?: unknown; models?: unknown };
  const data = record.data ?? record.models;
  if (!Array.isArray(data)) return [];
  const ids: string[] = [];
  for (const item of data) {
    if (typeof item === "string") ids.push(item);
    else if (item && typeof item === "object") {
      const rec = item as { id?: unknown; name?: unknown };
      const id = typeof rec.id === "string" ? rec.id : typeof rec.name === "string" ? rec.name : "";
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

export function extractError(text: string, status: number): string {
  try {
    const json = JSON.parse(text) as { error?: { message?: unknown } | string; message?: unknown };
    const nested = json.error;
    if (typeof nested === "string" && nested) return nested;
    if (nested && typeof nested === "object" && typeof nested.message === "string" && nested.message) {
      return nested.message;
    }
    if (typeof json.message === "string" && json.message) return json.message;
  } catch {
    /* plain text */
  }
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean) return clean.slice(0, 420);
  return `Ошибка ${status}`;
}

function usageOf(json: unknown): Usage | undefined {
  if (!json || typeof json !== "object") return undefined;
  const usage = (json as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage;
  if (!usage) return undefined;
  const prompt = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
  const completion = typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined;
  if (prompt == null && completion == null) return undefined;
  return { prompt, completion };
}

function deltaOf(json: unknown): { content: string; reasoning: string; finish?: string } | null {
  if (!json || typeof json !== "object") return null;
  const choice = (json as { choices?: Array<Record<string, unknown>> }).choices?.[0];
  if (!choice) return null;
  const delta = (choice.delta || choice.message) as
    | { content?: unknown; reasoning_content?: unknown; reasoning?: unknown }
    | undefined;
  const content = typeof delta?.content === "string" ? delta.content : "";
  const reasoningRaw = delta?.reasoning_content ?? delta?.reasoning;
  const reasoning = typeof reasoningRaw === "string" ? reasoningRaw : "";
  const finish = typeof choice.finish_reason === "string" ? choice.finish_reason : undefined;
  return { content, reasoning, finish };
}

function absorbTools(json: unknown, acc: ToolCall[]) {
  if (!json || typeof json !== "object") return;
  const choice = (json as { choices?: Array<Record<string, unknown>> }).choices?.[0];
  const carrier = (choice?.delta || choice?.message) as Record<string, unknown> | undefined;
  const raw = carrier?.tool_calls;
  if (!Array.isArray(raw)) return;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const index = typeof rec.index === "number" ? rec.index : acc.length;
    while (acc.length <= index) acc.push({ id: "", name: "", arguments: "" });
    const slot = acc[index];
    if (!slot) continue;
    if (typeof rec.id === "string" && rec.id) slot.id = rec.id;
    const fn = rec.function;
    if (!fn || typeof fn !== "object") continue;
    const func = fn as Record<string, unknown>;
    if (typeof func.name === "string" && func.name) {
      if (!slot.name || func.name.startsWith(slot.name)) slot.name = func.name;
      else if (!slot.name.endsWith(func.name)) slot.name += func.name;
    }
    if (typeof func.arguments === "string") slot.arguments += func.arguments;
    else if (func.arguments && typeof func.arguments === "object") slot.arguments += JSON.stringify(func.arguments);
  }
}

function finishTools(acc: ToolCall[]): ToolCall[] {
  return acc
    .map((call, index) => ({
      id: call.id || `call_${index}`,
      name: call.name.trim(),
      arguments: call.arguments.trim() || "{}",
    }))
    .filter((call) => call.name)
    .slice(0, 3);
}

export async function runWebTool(
  action: "search" | "read",
  input: { query?: string; url?: string },
  signal?: AbortSignal,
): Promise<{ text: string; sources: WebSource[] }> {
  const res = await fetch("/api/v1/web", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...input }),
    signal,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(text, res.status));
  try {
    const json = JSON.parse(text) as { text?: unknown; sources?: unknown };
    const sources: WebSource[] = [];
    if (Array.isArray(json.sources)) {
      for (const item of json.sources) {
        if (!item || typeof item !== "object") continue;
        const rec = item as { title?: unknown; url?: unknown; snippet?: unknown };
        if (typeof rec.url !== "string") continue;
        const source: WebSource = { title: typeof rec.title === "string" ? rec.title : rec.url, url: rec.url };
        if (typeof rec.snippet === "string") source.snippet = rec.snippet;
        sources.push(source);
      }
    }
    return { text: typeof json.text === "string" ? json.text : "", sources };
  } catch {
    throw new Error("Интернет вернул не JSON");
  }
}

export async function runChat(opts: {
  baseUrl: string;
  apiKey: string;
  payload: Record<string, unknown>;
  stream: boolean;
  signal?: AbortSignal;
  onDelta?: DeltaHandler;
}): Promise<RunResult> {
  const res = await fetch("/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      stream: opts.stream,
      payload: opts.payload,
    }),
    signal: opts.signal,
  });

  const type = res.headers.get("content-type") || "";
  if (!res.ok) {
    throw new Error(extractError(await res.text(), res.status));
  }

  if (!opts.stream || type.includes("application/json") || !res.body) {
    const json: unknown = await res.json();
    const delta = deltaOf(json);
    const content = delta?.content ?? "";
    const reasoning = delta?.reasoning ?? "";
    const toolCallsAcc: ToolCall[] = [];
    absorbTools(json, toolCallsAcc);
    opts.onDelta?.(content, reasoning);
    return { content, reasoning, finish: delta?.finish, usage: usageOf(json), toolCalls: finishTools(toolCallsAcc) };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let finish: string | undefined;
  let usage: Usage | undefined;
  const toolCallsAcc: ToolCall[] = [];

  const consume = (data: string) => {
    if (!data || data === "[DONE]") return data === "[DONE]";
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      return false;
    }
    const delta = deltaOf(json);
    if (delta) {
      if (delta.content || delta.reasoning) {
        content += delta.content;
        reasoning += delta.reasoning;
        opts.onDelta?.(delta.content, delta.reasoning);
      }
      if (delta.finish) finish = delta.finish;
    }
    absorbTools(json, toolCallsAcc);
    const nextUsage = usageOf(json);
    if (nextUsage) usage = nextUsage;
    return false;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      if (consume(trimmed.slice(5).trim())) {
        return { content, reasoning, finish, usage, toolCalls: finishTools(toolCallsAcc) };
      }
    }
  }
  const tail = buffer.trim();
  if (tail.startsWith("data:")) consume(tail.slice(5).trim());
  else if (tail.startsWith("{") && !content) {
    try {
      const json = JSON.parse(tail) as unknown;
      const delta = deltaOf(json);
      content = delta?.content ?? "";
      reasoning = delta?.reasoning ?? "";
      finish = delta?.finish;
      usage = usageOf(json);
      absorbTools(json, toolCallsAcc);
      if (content || reasoning) opts.onDelta?.(content, reasoning);
    } catch {
      /* ignore trailing junk */
    }
  }
  return { content, reasoning, finish, usage, toolCalls: finishTools(toolCallsAcc) };
}

export async function fetchModels(baseUrl: string, apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch("/api/v1/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, apiKey }),
    signal,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(extractError(text, res.status));
  try {
    return parseModelIds(JSON.parse(text));
  } catch {
    throw new Error("Сервер не вернул список моделей");
  }
}
