let dictionary = {
  header: { itemClasses: {}, rarities: {}, names: {} },
  stats: {},
  metaTerms: {},
  mods: []
};

async function loadDictionary() {
  try {
    const response = await fetch('./dictionary.json');
    dictionary = await response.json();
    document.getElementById('status').innerText = '辞書データ読み込み完了 (全自動生成対応)';
  } catch (error) {
    console.error('辞書の読み込み失敗:', error);
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

    return lines.map(line => parseLine(line)).join("\n");
  });

  document.getElementById("output").value = convertedBlocks.filter(b => b !== "").join("\n--------\n");
}

// ヘッダーブロックパース
function parseHeaderBlock(lines) {
  return lines.map(line => {
    let trimmed = line.trim();

    if (trimmed.startsWith("アイテムクラス:")) {
      const cls = trimmed.replace("アイテムクラス:", "").trim();
      return `Item Class: ${dictionary.header.itemClasses?.[cls] || cls}`;
    }
    if (trimmed.startsWith("レアリティ:")) {
      const rarity = trimmed.replace("レアリティ:", "").trim();
      return `Rarity: ${dictionary.header.rarities?.[rarity] || rarity}`;
    }

    // APIから自動取得した全アイテム名・全ベース名テーブルを参照
    if (dictionary.header.names?.[trimmed]) {
      return dictionary.header.names[trimmed];
    }

    return trimmed;
  }).join("\n");
}

// 行ごとの汎用パース
function parseLine(line) {
  let trimmed = line.trim();
  if (!trimmed) return "";

  // 1. { ... } メタヘッダーの変換
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseMetaHeader(trimmed);
  }

  // 2. (augmented) などの追加注釈ノイズの除去
  let cleanLine = trimmed.replace(/\s*\((augmented|unmet)\)/gi, "");

  // 3. ステータス項目の変換
  for (const [jpKey, enKey] of Object.entries(dictionary.stats)) {
    if (cleanLine.startsWith(jpKey)) {
      return cleanLine.replace(jpKey, enKey);
    }
  }

  // 4. モッド本文のマッチング（辞書の自動生成正規表現を利用）
  for (const rule of dictionary.mods) {
    try {
      const reg = new RegExp(rule.jp, 'i');
      if (reg.test(cleanLine)) {
        return cleanLine.replace(reg, rule.en);
      }
    } catch (e) {
      // 正規表現エラーのパス
    }
  }

  return trimmed;
}

// メタヘッダー文字列の汎用置換
function parseMetaHeader(headerStr) {
  let inner = headerStr.slice(1, -1).trim();

  for (const [jp, en] of Object.entries(dictionary.metaTerms)) {
    inner = inner.replaceAll(jp, en);
  }

  return `{ ${inner} }`;
}

loadDictionary();
