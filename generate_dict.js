const fs = require('fs');
const path = require('path');

const STAT_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/stat_translations.json';
const BASE_ITEMS_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/base_items.json';

async function buildDictionary() {
  console.log('🔄 RePoE から最新データを自動取得中...');

  try {
    // 1. stat_translations の取得
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

          // 正規表現エスケープ
          let jpPattern = jpStr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

          // {0}, {1} などを「数値やスキル名を含む任意の文字列」にマッチさせる
          // 例: "レベル{0}{1}によりサポートされる" -> "レベル(.+?)(.+?)によりサポートされる"
          jpPattern = jpPattern.replace(/\\\{(\d+)\\\}/g, '(.+?)');

          // 英語側の {0}, {1} を $1, $2 へ
          let enTemplate = enStr.replace(/\{(\d+)\}/g, (match, p1) => `$${parseInt(p1) + 1}`);

          fetchedMods.push({
            jp: `^${jpPattern}$`,
            en: enTemplate
          });
        }
      }
    }

    // 2. ベースアイテム名 (base_items.json) の取得
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

    const finalDict = {
      header: overrides.header || {},
      baseItems: baseItems,
      stats: overrides.stats || {},
      itemStates: overrides.itemStates || {},
      suffixCleaners: overrides.suffixCleaners || {},
      mods: fetchedMods
    };

    fs.writeFileSync(
      path.join(__dirname, 'dictionary.json'),
      JSON.stringify(finalDict, null, 2),
      'utf8'
    );

    console.log(`✅ 生成完了: ${finalDict.mods.length} 件のModパターンと ${Object.keys(baseItems).length} 件のベースアイテム名を収録しました。`);
  } catch (err) {
    console.error('❌ 生成失敗:', err);
  }
}

buildDictionary();
