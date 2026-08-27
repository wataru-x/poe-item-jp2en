const fs = require('fs');
const path = require('path');

const STAT_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/stat_translations.json';
const BASE_ITEMS_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/base_items.json';

async function buildDictionary() {
  console.log('🔄 RePoE から全データを解析・一括取得中...');

  try {
    // 1. ベースアイテム & ユニークアイテム名の完全取得
    const baseItems = {};
    const resBases = await fetch(BASE_ITEMS_URL);
    if (resBases.ok) {
      const baseData = await resBases.json();
      for (const key in baseData) {
        const item = baseData[key];
        // 日本語名が存在するすべてのアイテム（ベース＆ユニーク）を辞書化
        if (item.japanese_name && item.name) {
          baseItems[item.japanese_name] = item.name;
        }
      }
    }

    // 2. モッド翻訳 (stat_translations.json) のパース精度大幅向上
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

          // 特殊文字のエスケープ
          let jpPattern = jpStr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

          // RePoEの {0}, {1} を「数値または文字（小数・範囲含む）」に柔軟にマッチさせる
          // 例: +{0}% -> \+([\d\.]+)\%
          jpPattern = jpPattern.replace(/\\\{(\d+)\\\}/g, '([\\d\\.\\-]+|.+?)');

          // 英語側の {0}, {1} をキャプチャグループ ($1, $2...) に置き換え
          let enTemplate = enStr.replace(/\{(\d+)\}/g, (match, p1) => `$${parseInt(p1) + 1}`);

          fetchedMods.push({
            jp: `^${jpPattern}$`,
            en: enTemplate
          });
        }
      }
    }

    // 手動設定（最小限のUI・ステータス等）の読み込み
    const overridesPath = path.join(__dirname, 'overrides.json');
    let overrides = {};
    if (fs.existsSync(overridesPath)) {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    }

    const finalDict = {
      header: overrides.header || {},
      baseItems: baseItems, // ここにベース名もユニーク名も全部入る
      stats: overrides.stats || {},
      itemStates: overrides.itemStates || {},
      suffixCleaners: overrides.suffixCleaners || {},
      pobOverrides: overrides.pobOverrides || [],
      rareNames: overrides.rareNames || {},
      mods: fetchedMods
    };

    fs.writeFileSync(
      path.join(__dirname, 'dictionary.json'),
      JSON.stringify(finalDict, null, 2),
      'utf8'
    );

    console.log(`✅ 生成成功!`);
    console.log(` - アイテム名（ベース/ユニーク）: ${Object.keys(baseItems).length} 件`);
    console.log(` - Modパターン: ${fetchedMods.length} 件`);

  } catch (err) {
    console.error('❌ 生成失敗:', err);
  }
}

buildDictionary();
