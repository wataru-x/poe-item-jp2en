const fs = require('fs');
const path = require('path');

const STAT_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/stat_translations.json';
const MODS_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/mods.json';

async function buildDictionary() {
  console.log('🔄 RePoE から全データを取得中...');

  try {
    const [statRes, modsRes] = await Promise.all([
      fetch(STAT_URL),
      fetch(MODS_URL)
    ]);

    if (!statRes.ok || !modsRes.ok) throw new Error('RePoEの取得に失敗しました');

    const statTranslations = await statRes.json();
    const fetchedMods = [];

    // 1. stat_translations.json の処理
    for (const entry of statTranslations) {
      if (!entry.English || !entry.Japanese) continue;

      for (let i = 0; i < entry.English.length; i++) {
        const enObj = entry.English[i];
        const jpObj = entry.Japanese[i] || entry.Japanese[0];

        if (enObj?.string && jpObj?.string) {
          // {0}, {1}, {2} などの動的変数を全て表現できる正規表現を作成
          let jpPattern = jpObj.string
            .replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
            .replace(/\\\{(\d+)\\\}/g, '(.*?)');

          let enTemplate = enObj.string;
          // {0} -> $1, {1} -> $2 ...
          enTemplate = enTemplate.replace(/\{(\d+)\}/g, (match, p1) => `$${parseInt(p1) + 1}`);

          fetchedMods.push({
            jp: `^${jpPattern}$`,
            en: enTemplate
          });
        }
      }
    }

    const overridesPath = path.join(__dirname, 'overrides.json');
    let overrides = {};
    if (fs.existsSync(overridesPath)) {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    }

    const finalDict = {
      header: overrides.header || {},
      stats: overrides.stats || {},
      metaTerms: overrides.metaTerms || {},
      itemStates: overrides.itemStates || {},
      suffixCleaners: overrides.suffixCleaners || {},
      specialRules: overrides.specialRules || [],
      mods: [...fetchedMods, ...(overrides.mods || [])]
    };

    fs.writeFileSync(
      path.join(__dirname, 'dictionary.json'),
      JSON.stringify(finalDict, null, 2),
      'utf8'
    );

    console.log(`✅ 完了: ${finalDict.mods.length} 件のMod辞書を生成しました。`);
  } catch (err) {
    console.error('❌ 生成失敗:', err);
  }
}

buildDictionary();
