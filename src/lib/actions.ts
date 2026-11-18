import { toast } from "sonner";
import { buildPayload, fetchModels, runChat, runWebTool } from "@/lib/api";
import { isBlockedEndpoint, normalizeRoot } from "@/lib/endpoint";
import { currentChat, resolveProfile, uid, useLucent, type Persisted } from "@/lib/store";
import type { ApiMessage, ApiToolCall, Attachment, Chat, ChatMessage, Persona, Profile, ToolCall, Usage, WebSource } from "@/lib/types";
import { DEFAULT_TITLE } from "@/lib/types";

let abort: AbortController | null = null;

const WEB_NOTE =
  "Доступны функции web_search и open_page. web_search ищет в открытом интернете и возвращает заголовки, ссылки и фрагменты. open_page читает текст публичной http(s)-страницы. Вызывай их, когда нужны свежие факты, новости, версии или документация. Не выдумывай ссылки и цифры. В конце ответа перечисли использованные источники.";

export function stopStream() {
  abort?.abort();
}

function systemText(chat: Chat, personas: Persona[], memory: string, web: boolean): string {
  const parts: string[] = [];
  const persona = personas.find((p) => p.id === chat.personaId);
  if (persona?.prompt.trim()) parts.push(persona.prompt.trim());
  if (chat.systemPrompt.trim()) parts.push(chat.systemPrompt.trim());
  if (memory.trim()) parts.push(`Память о пользователе:\n${memory.trim()}`);
  if (web) parts.push(WEB_NOTE);
  return parts.join("\n\n");
}

function toApiMessage(message: ChatMessage): ApiMessage {
  let text = message.content;
  if (message.role === "assistant" && message.sources?.length) {
    const lines = message.sources.map((source) => `- ${source.title || source.url} — ${source.url}`).join("\n");
    text = `${text}\n\nИсточники:\n${lines}`.trim();
  }
  if (message.role === "user" && message.images?.length) {
    const parts: ApiMessage["content"] = [];
    if (text.trim()) parts.push({ type: "text", text });
    for (const image of message.images) {
      parts.push({ type: "image_url", image_url: { url: image.dataUrl } });
    }
    return { role: "user", content: parts };
  }
  return { role: message.role, content: text };
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function toolsRejected(message: string): boolean {
  return /tool|function/i.test(message);
}

function addUsage(left?: Usage, right?: Usage): Usage | undefined {
  if (!left) return right;
  if (!right) return left;
  return {
    prompt: (left.prompt ?? 0) + (right.prompt ?? 0) || undefined,
    completion: (left.completion ?? 0) + (right.completion ?? 0) || undefined,
  };
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const json = JSON.parse(raw) as unknown;
    if (json && typeof json === "object" && !Array.isArray(json)) return json as Record<string, unknown>;
  } catch {
    /* model sent broken JSON */
  }
  return {};
}

function argText(args: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function mergeSources(current: WebSource[] | undefined, next: WebSource[]): WebSource[] {
  const seen = new Set<string>();
  const out: WebSource[] = [];
  for (const source of [...(current ?? []), ...next]) {
    if (!source.url || seen.has(source.url)) continue;
    seen.add(source.url);
    out.push(source);
    if (out.length >= 8) break;
  }
  return out;
}

function asToolCall(call: ToolCall): ApiToolCall {
  return {
    id: call.id,
    type: "function",
    function: { name: call.name, arguments: call.arguments || "{}" },
  };
}

async function complete(chatId: string, history: ChatMessage[]) {
  const start = useLucent.getState();
  const chat = start.chats.find((c) => c.id === chatId);
  const profile = resolveProfile({ ...start, activeChatId: chatId });
  if (!chat || !profile) {
    toast.error("Нет активного подключения");
    start.openSettings("links");
    return;
  }
  if (isBlockedEndpoint(profile.baseUrl)) {
    toast.error("В браузере доступны только публичные API. Локальный сервер — в Android-сборке.");
    return;
  }
  const model = (chat.model || profile.model).trim();
  if (!model) {
    toast.error("Укажите идентификатор модели");
    start.openSettings("links");
    return;
  }

  let root = profile.baseUrl;
  try {
    root = normalizeRoot(profile.baseUrl);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Некорректный URL");
    return;
  }

  const visible = history.filter((m) => m.role === "user" || (m.role === "assistant" && m.content && !m.error));
  if (!visible.some((m) => m.role === "user")) {
    toast.error("Нечего отправлять");
    return;
  }

  const assistantId = uid();
  const assistant: ChatMessage = {
    id: assistantId,
    role: "assistant",
    content: "",
    createdAt: Date.now(),
  };
  const next: Chat = { ...chat, messages: [...history, assistant], updatedAt: Date.now() };
  useLucent.getState().writeChat(next, true);
  useLucent.getState().setStreaming(chatId);

  const apiMessages: ApiMessage[] = [];
  const web = start.settings.web === true;
  const system = systemText(chat, start.personas, start.settings.memory, web);
  if (system) apiMessages.push({ role: "system", content: system });
  for (const message of history) {
    if (message.role === "assistant" && !message.content.trim()) continue;
    if (message.error && !message.content.trim()) continue;
    apiMessages.push(toApiMessage(message));
  }

  abort = new AbortController();
  let pendingC = "";
  let pendingR = "";
  let frame = 0;
  const flush = () => {
    frame = 0;
    const content = pendingC;
    const reasoning = pendingR;
    pendingC = "";
    pendingR = "";
    if (!content && !reasoning) return;
    useLucent.getState().appendDelta(chatId, assistantId, content, reasoning);
  };
  const onDelta = (content: string, reasoning: string) => {
    pendingC += content;
    pendingR += reasoning;
    if (!frame) frame = requestAnimationFrame(flush);
  };

  try {
    let tools = web;
    let usage: Usage | undefined;
    let finish: string | undefined;
    for (let round = 0; round < 4; round += 1) {
      const withTools = tools && round < 3;
      if (round > 0) {
        useLucent.getState().patchMessage(chatId, assistantId, { activity: "Собираю ответ" });
      }
      let result;
      try {
        result = await runChat({
          baseUrl: root,
          apiKey: profile.apiKey,
          stream: start.settings.stream,
          signal: abort.signal,
          payload: buildPayload({
            model,
            messages: apiMessages,
            settings: start.settings,
            stream: start.settings.stream,
            tools: withTools,
          }),
          onDelta,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!withTools || isAbort(error) || !toolsRejected(message)) throw error;
        tools = false;
        useLucent.getState().patchMessage(chatId, assistantId, {
          activity: "Эта модель не принимает функции — отвечаю без интернета",
        });
        result = await runChat({
          baseUrl: root,
          apiKey: profile.apiKey,
          stream: start.settings.stream,
          signal: abort.signal,
          payload: buildPayload({
            model,
            messages: apiMessages,
            settings: start.settings,
            stream: start.settings.stream,
          }),
          onDelta,
        });
      }
      if (frame) cancelAnimationFrame(frame);
      flush();
      usage = addUsage(usage, result.usage);
      finish = result.finish ?? finish;
      if (!withTools || result.toolCalls.length === 0) break;

      apiMessages.push({
        role: "assistant",
        content: result.content || null,
        tool_calls: result.toolCalls.map(asToolCall),
      });
      for (const call of result.toolCalls) {
        if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const args = parseArgs(call.arguments);
        let toolText = "";
        let found: WebSource[] = [];
        if (call.name === "web_search") {
          const query = argText(args, ["query", "q", "search"]).slice(0, 240);
          useLucent.getState().patchMessage(chatId, assistantId, {
            activity: query ? `Ищу: ${query}` : "Ищу в интернете",
          });
          if (!query) toolText = "Нужен параметр query.";
          else {
            const webResult = await runWebTool("search", { query }, abort.signal).catch((error: unknown) => {
              if (isAbort(error)) throw error;
              return {
                text: error instanceof Error ? error.message : "Поиск не удался",
                sources: [] as WebSource[],
              };
            });
            toolText = webResult.text;
            found = webResult.sources;
          }
        } else if (call.name === "open_page") {
          const url = argText(args, ["url", "link", "href"]).slice(0, 2000);
          let host = url;
          try {
            host = new URL(url).hostname;
          } catch {
            host = url;
          }
          useLucent.getState().patchMessage(chatId, assistantId, {
            activity: url ? `Читаю ${host}` : "Открываю страницу",
          });
          if (!url) toolText = "Нужен параметр url.";
          else {
            const webResult = await runWebTool("read", { url }, abort.signal).catch((error: unknown) => {
              if (isAbort(error)) throw error;
              return {
                text: error instanceof Error ? error.message : "Страница не открылась",
                sources: [] as WebSource[],
              };
            });
            toolText = webResult.text;
            found = webResult.sources;
          }
        } else {
          toolText = `Инструмент ${call.name} недоступен. Есть только web_search и open_page.`;
        }
        const previous = useLucent.getState().chats.find((c) => c.id === chatId)?.messages.find((m) => m.id === assistantId);
        useLucent.getState().patchMessage(chatId, assistantId, {
          sources: mergeSources(previous?.sources, found),
        });
        apiMessages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: toolText.slice(0, 12_000) || "Пустой результат.",
        });
      }
    }
    const latest = useLucent.getState().chats.find((c) => c.id === chatId);
    const msg = latest?.messages.find((m) => m.id === assistantId);
    const content = msg?.content || "";
    if (!content.trim() && !msg?.reasoning) {
      useLucent.getState().patchMessage(chatId, assistantId, {
        error: "Пустой ответ модели",
        content: "",
        activity: undefined,
      });
    } else {
      useLucent.getState().patchMessage(chatId, assistantId, {
        usage,
        finish,
        error: undefined,
        activity: undefined,
      });
    }
    useLucent.getState().flushPersist();
    void maybeTitle(chatId, profile, model);
  } catch (error) {
    if (frame) cancelAnimationFrame(frame);
    flush();
    if (isAbort(error)) {
      const latest = useLucent.getState().chats.find((c) => c.id === chatId);
      const msg = latest?.messages.find((m) => m.id === assistantId);
      if (msg && !msg.content && !msg.reasoning) {
        useLucent.getState().writeChat(
          { ...latest!, messages: latest!.messages.filter((m) => m.id !== assistantId) },
          false,
        );
      }
    } else {
      const message = error instanceof Error ? error.message : "Не удалось получить ответ";
      useLucent.getState().patchMessage(chatId, assistantId, { error: message, activity: undefined });
      toast.error(message);
    }
    useLucent.getState().flushPersist();
  } finally {
    abort = null;
    if (useLucent.getState().streamingChatId === chatId) useLucent.getState().setStreaming(null);
  }
}

async function maybeTitle(chatId: string, profile: Profile, model: string) {
  const chat = useLucent.getState().chats.find((c) => c.id === chatId);
  if (!chat || chat.incognito || chat.title !== DEFAULT_TITLE) return;
  const first = chat.messages.find((m) => m.role === "user" && !m.hidden && m.content.trim());
  if (!first) return;
  try {
    const settings = useLucent.getState().settings;
    const result = await runChat({
      baseUrl: normalizeRoot(profile.baseUrl),
      apiKey: profile.apiKey,
      stream: false,
      payload: buildPayload({
        model,
        stream: false,
        maxTokens: 24,
        settings: { ...settings, minimal: true, temperature: 0.3, topP: 1 },
        messages: [
          {
            role: "system",
            content: "Название диалога: 3–5 слов на языке пользователя. Без кавычек, точки и пояснений.",
          },
          { role: "user", content: first.content.slice(0, 600) },
        ],
      }),
    });
    const title = result.content
      .replace(/["«»]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    const still = useLucent.getState().chats.find((c) => c.id === chatId);
    if (title && still?.title === DEFAULT_TITLE) useLucent.getState().renameChat(chatId, title);
  } catch {
    /* title is optional */
  }
}

export async function sendDraft() {
  const s = useLucent.getState();
  if (s.streamingChatId) return;
  const content = s.draft.trim();
  const images = s.attachments;
  if (!content && images.length === 0) return;
  if (!resolveProfile(s)) {
    toast.error("Добавьте подключение к API");
    s.openSettings("links");
    return;
  }

  let chat = currentChat(s);
  let chatId = chat?.id ?? "";
  if (!chat) chatId = s.createChat(false);
  chat = useLucent.getState().chats.find((c) => c.id === chatId) ?? null;
  if (!chat) return;

  let history = chat.messages;
  if (s.ui.editingId) {
    const index = history.findIndex((m) => m.id === s.ui.editingId);
    if (index >= 0) history = history.slice(0, index);
  }

  const user: ChatMessage = {
    id: uid(),
    role: "user",
    content,
    images: images.length ? images : undefined,
    createdAt: Date.now(),
  };
  useLucent.getState().clearComposer();
  useLucent.getState().patchUi({ editingId: null, sidebar: window.innerWidth < 768 ? false : s.ui.sidebar });
  await complete(chatId, [...history, user]);
}

export async function regenerate() {
  const s = useLucent.getState();
  if (s.streamingChatId) return;
  const chat = currentChat(s);
  if (!chat) return;
  let history = chat.messages;
  const last = history[history.length - 1];
  if (last?.role === "assistant") history = history.slice(0, -1);
  await complete(chat.id, history);
}

export async function continueReply() {
  const s = useLucent.getState();
  if (s.streamingChatId) return;
  const chat = currentChat(s);
  if (!chat) return;
  const hidden: ChatMessage = {
    id: uid(),
    role: "user",
    content: "Продолжи с места остановки, без повтора уже написанного.",
    hidden: true,
    createdAt: Date.now(),
  };
  await complete(chat.id, [...chat.messages, hidden]);
}

export async function loadModels(profile: Profile): Promise<string[]> {
  if (isBlockedEndpoint(profile.baseUrl)) {
    toast.error("Локальный адрес из браузера недоступен. Список моделей откроется в Android-сборке.");
    return [];
  }
  try {
    const ids = await fetchModels(profile.baseUrl, profile.apiKey);
    if (!ids.length) {
      toast.error("Сервер не вернул ни одной модели");
      return [];
    }
    const model = ids.includes(profile.model) ? profile.model : (ids[0] ?? profile.model);
    if (useLucent.getState().profiles.some((p) => p.id === profile.id)) {
      useLucent.getState().rememberModels(profile.id, ids, model);
    }
    toast.success(`Моделей: ${ids.length}`);
    return ids;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Не удалось получить модели");
    return [];
  }
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function chatToMarkdown(chat: Chat): string {
  const lines = [`# ${chat.title}`, ""];
  for (const message of chat.messages) {
    if (message.hidden) continue;
    lines.push(message.role === "user" ? "## Вы" : "## Модель", "", message.content || message.error || "", "");
    if (message.sources?.length) {
      lines.push(...message.sources.map((source) => `- [${source.title || source.url}](${source.url})`), "");
    }
  }
  return lines.join("\n");
}

export function exportBackup() {
  const s = useLucent.getState();
  const data: Persisted = {
    version: 1,
    profiles: s.profiles,
    chats: s.chats.filter((c) => !c.incognito),
    personas: s.personas,
    settings: s.settings,
    activeChatId: s.activeChatId,
  };
  downloadText(`lucent-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
  toast.success("Файл содержит ключи API — храните его у себя");
}

export function importBackup(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    toast.error("Это не JSON");
    return;
  }
  if (!parsed || typeof parsed !== "object") {
    toast.error("Неизвестный файл");
    return;
  }
  const rec = parsed as Partial<Persisted>;
  if (!Array.isArray(rec.profiles) && !Array.isArray(rec.chats)) {
    toast.error("В файле нет чатов или подключений");
    return;
  }
  useLucent.getState().importData({
    version: 1,
    profiles: Array.isArray(rec.profiles) ? rec.profiles : [],
    chats: Array.isArray(rec.chats) ? rec.chats : [],
    personas: Array.isArray(rec.personas) ? rec.personas : [],
    settings: { ...useLucent.getState().settings, ...(rec.settings ?? {}) },
    activeChatId: typeof rec.activeChatId === "string" ? rec.activeChatId : null,
  });
  toast.success("Данные импортированы");
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Скопировано");
  } catch {
    toast.error("Не удалось скопировать");
  }
}

export function speak(text: string) {
  if (typeof speechSynthesis === "undefined") {
    toast.error("Озвучка недоступна в этом браузере");
    return;
  }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.slice(0, 4000));
  utter.lang = "ru-RU";
  speechSynthesis.speak(utter);
}

export async function compressImage(file: File): Promise<Attachment> {
  if (!file.type.startsWith("image/")) throw new Error("Нужен файл изображения");
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось обработать изображение");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  if (dataUrl.length > 1_800_000) throw new Error("Изображение слишком большое даже после сжатия");
  return { id: uid(), name: file.name || "image.jpg", dataUrl };
}
