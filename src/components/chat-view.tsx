import {
  Copy,
  ChevronsRight,
  Globe,
  ImagePlus,
  Menu,
  Mic,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { MarkdownView } from "@/components/markdown-view";
import {
  chatToMarkdown,
  compressImage,
  continueReply,
  copyText,
  downloadText,
  regenerate,
  sendDraft,
  speak,
  stopStream,
} from "@/lib/actions";
import { cn } from "@/lib/cn";
import { safeHost } from "@/lib/endpoint";
import { currentChat, resolveProfile, useLucent } from "@/lib/store";
import type { ChatMessage, Persona } from "@/lib/types";

function clock(ts: number) {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function ChatView() {
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  const last = chat?.messages.filter((m) => !m.hidden).at(-1);
  const tail = last
    ? `${last.id}:${last.content.length}:${last.reasoning?.length ?? 0}:${last.activity ?? ""}:${last.sources?.length ?? 0}`
    : "";

  useEffect(() => {
    if (!stickRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [tail, chat?.id, attachments.length]);

  useEffect(() => {
    setMenu(false);
    setRenaming(false);
  }, [chat?.id]);

  async function addFiles(files: FileList | File[]) {
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

  function onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer.files?.length) void addFiles(event.dataTransfer.files);
  }

  const slash = draft.startsWith("/") && !draft.includes("\n");
  const query = draft.slice(1).trim().toLowerCase();
  const commands = slashCommands(personas, query);

  function runCommand(index = slashIndex) {
    const command = commands[index];
    if (!command) {
      void sendDraft();
      return;
    }
    command.run();
    clearComposer();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
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
      else void sendDraft();
    }
  }

  const recRef = useRef<{ stop: () => void } | null>(null);

  function toggleMic() {
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
      setListening(false);
      return;
    }
    const w = window as Window & {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
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

  return (
    <div className="flex h-full min-h-0 flex-col" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5 md:px-5">
        <button
          type="button"
          className="btn btn-icon btn-ghost md:hidden"
          aria-label="Чаты"
          onClick={() => patchUi({ sidebar: true })}
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          {renaming && chat ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                renameChat(chat.id, titleDraft);
                setRenaming(false);
              }}
            >
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  renameChat(chat.id, titleDraft);
                  setRenaming(false);
                }}
                className="field h-10 py-0"
                aria-label="Название чата"
              />
            </form>
          ) : (
            <button
              type="button"
              className="block max-w-full truncate text-left text-sm font-medium"
              onClick={() => {
                if (!chat) return;
                setTitleDraft(chat.title);
                setRenaming(true);
              }}
            >
              {chat?.title ?? "Lucent"}
            </button>
          )}
          <div className="truncate text-xs text-mist">
            {profile ? `${profile.name} · ${safeHost(profile.baseUrl)}` : "Подключение не выбрано"}
            {persona ? ` · ${persona.name}` : ""}
            {chat?.incognito ? " · не сохраняется" : ""}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost hidden max-w-48 truncate sm:inline-flex"
          onClick={() => patchUi({ chatParams: !chatParams })}
        >
          <span className="truncate">{modelLabel}</span>
        </button>
        <button
          type="button"
          className="btn btn-icon btn-ghost sm:hidden"
          aria-label="Параметры чата"
          onClick={() => patchUi({ chatParams: !chatParams })}
        >
          <SlidersHorizontal className="size-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            className="btn btn-icon btn-ghost"
            aria-label="Меню чата"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <MoreHorizontal className="size-5" />
          </button>
          {menu && chat ? (
            <div className="glass absolute top-12 right-0 z-20 w-60 rounded-3xl p-1.5 text-sm">
              <MenuButton
                label="Переименовать"
                onClick={() => {
                  setTitleDraft(chat.title);
                  setRenaming(true);
                  setMenu(false);
                }}
              />
              <MenuButton
                label={chat.pinned ? "Открепить" : "Закрепить"}
                onClick={() => {
                  togglePin(chat.id);
                  setMenu(false);
                }}
              />
              <MenuButton
                label="Инкогнито"
                onClick={() => {
                  createChat(true);
                  setMenu(false);
                }}
              />
              <MenuButton
                label="Параметры чата"
                onClick={() => {
                  patchUi({ chatParams: true });
                  setMenu(false);
                }}
              />
              <MenuButton
                label="Экспорт Markdown"
                onClick={() => {
                  downloadText(`${chat.title}.md`, chatToMarkdown(chat), "text/markdown");
                  setMenu(false);
                }}
              />
              <MenuButton
                label="Дублировать"
                onClick={() => {
                  duplicateChat(chat.id);
                  setMenu(false);
                }}
              />
              <MenuButton
                label="Очистить сообщения"
                onClick={() => {
                  clearMessages(chat.id);
                  setMenu(false);
                }}
              />
              <MenuButton
                label="Удалить чат"
                onClick={() => {
                  deleteChat(chat.id);
                  setMenu(false);
                }}
              />
            </div>
          ) : null}
        </div>
      </header>

      {chatParams && chat ? (
        <ChatParams
          model={chat.model || profile?.model || ""}
          models={profile?.models ?? []}
          personaId={chat.personaId}
          systemPrompt={chat.systemPrompt}
          personas={personas}
          onModel={(model) => setChatFields(chat.id, { model })}
          onPersona={(personaId) => setChatFields(chat.id, { personaId })}
          onPrompt={(systemPrompt) => setChatFields(chat.id, { systemPrompt })}
          onClose={() => patchUi({ chatParams: false })}
        />
      ) : null}

      <div
        ref={scrollerRef}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
        }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-6">
          {!chat || chat.messages.filter((m) => !m.hidden).length === 0 ? (
            <Hero onPreset={(preset) => openProfileEditor({ mode: "new", preset })} />
          ) : (
            chat.messages
              .filter((m) => !m.hidden)
              .map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  streaming={streaming && message.id === chat.messages.at(-1)?.id}
                  showTime={settings.showTimestamps}
                  onEdit={() => {
                    setDraft(message.content, message.images ?? []);
                    patchUi({ editingId: message.id });
                  }}
                />
              ))
          )}
        </div>
      </div>

      <div className="safe-bottom mx-auto w-full max-w-3xl px-3 md:px-6">
        {editingId ? (
          <div className="mb-2 flex items-center justify-between rounded-full border border-line bg-veil px-3 py-1.5 text-xs text-mist">
            <span>Редактирование сообщения</span>
            <button
              type="button"
              className="btn btn-ghost h-8 min-h-8 px-3 text-xs"
              onClick={() => {
                clearComposer();
                patchUi({ editingId: null });
              }}
            >
              Отмена
            </button>
          </div>
        ) : null}
        {slash && commands.length ? (
          <div className="glass mb-2 rounded-3xl p-1.5">
            {commands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm",
                  index === slashIndex ? "bg-fog/10" : "",
                )}
                onMouseEnter={() => setSlashIndex(index)}
                onClick={() => runCommand(index)}
              >
                <span>{command.label}</span>
                <span className="text-xs text-mist">{command.hint}</span>
              </button>
            ))}
          </div>
        ) : null}
        {attachments.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((file) => (
              <span key={file.id} className="glass-quiet flex items-center gap-2 rounded-full py-1 pr-1 pl-3 text-xs">
                {file.name}
                <button
                  type="button"
                  className="btn btn-icon size-8 min-h-8"
                  aria-label="Убрать вложение"
                  onClick={() => removeAttachment(file.id)}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="mb-2 flex">
          <button
            type="button"
            aria-pressed={settings.web}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs",
              settings.web ? "bg-fog text-ink" : "glass-quiet text-mist",
            )}
            onClick={() => updateSettings({ web: !settings.web })}
          >
            <Globe className="size-3.5" />
            {settings.web ? "Интернет включён" : "Дать модели интернет"}
          </button>
        </div>
        <div className="glass mb-3 flex items-end gap-1 rounded-3xl p-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn btn-icon btn-ghost" aria-label="Прикрепить изображение" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-5" />
          </button>
          <button
            type="button"
            className={cn("btn btn-icon btn-ghost", listening && "bg-fog text-ink")}
            aria-label={listening ? "Остановить диктовку" : "Голосовой ввод"}
            aria-pressed={listening}
            onClick={toggleMic}
          >
            <Mic className="size-5" />
          </button>
          <textarea
            value={draft}
            rows={1}
            onChange={(e) => {
              setDraft(e.target.value);
              setSlashIndex(0);
              const el = e.target;
              el.style.height = "0px";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={onKeyDown}
            placeholder={listening ? "Слушаю…" : "Сообщение. / — команды"}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-fog outline-none placeholder:text-mist"
            aria-label="Сообщение"
          />
          {streaming ? (
            <button type="button" className="btn btn-icon btn-primary" aria-label="Остановить" onClick={stopStream}>
              <Square className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-icon btn-primary"
              aria-label="Отправить"
              disabled={!draft.trim() && attachments.length === 0}
              onClick={() => void sendDraft()}
            >
              <Send className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="w-full rounded-2xl px-3 py-2 text-left hover:bg-veil" onClick={onClick}>
      {label}
    </button>
  );
}

function MessageBubble({
  message,
  streaming,
  showTime,
  onEdit,
}: {
  message: ChatMessage;
  streaming: boolean;
  showTime: boolean;
  onEdit: () => void;
}) {
  const user = message.role === "user";
  return (
    <article className={cn("msg rise", user ? "flex justify-end" : "")}>
      <div className={cn(user ? "max-w-xl" : "w-full")}>
        <div className={cn(user ? "bubble-user px-4 py-3" : "")}>
        {message.images?.length ? (
          <div className={cn("mb-2 flex flex-wrap gap-2", user ? "" : "")}>
            {message.images.map((img) => (
              <img key={img.id} src={img.dataUrl} alt={img.name} className="max-h-48 rounded-2xl" />
            ))}
          </div>
        ) : null}
        {message.reasoning ? (
          <details className="mb-2 rounded-2xl border border-line bg-veil px-3 py-2 text-sm text-mist" open={streaming}>
            <summary className="cursor-pointer">Ход мысли</summary>
            <p className="mt-2 whitespace-pre-wrap">{message.reasoning}</p>
          </details>
        ) : null}
        {message.activity ? <p className="mb-2 text-sm text-mist">{message.activity}</p> : null}
        {message.content ? (
          user ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownView text={message.content} />
          )
        ) : streaming && !message.activity ? (
          <span className="caret" aria-hidden="true" />
        ) : null}
        {message.sources?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {message.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="glass-quiet max-w-full truncate rounded-full px-3 py-1 text-xs text-mist hover:text-fog"
              >
                {source.title || source.url}
              </a>
            ))}
          </div>
        ) : null}
        {message.error ? <p className={cn("mt-2 text-sm", user ? "text-ink-soft" : "text-mist")}>{message.error}</p> : null}
        </div>
        <div className={cn("msg-actions mt-2 flex flex-wrap items-center gap-1", user && "justify-end")}>
          {showTime ? <span className="px-1 text-xs text-mist tabular-nums">{clock(message.createdAt)}</span> : null}
          {message.usage ? (
            <span className="px-1 text-xs text-mist tabular-nums">
              ↑{message.usage.prompt ?? "–"} ↓{message.usage.completion ?? "–"}
            </span>
          ) : null}
          {message.content ? (
            <IconTip label="Копировать" onClick={() => void copyText(message.content)}>
              <Copy className="size-3.5" />
            </IconTip>
          ) : null}
          {user ? (
            <IconTip label="Изменить" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </IconTip>
          ) : (
            <>
              <IconTip label="Ещё раз" onClick={() => void regenerate()}>
                <RefreshCw className="size-3.5" />
              </IconTip>
              <IconTip label="Продолжить" onClick={() => void continueReply()}>
                <ChevronsRight className="size-3.5" />
              </IconTip>
              {message.content ? (
                <IconTip label="Озвучить" onClick={() => speak(message.content)}>
                  <Volume2 className="size-3.5" />
                </IconTip>
              ) : null}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function IconTip({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="btn btn-ghost h-8 min-h-8 px-2 text-xs" aria-label={label} onClick={onClick}>
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function Hero({ onPreset }: { onPreset: (preset: string) => void }) {
  const presets = [
    ["openai", "OpenAI"],
    ["openrouter", "OpenRouter"],
    ["groq", "Groq"],
    ["deepseek", "DeepSeek"],
    ["xai", "xAI"],
    ["ollama", "Ollama"],
    ["custom", "Свой API"],
  ] as const;
  return (
    <div className="rise flex min-h-[52vh] flex-col justify-end pb-6">
      <p className="text-xs tracking-[0.22em] text-mist uppercase">OpenAI-compatible</p>
      <h1 className="mt-3 max-w-xl text-4xl font-medium tracking-tight text-balance md:text-5xl">
        Ваши модели. Один стеклянный клиент.
      </h1>
      <p className="mt-4 max-w-lg text-mist">
        Подключите OpenAI, Groq, OpenRouter, DeepSeek, xAI или любой endpoint с /v1. Ключ остаётся в этом браузере.
        Включите интернет — модель сможет искать и открывать страницы.
      </p>
      <ol className="mt-6 grid gap-2 text-sm md:grid-cols-3">
        {["Добавьте подключение", "Выберите модель", "Пишите — ответ приходит потоком"].map((step, i) => (
          <li key={step} className="glass-quiet rounded-3xl px-4 py-3">
            <span className="text-mist tabular-nums">0{i + 1}</span>
            <div className="mt-1">{step}</div>
          </li>
        ))}
      </ol>
      <div className="chip-row mt-5 pb-1">
        {presets.map(([id, name]) => (
          <button key={id} type="button" className="btn btn-ghost shrink-0" onClick={() => onPreset(id)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatParams({
  model,
  models,
  personaId,
  systemPrompt,
  personas,
  onModel,
  onPersona,
  onPrompt,
  onClose,
}: {
  model: string;
  models: string[];
  personaId: string | null;
  systemPrompt: string;
  personas: Persona[];
  onModel: (value: string) => void;
  onPersona: (id: string | null) => void;
  onPrompt: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-line px-4 py-3 md:px-6">
      <div className="mx-auto grid w-full max-w-3xl gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Параметры чата</h2>
          <button type="button" className="btn btn-icon btn-ghost" aria-label="Закрыть" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <label className="block text-xs text-mist">
          Модель
          <input className="field mt-1" list="lucent-models" value={model} onChange={(e) => onModel(e.target.value)} />
          <datalist id="lucent-models">
            {models.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <div>
          <div className="mb-1 text-xs text-mist">Персона</div>
          <div className="chip-row">
            <button type="button" className={cn("btn btn-ghost shrink-0", !personaId && "bg-fog text-ink")} onClick={() => onPersona(null)}>
              Без персоны
            </button>
            {personas.map((persona) => (
              <button
                key={persona.id}
                type="button"
                className={cn("btn btn-ghost shrink-0", personaId === persona.id && "bg-fog text-ink")}
                onClick={() => onPersona(persona.id)}
              >
                {persona.name}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-xs text-mist">
          Своя инструкция
          <textarea
            className="field mt-1 min-h-24 resize-y"
            value={systemPrompt}
            onChange={(e) => onPrompt(e.target.value)}
            placeholder="Добавляется к персоне и памяти"
          />
        </label>
      </div>
    </div>
  );
}

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function slashCommands(personas: Persona[], query: string) {
  const all = [
    {
      id: "new",
      label: "/new",
      hint: "Новый чат",
      run: () => useLucent.getState().createChat(false),
    },
    {
      id: "ghost",
      label: "/incognito",
      hint: "Инкогнито",
      run: () => useLucent.getState().createChat(true),
    },
    {
      id: "pin",
      label: "/pin",
      hint: "Закрепить",
      run: () => {
        const id = useLucent.getState().activeChatId;
        if (id) useLucent.getState().togglePin(id);
      },
    },
    {
      id: "export",
      label: "/export",
      hint: "Markdown",
      run: () => {
        const chat = currentChat(useLucent.getState());
        if (chat) downloadText(`${chat.title}.md`, chatToMarkdown(chat), "text/markdown");
      },
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
      },
    })),
  ];
  return all.filter((item) => item.label.toLowerCase().includes(query) || item.hint.toLowerCase().includes(query)).slice(0, 8);
}
