let dictionary = [];

// ページ読み込み時に辞書JSONを取得
async function loadDictionary() {
  try {
    const response = await fetch('./dictionary.json');
    const data = await response.json();
    
    // JSONの文字列パターンを正規表現オブジェクトに変換
    dictionary = data.map(rule => ({
      jp: new RegExp(rule.jp, rule.flags || 'g'),
      en: rule.en
    }));

    document.getElementById('status').innerText = `辞書データ読み込み完了 (${dictionary.length}件のルール)`;
  } catch (error) {
    console.error('辞書の読み込みに失敗しました:', error);
    document.getElementById('status').innerText = '辞書データの読み込みに失敗しました';
    document.getElementById('status').style.color = '#f44336';
  }
}

function convertItem() {
  let text = document.getElementById("input").value;
  text = text.replace(/\r\n/g, "\n");

  dictionary.forEach(rule => {
    text = text.replace(rule.jp, rule.en);
  });

  document.getElementById("output").value = text;
}

// 初期化実行
loadDictionary();
