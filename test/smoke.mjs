/**
 * ビルド済み content script を jsdom 上で動かすスモークテスト。
 *   node test/smoke.mjs   （事前に npm run build）
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildPage, castVote, wireActiveOnClick, wireVoteOnClick } from './fixture.mjs';

const bundle = readFileSync(new URL('../dist/content.js', import.meta.url), 'utf8');
const scores = [2, 2, 1, 1, 1, 0, 0, 0, -1, -2];

const dom = new JSDOM(buildPage(scores), {
  url: 'https://fortee.jp/dummy-conf-2026/organizer/proposals/vote/index',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;

window.Element.prototype.scrollIntoView = function scrollIntoView() {};
wireActiveOnClick(document);
const votes = wireVoteOnClick(document);

const stored = {};
window.chrome = {
  storage: {
    local: {
      get: async (key) => (key in stored ? { [key]: stored[key] } : {}),
      set: async (obj) => Object.assign(stored, obj),
    },
  },
};

// 再描画が無限ループしていないかを見るため、rAF の呼び出し回数を数えておく
let rafCount = 0;
const rawRaf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (cb) => {
  rafCount += 1;
  return rawRaf(cb);
};

window.eval(bundle);

const tick = (ms = 30) => new Promise((resolve) => window.setTimeout(resolve, ms));
const bar = () => document.querySelector('#fvn-bar');
const badgeOf = (score) => bar().querySelector(`.fvn-badge[data-score="${score}"]`);
const flagBadgeOf = (kind) => bar().querySelector(`.fvn-badge[data-flag="${kind}"]`);
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const press = (key, shiftKey = false) =>
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
const proposals = () => [...document.querySelectorAll('.proposal4staffvote')];
const visible = () => proposals().filter((el) => !el.classList.contains('fvn-hidden'));
const activeTitle = () => document.querySelector('.proposal4staffvote.active .title h2').textContent;
const focus = (index) => click(proposals()[index].querySelector('.title h2'));

await tick();

/* ------------------------------------------------------------- サマリー */

assert.ok(bar(), 'サマリーバーが挿入される');
assert.match(badgeOf(2).textContent, /2件 20%/, '+2 は 2件 = 全体の20%');
assert.match(badgeOf(1).textContent, /3件 30%/, '+1 は 3件 = 全体の30%');

const chips = [...document.querySelectorAll('.fvn-chip')].map((c) => c.textContent);
assert.equal(chips.length, scores.length, '全プロポーザルにスコアチップが付く');
assert.deepEqual(chips.slice(0, 3), ['+2', '+2', '+1'], 'チップの表示が採点と一致する');

/* --------------------------------------------------------------- フラグ */

focus(0);
press('z');
await tick();
focus(3);
press('x');
await tick();

const savedFlags = stored['flags:dummy-conf-2026'];
assert.equal(savedFlags.left.length, 1, '左旗が保存される');
assert.equal(savedFlags.right.length, 1, '右旗が保存される');
assert.notEqual(savedFlags.left[0], savedFlags.right[0], '左旗と右旗は別のプロポーザルに付く');
assert.equal(
  document.querySelectorAll('.proposal4staffvote.fvn-flag-left').length,
  1,
  '左旗の見た目が付く',
);
assert.equal(
  document.querySelectorAll('.proposal4staffvote.fvn-flag-right').length,
  1,
  '右旗の見た目が付く',
);
assert.match(flagBadgeOf('left').textContent, /1件/, 'バーに左旗の件数が出る');
assert.match(flagBadgeOf('right').textContent, /1件/, 'バーに右旗の件数が出る');

// shift + x で右旗の次へジャンプ
focus(0);
press('x', true);
await tick();
assert.equal(activeTitle(), 'ダミーセッション 4', 'shift+x は右旗の付いたものへ飛ぶ');

// 旗フィルタ（左右は OR）
click(flagBadgeOf('left'));
click(flagBadgeOf('right'));
await tick();
assert.equal(visible().length, 2, '左旗・右旗のフィルタは和集合');
click(bar().querySelector('.fvn-clear'));
await tick();

/* ------------------------------------------------------------- フィルタ */

click(badgeOf(1));
await tick();
assert.equal(visible().length, 3, '+1 のフィルタで3件だけ残る');

focus(0); // 隠れている要素にフォーカスを戻してから
press('j');
await tick();
assert.equal(activeTitle(), 'ダミーセッション 3', 'フィルタ中の j は隠れた要素を飛ばす');

click(bar().querySelector('.fvn-clear'));
await tick();
assert.equal(visible().length, scores.length, 'フィルタ解除で全件表示に戻る');

/* --------------------------------------------------- 採点したら次へ進む */

focus(8);
const before = document.querySelector('.proposal4staffvote.active');
castVote(before, -2); // ページ側の数字キーで採点した場合を模す
await tick(400);
assert.equal(activeTitle(), 'ダミーセッション 10', '採点後に次へ進む');
assert.match(badgeOf(-2).textContent, /2件/, '採点がサマリーに反映される');

/* ------------------------------------------------- 矢印キープリセット */

const autoAdvance = bar().querySelector('.fvn-toggle input');
autoAdvance.checked = false;
autoAdvance.dispatchEvent(new window.Event('change', { bubbles: true }));

const preset = bar().querySelector('.fvn-preset');
preset.value = 'arrows';
preset.dispatchEvent(new window.Event('change', { bubbles: true }));
await tick();
assert.equal(stored.settings.preset, 'arrows', 'プリセットが保存される');

focus(5); // 0 点のプロポーザル
votes.clicks = 0;
press('ArrowLeft');
press('ArrowLeft');
await tick();
assert.equal(votes.clicks, 0, '連打の途中では投票しない');
assert.equal(
  proposals()[5].querySelector('.fvn-chip').textContent,
  '+2',
  '確定前でもチップに入力中の点数が出る',
);

await tick(400);
assert.equal(votes.clicks, 1, '連打はまとめて1回の投票になる');
assert.equal(
  proposals()[5].querySelector('.scores button.btn-primary').textContent,
  '+2',
  '← 2回で 0 から +2 になる（画面のボタン並びどおり）',
);

press('ArrowRight');
await tick(400);
assert.equal(
  proposals()[5].querySelector('.scores button.btn-primary').textContent,
  '+1',
  '→ で低い点数の方向へ1段戻る',
);

press('ArrowDown');
await tick();
assert.equal(activeTitle(), 'ダミーセッション 7', '↓ で次のプロポーザルへ移動する');
press('ArrowUp');
await tick();
assert.equal(activeTitle(), 'ダミーセッション 6', '↑ で前のプロポーザルへ移動する');

/* ------------------------------------------------- 未採点の取り消し */

const unscored = proposals()[8];
castVote(unscored, null); // ページ側で未採点の状態を作る
focus(8);
await tick();
votes.clicks = 0;
press('ArrowLeft');
press('ArrowRight');
await tick(400);
assert.equal(votes.clicks, 0, '未採点で ←→ と戻したら投票しない');
assert.equal(unscored.querySelector('.fvn-chip').textContent, '未', 'チップも未採点のまま');

/* ------------------------------------------------- 再描画ループの停止 */

await tick(100);
const rafBefore = rafCount;
await tick(200);
assert.equal(rafCount, rafBefore, 'アイドル時に MutationObserver → render のループが回らない');

console.log('smoke: all assertions passed');

dom.window.close();
