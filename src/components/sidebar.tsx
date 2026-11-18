import { format, isToday, isYesterday } from "date-fns";
import { Pin, Plus, Search, Settings, SquarePen, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Mark } from "@/components/mark";
import { cn } from "@/lib/cn";
import { safeHost } from "@/lib/endpoint";
import { resolveProfile, useLucent } from "@/lib/store";
import type { Chat } from "@/lib/types";

function bucket(ts: number): "Сегодня" | "Вчера" | "Ранее" {
  if (isToday(ts)) return "Сегодня";
  if (isYesterday(ts)) return "Вчера";
  return "Ранее";
}

export function Sidebar() {
  const chats = useLucent((s) => s.chats);
  const activeId = useLucent((s) => s.activeChatId);
  const search = useLucent((s) => s.ui.search);
  const focusSearch = useLucent((s) => s.ui.focusSearch);
  const profile = useLucent((s) => resolveProfile(s));
  const patchUi = useLucent((s) => s.patchUi);
  const createChat = useLucent((s) => s.createChat);
  const selectChat = useLucent((s) => s.selectChat);
  const deleteChat = useLucent((s) => s.deleteChat);
  const togglePin = useLucent((s) => s.togglePin);
  const openSettings = useLucent((s) => s.openSettings);
  const searchRef = useRef<HTMLInputElement>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (focusSearch) searchRef.current?.focus();
  }, [focusSearch]);

  const q = search.trim().toLowerCase();
  const filtered = chats.filter((chat) => {
    if (!q) return true;
    if (chat.title.toLowerCase().includes(q)) return true;
    return chat.messages.some((m) => m.content.toLowerCase().includes(q));
  });
  const pinned = filtered.filter((c) => c.pinned);
  const rest = filtered.filter((c) => !c.pinned);
  const groups: Array<{ label: string; items: Chat[] }> = [];
  if (pinned.length) groups.push({ label: "Закреплённые", items: pinned });
  for (const label of ["Сегодня", "Вчера", "Ранее"] as const) {
    const items = rest.filter((c) => bucket(c.updatedAt) === label);
    if (items.length) groups.push({ label, items });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Mark />
        <div className="min-w-0">
          <div className="text-lg font-medium tracking-tight">Lucent</div>
          <div className="text-xs tracking-widest text-mist uppercase">Open models</div>
        </div>
      </div>
      <div className="px-3 pt-4">
        <button type="button" className="btn btn-primary w-full" onClick={() => createChat(false)}>
          <Plus className="size-4" />
          Новый чат
        </button>
      </div>
      <div className="px-3 pt-3">
        <label className="glass-quiet flex items-center gap-2 rounded-full px-3">
          <Search className="size-4 shrink-0 text-mist" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => patchUi({ search: e.target.value })}
            placeholder="Поиск"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-mist"
            aria-label="Поиск чатов"
          />
        </label>
      </div>
      <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-sm text-mist">{q ? "Ничего не найдено" : "Чатов пока нет"}</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-3">
              <h2 className="px-3 py-1 text-xs tracking-wide text-mist uppercase">{group.label}</h2>
              <ul>
                {group.items.map((chat) => {
                  const active = chat.id === activeId;
                  return (
                    <li key={chat.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => selectChat(chat.id)}
                        className={cn(
                          "w-full rounded-2xl px-3 py-2.5 text-left",
                          active ? "bg-fog/10" : "hover:bg-veil",
                        )}
                      >
                        <div className="flex items-center gap-2 pr-14">
                          {chat.pinned ? <Pin className="size-3.5 shrink-0 text-mist" /> : null}
                          <span className="truncate text-sm">{chat.title}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-mist">
                          {chat.incognito ? "не сохраняется · " : ""}
                          {format(chat.updatedAt, "HH:mm")}
                        </div>
                      </button>
                      <div className="absolute top-1.5 right-1.5 flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
                        <button
                          type="button"
                          className="btn btn-icon btn-ghost size-9 min-h-9 border-0 bg-transparent"
                          aria-label={chat.pinned ? "Открепить" : "Закрепить"}
                          onClick={() => togglePin(chat.id)}
                        >
                          <Pin className="size-3.5" />
                        </button>
                        {confirmId === chat.id ? (
                          <button
                            type="button"
                            className="btn btn-ghost h-9 min-h-9 px-2 text-xs"
                            onClick={() => {
                              deleteChat(chat.id);
                              setConfirmId(null);
                            }}
                          >
                            Да
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-icon btn-ghost size-9 min-h-9 border-0 bg-transparent"
                            aria-label="Удалить чат"
                            onClick={() => setConfirmId(chat.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
      <div className="border-t border-line p-3">
        <button
          type="button"
          className="glass-quiet flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
          onClick={() => openSettings("links")}
        >
          <span className="grid size-10 place-items-center rounded-full bg-fog/10">
            <SquarePen className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{profile ? profile.name : "Нет подключения"}</span>
            <span className="block truncate text-xs text-mist">
              {profile ? profile.model || safeHost(profile.baseUrl) : "Добавить API"}
            </span>
          </span>
          <Settings className="size-4 text-mist" />
        </button>
      </div>
    </div>
  );
}
