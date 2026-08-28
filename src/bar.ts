/** 画面下部に固定表示するサマリーバー */
import {
  FLAG_KINDS,
  FLAG_LABEL,
  PRESET_HINT,
  PRESET_LABEL,
  SCORES,
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
  hintEl.textContent = PRESET_HINT[state.preset];
}
