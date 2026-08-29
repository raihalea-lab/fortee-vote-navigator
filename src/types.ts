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

export interface KeyHelp {
  keys: string;
  /** ヘルプパネルに出す説明 */
  action: string;
  /** バーの1行ヒントに出す短い説明。省くとヒント行には載らない */
  short?: string;
}

/**
 * キー操作の唯一の定義。1行ヒントもヘルプパネルもここから描画する
 * （同じ内容を2箇所に書くと、片方だけ古くなるので）。
 */
export const PRESET_KEYS: Readonly<Record<Preset, readonly KeyHelp[]>> = {
  arrows: [
    { keys: '↑ ↓', action: '前 / 次のプロポーザルへ移動', short: '移動' },
    { keys: '← →', action: 'スコアを1段ずらす（← が高得点方向）', short: '採点' },
    { keys: 'z x', action: '左旗 / 右旗を付け外し', short: '旗' },
    { keys: 'shift + z x', action: '次の左旗 / 右旗へジャンプ', short: '旗へ' },
    { keys: '1 - 5', action: '+2 〜 -2 を直接入力（fortee 側の機能）' },
    { keys: '?', action: 'この使い方を開閉' },
  ],
  fortee: [
    { keys: 'j k', action: '前 / 次のプロポーザルへ移動', short: '移動' },
    { keys: '1 - 5', action: '+2 〜 -2 を入力', short: '採点' },
    { keys: 'z x', action: '左旗 / 右旗を付け外し', short: '旗' },
    { keys: 'shift + z x', action: '次の左旗 / 右旗へジャンプ', short: '旗へ' },
    { keys: 'shift + j k', action: '未投票へジャンプ（fortee 側の機能）' },
    { keys: '?', action: 'この使い方を開閉' },
  ],
};

/** バー右端に出す1行ヒント */
export function presetHint(preset: Preset): string {
  return PRESET_KEYS[preset]
    .filter((k) => k.short)
    .map((k) => `${k.keys}: ${k.short}`)
    .join(' / ');
}

export interface Settings {
  /** 採点したら自動で次のプロポーザルへ移動する */
  autoAdvance: boolean;
  preset: Preset;
}

export const DEFAULT_SETTINGS: Settings = { autoAdvance: false, preset: 'arrows' };
