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
    document.getElementById('status').innerText = '辞書データ読み込み完了 (統合データベース対応)';
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
      const rarity = trimmed.replace("レアリティ:", "").trim();
      return `Rarity: ${dictionary.header.rarities?.[rarity] || rarity}`;
    }

    // 1. 完全一致名参照
    if (dictionary.header.names?.[trimmed]) {
      return dictionary.header.names[trimmed];
    }

    // 2. 「痕跡 xxx」のような特殊プレフィックス付きベース名の分解参照
    for (const [jpPrefix, enPrefix] of Object.entries(dictionary.metaTerms)) {
      if (trimmed.startsWith(jpPrefix + " ")) {
        const baseName = trimmed.replace(jpPrefix + " ", "").trim();
        if (dictionary.header.names?.[baseName]) {
          return `${enPrefix} ${dictionary.header.names[baseName]}`;
        }
      }
    }

    return trimmed;
  }).join("\n");
}

function parseLine(line) {
  let trimmed = line.trim();
  if (!trimmed) return null;

  // 1. メタヘッダー { ... } の変換
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseMetaHeader(trimmed);
  }

  // 2. 注釈・補足の除外/クリーン化
  let cleanLine = trimmed.replace(/\s*\((augmented|unmet)\)/gi, "");

  // 3. ステータス項目の置換
  for (const [jpKey, enKey] of Object.entries(dictionary.stats)) {
    if (cleanLine.startsWith(jpKey)) {
      return cleanLine.replace(jpKey, enKey);
    }
  }

  // 4. モッド辞書（API + PoEDB/RePoE統合データ）の照合
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

function parseMetaHeader(headerStr) {
  let inner = headerStr.slice(1, -1).trim();

  for (const [jp, en] of Object.entries(dictionary.metaTerms)) {
    inner = inner.replaceAll(jp, en);
  }

  return `{ ${inner} }`;
}

loadDictionary();
