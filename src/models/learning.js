// AI tự học: so khớp dự đoán với kết quả thực tế, cập nhật thống kê và
// tự điều chỉnh trọng số + THAM SỐ của các mô hình để tăng độ chính xác.
import { GAMES, DEFAULT_PARAMS } from '../constants';
import { evalMainHits } from './predict';

export function emptyStats() {
  return {}; // stats[gameId][modelId] = {...}
}

function ensure(stats, gameId, modelId) {
  if (!stats[gameId]) stats[gameId] = {};
  if (!stats[gameId][modelId]) {
    stats[gameId][modelId] = {
      count: 0, // số dự đoán đã đánh giá
      totalHits: 0,
      totalPossible: 0,
      hitRate: 0,
      bestHits: 0,
      history: [], // [{date, hits, possible}]
      adaptiveWeights: { frequency: 0.5, markov: 0.35, random: 0.15 },
    };
  }
  return stats[gameId][modelId];
}

// So khớp 1 dự đoán với 1 kết quả thực tế.
export function evaluatePrediction(gameId, prediction, actual) {
  const game = GAMES[gameId];
  if (game.type === 'digit3') {
    const predicted = prediction.numbers || [];
    const real = (actual.special || []).map((s) => String(s).padStart(3, '0'));
    let hits = 0;
    const realCopy = [...real];
    for (const p of predicted) {
      const idx = realCopy.indexOf(String(p).padStart(3, '0'));
      if (idx >= 0) {
        hits++;
        realCopy.splice(idx, 1);
      }
    }
    // khớp theo từng chữ số (thông tin phụ)
    let digitHits = 0;
    for (let i = 0; i < predicted.length && i < real.length; i++) {
      const a = String(predicted[i]).padStart(3, '0');
      const b = String(real[i]).padStart(3, '0');
      for (let k = 0; k < 3; k++) if (a[k] === b[k]) digitHits++;
    }
    return { hits, possible: game.sets, digitHits, digitPossible: game.sets * 3 };
  }
  // standard
  const realMain = new Set(actual.main || []);
  let hits = 0;
  for (const n of prediction.numbers || []) if (realMain.has(n)) hits++;
  let possible = game.mainCount;
  if (game.special && prediction.special && actual.special) {
    const realSpecial = new Set(actual.special);
    for (const n of prediction.special) if (realSpecial.has(n)) hits++;
    possible += game.special.count;
  }
  return { hits, possible };
}

// Cập nhật thống kê 1 mô hình
function applyEval(stat, date, hits, possible) {
  stat.count += 1;
  stat.totalHits += hits;
  stat.totalPossible += possible;
  stat.hitRate = stat.totalPossible > 0 ? stat.totalHits / stat.totalPossible : 0;
  if (hits > stat.bestHits) stat.bestHits = hits;
  stat.history.push({ date, hits, possible, rate: possible ? hits / possible : 0 });
  if (stat.history.length > 200) stat.history.shift();
}

// AI: điều chỉnh trọng số mô hình Thích ứng theo hiệu suất đo được của
// các mô hình thành phần (frequency / markov / random).
function tuneAdaptiveWeights(stats, gameId, learningRate = 0.3) {
  const adaptive = ensure(stats, gameId, 'adaptive');
  const fr = stats[gameId]?.frequency?.hitRate ?? 0.0;
  const mk = stats[gameId]?.markov?.hitRate ?? 0.0;
  const rd = stats[gameId]?.random?.hitRate ?? 0.0;
  // mục tiêu tỉ lệ thuận với hiệu suất, có sàn để vẫn khám phá
  const floor = 0.05;
  let tf = fr + floor;
  let tm = mk + floor;
  let tr = rd + floor;
  const sum = tf + tm + tr || 1;
  tf /= sum;
  tm /= sum;
  tr /= sum;
  const w = adaptive.adaptiveWeights;
  const lr = learningRate;
  w.frequency = (1 - lr) * w.frequency + lr * tf;
  w.markov = (1 - lr) * w.markov + lr * tm;
  w.random = (1 - lr) * w.random + lr * tr;
  // chuẩn hóa lại
  const s2 = w.frequency + w.markov + w.random || 1;
  w.frequency /= s2;
  w.markov /= s2;
  w.random /= s2;
  return w;
}

// Lưới tham số có thể tinh chỉnh cho từng mô hình: [min, max, step]
const TUNE_GRID = {
  frequency: { weightFactor: [0.5, 2.0, 0.1], minOccurrences: [1, 10, 1] },
  markov: { order: [1, 5, 1], smoothing: [0.1, 1.0, 0.1] },
  adaptive: { decayFactor: [0.5, 1.0, 0.05], windowSize: [10, 100, 5], learningRate: [0.1, 1.0, 0.1] },
};
const INT_PARAMS = new Set(['order', 'minOccurrences', 'windowSize']);

function clampN(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function snap(v, step, lo, hi, isInt) {
  let r = Math.round(v / step) * step;
  r = clampN(r, lo, hi);
  return isInt ? Math.round(r) : Math.round(r * 1000) / 1000;
}

// AI tinh chỉnh THAM SỐ của từng mô hình bằng "coordinate ascent":
// với mỗi tham số, thử giá trị hiện tại và 2 lân cận, chọn giá trị cho nhiều
// số trúng nhất khi dự đoán lại kỳ vừa quay từ dữ liệu lịch sử, rồi dịch dần
// tham số về phía tốt nhất theo tốc độ học. Chỉ áp dụng cho giải dạng số.
export function tuneParameters(stats, gameId, history, actual, baseParams = {}, lr = 0.3) {
  const game = GAMES[gameId];
  if (game.type !== 'standard') return stats;
  if (!history || history.length < 20 || !actual || !actual.main) return stats;
  const hist = history.slice(-150); // giới hạn chi phí tính toán

  for (const modelId of ['frequency', 'markov', 'adaptive']) {
    const grid = TUNE_GRID[modelId];
    const stat = ensure(stats, gameId, modelId);
    const start = {
      ...DEFAULT_PARAMS[modelId],
      ...(baseParams[modelId] || {}),
      ...(stat.params || {}),
    };
    const weights = stat.adaptiveWeights;
    const tuned = { ...start };
    for (const key of Object.keys(grid)) {
      const [lo, hi, step] = grid[key];
      const isInt = INT_PARAMS.has(key);
      const base = tuned[key] ?? lo;
      const candidates = [base, clampN(base + step, lo, hi), clampN(base - step, lo, hi)];
      let bestVal = base;
      let bestHits = -1;
      for (const v of candidates) {
        const trial = { ...tuned, [key]: v };
        const hits = evalMainHits(gameId, hist, actual, modelId, trial, weights);
        if (hits > bestHits) {
          bestHits = hits;
          bestVal = v;
        }
      }
      const moved = (1 - lr) * base + lr * bestVal;
      tuned[key] = snap(moved, step, lo, hi, isInt);
    }
    stat.params = tuned;
    stat.lastTunedAt = actual.date;
  }
  return stats;
}

// Ghi nhận 1 kết quả thực tế: đánh giá mọi dự đoán phù hợp, cập nhật thống kê,
// AI điều chỉnh trọng số adaptive VÀ tinh chỉnh tham số các mô hình.
// history: các kỳ quay TRƯỚC kỳ `actual` (để đánh giá tham số trung thực).
// Trả về { stats, evaluated: [{id, hits, possible}] }
export function recordResult(stats, gameId, predictions, actual, history = [], baseParams = {}, learningRate = 0.3) {
  const evaluated = [];
  for (const pred of predictions) {
    const r = evaluatePrediction(gameId, pred, actual);
    const stat = ensure(stats, gameId, pred.model);
    applyEval(stat, actual.date, r.hits, r.possible);
    evaluated.push({ id: pred.id, hits: r.hits, possible: r.possible, digitHits: r.digitHits });
  }
  // AI cập nhật trọng số adaptive sau khi đã có hiệu suất mới
  tuneAdaptiveWeights(stats, gameId, learningRate);
  // AI tinh chỉnh tham số từng mô hình để tối ưu độ chính xác
  tuneParameters(stats, gameId, history, actual, baseParams, learningRate);
  return { stats, evaluated };
}

// Tổng hợp để hiển thị thống kê / so sánh mô hình
export function summarizeStats(stats, gameId) {
  const out = {};
  const g = stats[gameId] || {};
  ['random', 'frequency', 'markov', 'adaptive'].forEach((m) => {
    const s = g[m];
    out[m] = s
      ? { hitRate: s.hitRate, count: s.count, bestHits: s.bestHits, totalHits: s.totalHits }
      : { hitRate: 0, count: 0, bestHits: 0, totalHits: 0 };
  });
  return out;
}

// Khuyến nghị mô hình tốt nhất (theo hitRate, ưu tiên có dữ liệu)
export function recommendModel(stats, gameId) {
  const summary = summarizeStats(stats, gameId);
  let best = 'adaptive';
  let bestRate = -1;
  Object.entries(summary).forEach(([m, s]) => {
    if (s.count > 0 && s.hitRate > bestRate) {
      bestRate = s.hitRate;
      best = m;
    }
  });
  return { model: best, hitRate: bestRate < 0 ? 0 : bestRate };
}
