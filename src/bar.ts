/** 画面下部に固定表示するサマリーバー */
import {
  FLAG_KINDS,
  FLAG_LABEL,
  PRESET_KEYS,
  PRESET_LABEL,
  SCORES,
  presetHint,
  scoreLabel,
  type FlagKind,
  type Preset,
  type Score,
} from './types';

export interface BarState {
  counts: Map<Score, number>;
  unscored: number;
  total: number;
  flaggedCounts: Record<FlagKind, number>;
  selectedScores: ReadonlySet<Score>;
  selectedFlags: ReadonlySet<FlagKind>;
  autoAdvance: boolean;
  preset: Preset;
  /** 現在フォーカス中のプロポーザルが、表示中の何番目か（未フォーカスなら index は null） */
  position: { index: number | null; visible: number };
}

export interface BarCallbacks {
  onToggleScore: (score: Score) => void;
  onToggleFlag: (kind: FlagKind) => void;
  onToggleAutoAdvance: (next: boolean) => void;
  onChangePreset: (preset: Preset) => void;
  onClearFilter: () => void;
}

let root: HTMLElement | null = null;
const scoreBadges = new Map<Score, HTMLButtonElement>();
let helpPanel: HTMLElement | null = null;
let helpButton: HTMLButtonElement | null = null;
let helpKeysEl: HTMLElement | null = null;

/** キー操作だけでは分からない、画面の読み方 */
const HELP_NOTES: readonly string[] = [
  'スコアのバッジをクリックすると、その点数を付けたものだけ表示します（複数選べます）。',
  'バッジの「3件 30%」は、その点数の件数と全体に対する割合です。',
  'タイトル横のチップが今の点数です。「未」はまだ採点していないもの。',
  'チップが点線枠のときは確定待ちです。最後の入力から350ms後に投票します。',
  '旗は2種類あります。意味づけは自由です（「よかったかも」「あとで確認」など）。',
  'フィルタ中は j / k でも、隠れているプロポーザルを飛ばして移動できます。',
];
const flagBadges = new Map<FlagKind, HTMLButtonElement>();
let clearButton: HTMLButtonElement;
let positionEl: HTMLElement;
let autoAdvanceInput: HTMLInputElement;
let presetSelect: HTMLSelectElement;
let hintEl: HTMLElement;

function badge(main: string, sub: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fvn-badge';

  const mainEl = document.createElement('span');
  mainEl.className = 'fvn-badge-main';
  mainEl.textContent = main;

  const subEl = document.createElement('span');
  subEl.className = 'fvn-badge-sub';
  subEl.textContent = sub;

  button.append(mainEl, subEl);
  return button;
}

function setBadge(button: HTMLButtonElement, main: string, sub: string): void {
  button.querySelector('.fvn-badge-main')!.textContent = main;
  button.querySelector('.fvn-badge-sub')!.textContent = sub;
}

/** ヘルプパネルを組み立てる。キー表の中身は renderBar でプリセットに合わせて差し替える */
function buildHelp(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'fvn-help';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '使い方');

  const title = document.createElement('h2');
  title.className = 'fvn-help-title';
  title.textContent = '使い方';
  panel.append(title);

  helpKeysEl = document.createElement('dl');
  helpKeysEl.className = 'fvn-help-keys';
  panel.append(helpKeysEl);

  const notes = document.createElement('ul');
  notes.className = 'fvn-help-notes';
  for (const note of HELP_NOTES) {
    const item = document.createElement('li');
    item.textContent = note;
    notes.append(item);
  }
  panel.append(notes);

  return panel;
}

/** 使い方パネルの開閉。open を省くとトグル */
export function toggleHelp(open?: boolean): void {
  if (!helpPanel || !helpButton) return;
  const next = open ?? helpPanel.hidden;
  helpPanel.hidden = !next;
  helpButton.setAttribute('aria-expanded', String(next));
}

export function mountBar(callbacks: BarCallbacks): void {
  if (root) return;

  root = document.createElement('div');
  root.id = 'fvn-bar';

  const scoreGroup = document.createElement('div');
  scoreGroup.className = 'fvn-group';
  for (const score of SCORES) {
    const button = badge(scoreLabel(score), '');
    button.dataset.score = String(score);
    button.addEventListener('click', () => callbacks.onToggleScore(score));
    scoreGroup.append(button);
    scoreBadges.set(score, button);
  }
  root.append(scoreGroup);

  const flagGroup = document.createElement('div');
  flagGroup.className = 'fvn-group';
  for (const kind of FLAG_KINDS) {
    const button = badge('⚑', '');
    button.classList.add('fvn-badge-flag');
    button.dataset.flag = kind;
    button.title = `${FLAG_LABEL[kind]}を付けたものだけ表示`;
    button.addEventListener('click', () => callbacks.onToggleFlag(kind));
    flagGroup.append(button);
    flagBadges.set(kind, button);
  }
  root.append(flagGroup);

  clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'fvn-clear';
  clearButton.textContent = 'フィルタ解除';
  clearButton.addEventListener('click', () => callbacks.onClearFilter());
  root.append(clearButton);

  positionEl = document.createElement('span');
  positionEl.className = 'fvn-position';
  root.append(positionEl);

  const spacer = document.createElement('span');
  spacer.className = 'fvn-spacer';
  root.append(spacer);

  presetSelect = document.createElement('select');
  presetSelect.className = 'fvn-preset';
  presetSelect.title = '操作方法のテンプレート';
  for (const preset of Object.keys(PRESET_LABEL) as Preset[]) {
    const option = document.createElement('option');
    option.value = preset;
    option.textContent = PRESET_LABEL[preset];
    presetSelect.append(option);
  }
  presetSelect.addEventListener('change', () =>
    callbacks.onChangePreset(presetSelect.value as Preset),
  );
  root.append(presetSelect);

  const label = document.createElement('label');
  label.className = 'fvn-toggle';
  autoAdvanceInput = document.createElement('input');
  autoAdvanceInput.type = 'checkbox';
  autoAdvanceInput.addEventListener('change', () =>
    callbacks.onToggleAutoAdvance(autoAdvanceInput.checked),
  );
  label.append(autoAdvanceInput, document.createTextNode('採点したら次へ'));
  root.append(label);

  hintEl = document.createElement('span');
  hintEl.className = 'fvn-hint';
  root.append(hintEl);

  helpButton = document.createElement('button');
  helpButton.type = 'button';
  helpButton.className = 'fvn-help-button';
  helpButton.textContent = '?';
  helpButton.title = '使い方（? キーでも開けます）';
  helpButton.setAttribute('aria-expanded', 'false');
  helpButton.addEventListener('click', () => toggleHelp());
  root.append(helpButton);

  helpPanel = buildHelp();
  root.append(helpPanel);

  document.body.append(root);
  document.body.classList.add('fvn-active');
}

export function renderBar(state: BarState): void {
  if (!root) return;

  for (const score of SCORES) {
    const button = scoreBadges.get(score)!;
    const count = state.counts.get(score) ?? 0;
    const ratio = state.total > 0 ? Math.round((count / state.total) * 100) : 0;

    setBadge(button, scoreLabel(score), `${count}件 ${ratio}%`);
    button.classList.toggle('fvn-selected', state.selectedScores.has(score));
  }

  for (const kind of FLAG_KINDS) {
    const button = flagBadges.get(kind)!;
    setBadge(button, '⚑', `${state.flaggedCounts[kind]}件`);
    button.classList.toggle('fvn-selected', state.selectedFlags.has(kind));
  }

  clearButton.hidden = state.selectedFlags.size === 0 && state.selectedScores.size === 0;

  const unscored = state.unscored > 0 ? ` / 未採点 ${state.unscored}` : '';
  positionEl.textContent = `${state.position.index ?? '-'}/${state.position.visible}${unscored}`;

  autoAdvanceInput.checked = state.autoAdvance;
  presetSelect.value = state.preset;
  hintEl.textContent = presetHint(state.preset);

  // キー表はプリセットが変わったときだけ組み直す（renderBar は頻繁に呼ばれるので）
  if (helpKeysEl && helpKeysEl.dataset.preset !== state.preset) {
    helpKeysEl.dataset.preset = state.preset;
    helpKeysEl.replaceChildren();
    for (const { keys, action } of PRESET_KEYS[state.preset]) {
      const dt = document.createElement('dt');
      dt.textContent = keys;
      const dd = document.createElement('dd');
      dd.textContent = action;
      helpKeysEl.append(dt, dd);
    }
  }
}
