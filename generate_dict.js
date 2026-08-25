// generate_dict.js
const fs = require('fs');

async function fetchStats(lang) {
  const domain = lang === 'jp' ? 'jp.pathofexile.com' : 'www.pathofexile.com';
  const response = await fetch(`https://${domain}/api/trade/data/stats`, {
    headers: { 'User-Agent': 'PoE-JP2EN-Converter/1.0' }
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function generateDictionary() {
  console.log('PoE APIからデータを取得中...');
  try {
    const [enCat, jpCat] = await Promise.all([fetchStats('en'), fetchStats('jp')]);

    let baseDict = {
      header: { itemClasses: {}, rarities: {}, names: {} },
      stats: {},
      metaTerms: {},
      gemsAndSkills: {},
      mods: []
    };

    if (fs.existsSync('./dictionary.json')) {
      const existing = JSON.parse(fs.readFileSync('./dictionary.json', 'utf8'));
      baseDict.header = existing.header || baseDict.header;
      baseDict.stats = existing.stats || baseDict.stats;
      baseDict.metaTerms = existing.metaTerms || baseDict.metaTerms;
      baseDict.gemsAndSkills = existing.gemsAndSkills || baseDict.gemsAndSkills;
    }

    const generatedMods = [];
    const seen = new Set();

    enCat.forEach((cat, cIdx) => {
      const jCat = jpCat[cIdx];
      if (!jCat || !jCat.entries) return;

      cat.entries.forEach((enEntry, eIdx) => {
        const jpEntry = jCat.entries[eIdx];
        if (!jpEntry || enEntry.id !== jpEntry.id) return;
        if (seen.has(enEntry.id)) return;
        seen.add(enEntry.id);

        let jpRegex = jpEntry.text
          .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
          .replace(/#/g, "([\\\\d\\\\.\\\\-]+)");

        let groupCount = 1;
        let enTemplate = enEntry.text;
        while (enTemplate.includes('#')) {
          enTemplate = enTemplate.replace('#', `$${groupCount++}`);
        }

        generatedMods.push({
          id: enEntry.id,
          jp: jpRegex,
          en: enTemplate
        });
      });
    });

    baseDict.mods = generatedMods;
    fs.writeFileSync('./dictionary.json', JSON.stringify(baseDict, null, 2), 'utf8');
    console.log(`生成完了! ${generatedMods.length} 件のモッドを収録。`);
  } catch (err) {
    console.error(err);
  }
}

generateDictionary();
