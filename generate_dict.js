const fs = require('fs');
const path = require('path');

const STAT_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/stat_translations.json';
const BASE_ITEMS_URL = 'https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/base_items.json';

async function buildDictionary() {
  console.log('🔄 RePoE からデータを取得・完全解析中...');

  try {
    // ----------------------------------------------------
    // 1. ベースアイテム & ユニークアイテム名の抽出
    // ----------------------------------------------------
    const baseItems = {};
    const resBases = await fetch(BASE_ITEMS_URL);
    if (resBases.ok) {
      const baseData = await resBases.json();
      for (const key in baseData) {
        const item = baseData[key];
        // 日本語名と英語名が存在する全てのアイテム（ベース＋ユニーク）を登録
        if (item.japanese_name && item.name) {
          baseItems[item.japanese_name] = item.name;
        }
      }
    }

    // ----------------------------------------------------
    // 2. Mod（翻訳データ）の抽出＆正規表現化
    // ----------------------------------------------------
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

          // 【超重要】{0}, {1} を「数値、可変範囲(1-2)、可変カッコ(1(1-2))」すべてにマッチするように拡張
          // 例: "1(1-2)" や "6(5-7)" や "+2" や "-10" に完全対応
          jpPattern = jpPattern.replace(/\\\{(\d+)\\\}/g, '([\\d\\.\\-\\(\\)]+|.+?)');

          // 英語側の {0}, {1} を正規表現のキャプチャグループ ($1, $2...) に置換
          let enTemplate = enStr.replace(/\{(\d+)\}/g, (match, p1) => `$${parseInt(p1) + 1}`);

          fetchedMods.push({
            jp: `^${jpPattern}$`,
            en: enTemplate
          });
        }
      }
    }

    // 手動オーバーライドファイル（overrides.json）の読み込み
    const overridesPath = path.join(__dirname, 'overrides.json');
    let overrides = {};
    if (fs.existsSync(overridesPath)) {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    }

    // ----------------------------------------------------
    // 3. 辞書データの統合と出力
    // ----------------------------------------------------
    const finalDict = {
      header: overrides.header || {},
      baseItems: baseItems,
      stats: Object.assign({
        "武器攻撃距離：": "Weapon Range: ",
        "武器攻撃距離:": "Weapon Range: ",
        "メートル": "metres",
        "メートル": "metres"
      }, overrides.stats || {}),
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

    console.log(`✅ dictionary.json の生成に成功しました！`);
    console.log(`   ・登録アイテム（ユニーク/ベース）: ${Object.keys(baseItems).length} 件`);
    console.log(`   ・登録Mod変換パターン: ${fetchedMods.length} 件`);

  } catch (err) {
    console.error('❌ 生成失敗:', err);
  }
}

buildDictionary();
