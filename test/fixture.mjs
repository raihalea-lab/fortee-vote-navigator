/**
 * fortee のスタッフ投票ページの構造を模したフィクスチャ。
 * 実際のCfP本文は採択前の非公開情報なのでリポジトリには置かず、ダミーを使う。
 */
export const SCORE_ORDER = [2, 1, 0, -1, -2];

export function buildPage(scores) {
  const proposals = scores
    .map((score, i) => {
      const buttons = SCORE_ORDER.map(
        (s) =>
          `<button data-v-x class="btn ${s === score ? 'btn-primary' : 'btn-outline-secondary'}">${
            s > 0 ? `+${s}` : s
          }</button>`,
      ).join('');
      return `
      <div data-v-x class="proposal4staffvote${i === 0 ? ' active' : ''}">
        <div data-v-x class="proposal">
          <div data-v-x class="length">CFPセッション(15分)</div>
          <div data-v-x class="title"><h2 data-v-x>ダミーセッション ${i + 1}</h2></div>
          <div data-v-x class="abstract">概要 ${i + 1}</div>
        </div>
        <div data-v-x class="scores">${buttons}</div>
      </div>`;
    })
    .join('');

  return `<!doctype html><html><body><div id="list">${proposals}</div></body></html>`;
}

/** ページ側の「タイトルをクリックすると .active が移る」挙動を再現する */
export function wireActiveOnClick(document) {
  document.querySelectorAll('.proposal4staffvote').forEach((el) => {
    el.querySelector('.title h2').addEventListener('click', () => {
      document
        .querySelectorAll('.proposal4staffvote.active')
        .forEach((a) => a.classList.remove('active'));
      el.classList.add('active');
    });
  });
}

/** ページ側の採点（ボタンのクラス付け替え）を再現する */
export function castVote(el, score) {
  const buttons = [...el.querySelectorAll('.scores button')];
  buttons.forEach((b, i) => {
    b.classList.toggle('btn-primary', SCORE_ORDER[i] === score);
    b.classList.toggle('btn-outline-secondary', SCORE_ORDER[i] !== score);
  });
}

/**
 * ページ側の「採点ボタンをクリックすると投票が確定する」挙動を再現する。
 * 実ページでは Vue が $emit("vote") を出してボタンのクラスを付け替えている。
 * 返り値でクリック回数を数えられるようにしておく（連打が 1 票にまとまるかの確認用）。
 */
export function wireVoteOnClick(document) {
  const counter = { clicks: 0 };
  document.querySelectorAll('.proposal4staffvote').forEach((el) => {
    [...el.querySelectorAll('.scores button')].forEach((button, i) => {
      button.addEventListener('click', () => {
        counter.clicks += 1;
        castVote(el, SCORE_ORDER[i]);
      });
    });
  });
  return counter;
}
