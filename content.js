// ============================================================
// content.js — コンテンツスクリプト
// Webページ上での単語選択検知 + 浮遊ボタン表示
// ============================================================

(() => {
  // --- 浮遊ボタンのホスト要素 ---
  let hostEl = null;
  let shadowRoot = null;
  let floatingBtn = null;
  let currentWord = '';
  let currentContext = '';

  // ============================================================
  // 初期化：Shadow DOM でホストページから隔離されたボタンを作成
  // ============================================================
  function initFloatingButton() {
    if (hostEl) return; // 既に初期化済み

    hostEl = document.createElement('div');
    hostEl.id = 'kami-tango-host';
    shadowRoot = hostEl.attachShadow({ mode: 'closed' });

    // Shadow DOM 内のスタイル
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: none;
      }
      .kami-tango-btn {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: #fff;
        border: none;
        border-radius: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4), 0 2px 4px rgba(0,0,0,0.2);
        opacity: 0;
        transform: scale(0.8);
        transition: opacity 300ms ease, transform 300ms ease, background 200ms ease;
        white-space: nowrap;
        line-height: 1;
      }
      .kami-tango-btn.visible {
        opacity: 1;
        transform: scale(1);
      }
      .kami-tango-btn:hover {
        background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
        box-shadow: 0 6px 24px rgba(99, 102, 241, 0.6), 0 2px 4px rgba(0,0,0,0.2);
        transform: scale(1.05);
      }
      .kami-tango-btn:active {
        transform: scale(0.95);
      }
      .kami-tango-btn.success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
      }
      .kami-tango-btn .icon {
        font-size: 16px;
        line-height: 1;
      }
    `;

    floatingBtn = document.createElement('button');
    floatingBtn.className = 'kami-tango-btn';
    floatingBtn.innerHTML = '<span class="icon">📝</span><span class="label">単語帳に追加</span>';

    floatingBtn.addEventListener('click', handleButtonClick);

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(floatingBtn);
    document.body.appendChild(hostEl);
  }

  // ============================================================
  // テキスト選択検知 — mouseup イベント
  // ============================================================
  document.addEventListener('mouseup', (e) => {
    // 浮遊ボタン自体のクリックは無視
    if (hostEl && hostEl.contains(e.target)) return;

    // 少し遅延させて選択範囲が確定してから処理
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (!selectedText || selectedText.length > 100) {
        hideButton();
        return;
      }

      // 選択範囲の位置を取得
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 文脈（前後の文）を取得
      currentWord = selectedText;
      currentContext = extractContextSentence(selection);

      showButton(rect);
    });
  });

  // 別の場所をクリックしたらボタンを隠す
  document.addEventListener('mousedown', (e) => {
    if (hostEl && hostEl.contains(e.target)) return;
    // 選択解除のクリックの場合、少し遅延して非表示
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection?.toString().trim()) {
        hideButton();
      }
    }, 100);
  });

  // ============================================================
  // 浮遊ボタンの表示/非表示
  // ============================================================
  function showButton(rect) {
    initFloatingButton();

    // ボタンを選択範囲の右下に配置
    const top = rect.bottom + window.scrollY + 8;
    const left = rect.right + window.scrollX + 4;

    hostEl.style.position = 'absolute';
    hostEl.style.top = `${top}px`;
    hostEl.style.left = `${left}px`;
    hostEl.style.pointerEvents = 'auto';

    // 画面外にはみ出す場合の調整
    requestAnimationFrame(() => {
      const btnRect = floatingBtn.getBoundingClientRect();
      if (btnRect.right > window.innerWidth - 8) {
        hostEl.style.left = `${rect.left + window.scrollX}px`;
      }
      if (btnRect.bottom > window.innerHeight - 8) {
        hostEl.style.top = `${rect.top + window.scrollY - btnRect.height - 8}px`;
      }
    });

    // ボタンのテキストをリセット
    const label = shadowRoot.querySelector('.label');
    const icon = shadowRoot.querySelector('.icon');
    label.textContent = '単語帳に追加';
    icon.textContent = '📝';
    floatingBtn.classList.remove('success');

    // フワッと出現するアニメーション
    floatingBtn.classList.remove('visible');
    requestAnimationFrame(() => {
      floatingBtn.classList.add('visible');
    });
  }

  function hideButton() {
    if (!floatingBtn) return;
    floatingBtn.classList.remove('visible');
  }

  // ============================================================
  // ボタンクリック — 単語を送信
  // ============================================================
  async function handleButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!currentWord) return;

    const label = shadowRoot.querySelector('.label');
    const icon = shadowRoot.querySelector('.icon');

    // 処理中表示
    label.textContent = '追加中...';
    icon.textContent = '⏳';

    try {
      await chrome.runtime.sendMessage({
        action: 'addWord',
        word: currentWord,
        context: currentContext,
        url: window.location.href
      });

      // 成功表示
      label.textContent = '追加しました';
      icon.textContent = '✓';
      floatingBtn.classList.add('success');

      // 1秒後にフェードアウト
      setTimeout(() => {
        hideButton();
      }, 1000);

    } catch (error) {
      console.error('単語追加エラー:', error);
      label.textContent = 'エラー';
      icon.textContent = '✗';
      setTimeout(() => hideButton(), 1500);
    }
  }

  // ============================================================
  // 文脈（コンテキスト）取得 — 選択箇所を含む文を抽出
  // ============================================================
  function extractContextSentence(selection) {
    try {
      if (!selection || selection.rangeCount === 0) return '';

      const range = selection.getRangeAt(0);
      // 選択箇所の親要素からテキストを取得
      let container = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }

      // 段落やブロック要素まで遡る
      const blockTags = ['P', 'DIV', 'LI', 'TD', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
      while (container && !blockTags.includes(container.tagName)) {
        container = container.parentElement;
      }

      if (!container) {
        container = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
          container = container.parentElement;
        }
      }

      const fullText = container?.innerText || '';
      const selectedText = selection.toString().trim();

      // 文を分割（英語のピリオド・疑問符・感嘆符、日本語の句点で区切る）
      const sentences = fullText.split(/(?<=[.!?。！？])\s*/);
      const selectedIndex = sentences.findIndex(s => s.includes(selectedText));

      if (selectedIndex === -1) {
        // 見つからない場合は前後200文字を返す
        const pos = fullText.indexOf(selectedText);
        if (pos === -1) return fullText.slice(0, 300);
        const start = Math.max(0, pos - 100);
        const end = Math.min(fullText.length, pos + selectedText.length + 100);
        return fullText.slice(start, end).trim();
      }

      // 前後1文ずつ含めて返す
      const startIdx = Math.max(0, selectedIndex - 1);
      const endIdx = Math.min(sentences.length, selectedIndex + 2);
      return sentences.slice(startIdx, endIdx).join(' ').trim();

    } catch (error) {
      console.warn('文脈取得エラー:', error);
      return '';
    }
  }

  // ============================================================
  // background.js からのメッセージ受信
  // ============================================================
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getContextSentence') {
      const selection = window.getSelection();
      const context = extractContextSentence(selection);
      sendResponse({ context });
      return false; // 同期レスポンス
    }

    if (message.action === 'showToast') {
      showToast(message.message);
      return false;
    }
  });

  // ============================================================
  // トースト通知（右クリックメニュー使用時のフィードバック）
  // ============================================================
  function showToast(message) {
    initFloatingButton();

    // トースト用に画面中央上部に表示
    hostEl.style.position = 'fixed';
    hostEl.style.top = '20px';
    hostEl.style.left = '50%';
    hostEl.style.transform = 'translateX(-50%)';
    hostEl.style.pointerEvents = 'none';

    const label = shadowRoot.querySelector('.label');
    const icon = shadowRoot.querySelector('.icon');
    label.textContent = message;
    icon.textContent = '';
    floatingBtn.classList.add('success');
    floatingBtn.classList.add('visible');

    setTimeout(() => {
      hideButton();
      floatingBtn.classList.remove('success');
    }, 2000);
  }

})();
