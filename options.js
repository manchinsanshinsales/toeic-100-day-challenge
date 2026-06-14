// ============================================================
// options.js — 設定ページ ロジック
// Gemini Nano ステータスチェック、印刷設定、データ管理
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // --- DOM要素 ---
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const statusDetail = document.getElementById('status-detail');
  const statusCard = document.getElementById('status-card');
  const setupGuide = document.getElementById('setup-guide');
  const btnTest = document.getElementById('btn-test');
  const testResult = document.getElementById('test-result');
  const testOutput = document.getElementById('test-output');

  const defaultPaper = document.getElementById('default-paper');
  const offsetTop = document.getElementById('offset-top');
  const offsetBottom = document.getElementById('offset-bottom');
  const offsetLeft = document.getElementById('offset-left');
  const offsetRight = document.getElementById('offset-right');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const saveFeedback = document.getElementById('save-feedback');

  const wordCount = document.getElementById('word-count');
  const btnExport = document.getElementById('btn-export');
  const btnDeleteAll = document.getElementById('btn-delete-all');

  // --- 初期化 ---
  await checkGeminiNanoStatus();
  await loadSettings();
  await updateWordCount();

  // ============================================================
  // Gemini Nano ステータスチェック
  // ============================================================
  async function checkGeminiNanoStatus() {
    if (!globalThis.LanguageModel) {
      setStatus('unavailable', '❌', 'Prompt API が利用できません',
        'このブラウザは LanguageModel API（Prompt API）に対応していません。Chrome 127以上で、機能フラグの有効化が必要です。');
      setupGuide.style.display = 'block';
      btnTest.disabled = true;
      return;
    }

    try {
      const availability = await LanguageModel.availability();

      switch (availability) {
        case 'available':
          setStatus('available', '✅', 'Gemini Nano — 利用可能',
            'ローカルAIモデルが正常に動作しています。単語の自動翻訳・整形が利用できます。');
          btnTest.disabled = false;
          break;

        case 'after-download':
          setStatus('unavailable', '⏬', 'モデルをダウンロード中',
            'Gemini Nano のモデルがダウンロード中です。完了するまでお待ちください（数分〜数十分かかる場合があります）。');
          btnTest.disabled = true;
          // ダウンロード完了を待機（セッション作成時にモニターで確認）
          try {
            await LanguageModel.create({
              monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                  const pct = e.total ? Math.floor((e.loaded / e.total) * 100) : 0;
                  statusDetail.textContent = `ダウンロード中: ${pct}%`;
                });
              }
            }).then(session => {
              session.destroy();
              setStatus('available', '✅', 'Gemini Nano — 利用可能',
                'モデルのダウンロードが完了しました！');
              btnTest.disabled = false;
            });
          } catch (err) {
            console.warn('モデルダウンロード待機エラー:', err);
          }
          break;

        default:
          setStatus('unavailable', '❌', 'Gemini Nano — 利用不可',
            `ステータス: ${availability}。Chrome Flags の設定が必要です。`);
          setupGuide.style.display = 'block';
          btnTest.disabled = true;
      }
    } catch (error) {
      setStatus('unavailable', '❌', 'チェック失敗',
        `エラー: ${error.message}`);
      btnTest.disabled = true;
    }
  }

  function setStatus(type, icon, text, detail) {
    statusCard.className = `status-card ${type}`;
    statusIcon.textContent = icon;
    statusText.textContent = text;
    statusDetail.textContent = detail;
    if (type === 'available') {
      setupGuide.style.display = 'none';
    }
  }

  // ============================================================
  // テスト翻訳実行
  // ============================================================
  btnTest.addEventListener('click', async () => {
    btnTest.disabled = true;
    testResult.style.display = 'block';
    testOutput.textContent = '翻訳中...';

    try {
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
  "toeicContext": "TOEICで出題されやすい場面",
  "exampleSentence": "TOEIC的な例文（英語）"
}`
          }
        ]
      });

      const result = await session.prompt('以下の英単語をJSON形式で分析してください。\n\n単語: curtail\n使われていた文脈: The company decided to curtail expenses due to the economic downturn.');
      session.destroy();

      // 整形して表示
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          testOutput.textContent = JSON.stringify(parsed, null, 2);
        } else {
          testOutput.textContent = `AIの応答:\n${result}`;
        }
      } catch {
        testOutput.textContent = `AIの応答（JSON解析失敗）:\n${result}`;
      }

    } catch (error) {
      testOutput.textContent = `エラー: ${error.message}`;
    } finally {
      btnTest.disabled = false;
    }
  });

  // ============================================================
  // 印刷設定の読み込みと保存
  // ============================================================
  async function loadSettings() {
    const { printSettings = {} } = await chrome.storage.local.get('printSettings');
    defaultPaper.value = printSettings.paperType || 'a4-10';
    offsetTop.value = printSettings.margin_top || 0;
    offsetBottom.value = printSettings.margin_bottom || 0;
    offsetLeft.value = printSettings.margin_left || 0;
    offsetRight.value = printSettings.margin_right || 0;
  }

  btnSaveSettings.addEventListener('click', async () => {
    const settings = {
      paperType: defaultPaper.value,
      margin_top: parseFloat(offsetTop.value) || 0,
      margin_bottom: parseFloat(offsetBottom.value) || 0,
      margin_left: parseFloat(offsetLeft.value) || 0,
      margin_right: parseFloat(offsetRight.value) || 0
    };

    await chrome.storage.local.set({ printSettings: settings });

    // 保存フィードバック表示
    saveFeedback.style.display = 'block';
    setTimeout(() => {
      saveFeedback.style.display = 'none';
    }, 2000);
  });

  // ============================================================
  // データ管理
  // ============================================================
  async function updateWordCount() {
    const { words = [] } = await chrome.storage.local.get('words');
    wordCount.textContent = words.length;
  }

  // JSONエクスポート
  btnExport.addEventListener('click', async () => {
    const { words = [] } = await chrome.storage.local.get('words');

    if (words.length === 0) {
      alert('エクスポートする単語がありません。');
      return;
    }

    const json = JSON.stringify(words, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `wordbook_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
  });

  // 全データ削除
  btnDeleteAll.addEventListener('click', async () => {
    const { words = [] } = await chrome.storage.local.get('words');
    if (words.length === 0) {
      alert('削除する単語がありません。');
      return;
    }

    const confirmed = confirm(
      `本当に ${words.length} 個の単語データをすべて削除しますか？\nこの操作は元に戻せません。`
    );

    if (confirmed) {
      await chrome.storage.local.set({ words: [] });
      await updateWordCount();
      alert('すべての単語データを削除しました。');
    }
  });

  // ストレージ変更の監視
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.words) {
      const newWords = changes.words.newValue || [];
      wordCount.textContent = newWords.length;
    }
  });
});
