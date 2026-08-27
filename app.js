let dictionary = {
  header: { itemClasses: {}, rarities: {} },
  baseItems: {},
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
  return lines.map((line) => {
    let trimmed = line.trim();

    // 1. アイテムクラス
    for (const [jpKey, enKey] of Object.entries(dictionary.header.itemClasses || {})) {
      if (trimmed.startsWith(`アイテムクラス: ${jpKey}`)) {
        return `Item Class: ${enKey}`;
      }
    }
    if (trimmed.startsWith("アイテムクラス:")) {
      return `Item Class: ${trimmed.replace("アイテムクラス:", "").trim()}`;
    }

    // 2. レアリティ
    for (const [jpKey, enKey] of Object.entries(dictionary.header.rarities || {})) {
      if (trimmed.startsWith(`レアリティ: ${jpKey}`)) {
        return `Rarity: ${enKey}`;
      }
    }
    if (trimmed.startsWith("レアリティ:")) {
      return `Rarity: ${trimmed.replace("レアリティ:", "").trim()}`;
    }

    // 3. ベースアイテム名（例: 絹織物のグローブ -> Silk Gloves）
    // ※最優先で判定し、ベースアイテム名が勝手にレア名に置き換わるのを防ぎます
    if (dictionary.baseItems?.[trimmed]) {
      return dictionary.baseItems[trimmed];
    }

    // 4. 日本語が含まれる名前（レア名など）を英単語組み合わせに置換（PoB文字化け回避）
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(trimmed)) {
      return getRandomRareName();
    }

    return trimmed;
  }).join("\n");
}

function parseLine(line) {
  let trimmed = line.trim();
  if (!trimmed) return null;

  // メタタグ { ... } および解説カッコ ( ... ) のカット処理
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || 
      (trimmed.startsWith("(") && trimmed.endsWith(")"))) {
    return null;
  }

  if (dictionary.itemStates?.[trimmed]) {
    return dictionary.itemStates[trimmed];
  }

  let cleanLine = trimmed.replace(/\s*\((augmented|unmet)\)/gi, "");

  for (const [jpKey, enKey] of Object.entries(dictionary.stats || {})) {
    if (cleanLine.startsWith(jpKey)) {
      return cleanLine.replace(jpKey, enKey);
    }
  }

  return translateModLine(cleanLine);
}

function translateModLine(line) {
  let mainText = line;

  for (const [jpSuff, enSuff] of Object.entries(dictionary.suffixCleaners || {})) {
    if (mainText.endsWith(jpSuff)) {
      mainText = mainText.slice(0, -jpSuff.length).trim();
      break;
    }
  }

  // 辞書から動的に読み込んだ正規化ルールを順次適用
  let normalizedText = mainText;
  for (const rule of dictionary.normalizationRules || []) {
    try {
      const reg = new RegExp(rule.jp, 'g');
      normalizedText = normalizedText.replace(reg, rule.en);
    } catch (e) {}
  }

  let translatedMod = normalizedText;

  // 辞書ベースのマッチング
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
