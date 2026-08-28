/**
 * fortee のスタッフ投票ページ（/{conference}/organizer/proposals/vote/index）に対する
 * DOM アダプタ。ページ側の構造への依存をこのファイルに閉じ込める。
 *
 * 観測した構造（2026-08 時点）:
 *   div.proposal4staffvote[.active]
 *     div.proposal
 *       div.length          … "CFPセッション(15分)" など
 *       div.title > h2      … タイトル
 *       div.abstract        … 本文
 *     div.scores
 *       button.btn.btn-primary            … 選択中のスコア
 *       button.btn.btn-outline-secondary  … 未選択（左から +2, +1, 0, -1, -2）
 *
 * プロポーザルIDは DOM 上に存在しないため、識別子はタイトルのハッシュを使う。
 */
import { SCORES, type Score } from './types';

export const PROPOSAL_SELECTOR = '.proposal4staffvote';
const ACTIVE_CLASS = 'active';
const SELECTED_BUTTON_CLASS = 'btn-primary';

export function listProposals(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(PROPOSAL_SELECTOR));
}

export function scoreButtons(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('.scores button'));
}

/** 未採点なら null */
export function readScore(el: HTMLElement): Score | null {
  const index = scoreButtons(el).findIndex((b) => b.classList.contains(SELECTED_BUTTON_CLASS));
  return index < 0 ? null : ((2 - index) as Score);
}

export function titleOf(el: HTMLElement): string {
  return el.querySelector('.title h2')?.textContent?.trim() ?? '';
}

export function titleContainer(el: HTMLElement): HTMLElement | null {
  return el.querySelector<HTMLElement>('.title');
}

export function isActive(el: HTMLElement): boolean {
  return el.classList.contains(ACTIVE_CLASS);
}

export function activeProposal(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`${PROPOSAL_SELECTOR}.${ACTIVE_CLASS}`);
}

/**
 * ページ側のフォーカス（.active）を移す。
 * タイトルのクリックでページ側の内部状態ごと切り替わるため、
 * クラスを直接いじらずクリックで済ませる。
 */
export function focusProposal(el: HTMLElement): void {
  const target = el.querySelector<HTMLElement>('.title h2') ?? el;
  target.click();
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/** URL の先頭セグメント（例: jawsfesta-2026）。イベントごとに保存領域を分けるために使う */
export function conferenceSlug(): string {
  return location.pathname.split('/').filter(Boolean)[0] ?? 'unknown';
}

/**
 * タイトルから安定した短い識別子を作る（djb2）。
 * CfP 本文を保存領域に残さないよう、タイトルそのものではなくハッシュを鍵にする。
 */
export function proposalKey(el: HTMLElement): string {
  const title = titleOf(el);
  let hash = 5381;
  for (let i = 0; i < title.length; i += 1) {
    hash = ((hash * 33) ^ title.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/** プロポーザル一覧を含む、監視対象にすべき要素 */
export function listRoot(): HTMLElement {
  const first = document.querySelector<HTMLElement>(PROPOSAL_SELECTOR);
  return first?.parentElement ?? document.body;
}

/** 採点ボタンをクリックしてスコアを確定する（ページ側の $emit("vote") が走る） */
export function clickScore(el: HTMLElement, score: Score): void {
  const index = SCORES.indexOf(score);
  scoreButtons(el)[index]?.click();
}
