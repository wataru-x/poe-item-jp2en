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

  // 1. メタ用語（ティア/ランク）を含まない純粋な単行カッコ解説（詳細解説文章など）を除外
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    const isMetaBracket = Object.keys(dictionary.metaTerms || {}).some(term => trimmed.includes(term));
    const isStatusTag = trimmed.includes("augmented") || trimmed.includes("unmet");
    if (!isMetaBracket && !isStatusTag) {
      return null;
    }
  }

  // 2. メタヘッダー { ... } のパース
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseMetaHeader(trimmed);
  }

  // 3. アイテム状態 (アイテム属性フラグ)
  if (dictionary.itemStates?.[trimmed]) {
    return dictionary.itemStates[trimmed];
  }

  // 4. (augmented) 等のステータスタグ除去
  let cleanLine = trimmed.replace(/\s*\((augmented|unmet)\)/gi, "");

  // 5. ステータス項目 (アーマー: 148 等)
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

  // 末尾サフィックス（解説等）の分離
  for (const [jpSuff, enSuff] of Object.entries(dictionary.suffixCleaners || {})) {
    if (mainText.endsWith(jpSuff)) {
      mainText = mainText.slice(0, -jpSuff.length).trim();
      appendedSuffix = enSuff;
      break;
    }
  }

  // 可変値の数値範囲表記 (例: 129(115-129) または 6(6-7)から13(11-13)) の抽象化
  let normalizedText = mainText
    .replace(/(\d+)\([\d\.-]+\)/g, "$1")
    .replace(/(\d+)\s*[^\d\s\+\-\.]+\s*(\d+)/g, "$1 to $2");

  let translatedMod = normalizedText;

  // モッド辞書ルールの照合
  for (const rule of dictionary.mods) {
    try {
      const reg = new RegExp(rule.jp, 'i');
      if (reg.test(normalizedText)) {
        translatedMod = normalizedText.replace(reg, rule.en);
        break;
      }
    } catch (e) {}
  }

  return translatedMod + (appendedSuffix ? " " + appendedSuffix : "");
}

function parseMetaHeader(headerStr) {
  let inner = headerStr.slice(1, -1).trim();

  // 記号・引用符の正規化
  inner = inner.replace(/「/g, '"').replace(/」/g, '"');
  inner = inner.replace(/Modifier"/g, 'Modifier "');

  // 辞書に定義されたすべてのメタ用語を単語長（降順）で安全に置換
  const sortedMetaTerms = Object.entries(dictionary.metaTerms || {})
    .sort((a, b) => b[0].length - a[0].length);

  for (const [jp, en] of sortedMetaTerms) {
    if (inner.includes(jp)) {
      // (ティア: 1) や (ランク: 1) などの記号つき表記を考慮した置換
      const reg = new RegExp(`${jp}:\\s*`, 'g');
      inner = inner.replace(reg, `${en}: `);
      inner = inner.replaceAll(jp, en);
    }
  }

  inner = inner.replace(/\s+/g, ' ').trim();

  return `{ ${inner} }`;
}

loadDictionary();
