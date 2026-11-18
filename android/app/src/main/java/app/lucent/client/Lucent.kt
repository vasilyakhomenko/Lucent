package app.lucent.client

import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.URI
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

@Serializable
data class Attachment(val id: String, val name: String, val dataUrl: String)

@Serializable
data class Source(val title: String, val url: String, val snippet: String = "")

@Serializable
data class Message(
    val id: String,
    val role: String,
    val content: String,
    val images: List<Attachment> = emptyList(),
    val reasoning: String = "",
    val error: String = "",
    val createdAt: Long = 0L,
    val sources: List<Source> = emptyList(),
    val activity: String = "",
)

@Serializable
data class Chat(
    val id: String,
    val title: String,
    val profileId: String? = null,
    val model: String = "",
    val personaId: String? = null,
    val systemPrompt: String = "",
    val pinned: Boolean = false,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
    val messages: List<Message> = emptyList(),
)

@Serializable
data class Profile(
    val id: String,
    val name: String,
    val preset: String,
    val baseUrl: String,
    val apiKey: String,
    val model: String,
    val models: List<String> = emptyList(),
)

@Serializable
data class Persona(val id: String, val name: String, val prompt: String, val builtIn: Boolean = false)

@Serializable
data class Settings(
    val temperature: Float = 0.7f,
    val topP: Float = 1f,
    val maxTokens: Int = 0,
    val stream: Boolean = true,
    val minimal: Boolean = false,
    val memory: String = "",
    val web: Boolean = false,
    val activeProfileId: String? = null,
)

@Serializable
data class AppData(
    val profiles: List<Profile> = emptyList(),
    val chats: List<Chat> = emptyList(),
    val personas: List<Persona> = emptyList(),
    val settings: Settings = Settings(),
    val activeChatId: String? = null,
)

data class Preset(val id: String, val name: String, val baseUrl: String, val model: String, val needsKey: Boolean)

val PRESETS = listOf(
    Preset("openai", "OpenAI", "https://api.openai.com/v1", "gpt-4o-mini", true),
    Preset("openrouter", "OpenRouter", "https://openrouter.ai/api/v1", "openai/gpt-4o-mini", true),
    Preset("groq", "Groq", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", true),
    Preset("together", "Together", "https://api.together.xyz/v1", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", true),
    Preset("fireworks", "Fireworks", "https://api.fireworks.ai/inference/v1", "accounts/fireworks/models/llama-v3p1-70b-instruct", true),
    Preset("deepseek", "DeepSeek", "https://api.deepseek.com/v1", "deepseek-chat", true),
    Preset("mistral", "Mistral", "https://api.mistral.ai/v1", "mistral-small-latest", true),
    Preset("xai", "xAI", "https://api.x.ai/v1", "grok-4.5", true),
    Preset("cerebras", "Cerebras", "https://api.cerebras.ai/v1", "llama-3.3-70b", true),
    Preset("ollama", "Ollama", "http://127.0.0.1:11434/v1", "llama3.2", false),
    Preset("lmstudio", "LM Studio", "http://127.0.0.1:1234/v1", "local-model", false),
    Preset("custom", "Свой endpoint", "https://", "", true),
)

fun defaultPersonas(): List<Persona> = listOf(
    Persona("assistant", "Ассистент", "Ты внимательный ассистент. Отвечай на языке пользователя, по делу.", true),
    Persona("engineer", "Инженер", "Ты старший инженер. Сначала вывод, затем рабочий код. Не выдумывай API.", true),
    Persona("translator", "Переводчик", "Переводи, сохраняя тон. Если язык не указан — на русский. Без комментариев.", true),
    Persona("editor", "Редактор", "Улучшай ясность, не меняя смысл.", true),
    Persona("analyst", "Аналитик", "Структурируй: факты, выводы, риски, следующий шаг.", true),
    Persona("brief", "Кратко", "Отвечай максимально коротко.", true),
)

fun profileFromPreset(presetId: String): Profile {
    val preset = PRESETS.find { it.id == presetId } ?: PRESETS.last()
    return Profile(
        id = UUID.randomUUID().toString(),
        name = preset.name,
        preset = preset.id,
        baseUrl = preset.baseUrl,
        apiKey = "",
        model = preset.model,
        models = if (preset.model.isBlank()) emptyList() else listOf(preset.model),
    )
}

fun normalizeRoot(input: String): String {
    var raw = input.trim()
    if (raw.isEmpty()) error("Укажите базовый URL")
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) raw = "https://$raw"
    val url = URI(raw)
    val scheme = url.scheme ?: error("Некорректный URL")
    if (scheme != "http" && scheme != "https") error("Допустимы только http и https")
    val host = url.host ?: error("Некорректный URL")
    var path = (url.path ?: "").trimEnd('/')
    path = path.removeSuffix("/chat/completions").removeSuffix("/completions").removeSuffix("/models")
    if (path.isEmpty()) path = "/v1"
    val port = if (url.port == -1) "" else ":${url.port}"
    return "$scheme://$host$port$path"
}

sealed interface Page {
    data object Chats : Page
    data object Chat : Page
    data object Settings : Page
    data class Editor(val profile: Profile) : Page
    data object Personas : Page
    data object Params : Page
}

data class UiState(
    val data: AppData = AppData(personas = defaultPersonas()),
    val loaded: Boolean = false,
    val page: Page = Page.Chats,
    val draft: String = "",
    val attachments: List<Attachment> = emptyList(),
    val streaming: Boolean = false,
    val banner: String? = null,
)

class LucentViewModel(app: Application) : AndroidViewModel(app) {
    private val file = File(app.filesDir, "lucent-state.json")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val mutex = Mutex()
    private val http = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(180, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()
    private val media = "application/json; charset=utf-8".toMediaType()
    private var call: okhttp3.Call? = null

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    init {
        viewModelScope.launch(Dispatchers.IO) {
            val data = readData()
            _ui.update { it.copy(data = data, loaded = true) }
        }
    }

    fun back() {
        _ui.update {
            val page = when (it.page) {
                is Page.Editor, Page.Personas, Page.Params -> Page.Settings
                Page.Settings, Page.Chat -> Page.Chats
                Page.Chats -> Page.Chats
            }
            it.copy(page = page)
        }
    }

    fun open(page: Page) = _ui.update { it.copy(page = page) }

    fun setDraft(value: String) = _ui.update { it.copy(draft = value) }

    fun appendDraft(value: String) = _ui.update {
        val gap = if (it.draft.isNotBlank() && !it.draft.endsWith(" ")) " " else ""
        it.copy(draft = it.draft + gap + value)
    }

    fun banner(text: String) {
        _ui.update { it.copy(banner = text) }
        viewModelScope.launch {
            kotlinx.coroutines.delay(3200)
            _ui.update { if (it.banner == text) it.copy(banner = null) else it }
        }
    }

    fun newChat() {
        val now = System.currentTimeMillis()
        val chat = Chat(
            id = UUID.randomUUID().toString(),
            title = "Новый чат",
            profileId = _ui.value.data.settings.activeProfileId,
            createdAt = now,
            updatedAt = now,
        )
        updateData { it.copy(chats = listOf(chat) + it.chats, activeChatId = chat.id) }
        _ui.update { it.copy(page = Page.Chat, draft = "", attachments = emptyList()) }
    }

    fun openChat(id: String) {
        updateData { it.copy(activeChatId = id) }
        _ui.update { it.copy(page = Page.Chat) }
    }

    fun rename(id: String, title: String) {
        val clean = title.trim().take(80)
        if (clean.isEmpty()) return
        updateData { data -> data.copy(chats = data.chats.map { if (it.id == id) it.copy(title = clean) else it }) }
    }

    fun togglePin(id: String) {
        updateData { data -> data.copy(chats = data.chats.map { if (it.id == id) it.copy(pinned = !it.pinned) else it }) }
    }

    fun deleteChat(id: String) {
        val leaveChat = _ui.value.page == Page.Chat && _ui.value.data.activeChatId == id
        updateData { data ->
            val chats = data.chats.filter { it.id != id }
            data.copy(
                chats = chats,
                activeChatId = if (data.activeChatId == id) chats.firstOrNull()?.id else data.activeChatId,
            )
        }
        if (leaveChat) _ui.update { it.copy(page = Page.Chats) }
    }

    fun setModel(id: String, model: String) {
        updateData { data -> data.copy(chats = data.chats.map { if (it.id == id) it.copy(model = model) else it }) }
    }

    fun setPersona(id: String, personaId: String?) {
        updateData { data -> data.copy(chats = data.chats.map { if (it.id == id) it.copy(personaId = personaId) else it }) }
    }

    fun saveProfile(profile: Profile) {
        var stored = profile
        try {
            stored = profile.copy(baseUrl = normalizeRoot(profile.baseUrl), model = profile.model.trim(), name = profile.name.ifBlank { "Подключение" })
        } catch (e: Exception) {
            banner(e.message ?: "Некорректный URL")
            return
        }
        if (stored.model.isBlank()) {
            banner("Укажите модель")
            return
        }
        updateData { data ->
            val exists = data.profiles.any { it.id == stored.id }
            val profiles = if (exists) data.profiles.map { if (it.id == stored.id) stored else it } else listOf(stored) + data.profiles
            data.copy(profiles = profiles, settings = data.settings.copy(activeProfileId = stored.id))
        }
        _ui.update { it.copy(page = Page.Settings) }
        banner("Подключение сохранено")
    }

    fun deleteProfile(id: String) {
        updateData { data ->
            val profiles = data.profiles.filter { it.id != id }
            val active = if (data.settings.activeProfileId == id) profiles.firstOrNull()?.id else data.settings.activeProfileId
            data.copy(profiles = profiles, settings = data.settings.copy(activeProfileId = active))
        }
    }

    fun updateSettings(settings: Settings) = updateData { it.copy(settings = settings) }

    fun savePersona(persona: Persona) {
        if (persona.name.isBlank()) {
            banner("Нужно имя")
            return
        }
        updateData { data ->
            val exists = data.personas.any { it.id == persona.id }
            val personas = if (exists) data.personas.map { if (it.id == persona.id) persona else it } else data.personas + persona
            data.copy(personas = personas)
        }
    }

    fun deletePersona(id: String) = updateData { it.copy(personas = it.personas.filter { p -> p.id != id }) }

    fun attach(uri: Uri) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val item = compress(getApplication<Application>().contentResolver, uri)
                _ui.update { it.copy(attachments = (it.attachments + item).take(4)) }
            } catch (e: Exception) {
                banner(e.message ?: "Не удалось открыть изображение")
            }
        }
    }

    fun removeAttachment(id: String) = _ui.update { it.copy(attachments = it.attachments.filter { a -> a.id != id }) }

    fun copy(text: String) {
        val cm = getApplication<Application>().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("Lucent", text))
        banner("Скопировано")
    }

    fun stop() {
        call?.cancel()
    }

    fun fetchModels(profile: Profile, onIds: (List<String>) -> Unit) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val root = normalizeRoot(profile.baseUrl)
                val request = Request.Builder().url("$root/models").get()
                if (profile.apiKey.isNotBlank()) request.header("Authorization", "Bearer ${profile.apiKey}")
                http.newCall(request.build()).execute().use { response ->
                    val text = response.body?.string().orEmpty()
                    if (!response.isSuccessful) error(extractError(text, response.code))
                    val ids = parseModels(text)
                    if (ids.isEmpty()) error("Сервер не вернул модели")
                    if (_ui.value.data.profiles.any { it.id == profile.id }) {
                        val model = if (ids.contains(profile.model)) profile.model else ids.first()
                        updateData { data ->
                            data.copy(profiles = data.profiles.map { if (it.id == profile.id) it.copy(models = ids, model = model) else it })
                        }
                    }
                    withContext(Dispatchers.Main) { onIds(ids) }
                    banner("Моделей: ${ids.size}")
                }
            } catch (e: Exception) {
                banner(e.message ?: "Не удалось получить модели")
            }
        }
    }

    fun send() {
        val snapshot = _ui.value
        if (snapshot.streaming) return
        val text = snapshot.draft.trim()
        val images = snapshot.attachments
        if (text.isEmpty() && images.isEmpty()) return
        val data = snapshot.data
        var chat = data.chats.find { it.id == data.activeChatId }
        if (chat == null) {
            newChat()
            chat = _ui.value.data.chats.firstOrNull()
        }
        if (chat == null) return
        val user = Message(
            id = UUID.randomUUID().toString(),
            role = "user",
            content = text,
            images = images,
            createdAt = System.currentTimeMillis(),
        )
        _ui.update { it.copy(draft = "", attachments = emptyList()) }
        complete(chat.id, chat.messages + user)
    }

    fun regenerate() {
        if (_ui.value.streaming) return
        val chat = current() ?: return
        val history = if (chat.messages.lastOrNull()?.role == "assistant") chat.messages.dropLast(1) else chat.messages
        complete(chat.id, history)
    }

    private fun current(): Chat? {
        val data = _ui.value.data
        return data.chats.find { it.id == data.activeChatId }
    }

    private fun complete(chatId: String, history: List<Message>) {
        val data = _ui.value.data
        val chat = data.chats.find { it.id == chatId } ?: return
        val profile = resolveProfile(data, chat)
        if (profile == null) {
            banner("Добавьте подключение")
            _ui.update { it.copy(page = Page.Settings) }
            return
        }
        val model = chat.model.ifBlank { profile.model }
        if (model.isBlank()) {
            banner("Укажите модель")
            return
        }
        val assistantId = UUID.randomUUID().toString()
        val assistant = Message(assistantId, "assistant", "", createdAt = System.currentTimeMillis())
        val next = chat.copy(messages = history + assistant, updatedAt = System.currentTimeMillis())
        updateData(persist = false) { it.copy(chats = listOf(next) + it.chats.filter { c -> c.id != chatId }) }
        _ui.update { it.copy(streaming = true, page = Page.Chat) }

        viewModelScope.launch(Dispatchers.IO) {
            var content = ""
            var reasoning = ""
            try {
                val root = normalizeRoot(profile.baseUrl)
                if (data.settings.web) {
                    try {
                        completeWithWeb(root, profile, data, chat, history, chatId, assistantId)
                        persistNow()
                        maybeTitle(chatId, profile, model)
                        return@launch
                    } catch (error: Exception) {
                        if (call?.isCanceled() == true || !toolsRejected(error.message)) throw error
                        patchAssistant(
                            chatId,
                            assistantId,
                            "",
                            "",
                            "",
                            activity = "Эта модель не принимает функции — отвечаю без интернета",
                        )
                    }
                }
                val payload = JSONObject()
                    .put("model", model)
                    .put("messages", buildMessages(data, chat, history))
                    .put("stream", data.settings.stream)
                if (!data.settings.minimal) {
                    payload.put("temperature", data.settings.temperature.toDouble())
                    payload.put("top_p", data.settings.topP.toDouble())
                    if (data.settings.maxTokens > 0) payload.put("max_tokens", data.settings.maxTokens)
                }
                val builder = Request.Builder()
                    .url("$root/chat/completions")
                    .post(payload.toString().toRequestBody(media))
                if (profile.apiKey.isNotBlank()) builder.header("Authorization", "Bearer ${profile.apiKey}")
                if (root.contains("openrouter.ai")) {
                    builder.header("HTTP-Referer", "https://lucent.app")
                    builder.header("X-Title", "Lucent")
                }
                val active = http.newCall(builder.build())
                call = active
                active.execute().use { response ->
                    val body = response.body ?: error("Пустой ответ")
                    if (!response.isSuccessful) error(extractError(body.string(), response.code))
                    val type = response.header("Content-Type").orEmpty()
                    if (!data.settings.stream || type.contains("json")) {
                        val parsed = readChoice(JSONObject(body.string()))
                        content = parsed.first
                        reasoning = parsed.second
                        patchAssistant(chatId, assistantId, content, reasoning, "", activity = "")
                    } else {
                        val source = body.source()
                        while (!source.exhausted()) {
                            if (active.isCanceled()) break
                            val line = source.readUtf8Line() ?: break
                            val payloadLine = line.trim()
                            if (!payloadLine.startsWith("data:")) continue
                            val dataLine = payloadLine.removePrefix("data:").trim()
                            if (dataLine == "[DONE]") break
                            val parsed = runCatching { readDelta(JSONObject(dataLine)) }.getOrNull() ?: continue
                            if (parsed.first.isNotEmpty() || parsed.second.isNotEmpty()) {
                                content += parsed.first
                                reasoning += parsed.second
                                patchAssistant(chatId, assistantId, content, reasoning, "")
                            }
                        }
                        patchAssistant(chatId, assistantId, content, reasoning, "", activity = "")
                    }
                }
                if (content.isBlank() && reasoning.isBlank()) {
                    patchAssistant(chatId, assistantId, "", "", "Пустой ответ модели", activity = "")
                }
                persistNow()
                maybeTitle(chatId, profile, model)
            } catch (e: Exception) {
                if (call?.isCanceled() == true) {
                    if (content.isBlank() && reasoning.isBlank()) dropMessage(chatId, assistantId)
                } else {
                    patchAssistant(chatId, assistantId, content, reasoning, e.message ?: "Ошибка запроса")
                    banner(e.message ?: "Ошибка запроса")
                }
                persistNow()
            } finally {
                call = null
                _ui.update { it.copy(streaming = false) }
            }
        }
    }

    private fun maybeTitle(chatId: String, profile: Profile, model: String) {
        val chat = _ui.value.data.chats.find { it.id == chatId } ?: return
        if (chat.title != "Новый чат") return
        val first = chat.messages.firstOrNull { it.role == "user" && it.content.isNotBlank() } ?: return
        try {
            val root = normalizeRoot(profile.baseUrl)
            val messages = JSONArray()
                .put(JSONObject().put("role", "system").put("content", "Название диалога: 3–5 слов на языке пользователя. Без кавычек."))
                .put(JSONObject().put("role", "user").put("content", first.content.take(500)))
            val payload = JSONObject().put("model", model).put("messages", messages).put("stream", false).put("max_tokens", 24)
            val builder = Request.Builder().url("$root/chat/completions").post(payload.toString().toRequestBody(media))
            if (profile.apiKey.isNotBlank()) builder.header("Authorization", "Bearer ${profile.apiKey}")
            http.newCall(builder.build()).execute().use { response ->
                if (!response.isSuccessful) return
                val text = readChoice(JSONObject(response.body?.string().orEmpty())).first
                val title = text.replace("\"", "").replace("«", "").replace("»", "").trim().take(80)
                if (title.isNotBlank()) rename(chatId, title)
            }
        } catch (_: Exception) {
        }
    }

    private fun buildMessages(data: AppData, chat: Chat, history: List<Message>, web: Boolean = false): JSONArray {
        val arr = JSONArray()
        val persona = data.personas.find { it.id == chat.personaId }?.prompt?.takeIf { it.isNotBlank() }
        val memory = data.settings.memory.takeIf { it.isNotBlank() }?.let { "Память о пользователе:\n$it" }
        val webNote = if (web) {
            "Доступны функции web_search и open_page. Ищи в интернете свежие факты и открывай публичные страницы. Не выдумывай ссылки. В конце перечисли источники."
        } else {
            null
        }
        val system = listOfNotNull(persona, chat.systemPrompt.takeIf { it.isNotBlank() }, memory, webNote).joinToString("\n\n")
        if (system.isNotBlank()) arr.put(JSONObject().put("role", "system").put("content", system))
        for (message in history) {
            if (message.role == "assistant" && message.content.isBlank()) continue
            val obj = JSONObject().put("role", message.role)
            if (message.images.isEmpty()) {
                obj.put("content", message.content)
            } else {
                val parts = JSONArray()
                if (message.content.isNotBlank()) parts.put(JSONObject().put("type", "text").put("text", message.content))
                message.images.forEach { image ->
                    parts.put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", image.dataUrl)))
                }
                obj.put("content", parts)
            }
            arr.put(obj)
        }
        return arr
    }

    private fun patchAssistant(
        chatId: String,
        messageId: String,
        content: String,
        reasoning: String,
        error: String,
        activity: String? = null,
        sources: List<Source>? = null,
    ) {
        _ui.update { ui ->
            ui.copy(
                data = ui.data.copy(
                    chats = ui.data.chats.map { chat ->
                        if (chat.id != chatId) chat
                        else chat.copy(
                            updatedAt = System.currentTimeMillis(),
                            messages = chat.messages.map { msg ->
                                if (msg.id != messageId) msg
                                else msg.copy(
                                    content = content,
                                    reasoning = reasoning,
                                    error = error,
                                    activity = activity ?: msg.activity,
                                    sources = sources ?: msg.sources,
                                )
                            },
                        )
                    },
                ),
            )
        }
    }

    private fun postJson(root: String, apiKey: String, payload: JSONObject): JSONObject {
        val builder = Request.Builder().url("$root/chat/completions").post(payload.toString().toRequestBody(media))
        if (apiKey.isNotBlank()) builder.header("Authorization", "Bearer $apiKey")
        if (root.contains("openrouter.ai")) {
            builder.header("HTTP-Referer", "https://lucent.app")
            builder.header("X-Title", "Lucent")
        }
        val active = http.newCall(builder.build())
        call = active
        active.execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) error(extractError(raw, response.code))
            return JSONObject(raw)
        }
        error("Пустой ответ")
    }

    private fun completeWithWeb(
        root: String,
        profile: Profile,
        data: AppData,
        chat: Chat,
        history: List<Message>,
        chatId: String,
        assistantId: String,
    ) {
        val messages = buildMessages(data, chat, history, web = true)
        val browser = http.newBuilder().followRedirects(false).followSslRedirects(false).build()
        var content = ""
        var reasoning = ""
        val sources = mutableListOf<Source>()
        val model = chat.model.ifBlank { profile.model }
        repeat(4) { round ->
            if (call?.isCanceled() == true) error("Отменено")
            if (round > 0) patchAssistant(chatId, assistantId, content, reasoning, "", activity = "Собираю ответ", sources = sources.toList())
            val payload = JSONObject().put("model", model).put("messages", messages).put("stream", false)
            if (!data.settings.minimal) {
                payload.put("temperature", data.settings.temperature.toDouble())
                payload.put("top_p", data.settings.topP.toDouble())
                if (data.settings.maxTokens > 0) payload.put("max_tokens", data.settings.maxTokens)
            }
            if (round < 3) {
                payload.put("tools", webTools())
                payload.put("tool_choice", "auto")
            }
            val json = postJson(root, profile.apiKey, payload)
            val message = json.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message") ?: JSONObject()
            val piece = message.optString("content")
            val thought = message.optString("reasoning_content").ifBlank { message.optString("reasoning") }
            content += piece
            reasoning += thought
            val calls = message.optJSONArray("tool_calls")
            if (round >= 3 || calls == null || calls.length() == 0) {
                val errorText = if (content.isBlank() && reasoning.isBlank()) "Пустой ответ модели" else ""
                patchAssistant(chatId, assistantId, content, reasoning, errorText, activity = "", sources = sources.toList())
                return
            }
            messages.put(
                JSONObject()
                    .put("role", "assistant")
                    .put("content", if (piece.isBlank()) JSONObject.NULL else piece)
                    .put("tool_calls", calls),
            )
            val limit = minOf(calls.length(), 3)
            for (index in 0 until limit) {
                if (call?.isCanceled() == true) error("Отменено")
                val callObj = calls.optJSONObject(index) ?: continue
                val id = callObj.optString("id").ifBlank { "call_$index" }
                val fn = callObj.optJSONObject("function") ?: JSONObject()
                val name = fn.optString("name")
                val parsed = runCatching { JSONObject(fn.optString("arguments").ifBlank { "{}" }) }.getOrElse { JSONObject() }
                val out = when (name) {
                    "web_search" -> {
                        val query = parsed.optString("query").ifBlank { parsed.optString("q") }
                        patchAssistant(chatId, assistantId, content, reasoning, "", activity = if (query.isBlank()) "Ищу в интернете" else "Ищу: $query")
                        if (query.isBlank()) ToolOut("Нужен параметр query.", emptyList()) else searchWeb(browser, query) { call = it }
                    }
                    "open_page" -> {
                        val url = parsed.optString("url").ifBlank { parsed.optString("link") }
                        patchAssistant(chatId, assistantId, content, reasoning, "", activity = "Читаю страницу")
                        if (url.isBlank()) ToolOut("Нужен параметр url.", emptyList()) else readWeb(browser, url) { call = it }
                    }
                    else -> ToolOut("Инструмент $name недоступен. Есть web_search и open_page.", emptyList())
                }
                for (source in out.sources) {
                    if (sources.none { it.url == source.url }) sources += source
                }
                while (sources.size > 8) sources.removeAt(sources.lastIndex)
                patchAssistant(chatId, assistantId, content, reasoning, "", sources = sources.toList())
                messages.put(
                    JSONObject()
                        .put("role", "tool")
                        .put("tool_call_id", id)
                        .put("name", name)
                        .put("content", out.text.take(12_000).ifBlank { "Пустой результат." }),
                )
            }
        }
    }

    private fun dropMessage(chatId: String, messageId: String) {
        _ui.update { ui ->
            ui.copy(
                data = ui.data.copy(
                    chats = ui.data.chats.map { chat ->
                        if (chat.id != chatId) chat else chat.copy(messages = chat.messages.filter { it.id != messageId })
                    },
                ),
            )
        }
    }

    private fun resolveProfile(data: AppData, chat: Chat): Profile? {
        val id = chat.profileId ?: data.settings.activeProfileId
        return data.profiles.find { it.id == id } ?: data.profiles.firstOrNull()
    }

    private fun updateData(persist: Boolean = true, block: (AppData) -> AppData) {
        _ui.update { it.copy(data = block(it.data)) }
        if (persist && _ui.value.loaded) {
            viewModelScope.launch(Dispatchers.IO) { persistNow() }
        }
    }

    private suspend fun persistNow() {
        if (!_ui.value.loaded && !file.exists()) return
        val snapshot = _ui.value.data
        mutex.withLock { file.writeText(json.encodeToString(snapshot)) }
    }

    private fun readData(): AppData {
        if (!file.exists()) return AppData(personas = defaultPersonas())
        return try {
            val data = json.decodeFromString<AppData>(file.readText())
            if (data.personas.isEmpty()) data.copy(personas = defaultPersonas()) else data
        } catch (_: Exception) {
            AppData(personas = defaultPersonas())
        }
    }
}

private fun parseModels(text: String): List<String> {
    val json = JSONObject(text)
    val array = json.optJSONArray("data") ?: json.optJSONArray("models") ?: return emptyList()
    val ids = mutableListOf<String>()
    for (i in 0 until array.length()) {
        when (val item = array.get(i)) {
            is String -> ids += item
            is JSONObject -> {
                val id = item.optString("id").ifBlank { item.optString("name") }
                if (id.isNotBlank()) ids += id
            }
        }
    }
    return ids.distinct().sorted()
}

private fun readChoice(json: JSONObject): Pair<String, String> {
    val choice = json.optJSONArray("choices")?.optJSONObject(0) ?: return "" to ""
    val message = choice.optJSONObject("message") ?: return "" to ""
    val reasoning = message.optString("reasoning_content").ifBlank { message.optString("reasoning") }
    return message.optString("content") to reasoning
}

private fun readDelta(json: JSONObject): Pair<String, String> {
    val choice = json.optJSONArray("choices")?.optJSONObject(0) ?: return "" to ""
    val delta = choice.optJSONObject("delta") ?: choice.optJSONObject("message") ?: return "" to ""
    val reasoning = delta.optString("reasoning_content").ifBlank { delta.optString("reasoning") }
    return delta.optString("content") to reasoning
}

private fun extractError(text: String, code: Int): String {
    return try {
        val json = JSONObject(text)
        val error = json.opt("error")
        when (error) {
            is String -> error
            is JSONObject -> error.optString("message").ifBlank { "Ошибка $code" }
            else -> json.optString("message").ifBlank { text.take(300).ifBlank { "Ошибка $code" } }
        }
    } catch (_: Exception) {
        text.take(300).ifBlank { "Ошибка $code" }
    }
}

private fun compress(resolver: ContentResolver, uri: Uri): Attachment {
    val bitmap = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) } ?: error("Не изображение")
    val maxSide = 1024f
    val scale = min(1f, maxSide / max(bitmap.width, bitmap.height).toFloat())
    val width = (bitmap.width * scale).toInt().coerceAtLeast(1)
    val height = (bitmap.height * scale).toInt().coerceAtLeast(1)
    val scaled = if (scale < 1f) Bitmap.createScaledBitmap(bitmap, width, height, true) else bitmap
    val bytes = ByteArrayOutputStream()
    scaled.compress(Bitmap.CompressFormat.JPEG, 72, bytes)
    val encoded = Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
    return Attachment(UUID.randomUUID().toString(), "image.jpg", "data:image/jpeg;base64,$encoded")
}
