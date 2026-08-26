let dictionary = {
  header: { itemClasses: {}, rarities: {}, names: {} },
  stats: {},
  metaTerms: {},
  itemStates: {},
  suffixCleaners: {},
  mods: []
};

async function loadDictionary() {
  const statusEl = document.getElementById('status');
  try {
    const response = await fetch('./dictionary.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    dictionary = await response.json();
    if (statusEl) {
      statusEl.style.display = 'none';
    }
    console.log('✅ 辞書データの読み込み完了');
  } catch (error) {
    console.error('❌ 辞書の読み込み失敗:', error);
    if (statusEl) {
      statusEl.textContent = `❌ 辞書データの読み込みエラー: ${error.message}`;
      statusEl.style.color = 'red';
    }
  }
}

function convertItem() {
  const inputEl = document.getElementById("input");
  const outputEl = document.getElementById("output");
  if (!inputEl || !outputEl) return;

  const rawText = inputEl.value.replace(/\r\n/g, "\n");
  if (!rawText.trim()) return;

  const blocks = rawText.split(/^--------$/m);

  const convertedBlocks = blocks.map((block, index) => {
    let lines = block.trim().split("\n");
    if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) return "";

    if (index === 0) {
      return parseHeaderBlock(lines);
    }

    const parsedLines = lines.map(line => parseLine(line)).filter(l => l !== null);
    return parsedLines.join("\n");
  });

  outputEl.value = convertedBlocks.filter(b => b.trim() !== "").join("\n--------\n");
}

function parseHeaderBlock(lines) {
  return lines.map(line => {
    let trimmed = line.trim();

    if (trimmed.startsWith("アイテムクラス:")) {
      const cls = trimmed.replace("アイテムクラス:", "").trim();
      return `Item Class: ${dictionary.header.itemClasses?.[cls] || cls}`;
    }

    if (trimmed.startsWith("レアリティ:")) {
      const r = trimmed.replace("レアリティ:", "").trim();
      return `Rarity: ${dictionary.header.rarities?.[r] || r}`;
    }

    if (dictionary.header.names?.[trimmed]) {
      return dictionary.header.names[trimmed];
    }

    return trimmed;
  }).join("\n");
}

function parseLine(line) {
  let trimmed = line.trim();
  if (!trimmed) return null;

  // 1. カッコ括りの解説文を除外
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return null;
  }

  // 2. メタヘッダー { ... } の構造化パース
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseMetaHeader(trimmed);
  }

  // 3. アイテム属性状態 (Mirrored, Corrupted等)
  if (dictionary.itemStates?.[trimmed]) {
    return dictionary.itemStates[trimmed];
  }

  // 4. 追加タグのクリーンアップ
  let cleanLine = trimmed.replace(/\s*\((augmented|unmet)\)/gi, "");

  // 5. ステータス項目 (Quality, Requirements等)
  for (const [jpKey, enKey] of Object.entries(dictionary.stats)) {
    if (cleanLine.startsWith(jpKey)) {
      return cleanLine.replace(jpKey, enKey);
    }
  }

  // 6. モッド本文の照合
  return translateModLine(cleanLine);
}

function translateModLine(line) {
  let mainText = line;
  let appendedSuffix = "";

  // 末尾の特殊解説（例: — スケールできない値）を分離
  for (const [jpSuff, enSuff] of Object.entries(dictionary.suffixCleaners || {})) {
    if (mainText.endsWith(jpSuff)) {
      mainText = mainText.slice(0, -jpSuff.length).trim();
      appendedSuffix = enSuff;
      break;
    }
  }

  // モッド辞書との照合
  let translatedMod = mainText;

  for (const rule of dictionary.mods) {
    try {
      const reg = new RegExp(rule.jp, 'i');
      if (reg.test(mainText)) {
        translatedMod = mainText.replace(reg, rule.en);
        break;
      }
    } catch (e) {}
  }

  return translatedMod + (appendedSuffix ? " " + appendedSuffix : "");
}

function parseMetaHeader(headerStr) {
  let inner = headerStr.slice(1, -1).trim();

  // 日本語引用符の変換 (修正済み)
  inner = inner.replace(/「/g, '"').replace(/」/g, '"');

  // 単語長順にソートして置換
  const sortedMetaTerms = Object.entries(dictionary.metaTerms || {})
    .sort((a, b) => b[0].length - a[0].length);

  for (const [jp, en] of sortedMetaTerms) {
    if (inner.includes(jp)) {
      inner = inner.replaceAll(jp, en);
    }
  }

  inner = inner.replace(/\s+/g, ' ').trim();

  return `{ ${inner} }`;
}

// 読み込み実行
loadDictionary();
