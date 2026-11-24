// UI surfaces beyond the sheet (panel, modals, settings, HUD). Later phases fill these in.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { Client } from "./client";

export const uiActions = {
  openSetup: () => {},
  openLevelUp: () => {},
  maybeAutoSetup: (_chatId: string | null, _run: string) => {},
};

export function mountPhaseUi(_ctx: SpindleFrontendContext, _client: Client): (() => void)[] {
  return [];
}
