const fs = require('fs');
const path = require('path');

const REPOE_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/stat_translations.json';

async function buildDictionary() {
  console.log('🔄 RePoE (brather1ng/RePoE) から最新データを取得中...');

  try {
    const res = await fetch(REPOE_URL);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const statTranslations = await res.json();

    const fetchedMods = [];

    for (const entry of statTranslations) {
      if (!entry.English || !entry.Japanese) continue;

      for (let i = 0; i < entry.English.length; i++) {
        const enObj = entry.English[i];
        const jpObj = entry.Japanese[i] || entry.Japanese[0];

        if (enObj?.string && jpObj?.string) {
          let jpPattern = jpObj.string
            .replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
            .replace(/\\\{0\\\}/g, '([\\d\\.-]+)')
            .replace(/\\\{1\\\}/g, '([\\d\\.-]+)')
            .replace(/\\\{2\\\}/g, '([\\d\\.-]+)');

          let enTemplate = enObj.string
            .replace('{0}', '$1')
            .replace('{1}', '$2')
            .replace('{2}', '$3');

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
      mods: [...fetchedMods, ...(overrides.mods || [])]
    };

    fs.writeFileSync(
      path.join(__dirname, 'dictionary.json'),
      JSON.stringify(finalDict, null, 2),
      'utf8'
    );

    console.log(`✅ 完了: ${finalDict.mods.length} 件のModを収録した dictionary.json を生成しました。`);
  } catch (err) {
    console.error('❌ 生成失敗:', err);
  }
}

buildDictionary();
