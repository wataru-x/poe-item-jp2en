let dictionary = {
  header: { itemClasses: {}, rarities: {}, names: {} },
  stats: {},
  metaTerms: {},
  itemStates: {},
  suffixCleaners: {},
  mods: []
};

async function loadDictionary() {
  try {
    const response = await fetch('./dictionary.json');
    dictionary = await response.json();
    document.getElementById('status').innerText = '辞書データ読み込み完了';
  } catch (error) {
    console.error('辞書読み込み失敗:', error);
  }
}

function convertItem() {
  const rawText = document.getElementById("input").value.replace(/\r\n/g, "\n");
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

  document.getElementById("output").value = convertedBlocks.filter(b => b.trim() !== "").join("\n--------\n");
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

  // 1. カッコ括りの完全解説文（例: パニッシュメントの詳細解説）を除外
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return null;
  }

  // 2. メタヘッダー { ... } の構造化パース
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseMetaHeader(trimmed);
  }

  // 3. アイテム属性状態 (Mirrored, Corrupted, Shaper Item等)
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

  // 6. モッド本文の照合（末尾サフィックスの分離と処理）
  return translateModLine(cleanLine);
}

// モッドテキストの分離変換処理
function translateModLine(line) {
  let mainText = line;
  let appendedSuffix = "";

  // 末尾の「 — スケールできない値」などの特殊解説を一時分離
  for (const [jpSuff, enSuff] of Object.entries(dictionary.suffixCleaners || {})) {
    if (mainText.endsWith(jpSuff)) {
      mainText = mainText.slice(0, -jpSuff.length).trim();
      appendedSuffix = enSuff;
      break;
    }
  }

  // モッド辞書（完全一致 / 正規表現）との照合
  let translatedMod = mainText;
  let matched = false;

  for (const rule of dictionary.mods) {
    try {
      const reg = new RegExp(rule.jp, 'i');
      if (reg.test(mainText)) {
        translatedMod = mainText.replace(reg, rule.en);
        matched = true;
        break;
      }
    } catch (e) {}
  }

  // 分離した末尾テキストを再結合
  return translatedMod + appendedSuffix;
}

// メタヘッダー { ... } 内の構造化パース（スペース保持と日本語括弧の除去）
function parseMetaHeader(headerStr) {
  let inner = headerStr.slice(1, -1).trim();

  // 日本語引用符の変換: 「...」 -> "..."
  inner = inner.replace(/「/g, '"').replace/」/g, '"');

  // 単語長順にソートして置換（長語優先で誤置換を防ぐ）
  const sortedMetaTerms = Object.entries(dictionary.metaTerms || {})
    .sort((a, b) => b[0].length - a[0].length);

  for (const [jp, en] of sortedMetaTerms) {
    if (inner.includes(jp)) {
      // スペースが消失しないよう、両脇に必要なスペースを保つ
      inner = inner.replaceAll(jp, `${en}`);
    }
  }

  // 二重スペースの整形
  inner = inner.replace(/\s+/g, ' ').trim();

  return `{ ${inner} }`;
}

loadDictionary();
