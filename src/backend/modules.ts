// Feature modules register their protocol handlers and hooks here.

import { registerActions } from "./actions";

export function registerPhaseModules(): void {
  registerActions();
}
