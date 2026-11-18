package app.lucent.client

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel

private val Ink = Color(0xFF070708)
private val Fog = Color(0xFFF4F4F2)
private val Mist = Color(0xFFA3A3A0)
private val Line = Color(0x33FFFFFF)
private val Glass = Color(0x14FFFFFF)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Fog,
                    onPrimary = Ink,
                    background = Ink,
                    onBackground = Fog,
                    surface = Ink,
                    onSurface = Fog,
                    surfaceVariant = Color(0xFF161618),
                    onSurfaceVariant = Mist,
                    outline = Line,
                ),
            ) {
                val vm: LucentViewModel = viewModel()
                LucentRoot(vm)
            }
        }
    }
}

@Composable
private fun LucentRoot(vm: LucentViewModel) {
    val ui by vm.ui.collectAsState()
    BackHandler(enabled = ui.loaded && ui.page != Page.Chats) { vm.back() }
    Column(
        Modifier
            .fillMaxSize()
            .background(Ink)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding(),
    ) {
        if (!ui.loaded) {
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Lucent", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Medium)
                Text("модели по вашему API", color = Mist)
            }
            return@Column
        }
        ui.banner?.let {
            Text(it, color = Ink, modifier = Modifier.fillMaxWidth().background(Fog).padding(horizontal = 16.dp, vertical = 8.dp))
        }
        when (val page = ui.page) {
            Page.Chats -> ChatList(vm, ui)
            Page.Chat -> ChatScreen(vm, ui)
            Page.Settings -> SettingsScreen(vm, ui)
            is Page.Editor -> EditorScreen(vm, page.profile)
            Page.Personas -> PersonasScreen(vm, ui)
            Page.Params -> ParamsScreen(vm, ui)
        }
    }
}

@Composable
private fun TopBar(title: String, onBack: (() -> Unit)?, actions: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Назад", tint = Fog) }
        } else {
            Spacer(Modifier.width(12.dp))
        }
        Text(title, modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium)
        actions()
    }
}

@Composable
private fun ColumnScope.ChatList(vm: LucentViewModel, ui: UiState) {
    TopBar("Lucent", null) {
        IconButton(onClick = { vm.open(Page.Settings) }) { Icon(Icons.Filled.Settings, contentDescription = "Настройки", tint = Fog) }
    }
    Button(
        onClick = { vm.newChat() },
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Fog, contentColor = Ink),
    ) {
        Icon(Icons.Filled.Add, contentDescription = null)
        Spacer(Modifier.width(8.dp))
        Text("Новый чат")
    }
    val profile = ui.data.profiles.find { it.id == ui.data.settings.activeProfileId }
    Text(
        profile?.let { "${it.name} · ${it.model}" } ?: "Нет подключения — откройте настройки",
        color = Mist,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    )
    LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(bottom = 24.dp)) {
        items(ui.data.chats, key = { it.id }) { chat ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { vm.openChat(chat.id) }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(if (chat.pinned) "↑ ${chat.title}" else chat.title, maxLines = 1)
                    Text("${chat.messages.count { it.role == "user" }} сообщ.", color = Mist, style = MaterialTheme.typography.bodySmall)
                }
                IconButton(onClick = { vm.deleteChat(chat.id) }) {
                    Icon(Icons.Filled.Delete, contentDescription = "Удалить", tint = Mist)
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.ChatScreen(vm: LucentViewModel, ui: UiState) {
    val chat = ui.data.chats.find { it.id == ui.data.activeChatId }
    val context = LocalContext.current
    val listState = rememberLazyListState()
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) vm.attach(uri) }
    val speech = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val words = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
        if (!words.isNullOrEmpty()) vm.appendDraft(words.first())
    }
    val visible = chat?.messages?.filter {
        it.content.isNotBlank() || it.reasoning.isNotBlank() || it.error.isNotBlank() || it.images.isNotEmpty() || it.activity.isNotBlank() || it.sources.isNotEmpty()
    }.orEmpty()
    LaunchedEffect(visible.size, visible.lastOrNull()?.content?.length) {
        if (visible.isNotEmpty()) listState.scrollToItem(visible.lastIndex)
    }
    TopBar(chat?.title ?: "Чат", { vm.back() }) {
        IconButton(onClick = {
            val text = visible.joinToString("\n\n") { "${it.role}: ${it.content}" }
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
            context.startActivity(Intent.createChooser(send, "Экспорт"))
        }) { Icon(Icons.Filled.ContentCopy, contentDescription = "Поделиться", tint = Fog) }
    }
    if (chat != null) {
        var model by remember(chat.id) { mutableStateOf(chat.model) }
        OutlinedTextField(
            value = model,
            onValueChange = {
                model = it
                vm.setModel(chat.id, it)
            },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            label = { Text("Модель чата, пусто — из подключения") },
            singleLine = true,
            colors = fieldColors(),
        )
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                PersonaChip("Без персоны", chat.personaId == null) { vm.setPersona(chat.id, null) }
            }
            items(ui.data.personas, key = { it.id }) { persona ->
                PersonaChip(persona.name, chat.personaId == persona.id) { vm.setPersona(chat.id, persona.id) }
            }
            item {
                val web = ui.data.settings.web
                PersonaChip(if (web) "Интернет" else "Без сети", web) {
                    vm.updateSettings(ui.data.settings.copy(web = !web))
                }
            }
        }
    }
    LazyColumn(state = listState, modifier = Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (visible.isEmpty()) {
            item {
                Text("Напишите сообщение. «Интернет» даёт модели поиск и чтение страниц.", color = Mist)
            }
        }
        items(visible, key = { it.id }) { message ->
            val mine = message.role == "user"
            Column(Modifier.fillMaxWidth(), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
                Column(
                    Modifier
                        .fillMaxWidth(if (mine) 0.86f else 1f)
                        .clip(RoundedCornerShape(22.dp))
                        .background(if (mine) Fog else Glass)
                        .border(1.dp, Line, RoundedCornerShape(22.dp))
                        .padding(12.dp),
                ) {
                    if (message.activity.isNotBlank()) Text(message.activity, color = Mist, style = MaterialTheme.typography.bodySmall)
                    if (message.reasoning.isNotBlank()) Text(message.reasoning, color = Mist, style = MaterialTheme.typography.bodySmall)
                    Text(message.content.ifBlank { if (ui.streaming && message.activity.isBlank()) "…" else "" }, color = if (mine) Ink else Fog)
                    message.sources.forEach { source ->
                        Text(
                            source.title.ifBlank { source.url },
                            color = Mist,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.clickable {
                                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(source.url))) }
                            },
                        )
                    }
                    if (message.error.isNotBlank()) Text(message.error, color = Mist, style = MaterialTheme.typography.bodySmall)
                }
                Row {
                    if (message.content.isNotBlank()) {
                        IconButton(onClick = { vm.copy(message.content) }) { Icon(Icons.Filled.ContentCopy, contentDescription = "Копировать", tint = Mist) }
                    }
                    if (!mine) {
                        IconButton(onClick = { vm.regenerate() }) { Icon(Icons.Filled.Refresh, contentDescription = "Ещё раз", tint = Mist) }
                    }
                }
            }
        }
    }
    if (ui.attachments.isNotEmpty()) {
        Text("Вложений: ${ui.attachments.size}", color = Mist, modifier = Modifier.padding(horizontal = 16.dp))
    }
    Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { pick.launch("image/*") }) { Icon(Icons.Filled.Image, contentDescription = "Фото", tint = Fog) }
        IconButton(onClick = {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU")
            speech.launch(intent)
        }) { Icon(Icons.Filled.Mic, contentDescription = "Голос", tint = Fog) }
        OutlinedTextField(
            value = ui.draft,
            onValueChange = vm::setDraft,
            modifier = Modifier.weight(1f),
            placeholder = { Text("Сообщение", color = Mist) },
            colors = fieldColors(),
        )
        Spacer(Modifier.width(6.dp))
        if (ui.streaming) {
            IconButton(onClick = { vm.stop() }) { Icon(Icons.Filled.Stop, contentDescription = "Стоп", tint = Fog) }
        } else {
            IconButton(onClick = { vm.send() }) { Icon(Icons.Filled.Send, contentDescription = "Отправить", tint = Fog) }
        }
    }
}

@Composable
private fun PersonaChip(label: String, active: Boolean, onClick: () -> Unit) {
    Text(
        label,
        color = if (active) Ink else Fog,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) Fog else Glass)
            .border(1.dp, Line, RoundedCornerShape(999.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    )
}

@Composable
private fun ColumnScope.SettingsScreen(vm: LucentViewModel, ui: UiState) {
    TopBar("Подключения", { vm.back() }) {}
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(PRESETS, key = { it.id }) { preset ->
            OutlinedButton(onClick = { vm.open(Page.Editor(profileFromPreset(preset.id))) }, border = androidx.compose.foundation.BorderStroke(1.dp, Line)) {
                Text(preset.name, color = Fog)
            }
        }
    }
    Spacer(Modifier.height(8.dp))
    LazyColumn(Modifier.weight(1f)) {
        items(ui.data.profiles, key = { it.id }) { profile ->
            Column(Modifier.fillMaxWidth().clickable { vm.open(Page.Editor(profile)) }.padding(horizontal = 16.dp, vertical = 10.dp)) {
                Text(profile.name, fontWeight = FontWeight.Medium)
                Text("${profile.baseUrl} · ${profile.model}", color = Mist, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
    Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { vm.open(Page.Personas) }, border = androidx.compose.foundation.BorderStroke(1.dp, Line)) { Text("Персоны", color = Fog) }
        OutlinedButton(onClick = { vm.open(Page.Params) }, border = androidx.compose.foundation.BorderStroke(1.dp, Line)) { Text("Параметры", color = Fog) }
    }
}

@Composable
private fun ColumnScope.EditorScreen(vm: LucentViewModel, initial: Profile) {
    var form by remember(initial.id) { mutableStateOf(initial) }
    var reveal by remember { mutableStateOf(false) }
    TopBar(if (initial.model.isBlank() && initial.baseUrl == "https://") "Новое" else form.name, { vm.back() }) {
        IconButton(onClick = { vm.deleteProfile(form.id); vm.back() }) { Icon(Icons.Filled.Delete, contentDescription = "Удалить", tint = Mist) }
    }
    LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            OutlinedTextField(form.name, { form = form.copy(name = it) }, Modifier.fillMaxWidth(), label = { Text("Название") }, colors = fieldColors())
        }
        item {
            OutlinedTextField(form.baseUrl, { form = form.copy(baseUrl = it) }, Modifier.fillMaxWidth(), label = { Text("Базовый URL") }, colors = fieldColors())
        }
        item {
            OutlinedTextField(
                form.apiKey,
                { form = form.copy(apiKey = it) },
                Modifier.fillMaxWidth(),
                label = { Text("API-ключ") },
                visualTransformation = if (reveal) androidx.compose.ui.text.input.VisualTransformation.None else androidx.compose.ui.text.input.PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { reveal = !reveal }) { Icon(if (reveal) Icons.Filled.Close else Icons.Filled.Add, contentDescription = "Ключ", tint = Mist) }
                },
                colors = fieldColors(),
            )
        }
        item {
            OutlinedTextField(form.model, { form = form.copy(model = it) }, Modifier.fillMaxWidth(), label = { Text("Модель") }, colors = fieldColors())
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { vm.saveProfile(form) }, colors = ButtonDefaults.buttonColors(containerColor = Fog, contentColor = Ink)) { Text("Сохранить") }
                OutlinedButton(
                    onClick = {
                        vm.fetchModels(form) { ids ->
                            form = form.copy(models = ids, model = if (ids.contains(form.model)) form.model else ids.first())
                        }
                    },
                    border = androidx.compose.foundation.BorderStroke(1.dp, Line),
                ) { Text("Модели", color = Fog) }
            }
        }
        items(form.models.take(40)) { model ->
            Text(model, color = if (model == form.model) Fog else Mist, modifier = Modifier.clickable { form = form.copy(model = model) }.padding(vertical = 6.dp))
        }
    }
}

@Composable
private fun ColumnScope.PersonasScreen(vm: LucentViewModel, ui: UiState) {
    var editing by remember { mutableStateOf<Persona?>(null) }
    TopBar("Персоны", { vm.back() }) {
        IconButton(onClick = { editing = Persona(java.util.UUID.randomUUID().toString(), "", "", false) }) {
            Icon(Icons.Filled.Add, contentDescription = "Новая", tint = Fog)
        }
    }
    editing?.let { persona ->
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(persona.name, { editing = persona.copy(name = it) }, Modifier.fillMaxWidth(), label = { Text("Имя") }, colors = fieldColors())
            OutlinedTextField(persona.prompt, { editing = persona.copy(prompt = it) }, Modifier.fillMaxWidth(), label = { Text("Инструкция") }, colors = fieldColors())
            Button(onClick = { vm.savePersona(persona); editing = null }, colors = ButtonDefaults.buttonColors(containerColor = Fog, contentColor = Ink)) { Text("Сохранить") }
        }
    }
    LazyColumn(Modifier.weight(1f)) {
        items(ui.data.personas, key = { it.id }) { persona ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f).clickable { editing = persona }.padding(8.dp)) {
                    Text(persona.name)
                    Text(persona.prompt, color = Mist, maxLines = 2, style = MaterialTheme.typography.bodySmall)
                }
                IconButton(onClick = { vm.deletePersona(persona.id) }) { Icon(Icons.Filled.Delete, contentDescription = "Удалить", tint = Mist) }
            }
        }
    }
}

@Composable
private fun ColumnScope.ParamsScreen(vm: LucentViewModel, ui: UiState) {
    val settings = ui.data.settings
    TopBar("Параметры", { vm.back() }) {}
    LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("Температура ${"%.1f".format(settings.temperature)}") }
        item { Slider(settings.temperature, { vm.updateSettings(vm.ui.value.data.settings.copy(temperature = it)) }, valueRange = 0f..2f) }
        item { Text("Top P ${"%.2f".format(settings.topP)}") }
        item { Slider(settings.topP, { vm.updateSettings(vm.ui.value.data.settings.copy(topP = it)) }, valueRange = 0f..1f) }
        item { Text(if (settings.maxTokens == 0) "Лимит токенов не задан" else "Макс. токенов ${settings.maxTokens}") }
        item {
            Slider(
                settings.maxTokens.toFloat(),
                { vm.updateSettings(vm.ui.value.data.settings.copy(maxTokens = it.toInt())) },
                valueRange = 0f..8192f,
            )
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Интернет для модели")
                    Text("Поиск и чтение публичных страниц", color = Mist, style = MaterialTheme.typography.bodySmall)
                }
                Switch(
                    checked = settings.web,
                    onCheckedChange = { vm.updateSettings(vm.ui.value.data.settings.copy(web = it)) },
                    colors = SwitchDefaults.colors(checkedTrackColor = Fog, checkedThumbColor = Ink, uncheckedTrackColor = Glass, uncheckedThumbColor = Fog),
                )
            }
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Поток", modifier = Modifier.weight(1f))
                Switch(
                    checked = settings.stream,
                    onCheckedChange = { vm.updateSettings(vm.ui.value.data.settings.copy(stream = it)) },
                    colors = SwitchDefaults.colors(checkedTrackColor = Fog, checkedThumbColor = Ink, uncheckedTrackColor = Glass, uncheckedThumbColor = Fog),
                )
            }
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Минимальный запрос", modifier = Modifier.weight(1f))
                Switch(
                    checked = settings.minimal,
                    onCheckedChange = { vm.updateSettings(vm.ui.value.data.settings.copy(minimal = it)) },
                    colors = SwitchDefaults.colors(checkedTrackColor = Fog, checkedThumbColor = Ink, uncheckedTrackColor = Glass, uncheckedThumbColor = Fog),
                )
            }
        }
        item {
            OutlinedTextField(
                settings.memory,
                { vm.updateSettings(vm.ui.value.data.settings.copy(memory = it)) },
                Modifier.fillMaxWidth(),
                label = { Text("Память") },
                colors = fieldColors(),
            )
        }
        item {
            Text(
                "Сборка подписана отладочным ключом. Локальные адреса вроде Ollama вызываются с телефона напрямую.",
                color = Mist,
            )
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Fog,
    unfocusedTextColor = Fog,
    focusedBorderColor = Fog,
    unfocusedBorderColor = Line,
    cursorColor = Fog,
    focusedLabelColor = Mist,
    unfocusedLabelColor = Mist,
    focusedContainerColor = Color.Transparent,
    unfocusedContainerColor = Color.Transparent,
)
