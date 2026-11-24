// Feature modules register their protocol handlers and hooks here.

import { registerActions } from "./actions";
import { registerCheck } from "./check";
import { registerGrowthView } from "./growth-view";
import { registerWorld } from "./world";
import { registerCanon } from "./canon";
import { registerPortraits } from "./portraits";

export function registerPhaseModules(): void {
  registerActions();
  registerCheck();
  registerGrowthView();
  registerWorld();
  registerCanon();
  registerPortraits();
}
