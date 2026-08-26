let dictionary = {
  header: { itemClasses: {}, rarities: {}, names: {} },
  stats: {},
  metaTerms: {},
  itemStates: {},
  suffixCleaners: {},
  specialRules: [],
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

    for (const [jpKey, enKey] of Object.entries(dictionary.header.itemClasses || {})) {
      if (trimmed.startsWith(`アイテムクラス: ${jpKey}`)) {
        return `Item Class: ${enKey}`;
      }
    }
    if (trimmed.startsWith("アイテムクラス:")) {
      return `Item Class: ${trimmed.replace("アイテムクラス:", "").trim()}`;
    }

    for (const [jpKey, enKey] of Object.entries(dictionary.header.rarities || {})) {
      if (trimmed.startsWith(`レアリティ: ${jpKey}`)) {
        return `Rarity: ${enKey}`;
      }
    }
    if (trimmed.startsWith("レアリティ:")) {
      return `Rarity: ${trimmed.replace("レアリティ:", "").trim()}`;
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

  // 1. メタ用語を含まない解説カッコ行の削除
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    const isMetaBracket = Object.keys(dictionary.metaTerms || {}).some(term => trimmed.includes(term));
    const isStatusTag = trimmed.includes("augmented") || trimmed.includes("unmet");
    if (!isMetaBracket && !isStatusTag) {
      return null;
    }
  }

  // 2. メタヘッダー { ... }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseMetaHeader(trimmed);
  }

  // 3. アイテム状態
  if (dictionary.itemStates?.[trimmed]) {
    return dictionary.itemStates[trimmed];
  }

  // 4. (augmented) 等のステータスタグ除去
  let cleanLine = trimmed.replace(/\s*\((augmented|unmet)\)/gi, "");

  // 5. ステータス項目
  for (const [jpKey, enKey] of Object.entries(dictionary.stats)) {
    if (cleanLine.startsWith(jpKey)) {
      return cleanLine.replace(jpKey, enKey);
    }
  }

  // 6. モッド本文
  return translateModLine(cleanLine);
}

function translateModLine(line) {
  let mainText = line;
  let appendedSuffix = "";

  // 末尾サフィックスの分離
  for (const [jpSuff, enSuff] of Object.entries(dictionary.suffixCleaners || {})) {
    if (mainText.endsWith(jpSuff)) {
      mainText = mainText.slice(0, -jpSuff.length).trim();
      appendedSuffix = enSuff;
      break;
    }
  }

  // 可変値表記の数値範囲正規化（共通フォーマット処理）
  let normalizedText = mainText
    .replace(/(\d+)\([\d\.-]+\)から(\d+)\([\d\.-]+\)/g, "$1 to $2")
    .replace(/(\d+)\([\d\.-]+\)/g, "$1")
    .replace(/(\d+)\s*から\s*(\d+)/g, "$1 to $2");

  let translatedMod = normalizedText;

  // 1. 標準モッド辞書との照合
  for (const rule of dictionary.mods || []) {
    try {
      const reg = new RegExp(rule.jp, 'i');
      if (reg.test(normalizedText)) {
        translatedMod = normalizedText.replace(reg, rule.en);
        break;
      }
    } catch (e) {}
  }

  // 2. 辞書側の特殊ルールの照合 (overrides.json の specialRules を使用)
  if (translatedMod === normalizedText && dictionary.specialRules) {
    for (const rule of dictionary.specialRules) {
      try {
        const reg = new RegExp(rule.jp, 'i');
        if (reg.test(normalizedText)) {
          translatedMod = normalizedText.replace(reg, rule.en);
          break;
        }
      } catch (e) {}
    }
  }

  return translatedMod + (appendedSuffix ? " " + appendedSuffix : "");
}

function parseMetaHeader(headerStr) {
  let inner = headerStr.slice(1, -1).trim();

  // 記号・引用符の正規化
  inner = inner.replace(/「/g, '"').replace(/」/g, '"');

  // メタ用語の長順置換
  const sortedMetaTerms = Object.entries(dictionary.metaTerms || {})
    .sort((a, b) => b[0].length - a[0].length);

  for (const [jp, en] of sortedMetaTerms) {
    if (inner.includes(jp)) {
      const regKey = new RegExp(`${jp}:\\s*`, 'g');
      inner = inner.replace(regKey, `${en}: `);
      inner = inner.replaceAll(jp, en);
    }
  }

  // スペース整形
  inner = inner.replace(/([a-zA-Z])"/g, '$1 "');
  inner = inner.replace(/"([a-zA-Z])/g, '" $1');
  inner = inner.replace(/\s+/g, ' ').trim();

  return `{ ${inner} }`;
}

loadDictionary();
