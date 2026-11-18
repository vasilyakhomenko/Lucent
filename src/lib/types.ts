export type Role = "system" | "user" | "assistant" | "tool";

export type Attachment = {
  id: string;
  name: string;
  dataUrl: string;
};

export type WebSource = {
  title: string;
  url: string;
  snippet?: string;
};

export type Usage = {
  prompt?: number;
  completion?: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: Attachment[];
  reasoning?: string;
  createdAt: number;
  error?: string;
  hidden?: boolean;
  usage?: Usage;
  finish?: string;
  sources?: WebSource[];
  activity?: string;
};

export type Chat = {
  id: string;
  title: string;
  profileId: string | null;
  model: string | null;
  personaId: string | null;
  systemPrompt: string;
  pinned: boolean;
  incognito: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

export type Profile = {
  id: string;
  name: string;
  preset: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  models: string[];
};

export type Persona = {
  id: string;
  name: string;
  prompt: string;
  builtIn?: boolean;
};

export type FontScale = "sm" | "md" | "lg";

export type Settings = {
  temperature: number;
  topP: number;
  maxTokens: number;
  presencePenalty: number;
  frequencyPenalty: number;
  stream: boolean;
  minimal: boolean;
  enterToSend: boolean;
  showTimestamps: boolean;
  fontScale: FontScale;
  memory: string;
  web: boolean;
  activeProfileId: string | null;
};

export type SettingsTab = "links" | "personas" | "params" | "data";

export type ProfileEdit =
  | { mode: "new"; preset: string }
  | { mode: "edit"; id: string };

export type UiState = {
  sidebar: boolean;
  settings: boolean;
  tab: SettingsTab;
  search: string;
  editingId: string | null;
  chatParams: boolean;
  profileEdit: ProfileEdit | null;
  focusSearch: number;
};

export type ApiText = { type: "text"; text: string };
export type ApiImage = { type: "image_url"; image_url: { url: string } };
export type ApiContent = string | Array<ApiText | ApiImage>;
export type ToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ApiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ApiMessage = {
  role: Role;
  content: ApiContent | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ApiToolCall[];
};

export const DEFAULT_TITLE = "Новый чат";
