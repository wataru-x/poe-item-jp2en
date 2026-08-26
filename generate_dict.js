// generate_dict.js
const fs = require('fs');

async function fetchTradeData(endpoint, lang) {
  const domain = lang === 'jp' ? 'jp.pathofexile.com' : 'www.pathofexile.com';
  const response = await fetch(`https://${domain}/api/trade/data/${endpoint}`, {
    headers: { 'User-Agent': 'PoE-JP2EN-Converter/1.0' }
  });
  if (!response.ok) throw new Error(`Trade API Error [${endpoint}]: ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch Error [${url}]: ${response.status}`);
  return await response.json();
}

async function generateDictionary() {
  console.log('--- 1/3: PoE 公式 Trade API からデータ取得中 ---');
  let enStats = [], jpStats = [], enItems = [], jpItems = [];
  try {
    [enStats, jpStats, enItems, jpItems] = await Promise.all([
      fetchTradeData('stats', 'en'),
      fetchTradeData('stats', 'jp'),
      fetchTradeData('items', 'en'),
      fetchTradeData('items', 'jp')
    ]);
  } catch (e) {
    console.warn('Trade API 取得失敗:', e.message);
  }

  console.log('--- 2/3: RePoE データセット取得中 ---');
  let repoeUniques = {};
  try {
    repoeUniques = await fetchJson('https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/uniques.json');
  } catch (e) {
    console.warn('RePoE 取得失敗:', e.message);
  }

  // 手動オーバーライドファイルの読み込み
  let overrides = { header: { itemClasses: {}, rarities: {} }, stats: {}, metaTerms: {}, itemStates: {} };
  if (fs.existsSync('./overrides.json')) {
    try {
      overrides = JSON.parse(fs.readFileSync('./overrides.json', 'utf8'));
      console.log('overrides.json を読み込みました');
    } catch (e) {
      console.warn('overrides.json の読み込み失敗:', e.message);
    }
  }

  const dict = {
    header: {
      itemClasses: { ...overrides.header?.itemClasses },
      rarities: { ...overrides.header?.rarities },
      names: {}
    },
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
      "アイテムレベル:": "Item Level:",
      ...overrides.stats
    },
    metaTerms: { ...overrides.metaTerms },
    itemStates: { ...overrides.itemStates },
    mods: []
  };

  // 1. アイテム名・ベース名マッピング
  enItems.forEach((cat, cIdx) => {
    const jCat = jpItems[cIdx];
    if (!jCat || !jCat.entries) return;

    if (jCat.label && cat.label) {
      dict.header.itemClasses[jCat.label.trim()] = cat.label.trim();
    }

    cat.entries.forEach((enEntry, eIdx) => {
      const jpEntry = jCat.entries[eIdx];
      if (!jpEntry) return;

      if (jpEntry.name && enEntry.name) dict.header.names[jpEntry.name.trim()] = enEntry.name.trim();
      if (jpEntry.type && enEntry.type) dict.header.names[jpEntry.type.trim()] = enEntry.type.trim();
    });
  });

  // RePoE から補完
  const seenModJp = new Set();
  for (const [key, item] of Object.entries(repoeUniques)) {
    if (item.name && item.name_translated && item.name_translated.ja) {
      dict.header.names[item.name_translated.ja.trim()] = item.name.trim();
    }
    if (item.base_item && item.base_item_translated && item.base_item_translated.ja) {
      dict.header.names[item.base_item_translated.ja.trim()] = item.base_item.trim();
    }

    if (item.mods) {
      item.mods.forEach(mod => {
        if (mod.text && mod.text_translated && mod.text_translated.ja) {
          const jpText = mod.text_translated.ja.trim();
          const enText = mod.text.trim();

          if (!seenModJp.has(jpText)) {
            seenModJp.add(jpText);
            let escapedJp = jpText.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            let jpRegex = escapedJp.replace(/#/g, "([+\\-\\d\\.]+)(?:\\([\\d\\.\\-]+\\))?");

            let groupCount = 1;
            let enTemplate = enText;
            while (enTemplate.includes('#')) {
              enTemplate = enTemplate.replace('#', `$${groupCount++}`);
            }

            dict.mods.push({ id: `repoe_${key}`, jp: `^${jpRegex}$`, en: enTemplate });
          }
        }
      });
    }
  }

  // 公式 API モッドマッピング
  const enModMap = new Map();
  enStats.forEach(cat => {
    if (cat.entries) {
      cat.entries.forEach(entry => {
        if (entry.id) enModMap.set(entry.id, entry.text);
      });
    }
  });

  jpStats.forEach(cat => {
    if (cat.entries) {
      cat.entries.forEach(jpEntry => {
        const enText = enModMap.get(jpEntry.id);
        if (!enText || !jpEntry.text) return;

        let jpText = jpEntry.text.trim();
        if (seenModJp.has(jpText)) return;
        seenModJp.add(jpText);

        let escapedJp = jpText.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        let jpRegex = escapedJp.replace(/#/g, "([+\\-\\d\\.]+)(?:\\([\\d\\.\\-]+\\))?");

        let groupCount = 1;
        let enTemplate = enText;
        while (enTemplate.includes('#')) {
          enTemplate = enTemplate.replace('#', `$${groupCount++}`);
        }

        dict.mods.push({ id: jpEntry.id, jp: `^${jpRegex}$`, en: enTemplate });
      });
    }
  });

  console.log('--- 3/3: dictionary.json へ書き出し中 ---');
  fs.writeFileSync('./dictionary.json', JSON.stringify(dict, null, 2), 'utf8');
  console.log(`生成完了!`);
}

generateDictionary();
