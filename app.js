let dictionary = {
  header: { itemClasses: {}, rarities: {} },
  baseItems: {},
  uniqueNames: {}, // ユニークアイテム名辞書
  stats: {},
  itemStates: {},
  suffixCleaners: {},
  rareNames: { prefixes: [], suffixes: [] },
  normalizationRules: [],
  mods: []
};

function getRandomRareName() {
  const prefixes = dictionary.rareNames?.prefixes || ["Victory", "Gloom", "Armageddon", "Soul"];
  const suffixes = dictionary.rareNames?.suffixes || ["Grasp", "Claw", "Touch", "Hold"];
  const pref = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suff = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${pref} ${suff}`;
}

async function loadDictionary() {
  const statusEl = document.getElementById('status');
  try {
    const res = await fetch('./dictionary.json');
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    dictionary = await res.json();
    if (statusEl) statusEl.style.display = 'none';
    console.log('✅ 辞書読み込み完了');
  } catch (err) {
    console.error('❌ 辞書読み込み失敗:', err);
  }
}

function convertItem() {
  const inputEl = document.getElementById("input");
  const outputEl = document.getElementById("output");
  if (!inputEl || !outputEl) return;

  const rawText = inputEl.value.replace(/\r\n/g, "\n");
  if (!rawText.trim()) return;

  const blocks = rawText.split(/^--------$/m);

  // レアリティ判定（ブロック全体から判別）
  const isUnique = /^レアリティ:\s*ユニーク/m.test(rawText) || /^Rarity:\s*Unique/m.test(rawText);

  const convertedBlocks = blocks.map((block, index) => {
    let lines = block.trim().split("\n");
    if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) return "";

    if (index === 0) {
      return parseHeaderBlock(lines, isUnique);
    }

    const parsedLines = lines.map(line => parseLine(line)).filter(l => l !== null);
    return parsedLines.join("\n");
  });

  outputEl.value = convertedBlocks.filter(b => b.trim() !== "").join("\n--------\n");
}

function parseHeaderBlock(lines, isUnique) {
  return lines.map((line) => {
    let trimmed = line.trim();

    // 1. アイテムクラス
    for (const [jpKey, enKey] of Object.entries(dictionary.header.itemClasses || {})) {
      if (trimmed.startsWith(`アイテムクラス: ${jpKey}`)) return `Item Class: ${enKey}`;
    }
    if (trimmed.startsWith("アイテムクラス:")) return `Item Class: ${trimmed.replace("アイテムクラス:", "").trim()}`;

    // 2. レアリティ
    for (const [jpKey, enKey] of Object.entries(dictionary.header.rarities || {})) {
      if (trimmed.startsWith(`レアリティ: ${jpKey}`)) return `Rarity: ${enKey}`;
    }
    if (trimmed.startsWith("レアリティ:")) return `Rarity: ${trimmed.replace("レアリティ:", "").trim()}`;

    // 3. ベースアイテム名
    if (dictionary.baseItems?.[trimmed]) {
      return dictionary.baseItems[trimmed];
    }

    // 4. ユニークアイテム名（ユニーク判定時）
    if (isUnique && dictionary.uniqueNames?.[trimmed]) {
      return dictionary.uniqueNames[trimmed];
    }

    // 5. レアアイテム名（日本語が含まれている場合のみランダム英名に置換）
    if (!isUnique && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(trimmed)) {
      return getRandomRareName();
    }

    return trimmed;
  }).join("\n");
}

function parseLine(line) {
  let trimmed = line.trim();
  if (!trimmed) return null;

  // メタタグ { ... } および解説カッコ ( ... ) を一括削除
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || 
      (trimmed.startsWith("(") && trimmed.endsWith(")"))) {
    return null;
  }

  // 状態フラグ（Mirrored, Corrupted等）
  if (dictionary.itemStates?.[trimmed]) {
    return dictionary.itemStates[trimmed];
  }

  // 補足文字列のクリーンアップ
  let cleanLine = trimmed.replace(/\s*\(augmented\)/gi, "").replace(/\s*\(unmet\)/gi, "");

  // ステータス行・装備要求の変換（英語辞書マッピング）
  for (const [jpKey, enKey] of Object.entries(dictionary.stats || {})) {
    if (cleanLine.startsWith(jpKey)) {
      return cleanLine.replace(jpKey, enKey);
    }
  }

  // 日本語のフレーバーテキスト（ポエム）行を検出して破棄
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(cleanLine) && !containsModKeywords(cleanLine)) {
    return null;
  }

  return translateModLine(cleanLine);
}

// モッド行かフレーバーテキストかを判定するための補助関数
function containsModKeywords(line) {
  return /(\+|\%|レベル|増加|減少|付与|確率|ダメ|ヒット|追加)/.test(line);
}

function translateModLine(line) {
  let mainText = line;

  for (const [jpSuff, enSuff] of Object.entries(dictionary.suffixCleaners || {})) {
    if (mainText.endsWith(jpSuff)) {
      mainText = mainText.slice(0, -jpSuff.length).trim();
      break;
    }
  }

  let normalizedText = mainText;
  for (const rule of dictionary.normalizationRules || []) {
    try {
      const reg = new RegExp(rule.jp, 'g');
      normalizedText = normalizedText.replace(reg, rule.en);
    } catch (e) {}
  }

  let translatedMod = normalizedText;

  for (const rule of dictionary.mods || []) {
    try {
      const reg = new RegExp(rule.jp, 'i');
      if (reg.test(normalizedText)) {
        translatedMod = normalizedText.replace(reg, rule.en);
        break;
      }
    } catch (e) {}
  }

  return translatedMod;
}

loadDictionary();
