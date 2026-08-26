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

    // 第1ブロック：ヘッダー
    if (index === 0) {
      return parseHeaderBlock(lines);
    }

    const parsedLines = lines.map(line => parseLine(line)).filter(l => l !== null);
    return parsedLines.join("\n");
  });

  document.getElementById("output").value = convertedBlocks.filter(b => b.trim() !== "").join("\n--------\n");
}

// ヘッダーブロックのパース処理
function parseHeaderBlock(lines) {
  let rarity = "Rare"; // デフォルト

  // レアリティの判定
  lines.forEach(line => {
    if (line.startsWith("レアリティ:")) {
      const r = line.replace("レアリティ:", "").trim();
      rarity = dictionary.header.rarities?.[r] || r;
    }
  });

  return lines.map((line, idx) => {
    let trimmed = line.trim();

    if (trimmed.startsWith("アイテムクラス:")) {
      const cls = trimmed.replace("アイテムクラス:", "").trim();
      return `Item Class: ${dictionary.header.itemClasses?.[cls] || cls}`;
    }
    if (trimmed.startsWith("レアリティ:")) {
      return `Rarity: ${rarity}`;
    }

    // レアアイテムの場合、ランダム生成の1行目（例: 高潔な爪）はそのまま出力し、ベースアイテム名のみ辞書置換
    if (rarity === "Rare" && idx === 2 && lines.length >= 4) {
      return trimmed; // レアアイテム名は変換せず保持（PoBはベース名を重視するため）
    }

    // 辞書によるアイテム名・ベース名置換
    if (dictionary.header.names?.[trimmed]) {
      return dictionary.header.names[trimmed];
    }

    return trimmed;
  }).join("\n");
}

function parseLine(line) {
  let trimmed = line.trim();
  if (!trimmed) return null;

  // 1. カッコ内の注釈テキスト（PoB非対応の解説文）を除外
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return null;
  }

  // 2. メタヘッダー { ... } の全単語パース
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseMetaHeader(trimmed);
  }

  // 3. アイテム状態・属性表記の英文変換（最下部テキストなど）
  const stateTranslate = translateItemStates(trimmed);
  if (stateTranslate !== trimmed) {
    return stateTranslate;
  }

  // 4. (augmented) などのノイズ除去
  let cleanLine = trimmed.replace(/\s*\((augmented|unmet)\)/gi, "");

  // 5. ステータス項目の置換
  for (const [jpKey, enKey] of Object.entries(dictionary.stats)) {
    if (cleanLine.startsWith(jpKey)) {
      return cleanLine.replace(jpKey, enKey);
    }
  }

  // 6. モッド辞書（正規表現）照合
  for (const rule of dictionary.mods) {
    try {
      const reg = new RegExp(rule.jp, 'i');
      if (reg.test(cleanLine)) {
        return cleanLine.replace(reg, rule.en);
      }
    } catch (e) {}
  }

  return trimmed;
}

// メタヘッダー { ... } 内の構造化パース（プレフィックス名や属性タグを自動翻訳）
function parseMetaHeader(headerStr) {
  let inner = headerStr.slice(1, -1).trim();

  // 辞書に含まれるメタ単語をすべて置換
  for (const [jp, en] of Object.entries(dictionary.metaTerms)) {
    inner = inner.replaceAll(jp, en);
  }

  return `{ ${inner} }`;
}

// アイテムの属性・状態テキストの対応表
function translateItemStates(text) {
  const states = {
    "ミラー状態": "Mirrored",
    "コラプト状態": "Corrupted",
    "シェイパーアイテム": "Shaper Item",
    "エルダーアイテム": "Elder Item",
    "ハンターアイテム": "Hunter Item",
    "ウォーロードアイテム": "Warlord Item",
    "レデンプターアイテム": "Redeemer Item",
    "クルセイダーアイテム": "Crusader Item",
    "ヴェイルドプレフィックス": "Veiled Prefix",
    "ヴェイルドサフィックス": "Veiled Suffix"
  };

  return states[text] || text;
}

loadDictionary();
