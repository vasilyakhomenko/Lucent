import { i as __toESM } from "../_runtime.mjs";
import { _ as lazyRouteComponent, b as useRouter, f as Scripts, g as Outlet, h as createRouter, p as HeadContent, q as require_react, v as createFileRoute, x as require_jsx_runtime, y as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-WuE0Cq-_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* Path-based preview hosts serve the dev server under `/{port_id}/` and strip
* that prefix before forwarding, so SSR sees `/` while the browser URL keeps the
* prefix. TanStack Start resets `basepath` on hydration, so a `rewrite` keeps
* client routing and generated links aligned with the public URL.
*/
var PATH_BASED_PREVIEW_HOSTS = /* @__PURE__ */ new Set([
	"preview.grok.genai.mil",
	"preview.grok.mil",
	"preview.grokgsac.com"
]);
var PORT_ID_PREFIX = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i;
function previewPathPrefix(hostname, pathname) {
	if (!PATH_BASED_PREVIEW_HOSTS.has(hostname.toLowerCase())) return void 0;
	return PORT_ID_PREFIX.exec(pathname)?.[0];
}
function prefixRewrite(prefix) {
	return {
		input: ({ url }) => {
			if (url.pathname === prefix) url.pathname = "/";
			else if (url.pathname.startsWith(`${prefix}/`)) url.pathname = url.pathname.slice(prefix.length);
			return url;
		},
		output: ({ url }) => {
			url.pathname = `${prefix}${url.pathname}`;
			return url;
		}
	};
}
function previewPathRewrite() {
	if (typeof window === "undefined") return void 0;
	const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
	return prefix ? prefixRewrite(prefix) : void 0;
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-D9DHDtzS.css";
var Route$4 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			},
			{ title: "Lucent" },
			{
				name: "description",
				content: "Монохромный клиент для OpenAI-совместимых моделей: чаты, персоны, стриминг и свои API."
			},
			{
				name: "theme-color",
				content: "#070708"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "ru",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "bg-ink text-fog",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	})
});
var $$splitComponentImporter = () => import("./routes-BB1_qLcc.mjs");
var Route$3 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
/** Shared OpenAI-compatible base URL helpers. No Node APIs — safe on client and server. */
function normalizeRoot(input) {
	let raw = input.trim();
	if (!raw) throw new Error("Укажите базовый URL");
	if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new Error("Некорректный URL");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Допустимы только http и https");
	let path = url.pathname.replace(/\/+$/, "");
	path = path.replace(/\/(chat\/completions|completions|models)$/, "");
	if (path === "" || path === "/") path = "/v1";
	url.pathname = path;
	url.search = "";
	url.hash = "";
	return url.toString().replace(/\/+$/, "");
}
function endpoint(root, leaf) {
	return `${root}/${leaf}`;
}
function hostnameOf(input) {
	return new URL(normalizeRoot(input)).hostname;
}
function isBlockedHostname(hostname) {
	const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "metadata.google.internal" || h === "metadata.internal" || h === "::1" || h === "0.0.0.0") return true;
	if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) return true;
	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
	if (!m) return false;
	const n = m.slice(1).map(Number);
	if (n.some((x) => x > 255)) return true;
	const a = n[0] ?? 0;
	const b = n[1] ?? 0;
	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 192 && b === 168) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	return false;
}
/** Web proxy refuses private hosts. The Android app calls them directly. */
function isBlockedEndpoint(input) {
	try {
		return isBlockedHostname(hostnameOf(input));
	} catch {
		return false;
	}
}
function safeHost(input) {
	try {
		return new URL(normalizeRoot(input)).host;
	} catch {
		return input.trim() || "—";
	}
}
var MAX_BODY = 75e5;
function jsonError(message, status = 400) {
	return Response.json({ error: { message } }, { status });
}
function originAllowed$1(request) {
	const origin = request.headers.get("origin");
	if (!origin) return true;
	let originHost = "";
	try {
		originHost = new URL(origin).host;
	} catch {
		return false;
	}
	const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")].filter((h) => !!h);
	if (hosts.length === 0) return true;
	return hosts.some((h) => h === originHost);
}
async function proxyOpenAI(request, leaf) {
	if (!originAllowed$1(request)) return jsonError("Запрос отклонён", 403);
	let raw = "";
	try {
		raw = await request.text();
	} catch {
		return jsonError("Не удалось прочитать запрос");
	}
	if (raw.length > MAX_BODY) return jsonError("Слишком большой запрос", 413);
	let body;
	try {
		body = JSON.parse(raw);
	} catch {
		return jsonError("Ожидался JSON");
	}
	if (!body || typeof body !== "object") return jsonError("Ожидался объект");
	const record = body;
	const baseUrl = record.baseUrl;
	const apiKey = record.apiKey;
	if (typeof baseUrl !== "string") return jsonError("Нужен baseUrl");
	if (apiKey != null && typeof apiKey !== "string") return jsonError("Некорректный ключ");
	if (typeof apiKey === "string" && apiKey.length > 8e3) return jsonError("Ключ слишком длинный");
	let root = "";
	try {
		root = normalizeRoot(baseUrl);
	} catch (error) {
		return jsonError(error instanceof Error ? error.message : "Некорректный URL");
	}
	let host = "";
	try {
		host = new URL(root).hostname;
	} catch {
		return jsonError("Некорректный URL");
	}
	if (isBlockedHostname(host)) return jsonError("Веб-версия ходит только в публичные API. Локальные Ollama и LM Studio открывайте в Android-сборке — там запрос идёт с телефона.", 400);
	const headers = { Accept: "application/json" };
	const key = typeof apiKey === "string" ? apiKey.trim() : "";
	if (key) headers.Authorization = `Bearer ${key}`;
	if (host.endsWith("openrouter.ai")) {
		headers["HTTP-Referer"] = "https://lucent.app";
		headers["X-Title"] = "Lucent";
	}
	const signals = [AbortSignal.timeout(12e4)];
	if (request.signal) signals.push(request.signal);
	const signal = AbortSignal.any(signals);
	if (leaf === "models") try {
		const upstream = await fetch(endpoint(root, "models"), {
			method: "GET",
			headers,
			signal
		});
		const text = await upstream.text();
		return new Response(text, {
			status: upstream.status,
			headers: {
				"Content-Type": upstream.headers.get("content-type") || "application/json",
				"Cache-Control": "no-store"
			}
		});
	} catch (error) {
		return connectionError(error);
	}
	const payload = record.payload;
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) return jsonError("Нужен payload");
	const stream = record.stream === true;
	const outbound = {
		...payload,
		stream
	};
	headers["Content-Type"] = "application/json";
	headers.Accept = stream ? "text/event-stream" : "application/json";
	let upstream;
	try {
		upstream = await fetch(endpoint(root, "chat/completions"), {
			method: "POST",
			headers,
			body: JSON.stringify(outbound),
			signal
		});
	} catch (error) {
		return connectionError(error);
	}
	if (!upstream.ok || !stream) {
		const text = await upstream.text();
		return new Response(text, {
			status: upstream.status,
			headers: {
				"Content-Type": upstream.headers.get("content-type") || "application/json",
				"Cache-Control": "no-store"
			}
		});
	}
	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			"Content-Type": upstream.headers.get("content-type") || "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			"X-Accel-Buffering": "no"
		}
	});
}
function connectionError(error) {
	const name = error instanceof Error ? error.name : "";
	if (name === "TimeoutError" || name === "AbortError") return jsonError("Сервер модели не ответил вовремя", 504);
	return jsonError("Нет соединения с API. Проверьте адрес и ключ.", 502);
}
var Route$2 = createFileRoute("/api/v1/chat")({ server: { handlers: { POST: async ({ request }) => proxyOpenAI(request, "chat/completions") } } });
var Route$1 = createFileRoute("/api/v1/models")({ server: { handlers: { POST: async ({ request }) => proxyOpenAI(request, "models") } } });
var UA = "Lucent/1.0 (research; +https://lucent.app)";
var PAGE_CAP = 7e5;
var TEXT_CAP = 7e3;
var SEARCH_CAP = 6;
function json(body, status = 200) {
	return Response.json(body, {
		status,
		headers: { "Cache-Control": "no-store" }
	});
}
function originAllowed(request) {
	const origin = request.headers.get("origin");
	if (!origin) return true;
	let originHost = "";
	try {
		originHost = new URL(origin).host;
	} catch {
		return false;
	}
	const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")].filter((h) => !!h);
	if (hosts.length === 0) return true;
	return hosts.some((h) => h === originHost);
}
function decodeXml(value) {
	let current = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
	for (let pass = 0; pass < 3; pass += 1) {
		const next = current.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16))).replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num))).replace(/"/g, "\"").replace(/'|&#39;/g, "'").replace(/</g, "<").replace(/>/g, ">").replace(/&nbsp;/g, " ").replace(/&/g, "&");
		if (next === current) break;
		current = next;
	}
	return current;
}
function htmlToText(html) {
	return decodeXml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}
function tag(block, name) {
	const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
	return match?.[1] ? decodeXml(match[1]).trim() : "";
}
function parseRss(xml) {
	const sources = [];
	for (const block of xml.split(/<item\b/i).slice(1)) {
		const title = htmlToText(tag(block, "title")).slice(0, 180);
		const url = tag(block, "link").replace(/\s+/g, "");
		const snippet = htmlToText(tag(block, "description")).slice(0, 320);
		if (!title || !/^https?:\/\//i.test(url)) continue;
		sources.push({
			title,
			url,
			snippet
		});
		if (sources.length >= SEARCH_CAP) break;
	}
	return sources;
}
function isIp(hostname) {
	return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
}
function isPrivateAddress(address) {
	let ip = address.toLowerCase().replace(/^\[|\]$/g, "");
	if (ip.startsWith("::ffff:")) ip = ip.slice(7);
	if (ip.includes(":")) return ip === "::" || ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd");
	return isBlockedHostname(ip);
}
function unsafeHostname(hostname) {
	const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
	if (!host) return true;
	if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal" || host === "0.0.0.0" || host === "::1") return true;
	return isIp(host) && isPrivateAddress(host);
}
async function assertPublic(url) {
	if (url.username || url.password) throw new Error("Ссылка с паролем запрещена");
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Только http и https");
	if (unsafeHostname(url.hostname)) throw new Error("Локальные и служебные адреса закрыты");
	const { lookup } = await import("node:dns/promises");
	let records = [];
	try {
		records = await lookup(url.hostname, {
			all: true,
			verbatim: true
		});
	} catch {
		throw new Error("Адрес не найден");
	}
	if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) throw new Error("Этот адрес недоступен");
}
async function fetchPublic(start, signal) {
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
				"User-Agent": UA
			}
		});
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			await response.body?.cancel().catch(() => void 0);
			if (!location) throw new Error("Редирект без адреса");
			current = new URL(location, current);
			continue;
		}
		return {
			url: current,
			response
		};
	}
	throw new Error("Слишком много редиректов");
}
async function readBody(response) {
	const type = (response.headers.get("content-type") || "").toLowerCase();
	if (type && !/text\/|json|xml|javascript|svg/.test(type)) {
		await response.body?.cancel().catch(() => void 0);
		throw new Error("Страница не текстовая");
	}
	const reader = response.body?.getReader();
	if (!reader) return "";
	const chunks = [];
	let total = 0;
	while (total < PAGE_CAP) {
		const { done, value } = await reader.read();
		if (done || !value) break;
		chunks.push(value);
		total += value.byteLength;
	}
	await reader.cancel().catch(() => void 0);
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
function wikiSources(json) {
	if (!json || typeof json !== "object") return [];
	const pages = json.query?.pages;
	if (!pages) return [];
	return Object.values(pages).map((page) => ({
		index: typeof page.index === "number" ? page.index : 99,
		title: typeof page.title === "string" ? page.title : "",
		url: typeof page.fullurl === "string" ? page.fullurl : "",
		snippet: typeof page.extract === "string" ? page.extract.replace(/\s+/g, " ").trim().slice(0, 320) : ""
	})).filter((page) => page.title && /^https?:\/\//i.test(page.url)).sort((a, b) => a.index - b.index).slice(0, 3).map(({ title, url, snippet }) => ({
		title,
		url,
		snippet
	}));
}
async function wiki(query, lang, signal) {
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
	const response = await fetch(url, {
		signal,
		headers: {
			Accept: "application/json",
			"User-Agent": UA
		}
	});
	if (!response.ok) return [];
	return wikiSources(await response.json());
}
async function bing(query, signal) {
	const url = new URL("https://www.bing.com/search");
	url.searchParams.set("q", query);
	url.searchParams.set("format", "rss");
	url.searchParams.set("count", "6");
	const response = await fetch(url, {
		signal,
		headers: {
			Accept: "application/rss+xml, application/xml, text/xml",
			"User-Agent": UA
		}
	});
	if (!response.ok) return [];
	return parseRss(await response.text());
}
function dedupe(sources) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
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
function formatSources(query, sources) {
	if (!sources.length) return `По запросу «${query}» ничего не нашлось.`;
	return `Результаты поиска «${query}»:\n\n${sources.map((source, index) => {
		const snippet = source.snippet ? `\n${source.snippet}` : "";
		return `[${index + 1}] ${source.title}\n${source.url}${snippet}`;
	}).join("\n\n")}`;
}
async function search(query, signal) {
	const clean = query.replace(/\s+/g, " ").trim().slice(0, 240);
	if (clean.length < 2) return {
		text: "Слишком короткий запрос.",
		sources: []
	};
	const langs = /[а-яё]/i.test(clean) ? ["ru", "en"] : ["en", "ru"];
	const sources = dedupe((await Promise.all([bing(clean, signal).catch(() => []), ...langs.map((lang) => wiki(clean, lang, signal).catch(() => []))])).flat());
	return {
		text: formatSources(clean, sources),
		sources
	};
}
async function readPage(raw, signal) {
	let url;
	try {
		url = new URL(raw.trim());
	} catch {
		return {
			text: "Некорректный URL.",
			sources: []
		};
	}
	try {
		const { url: finalUrl, response } = await fetchPublic(url, signal);
		const body = await readBody(response);
		const title = htmlToText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] || finalUrl.hostname).slice(0, 180);
		const text = htmlToText(body).slice(0, TEXT_CAP);
		if (!response.ok && !text) return {
			text: `Страница ответила ${response.status}.`,
			sources: []
		};
		const source = {
			title: title || finalUrl.hostname,
			url: finalUrl.toString(),
			snippet: text.slice(0, 220)
		};
		return {
			text: `${response.ok ? "" : `HTTP ${response.status}\n`}${source.title}\n${source.url}\n\n${text || "На странице нет текста."}`,
			sources: [source]
		};
	} catch (error) {
		return {
			text: error instanceof Error ? error.message : "Не удалось открыть страницу",
			sources: []
		};
	}
}
async function handleWeb(request) {
	if (!originAllowed(request)) return json({ error: { message: "Запрос отклонён" } }, 403);
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: { message: "Ожидался JSON" } }, 400);
	}
	if (!body || typeof body !== "object") return json({ error: { message: "Ожидался объект" } }, 400);
	const record = body;
	const signals = [AbortSignal.timeout(18e3)];
	if (request.signal) signals.push(request.signal);
	const signal = AbortSignal.any(signals);
	try {
		if (record.action === "search") {
			if (typeof record.query !== "string") return json({ error: { message: "Нужен query" } }, 400);
			return json(await search(record.query, signal));
		}
		if (record.action === "read") {
			if (typeof record.url !== "string" || record.url.length > 2e3) return json({ error: { message: "Нужен url" } }, 400);
			return json(await readPage(record.url, signal));
		}
		return json({ error: { message: "Неизвестное действие" } }, 400);
	} catch (error) {
		const name = error instanceof Error ? error.name : "";
		if (name === "TimeoutError" || name === "AbortError") return json({ error: { message: "Интернет не ответил вовремя" } }, 504);
		return json({ error: { message: "Не удалось выйти в интернет" } }, 502);
	}
}
var Route = createFileRoute("/api/v1/web")({ server: { handlers: { POST: async ({ request }) => handleWeb(request) } } });
var rootRouteChildren = {
	IndexRoute: Route$3.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$4
	}),
	ApiV1ChatRoute: Route$2.update({
		id: "/api/v1/chat",
		path: "/api/v1/chat",
		getParentRoute: () => Route$4
	}),
	ApiV1ModelsRoute: Route$1.update({
		id: "/api/v1/models",
		path: "/api/v1/models",
		getParentRoute: () => Route$4
	}),
	ApiV1WebRoute: Route.update({
		id: "/api/v1/web",
		path: "/api/v1/web",
		getParentRoute: () => Route$4
	})
};
var routeTree = Route$4._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		rewrite: previewPathRewrite(),
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { safeHost as i, isBlockedEndpoint as n, normalizeRoot as r, router_exports as t };
