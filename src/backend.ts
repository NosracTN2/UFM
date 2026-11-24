// Familiar Ledger — backend entry. Runs in the Spindle worker; `spindle` is a global there.

import type { MacroDefinitionDTO, SpindleAPI } from "lumiverse-spindle-types";
import { intercept, stateMacro } from "./backend/interceptor";
import { handleFrontend } from "./backend/protocol";
import { can, errText, log } from "./backend/sp";
import { loadChat, saveLog } from "./backend/store";
import { ingestMessage, removeMessage, scheduleResync, type MsgLike } from "./backend/sync";
import { registerPhaseModules } from "./backend/modules";

declare const spindle: SpindleAPI;

const ID = "ufm_familiar_ledger";

// Hold chat content hidden until the frontend's tag interceptor is attached (no flash of raw tags).
try {
  spindle.frontendCapabilities?.declare?.("message_tag_interceptor" as never);
} catch {
  /* older hosts */
}

spindle.registerMacro({
  name: "ufm_state",
  category: `extension:${ID}`,
  description: "Familiar Ledger: your sheet, familiar roster and standing orders (authoritative numbers).",
  returnType: "string",
  volatile: true,
  handler: stateMacro as unknown as MacroDefinitionDTO["handler"],
});

let interceptorOn = false;
function tryInterceptor(): void {
  if (interceptorOn || !spindle.permissions.has("interceptor")) return;
  spindle.registerInterceptor(intercept, 90);
  interceptorOn = true;
}
tryInterceptor();
spindle.permissions.onChanged(({ permission, granted }) => {
  if (permission === "interceptor" && granted) tryInterceptor();
});

function track(chatId: string | undefined, userId?: string): void {
  if (!chatId || !userId) return;
  void loadChat(chatId).then((c) => {
    c.userId = userId;
  });
}

async function fold(chatId: string, m: MsgLike | undefined, allSwipes: boolean): Promise<void> {
  if (!chatId || !m) return;
  const c = await loadChat(chatId);
  if (ingestMessage(c.log, m, allSwipes)) await saveLog(c);
}

spindle.on("MESSAGE_SENT", (p: any, userId?: string) => {
  track(p?.chatId, userId);
  void fold(p?.chatId, p?.message, true).then(() => scheduleResync(p?.chatId));
});
spindle.on("MESSAGE_EDITED", (p: any, userId?: string) => {
  track(p?.chatId, userId);
  void fold(p?.chatId, p?.message, true).then(() => scheduleResync(p?.chatId));
});
spindle.on("MESSAGE_SWIPED", (p: any, userId?: string) => {
  track(p?.chatId, userId);
  void fold(p?.chatId, p?.message, true).then(() => scheduleResync(p?.chatId));
});
spindle.on("SWIPE_EDITED", (p: any, userId?: string) => {
  track(p?.chatId, userId);
  void fold(p?.chatId, p?.message, true).then(() => scheduleResync(p?.chatId));
});
spindle.on("MESSAGE_DELETED", (p: any, userId?: string) => {
  track(p?.chatId, userId);
  if (!p?.chatId) return;
  void loadChat(p.chatId).then(async (c) => {
    if (p.messageId && removeMessage(c.log, p.messageId)) await saveLog(c);
    scheduleResync(p.chatId);
  });
});
spindle.on("CHAT_SWITCHED", (p: any, userId?: string) => {
  track(p?.chatId, userId);
  if (p?.chatId) scheduleResync(p.chatId);
});
spindle.on("GENERATION_ENDED", (p: any, userId?: string) => {
  track(p?.chatId, userId);
  if (!p?.chatId || p.error) return;
  void loadChat(p.chatId).then(async (c) => {
    // With chat_mutation the host read is exact (a new swipe must not overwrite an old slot).
    if (!can("chat_mutation") && p.messageId && typeof p.content === "string") {
      const known = c.log.messages.find((m) => m.id === p.messageId);
      if (ingestMessage(c.log, { id: p.messageId, role: "assistant", swipe_id: known?.swipe ?? 0, content: p.content }, false)) await saveLog(c);
    }
    scheduleResync(p.chatId);
  });
});

spindle.onFrontendMessage((payload, userId) => {
  void handleFrontend(payload, userId);
});

try {
  registerPhaseModules();
} catch (e) {
  log("error", `module setup failed: ${errText(e)}`);
}

log("info", "Familiar Ledger backend ready");
