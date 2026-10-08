import { createGuideController, createGuideControllerSignals, guideControllerSignals, type GuideController, type GuideControllerOptions } from "./guides";
import type { DocumentSession } from "./document";
import { preferences, initializePreferences, retryPreferences, updatePreferences, preferenceSaveState } from "./preferences";

/** Retain the controller and signals even when its first storage attempt fails. */
export function createGuideBootstrap(options: GuideControllerOptions = {}) {
  const signals = options.signals ?? createGuideControllerSignals();
  let instance: GuideController | undefined;
  let initialization: Promise<void> | undefined;
  return {
    signals,
    initialize(session: DocumentSession): Promise<void> {
      instance ??= createGuideController(session, { ...options, signals });
      initialization ??= instance.initializeGuides();
      return initialization;
    },
    controller(): GuideController {
      if (!instance) throw new Error("Initialize guide bootstrap before accessing its controller");
      return instance;
    },
  };
}

export const guideBootstrap = createGuideBootstrap({ signals: guideControllerSignals,
  preferenceController: { preferences, initializePreferences, retryPreferences, updatePreferences, preferenceSaveState } });
