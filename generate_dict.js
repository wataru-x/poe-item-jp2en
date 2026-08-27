const fs = require('fs');
const path = require('path');

const STAT_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/stat_translations.json';
const BASE_ITEMS_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/base_items.json';

async function buildDictionary() {
  console.log('🔄 RePoE から最新データを自動取得中...');

  try {
    const resStats = await fetch(STAT_URL);
    if (!resStats.ok) throw new Error(`Stats HTTP Error: ${resStats.status}`);
    const statTranslations = await resStats.json();

    const fetchedMods = [];

    for (const entry of statTranslations) {
      if (!entry.English || !entry.Japanese) continue;

      for (let i = 0; i < entry.English.length; i++) {
        const enObj = entry.English[i];
        const jpObj = entry.Japanese[i] || entry.Japanese[0];

        if (enObj?.string && jpObj?.string) {
          let jpStr = jpObj.string;
          let enStr = enObj.string;

          let jpPattern = jpStr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
          jpPattern = jpPattern.replace(/\\\{(\d+)\\\}/g, '(.+?)');

          let enTemplate = enStr.replace(/\{(\d+)\}/g, (match, p1) => `$${parseInt(p1) + 1}`);

          fetchedMods.push({
            jp: `^${jpPattern}$`,
            en: enTemplate
          });
        }
      }
    }

    const baseItems = {};
    try {
      const resBases = await fetch(BASE_ITEMS_URL);
      if (resBases.ok) {
        const baseData = await resBases.json();
        for (const key in baseData) {
          const item = baseData[key];
          if (item.name && item.japanese_name) {
            baseItems[item.japanese_name] = item.name;
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ ベースアイテム名の自動取得をスキップしました');
    }

    const overridesPath = path.join(__dirname, 'overrides.json');
    let overrides = {};
    if (fs.existsSync(overridesPath)) {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    }

    // 共通のテキスト正規化用パターン（数値可変表記などの吸収）も辞書側に持たせる
    const normalizationRules = [
      { jp: "(\\d+)\\([\\d\\.-]+\\)から(\\d+)\\([\\d\\.-]+\\)", en: "$1 to $2" },
      { jp: "(\\d+)\\([\\d\\.-]+\\)", en: "$1" },
      { jp: "(\\d+)\\s*から\\s*(\\d+)", en: "$1 to $2" }
    ];

    const finalDict = {
      header: overrides.header || {},
      baseItems: baseItems,
      stats: overrides.stats || {},
      itemStates: overrides.itemStates || {},
      suffixCleaners: overrides.suffixCleaners || {},
      rareNames: overrides.rareNames || {
        prefixes: ["Victory", "Gloom", "Armageddon", "Soul", "Honor", "Brimstone", "Dread", "Storm"],
        suffixes: ["Grasp", "Claw", "Touch", "Hold", "Finger", "Vise", "Knot", "Ward"]
      },
      normalizationRules: normalizationRules,
      mods: fetchedMods
    };

    fs.writeFileSync(
      path.join(__dirname, 'dictionary.json'),
      JSON.stringify(finalDict, null, 2),
      'utf8'
    );

    console.log(`✅ 生成完了: ${finalDict.mods.length} 件のModパターンを辞書化しました。`);
  } catch (err) {
    console.error('❌ 生成失敗:', err);
  }
}

buildDictionary();
