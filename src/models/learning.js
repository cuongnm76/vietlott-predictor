// AI tự học: so khớp dự đoán với kết quả thực tế, cập nhật thống kê và
// tự điều chỉnh trọng số + THAM SỐ của các mô hình để tăng độ chính xác.
import { GAMES, DEFAULT_PARAMS } from '../constants';
import { evalMainHits } from './predict';

export function emptyStats() {
  return {}; // stats[gameId][modelId] = {...}
}

// 5 thành phần của AI ensemble
const ENSEMBLE_COMPONENTS = ['frequency', 'markov', 'bayesian', 'gap', 'random'];
const DEFAULT_WEIGHTS = { frequency: 0.3, markov: 0.15, bayesian: 0.25, gap: 0.2, random: 0.1 };

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
      adaptiveWeights: { ...DEFAULT_WEIGHTS },
    };
  }
  // tương thích dữ liệu cũ (chỉ có 3 thành phần): bổ sung thành phần thiếu
  const w = stats[gameId][modelId].adaptiveWeights;
  if (w) {
    for (const k of ENSEMBLE_COMPONENTS) {
      if (w[k] == null) w[k] = DEFAULT_WEIGHTS[k];
    }
  }
  return stats[gameId][modelId];
}

// So khớp 1 dự đoán với 1 kết quả thực tế.
export function evaluatePrediction(gameId, prediction, actual) {
  const game = GAMES[gameId];
  if (game.type === 'digit3') {
    // Trúng khi số dự đoán xuất hiện ở BẤT KỲ giải nào của cả kỳ quay
    const predicted = (prediction.numbers || []).map((s) => String(s).padStart(3, '0'));
    const pool = (actual.all && actual.all.length ? actual.all : actual.special || []).map((s) =>
      String(s).padStart(3, '0')
    );
    const realSet = new Set(pool);
    let hits = 0;
    for (const p of predicted) if (realSet.has(p)) hits++;
    return { hits, possible: game.sets };
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

// AI ensemble học trực tuyến: cập nhật trọng số 5 thành phần theo hiệu suất
// đo được (kiểu multiplicative weights / Hedge có sàn khám phá).
function tuneAdaptiveWeights(stats, gameId, learningRate = 0.3) {
  const adaptive = ensure(stats, gameId, 'adaptive');
  const w = adaptive.adaptiveWeights;
  const floor = 0.04; // sàn để mọi thành phần vẫn được "khám phá"
  // mục tiêu tỉ lệ thuận với hiệu suất từng thành phần
  const target = {};
  let tSum = 0;
  for (const k of ENSEMBLE_COMPONENTS) {
    target[k] = (stats[gameId]?.[k]?.hitRate ?? 0) + floor;
    tSum += target[k];
  }
  for (const k of ENSEMBLE_COMPONENTS) target[k] /= tSum || 1;
  // dịch dần theo tốc độ học
  const lr = learningRate;
  let s2 = 0;
  for (const k of ENSEMBLE_COMPONENTS) {
    w[k] = (1 - lr) * (w[k] ?? DEFAULT_WEIGHTS[k]) + lr * target[k];
    s2 += w[k];
  }
  for (const k of ENSEMBLE_COMPONENTS) w[k] /= s2 || 1;
  return w;
}

// Lưới tham số có thể tinh chỉnh cho từng mô hình: [min, max, step]
const TUNE_GRID = {
  frequency: { weightFactor: [0.5, 2.0, 0.1], minOccurrences: [1, 10, 1] },
  markov: { order: [1, 5, 1], smoothing: [0.1, 1.0, 0.1] },
  bayesian: { alpha: [0.1, 2.0, 0.1], halfLife: [10, 100, 5] },
  gap: { gapPower: [0.5, 2.0, 0.1], mixFreq: [0, 1.0, 0.05] },
  adaptive: { decayFactor: [0.5, 1.0, 0.05], windowSize: [10, 100, 5], learningRate: [0.1, 1.0, 0.1] },
};
const INT_PARAMS = new Set(['order', 'minOccurrences', 'windowSize', 'halfLife']);

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

  for (const modelId of ['frequency', 'markov', 'bayesian', 'gap', 'adaptive']) {
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
  ['random', 'frequency', 'markov', 'bayesian', 'gap', 'adaptive'].forEach((m) => {
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
