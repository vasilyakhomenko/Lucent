import type { Persona, Profile } from "@/lib/types";

export type Preset = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  needsKey: boolean;
  blurb: string;
};

export const PRESETS: Preset[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    needsKey: true,
    blurb: "Официальный API",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    needsKey: true,
    blurb: "Сотни моделей, один ключ",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    needsKey: true,
    blurb: "Очень быстрый инференс",
  },
  {
    id: "together",
    name: "Together",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    needsKey: true,
    blurb: "Открытые модели",
  },
  {
    id: "fireworks",
    name: "Fireworks",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    model: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    needsKey: true,
    blurb: "Быстрые открытые модели",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    needsKey: true,
    blurb: "Чат и рассуждения",
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    needsKey: true,
    blurb: "Европейские модели",
  },
  {
    id: "xai",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4.5",
    needsKey: true,
    blurb: "Grok, OpenAI-совместимый",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "llama-3.3-70b",
    needsKey: true,
    blurb: "Высокая скорость",
  },
  {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "llama3.2",
    needsKey: false,
    blurb: "Локально, в Android-сборке",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "local-model",
    needsKey: false,
    blurb: "Локальный сервер",
  },
  {
    id: "custom",
    name: "Свой endpoint",
    baseUrl: "https://",
    model: "",
    needsKey: true,
    blurb: "Любой /v1 совместимый API",
  },
];

export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1]!;
}

export function profileFromPreset(presetId: string, id: string): Profile {
  const preset = presetById(presetId);
  return {
    id,
    name: preset.name,
    preset: preset.id,
    baseUrl: preset.baseUrl,
    apiKey: "",
    model: preset.model,
    models: preset.model ? [preset.model] : [],
  };
}

export function defaultPersonas(): Persona[] {
  return [
    {
      id: "assistant",
      name: "Ассистент",
      builtIn: true,
      prompt:
        "Ты внимательный ассистент. Отвечай на языке пользователя, по делу, без воды. Если не уверен — скажи об этом.",
    },
    {
      id: "engineer",
      name: "Инженер",
      builtIn: true,
      prompt:
        "Ты старший инженер. Сначала короткий вывод, затем рабочий код или точные шаги. Не выдумывай API. Указывай допущения.",
    },
    {
      id: "translator",
      name: "Переводчик",
      builtIn: true,
      prompt:
        "Ты переводчик. Сохраняй тон, имена и разметку. Если язык не указан — переводи на русский. Не добавляй комментарии, только перевод, если не попросили иначе.",
    },
    {
      id: "editor",
      name: "Редактор",
      builtIn: true,
      prompt:
        "Ты литературный редактор. Улучшай ясность и ритм, не меняя смысл. По просьбе показывай правку и короткий список, что изменилось.",
    },
    {
      id: "analyst",
      name: "Аналитик",
      builtIn: true,
      prompt:
        "Ты аналитик. Структурируй ответ: факты, выводы, риски, следующий шаг. Отделяй данные от предположений.",
    },
    {
      id: "tutor",
      name: "Репетитор",
      builtIn: true,
      prompt:
        "Ты терпеливый репетитор. Объясняй простыми словами, с одним примером. Задавай один уточняющий вопрос, если без него нельзя.",
    },
    {
      id: "brief",
      name: "Кратко",
      builtIn: true,
      prompt: "Отвечай максимально коротко. Без вступлений и списков, если пользователь сам их не просит.",
    },
  ];
}
