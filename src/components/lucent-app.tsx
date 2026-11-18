import { useEffect } from "react";
import { Toaster } from "sonner";
import { ChatView } from "@/components/chat-view";
import { Mark } from "@/components/mark";
import { SettingsView } from "@/components/settings-view";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/cn";
import { useLucent } from "@/lib/store";

export function LucentApp() {
  const hydrated = useLucent((s) => s.hydrated);
  const hydrate = useLucent((s) => s.hydrate);
  const sidebar = useLucent((s) => s.ui.sidebar);
  const settings = useLucent((s) => s.ui.settings);
  const fontScale = useLucent((s) => s.settings.fontScale);
  const patchUi = useLucent((s) => s.patchUi);
  const createChat = useLucent((s) => s.createChat);
  const closeSettings = useLucent((s) => s.closeSettings);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createChat(false);
      }
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        patchUi({ sidebar: true, focusSearch: Date.now() });
      }
      if (event.key === "Escape") {
        if (useLucent.getState().ui.settings) closeSettings();
        else patchUi({ sidebar: false, chatParams: false });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSettings, createChat, patchUi]);

  if (!hydrated) {
    return (
      <main className="atmosphere grid h-dvh place-items-center text-fog">
        <div className="grain" />
        <div className="relative flex flex-col items-center gap-3">
          <Mark className="size-14" />
          <div className="text-2xl font-medium tracking-tight">Lucent</div>
        </div>
      </main>
    );
  }

  return (
    <main className="atmosphere app-root relative h-dvh overflow-hidden text-fog" data-scale={fontScale}>
      <div className="grain" />
      <div className="relative flex h-full gap-2 p-2 md:gap-3 md:p-3">
        <aside
          className={cn(
            "glass fixed inset-y-0 left-0 z-30 flex w-80 max-w-full flex-col overflow-hidden rounded-none transition-transform md:static md:inset-auto md:z-auto md:rounded-3xl",
            sidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          <Sidebar />
        </aside>
        {sidebar ? (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-ink/50 md:hidden"
            aria-label="Закрыть список чатов"
            onClick={() => patchUi({ sidebar: false })}
          />
        ) : null}
        <section className="glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl">
          <ChatView />
        </section>
      </div>
      {settings ? <SettingsView /> : null}
      <Toaster theme="dark" position="top-center" toastOptions={{ className: "toast-glass" }} />
    </main>
  );
}
