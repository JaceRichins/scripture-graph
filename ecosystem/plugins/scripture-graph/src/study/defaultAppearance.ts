import type { App } from 'obsidian';

/** Device-local rollout: apply these defaults once, then respect personal choices. */
const APPEARANCE_DEFAULTS_VERSION = 1;
interface AppearanceDevice {
  scene: string;
  appearanceDefaultsVersion?: number;
}
interface AppearanceState {
  app: App;
  device: AppearanceDevice;
  saveDevice(): Promise<void>;
}
// Obsidian's installed runtime exposes these methods, though its public typings
// omit them. 'obsidian' is dark; 'moonstone' is light; CSS themes are separate.
interface AppearanceRuntime {
  changeTheme?: (theme: string) => void | Promise<void>;
  updateTheme?: () => void | Promise<void>;
  vault: { setConfig?: (key: string, value: string) => void | Promise<void> };
}

export async function applyDefaultAppearance(state: AppearanceState): Promise<'applied' | 'already-applied' | 'unavailable'> {
  if ((state.device.appearanceDefaultsVersion ?? 0) >= APPEARANCE_DEFAULTS_VERSION) return 'already-applied';
  const runtime = state.app as unknown as AppearanceRuntime;
  if (typeof runtime.changeTheme === 'function') {
    await runtime.changeTheme('obsidian');
  } else if (typeof runtime.vault?.setConfig === 'function' && typeof runtime.updateTheme === 'function') {
    await runtime.vault.setConfig('theme', 'obsidian');
  } else {
    // Leave the marker unset so a later compatible app version can retry.
    return 'unavailable';
  }
  if (typeof runtime.updateTheme === 'function') await runtime.updateTheme();
  const oldScene = state.device.scene;
  const oldVersion = state.device.appearanceDefaultsVersion;
  state.device.scene = 'match';
  state.device.appearanceDefaultsVersion = APPEARANCE_DEFAULTS_VERSION;
  try {
    await state.saveDevice();
  } catch (error) {
    state.device.scene = oldScene;
    if (oldVersion === undefined) delete state.device.appearanceDefaultsVersion;
    else state.device.appearanceDefaultsVersion = oldVersion;
    throw error;
  }
  return 'applied';
}
