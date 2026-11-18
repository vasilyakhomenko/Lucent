import { toast } from "sonner";
import { create } from "zustand";
import { defaultPersonas, profileFromPreset } from "@/lib/presets";
import type {
  Attachment,
  Chat,
  ChatMessage,
  Persona,
  Profile,
  ProfileEdit,
  Settings,
  SettingsTab,
  UiState,
  WebSource,
} from "@/lib/types";
import { DEFAULT_TITLE } from "@/lib/types";

const STORAGE_KEY = "lucent.v1";

export type Persisted = {
  version: 1;
  profiles: Profile[];
  chats: Chat[];
  personas: Persona[];
  settings: Settings;
  activeChatId: string | null;
};

export const defaultSettings = (): Settings => ({
  temperature: 0.7,
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
  activeProfileId: null,
});

const defaultUi = (): UiState => ({
  sidebar: false,
  settings: false,
  tab: "links",
  search: "",
  editingId: null,
  chatParams: false,
  profileEdit: null,
  focusSearch: 0,
});

export function uid(): string {
  return crypto.randomUUID();
}

type Store = {
  hydrated: boolean;
  profiles: Profile[];
  chats: Chat[];
  personas: Persona[];
  settings: Settings;
  activeChatId: string | null;
  streamingChatId: string | null;
  draft: string;
  attachments: Attachment[];
  ui: UiState;
  hydrate: () => void;
  flushPersist: () => void;
  schedulePersist: () => void;
  patchUi: (partial: Partial<UiState>) => void;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  openProfileEditor: (edit: ProfileEdit) => void;
  setDraft: (draft: string, attachments?: Attachment[]) => void;
  addAttachments: (items: Attachment[]) => void;
  removeAttachment: (id: string) => void;
  clearComposer: () => void;
  createChat: (incognito?: boolean) => string;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  deleteChat: (id: string) => void;
  duplicateChat: (id: string) => void;
  clearMessages: (id: string) => void;
  setChatFields: (id: string, partial: Partial<Chat>) => void;
  writeChat: (chat: Chat, top?: boolean) => void;
  appendDelta: (chatId: string, messageId: string, content: string, reasoning: string) => void;
  patchMessage: (chatId: string, messageId: string, partial: Partial<ChatMessage>) => void;
  setStreaming: (chatId: string | null) => void;
  saveProfile: (profile: Profile, makeActive?: boolean) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  rememberModels: (id: string, models: string[], model?: string) => void;
  updateSettings: (partial: Partial<Settings>) => void;
  savePersona: (persona: Persona) => void;
  deletePersona: (id: string) => void;
  resetPersonas: () => void;
  importData: (data: Persisted) => void;
  wipe: () => void;
};

let persistTimer: number | null = null;
let quotaWarned = false;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeSources(value: unknown): WebSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources: WebSource[] = [];
  for (const item of value) {
    const rec = asRecord(item);
    if (!rec || typeof rec.url !== "string" || !/^https?:\/\//i.test(rec.url)) continue;
    const source: WebSource = {
      title: typeof rec.title === "string" ? rec.title.slice(0, 180) : rec.url,
      url: rec.url.slice(0, 2000),
    };
    if (typeof rec.snippet === "string") source.snippet = rec.snippet.slice(0, 320);
    sources.push(source);
    if (sources.length >= 8) break;
  }
  return sources.length ? sources : undefined;
}

function normalizeMessage(value: unknown): ChatMessage | null {
  const m = asRecord(value);
  if (!m) return null;
  if (m.role !== "user" && m.role !== "assistant") return null;
  if (typeof m.content !== "string" || typeof m.id !== "string") return null;
  const images = Array.isArray(m.images)
    ? m.images
        .map((img) => {
          const rec = asRecord(img);
          if (!rec || typeof rec.dataUrl !== "string") return null;
          return {
            id: typeof rec.id === "string" ? rec.id : uid(),
            name: typeof rec.name === "string" ? rec.name : "image",
            dataUrl: rec.dataUrl,
          };
        })
        .filter((img): img is Attachment => !!img)
    : undefined;
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    images: images && images.length ? images : undefined,
    reasoning: typeof m.reasoning === "string" ? m.reasoning : undefined,
    createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
    error: typeof m.error === "string" ? m.error : undefined,
    hidden: m.hidden === true,
    finish: typeof m.finish === "string" ? m.finish : undefined,
    activity: typeof m.activity === "string" && m.activity ? m.activity : undefined,
    sources: normalizeSources(m.sources),
    usage: asRecord(m.usage)
      ? {
          prompt: typeof asRecord(m.usage)?.prompt === "number" ? (asRecord(m.usage)?.prompt as number) : undefined,
          completion:
            typeof asRecord(m.usage)?.completion === "number"
              ? (asRecord(m.usage)?.completion as number)
              : undefined,
        }
      : undefined,
  };
}

function normalizeChat(value: unknown): Chat | null {
  const c = asRecord(value);
  if (!c || typeof c.id !== "string") return null;
  const messages = Array.isArray(c.messages)
    ? c.messages.map(normalizeMessage).filter((m): m is ChatMessage => !!m)
    : [];
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
    messages,
  };
}

function normalizeProfile(value: unknown): Profile | null {
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
    models: Array.isArray(p.models) ? p.models.filter((m): m is string => typeof m === "string").slice(0, 500) : [],
  };
}

function normalizePersona(value: unknown): Persona | null {
  const p = asRecord(value);
  if (!p || typeof p.id !== "string" || typeof p.name !== "string") return null;
  return {
    id: p.id,
    name: p.name,
    prompt: typeof p.prompt === "string" ? p.prompt : "",
    builtIn: p.builtIn === true,
  };
}

function snapshot(s: Store): Persisted {
  const chats = s.chats.filter((c) => !c.incognito);
  const active = chats.some((c) => c.id === s.activeChatId) ? s.activeChatId : (chats[0]?.id ?? null);
  return {
    version: 1,
    profiles: s.profiles,
    chats,
    personas: s.personas,
    settings: s.settings,
    activeChatId: active,
  };
}

export const useLucent = create<Store>((set, get) => ({
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
    let parsed: unknown = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const rec = asRecord(parsed);
    const settings = { ...defaultSettings(), ...(asRecord(rec?.settings) as Partial<Settings> | null) };
    if (settings.fontScale !== "sm" && settings.fontScale !== "md" && settings.fontScale !== "lg") {
      settings.fontScale = "md";
    }
    settings.web = settings.web === true;
    const profiles = Array.isArray(rec?.profiles)
      ? rec.profiles.map(normalizeProfile).filter((p): p is Profile => !!p)
      : [];
    const chats = Array.isArray(rec?.chats)
      ? rec.chats.map(normalizeChat).filter((c): c is Chat => !!c)
      : [];
    const personas = Array.isArray(rec?.personas)
      ? rec.personas.map(normalizePersona).filter((p): p is Persona => !!p)
      : [];
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const activeChatId = chats.some((c) => c.id === rec?.activeChatId) ? (rec?.activeChatId as string) : null;
    set({
      hydrated: true,
      settings: {
        ...settings,
        activeProfileId: profiles.some((p) => p.id === settings.activeProfileId)
          ? settings.activeProfileId
          : (profiles[0]?.id ?? null),
      },
      profiles,
      chats,
      personas: personas.length ? personas : defaultPersonas(),
      activeChatId,
      ui: { ...defaultUi(), sidebar: wide },
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

  patchUi: (partial) => set((s) => ({ ui: { ...s.ui, ...partial } })),

  openSettings: (tab) =>
    set((s) => ({
      ui: { ...s.ui, settings: true, tab: tab ?? s.ui.tab, chatParams: false },
    })),

  closeSettings: () => set((s) => ({ ui: { ...s.ui, settings: false, profileEdit: null } })),

  openProfileEditor: (edit) =>
    set((s) => ({
      ui: { ...s.ui, settings: true, tab: "links", profileEdit: edit, chatParams: false },
    })),

  setDraft: (draft, attachments) =>
    set((s) => ({ draft, attachments: attachments ?? s.attachments })),

  addAttachments: (items) =>
    set((s) => ({ attachments: [...s.attachments, ...items].slice(0, 4) })),

  removeAttachment: (id) => set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),

  clearComposer: () => set({ draft: "", attachments: [] }),

  createChat: (incognito = false) => {
    const id = uid();
    const now = Date.now();
    const narrow = window.innerWidth < 768;
    const chat: Chat = {
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
      messages: [],
    };
    set((s) => ({
      chats: [chat, ...s.chats],
      activeChatId: id,
      ui: { ...s.ui, sidebar: narrow ? false : s.ui.sidebar, editingId: null, chatParams: false },
    }));
    get().flushPersist();
    return id;
  },

  selectChat: (id) => {
    const narrow = window.innerWidth < 768;
    set((s) => ({
      activeChatId: id,
      ui: { ...s.ui, sidebar: narrow ? false : s.ui.sidebar, editingId: null, chatParams: false },
    }));
    get().flushPersist();
  },

  renameChat: (id, title) => {
    const clean = title.trim().slice(0, 80);
    if (!clean) return;
    set((s) => ({
      chats: s.chats.map((c) => (c.id === id ? { ...c, title: clean, updatedAt: Date.now() } : c)),
    }));
    get().flushPersist();
  },

  togglePin: (id) => {
    set((s) => ({
      chats: s.chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
    }));
    get().flushPersist();
  },

  deleteChat: (id) => {
    set((s) => {
      const chats = s.chats.filter((c) => c.id !== id);
      return {
        chats,
        activeChatId: s.activeChatId === id ? (chats.find((c) => !c.incognito)?.id ?? chats[0]?.id ?? null) : s.activeChatId,
      };
    });
    get().flushPersist();
  },

  duplicateChat: (id) => {
    const source = get().chats.find((c) => c.id === id);
    if (!source) return;
    const now = Date.now();
    const copy: Chat = {
      ...source,
      id: uid(),
      title: `${source.title} · копия`.slice(0, 80),
      pinned: false,
      incognito: false,
      createdAt: now,
      updatedAt: now,
      messages: source.messages.map((m) => ({ ...m, id: uid(), images: m.images?.map((img) => ({ ...img })) })),
    };
    set((s) => ({ chats: [copy, ...s.chats], activeChatId: copy.id }));
    get().flushPersist();
  },

  clearMessages: (id) => {
    set((s) => ({
      chats: s.chats.map((c) => (c.id === id ? { ...c, messages: [], updatedAt: Date.now() } : c)),
    }));
    get().flushPersist();
  },

  setChatFields: (id, partial) => {
    set((s) => ({
      chats: s.chats.map((c) => (c.id === id ? { ...c, ...partial, id: c.id, updatedAt: Date.now() } : c)),
    }));
    get().flushPersist();
  },

  writeChat: (chat, top = true) => {
    set((s) => {
      const rest = s.chats.filter((c) => c.id !== chat.id);
      return { chats: top ? [chat, ...rest] : s.chats.map((c) => (c.id === chat.id ? chat : c)) };
    });
    if (chat.incognito) get().schedulePersist();
    else get().schedulePersist();
  },

  appendDelta: (chatId, messageId, content, reasoning) => {
    set((s) => ({
      chats: s.chats.map((c) => {
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
              reasoning: nextReason || undefined,
            };
          }),
        };
      }),
    }));
    get().schedulePersist();
  },

  patchMessage: (chatId, messageId, partial) => {
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id !== chatId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...partial } : m)),
            },
      ),
    }));
    get().schedulePersist();
  },

  setStreaming: (chatId) => set({ streamingChatId: chatId }),

  saveProfile: (profile, makeActive = true) => {
    set((s) => {
      const exists = s.profiles.some((p) => p.id === profile.id);
      const profiles = exists ? s.profiles.map((p) => (p.id === profile.id ? profile : p)) : [profile, ...s.profiles];
      return {
        profiles,
        settings: {
          ...s.settings,
          activeProfileId: makeActive ? profile.id : s.settings.activeProfileId,
        },
        ui: { ...s.ui, profileEdit: null },
      };
    });
    get().flushPersist();
  },

  deleteProfile: (id) => {
    set((s) => {
      const profiles = s.profiles.filter((p) => p.id !== id);
      const active = s.settings.activeProfileId === id ? (profiles[0]?.id ?? null) : s.settings.activeProfileId;
      return { profiles, settings: { ...s.settings, activeProfileId: active } };
    });
    get().flushPersist();
  },

  setActiveProfile: (id) => {
    set((s) => ({ settings: { ...s.settings, activeProfileId: id } }));
    get().flushPersist();
  },

  rememberModels: (id, models, model) => {
    set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === id ? { ...p, models: models.slice(0, 500), model: model ?? p.model } : p,
      ),
    }));
    get().flushPersist();
  },

  updateSettings: (partial) => {
    set((s) => ({ settings: { ...s.settings, ...partial } }));
    get().flushPersist();
  },

  savePersona: (persona) => {
    set((s) => {
      const exists = s.personas.some((p) => p.id === persona.id);
      return {
        personas: exists ? s.personas.map((p) => (p.id === persona.id ? persona : p)) : [...s.personas, persona],
      };
    });
    get().flushPersist();
  },

  deletePersona: (id) => {
    set((s) => ({
      personas: s.personas.filter((p) => p.id !== id),
      chats: s.chats.map((c) => (c.personaId === id ? { ...c, personaId: null } : c)),
    }));
    get().flushPersist();
  },

  resetPersonas: () => {
    const builtins = defaultPersonas();
    set((s) => ({
      personas: [...builtins, ...s.personas.filter((p) => !p.builtIn && !builtins.some((b) => b.id === p.id))],
    }));
    get().flushPersist();
  },

  importData: (data) => {
    const profiles = data.profiles.map(normalizeProfile).filter((p): p is Profile => !!p);
    const chats = data.chats.map(normalizeChat).filter((c): c is Chat => !!c);
    const personas = data.personas.map(normalizePersona).filter((p): p is Persona => !!p);
    const settings = { ...defaultSettings(), ...data.settings };
    set({
      profiles,
      chats,
      personas: personas.length ? personas : defaultPersonas(),
      settings: {
        ...settings,
        activeProfileId: profiles.some((p) => p.id === settings.activeProfileId)
          ? settings.activeProfileId
          : (profiles[0]?.id ?? null),
      },
      activeChatId: chats.some((c) => c.id === data.activeChatId) ? data.activeChatId : (chats[0]?.id ?? null),
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
      ui: { ...get().ui, editingId: null, profileEdit: null, chatParams: false },
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
}));

export function currentChat(s: Pick<Store, "chats" | "activeChatId">): Chat | null {
  return s.chats.find((c) => c.id === s.activeChatId) ?? null;
}

export function resolveProfile(s: Pick<Store, "profiles" | "settings" | "chats" | "activeChatId">): Profile | null {
  const chat = currentChat(s);
  const id = chat?.profileId || s.settings.activeProfileId;
  return s.profiles.find((p) => p.id === id) ?? s.profiles[0] ?? null;
}

export function blankProfile(presetId: string): Profile {
  return profileFromPreset(presetId, uid());
}
