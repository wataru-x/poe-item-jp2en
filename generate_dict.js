const fs = require('fs');
const path = require('path');

const STAT_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/stat_translations.json';

async function buildDictionary() {
  console.log('🔄 RePoE から最新データを自動取得・全自動生成中...');

  try {
    const res = await fetch(STAT_URL);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const statTranslations = await res.json();

    const fetchedMods = [];

    for (const entry of statTranslations) {
      if (!entry.English || !entry.Japanese) continue;

      for (let i = 0; i < entry.English.length; i++) {
        const enObj = entry.English[i];
        // 対応する日本語データ（無ければ先頭）
        const jpObj = entry.Japanese[i] || entry.Japanese[0];

        if (enObj?.string && jpObj?.string) {
          let jpStr = jpObj.string;
          let enStr = enObj.string;

          // 1. 正規表現特殊文字のエスケープ
          let jpPattern = jpStr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

          // 2. {0}, {1}, {2} などのプレースホルダーを「数字または任意の単語」にマッチするワイルドカードへ変換
          jpPattern = jpPattern.replace(/\\\{(\d+)\\\}/g, '([\\d\\.-]+|.+?)');

          // 3. 英語側の {0}, {1} を置換用変数 $1, $2 へ変換
          let enTemplate = enStr.replace(/\{(\d+)\}/g, (match, p1) => `$${parseInt(p1) + 1}`);

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
      mods: fetchedMods
    };

    fs.writeFileSync(
      path.join(__dirname, 'dictionary.json'),
      JSON.stringify(finalDict, null, 2),
      'utf8'
    );

    console.log(`✅ 生成完了: 手動追加なしで ${finalDict.mods.length} 件のModパターンを自動収録しました。`);
  } catch (err) {
    console.error('❌ 生成失敗:', err);
  }
}

buildDictionary();
