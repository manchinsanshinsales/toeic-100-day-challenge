// ============================================================
// background.js — Service Worker
// 紙の単語帳メーカー：バックグラウンド処理
// ============================================================

// --- 右クリックメニュー登録 ---
// onInstalled は拡張機能のインストール・更新時に発火
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-to-wordbook',
    title: '「%s」を単語帳に追加',
    contexts: ['selection']
  });
  // 初回インストール時にバッジを更新
  updateBadge();
});

// --- 拡張機能起動時のバッジ更新 ---
// Service Worker は非アクティブ状態から復帰するたびに実行される
updateBadge();

// --- 右クリックメニューのクリック処理 ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'add-to-wordbook') return;

  const word = info.selectionText.trim();
  if (!word) return;

  try {
    // content script から文脈を取得
    const [response] = await chrome.tabs.sendMessage(tab.id, {
      action: 'getContextSentence'
    }).then(r => [r]).catch(() => [null]);

    const context = response?.context || '';
    const url = tab.url || '';

    await processWord(word, context, url);

    // ユーザーフィードバック: content script にトースト表示を依頼
    await chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: `✓「${word}」を単語帳に追加しました`
    }).catch(() => {});

  } catch (error) {
    console.error('単語追加エラー:', error);
  }
});

// --- content.js からのメッセージ受信 ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addWord') {
    (async () => {
      try {
        await processWord(message.word, message.context, message.url);
        sendResponse({ success: true });
      } catch (error) {
        console.error('単語処理エラー:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // 非同期レスポンスのためチャネルを開いておく
  }
});

// ============================================================
// processWord — Gemini Nano で単語を翻訳・整形して保存
// ============================================================
async function processWord(word, context, url) {
  let wordData;

  try {
    wordData = await translateWithGeminiNano(word, context);
  } catch (error) {
    console.warn('Gemini Nano 利用不可、フォールバック:', error.message);
    // フォールバック: AIなしの簡易データ
    wordData = {
      word: word,
      pronunciation: '',
      meaning: '（AI翻訳未実行）',
      toeicContext: '',
      exampleSentence: context || ''
    };
  }

  // URL と追加日時を付与
  wordData.url = url;
  wordData.addedAt = new Date().toISOString();
  wordData.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // chrome.storage.local に保存
  const { words = [] } = await chrome.storage.local.get('words');
  words.push(wordData);
  await chrome.storage.local.set({ words });

  // バッジ更新
  await updateBadge();

  return wordData;
}

// ============================================================
// translateWithGeminiNano — Gemini Nano (LanguageModel API) を利用
// ============================================================
async function translateWithGeminiNano(word, context) {
  // Prompt API の存在チェック
  if (!globalThis.LanguageModel) {
    throw new Error('LanguageModel API が利用できません');
  }

  const availability = await LanguageModel.availability();
  if (availability === 'unavailable') {
    throw new Error('Gemini Nano モデルが利用できません');
  }

  // セッション作成
  const session = await LanguageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: `あなたはTOEIC専門の英語教師です。
与えられた英単語について、以下のJSON形式で回答してください。他の文章は一切出力しないでください。

{
  "word": "英単語",
  "pronunciation": "発音記号（IPA形式）",
  "meaning": "TOEIC文脈での日本語訳（簡潔に）",
  "toeicContext": "TOEICで出題されやすい場面（例：会議、予算削減、人事異動など）",
  "exampleSentence": "TOEIC的な例文（英語）"
}

注意事項：
- meaningは日本語で、TOEICで使われる意味を優先してください
- toeicContextは日本語で、TOEICの具体的なシチュエーションを書いてください
- JSON以外は出力しないでください`
      }
    ]
  });

  try {
    let prompt = `以下の英単語をJSON形式で分析してください。\n\n単語: ${word}`;
    if (context) {
      prompt += `\n使われていた文脈: ${context}`;
    }

    const result = await session.prompt(prompt);

    // JSONをパース（余分なテキストがある場合に備えて抽出）
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSONのパースに失敗しました');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      word: parsed.word || word,
      pronunciation: parsed.pronunciation || '',
      meaning: parsed.meaning || '（翻訳取得失敗）',
      toeicContext: parsed.toeicContext || '',
      exampleSentence: parsed.exampleSentence || context || ''
    };
  } finally {
    session.destroy();
  }
}

// ============================================================
// updateBadge — バッジに現在の単語数を表示
// ============================================================
async function updateBadge() {
  try {
    const { words = [] } = await chrome.storage.local.get('words');
    const count = words.length;
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } catch (error) {
    // Service Worker 起動直後はエラーになる場合がある
    console.warn('バッジ更新エラー:', error);
  }
}
