/*
 * Kiểm thử logic (parser + models + learning) bằng Node thuần, không cần React Native.
 * Tự nạp các file ESM "thuần logic" qua một bộ chuyển đổi nhỏ ESM->CJS.
 * Chạy: npm test   (hoặc: node scripts/selftest.js)
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const cache = {};

function loadModule(absPath) {
  const resolved = absPath.endsWith('.js') ? absPath : absPath + '.js';
  if (cache[resolved]) return cache[resolved].exports;
  let text = fs.readFileSync(resolved, 'utf8');

  const names = new Set();
  const re = /export\s+(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(text))) names.add(m[1]);

  text = text.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g,
    'const {$1} = __require("$2");'
  );
  text = text.replace(/^\s*export\s+/gm, '');
  text += `\nmodule.exports = { ${[...names].join(', ')} };`;

  const dir = path.dirname(resolved);
  const __require = (p) => {
    if (p.startsWith('.')) return loadModule(path.resolve(dir, p));
    return require(p);
  };
  const module = { exports: {} };
  cache[resolved] = module;
  const fn = new Function('module', 'exports', '__require', text);
  fn(module, module.exports, __require);
  return module.exports;
}

const { GAMES, DEFAULT_PARAMS } = loadModule(path.join(SRC, 'constants'));
const { parseGameData } = loadModule(path.join(SRC, 'data', 'parser'));
const { predict, evalMainHits } = loadModule(path.join(SRC, 'models', 'predict'));
const { recordResult, evaluatePrediction, emptyStats, tuneParameters } = loadModule(
  path.join(SRC, 'models', 'learning')
);

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name);
  }
}

// ---- Dữ liệu mẫu ----
const samples = {
  power655: [
    '{"date":"2021-03-20","id":"00555","result":[16,18,20,25,35,36,17]}',
    '{"date":"2021-03-23","id":"00556","result":[9,13,17,33,34,53,31]}',
    '{"date":"2021-03-25","id":"00557","result":[1,9,17,20,35,40,12]}',
  ].join('\n'),
  loto535: [
    '{"date":"2026-05-18","id":"00648","result":[5,11,24,31,32,7]}',
    '{"date":"2026-05-19","id":"00649","result":[1,7,14,31,33,10]}',
    '{"date":"2026-05-19","id":"00650","result":[1,4,10,15,27,7]}',
  ].join('\n'),
  max3d: [
    '{"date":"2021-05-05","id":"00308","result":{"Giải Đặc biệt":["939","719"],"Giải Nhất":["317","371"],"Giải Nhì":["857","910"],"Giải ba":["204","539"]}}',
    '{"date":"2021-05-07","id":"00309","result":{"Giải Đặc biệt":["105","487"],"Giải Nhất":["151","081"],"Giải Nhì":["485","216"],"Giải ba":["117","073"]}}',
  ].join('\n'),
};

console.log('\n[1] Parser');
const p655 = parseGameData('power655', samples.power655);
check('power655: 3 kỳ', p655.length === 3);
check('power655: 6 số chính', p655[0].main.length === 6);
check('power655: sắp xếp tăng dần theo ngày', p655[0].date <= p655[2].date);
const l535 = parseGameData('loto535', samples.loto535);
check('loto535: 5 số chính + 1 đặc biệt', l535[0].main.length === 5 && l535[0].special.length === 1);
check('loto535: số đặc biệt trong [1,12]', l535[0].special[0] >= 1 && l535[0].special[0] <= 12);
const m3d = parseGameData('max3d', samples.max3d);
check('max3d: parse 2 kỳ', m3d.length === 2);
check('max3d: cặp đặc biệt 2 số 3 chữ số', m3d[0].special.length === 2 && m3d[0].special[0].length === 3);
check('max3d: thu thập chữ số', Array.isArray(m3d[0].digits) && m3d[0].digits.length > 0);

console.log('\n[2] Models (mỗi mô hình, mỗi giải)');
const models = ['random', 'frequency', 'markov', 'adaptive'];
for (const gid of ['power655', 'mega645', 'loto535', 'max3d', 'max3dpro']) {
  const game = GAMES[gid];
  // tạo dữ liệu giả đủ lớn
  let draws;
  if (game.type === 'digit3') {
    draws = Array.from({ length: 60 }, () => ({
      date: '2025-01-01',
      special: [String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
                String(Math.floor(Math.random() * 1000)).padStart(3, '0')],
      digits: Array.from({ length: 18 }, () => Math.floor(Math.random() * 10)),
    }));
  } else {
    draws = Array.from({ length: 60 }, () => {
      const set = new Set();
      while (set.size < game.mainCount) set.add(game.mainMin + Math.floor(Math.random() * (game.mainMax - game.mainMin + 1)));
      const main = [...set].sort((a, b) => a - b);
      const special = game.special ? [game.special.min + Math.floor(Math.random() * (game.special.max - game.special.min + 1))] : [];
      return { date: '2025-01-01', main, special };
    });
  }
  for (const model of models) {
    const pred = predict(gid, draws, model, {}, {});
    let okCount, inRange;
    if (game.type === 'digit3') {
      okCount = pred.numbers.length === game.sets;
      inRange = pred.numbers.every((s) => /^\d{3}$/.test(s));
    } else {
      const uniq = new Set(pred.numbers);
      okCount = pred.numbers.length === game.mainCount && uniq.size === game.mainCount;
      inRange = pred.numbers.every((n) => n >= game.mainMin && n <= game.mainMax);
      if (game.special) {
        okCount = okCount && pred.special.length === game.special.count;
        inRange = inRange && pred.special.every((n) => n >= game.special.min && n <= game.special.max);
      }
    }
    const conf = pred.confidence > 0 && pred.confidence <= 1;
    check(`${gid}/${model}: số lượng+phạm vi+tin cậy`, okCount && inRange && conf);
  }
}

console.log('\n[3] AI tự học (trọng số adaptive)');
const stats = emptyStats();
const actual = { date: '2025-02-01', main: [1, 2, 3, 4, 5, 6], special: [] };
const preds = [
  { id: 'a', model: 'frequency', numbers: [1, 2, 3, 10, 11, 12], special: [] }, // trúng 3
  { id: 'b', model: 'markov', numbers: [1, 2, 20, 21, 22, 23], special: [] }, // trúng 2
  { id: 'c', model: 'random', numbers: [40, 41, 42, 43, 44, 45], special: [] }, // trúng 0
];
const ev = evaluatePrediction('power655', preds[0], actual);
check('evaluate: trúng 3/6', ev.hits === 3 && ev.possible === 6);
// lịch sử giả để AI tinh chỉnh tham số
const hist = Array.from({ length: 120 }, () => {
  const set = new Set();
  while (set.size < 6) set.add(1 + Math.floor(Math.random() * 55));
  return { date: '2025-01-01', main: [...set].sort((a, b) => a - b), special: [] };
});
const base = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
const r = recordResult(stats, 'power655', preds, actual, hist, base, 0.5);
check('recordResult: đánh giá 3 dự đoán', r.evaluated.length === 3);
check('stats: frequency hitRate > random hitRate', stats.power655.frequency.hitRate > stats.power655.random.hitRate);
const wAfter = stats.power655.adaptive.adaptiveWeights;
check('AI: trọng số frequency > random sau khi học', wAfter.frequency > wAfter.random);
check('AI: tổng trọng số ~ 1', Math.abs(wAfter.frequency + wAfter.markov + wAfter.random - 1) < 1e-6);

console.log('\n[4] AI tinh chỉnh tham số mô hình');
check('evalMainHits: trả về số trong [0,6]', (() => { const h = evalMainHits('power655', hist, actual, 'frequency', { weightFactor: 1.2, minOccurrences: 1 }, null); return h >= 0 && h <= 6; })());
check('có tham số tinh chỉnh cho frequency', !!stats.power655.frequency.params);
const fp = stats.power655.frequency.params;
check('frequency.weightFactor trong [0.5,2]', fp.weightFactor >= 0.5 && fp.weightFactor <= 2.0);
check('frequency.minOccurrences nguyên trong [1,10]', Number.isInteger(fp.minOccurrences) && fp.minOccurrences >= 1 && fp.minOccurrences <= 10);
const mp = stats.power655.markov.params;
check('markov.order nguyên trong [1,5]', Number.isInteger(mp.order) && mp.order >= 1 && mp.order <= 5);
check('markov.smoothing trong [0.1,1]', mp.smoothing >= 0.1 && mp.smoothing <= 1.0);
const ap = stats.power655.adaptive.params;
check('adaptive.windowSize nguyên trong [10,100]', Number.isInteger(ap.windowSize) && ap.windowSize >= 10 && ap.windowSize <= 100);
// tinh chỉnh không áp dụng cho giải dạng 3 chữ số
const s2 = emptyStats();
tuneParameters(s2, 'max3d', hist, { date: '2025-02-01', special: ['123', '456'], digits: [1,2,3,4,5,6] }, base, 0.5);
check('digit3: không tạo tham số tinh chỉnh', !s2.max3d || !s2.max3d.frequency || !s2.max3d.frequency.params);

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi.`);
process.exit(fail === 0 ? 0 : 1);
