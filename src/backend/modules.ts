// Feature modules register their protocol handlers and hooks here.

import { registerActions } from "./actions";
import { registerCheck } from "./check";

export function registerPhaseModules(): void {
  registerActions();
  registerCheck();
}
