// generate_dict.js
const fs = require('fs');

async function fetchData(endpoint, lang) {
  const domain = lang === 'jp' ? 'jp.pathofexile.com' : 'www.pathofexile.com';
  const response = await fetch(`https://${domain}/api/trade/data/${endpoint}`, {
    headers: { 'User-Agent': 'PoE-JP2EN-Converter/1.0' }
  });
  if (!response.ok) throw new Error(`API Error [${endpoint}]: ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function generateDictionary() {
  console.log('PoE APIから全データを自動取得中...');
  try {
    const [enStats, jpStats, enItems, jpItems] = await Promise.all([
      fetchData('stats', 'en'),
      fetchData('stats', 'jp'),
      fetchData('items', 'en'),
      fetchData('items', 'jp')
    ]);

    const dict = {
      header: { itemClasses: {}, rarities: {}, names: {} },
      stats: {
        "品質:": "Quality:",
        "ブロック率:": "Chance to Block:",
        "アーマー:": "Armour:",
        "回避値:": "Evasion Rating:",
        "エナジーシールド:": "Energy Shield:",
        "ワード:": "Ward:",
        "装備要求:": "Requirements:",
        "レベル:": "Level:",
        "筋力:": "Str:",
        "器用さ:": "Dex:",
        "知性:": "Int:",
        "ソケット:": "Sockets:",
        "アイテムレベル:": "Item Level:"
      },
      metaTerms: {
        "暗黙モッド": "Implicit Modifier",
        "ユニークモッド": "Unique Modifier",
        "プレフィックスモッド": "Prefix Modifier",
        "サフィックスモッド": "Suffix Modifier",
        "フラクチャー": "Fractured",
        "キャスター": "Caster",
        "ジェム": "Gem"
      },
      mods: []
    };

    // --- 1. アイテム名・ベース名・クラスの自動ペアリング (/data/items) ---
    enItems.forEach((cat, cIdx) => {
      const jCat = jpItems[cIdx];
      if (!jCat || !jCat.entries) return;

      // カテゴリ名（アイテムクラス）
      if (jCat.label && cat.label) {
        dict.header.itemClasses[jCat.label] = cat.label;
      }

      cat.entries.forEach((enEntry, eIdx) => {
        const jpEntry = jCat.entries[eIdx];
        if (!jpEntry) return;

        // ベースアイテム名 / ユニーク名
        if (jpEntry.name && enEntry.name) {
          dict.header.names[jpEntry.name] = enEntry.name;
        }
        if (jpEntry.type && enEntry.type) {
          dict.header.names[jpEntry.type] = enEntry.type;
        }
        if (jpEntry.text && enEntry.text) {
          dict.header.names[jpEntry.text] = enEntry.text;
        }
      });
    });

    // --- 2. モッドデータの自動パターン化 (/data/stats) ---
    const seenMods = new Set();

    enStats.forEach((cat, cIdx) => {
      const jCat = jpStats[cIdx];
      if (!jCat || !jCat.entries) return;

      cat.entries.forEach((enEntry, eIdx) => {
        const jpEntry = jCat.entries[eIdx];
        if (!jpEntry || enEntry.id !== jpEntry.id) return;
        if (seenMods.has(enEntry.id)) return;
        seenMods.add(enEntry.id);

        let jpText = jpEntry.text;
        let enText = enEntry.text;

        // 記号のエスケープ
        let escapedJp = jpText.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");

        // # (数値部分) を 「数値 ＋ オプションの可変値範囲 (10-20)」 に対応する正規表現に変換
        // 例: "最大ライフ +#" -> "最大ライフ \+([+\-\d\.]+)(?:\([\d\.\-]+\))?"
        let jpRegex = escapedJp.replace(/#/g, "([+\\-\\d\\.]+)(?:\\([\\d\\.\\-]+\\))?");

        // 英語側の置換テンプレート作成 ($1, $2 ...)
        let groupCount = 1;
        let enTemplate = enText;
        while (enTemplate.includes('#')) {
          enTemplate = enTemplate.replace('#', `$${groupCount++}`);
        }

        dict.mods.push({
          id: enEntry.id,
          jp: `^${jpRegex}$`,
          en: enTemplate
        });
      });
    });

    fs.writeFileSync('./dictionary.json', JSON.stringify(dict, null, 2), 'utf8');
    console.log(`辞書作成完了! 名前:${Object.keys(dict.header.names).length}件, モッド:${dict.mods.length}件`);
  } catch (err) {
    console.error('辞書生成エラー:', err);
  }
}

generateDictionary();
