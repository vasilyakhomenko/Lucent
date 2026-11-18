package app.lucent.client

import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.URI
import java.net.URLEncoder
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

private const val WEB_UA = "Lucent/1.0 (research; +https://lucent.app)"

data class ToolOut(val text: String, val sources: List<Source>)

fun toolsRejected(message: String?): Boolean {
    val text = message?.lowercase().orEmpty()
    return text.contains("tool") || text.contains("function")
}

fun webTools(): JSONArray {
    fun tool(name: String, description: String, prop: String, propDesc: String): JSONObject {
        return JSONObject()
            .put("type", "function")
            .put(
                "function",
                JSONObject()
                    .put("name", name)
                    .put("description", description)
                    .put(
                        "parameters",
                        JSONObject()
                            .put("type", "object")
                            .put("additionalProperties", false)
                            .put("properties", JSONObject().put(prop, JSONObject().put("type", "string").put("description", propDesc)))
                            .put("required", JSONArray().put(prop)),
                    ),
            )
    }
    return JSONArray()
        .put(tool("web_search", "Search the public web and return titles, URLs and snippets.", "query", "Search query"))
        .put(tool("open_page", "Read one public http(s) page as text. No local or private URLs.", "url", "Absolute http(s) URL"))
}

fun isUnsafeHost(host: String): Boolean {
    val name = host.lowercase().trim('.').removePrefix("[").removeSuffix("]")
    if (
        name.isBlank() ||
        name == "localhost" ||
        name.endsWith(".localhost") ||
        name.endsWith(".local") ||
        name.endsWith(".internal") ||
        name == "metadata.google.internal" ||
        name == "0.0.0.0"
    ) {
        return true
    }
    val addresses = runCatching { InetAddress.getAllByName(name) }.getOrNull() ?: return true
    if (addresses.isEmpty()) return true
    return addresses.any { it.isAnyLocalAddress || it.isLoopbackAddress || it.isLinkLocalAddress || it.isSiteLocalAddress }
}

fun decodeEntities(value: String): String {
    var current = Regex("(?s)<!\\[CDATA\\[(.*?)]]>").replace(value, "$1")
    repeat(3) {
        val next = current
            .replace("&nbsp;", " ")
            .replace(""", "\"")
            .replace("'", "'")
            .replace("&#39;", "'")
            .replace("<", "<")
            .replace(">", ">")
            .replace("&", "&")
        if (next == current) return current
        current = next
    }
    return current
}

fun htmlToText(html: String): String {
    val stripped = html
        .replace(Regex("(?is)<script[\\s\\S]*?</script>"), " ")
        .replace(Regex("(?is)<style[\\s\\S]*?</style>"), " ")
        .replace(Regex("(?is)<noscript[\\s\\S]*?</noscript>"), " ")
        .replace(Regex("(?is)<!--[\\s\\S]*?-->"), " ")
        .replace(Regex("(?i)</(p|div|h[1-6]|li|tr|section|article|br)>"), "\n")
        .replace(Regex("(?i)<br\\s*/?>"), "\n")
        .replace(Regex("<[^>]+>"), " ")
    return decodeEntities(stripped)
        .replace(Regex("[ \\t]+\\n"), "\n")
        .replace(Regex("\\n{3,}"), "\n\n")
        .replace(Regex("[ \\t]{2,}"), " ")
        .trim()
}

private fun tag(block: String, name: String): String {
    val match = Regex("(?is)<$name[^>]*>(.*?)</$name>").find(block) ?: return ""
    return decodeEntities(match.groupValues[1]).trim()
}

fun parseRss(xml: String): List<Source> {
    val sources = mutableListOf<Source>()
    for (block in xml.split(Regex("(?i)<item\\b")).drop(1)) {
        val title = htmlToText(tag(block, "title")).take(180)
        val url = tag(block, "link").replace(Regex("\\s+"), "")
        val snippet = htmlToText(tag(block, "description")).take(320)
        if (title.isBlank() || !url.startsWith("http")) continue
        sources += Source(title, url, snippet)
        if (sources.size >= 6) break
    }
    return sources
}

private fun httpGet(client: OkHttpClient, url: String, accept: String, assign: (okhttp3.Call) -> Unit): String {
    val request = Request.Builder().url(url).header("User-Agent", WEB_UA).header("Accept", accept).get().build()
    val active = client.newCall(request)
    assign(active)
    active.execute().use { response ->
        if (!response.isSuccessful) return ""
        return response.body?.string().orEmpty().take(800_000)
    }
    return ""
}

private fun wiki(client: OkHttpClient, query: String, lang: String, assign: (okhttp3.Call) -> Unit): List<Source> {
    val encoded = URLEncoder.encode(query, "UTF-8")
    val url =
        "https://$lang.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=$encoded&gsrlimit=3&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exchars=320&format=json"
    val raw = httpGet(client, url, "application/json", assign)
    if (raw.isBlank()) return emptyList()
    val pages = JSONObject(raw).optJSONObject("query")?.optJSONObject("pages") ?: return emptyList()
    val found = mutableListOf<Pair<Int, Source>>()
    val keys = pages.keys()
    while (keys.hasNext()) {
        val page = pages.optJSONObject(keys.next()) ?: continue
        val title = page.optString("title")
        val link = page.optString("fullurl")
        if (title.isBlank() || !link.startsWith("http")) continue
        val snippet = page.optString("extract").replace(Regex("\\s+"), " ").trim().take(320)
        found += page.optInt("index", 99) to Source(title, link, snippet)
    }
    return found.sortedBy { it.first }.map { it.second }
}

private fun dedupe(sources: List<Source>): List<Source> {
    val seen = HashSet<String>()
    val out = mutableListOf<Source>()
    for (source in sources) {
        val uri = runCatching { URI(source.url) }.getOrNull() ?: continue
        val host = uri.host ?: continue
        if (isUnsafeHost(host)) continue
        val key = host + (uri.path ?: "").trimEnd('/')
        if (!seen.add(key)) continue
        out += source
        if (out.size >= 6) break
    }
    return out
}

fun searchWeb(client: OkHttpClient, query: String, assign: (okhttp3.Call) -> Unit): ToolOut {
    val clean = query.replace(Regex("\\s+"), " ").trim().take(240)
    if (clean.length < 2) return ToolOut("Слишком короткий запрос.", emptyList())
    val collected = mutableListOf<Source>()
    val encoded = URLEncoder.encode(clean, "UTF-8")
    runCatching {
        val rss = httpGet(client, "https://www.bing.com/search?q=$encoded&format=rss&count=6", "application/rss+xml, application/xml", assign)
        collected += parseRss(rss)
    }
    val langs = if (Regex("[а-яёА-ЯЁ]").containsMatchIn(clean)) listOf("ru", "en") else listOf("en", "ru")
    for (lang in langs) runCatching { collected += wiki(client, clean, lang, assign) }
    val sources = dedupe(collected)
    if (sources.isEmpty()) return ToolOut("По запросу «$clean» ничего не нашлось.", emptyList())
    val text = buildString {
        append("Результаты поиска «$clean»:\n\n")
        sources.forEachIndexed { index, source ->
            append("[${index + 1}] ${source.title}\n${source.url}")
            if (source.snippet.isNotBlank()) append("\n${source.snippet}")
            if (index != sources.lastIndex) append("\n\n")
        }
    }
    return ToolOut(text, sources)
}

private fun readLimited(response: okhttp3.Response): String {
    val body = response.body ?: return ""
    val type = response.header("Content-Type").orEmpty().lowercase()
    if (type.isNotBlank() && !Regex("text/|json|xml|javascript|svg").containsMatchIn(type)) {
        body.close()
        error("Страница не текстовая")
    }
    val stream = body.source().inputStream()
    val out = ByteArrayOutputStream()
    val buf = ByteArray(8192)
    var total = 0
    while (total < 700_000) {
        val n = stream.read(buf, 0, minOf(buf.size, 700_000 - total))
        if (n <= 0) break
        out.write(buf, 0, n)
        total += n
    }
    body.close()
    val charsetName = Regex("charset=([^;\\s]+)").find(type)?.groupValues?.getOrNull(1)?.trim('"') ?: "UTF-8"
    return runCatching { String(out.toByteArray(), charset(charsetName)) }.getOrElse { out.toString(Charsets.UTF_8.name()) }
}

fun readWeb(client: OkHttpClient, raw: String, assign: (okhttp3.Call) -> Unit): ToolOut {
    var current = runCatching { URI(raw.trim()) }.getOrNull() ?: return ToolOut("Некорректный URL.", emptyList())
    if (!current.userInfo.isNullOrBlank()) return ToolOut("Ссылка с паролем запрещена.", emptyList())
    if (current.scheme != "http" && current.scheme != "https") return ToolOut("Только http и https.", emptyList())
    try {
        repeat(4) {
            val host = current.host ?: return ToolOut("Некорректный URL.", emptyList())
            if (isUnsafeHost(host)) return ToolOut("Локальные и служебные адреса закрыты.", emptyList())
            val request = Request.Builder()
                .url(current.toString())
                .header("User-Agent", WEB_UA)
                .header("Accept", "text/html,text/plain,application/json;q=0.8,*/*;q=0.2")
                .get()
                .build()
            val active = client.newCall(request)
            assign(active)
            active.execute().use { response ->
                if (response.code in 300..399) {
                    val location = response.header("Location") ?: return ToolOut("Редирект без адреса.", emptyList())
                    current = current.resolve(location)
                    return@use
                }
                val body = readLimited(response)
                val title = Regex("(?is)<title[^>]*>(.*?)</title>").find(body)?.groupValues?.getOrNull(1)
                    ?.let { htmlToText(it) }
                    ?.take(180)
                    .orEmpty()
                    .ifBlank { host }
                val text = htmlToText(body).take(7000)
                val page = current.toString()
                val prefix = if (response.isSuccessful) "" else "HTTP ${response.code}\n"
                return ToolOut(
                    "$prefix$title\n$page\n\n${text.ifBlank { "На странице нет текста." }}",
                    listOf(Source(title, page, text.take(220))),
                )
            }
        }
        return ToolOut("Слишком много редиректов.", emptyList())
    } catch (error: Exception) {
        val message = error.message.orEmpty()
        if (error is java.io.IOException && message.contains("cancel", ignoreCase = true)) throw error
        return ToolOut(message.ifBlank { "Не удалось открыть страницу" }, emptyList())
    }
}
