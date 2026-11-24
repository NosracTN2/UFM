// Feature modules register their protocol handlers and hooks here.

import { registerActions } from "./actions";
import { registerCheck } from "./check";
import { registerGrowthView } from "./growth-view";

export function registerPhaseModules(): void {
  registerActions();
  registerCheck();
  registerGrowthView();
}
