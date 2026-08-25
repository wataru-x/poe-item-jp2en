let dictionary = {
  header: {},
  stats: {},
  mods: [],
  gemsAndSkills: {}
};

// 辞書データ(dictionary.json)の読み込み
async function loadDictionary() {
  try {
    const response = await fetch('./dictionary.json');
    dictionary = await response.json();
    document.getElementById('status').innerText = '辞書データ読み込み完了 (構造化パース対応)';
  } catch (error) {
    console.error('辞書の読み込みに失敗しました:', error);
    document.getElementById('status').innerText = '辞書データの読み込みに失敗しました';
    document.getElementById('status').style.color = '#f44336';
  }
}

function convertItem() {
  const rawText = document.getElementById("input").value.replace(/\r\n/g, "\n");
  if (!rawText.trim()) return;

  // 1. -------- でブロックごとに分割
  const blocks = rawText.split(/^--------$/m);

  const convertedBlocks = blocks.map((block, index) => {
    let lines = block.trim().split("\n");

    // 第1ブロック：基本ヘッダー情報（アイテムクラス、レアリティ、アイテム名など）
    if (index === 0) {
      return parseHeaderBlock(lines);
    }

    // 各ブロック内の行ごとのパース処理
    return lines.map(line => parseLine(line)).join("\n");
  });

  // 最終テキストの再構築
  document.getElementById("output").value = convertedBlocks.join("\n--------\n");
}

// ヘッダーブロック専用パース
function parseHeaderBlock(lines) {
  return lines.map(line => {
    // アイテムクラス: xxx
    if (line.startsWith("アイテムクラス:")) {
      const cls = line.replace("アイテムクラス:", "").trim();
      return `Item Class: ${dictionary.header.itemClasses?.[cls] || cls}`;
    }
    // レアリティ: xxx
    if (line.startsWith("レアリティ:")) {
      const rarity = line.replace("レアリティ:", "").trim();
      return `Rarity: ${dictionary.header.rarities?.[rarity] || rarity}`;
    }
    // ベースアイテム名・固有名詞の変換
    if (dictionary.header.names?.[line.trim()]) {
      return dictionary.header.names[line.trim()];
    }
    return line;
  }).join("\n");
}

// 行レベルの安全なパース
function parseLine(line) {
  let trimmed = line.trim();

  // A. { ... } で囲まれたモッドメタデータヘッダー（例: { フラクチャー プレフィックスモッド... }）
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseModMetaHeader(trimmed);
  }

  // B. ステータス・要求値などの固定フィールド
  for (const [jpKey, enKey] of Object.entries(dictionary.stats)) {
    if (trimmed.startsWith(jpKey)) {
      return trimmed.replace(jpKey, enKey);
    }
  }

  // C. ジェム・スキル・サポート名単体（傭兵のスキルラインなど）
  if (dictionary.gemsAndSkills[trimmed]) {
    return dictionary.gemsAndSkills[trimmed];
  }

  // D. モッド本文（数値パターンとの安全な適合）
  for (const rule of dictionary.mods) {
    const reg = new RegExp(rule.jp, rule.flags || 'g');
    if (reg.test(trimmed)) {
      return trimmed.replace(reg, rule.en);
    }
  }

  return line;
}

// モッドブラケット情報 { ... } 内の構造化パース
function parseModMetaHeader(headerStr) {
  let inner = headerStr.slice(1, -1); // { } を外す

  // メタデータキーワードの置換
  if (dictionary.metaTerms) {
    for (const [jpTerm, enTerm] of Object.entries(dictionary.metaTerms)) {
      inner = inner.replaceAll(jpTerm, enTerm);
    }
  }

  return `{ ${inner} }`;
}

// 初期実行
loadDictionary();
