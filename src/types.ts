export type Score = 2 | 1 | 0 | -1 | -2;

/** 採点ボタンは画面上、左から +2, +1, 0, -1, -2 の順に並んでいる */
export const SCORES: readonly Score[] = [2, 1, 0, -1, -2] as const;

export function scoreLabel(score: Score): string {
  return score > 0 ? `+${score}` : `${score}`;
}

/**
 * 2 種類のフラグ。意味づけは利用者に委ねる（「よかったかも／よくなかったかも」
 * のような使い分けを想定しているが、拡張側では中立に扱う）。
 */
export type FlagKind = 'left' | 'right';

export const FLAG_KINDS: readonly FlagKind[] = ['left', 'right'] as const;

export const FLAG_LABEL: Readonly<Record<FlagKind, string>> = {
  left: '左旗',
  right: '右旗',
};

/** 操作方法のテンプレート */
export type Preset = 'fortee' | 'arrows';

export const PRESET_LABEL: Readonly<Record<Preset, string>> = {
  fortee: 'fortee 準拠',
  arrows: '矢印キー',
};

export const PRESET_HINT: Readonly<Record<Preset, string>> = {
  fortee: 'j k: 移動 / 1-5: 採点 / z x: 旗 / shift+z x: 旗へ',
  arrows: '↑↓: 移動 / ←→: 採点 / z x: 旗 / shift+z x: 旗へ',
};

export interface Settings {
  /** 採点したら自動で次のプロポーザルへ移動する */
  autoAdvance: boolean;
  preset: Preset;
}

export const DEFAULT_SETTINGS: Settings = { autoAdvance: false, preset: 'arrows' };
