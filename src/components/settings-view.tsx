import { Eye, EyeOff, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { exportBackup, importBackup, loadModels } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { isBlockedEndpoint, normalizeRoot, safeHost } from "@/lib/endpoint";
import { PRESETS, presetById } from "@/lib/presets";
import { blankProfile, uid, useLucent } from "@/lib/store";
import type { Persona, Profile, SettingsTab } from "@/lib/types";

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "links", label: "Подключения" },
  { id: "personas", label: "Персоны" },
  { id: "params", label: "Параметры" },
  { id: "data", label: "Данные" },
];

export function SettingsView() {
  const tab = useLucent((s) => s.ui.tab);
  const patchUi = useLucent((s) => s.patchUi);
  const closeSettings = useLucent((s) => s.closeSettings);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/60 p-0 md:items-center md:p-6">
      <button type="button" className="absolute inset-0" aria-label="Закрыть настройки" onClick={closeSettings} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="glass relative flex h-full w-full max-w-3xl flex-col overflow-hidden md:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
          <div>
            <h2 id="settings-title" className="text-lg font-medium">
              Настройки
            </h2>
            <p className="text-xs text-mist">Ключи хранятся только на этом устройстве</p>
          </div>
          <button type="button" className="btn btn-icon btn-ghost" aria-label="Закрыть" onClick={closeSettings}>
            <X className="size-4" />
          </button>
        </header>
        <div className="chip-row border-b border-line px-4 py-3 md:px-5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn("btn shrink-0", tab === item.id ? "btn-primary" : "btn-ghost")}
              onClick={() => patchUi({ tab: item.id, profileEdit: tab === item.id ? useLucent.getState().ui.profileEdit : null })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
          {tab === "links" ? <LinksTab /> : null}
          {tab === "personas" ? <PersonasTab /> : null}
          {tab === "params" ? <ParamsTab /> : null}
          {tab === "data" ? <DataTab /> : null}
        </div>
      </section>
    </div>
  );
}

function LinksTab() {
  const profiles = useLucent((s) => s.profiles);
  const activeId = useLucent((s) => s.settings.activeProfileId);
  const edit = useLucent((s) => s.ui.profileEdit);
  const setActive = useLucent((s) => s.setActiveProfile);
  const deleteProfile = useLucent((s) => s.deleteProfile);
  const openProfileEditor = useLucent((s) => s.openProfileEditor);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-mist">
        Любой сервер с маршрутами <span className="text-fog">/v1/chat/completions</span> и{" "}
        <span className="text-fog">/v1/models</span>. Браузер проксирует только публичные адреса. Ollama и LM Studio
        на localhost работают в Android-сборке.
      </p>
      {edit ? <ProfileForm /> : null}
      <div className="grid gap-2">
        {profiles.map((profile) => (
          <article key={profile.id} className="glass-quiet flex flex-wrap items-center gap-3 rounded-3xl px-3 py-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setActive(profile.id)}>
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", activeId === profile.id ? "bg-fog" : "bg-fog/20")} />
                <span className="truncate font-medium">{profile.name}</span>
              </div>
              <div className="truncate text-xs text-mist">
                {safeHost(profile.baseUrl)} · {profile.model || "модель не задана"}
              </div>
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => openProfileEditor({ mode: "edit", id: profile.id })}>
              Изменить
            </button>
            {confirmId === profile.id ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  deleteProfile(profile.id);
                  setConfirmId(null);
                }}
              >
                Удалить
              </button>
            ) : (
              <button type="button" className="btn btn-icon btn-ghost" aria-label="Удалить подключение" onClick={() => setConfirmId(profile.id)}>
                <Trash2 className="size-4" />
              </button>
            )}
          </article>
        ))}
        {profiles.length === 0 ? <p className="text-sm text-mist">Подключений ещё нет.</p> : null}
      </div>
      <div>
        <h3 className="mb-2 text-xs tracking-wide text-mist uppercase">Добавить</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="glass-quiet rounded-3xl px-3 py-3 text-left"
              onClick={() => openProfileEditor({ mode: "new", preset: preset.id })}
            >
              <div className="text-sm font-medium">{preset.name}</div>
              <div className="mt-1 text-xs text-mist">{preset.blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileForm() {
  const edit = useLucent((s) => s.ui.profileEdit);
  const profiles = useLucent((s) => s.profiles);
  const saveProfile = useLucent((s) => s.saveProfile);
  const patchUi = useLucent((s) => s.patchUi);
  const existing = edit?.mode === "edit" ? profiles.find((p) => p.id === edit.id) : null;
  const [form, setForm] = useState<Profile>(() => existing ?? blankProfile(edit?.mode === "new" ? edit.preset : "custom"));
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!edit) return;
    if (edit.mode === "edit") {
      const found = useLucent.getState().profiles.find((p) => p.id === edit.id);
      if (found) setForm(found);
    } else {
      setForm(blankProfile(edit.preset));
    }
  }, [edit]);

  if (!edit) return null;

  function applyPreset(id: string) {
    const preset = presetById(id);
    setForm((prev) => ({
      ...prev,
      preset: preset.id,
      name: prev.name && prev.name !== presetById(prev.preset).name ? prev.name : preset.name,
      baseUrl: preset.baseUrl,
      model: preset.model,
      models: preset.model ? [preset.model] : prev.models,
    }));
  }

  function save() {
    let baseUrl = form.baseUrl;
    try {
      baseUrl = normalizeRoot(form.baseUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Некорректный URL");
      return;
    }
    if (!form.model.trim()) {
      toast.error("Укажите модель — её можно сменить после загрузки списка");
      return;
    }
    saveProfile({ ...form, baseUrl, name: form.name.trim() || "Подключение", model: form.model.trim() }, true);
    if (isBlockedEndpoint(baseUrl)) {
      toast.success("Сохранено. Этот адрес откроется в Android-сборке, не в браузере.");
    } else {
      toast.success("Подключение сохранено");
    }
  }

  return (
    <form
      className="glass-quiet grid gap-3 rounded-3xl p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{edit.mode === "edit" ? "Редактирование" : "Новое подключение"}</h3>
        <button type="button" className="text-xs text-mist" onClick={() => patchUi({ profileEdit: null })}>
          Закрыть
        </button>
      </div>
      <label className="block text-xs text-mist">
        Пресет
        <select className="field mt-1" value={form.preset} onChange={(e) => applyPreset(e.target.value)}>
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-mist">
        Название
        <input className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="block text-xs text-mist">
        Базовый URL
        <input
          className="field mt-1 font-mono text-sm"
          value={form.baseUrl}
          onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
          placeholder="https://api.example.com/v1"
          spellCheck={false}
        />
      </label>
      <label className="block text-xs text-mist">
        API-ключ
        <span className="mt-1 flex gap-2">
          <input
            className="field font-mono text-sm"
            type={showKey ? "text" : "password"}
            value={form.apiKey}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={presetById(form.preset).needsKey ? "sk-…" : "можно оставить пустым"}
          />
          <button type="button" className="btn btn-icon btn-ghost" aria-label={showKey ? "Скрыть ключ" : "Показать ключ"} onClick={() => setShowKey((v) => !v)}>
            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </label>
      <label className="block text-xs text-mist">
        Модель
        <input
          className="field mt-1 font-mono text-sm"
          list="profile-models"
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
          placeholder="gpt-4o-mini"
        />
        <datalist id="profile-models">
          {form.models.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">
          Сохранить
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            const draft = { ...form };
            try {
              draft.baseUrl = normalizeRoot(form.baseUrl);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Некорректный URL");
              setBusy(false);
              return;
            }
            void loadModels(draft)
              .then((ids) => {
                if (!ids.length) return;
                setForm((prev) => ({
                  ...prev,
                  baseUrl: draft.baseUrl,
                  models: ids,
                  model: ids.includes(prev.model) ? prev.model : (ids[0] ?? prev.model),
                }));
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Запрос…" : "Загрузить модели"}
        </button>
      </div>
    </form>
  );
}

function PersonasTab() {
  const personas = useLucent((s) => s.personas);
  const savePersona = useLucent((s) => s.savePersona);
  const deletePersona = useLucent((s) => s.deletePersona);
  const resetPersonas = useLucent((s) => s.resetPersonas);
  const [editing, setEditing] = useState<Persona | null>(null);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setEditing({ id: uid(), name: "", prompt: "", builtIn: false })}
        >
          Новая персона
        </button>
        <button type="button" className="btn btn-ghost" onClick={resetPersonas}>
          Вернуть стандартные
        </button>
      </div>
      {editing ? (
        <form
          className="glass-quiet grid gap-2 rounded-3xl p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editing.name.trim()) {
              toast.error("Нужно имя");
              return;
            }
            savePersona({ ...editing, name: editing.name.trim() });
            setEditing(null);
          }}
        >
          <input
            className="field"
            value={editing.name}
            placeholder="Имя"
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
          <textarea
            className="field min-h-28 resize-y"
            value={editing.prompt}
            placeholder="Системная инструкция"
            onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Сохранить
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              Отмена
            </button>
          </div>
        </form>
      ) : null}
      {personas.map((persona) => (
        <article key={persona.id} className="glass-quiet rounded-3xl px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium">{persona.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-mist">{persona.prompt}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(persona)}>
                Править
              </button>
              <button type="button" className="btn btn-icon btn-ghost" aria-label="Удалить персону" onClick={() => deletePersona(persona.id)}>
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ParamsTab() {
  const settings = useLucent((s) => s.settings);
  const update = useLucent((s) => s.updateSettings);
  return (
    <div className="grid gap-4">
      <Slider
        label="Температура"
        min={0}
        max={2}
        step={0.1}
        value={settings.temperature}
        onChange={(temperature) => update({ temperature })}
      />
      <Slider label="Top P" min={0} max={1} step={0.05} value={settings.topP} onChange={(topP) => update({ topP })} />
      <Slider
        label="Макс. токенов"
        hint="0 — не отправлять лимит"
        min={0}
        max={8192}
        step={128}
        value={settings.maxTokens}
        onChange={(maxTokens) => update({ maxTokens })}
      />
      <Slider
        label="Presence penalty"
        min={-2}
        max={2}
        step={0.1}
        value={settings.presencePenalty}
        onChange={(presencePenalty) => update({ presencePenalty })}
      />
      <Slider
        label="Frequency penalty"
        min={-2}
        max={2}
        step={0.1}
        value={settings.frequencyPenalty}
        onChange={(frequencyPenalty) => update({ frequencyPenalty })}
      />
      <label className="block text-xs text-mist">
        Память
        <textarea
          className="field mt-1 min-h-24 resize-y"
          value={settings.memory}
          placeholder="Например: отвечай на русском, я фронтенд-разработчик"
          onChange={(e) => update({ memory: e.target.value })}
        />
      </label>
      <div className="grid gap-2">
        <Toggle label="Потоковый ответ" checked={settings.stream} onChange={(stream) => update({ stream })} />
        <Toggle
          label="Интернет для модели"
          hint="Модель может искать в сети и открывать публичные страницы. Локальные адреса закрыты."
          checked={settings.web}
          onChange={(web) => update({ web })}
        />
        <Toggle
          label="Минимальный запрос"
          hint="Только модель и сообщения — для строгих API"
          checked={settings.minimal}
          onChange={(minimal) => update({ minimal })}
        />
        <Toggle label="Enter отправляет" checked={settings.enterToSend} onChange={(enterToSend) => update({ enterToSend })} />
        <Toggle
          label="Время сообщений"
          checked={settings.showTimestamps}
          onChange={(showTimestamps) => update({ showTimestamps })}
        />
      </div>
      <div>
        <div className="mb-2 text-xs text-mist">Размер текста</div>
        <div className="flex gap-2">
          {(["sm", "md", "lg"] as const).map((scale) => (
            <button
              key={scale}
              type="button"
              className={cn("btn", settings.fontScale === scale ? "btn-primary" : "btn-ghost")}
              onClick={() => update({ fontScale: scale })}
            >
              {scale === "sm" ? "S" : scale === "md" ? "M" : "L"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-mist">{Number(value.toFixed(2))}</span>
      </span>
      {hint ? <span className="text-xs text-mist">{hint}</span> : null}
      <input
        className="mt-3"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="glass-quiet flex items-center justify-between gap-3 rounded-3xl px-3 py-3 text-left"
      onClick={() => onChange(!checked)}
    >
      <span>
        <span className="block text-sm">{label}</span>
        {hint ? <span className="block text-xs text-mist">{hint}</span> : null}
      </span>
      <span className={cn("grid h-7 w-12 place-items-center rounded-full border border-line", checked ? "bg-fog" : "bg-transparent")}>
        <span className={cn("size-5 rounded-full", checked ? "translate-x-2 bg-ink" : "-translate-x-2 bg-fog")} />
      </span>
    </button>
  );
}

function DataTab() {
  const wipe = useLucent((s) => s.wipe);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="grid gap-4 text-sm">
      <p className="text-mist">
        Экспорт включает чаты, персоны и API-ключи. Файл никуда не отправляется, пока вы сами его не передадите.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={exportBackup}>
          Экспорт JSON
        </button>
        <label className="btn btn-ghost">
          Импорт
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then(importBackup);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {confirm ? (
        <button
          type="button"
          className="btn btn-primary w-fit"
          onClick={() => {
            wipe();
            setConfirm(false);
            toast.success("Данные стерты");
          }}
        >
          Точно стереть всё
        </button>
      ) : (
        <button type="button" className="btn btn-ghost w-fit" onClick={() => setConfirm(true)}>
          Стереть локальные данные
        </button>
      )}
      <div className="glass-quiet rounded-3xl p-4 leading-relaxed">
        <h3 className="font-medium">Android APK</h3>
        <p className="mt-2 text-mist">
          В проекте есть нативное приложение на Kotlin и workflow GitHub Actions «Build Android APK». После пуша в
          main откройте вкладку Actions и скачайте артефакт lucent.apk. Сборка подписана отладочным ключом — её можно
          поставить на телефон. Запросы идут напрямую, поэтому Ollama в локальной сети работает без прокси браузера.
        </p>
      </div>
    </div>
  );
}
