// UI surfaces beyond the sheet: the Familiar panel, setup and level-up modals, composer lines.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { Client } from "./client";
import { openLevelUp } from "./levelup";
import { createPanel } from "./panel";
import { openSetup } from "./setup";

export const uiActions = {
  openSetup: () => {},
  openLevelUp: () => {},
  maybeAutoSetup: (_chatId: string | null, _run: string) => {},
};

type Mount = (ctx: SpindleFrontendContext, client: Client) => (() => void)[];
const mounts: Mount[] = [];
export function addMount(fn: Mount): void {
  mounts.push(fn);
}

const PANEL_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l3 5h-6z"/><rect x="6" y="9" width="12" height="9" rx="2"/><path d="M9 21v-3M15 21v-3"/></svg>';

export function mountPhaseUi(ctx: SpindleFrontendContext, client: Client): (() => void)[] {
  const cleanups: (() => void)[] = [];
  uiActions.openSetup = () => openSetup(ctx, client, client.view?.runHint);
  uiActions.openLevelUp = () => openLevelUp(ctx, client);

  // Auto-open setup once per chat when the narrator greeting asks for it, judged on a fresh state reply.
  const autoDone = new Set<string>();
  uiActions.maybeAutoSetup = (chatId, run) => {
    if (!chatId || autoDone.has(chatId)) return;
    autoDone.add(chatId);
    const off = client.subscribeMsg("state", (m) => {
      if (m.chatId !== chatId) return;
      off();
      if (!m.view?.started && client.activeChat === chatId) openSetup(ctx, client, run);
    });
    ctx.sendToBackend({ type: "get_state", chatId });
    setTimeout(off, 15000);
  };

  // The panel: right-edge dock (a bottom sheet on mobile); a drawer tab if ui_panels isn't granted.
  const panel = createPanel(ctx, client, { openSetup: uiActions.openSetup, openLevelUp: uiActions.openLevelUp });
  let dock: ReturnType<SpindleFrontendContext["ui"]["requestDockPanel"]> | null = null;
  try {
    dock = ctx.ui.requestDockPanel({ edge: "right", title: "Familiars", size: 360, minSize: 280, maxSize: 620, resizable: true, startCollapsed: false });
    dock.root.appendChild(panel.root);
    cleanups.push(() => dock?.destroy());
  } catch {
    const tab = ctx.ui.registerDrawerTab({ id: "familiars", title: "Familiars", shortName: "Familiars", description: "Command your familiars", keywords: ["ufm", "golem", "roster"], iconSvg: PANEL_ICON });
    tab.root.appendChild(panel.root);
    cleanups.push(() => tab.destroy());
  }
  cleanups.push(client.subscribe(panel.render));
  panel.render();

  // Panel orders show up as a visible line in your message.
  cleanups.push(
    client.subscribeMsg("order_line", (m) => {
      const comp = ctx.composer;
      const st = comp?.getState();
      if (!comp || !st?.mounted || (st.chatId && st.chatId !== m.chatId)) return;
      try {
        comp.insertText(st.text.trim() ? `\n${m.line}` : m.line, { at: "end" });
        ctx.sendToBackend({ type: "order_inserted", chatId: m.chatId, orderId: m.orderId });
      } catch {
        /* composer busy or missing: the order is still injected */
      }
    }),
  );
  cleanups.push(
    client.subscribeMsg("remove_line", (m) => {
      const comp = ctx.composer;
      const st = comp?.getState();
      if (!comp || !st?.mounted || !st.text.includes(m.line)) return;
      try {
        comp.setText(st.text.replace(`\n${m.line}`, "").replace(m.line, "").trimEnd());
      } catch {
        /* ignore */
      }
    }),
  );

  try {
    const a1 = ctx.ui.registerInputBarAction({ id: "panel", label: "Familiar panel", iconSvg: PANEL_ICON });
    a1.onClick(() => {
      if (dock) dock.isCollapsed() ? dock.expand() : dock.collapse();
      client.refreshActive(true);
    });
    const a2 = ctx.ui.registerInputBarAction({ id: "setup", label: "New run (setup)" });
    a2.onClick(() => uiActions.openSetup());
    const a3 = ctx.ui.registerInputBarAction({ id: "levelup", label: "Place attribute points" });
    a3.onClick(() => uiActions.openLevelUp());
    cleanups.push(() => a1.destroy(), () => a2.destroy(), () => a3.destroy());
  } catch {
    /* input bar unavailable */
  }

  for (const m of mounts) cleanups.push(...m(ctx, client));
  return cleanups;
}
