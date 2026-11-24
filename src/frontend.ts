// Familiar Ledger — frontend entry.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { Client } from "./frontend/client";
import { h } from "./frontend/dom";
import { renderSheet } from "./frontend/sheet";
import { CSS } from "./frontend/styles";
import { mountPhaseUi, uiActions } from "./frontend/ui";

const ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h11a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3z"/><path d="M8 9h6M8 13h6"/><circle cx="18" cy="5" r="2"/></svg>';

export function setup(ctx: SpindleFrontendContext) {
  ctx.deferReady();
  const client = new Client(ctx);
  const cleanups: (() => void)[] = [];
  cleanups.push(ctx.dom.addStyle(CSS));
  cleanups.push(ctx.onBackendMessage((m) => client.receive(m)));

  // Hide the change log from the chat and hand it to the backend.
  cleanups.push(
    ctx.messages.registerTagInterceptor({ tagName: "ufm", removeFromMessage: true }, (p) => {
      if (p.isStreaming || !p.messageId) return;
      ctx.sendToBackend({ type: "tag", chatId: p.chatId ?? client.activeChat, messageId: p.messageId, content: p.content, full: p.fullMatch, isUser: !!p.isUser });
    }),
  );
  // The narrator card's greeting carries <ufm-setup run="..."></ufm-setup>: open the setup window.
  cleanups.push(
    ctx.messages.registerTagInterceptor({ tagName: "ufm-setup", removeFromMessage: true }, (p) => {
      if (p.isStreaming) return;
      const run = (p.attrs?.run ?? "origin").toLowerCase();
      const chatId = p.chatId ?? client.activeChat;
      ctx.sendToBackend({ type: "setup_tag", chatId, run });
      uiActions.maybeAutoSetup(chatId ?? null, run);
    }),
  );

  // Drawer tab: the sheet.
  const tab = ctx.ui.registerDrawerTab({
    id: "ledger",
    title: "Familiar Ledger",
    shortName: "Ledger",
    description: "Your Ultimate Familiar Mastery sheet: level, attributes, Pillars, tethers",
    keywords: ["ufm", "familiar", "sheet", "stats", "tower", "pillars"],
    headerTitle: "Ledger",
    iconSvg: ICON,
  });
  const sheetRoot = h("div", { class: "ufl-root" });
  tab.root.appendChild(sheetRoot);
  const drawSheet = () => renderSheet(sheetRoot, client, { openSetup: () => uiActions.openSetup(), openLevelUp: () => uiActions.openLevelUp() });
  cleanups.push(client.subscribe(drawSheet));
  cleanups.push(tab.onActivate(() => client.refreshActive()));
  cleanups.push(() => tab.destroy());

  cleanups.push(...mountPhaseUi(ctx, client));

  // Track the open chat.
  cleanups.push(ctx.events.on("CHAT_SWITCHED", () => setTimeout(() => client.refreshActive(), 50)));
  cleanups.push(ctx.events.on("CHAT_CHANGED", () => client.refreshActive()));
  if (ctx.composer?.onChange) cleanups.push(ctx.composer.onChange(() => client.refreshActive()));
  const poll = setInterval(() => client.refreshActive(), 4000);
  cleanups.push(() => clearInterval(poll));

  drawSheet();
  ctx.ready();
  client.refreshActive(true);

  return () => {
    for (const fn of cleanups.reverse()) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  };
}
