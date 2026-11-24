// Player-side events (choices you make in the panel that are yours, not the narrator's).
// Later phases register more kinds here.

import type { PlayerEvent } from "../shared/types";
import type { Ctx } from "./context";

export const PLAYER_EVENT_HANDLERS: Record<string, (ev: PlayerEvent, ctx: Ctx) => void> = {};
