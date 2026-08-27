let dictionary = {};

// 辞書読み込み
async function loadDictionary() {
  try {
    const res = await fetch('./dictionary.json');
    dictionary = await res.json();
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

  const convertedBlocks = blocks.map((block) => {
    let lines = block.trim().split("\n");
    if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) return "";

    const parsedLines = lines.map(line => parseLine(line)).filter(l => l !== null);
    return parsedLines.join("\n");
  });

  outputEl.value = convertedBlocks.filter(b => b.trim() !== "").join("\n--------\n");
}

function parseLine(line) {
  let trimmed = line.trim();
  if (!trimmed) return null;

  // 1. ノイズ行（メタタグ {...} や 解説文 (...)）の除去
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || 
      (trimmed.startsWith("(") && trimmed.endsWith(")"))) {
    return null;
  }

  // 2. ゴミ末尾（— スケールできない値 など）の削り落とし
  for (const [jpSuff, enSuff] of Object.entries(dictionary.suffixCleaners || {})) {
    if (trimmed.endsWith(jpSuff)) {
      trimmed = trimmed.slice(0, -jpSuff.length).trim();
      break;
    }
  }

  // 3. アイテム状態 (Corrupted等)
  if (dictionary.itemStates?.[trimmed]) {
    return dictionary.itemStates[trimmed];
  }

  // 4. (augmented) などのフラグ消去
  let cleanLine = trimmed.replace(/\s*\((augmented|unmet)\)/gi, "");

  // 5. ヘッダー置換 (Item Class / Rarity)
  if (cleanLine.startsWith("アイテムクラス:")) {
    const val = cleanLine.replace("アイテムクラス:", "").trim();
    return `Item Class: ${dictionary.header?.itemClasses?.[val] || val}`;
  }
  if (cleanLine.startsWith("レアリティ:")) {
    const val = cleanLine.replace("レアリティ:", "").trim();
    return `Rarity: ${dictionary.header?.rarities?.[val] || val}`;
  }

  // 6. ステータス行・単位置換（「メートル」や「武器攻撃距離：」など）
  for (const [jpKey, enKey] of Object.entries(dictionary.stats || {})) {
    if (cleanLine.includes(jpKey)) {
      cleanLine = cleanLine.replace(jpKey, enKey);
    }
  }

  // 7. アイテム名・ユニーク名・ベース名置換（辞書から完全一致で引く）
  if (dictionary.baseItems?.[cleanLine]) {
    return dictionary.baseItems[cleanLine];
  }

  // 8. フレーバーテキスト（ポエム等）の削除
  // 数字、記号、コロン、プラス等を含まない純日本語行はフレーバーとみなして除外
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(cleanLine) && 
      !/[\d\+\%\:\=\-]/.test(cleanLine)) {
    return null;
  }

  // 9. PoB特殊オーバーライドの適用
  for (const override of dictionary.pobOverrides || []) {
    const reg = new RegExp(override.jp, 'i');
    if (reg.test(cleanLine)) {
      return cleanLine.replace(reg, override.en);
    }
  }

  // 10. RePoE Modパターンによる正規表現置換
  for (const rule of dictionary.mods || []) {
    try {
      const reg = new RegExp(rule.jp, 'i');
      if (reg.test(cleanLine)) {
        return cleanLine.replace(reg, rule.en);
      }
    } catch (e) {}
  }

  return cleanLine;
}

loadDictionary();
