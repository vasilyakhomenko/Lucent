import { endpoint, isBlockedHostname, normalizeRoot } from "@/lib/endpoint";

const MAX_BODY = 7_500_000;

type Leaf = "chat/completions" | "models";

function jsonError(message: string, status = 400): Response {
  return Response.json({ error: { message } }, { status });
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

export async function proxyOpenAI(request: Request, leaf: Leaf): Promise<Response> {
  if (!originAllowed(request)) return jsonError("Запрос отклонён", 403);

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return jsonError("Не удалось прочитать запрос");
  }
  if (raw.length > MAX_BODY) return jsonError("Слишком большой запрос", 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError("Ожидался JSON");
  }
  if (!body || typeof body !== "object") return jsonError("Ожидался объект");

  const record = body as Record<string, unknown>;
  const baseUrl = record.baseUrl;
  const apiKey = record.apiKey;
  if (typeof baseUrl !== "string") return jsonError("Нужен baseUrl");
  if (apiKey != null && typeof apiKey !== "string") return jsonError("Некорректный ключ");
  if (typeof apiKey === "string" && apiKey.length > 8000) return jsonError("Ключ слишком длинный");

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
  if (isBlockedHostname(host)) {
    return jsonError(
      "Веб-версия ходит только в публичные API. Локальные Ollama и LM Studio открывайте в Android-сборке — там запрос идёт с телефона.",
      400,
    );
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (key) headers.Authorization = `Bearer ${key}`;
  if (host.endsWith("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://lucent.app";
    headers["X-Title"] = "Lucent";
  }

  const timeout = AbortSignal.timeout(120_000);
  const signals = [timeout];
  if (request.signal) signals.push(request.signal);
  const signal = AbortSignal.any(signals);

  if (leaf === "models") {
    try {
      const upstream = await fetch(endpoint(root, "models"), { method: "GET", headers, signal });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return connectionError(error);
    }
  }

  const payload = record.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonError("Нужен payload");
  }
  const stream = record.stream === true;
  const outbound = { ...(payload as Record<string, unknown>), stream };
  headers["Content-Type"] = "application/json";
  headers.Accept = stream ? "text/event-stream" : "application/json";

  let upstream: Response;
  try {
    upstream = await fetch(endpoint(root, "chat/completions"), {
      method: "POST",
      headers,
      body: JSON.stringify(outbound),
      signal,
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
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function connectionError(error: unknown): Response {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return jsonError("Сервер модели не ответил вовремя", 504);
  }
  return jsonError("Нет соединения с API. Проверьте адрес и ключ.", 502);
}
