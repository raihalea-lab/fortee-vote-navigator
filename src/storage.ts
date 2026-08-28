import { conferenceSlug } from './page';
import { DEFAULT_SETTINGS, FLAG_KINDS, type FlagKind, type Settings } from './types';

export type FlagSets = Record<FlagKind, Set<string>>;

const flagsKey = (): string => `flags:${conferenceSlug()}`;
const SETTINGS_KEY = 'settings';

export function emptyFlags(): FlagSets {
  return { left: new Set(), right: new Set() };
}

export async function loadFlags(): Promise<FlagSets> {
  const key = flagsKey();
  const stored = await chrome.storage.local.get(key);
  const value: unknown = stored[key];
  const flags = emptyFlags();

  // v0.1 は単一フラグを文字列配列で保存していた。右旗として引き継ぐ。
  if (Array.isArray(value)) {
    flags.right = new Set(value as string[]);
    return flags;
  }

  if (value && typeof value === 'object') {
    const record = value as Partial<Record<FlagKind, unknown>>;
    for (const kind of FLAG_KINDS) {
      const list = record[kind];
      if (Array.isArray(list)) flags[kind] = new Set(list as string[]);
    }
  }
  return flags;
}

export async function saveFlags(flags: FlagSets): Promise<void> {
  await chrome.storage.local.set({
    [flagsKey()]: { left: [...flags.left], right: [...flags.right] },
  });
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(value ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
