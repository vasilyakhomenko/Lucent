/** Shared OpenAI-compatible base URL helpers. No Node APIs — safe on client and server. */

export function normalizeRoot(input: string): string {
  let raw = input.trim();
  if (!raw) throw new Error("Укажите базовый URL");
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Некорректный URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Допустимы только http и https");
  }
  let path = url.pathname.replace(/\/+$/, "");
  path = path.replace(/\/(chat\/completions|completions|models)$/, "");
  if (path === "" || path === "/") path = "/v1";
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

export function endpoint(root: string, leaf: "chat/completions" | "models"): string {
  return `${root}/${leaf}`;
}

export function hostnameOf(input: string): string {
  return new URL(normalizeRoot(input)).hostname;
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h === "metadata.google.internal" ||
    h === "metadata.internal" ||
    h === "::1" ||
    h === "0.0.0.0"
  ) {
    return true;
  }
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
export function isBlockedEndpoint(input: string): boolean {
  try {
    return isBlockedHostname(hostnameOf(input));
  } catch {
    return false;
  }
}

export function safeHost(input: string): string {
  try {
    return new URL(normalizeRoot(input)).host;
  } catch {
    return input.trim() || "—";
  }
}
