import './styles.css';
import { mountBar, renderBar, toggleHelp, type BarState } from './bar';
import {
  activeProposal,
  clickScore,
  focusProposal,
  isActive,
  listProposals,
  listRoot,
  proposalKey,
  readScore,
  titleContainer,
} from './page';
import { emptyFlags, loadFlags, loadSettings, saveFlags, saveSettings, type FlagSets } from './storage';
import {
  DEFAULT_SETTINGS,
  FLAG_KINDS,
  SCORES,
  scoreLabel,
  type FlagKind,
  type Preset,
  type Score,
  type Settings,
} from './types';

const CHIP_CLASS = 'fvn-chip';
const HIDDEN_CLASS = 'fvn-hidden';
const FLAG_CLASS: Record<FlagKind, string> = { left: 'fvn-flag-left', right: 'fvn-flag-right' };

/** 採点後、ページ側が自分で移動しなかった場合に拡張が進めるまでの待ち時間 */
const ADVANCE_DELAY_MS = 250;
/** 矢印キーの連打を 1 回の投票にまとめるための待ち時間 */
const COMMIT_DELAY_MS = 350;

/** 左旗・右旗のキー（shift 併用でその旗の次へジャンプ） */
const FLAG_KEY: Record<string, FlagKind> = { z: 'left', x: 'right' };

let flags: FlagSets = emptyFlags();
let settings: Settings = DEFAULT_SETTINGS;
const selectedScores = new Set<Score>();
const selectedFlags = new Set<FlagKind>();

/** 直前に読んだスコア。採点されたことを検知するために保持する */
const previousScores = new WeakMap<HTMLElement, Score | null>();

/** 矢印キーで動かしている最中の、まだ確定していないスコア */
let pending: { el: HTMLElement; score: Score } | null = null;
let commitTimer = 0;

/* ------------------------------------------------------------------ 表示 */

function isVisible(el: HTMLElement): boolean {
  return !el.classList.contains(HIDDEN_CLASS);
}

function flagsOf(el: HTMLElement): FlagKind[] {
  const key = proposalKey(el);
  return FLAG_KINDS.filter((kind) => flags[kind].has(key));
}

function matchesFilter(el: HTMLElement): boolean {
  if (selectedFlags.size > 0) {
    const own = flagsOf(el);
    if (!own.some((kind) => selectedFlags.has(kind))) return false;
  }
  if (selectedScores.size > 0) {
    const score = readScore(el);
    if (score === null || !selectedScores.has(score)) return false;
  }
  return true;
}

/** タイトル横に現在のスコアをチップとして出す（本文が長くても採点が見えるように） */
function renderChip(el: HTMLElement): void {
  const container = titleContainer(el);
  if (!container) return;

  let chip = container.querySelector<HTMLElement>(`.${CHIP_CLASS}`);
  if (!chip) {
    chip = document.createElement('span');
    chip.className = CHIP_CLASS;
    container.prepend(chip);
  }

  const isPending = pending !== null && pending.el === el;
  const score = isPending ? pending!.score : readScore(el);
  // textContent への代入は同じ値でもテキストノードを作り直し、
  // MutationObserver → render → ここ、の無限ループになる。変化したときだけ書く。
  const text = score === null ? '未' : scoreLabel(score);
  if (chip.textContent !== text) chip.textContent = text;
  chip.dataset.score = score === null ? 'none' : String(score);
  chip.classList.toggle('fvn-chip-pending', isPending);
}

function render(): void {
  const proposals = listProposals();
  const counts = new Map<Score, number>(SCORES.map((score) => [score, 0]));
  const flaggedCounts: Record<FlagKind, number> = { left: 0, right: 0 };
  let unscored = 0;

  for (const el of proposals) {
    const score = readScore(el);
    if (score === null) unscored += 1;
    else counts.set(score, (counts.get(score) ?? 0) + 1);

    for (const kind of FLAG_KINDS) {
      const has = flags[kind].has(proposalKey(el));
      if (has) flaggedCounts[kind] += 1;
      el.classList.toggle(FLAG_CLASS[kind], has);
    }

    el.classList.toggle(HIDDEN_CLASS, !matchesFilter(el));
    renderChip(el);
  }

  const visible = proposals.filter(isVisible);
  const active = activeProposal();
  const activeIndex = active ? visible.indexOf(active) : -1;

  const state: BarState = {
    counts,
    unscored,
    total: proposals.length,
    flaggedCounts,
    selectedScores,
    selectedFlags,
    autoAdvance: settings.autoAdvance,
    preset: settings.preset,
    position: { index: activeIndex >= 0 ? activeIndex + 1 : null, visible: visible.length },
  };
  renderBar(state);
}

/* ------------------------------------------------------------------ 移動 */

/**
 * 表示中のプロポーザルだけを辿ってフォーカスを移す。
 * フィルタで隠れた要素をページ側の j/k が拾ってしまうのを避けるため、
 * フィルタ中は独自に移動する。
 */
function moveFocus(direction: 1 | -1): void {
  commitPending();
  const proposals = listProposals();
  const active = activeProposal();
  const start = active ? proposals.indexOf(active) : direction > 0 ? -1 : proposals.length;

  for (let i = start + direction; i >= 0 && i < proposals.length; i += direction) {
    const candidate = proposals[i];
    if (candidate && isVisible(candidate)) {
      focusProposal(candidate);
      return;
    }
  }
}

function jumpToNextFlagged(kind: FlagKind): void {
  commitPending();
  const proposals = listProposals();
  const active = activeProposal();
  const start = active ? proposals.indexOf(active) : -1;

  for (let step = 1; step <= proposals.length; step += 1) {
    const candidate = proposals[(start + step + proposals.length) % proposals.length];
    if (candidate && flags[kind].has(proposalKey(candidate)) && isVisible(candidate)) {
      focusProposal(candidate);
      return;
    }
  }
}

/**
 * 採点直後に次へ進む。ページ側が既に移動していた場合は何もしない
 * （二重に飛ばさないための確認）。
 */
function scheduleAdvance(from: HTMLElement): void {
  window.setTimeout(() => {
    if (activeProposal() === from) moveFocus(1);
  }, ADVANCE_DELAY_MS);
}

/* -------------------------------------------------------------- 矢印で採点 */

/**
 * スコアを 1 段ずらす。direction は画面上のボタンの並び（+2 +1 0 -1 -2）に対応し、
 * -1 が左（高得点方向）、+1 が右（低得点方向）。
 * 連打の途中経過で投票が飛ばないよう、少し待ってから確定させる。
 */
function stepScore(direction: 1 | -1): void {
  const active = activeProposal();
  if (!active) return;
  if (pending && pending.el !== active) commitPending();

  const base = pending?.score ?? readScore(active) ?? 0;
  const next = SCORES[SCORES.indexOf(base) + direction];
  if (next === undefined) return;

  pending = { el: active, score: next };
  renderChip(active);

  window.clearTimeout(commitTimer);
  commitTimer = window.setTimeout(commitPending, COMMIT_DELAY_MS);
}

function commitPending(): void {
  window.clearTimeout(commitTimer);
  const target = pending;
  pending = null;
  if (!target) return;

  const current = readScore(target.el);
  // 未採点のまま 0 に戻ってきた場合は「取り消し」とみなして投票しない。
  // ponytail: 未採点から矢印だけで 0 を付けることはできなくなる（fortee 側の 3 キー / 0 ボタンを使う）
  if (current === target.score || (current === null && target.score === 0)) renderChip(target.el);
  else clickScore(target.el, target.score);
}

/* ------------------------------------------------------------------ 操作 */

async function toggleFlagOnActive(kind: FlagKind): Promise<void> {
  const active = activeProposal();
  if (!active) return;

  const key = proposalKey(active);
  if (flags[kind].has(key)) flags[kind].delete(key);
  else flags[kind].add(key);

  await saveFlags(flags);
  render();
}

function toggleScoreFilter(score: Score): void {
  if (selectedScores.has(score)) selectedScores.delete(score);
  else selectedScores.add(score);
  render();
}

function toggleFlagFilter(kind: FlagKind): void {
  if (selectedFlags.has(kind)) selectedFlags.delete(kind);
  else selectedFlags.add(kind);
  render();
}

function clearFilter(): void {
  selectedScores.clear();
  selectedFlags.clear();
  render();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;

  const key = event.key.toLowerCase();
  const stop = (): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  if (event.key === '?') {
    stop();
    toggleHelp();
    return;
  }
  // Escape はページ側にも渡す（拡張が握り潰すと他の操作を妨げるので）
  if (event.key === 'Escape') {
    toggleHelp(false);
    return;
  }

  const flagKind = FLAG_KEY[key];
  if (flagKind) {
    stop();
    if (event.shiftKey) jumpToNextFlagged(flagKind);
    else void toggleFlagOnActive(flagKind);
    return;
  }

  if (settings.preset === 'arrows' && !event.shiftKey) {
    switch (event.key) {
      case 'ArrowDown':
        stop();
        moveFocus(1);
        return;
      case 'ArrowUp':
        stop();
        moveFocus(-1);
        return;
      case 'ArrowLeft':
        stop();
        stepScore(-1);
        return;
      case 'ArrowRight':
        stop();
        stepScore(1);
        return;
      default:
        break;
    }
  }

  const filtering = selectedFlags.size > 0 || selectedScores.size > 0;
  if (filtering && !event.shiftKey && (key === 'j' || key === 'k')) {
    stop();
    moveFocus(key === 'j' ? 1 : -1);
  }
}

/* ------------------------------------------------------------------ 監視 */

/** 採点結果とフォーカスの変化を拾って再描画する */
function observe(): void {
  let queued = false;

  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;

      let justScored: HTMLElement | null = null;
      for (const el of listProposals()) {
        const score = readScore(el);
        if (previousScores.has(el) && previousScores.get(el) !== score && isActive(el)) {
          justScored = el;
        }
        previousScores.set(el, score);
      }

      render();
      if (justScored && settings.autoAdvance && pending === null) scheduleAdvance(justScored);
    });
  });

  observer.observe(listRoot(), {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class'],
  });
}

/* -------------------------------------------------------------------- 起動 */

function setPreset(preset: Preset): void {
  settings = { ...settings, preset };
  void saveSettings(settings);
  render();
}

/** ページは Vue 製なので、document_idle の時点でまだ一覧が描画されていないことがある */
function waitForProposals(): Promise<void> {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (listProposals().length === 0) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.body, { subtree: true, childList: true });
  });
}

async function main(): Promise<void> {
  if (listProposals().length === 0) await waitForProposals();

  [flags, settings] = await Promise.all([loadFlags(), loadSettings()]);
  for (const el of listProposals()) previousScores.set(el, readScore(el));

  mountBar({
    onToggleScore: toggleScoreFilter,
    onToggleFlag: toggleFlagFilter,
    onToggleAutoAdvance: (next) => {
      settings = { ...settings, autoAdvance: next };
      void saveSettings(settings);
      render();
    },
    onChangePreset: setPreset,
    onClearFilter: clearFilter,
  });

  render();
  observe();
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('blur', commitPending);
}

void main();
