// ============================================================
// popup.js — ポップアップUI ロジック
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const wordCountEl = document.getElementById('word-count');
  const wordListEl = document.getElementById('word-list');
  const emptyStateEl = document.getElementById('empty-state');
  const btnPrint = document.getElementById('btn-print');
  const btnSettings = document.getElementById('btn-settings');

  // --- 初期データ読み込み ---
  await loadAndRender();

  // --- ストレージ変更の監視（リアルタイム更新） ---
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.words) {
      renderWords(changes.words.newValue || []);
    }
  });

  // --- 印刷プレビューボタン ---
  btnPrint.addEventListener('click', async () => {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('print.html')
    });
    // ポップアップは自動で閉じる
  });

  // --- 設定ボタン ---
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // ============================================================
  // データの読み込みと描画
  // ============================================================
  async function loadAndRender() {
    const { words = [] } = await chrome.storage.local.get('words');
    renderWords(words);
  }

  // ============================================================
  // 単語リストの描画
  // ============================================================
  function renderWords(words) {
    // カウンター更新（アニメーション付き）
    animateCounter(words.length);

    // 印刷ボタンの状態
    btnPrint.disabled = words.length === 0;

    // リスト描画（最新のものが上、最大10件）
    const recentWords = [...words].reverse().slice(0, 10);

    if (recentWords.length === 0) {
      wordListEl.innerHTML = '';
      wordListEl.appendChild(createEmptyState());
      return;
    }

    wordListEl.innerHTML = '';
    recentWords.forEach((wordData, idx) => {
      const item = createWordItem(wordData, idx);
      wordListEl.appendChild(item);
    });
  }

  // ============================================================
  // 空の状態要素を作成
  // ============================================================
  function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <div class="empty-icon">📚</div>
      <p>まだ単語がありません</p>
      <p class="empty-hint">Webページ上で英単語を選択して<br>「単語帳に追加」をクリック！</p>
    `;
    return div;
  }

  // ============================================================
  // 単語アイテム要素を作成
  // ============================================================
  function createWordItem(wordData, index) {
    const item = document.createElement('div');
    item.className = 'word-item';
    item.style.animationDelay = `${index * 50}ms`;

    const info = document.createElement('div');
    info.className = 'word-info';

    const english = document.createElement('div');
    english.className = 'word-english';
    english.textContent = wordData.word;

    const meaning = document.createElement('div');
    meaning.className = 'word-meaning';
    meaning.textContent = wordData.meaning || '（翻訳中...）';

    info.appendChild(english);
    info.appendChild(meaning);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'この単語を削除';
    deleteBtn.addEventListener('click', async () => {
      await deleteWord(wordData.id);
    });

    item.appendChild(info);
    item.appendChild(deleteBtn);

    return item;
  }

  // ============================================================
  // 単語削除
  // ============================================================
  async function deleteWord(id) {
    const { words = [] } = await chrome.storage.local.get('words');
    const updated = words.filter(w => w.id !== id);
    await chrome.storage.local.set({ words: updated });
    renderWords(updated);
  }

  // ============================================================
  // カウンターアニメーション
  // ============================================================
  function animateCounter(target) {
    const current = parseInt(wordCountEl.textContent) || 0;
    if (current === target) return;

    const duration = 400;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // イージング
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(current + (target - current) * eased);
      wordCountEl.textContent = value;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        wordCountEl.textContent = target;
        wordCountEl.classList.add('pulse');
        setTimeout(() => wordCountEl.classList.remove('pulse'), 400);
      }
    }

    requestAnimationFrame(update);
  }
});
