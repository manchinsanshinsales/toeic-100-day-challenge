// ============================================================
// print.js — 印刷プレビュー＆印刷ロジック
// A4名刺10面（エーワン互換）の両面印刷レイアウト生成
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const printPreview = document.getElementById('print-preview');
  const previewEmpty = document.getElementById('preview-empty');
  const cardInfo = document.getElementById('card-info');
  const btnDoPrint = document.getElementById('btn-do-print');
  const btnBack = document.getElementById('btn-back');
  const clearAfterPrint = document.getElementById('clear-after-print');

  // プレビュー切替ボタン
  const toggleBtns = document.querySelectorAll('.toggle-btn');

  // 余白スライダー
  const marginSliders = {
    top: document.getElementById('margin-top'),
    bottom: document.getElementById('margin-bottom'),
    left: document.getElementById('margin-left'),
    right: document.getElementById('margin-right')
  };
  const marginValues = {
    top: document.getElementById('margin-top-val'),
    bottom: document.getElementById('margin-bottom-val'),
    left: document.getElementById('margin-left-val'),
    right: document.getElementById('margin-right-val')
  };

  // 1ページあたりのカード数
  const CARDS_PER_PAGE = 10;
  let currentFace = 'front'; // 'front' | 'back' | 'both'
  let words = [];

  // --- 初期化 ---
  await loadSettings();
  await loadAndRender();

  // --- 余白スライダーイベント ---
  Object.entries(marginSliders).forEach(([direction, slider]) => {
    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value).toFixed(1);
      marginValues[direction].textContent = val;
      // CSS変数でリアルタイム反映
      document.documentElement.style.setProperty(
        `--adjust-${direction}`,
        `${val}mm`
      );
    });
  });

  // --- プレビュー切替 ---
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFace = btn.dataset.face;
      renderPages();
    });
  });

  // --- 印刷ボタン ---
  btnDoPrint.addEventListener('click', async () => {
    // 印刷時は両面を表示
    const prevFace = currentFace;
    currentFace = 'both';
    renderPages();

    // 少し遅延して印刷ダイアログを開く
    await new Promise(r => setTimeout(r, 200));
    window.print();

    // 印刷後の処理
    if (clearAfterPrint.checked) {
      const confirmed = confirm('印刷済みの単語をすべて削除しますか？');
      if (confirmed) {
        await chrome.storage.local.set({ words: [] });
        words = [];
        renderPages();
      }
    }

    // プレビュー状態を元に戻す
    currentFace = prevFace;
    renderPages();
  });

  // --- 戻るボタン ---
  btnBack.addEventListener('click', () => {
    window.close();
  });

  // ============================================================
  // 設定の読み込み
  // ============================================================
  async function loadSettings() {
    const { printSettings = {} } = await chrome.storage.local.get('printSettings');

    // 余白調整値を復元
    ['top', 'bottom', 'left', 'right'].forEach(dir => {
      const val = printSettings[`margin_${dir}`] || 0;
      marginSliders[dir].value = val;
      marginValues[dir].textContent = parseFloat(val).toFixed(1);
      document.documentElement.style.setProperty(`--adjust-${dir}`, `${val}mm`);
    });
  }

  // ============================================================
  // データの読み込みと描画
  // ============================================================
  async function loadAndRender() {
    const result = await chrome.storage.local.get('words');
    words = result.words || [];
    renderPages();
  }

  // ============================================================
  // ページ描画（おもて面・うら面を動的に生成）
  // ============================================================
  function renderPages() {
    // 既存のページを削除（空の状態メッセージ以外）
    const existingPages = printPreview.querySelectorAll('.print-page');
    existingPages.forEach(p => p.remove());

    if (words.length === 0) {
      previewEmpty.style.display = 'flex';
      cardInfo.textContent = '0 語 / 0 ページ';
      return;
    }

    previewEmpty.style.display = 'none';

    // 10個ずつのグループに分割
    const groups = [];
    for (let i = 0; i < words.length; i += CARDS_PER_PAGE) {
      groups.push(words.slice(i, i + CARDS_PER_PAGE));
    }

    const totalPages = currentFace === 'both' ? groups.length * 2 : groups.length;
    cardInfo.textContent = `${words.length} 語 / ${totalPages} ページ`;

    // 各グループについてページを生成
    groups.forEach((group, groupIdx) => {
      if (currentFace === 'front' || currentFace === 'both') {
        const frontPage = createPage(group, 'front', groupIdx + 1, groups.length);
        printPreview.appendChild(frontPage);
      }

      if (currentFace === 'back' || currentFace === 'both') {
        const backPage = createPage(group, 'back', groupIdx + 1, groups.length);
        printPreview.appendChild(backPage);
      }
    });
  }

  // ============================================================
  // ページ要素の作成
  // ============================================================
  function createPage(group, face, pageNum, totalGroups) {
    const page = document.createElement('div');
    page.className = 'print-page';

    // ページラベル（画面表示用、印刷時は非表示）
    const label = document.createElement('div');
    label.className = 'page-label';
    const faceLabel = face === 'front' ? 'おもて面（英語）' : 'うら面（日本語）';
    label.textContent = `${faceLabel} — グループ ${pageNum} / ${totalGroups}`;
    page.appendChild(label);

    // カードグリッド
    const grid = document.createElement('div');
    grid.className = `card-grid ${face === 'back' ? 'back-face' : ''}`;

    // 10面分のカードを生成（不足分は空カード）
    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      const wordData = group[i];
      const card = wordData
        ? createCard(wordData, face)
        : createEmptyCard();
      grid.appendChild(card);
    }

    page.appendChild(grid);
    return page;
  }

  // ============================================================
  // おもて面カードの作成
  // ============================================================
  function createFrontCard(wordData) {
    const card = document.createElement('div');
    card.className = 'card front';

    const word = document.createElement('div');
    word.className = 'card-word';
    word.textContent = wordData.word;

    const pron = document.createElement('div');
    pron.className = 'card-pronunciation';
    pron.textContent = wordData.pronunciation || '';

    card.appendChild(word);
    card.appendChild(pron);
    return card;
  }

  // ============================================================
  // うら面カードの作成
  // ============================================================
  function createBackCard(wordData) {
    const card = document.createElement('div');
    card.className = 'card back';

    const meaning = document.createElement('div');
    meaning.className = 'card-meaning';
    meaning.textContent = wordData.meaning || '（翻訳なし）';

    card.appendChild(meaning);

    if (wordData.toeicContext) {
      const toeic = document.createElement('div');
      toeic.className = 'card-toeic';
      toeic.textContent = `📍 ${wordData.toeicContext}`;
      card.appendChild(toeic);
    }

    const example = document.createElement('div');
    example.className = 'card-example';
    example.textContent = wordData.exampleSentence || wordData.context || '';
    card.appendChild(example);

    if (wordData.url) {
      const url = document.createElement('div');
      url.className = 'card-url';
      url.textContent = `📎 ${wordData.url}`;
      card.appendChild(url);
    }

    return card;
  }

  // ============================================================
  // カード作成（面を判定して分岐）
  // ============================================================
  function createCard(wordData, face) {
    return face === 'front'
      ? createFrontCard(wordData)
      : createBackCard(wordData);
  }

  // ============================================================
  // 空カードの作成
  // ============================================================
  function createEmptyCard() {
    const card = document.createElement('div');
    card.className = 'card empty';
    return card;
  }
});
