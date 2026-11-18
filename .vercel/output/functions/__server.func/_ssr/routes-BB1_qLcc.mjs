import { i as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as ChevronsRight, S as Copy, _ as ImagePlus, a as Square, b as EyeOff, c as Settings, d as RefreshCw, f as Plus, g as Menu, h as Mic, i as Trash2, l as Send, m as Pencil, n as Volume2, o as SquarePen, p as Pin, s as SlidersHorizontal, t as X, u as Search, v as Globe, x as Ellipsis, y as Eye } from "../_libs/lucide-react.mjs";
import { i as safeHost, n as isBlockedEndpoint, r as normalizeRoot } from "./router-WuE0Cq-_.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { t as Markdown } from "../_libs/react-markdown+[...].mjs";
import { t as remarkGfm } from "../_libs/remark-gfm.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as isToday, r as format, t as isYesterday } from "../_libs/date-fns.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BB1_qLcc.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var WEB_TOOLS = [{
	type: "function",
	function: {
		name: "web_search",
		description: "Search the public web. Use for news, current facts, versions, prices, weather and documentation. Returns titles, URLs and snippets.",
		parameters: {
			type: "object",
			additionalProperties: false,
			properties: { query: {
				type: "string",
				description: "Search query in the user's language"
			} },
			required: ["query"]
		}
	}
}, {
	type: "function",
	function: {
		name: "open_page",
		description: "Read the readable text of one public http(s) page. Use when a search snippet is not enough. Never use local, private or non-http URLs.",
		parameters: {
			type: "object",
			additionalProperties: false,
			properties: { url: {
				type: "string",
				description: "Absolute http or https URL"
			} },
			required: ["url"]
		}
	}
}];
function buildPayload(opts) {
	const payload = {
		model: opts.model,
		messages: opts.messages,
		stream: opts.stream
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
function parseModelIds(json) {
	if (!json || typeof json !== "object") return [];
	const record = json;
	const data = record.data ?? record.models;
	if (!Array.isArray(data)) return [];
	const ids = [];
	for (const item of data) if (typeof item === "string") ids.push(item);
	else if (item && typeof item === "object") {
		const rec = item;
		const id = typeof rec.id === "string" ? rec.id : typeof rec.name === "string" ? rec.name : "";
		if (id) ids.push(id);
	}
	return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}
function extractError(text, status) {
	try {
		const json = JSON.parse(text);
		const nested = json.error;
		if (typeof nested === "string" && nested) return nested;
		if (nested && typeof nested === "object" && typeof nested.message === "string" && nested.message) return nested.message;
		if (typeof json.message === "string" && json.message) return json.message;
	} catch {}
	const clean = text.replace(/\s+/g, " ").trim();
	if (clean) return clean.slice(0, 420);
	return `Ошибка ${status}`;
}
function usageOf(json) {
	if (!json || typeof json !== "object") return void 0;
	const usage = json.usage;
	if (!usage) return void 0;
	const prompt = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : void 0;
	const completion = typeof usage.completion_tokens === "number" ? usage.completion_tokens : void 0;
	if (prompt == null && completion == null) return void 0;
	return {
		prompt,
		completion
	};
}
function deltaOf(json) {
	if (!json || typeof json !== "object") return null;
	const choice = json.choices?.[0];
	if (!choice) return null;
	const delta = choice.delta || choice.message;
	const content = typeof delta?.content === "string" ? delta.content : "";
	const reasoningRaw = delta?.reasoning_content ?? delta?.reasoning;
	return {
		content,
		reasoning: typeof reasoningRaw === "string" ? reasoningRaw : "",
		finish: typeof choice.finish_reason === "string" ? choice.finish_reason : void 0
	};
}
function absorbTools(json, acc) {
	if (!json || typeof json !== "object") return;
	const choice = json.choices?.[0];
	const raw = (choice?.delta || choice?.message)?.tool_calls;
	if (!Array.isArray(raw)) return;
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const rec = item;
		const index = typeof rec.index === "number" ? rec.index : acc.length;
		while (acc.length <= index) acc.push({
			id: "",
			name: "",
			arguments: ""
		});
		const slot = acc[index];
		if (!slot) continue;
		if (typeof rec.id === "string" && rec.id) slot.id = rec.id;
		const fn = rec.function;
		if (!fn || typeof fn !== "object") continue;
		const func = fn;
		if (typeof func.name === "string" && func.name) {
			if (!slot.name || func.name.startsWith(slot.name)) slot.name = func.name;
			else if (!slot.name.endsWith(func.name)) slot.name += func.name;
		}
		if (typeof func.arguments === "string") slot.arguments += func.arguments;
		else if (func.arguments && typeof func.arguments === "object") slot.arguments += JSON.stringify(func.arguments);
	}
}
function finishTools(acc) {
	return acc.map((call, index) => ({
		id: call.id || `call_${index}`,
		name: call.name.trim(),
		arguments: call.arguments.trim() || "{}"
	})).filter((call) => call.name).slice(0, 3);
}
async function runWebTool(action, input, signal) {
	const res = await fetch("/api/v1/web", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			action,
			...input
		}),
		signal
	});
	const text = await res.text();
	if (!res.ok) throw new Error(extractError(text, res.status));
	try {
		const json = JSON.parse(text);
		const sources = [];
		if (Array.isArray(json.sources)) for (const item of json.sources) {
			if (!item || typeof item !== "object") continue;
			const rec = item;
			if (typeof rec.url !== "string") continue;
			const source = {
				title: typeof rec.title === "string" ? rec.title : rec.url,
				url: rec.url
			};
			if (typeof rec.snippet === "string") source.snippet = rec.snippet;
			sources.push(source);
		}
		return {
			text: typeof json.text === "string" ? json.text : "",
			sources
		};
	} catch {
		throw new Error("Интернет вернул не JSON");
	}
}
async function runChat(opts) {
	const res = await fetch("/api/v1/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			baseUrl: opts.baseUrl,
			apiKey: opts.apiKey,
			stream: opts.stream,
			payload: opts.payload
		}),
		signal: opts.signal
	});
	const type = res.headers.get("content-type") || "";
	if (!res.ok) throw new Error(extractError(await res.text(), res.status));
	if (!opts.stream || type.includes("application/json") || !res.body) {
		const json = await res.json();
		const delta = deltaOf(json);
		const content = delta?.content ?? "";
		const reasoning = delta?.reasoning ?? "";
		const toolCallsAcc = [];
		absorbTools(json, toolCallsAcc);
		opts.onDelta?.(content, reasoning);
		return {
			content,
			reasoning,
			finish: delta?.finish,
			usage: usageOf(json),
			toolCalls: finishTools(toolCallsAcc)
		};
	}
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let content = "";
	let reasoning = "";
	let finish;
	let usage;
	const toolCallsAcc = [];
	const consume = (data) => {
		if (!data || data === "[DONE]") return data === "[DONE]";
		let json;
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
			if (consume(trimmed.slice(5).trim())) return {
				content,
				reasoning,
				finish,
				usage,
				toolCalls: finishTools(toolCallsAcc)
			};
		}
	}
	const tail = buffer.trim();
	if (tail.startsWith("data:")) consume(tail.slice(5).trim());
	else if (tail.startsWith("{") && !content) try {
		const json = JSON.parse(tail);
		const delta = deltaOf(json);
		content = delta?.content ?? "";
		reasoning = delta?.reasoning ?? "";
		finish = delta?.finish;
		usage = usageOf(json);
		absorbTools(json, toolCallsAcc);
		if (content || reasoning) opts.onDelta?.(content, reasoning);
	} catch {}
	return {
		content,
		reasoning,
		finish,
		usage,
		toolCalls: finishTools(toolCallsAcc)
	};
}
async function fetchModels(baseUrl, apiKey, signal) {
	const res = await fetch("/api/v1/models", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			baseUrl,
			apiKey
		}),
		signal
	});
	const text = await res.text();
	if (!res.ok) throw new Error(extractError(text, res.status));
	try {
		return parseModelIds(JSON.parse(text));
	} catch {
		throw new Error("Сервер не вернул список моделей");
	}
}
var PRESETS = [
	{
		id: "openai",
		name: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
		model: "gpt-4o-mini",
		needsKey: true,
		blurb: "Официальный API"
	},
	{
		id: "openrouter",
		name: "OpenRouter",
		baseUrl: "https://openrouter.ai/api/v1",
		model: "openai/gpt-4o-mini",
		needsKey: true,
		blurb: "Сотни моделей, один ключ"
	},
	{
		id: "groq",
		name: "Groq",
		baseUrl: "https://api.groq.com/openai/v1",
		model: "llama-3.3-70b-versatile",
		needsKey: true,
		blurb: "Очень быстрый инференс"
	},
	{
		id: "together",
		name: "Together",
		baseUrl: "https://api.together.xyz/v1",
		model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
		needsKey: true,
		blurb: "Открытые модели"
	},
	{
		id: "fireworks",
		name: "Fireworks",
		baseUrl: "https://api.fireworks.ai/inference/v1",
		model: "accounts/fireworks/models/llama-v3p1-70b-instruct",
		needsKey: true,
		blurb: "Быстрые открытые модели"
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		baseUrl: "https://api.deepseek.com/v1",
		model: "deepseek-chat",
		needsKey: true,
		blurb: "Чат и рассуждения"
	},
	{
		id: "mistral",
		name: "Mistral",
		baseUrl: "https://api.mistral.ai/v1",
		model: "mistral-small-latest",
		needsKey: true,
		blurb: "Европейские модели"
	},
	{
		id: "xai",
		name: "xAI",
		baseUrl: "https://api.x.ai/v1",
		model: "grok-4.5",
		needsKey: true,
		blurb: "Grok, OpenAI-совместимый"
	},
	{
		id: "cerebras",
		name: "Cerebras",
		baseUrl: "https://api.cerebras.ai/v1",
		model: "llama-3.3-70b",
		needsKey: true,
		blurb: "Высокая скорость"
	},
	{
		id: "ollama",
		name: "Ollama",
		baseUrl: "http://127.0.0.1:11434/v1",
		model: "llama3.2",
		needsKey: false,
		blurb: "Локально, в Android-сборке"
	},
	{
		id: "lmstudio",
		name: "LM Studio",
		baseUrl: "http://127.0.0.1:1234/v1",
		model: "local-model",
		needsKey: false,
		blurb: "Локальный сервер"
	},
	{
		id: "custom",
		name: "Свой endpoint",
		baseUrl: "https://",
		model: "",
		needsKey: true,
		blurb: "Любой /v1 совместимый API"
	}
];
function presetById(id) {
	return PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];
}
function profileFromPreset(presetId, id) {
	const preset = presetById(presetId);
	return {
		id,
		name: preset.name,
		preset: preset.id,
		baseUrl: preset.baseUrl,
		apiKey: "",
		model: preset.model,
		models: preset.model ? [preset.model] : []
	};
}
function defaultPersonas() {
	return [
		{
			id: "assistant",
			name: "Ассистент",
			builtIn: true,
			prompt: "Ты внимательный ассистент. Отвечай на языке пользователя, по делу, без воды. Если не уверен — скажи об этом."
		},
		{
			id: "engineer",
			name: "Инженер",
			builtIn: true,
			prompt: "Ты старший инженер. Сначала короткий вывод, затем рабочий код или точные шаги. Не выдумывай API. Указывай допущения."
		},
		{
			id: "translator",
			name: "Переводчик",
			builtIn: true,
			prompt: "Ты переводчик. Сохраняй тон, имена и разметку. Если язык не указан — переводи на русский. Не добавляй комментарии, только перевод, если не попросили иначе."
		},
		{
			id: "editor",
			name: "Редактор",
			builtIn: true,
			prompt: "Ты литературный редактор. Улучшай ясность и ритм, не меняя смысл. По просьбе показывай правку и короткий список, что изменилось."
		},
		{
			id: "analyst",
			name: "Аналитик",
			builtIn: true,
			prompt: "Ты аналитик. Структурируй ответ: факты, выводы, риски, следующий шаг. Отделяй данные от предположений."
		},
		{
			id: "tutor",
			name: "Репетитор",
			builtIn: true,
			prompt: "Ты терпеливый репетитор. Объясняй простыми словами, с одним примером. Задавай один уточняющий вопрос, если без него нельзя."
		},
		{
			id: "brief",
			name: "Кратко",
			builtIn: true,
			prompt: "Отвечай максимально коротко. Без вступлений и списков, если пользователь сам их не просит."
		}
	];
}
var DEFAULT_TITLE = "Новый чат";
var STORAGE_KEY = "lucent.v1";
var defaultSettings = () => ({
	temperature: .7,
	topP: 1,
	maxTokens: 0,
	presencePenalty: 0,
	frequencyPenalty: 0,
	stream: true,
	minimal: false,
	enterToSend: true,
	showTimestamps: false,
	fontScale: "md",
	memory: "",
	web: false,
	activeProfileId: null
});
var defaultUi = () => ({
	sidebar: false,
	settings: false,
	tab: "links",
	search: "",
	editingId: null,
	chatParams: false,
	profileEdit: null,
	focusSearch: 0
});
function uid() {
	return crypto.randomUUID();
}
var persistTimer = null;
var quotaWarned = false;
function asRecord(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value;
}
function normalizeSources(value) {
	if (!Array.isArray(value)) return void 0;
	const sources = [];
	for (const item of value) {
		const rec = asRecord(item);
		if (!rec || typeof rec.url !== "string" || !/^https?:\/\//i.test(rec.url)) continue;
		const source = {
			title: typeof rec.title === "string" ? rec.title.slice(0, 180) : rec.url,
			url: rec.url.slice(0, 2e3)
		};
		if (typeof rec.snippet === "string") source.snippet = rec.snippet.slice(0, 320);
		sources.push(source);
		if (sources.length >= 8) break;
	}
	return sources.length ? sources : void 0;
}
function normalizeMessage(value) {
	const m = asRecord(value);
	if (!m) return null;
	if (m.role !== "user" && m.role !== "assistant") return null;
	if (typeof m.content !== "string" || typeof m.id !== "string") return null;
	const images = Array.isArray(m.images) ? m.images.map((img) => {
		const rec = asRecord(img);
		if (!rec || typeof rec.dataUrl !== "string") return null;
		return {
			id: typeof rec.id === "string" ? rec.id : uid(),
			name: typeof rec.name === "string" ? rec.name : "image",
			dataUrl: rec.dataUrl
		};
	}).filter((img) => !!img) : void 0;
	return {
		id: m.id,
		role: m.role,
		content: m.content,
		images: images && images.length ? images : void 0,
		reasoning: typeof m.reasoning === "string" ? m.reasoning : void 0,
		createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
		error: typeof m.error === "string" ? m.error : void 0,
		hidden: m.hidden === true,
		finish: typeof m.finish === "string" ? m.finish : void 0,
		activity: typeof m.activity === "string" && m.activity ? m.activity : void 0,
		sources: normalizeSources(m.sources),
		usage: asRecord(m.usage) ? {
			prompt: typeof asRecord(m.usage)?.prompt === "number" ? asRecord(m.usage)?.prompt : void 0,
			completion: typeof asRecord(m.usage)?.completion === "number" ? asRecord(m.usage)?.completion : void 0
		} : void 0
	};
}
function normalizeChat(value) {
	const c = asRecord(value);
	if (!c || typeof c.id !== "string") return null;
	const messages = Array.isArray(c.messages) ? c.messages.map(normalizeMessage).filter((m) => !!m) : [];
	return {
		id: c.id,
		title: typeof c.title === "string" && c.title.trim() ? c.title : DEFAULT_TITLE,
		profileId: typeof c.profileId === "string" ? c.profileId : null,
		model: typeof c.model === "string" ? c.model : null,
		personaId: typeof c.personaId === "string" ? c.personaId : null,
		systemPrompt: typeof c.systemPrompt === "string" ? c.systemPrompt : "",
		pinned: c.pinned === true,
		incognito: false,
		createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
		updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : Date.now(),
		messages
	};
}
function normalizeProfile(value) {
	const p = asRecord(value);
	if (!p || typeof p.id !== "string") return null;
	if (typeof p.baseUrl !== "string") return null;
	return {
		id: p.id,
		name: typeof p.name === "string" && p.name.trim() ? p.name : "Подключение",
		preset: typeof p.preset === "string" ? p.preset : "custom",
		baseUrl: p.baseUrl,
		apiKey: typeof p.apiKey === "string" ? p.apiKey : "",
		model: typeof p.model === "string" ? p.model : "",
		models: Array.isArray(p.models) ? p.models.filter((m) => typeof m === "string").slice(0, 500) : []
	};
}
function normalizePersona(value) {
	const p = asRecord(value);
	if (!p || typeof p.id !== "string" || typeof p.name !== "string") return null;
	return {
		id: p.id,
		name: p.name,
		prompt: typeof p.prompt === "string" ? p.prompt : "",
		builtIn: p.builtIn === true
	};
}
function snapshot(s) {
	const chats = s.chats.filter((c) => !c.incognito);
	const active = chats.some((c) => c.id === s.activeChatId) ? s.activeChatId : chats[0]?.id ?? null;
	return {
		version: 1,
		profiles: s.profiles,
		chats,
		personas: s.personas,
		settings: s.settings,
		activeChatId: active
	};
}
var useLucent = create((set, get) => ({
	hydrated: false,
	profiles: [],
	chats: [],
	personas: defaultPersonas(),
	settings: defaultSettings(),
	activeChatId: null,
	streamingChatId: null,
	draft: "",
	attachments: [],
	ui: defaultUi(),
	hydrate: () => {
		if (get().hydrated) return;
		let parsed = null;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) parsed = JSON.parse(raw);
		} catch {
			parsed = null;
		}
		const rec = asRecord(parsed);
		const settings = {
			...defaultSettings(),
			...asRecord(rec?.settings)
		};
		if (settings.fontScale !== "sm" && settings.fontScale !== "md" && settings.fontScale !== "lg") settings.fontScale = "md";
		settings.web = settings.web === true;
		const profiles = Array.isArray(rec?.profiles) ? rec.profiles.map(normalizeProfile).filter((p) => !!p) : [];
		const chats = Array.isArray(rec?.chats) ? rec.chats.map(normalizeChat).filter((c) => !!c) : [];
		const personas = Array.isArray(rec?.personas) ? rec.personas.map(normalizePersona).filter((p) => !!p) : [];
		const wide = window.matchMedia("(min-width: 768px)").matches;
		const activeChatId = chats.some((c) => c.id === rec?.activeChatId) ? rec?.activeChatId : null;
		set({
			hydrated: true,
			settings: {
				...settings,
				activeProfileId: profiles.some((p) => p.id === settings.activeProfileId) ? settings.activeProfileId : profiles[0]?.id ?? null
			},
			profiles,
			chats,
			personas: personas.length ? personas : defaultPersonas(),
			activeChatId,
			ui: {
				...defaultUi(),
				sidebar: wide
			}
		});
	},
	flushPersist: () => {
		if (typeof window === "undefined" || !get().hydrated) return;
		if (persistTimer) {
			window.clearTimeout(persistTimer);
			persistTimer = null;
		}
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(get())));
			quotaWarned = false;
		} catch {
			if (!quotaWarned) {
				quotaWarned = true;
				toast.error("Память браузера заполнена. Экспортируйте чаты и удалите старые.");
			}
		}
	},
	schedulePersist: () => {
		if (typeof window === "undefined") return;
		if (persistTimer) return;
		persistTimer = window.setTimeout(() => {
			persistTimer = null;
			get().flushPersist();
		}, 1200);
	},
	patchUi: (partial) => set((s) => ({ ui: {
		...s.ui,
		...partial
	} })),
	openSettings: (tab) => set((s) => ({ ui: {
		...s.ui,
		settings: true,
		tab: tab ?? s.ui.tab,
		chatParams: false
	} })),
	closeSettings: () => set((s) => ({ ui: {
		...s.ui,
		settings: false,
		profileEdit: null
	} })),
	openProfileEditor: (edit) => set((s) => ({ ui: {
		...s.ui,
		settings: true,
		tab: "links",
		profileEdit: edit,
		chatParams: false
	} })),
	setDraft: (draft, attachments) => set((s) => ({
		draft,
		attachments: attachments ?? s.attachments
	})),
	addAttachments: (items) => set((s) => ({ attachments: [...s.attachments, ...items].slice(0, 4) })),
	removeAttachment: (id) => set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),
	clearComposer: () => set({
		draft: "",
		attachments: []
	}),
	createChat: (incognito = false) => {
		const id = uid();
		const now = Date.now();
		const narrow = window.innerWidth < 768;
		const chat = {
			id,
			title: incognito ? "Инкогнито" : DEFAULT_TITLE,
			profileId: get().settings.activeProfileId,
			model: null,
			personaId: null,
			systemPrompt: "",
			pinned: false,
			incognito,
			createdAt: now,
			updatedAt: now,
			messages: []
		};
		set((s) => ({
			chats: [chat, ...s.chats],
			activeChatId: id,
			ui: {
				...s.ui,
				sidebar: narrow ? false : s.ui.sidebar,
				editingId: null,
				chatParams: false
			}
		}));
		get().flushPersist();
		return id;
	},
	selectChat: (id) => {
		const narrow = window.innerWidth < 768;
		set((s) => ({
			activeChatId: id,
			ui: {
				...s.ui,
				sidebar: narrow ? false : s.ui.sidebar,
				editingId: null,
				chatParams: false
			}
		}));
		get().flushPersist();
	},
	renameChat: (id, title) => {
		const clean = title.trim().slice(0, 80);
		if (!clean) return;
		set((s) => ({ chats: s.chats.map((c) => c.id === id ? {
			...c,
			title: clean,
			updatedAt: Date.now()
		} : c) }));
		get().flushPersist();
	},
	togglePin: (id) => {
		set((s) => ({ chats: s.chats.map((c) => c.id === id ? {
			...c,
			pinned: !c.pinned
		} : c) }));
		get().flushPersist();
	},
	deleteChat: (id) => {
		set((s) => {
			const chats = s.chats.filter((c) => c.id !== id);
			return {
				chats,
				activeChatId: s.activeChatId === id ? chats.find((c) => !c.incognito)?.id ?? chats[0]?.id ?? null : s.activeChatId
			};
		});
		get().flushPersist();
	},
	duplicateChat: (id) => {
		const source = get().chats.find((c) => c.id === id);
		if (!source) return;
		const now = Date.now();
		const copy = {
			...source,
			id: uid(),
			title: `${source.title} · копия`.slice(0, 80),
			pinned: false,
			incognito: false,
			createdAt: now,
			updatedAt: now,
			messages: source.messages.map((m) => ({
				...m,
				id: uid(),
				images: m.images?.map((img) => ({ ...img }))
			}))
		};
		set((s) => ({
			chats: [copy, ...s.chats],
			activeChatId: copy.id
		}));
		get().flushPersist();
	},
	clearMessages: (id) => {
		set((s) => ({ chats: s.chats.map((c) => c.id === id ? {
			...c,
			messages: [],
			updatedAt: Date.now()
		} : c) }));
		get().flushPersist();
	},
	setChatFields: (id, partial) => {
		set((s) => ({ chats: s.chats.map((c) => c.id === id ? {
			...c,
			...partial,
			id: c.id,
			updatedAt: Date.now()
		} : c) }));
		get().flushPersist();
	},
	writeChat: (chat, top = true) => {
		set((s) => {
			const rest = s.chats.filter((c) => c.id !== chat.id);
			return { chats: top ? [chat, ...rest] : s.chats.map((c) => c.id === chat.id ? chat : c) };
		});
		if (chat.incognito) get().schedulePersist();
		else get().schedulePersist();
	},
	appendDelta: (chatId, messageId, content, reasoning) => {
		set((s) => ({ chats: s.chats.map((c) => {
			if (c.id !== chatId) return c;
			return {
				...c,
				updatedAt: Date.now(),
				messages: c.messages.map((m) => {
					if (m.id !== messageId) return m;
					const nextReason = `${m.reasoning || ""}${reasoning}`;
					return {
						...m,
						content: m.content + content,
						reasoning: nextReason || void 0
					};
				})
			};
		}) }));
		get().schedulePersist();
	},
	patchMessage: (chatId, messageId, partial) => {
		set((s) => ({ chats: s.chats.map((c) => c.id !== chatId ? c : {
			...c,
			messages: c.messages.map((m) => m.id === messageId ? {
				...m,
				...partial
			} : m)
		}) }));
		get().schedulePersist();
	},
	setStreaming: (chatId) => set({ streamingChatId: chatId }),
	saveProfile: (profile, makeActive = true) => {
		set((s) => {
			return {
				profiles: s.profiles.some((p) => p.id === profile.id) ? s.profiles.map((p) => p.id === profile.id ? profile : p) : [profile, ...s.profiles],
				settings: {
					...s.settings,
					activeProfileId: makeActive ? profile.id : s.settings.activeProfileId
				},
				ui: {
					...s.ui,
					profileEdit: null
				}
			};
		});
		get().flushPersist();
	},
	deleteProfile: (id) => {
		set((s) => {
			const profiles = s.profiles.filter((p) => p.id !== id);
			const active = s.settings.activeProfileId === id ? profiles[0]?.id ?? null : s.settings.activeProfileId;
			return {
				profiles,
				settings: {
					...s.settings,
					activeProfileId: active
				}
			};
		});
		get().flushPersist();
	},
	setActiveProfile: (id) => {
		set((s) => ({ settings: {
			...s.settings,
			activeProfileId: id
		} }));
		get().flushPersist();
	},
	rememberModels: (id, models, model) => {
		set((s) => ({ profiles: s.profiles.map((p) => p.id === id ? {
			...p,
			models: models.slice(0, 500),
			model: model ?? p.model
		} : p) }));
		get().flushPersist();
	},
	updateSettings: (partial) => {
		set((s) => ({ settings: {
			...s.settings,
			...partial
		} }));
		get().flushPersist();
	},
	savePersona: (persona) => {
		set((s) => {
			return { personas: s.personas.some((p) => p.id === persona.id) ? s.personas.map((p) => p.id === persona.id ? persona : p) : [...s.personas, persona] };
		});
		get().flushPersist();
	},
	deletePersona: (id) => {
		set((s) => ({
			personas: s.personas.filter((p) => p.id !== id),
			chats: s.chats.map((c) => c.personaId === id ? {
				...c,
				personaId: null
			} : c)
		}));
		get().flushPersist();
	},
	resetPersonas: () => {
		const builtins = defaultPersonas();
		set((s) => ({ personas: [...builtins, ...s.personas.filter((p) => !p.builtIn && !builtins.some((b) => b.id === p.id))] }));
		get().flushPersist();
	},
	importData: (data) => {
		const profiles = data.profiles.map(normalizeProfile).filter((p) => !!p);
		const chats = data.chats.map(normalizeChat).filter((c) => !!c);
		const personas = data.personas.map(normalizePersona).filter((p) => !!p);
		const settings = {
			...defaultSettings(),
			...data.settings
		};
		set({
			profiles,
			chats,
			personas: personas.length ? personas : defaultPersonas(),
			settings: {
				...settings,
				activeProfileId: profiles.some((p) => p.id === settings.activeProfileId) ? settings.activeProfileId : profiles[0]?.id ?? null
			},
			activeChatId: chats.some((c) => c.id === data.activeChatId) ? data.activeChatId : chats[0]?.id ?? null
		});
		get().flushPersist();
	},
	wipe: () => {
		set({
			profiles: [],
			chats: [],
			personas: defaultPersonas(),
			settings: defaultSettings(),
			activeChatId: null,
			draft: "",
			attachments: [],
			streamingChatId: null,
			ui: {
				...get().ui,
				editingId: null,
				profileEdit: null,
				chatParams: false
			}
		});
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {}
	}
}));
function currentChat(s) {
	return s.chats.find((c) => c.id === s.activeChatId) ?? null;
}
function resolveProfile(s) {
	const id = currentChat(s)?.profileId || s.settings.activeProfileId;
	return s.profiles.find((p) => p.id === id) ?? s.profiles[0] ?? null;
}
function blankProfile(presetId) {
	return profileFromPreset(presetId, uid());
}
var abort = null;
var WEB_NOTE = "Доступны функции web_search и open_page. web_search ищет в открытом интернете и возвращает заголовки, ссылки и фрагменты. open_page читает текст публичной http(s)-страницы. Вызывай их, когда нужны свежие факты, новости, версии или документация. Не выдумывай ссылки и цифры. В конце ответа перечисли использованные источники.";
function stopStream() {
	abort?.abort();
}
function systemText(chat, personas, memory, web) {
	const parts = [];
	const persona = personas.find((p) => p.id === chat.personaId);
	if (persona?.prompt.trim()) parts.push(persona.prompt.trim());
	if (chat.systemPrompt.trim()) parts.push(chat.systemPrompt.trim());
	if (memory.trim()) parts.push(`Память о пользователе:\n${memory.trim()}`);
	if (web) parts.push(WEB_NOTE);
	return parts.join("\n\n");
}
function toApiMessage(message) {
	let text = message.content;
	if (message.role === "assistant" && message.sources?.length) {
		const lines = message.sources.map((source) => `- ${source.title || source.url} — ${source.url}`).join("\n");
		text = `${text}\n\nИсточники:\n${lines}`.trim();
	}
	if (message.role === "user" && message.images?.length) {
		const parts = [];
		if (text.trim()) parts.push({
			type: "text",
			text
		});
		for (const image of message.images) parts.push({
			type: "image_url",
			image_url: { url: image.dataUrl }
		});
		return {
			role: "user",
			content: parts
		};
	}
	return {
		role: message.role,
		content: text
	};
}
function isAbort(error) {
	return error instanceof Error && error.name === "AbortError";
}
function toolsRejected(message) {
	return /tool|function/i.test(message);
}
function addUsage(left, right) {
	if (!left) return right;
	if (!right) return left;
	return {
		prompt: (left.prompt ?? 0) + (right.prompt ?? 0) || void 0,
		completion: (left.completion ?? 0) + (right.completion ?? 0) || void 0
	};
}
function parseArgs(raw) {
	try {
		const json = JSON.parse(raw);
		if (json && typeof json === "object" && !Array.isArray(json)) return json;
	} catch {}
	return {};
}
function argText(args, keys) {
	for (const key of keys) {
		const value = args[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return "";
}
function mergeSources(current, next) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const source of [...current ?? [], ...next]) {
		if (!source.url || seen.has(source.url)) continue;
		seen.add(source.url);
		out.push(source);
		if (out.length >= 8) break;
	}
	return out;
}
function asToolCall(call) {
	return {
		id: call.id,
		type: "function",
		function: {
			name: call.name,
			arguments: call.arguments || "{}"
		}
	};
}
async function complete(chatId, history) {
	const start = useLucent.getState();
	const chat = start.chats.find((c) => c.id === chatId);
	const profile = resolveProfile({
		...start,
		activeChatId: chatId
	});
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
	if (!history.filter((m) => m.role === "user" || m.role === "assistant" && m.content && !m.error).some((m) => m.role === "user")) {
		toast.error("Нечего отправлять");
		return;
	}
	const assistantId = uid();
	const assistant = {
		id: assistantId,
		role: "assistant",
		content: "",
		createdAt: Date.now()
	};
	const next = {
		...chat,
		messages: [...history, assistant],
		updatedAt: Date.now()
	};
	useLucent.getState().writeChat(next, true);
	useLucent.getState().setStreaming(chatId);
	const apiMessages = [];
	const web = start.settings.web === true;
	const system = systemText(chat, start.personas, start.settings.memory, web);
	if (system) apiMessages.push({
		role: "system",
		content: system
	});
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
	const onDelta = (content, reasoning) => {
		pendingC += content;
		pendingR += reasoning;
		if (!frame) frame = requestAnimationFrame(flush);
	};
	try {
		let tools = web;
		let usage;
		let finish;
		for (let round = 0; round < 4; round += 1) {
			const withTools = tools && round < 3;
			if (round > 0) useLucent.getState().patchMessage(chatId, assistantId, { activity: "Собираю ответ" });
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
						tools: withTools
					}),
					onDelta
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : "";
				if (!withTools || isAbort(error) || !toolsRejected(message)) throw error;
				tools = false;
				useLucent.getState().patchMessage(chatId, assistantId, { activity: "Эта модель не принимает функции — отвечаю без интернета" });
				result = await runChat({
					baseUrl: root,
					apiKey: profile.apiKey,
					stream: start.settings.stream,
					signal: abort.signal,
					payload: buildPayload({
						model,
						messages: apiMessages,
						settings: start.settings,
						stream: start.settings.stream
					}),
					onDelta
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
				tool_calls: result.toolCalls.map(asToolCall)
			});
			for (const call of result.toolCalls) {
				if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");
				const args = parseArgs(call.arguments);
				let toolText = "";
				let found = [];
				if (call.name === "web_search") {
					const query = argText(args, [
						"query",
						"q",
						"search"
					]).slice(0, 240);
					useLucent.getState().patchMessage(chatId, assistantId, { activity: query ? `Ищу: ${query}` : "Ищу в интернете" });
					if (!query) toolText = "Нужен параметр query.";
					else {
						const webResult = await runWebTool("search", { query }, abort.signal).catch((error) => {
							if (isAbort(error)) throw error;
							return {
								text: error instanceof Error ? error.message : "Поиск не удался",
								sources: []
							};
						});
						toolText = webResult.text;
						found = webResult.sources;
					}
				} else if (call.name === "open_page") {
					const url = argText(args, [
						"url",
						"link",
						"href"
					]).slice(0, 2e3);
					let host = url;
					try {
						host = new URL(url).hostname;
					} catch {
						host = url;
					}
					useLucent.getState().patchMessage(chatId, assistantId, { activity: url ? `Читаю ${host}` : "Открываю страницу" });
					if (!url) toolText = "Нужен параметр url.";
					else {
						const webResult = await runWebTool("read", { url }, abort.signal).catch((error) => {
							if (isAbort(error)) throw error;
							return {
								text: error instanceof Error ? error.message : "Страница не открылась",
								sources: []
							};
						});
						toolText = webResult.text;
						found = webResult.sources;
					}
				} else toolText = `Инструмент ${call.name} недоступен. Есть только web_search и open_page.`;
				const previous = useLucent.getState().chats.find((c) => c.id === chatId)?.messages.find((m) => m.id === assistantId);
				useLucent.getState().patchMessage(chatId, assistantId, { sources: mergeSources(previous?.sources, found) });
				apiMessages.push({
					role: "tool",
					tool_call_id: call.id,
					name: call.name,
					content: toolText.slice(0, 12e3) || "Пустой результат."
				});
			}
		}
		const msg = useLucent.getState().chats.find((c) => c.id === chatId)?.messages.find((m) => m.id === assistantId);
		if (!(msg?.content || "").trim() && !msg?.reasoning) useLucent.getState().patchMessage(chatId, assistantId, {
			error: "Пустой ответ модели",
			content: "",
			activity: void 0
		});
		else useLucent.getState().patchMessage(chatId, assistantId, {
			usage,
			finish,
			error: void 0,
			activity: void 0
		});
		useLucent.getState().flushPersist();
		maybeTitle(chatId, profile, model);
	} catch (error) {
		if (frame) cancelAnimationFrame(frame);
		flush();
		if (isAbort(error)) {
			const latest = useLucent.getState().chats.find((c) => c.id === chatId);
			const msg = latest?.messages.find((m) => m.id === assistantId);
			if (msg && !msg.content && !msg.reasoning) useLucent.getState().writeChat({
				...latest,
				messages: latest.messages.filter((m) => m.id !== assistantId)
			}, false);
		} else {
			const message = error instanceof Error ? error.message : "Не удалось получить ответ";
			useLucent.getState().patchMessage(chatId, assistantId, {
				error: message,
				activity: void 0
			});
			toast.error(message);
		}
		useLucent.getState().flushPersist();
	} finally {
		abort = null;
		if (useLucent.getState().streamingChatId === chatId) useLucent.getState().setStreaming(null);
	}
}
async function maybeTitle(chatId, profile, model) {
	const chat = useLucent.getState().chats.find((c) => c.id === chatId);
	if (!chat || chat.incognito || chat.title !== "Новый чат") return;
	const first = chat.messages.find((m) => m.role === "user" && !m.hidden && m.content.trim());
	if (!first) return;
	try {
		const settings = useLucent.getState().settings;
		const title = (await runChat({
			baseUrl: normalizeRoot(profile.baseUrl),
			apiKey: profile.apiKey,
			stream: false,
			payload: buildPayload({
				model,
				stream: false,
				maxTokens: 24,
				settings: {
					...settings,
					minimal: true,
					temperature: .3,
					topP: 1
				},
				messages: [{
					role: "system",
					content: "Название диалога: 3–5 слов на языке пользователя. Без кавычек, точки и пояснений."
				}, {
					role: "user",
					content: first.content.slice(0, 600)
				}]
			})
		})).content.replace(/["«»]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
		const still = useLucent.getState().chats.find((c) => c.id === chatId);
		if (title && still?.title === "Новый чат") useLucent.getState().renameChat(chatId, title);
	} catch {}
}
async function sendDraft() {
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
	const user = {
		id: uid(),
		role: "user",
		content,
		images: images.length ? images : void 0,
		createdAt: Date.now()
	};
	useLucent.getState().clearComposer();
	useLucent.getState().patchUi({
		editingId: null,
		sidebar: window.innerWidth < 768 ? false : s.ui.sidebar
	});
	await complete(chatId, [...history, user]);
}
async function regenerate() {
	const s = useLucent.getState();
	if (s.streamingChatId) return;
	const chat = currentChat(s);
	if (!chat) return;
	let history = chat.messages;
	if (history[history.length - 1]?.role === "assistant") history = history.slice(0, -1);
	await complete(chat.id, history);
}
async function continueReply() {
	const s = useLucent.getState();
	if (s.streamingChatId) return;
	const chat = currentChat(s);
	if (!chat) return;
	const hidden = {
		id: uid(),
		role: "user",
		content: "Продолжи с места остановки, без повтора уже написанного.",
		hidden: true,
		createdAt: Date.now()
	};
	await complete(chat.id, [...chat.messages, hidden]);
}
async function loadModels(profile) {
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
		const model = ids.includes(profile.model) ? profile.model : ids[0] ?? profile.model;
		if (useLucent.getState().profiles.some((p) => p.id === profile.id)) useLucent.getState().rememberModels(profile.id, ids, model);
		toast.success(`Моделей: ${ids.length}`);
		return ids;
	} catch (error) {
		toast.error(error instanceof Error ? error.message : "Не удалось получить модели");
		return [];
	}
}
function downloadText(filename, text, type) {
	const blob = new Blob([text], { type });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
function chatToMarkdown(chat) {
	const lines = [`# ${chat.title}`, ""];
	for (const message of chat.messages) {
		if (message.hidden) continue;
		lines.push(message.role === "user" ? "## Вы" : "## Модель", "", message.content || message.error || "", "");
		if (message.sources?.length) lines.push(...message.sources.map((source) => `- [${source.title || source.url}](${source.url})`), "");
	}
	return lines.join("\n");
}
function exportBackup() {
	const s = useLucent.getState();
	const data = {
		version: 1,
		profiles: s.profiles,
		chats: s.chats.filter((c) => !c.incognito),
		personas: s.personas,
		settings: s.settings,
		activeChatId: s.activeChatId
	};
	downloadText(`lucent-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
	toast.success("Файл содержит ключи API — храните его у себя");
}
function importBackup(text) {
	let parsed;
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
	const rec = parsed;
	if (!Array.isArray(rec.profiles) && !Array.isArray(rec.chats)) {
		toast.error("В файле нет чатов или подключений");
		return;
	}
	useLucent.getState().importData({
		version: 1,
		profiles: Array.isArray(rec.profiles) ? rec.profiles : [],
		chats: Array.isArray(rec.chats) ? rec.chats : [],
		personas: Array.isArray(rec.personas) ? rec.personas : [],
		settings: {
			...useLucent.getState().settings,
			...rec.settings ?? {}
		},
		activeChatId: typeof rec.activeChatId === "string" ? rec.activeChatId : null
	});
	toast.success("Данные импортированы");
}
async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success("Скопировано");
	} catch {
		toast.error("Не удалось скопировать");
	}
}
function speak(text) {
	if (typeof speechSynthesis === "undefined") {
		toast.error("Озвучка недоступна в этом браузере");
		return;
	}
	speechSynthesis.cancel();
	const utter = new SpeechSynthesisUtterance(text.slice(0, 4e3));
	utter.lang = "ru-RU";
	speechSynthesis.speak(utter);
}
async function compressImage(file) {
	if (!file.type.startsWith("image/")) throw new Error("Нужен файл изображения");
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Не удалось обработать изображение");
	ctx.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	const dataUrl = canvas.toDataURL("image/jpeg", .72);
	if (dataUrl.length > 18e5) throw new Error("Изображение слишком большое даже после сжатия");
	return {
		id: uid(),
		name: file.name || "image.jpg",
		dataUrl
	};
}
function nodeText(node) {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(nodeText).join("");
	if ((0, import_react.isValidElement)(node)) {
		const props = node.props;
		return nodeText(props.children);
	}
	return "";
}
function CodeFrame({ children }) {
	const child = Array.isArray(children) ? children[0] : children;
	let lang = "text";
	let text = "";
	if ((0, import_react.isValidElement)(child)) {
		const props = child.props;
		lang = /language-([\w+-]+)/.exec(props.className || "")?.[1] || "text";
		text = nodeText(props.children).replace(/\n$/, "");
	} else text = nodeText(children).replace(/\n$/, "");
	const [copied, setCopied] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "code-frame",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "code-top",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: lang }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "btn btn-ghost min-h-8 rounded-full px-3 text-xs",
				onClick: () => {
					copyText(text).then(() => {
						setCopied(true);
						window.setTimeout(() => setCopied(false), 1200);
					});
				},
				children: copied ? "Готово" : "Копировать"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: text }) })]
	});
}
function MarkdownView({ text }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "md",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, {
			remarkPlugins: [remarkGfm],
			components: {
				a({ href, children }) {
					const safe = href && /^(https?:|mailto:)/i.test(href) ? href : void 0;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: safe,
						target: "_blank",
						rel: "noreferrer noopener",
						children
					});
				},
				img({ src, alt }) {
					if (!src || !/^https:\/\//i.test(src)) return null;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src,
						alt: alt || "",
						className: "md-img"
					});
				},
				code({ className, children }) {
					if (className) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className,
						children
					});
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: "inline-code",
						children
					});
				},
				pre({ children }) {
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeFrame, { children });
				},
				table({ children }) {
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "table-scroll",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", { children })
					});
				}
			},
			children: text
		})
	});
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function clock(ts) {
	return new Date(ts).toLocaleTimeString("ru-RU", {
		hour: "2-digit",
		minute: "2-digit"
	});
}
function ChatView() {
	const chat = useLucent((s) => currentChat(s));
	const profile = useLucent((s) => resolveProfile(s));
	const personas = useLucent((s) => s.personas);
	const settings = useLucent((s) => s.settings);
	const updateSettings = useLucent((s) => s.updateSettings);
	const streamingId = useLucent((s) => s.streamingChatId);
	const draft = useLucent((s) => s.draft);
	const attachments = useLucent((s) => s.attachments);
	const editingId = useLucent((s) => s.ui.editingId);
	const chatParams = useLucent((s) => s.ui.chatParams);
	const setDraft = useLucent((s) => s.setDraft);
	const removeAttachment = useLucent((s) => s.removeAttachment);
	const addAttachments = useLucent((s) => s.addAttachments);
	const patchUi = useLucent((s) => s.patchUi);
	const clearComposer = useLucent((s) => s.clearComposer);
	const setChatFields = useLucent((s) => s.setChatFields);
	const renameChat = useLucent((s) => s.renameChat);
	const togglePin = useLucent((s) => s.togglePin);
	const deleteChat = useLucent((s) => s.deleteChat);
	const duplicateChat = useLucent((s) => s.duplicateChat);
	const clearMessages = useLucent((s) => s.clearMessages);
	const createChat = useLucent((s) => s.createChat);
	const openProfileEditor = useLucent((s) => s.openProfileEditor);
	const streaming = !!chat && streamingId === chat.id;
	const scrollerRef = (0, import_react.useRef)(null);
	const stickRef = (0, import_react.useRef)(true);
	const fileRef = (0, import_react.useRef)(null);
	const [menu, setMenu] = (0, import_react.useState)(false);
	const [renaming, setRenaming] = (0, import_react.useState)(false);
	const [titleDraft, setTitleDraft] = (0, import_react.useState)("");
	const [listening, setListening] = (0, import_react.useState)(false);
	const [slashIndex, setSlashIndex] = (0, import_react.useState)(0);
	const last = chat?.messages.filter((m) => !m.hidden).at(-1);
	const tail = last ? `${last.id}:${last.content.length}:${last.reasoning?.length ?? 0}:${last.activity ?? ""}:${last.sources?.length ?? 0}` : "";
	(0, import_react.useEffect)(() => {
		if (!stickRef.current) return;
		const el = scrollerRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [
		tail,
		chat?.id,
		attachments.length
	]);
	(0, import_react.useEffect)(() => {
		setMenu(false);
		setRenaming(false);
	}, [chat?.id]);
	async function addFiles(files) {
		const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, 4 - attachments.length);
		if (!list.length) return;
		try {
			const next = [];
			for (const file of list) next.push(await compressImage(file));
			addAttachments(next);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Не удалось прикрепить фото");
		}
	}
	function onDrop(event) {
		event.preventDefault();
		if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
	}
	const slash = draft.startsWith("/") && !draft.includes("\n");
	const commands = slashCommands(personas, draft.slice(1).trim().toLowerCase());
	function runCommand(index = slashIndex) {
		const command = commands[index];
		if (!command) {
			sendDraft();
			return;
		}
		command.run();
		clearComposer();
	}
	function onKeyDown(event) {
		if (slash && commands.length) {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setSlashIndex((i) => (i + 1) % commands.length);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setSlashIndex((i) => (i - 1 + commands.length) % commands.length);
				return;
			}
		}
		if (event.key === "Enter" && !event.shiftKey && settings.enterToSend) {
			event.preventDefault();
			if (slash) runCommand();
			else sendDraft();
		}
	}
	const recRef = (0, import_react.useRef)(null);
	function toggleMic() {
		if (recRef.current) {
			recRef.current.stop();
			recRef.current = null;
			setListening(false);
			return;
		}
		const w = window;
		const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
		if (!Ctor) {
			toast.error("Голосовой ввод недоступен в этом браузере");
			return;
		}
		const rec = new Ctor();
		rec.lang = "ru-RU";
		rec.interimResults = true;
		rec.continuous = false;
		const base = draft;
		rec.onresult = (event) => {
			let said = "";
			for (let i = 0; i < event.results.length; i += 1) said += event.results[i]?.[0]?.transcript ?? "";
			setDraft(`${base}${base && !base.endsWith(" ") ? " " : ""}${said}`.trimStart());
		};
		rec.onerror = () => {
			recRef.current = null;
			setListening(false);
		};
		rec.onend = () => {
			recRef.current = null;
			setListening(false);
		};
		recRef.current = rec;
		rec.start();
		setListening(true);
	}
	const modelLabel = (chat?.model || profile?.model || "Модель не выбрана").trim();
	const persona = personas.find((p) => p.id === chat?.personaId);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		onDragOver: (e) => e.preventDefault(),
		onDrop,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-2 border-b border-line px-3 py-2.5 md:px-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn btn-icon btn-ghost md:hidden",
						"aria-label": "Чаты",
						onClick: () => patchUi({ sidebar: true }),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [renaming && chat ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
							onSubmit: (e) => {
								e.preventDefault();
								renameChat(chat.id, titleDraft);
								setRenaming(false);
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								autoFocus: true,
								value: titleDraft,
								onChange: (e) => setTitleDraft(e.target.value),
								onBlur: () => {
									renameChat(chat.id, titleDraft);
									setRenaming(false);
								},
								className: "field h-10 py-0",
								"aria-label": "Название чата"
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "block max-w-full truncate text-left text-sm font-medium",
							onClick: () => {
								if (!chat) return;
								setTitleDraft(chat.title);
								setRenaming(true);
							},
							children: chat?.title ?? "Lucent"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "truncate text-xs text-mist",
							children: [
								profile ? `${profile.name} · ${safeHost(profile.baseUrl)}` : "Подключение не выбрано",
								persona ? ` · ${persona.name}` : "",
								chat?.incognito ? " · не сохраняется" : ""
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn btn-ghost hidden max-w-48 truncate sm:inline-flex",
						onClick: () => patchUi({ chatParams: !chatParams }),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate",
							children: modelLabel
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn btn-icon btn-ghost sm:hidden",
						"aria-label": "Параметры чата",
						onClick: () => patchUi({ chatParams: !chatParams }),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn btn-icon btn-ghost",
							"aria-label": "Меню чата",
							"aria-expanded": menu,
							onClick: () => setMenu((v) => !v),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ellipsis, { className: "size-5" })
						}), menu && chat ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "glass absolute top-12 right-0 z-20 w-60 rounded-3xl p-1.5 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuButton, {
									label: "Переименовать",
									onClick: () => {
										setTitleDraft(chat.title);
										setRenaming(true);
										setMenu(false);
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuButton, {
									label: chat.pinned ? "Открепить" : "Закрепить",
									onClick: () => {
										togglePin(chat.id);
										setMenu(false);
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuButton, {
									label: "Инкогнито",
									onClick: () => {
										createChat(true);
										setMenu(false);
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuButton, {
									label: "Параметры чата",
									onClick: () => {
										patchUi({ chatParams: true });
										setMenu(false);
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuButton, {
									label: "Экспорт Markdown",
									onClick: () => {
										downloadText(`${chat.title}.md`, chatToMarkdown(chat), "text/markdown");
										setMenu(false);
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuButton, {
									label: "Дублировать",
									onClick: () => {
										duplicateChat(chat.id);
										setMenu(false);
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuButton, {
									label: "Очистить сообщения",
									onClick: () => {
										clearMessages(chat.id);
										setMenu(false);
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MenuButton, {
									label: "Удалить чат",
									onClick: () => {
										deleteChat(chat.id);
										setMenu(false);
									}
								})
							]
						}) : null]
					})
				]
			}),
			chatParams && chat ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatParams, {
				model: chat.model || profile?.model || "",
				models: profile?.models ?? [],
				personaId: chat.personaId,
				systemPrompt: chat.systemPrompt,
				personas,
				onModel: (model) => setChatFields(chat.id, { model }),
				onPersona: (personaId) => setChatFields(chat.id, { personaId }),
				onPrompt: (systemPrompt) => setChatFields(chat.id, { systemPrompt }),
				onClose: () => patchUi({ chatParams: false })
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: scrollerRef,
				className: "scroll-thin min-h-0 flex-1 overflow-y-auto",
				onScroll: (e) => {
					const el = e.currentTarget;
					stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-6",
					children: !chat || chat.messages.filter((m) => !m.hidden).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hero, { onPreset: (preset) => openProfileEditor({
						mode: "new",
						preset
					}) }) : chat.messages.filter((m) => !m.hidden).map((message) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageBubble, {
						message,
						streaming: streaming && message.id === chat.messages.at(-1)?.id,
						showTime: settings.showTimestamps,
						onEdit: () => {
							setDraft(message.content, message.images ?? []);
							patchUi({ editingId: message.id });
						}
					}, message.id))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "safe-bottom mx-auto w-full max-w-3xl px-3 md:px-6",
				children: [
					editingId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-center justify-between rounded-full border border-line bg-veil px-3 py-1.5 text-xs text-mist",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Редактирование сообщения" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn btn-ghost h-8 min-h-8 px-3 text-xs",
							onClick: () => {
								clearComposer();
								patchUi({ editingId: null });
							},
							children: "Отмена"
						})]
					}) : null,
					slash && commands.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "glass mb-2 rounded-3xl p-1.5",
						children: commands.map((command, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: cn("flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm", index === slashIndex ? "bg-fog/10" : ""),
							onMouseEnter: () => setSlashIndex(index),
							onClick: () => runCommand(index),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: command.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-mist",
								children: command.hint
							})]
						}, command.id))
					}) : null,
					attachments.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-2 flex flex-wrap gap-2",
						children: attachments.map((file) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "glass-quiet flex items-center gap-2 rounded-full py-1 pr-1 pl-3 text-xs",
							children: [file.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn btn-icon size-8 min-h-8",
								"aria-label": "Убрать вложение",
								onClick: () => removeAttachment(file.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
							})]
						}, file.id))
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-2 flex",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-pressed": settings.web,
							className: cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs", settings.web ? "bg-fog text-ink" : "glass-quiet text-mist"),
							onClick: () => updateSettings({ web: !settings.web }),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "size-3.5" }), settings.web ? "Интернет включён" : "Дать модели интернет"]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "glass mb-3 flex items-end gap-1 rounded-3xl p-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								ref: fileRef,
								type: "file",
								accept: "image/*",
								multiple: true,
								hidden: true,
								onChange: (e) => {
									if (e.target.files) addFiles(e.target.files);
									e.target.value = "";
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn btn-icon btn-ghost",
								"aria-label": "Прикрепить изображение",
								onClick: () => fileRef.current?.click(),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImagePlus, { className: "size-5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: cn("btn btn-icon btn-ghost", listening && "bg-fog text-ink"),
								"aria-label": listening ? "Остановить диктовку" : "Голосовой ввод",
								"aria-pressed": listening,
								onClick: toggleMic,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: draft,
								rows: 1,
								onChange: (e) => {
									setDraft(e.target.value);
									setSlashIndex(0);
									const el = e.target;
									el.style.height = "0px";
									el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
								},
								onKeyDown,
								placeholder: listening ? "Слушаю…" : "Сообщение. / — команды",
								className: "max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-fog outline-none placeholder:text-mist",
								"aria-label": "Сообщение"
							}),
							streaming ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn btn-icon btn-primary",
								"aria-label": "Остановить",
								onClick: stopStream,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-4" })
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn btn-icon btn-primary",
								"aria-label": "Отправить",
								disabled: !draft.trim() && attachments.length === 0,
								onClick: () => void sendDraft(),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-4" })
							})
						]
					})
				]
			})
		]
	});
}
function MenuButton({ label, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: "w-full rounded-2xl px-3 py-2 text-left hover:bg-veil",
		onClick,
		children: label
	});
}
function MessageBubble({ message, streaming, showTime, onEdit }) {
	const user = message.role === "user";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
		className: cn("msg rise", user ? "flex justify-end" : ""),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn(user ? "max-w-xl" : "w-full"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn(user ? "bubble-user px-4 py-3" : ""),
				children: [
					message.images?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("mb-2 flex flex-wrap gap-2", user ? "" : ""),
						children: message.images.map((img) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: img.dataUrl,
							alt: img.name,
							className: "max-h-48 rounded-2xl"
						}, img.id))
					}) : null,
					message.reasoning ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						className: "mb-2 rounded-2xl border border-line bg-veil px-3 py-2 text-sm text-mist",
						open: streaming,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
							className: "cursor-pointer",
							children: "Ход мысли"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 whitespace-pre-wrap",
							children: message.reasoning
						})]
					}) : null,
					message.activity ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-sm text-mist",
						children: message.activity
					}) : null,
					message.content ? user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "whitespace-pre-wrap",
						children: message.content
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarkdownView, { text: message.content }) : streaming && !message.activity ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "caret",
						"aria-hidden": "true"
					}) : null,
					message.sources?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-wrap gap-1.5",
						children: message.sources.map((source) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: source.url,
							target: "_blank",
							rel: "noreferrer",
							className: "glass-quiet max-w-full truncate rounded-full px-3 py-1 text-xs text-mist hover:text-fog",
							children: source.title || source.url
						}, source.url))
					}) : null,
					message.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: cn("mt-2 text-sm", user ? "text-ink-soft" : "text-mist"),
						children: message.error
					}) : null
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("msg-actions mt-2 flex flex-wrap items-center gap-1", user && "justify-end"),
				children: [
					showTime ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "px-1 text-xs text-mist tabular-nums",
						children: clock(message.createdAt)
					}) : null,
					message.usage ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "px-1 text-xs text-mist tabular-nums",
						children: [
							"↑",
							message.usage.prompt ?? "–",
							" ↓",
							message.usage.completion ?? "–"
						]
					}) : null,
					message.content ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconTip, {
						label: "Копировать",
						onClick: () => void copyText(message.content),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" })
					}) : null,
					user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconTip, {
						label: "Изменить",
						onClick: onEdit,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" })
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconTip, {
							label: "Ещё раз",
							onClick: () => void regenerate(),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-3.5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconTip, {
							label: "Продолжить",
							onClick: () => void continueReply(),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsRight, { className: "size-3.5" })
						}),
						message.content ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconTip, {
							label: "Озвучить",
							onClick: () => speak(message.content),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-3.5" })
						}) : null
					] })
				]
			})]
		})
	});
}
function IconTip({ label, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		className: "btn btn-ghost h-8 min-h-8 px-2 text-xs",
		"aria-label": label,
		onClick,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "sr-only",
			children: label
		})]
	});
}
function Hero({ onPreset }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rise flex min-h-[52vh] flex-col justify-end pb-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-[0.22em] text-mist uppercase",
				children: "OpenAI-compatible"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-3 max-w-xl text-4xl font-medium tracking-tight text-balance md:text-5xl",
				children: "Ваши модели. Один стеклянный клиент."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 max-w-lg text-mist",
				children: "Подключите OpenAI, Groq, OpenRouter, DeepSeek, xAI или любой endpoint с /v1. Ключ остаётся в этом браузере. Включите интернет — модель сможет искать и открывать страницы."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-6 grid gap-2 text-sm md:grid-cols-3",
				children: [
					"Добавьте подключение",
					"Выберите модель",
					"Пишите — ответ приходит потоком"
				].map((step, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "glass-quiet rounded-3xl px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-mist tabular-nums",
						children: ["0", i + 1]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1",
						children: step
					})]
				}, step))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "chip-row mt-5 pb-1",
				children: [
					["openai", "OpenAI"],
					["openrouter", "OpenRouter"],
					["groq", "Groq"],
					["deepseek", "DeepSeek"],
					["xai", "xAI"],
					["ollama", "Ollama"],
					["custom", "Свой API"]
				].map(([id, name]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "btn btn-ghost shrink-0",
					onClick: () => onPreset(id),
					children: name
				}, id))
			})
		]
	});
}
function ChatParams({ model, models, personaId, systemPrompt, personas, onModel, onPersona, onPrompt, onClose }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "border-b border-line px-4 py-3 md:px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto grid w-full max-w-3xl gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-medium",
						children: "Параметры чата"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn btn-icon btn-ghost",
						"aria-label": "Закрыть",
						onClick: onClose,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block text-xs text-mist",
					children: [
						"Модель",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "field mt-1",
							list: "lucent-models",
							value: model,
							onChange: (e) => onModel(e.target.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
							id: "lucent-models",
							children: models.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: item }, item))
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-1 text-xs text-mist",
					children: "Персона"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "chip-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: cn("btn btn-ghost shrink-0", !personaId && "bg-fog text-ink"),
						onClick: () => onPersona(null),
						children: "Без персоны"
					}), personas.map((persona) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: cn("btn btn-ghost shrink-0", personaId === persona.id && "bg-fog text-ink"),
						onClick: () => onPersona(persona.id),
						children: persona.name
					}, persona.id))]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block text-xs text-mist",
					children: ["Своя инструкция", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: "field mt-1 min-h-24 resize-y",
						value: systemPrompt,
						onChange: (e) => onPrompt(e.target.value),
						placeholder: "Добавляется к персоне и памяти"
					})]
				})
			]
		})
	});
}
function slashCommands(personas, query) {
	return [
		{
			id: "new",
			label: "/new",
			hint: "Новый чат",
			run: () => useLucent.getState().createChat(false)
		},
		{
			id: "ghost",
			label: "/incognito",
			hint: "Инкогнито",
			run: () => useLucent.getState().createChat(true)
		},
		{
			id: "pin",
			label: "/pin",
			hint: "Закрепить",
			run: () => {
				const id = useLucent.getState().activeChatId;
				if (id) useLucent.getState().togglePin(id);
			}
		},
		{
			id: "export",
			label: "/export",
			hint: "Markdown",
			run: () => {
				const chat = currentChat(useLucent.getState());
				if (chat) downloadText(`${chat.title}.md`, chatToMarkdown(chat), "text/markdown");
			}
		},
		...personas.map((persona) => ({
			id: persona.id,
			label: `/${persona.name}`,
			hint: "Персона",
			run: () => {
				const id = useLucent.getState().activeChatId;
				if (!id) {
					const created = useLucent.getState().createChat(false);
					useLucent.getState().setChatFields(created, { personaId: persona.id });
					return;
				}
				useLucent.getState().setChatFields(id, { personaId: persona.id });
			}
		}))
	].filter((item) => item.label.toLowerCase().includes(query) || item.hint.toLowerCase().includes(query)).slice(0, 8);
}
function Mark({ className = "size-9" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 64 64",
		className,
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
			cx: "32",
			cy: "32",
			r: "22",
			fill: "none",
			stroke: "white",
			strokeOpacity: "0.88",
			strokeWidth: "2.4"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "30.2",
			y: "20",
			width: "3.6",
			height: "24",
			rx: "1.8",
			fill: "white"
		})]
	});
}
var TABS = [
	{
		id: "links",
		label: "Подключения"
	},
	{
		id: "personas",
		label: "Персоны"
	},
	{
		id: "params",
		label: "Параметры"
	},
	{
		id: "data",
		label: "Данные"
	}
];
function SettingsView() {
	const tab = useLucent((s) => s.ui.tab);
	const patchUi = useLucent((s) => s.patchUi);
	const closeSettings = useLucent((s) => s.closeSettings);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-40 flex items-end justify-center bg-ink/60 p-0 md:items-center md:p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "absolute inset-0",
			"aria-label": "Закрыть настройки",
			onClick: closeSettings
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "settings-title",
			className: "glass relative flex h-full w-full max-w-3xl flex-col overflow-hidden md:rounded-3xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "settings-title",
						className: "text-lg font-medium",
						children: "Настройки"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-mist",
						children: "Ключи хранятся только на этом устройстве"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn btn-icon btn-ghost",
						"aria-label": "Закрыть",
						onClick: closeSettings,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "chip-row border-b border-line px-4 py-3 md:px-5",
					children: TABS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: cn("btn shrink-0", tab === item.id ? "btn-primary" : "btn-ghost"),
						onClick: () => patchUi({
							tab: item.id,
							profileEdit: tab === item.id ? useLucent.getState().ui.profileEdit : null
						}),
						children: item.label
					}, item.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5",
					children: [
						tab === "links" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LinksTab, {}) : null,
						tab === "personas" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonasTab, {}) : null,
						tab === "params" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ParamsTab, {}) : null,
						tab === "data" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataTab, {}) : null
					]
				})
			]
		})]
	});
}
function LinksTab() {
	const profiles = useLucent((s) => s.profiles);
	const activeId = useLucent((s) => s.settings.activeProfileId);
	const edit = useLucent((s) => s.ui.profileEdit);
	const setActive = useLucent((s) => s.setActiveProfile);
	const deleteProfile = useLucent((s) => s.deleteProfile);
	const openProfileEditor = useLucent((s) => s.openProfileEditor);
	const [confirmId, setConfirmId] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-mist",
				children: [
					"Любой сервер с маршрутами ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-fog",
						children: "/v1/chat/completions"
					}),
					" и",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-fog",
						children: "/v1/models"
					}),
					". Браузер проксирует только публичные адреса. Ollama и LM Studio на localhost работают в Android-сборке."
				]
			}),
			edit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileForm, {}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2",
				children: [profiles.map((profile) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "glass-quiet flex flex-wrap items-center gap-3 rounded-3xl px-3 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "min-w-0 flex-1 text-left",
							onClick: () => setActive(profile.id),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", activeId === profile.id ? "bg-fog" : "bg-fog/20") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate font-medium",
									children: profile.name
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "truncate text-xs text-mist",
								children: [
									safeHost(profile.baseUrl),
									" · ",
									profile.model || "модель не задана"
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn btn-ghost",
							onClick: () => openProfileEditor({
								mode: "edit",
								id: profile.id
							}),
							children: "Изменить"
						}),
						confirmId === profile.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn btn-primary",
							onClick: () => {
								deleteProfile(profile.id);
								setConfirmId(null);
							},
							children: "Удалить"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn btn-icon btn-ghost",
							"aria-label": "Удалить подключение",
							onClick: () => setConfirmId(profile.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
						})
					]
				}, profile.id)), profiles.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-mist",
					children: "Подключений ещё нет."
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mb-2 text-xs tracking-wide text-mist uppercase",
				children: "Добавить"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-2 md:grid-cols-3",
				children: PRESETS.map((preset) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "glass-quiet rounded-3xl px-3 py-3 text-left",
					onClick: () => openProfileEditor({
						mode: "new",
						preset: preset.id
					}),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm font-medium",
						children: preset.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 text-xs text-mist",
						children: preset.blurb
					})]
				}, preset.id))
			})] })
		]
	});
}
function ProfileForm() {
	const edit = useLucent((s) => s.ui.profileEdit);
	const profiles = useLucent((s) => s.profiles);
	const saveProfile = useLucent((s) => s.saveProfile);
	const patchUi = useLucent((s) => s.patchUi);
	const existing = edit?.mode === "edit" ? profiles.find((p) => p.id === edit.id) : null;
	const [form, setForm] = (0, import_react.useState)(() => existing ?? blankProfile(edit?.mode === "new" ? edit.preset : "custom"));
	const [showKey, setShowKey] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!edit) return;
		if (edit.mode === "edit") {
			const found = useLucent.getState().profiles.find((p) => p.id === edit.id);
			if (found) setForm(found);
		} else setForm(blankProfile(edit.preset));
	}, [edit]);
	if (!edit) return null;
	function applyPreset(id) {
		const preset = presetById(id);
		setForm((prev) => ({
			...prev,
			preset: preset.id,
			name: prev.name && prev.name !== presetById(prev.preset).name ? prev.name : preset.name,
			baseUrl: preset.baseUrl,
			model: preset.model,
			models: preset.model ? [preset.model] : prev.models
		}));
	}
	function save() {
		let baseUrl = form.baseUrl;
		try {
			baseUrl = normalizeRoot(form.baseUrl);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Некорректный URL");
			return;
		}
		if (!form.model.trim()) {
			toast.error("Укажите модель — её можно сменить после загрузки списка");
			return;
		}
		saveProfile({
			...form,
			baseUrl,
			name: form.name.trim() || "Подключение",
			model: form.model.trim()
		}, true);
		if (isBlockedEndpoint(baseUrl)) toast.success("Сохранено. Этот адрес откроется в Android-сборке, не в браузере.");
		else toast.success("Подключение сохранено");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "glass-quiet grid gap-3 rounded-3xl p-3",
		onSubmit: (e) => {
			e.preventDefault();
			save();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-sm font-medium",
					children: edit.mode === "edit" ? "Редактирование" : "Новое подключение"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs text-mist",
					onClick: () => patchUi({ profileEdit: null }),
					children: "Закрыть"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-xs text-mist",
				children: ["Пресет", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
					className: "field mt-1",
					value: form.preset,
					onChange: (e) => applyPreset(e.target.value),
					children: PRESETS.map((preset) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: preset.id,
						children: preset.name
					}, preset.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-xs text-mist",
				children: ["Название", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "field mt-1",
					value: form.name,
					onChange: (e) => setForm({
						...form,
						name: e.target.value
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-xs text-mist",
				children: ["Базовый URL", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "field mt-1 font-mono text-sm",
					value: form.baseUrl,
					onChange: (e) => setForm({
						...form,
						baseUrl: e.target.value
					}),
					placeholder: "https://api.example.com/v1",
					spellCheck: false
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-xs text-mist",
				children: ["API-ключ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "mt-1 flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "field font-mono text-sm",
						type: showKey ? "text" : "password",
						value: form.apiKey,
						autoComplete: "off",
						spellCheck: false,
						onChange: (e) => setForm({
							...form,
							apiKey: e.target.value
						}),
						placeholder: presetById(form.preset).needsKey ? "sk-…" : "можно оставить пустым"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn btn-icon btn-ghost",
						"aria-label": showKey ? "Скрыть ключ" : "Показать ключ",
						onClick: () => setShowKey((v) => !v),
						children: showKey ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-4" })
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-xs text-mist",
				children: [
					"Модель",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "field mt-1 font-mono text-sm",
						list: "profile-models",
						value: form.model,
						onChange: (e) => setForm({
							...form,
							model: e.target.value
						}),
						placeholder: "gpt-4o-mini"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
						id: "profile-models",
						children: form.models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: model }, model))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "btn btn-primary",
					children: "Сохранить"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "btn btn-ghost",
					disabled: busy,
					onClick: () => {
						setBusy(true);
						const draft = { ...form };
						try {
							draft.baseUrl = normalizeRoot(form.baseUrl);
						} catch (error) {
							toast.error(error instanceof Error ? error.message : "Некорректный URL");
							setBusy(false);
							return;
						}
						loadModels(draft).then((ids) => {
							if (!ids.length) return;
							setForm((prev) => ({
								...prev,
								baseUrl: draft.baseUrl,
								models: ids,
								model: ids.includes(prev.model) ? prev.model : ids[0] ?? prev.model
							}));
						}).finally(() => setBusy(false));
					},
					children: busy ? "Запрос…" : "Загрузить модели"
				})]
			})
		]
	});
}
function PersonasTab() {
	const personas = useLucent((s) => s.personas);
	const savePersona = useLucent((s) => s.savePersona);
	const deletePersona = useLucent((s) => s.deletePersona);
	const resetPersonas = useLucent((s) => s.resetPersonas);
	const [editing, setEditing] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "btn btn-primary",
					onClick: () => setEditing({
						id: uid(),
						name: "",
						prompt: "",
						builtIn: false
					}),
					children: "Новая персона"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "btn btn-ghost",
					onClick: resetPersonas,
					children: "Вернуть стандартные"
				})]
			}),
			editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "glass-quiet grid gap-2 rounded-3xl p-3",
				onSubmit: (e) => {
					e.preventDefault();
					if (!editing.name.trim()) {
						toast.error("Нужно имя");
						return;
					}
					savePersona({
						...editing,
						name: editing.name.trim()
					});
					setEditing(null);
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "field",
						value: editing.name,
						placeholder: "Имя",
						onChange: (e) => setEditing({
							...editing,
							name: e.target.value
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: "field min-h-28 resize-y",
						value: editing.prompt,
						placeholder: "Системная инструкция",
						onChange: (e) => setEditing({
							...editing,
							prompt: e.target.value
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							className: "btn btn-primary",
							children: "Сохранить"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn btn-ghost",
							onClick: () => setEditing(null),
							children: "Отмена"
						})]
					})
				]
			}) : null,
			personas.map((persona) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
				className: "glass-quiet rounded-3xl px-3 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-medium",
						children: persona.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 line-clamp-2 text-sm text-mist",
						children: persona.prompt
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn btn-ghost",
							onClick: () => setEditing(persona),
							children: "Править"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn btn-icon btn-ghost",
							"aria-label": "Удалить персону",
							onClick: () => deletePersona(persona.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
						})]
					})]
				})
			}, persona.id))
		]
	});
}
function ParamsTab() {
	const settings = useLucent((s) => s.settings);
	const update = useLucent((s) => s.updateSettings);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
				label: "Температура",
				min: 0,
				max: 2,
				step: .1,
				value: settings.temperature,
				onChange: (temperature) => update({ temperature })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
				label: "Top P",
				min: 0,
				max: 1,
				step: .05,
				value: settings.topP,
				onChange: (topP) => update({ topP })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
				label: "Макс. токенов",
				hint: "0 — не отправлять лимит",
				min: 0,
				max: 8192,
				step: 128,
				value: settings.maxTokens,
				onChange: (maxTokens) => update({ maxTokens })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
				label: "Presence penalty",
				min: -2,
				max: 2,
				step: .1,
				value: settings.presencePenalty,
				onChange: (presencePenalty) => update({ presencePenalty })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
				label: "Frequency penalty",
				min: -2,
				max: 2,
				step: .1,
				value: settings.frequencyPenalty,
				onChange: (frequencyPenalty) => update({ frequencyPenalty })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-xs text-mist",
				children: ["Память", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					className: "field mt-1 min-h-24 resize-y",
					value: settings.memory,
					placeholder: "Например: отвечай на русском, я фронтенд-разработчик",
					onChange: (e) => update({ memory: e.target.value })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
						label: "Потоковый ответ",
						checked: settings.stream,
						onChange: (stream) => update({ stream })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
						label: "Интернет для модели",
						hint: "Модель может искать в сети и открывать публичные страницы. Локальные адреса закрыты.",
						checked: settings.web,
						onChange: (web) => update({ web })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
						label: "Минимальный запрос",
						hint: "Только модель и сообщения — для строгих API",
						checked: settings.minimal,
						onChange: (minimal) => update({ minimal })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
						label: "Enter отправляет",
						checked: settings.enterToSend,
						onChange: (enterToSend) => update({ enterToSend })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
						label: "Время сообщений",
						checked: settings.showTimestamps,
						onChange: (showTimestamps) => update({ showTimestamps })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-2 text-xs text-mist",
				children: "Размер текста"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex gap-2",
				children: [
					"sm",
					"md",
					"lg"
				].map((scale) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cn("btn", settings.fontScale === scale ? "btn-primary" : "btn-ghost"),
					onClick: () => update({ fontScale: scale }),
					children: scale === "sm" ? "S" : scale === "md" ? "M" : "L"
				}, scale))
			})] })
		]
	});
}
function Slider({ label, hint, min, max, step, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-baseline justify-between gap-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular-nums text-mist",
					children: Number(value.toFixed(2))
				})]
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-mist",
				children: hint
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "mt-3",
				type: "range",
				min,
				max,
				step,
				value,
				onChange: (e) => onChange(Number(e.target.value))
			})
		]
	});
}
function Toggle({ label, hint, checked, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		role: "switch",
		"aria-checked": checked,
		className: "glass-quiet flex items-center justify-between gap-3 rounded-3xl px-3 py-3 text-left",
		onClick: () => onChange(!checked),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-sm",
			children: label
		}), hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-xs text-mist",
			children: hint
		}) : null] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("grid h-7 w-12 place-items-center rounded-full border border-line", checked ? "bg-fog" : "bg-transparent"),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-5 rounded-full", checked ? "translate-x-2 bg-ink" : "-translate-x-2 bg-fog") })
		})]
	});
}
function DataTab() {
	const wipe = useLucent((s) => s.wipe);
	const [confirm, setConfirm] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-mist",
				children: "Экспорт включает чаты, персоны и API-ключи. Файл никуда не отправляется, пока вы сами его не передадите."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "btn btn-primary",
					onClick: exportBackup,
					children: "Экспорт JSON"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "btn btn-ghost",
					children: ["Импорт", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "file",
						accept: "application/json",
						hidden: true,
						onChange: (e) => {
							const file = e.target.files?.[0];
							if (!file) return;
							file.text().then(importBackup);
							e.target.value = "";
						}
					})]
				})]
			}),
			confirm ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "btn btn-primary w-fit",
				onClick: () => {
					wipe();
					setConfirm(false);
					toast.success("Данные стерты");
				},
				children: "Точно стереть всё"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "btn btn-ghost w-fit",
				onClick: () => setConfirm(true),
				children: "Стереть локальные данные"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass-quiet rounded-3xl p-4 leading-relaxed",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-medium",
					children: "Android APK"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-mist",
					children: "В проекте есть нативное приложение на Kotlin и workflow GitHub Actions «Build Android APK». После пуша в main откройте вкладку Actions и скачайте артефакт lucent.apk. Сборка подписана отладочным ключом — её можно поставить на телефон. Запросы идут напрямую, поэтому Ollama в локальной сети работает без прокси браузера."
				})]
			})
		]
	});
}
function bucket(ts) {
	if (isToday(ts)) return "Сегодня";
	if (isYesterday(ts)) return "Вчера";
	return "Ранее";
}
function Sidebar() {
	const chats = useLucent((s) => s.chats);
	const activeId = useLucent((s) => s.activeChatId);
	const search = useLucent((s) => s.ui.search);
	const focusSearch = useLucent((s) => s.ui.focusSearch);
	const profile = useLucent((s) => resolveProfile(s));
	const patchUi = useLucent((s) => s.patchUi);
	const createChat = useLucent((s) => s.createChat);
	const selectChat = useLucent((s) => s.selectChat);
	const deleteChat = useLucent((s) => s.deleteChat);
	const togglePin = useLucent((s) => s.togglePin);
	const openSettings = useLucent((s) => s.openSettings);
	const searchRef = (0, import_react.useRef)(null);
	const [confirmId, setConfirmId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (focusSearch) searchRef.current?.focus();
	}, [focusSearch]);
	const q = search.trim().toLowerCase();
	const filtered = chats.filter((chat) => {
		if (!q) return true;
		if (chat.title.toLowerCase().includes(q)) return true;
		return chat.messages.some((m) => m.content.toLowerCase().includes(q));
	});
	const pinned = filtered.filter((c) => c.pinned);
	const rest = filtered.filter((c) => !c.pinned);
	const groups = [];
	if (pinned.length) groups.push({
		label: "Закреплённые",
		items: pinned
	});
	for (const label of [
		"Сегодня",
		"Вчера",
		"Ранее"
	]) {
		const items = rest.filter((c) => bucket(c.updatedAt) === label);
		if (items.length) groups.push({
			label,
			items
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3 px-4 pt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-lg font-medium tracking-tight",
						children: "Lucent"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs tracking-widest text-mist uppercase",
						children: "Open models"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3 pt-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "btn btn-primary w-full",
					onClick: () => createChat(false),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Новый чат"]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3 pt-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "glass-quiet flex items-center gap-2 rounded-full px-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4 shrink-0 text-mist" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: searchRef,
						value: search,
						onChange: (e) => patchUi({ search: e.target.value }),
						placeholder: "Поиск",
						className: "h-11 w-full bg-transparent text-sm outline-none placeholder:text-mist",
						"aria-label": "Поиск чатов"
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3",
				children: groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-3 py-6 text-sm text-mist",
					children: q ? "Ничего не найдено" : "Чатов пока нет"
				}) : groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "px-3 py-1 text-xs tracking-wide text-mist uppercase",
						children: group.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: group.items.map((chat) => {
						const active = chat.id === activeId;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "group relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => selectChat(chat.id),
								className: cn("w-full rounded-2xl px-3 py-2.5 text-left", active ? "bg-fog/10" : "hover:bg-veil"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 pr-14",
									children: [chat.pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, { className: "size-3.5 shrink-0 text-mist" }) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate text-sm",
										children: chat.title
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-0.5 text-xs text-mist",
									children: [chat.incognito ? "не сохраняется · " : "", format(chat.updatedAt, "HH:mm")]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute top-1.5 right-1.5 flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn btn-icon btn-ghost size-9 min-h-9 border-0 bg-transparent",
									"aria-label": chat.pinned ? "Открепить" : "Закрепить",
									onClick: () => togglePin(chat.id),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, { className: "size-3.5" })
								}), confirmId === chat.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn btn-ghost h-9 min-h-9 px-2 text-xs",
									onClick: () => {
										deleteChat(chat.id);
										setConfirmId(null);
									},
									children: "Да"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn btn-icon btn-ghost size-9 min-h-9 border-0 bg-transparent",
									"aria-label": "Удалить чат",
									onClick: () => setConfirmId(chat.id),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
								})]
							})]
						}, chat.id);
					}) })]
				}, group.label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-t border-line p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "glass-quiet flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left",
					onClick: () => openSettings("links"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "grid size-10 place-items-center rounded-full bg-fog/10",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SquarePen, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate text-sm",
								children: profile ? profile.name : "Нет подключения"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate text-xs text-mist",
								children: profile ? profile.model || safeHost(profile.baseUrl) : "Добавить API"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-4 text-mist" })
					]
				})
			})
		]
	});
}
function LucentApp() {
	const hydrated = useLucent((s) => s.hydrated);
	const hydrate = useLucent((s) => s.hydrate);
	const sidebar = useLucent((s) => s.ui.sidebar);
	const settings = useLucent((s) => s.ui.settings);
	const fontScale = useLucent((s) => s.settings.fontScale);
	const patchUi = useLucent((s) => s.patchUi);
	const createChat = useLucent((s) => s.createChat);
	const closeSettings = useLucent((s) => s.closeSettings);
	(0, import_react.useEffect)(() => {
		hydrate();
	}, [hydrate]);
	(0, import_react.useEffect)(() => {
		function onKey(event) {
			const meta = event.metaKey || event.ctrlKey;
			if (meta && event.key.toLowerCase() === "n") {
				event.preventDefault();
				createChat(false);
			}
			if (meta && event.key.toLowerCase() === "k") {
				event.preventDefault();
				patchUi({
					sidebar: true,
					focusSearch: Date.now()
				});
			}
			if (event.key === "Escape") {
				if (useLucent.getState().ui.settings) closeSettings();
				else patchUi({
					sidebar: false,
					chatParams: false
				});
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		closeSettings,
		createChat,
		patchUi
	]);
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "atmosphere grid h-dvh place-items-center text-fog",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "grain" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex flex-col items-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, { className: "size-14" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-2xl font-medium tracking-tight",
				children: "Lucent"
			})]
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "atmosphere app-root relative h-dvh overflow-hidden text-fog",
		"data-scale": fontScale,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "grain" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative flex h-full gap-2 p-2 md:gap-3 md:p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
						className: cn("glass fixed inset-y-0 left-0 z-30 flex w-80 max-w-full flex-col overflow-hidden rounded-none transition-transform md:static md:inset-auto md:z-auto md:rounded-3xl", sidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sidebar, {})
					}),
					sidebar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "fixed inset-0 z-20 bg-ink/50 md:hidden",
						"aria-label": "Закрыть список чатов",
						onClick: () => patchUi({ sidebar: false })
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatView, {})
					})
				]
			}),
			settings ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsView, {}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				theme: "dark",
				position: "top-center",
				toastOptions: { className: "toast-glass" }
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LucentApp, {});
}
//#endregion
export { Home as component };
