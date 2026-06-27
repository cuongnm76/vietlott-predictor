// Bộ điều phối dự đoán cho 4 mô hình, hỗ trợ cả giải dạng số và dạng 3 chữ số.
// (predict + evalMainHits)
import { GAMES, MODEL_META, DEFAULT_PARAMS } from '../constants';
import {
  randomScores,
  frequencyScores,
  markovScores,
  normalizeScores,
  pickTopUnique,
} from './scoring';

const DEFAULT_ADAPTIVE_WEIGHTS = { frequency: 0.5, markov: 0.35, random: 0.15 };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---- Điểm cho 1 "pool" số (giải dạng standard) ----
function poolScores(modelId, sets, min, max, params, adaptiveWeights) {
  if (modelId === 'random') return randomScores(min, max);
  if (modelId === 'frequency') return frequencyScores(sets, min, max, params);
  if (modelId === 'markov') return markovScores(sets, min, max, params);
  // adaptive: kết hợp
  const w = adaptiveWeights || DEFAULT_ADAPTIVE_WEIGHTS;
  const windowSize = Math.round(params.windowSize ?? 50);
  const windowed = sets.slice(-windowSize);
  const f = normalizeScores(
    frequencyScores(windowed, min, max, {
      weightFactor: 1.2,
      minOccurrences: 1,
      decayFactor: params.decayFactor ?? 0.9,
    }),
    min,
    max
  );
  const m = normalizeScores(markovScores(windowed, min, max, { order: 1, smoothing: 0.5 }), min, max);
  const r = normalizeScores(randomScores(min, max), min, max);
  const total = (w.frequency + w.markov + w.random) || 1;
  const out = {};
  for (let n = min; n <= max; n++) {
    out[n] = (w.frequency * f[n] + w.markov * m[n] + w.random * r[n]) / total;
  }
  return out;
}

// ---- Sinh số dạng 3 chữ số ----
function digitScores(modelId, draws, params, adaptiveWeights) {
  const min = 0;
  const max = 9;
  if (modelId === 'random') return randomScores(min, max);

  const seqSets = draws.map((d) =>
    (d.special || []).join('').split('').map((c) => parseInt(c, 10)).filter((x) => !isNaN(x))
  );
  if (modelId === 'frequency') return frequencyScores(seqSets, min, max, params);
  if (modelId === 'markov') return markovScores(seqSets, min, max, params);
  // adaptive
  const w = adaptiveWeights || DEFAULT_ADAPTIVE_WEIGHTS;
  const f = normalizeScores(frequencyScores(seqSets, min, max, {}), min, max);
  const m = normalizeScores(markovScores(seqSets, min, max, { order: 1, smoothing: 0.5 }), min, max);
  const r = normalizeScores(randomScores(min, max), min, max);
  const total = (w.frequency + w.markov + w.random) || 1;
  const out = {};
  for (let n = min; n <= max; n++) {
    out[n] = (w.frequency * f[n] + w.markov * m[n] + w.random * r[n]) / total;
  }
  return out;
}

function weightedPickDigit(scores) {
  let sum = 0;
  const probs = [];
  for (let d = 0; d <= 9; d++) {
    const v = (scores[d] || 0) + 0.05;
    probs.push(v);
    sum += v;
  }
  let r = Math.random() * sum;
  for (let d = 0; d <= 9; d++) {
    r -= probs[d];
    if (r <= 0) return d;
  }
  return 9;
}

function generateDigitNumbers(scores, sets, digitsPerSet) {
  const nums = [];
  let guard = 0;
  while (nums.length < sets && guard < 50) {
    guard++;
    let s = '';
    for (let i = 0; i < digitsPerSet; i++) s += weightedPickDigit(scores);
    if (!nums.includes(s) || guard > 20) nums.push(s);
  }
  return nums;
}

function confidenceFor(modelId, drawCount, learnedHitRate) {
  const dataBoost = clamp(drawCount / 500, 0, 1) * 0.2;
  switch (modelId) {
    case 'random':
      return 0.1;
    case 'frequency':
      return clamp(0.4 + dataBoost, 0.4, 0.6);
    case 'markov':
      return clamp(0.3 + dataBoost, 0.3, 0.5);
    case 'adaptive':
      return clamp(0.5 + (learnedHitRate || 0) * 0.2, 0.5, 0.7);
    default:
      return 0.3;
  }
}

// Chọn top-N theo điểm KHÔNG có yếu tố ngẫu nhiên (dùng để đánh giá tham số)
function topNDeterministic(scores, count, min, max) {
  const items = [];
  for (let n = min; n <= max; n++) items.push({ n, s: scores[n] || 0 });
  items.sort((a, b) => b.s - a.s || a.n - b.n);
  return items.slice(0, count).map((x) => x.n);
}

// Đếm số trúng nếu dùng `params` để dự đoán `actual` từ lịch sử `history`.
// Dùng cho việc AI tự tinh chỉnh tham số (chỉ áp dụng giải dạng số).
export function evalMainHits(gameId, history, actual, modelId, params, adaptiveWeights) {
  const game = GAMES[gameId];
  if (game.type !== 'standard' || !actual || !actual.main) return 0;
  const p = { ...DEFAULT_PARAMS[modelId], ...(params || {}) };
  const scores = poolScores(
    modelId,
    (history || []).map((d) => d.main || []),
    game.mainMin,
    game.mainMax,
    p,
    adaptiveWeights
  );
  const top = new Set(topNDeterministic(scores, game.mainCount, game.mainMin, game.mainMax));
  let hits = 0;
  for (const n of actual.main) if (top.has(n)) hits++;
  return hits;
}

// ====== MÔ PHỎNG MONTE CARLO ======
// Giới hạn tối đa số lần mô phỏng (cân bằng độ ổn định và độ mượt trên điện thoại)
export const SIM_MAX = 1000;

// Xác suất 1 số xuất hiện trong 1 kỳ (dùng để ước lượng "kỳ vọng trúng")
function frequencyProb(sets, min, max) {
  const counts = {};
  for (let n = min; n <= max; n++) counts[n] = 0;
  let total = 0;
  for (const s of sets) {
    total++;
    for (const x of s) if (x >= min && x <= max) counts[x]++;
  }
  const denom = total || 1;
  const prob = {};
  for (let n = min; n <= max; n++) prob[n] = counts[n] / denom;
  return prob;
}

// Lấy mẫu 1 bộ gồm `count` số khác nhau, có trọng số theo điểm số (kèm epsilon)
function weightedSampleSet(scores, count, min, max) {
  const pool = [];
  let sum = 0;
  for (let n = min; n <= max; n++) {
    const w = (scores[n] || 0) + 1e-3;
    pool.push([n, w]);
    sum += w;
  }
  const chosen = new Set();
  let guard = 0;
  while (chosen.size < count && guard < count * 60) {
    guard++;
    let r = Math.random() * sum;
    let pick = pool[pool.length - 1][0];
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i][1];
      if (r <= 0) {
        pick = pool[i][0];
        break;
      }
    }
    chosen.add(pick);
  }
  for (let n = min; chosen.size < count && n <= max; n++) chosen.add(n);
  return [...chosen].sort((a, b) => a - b);
}

function expectedHits(set, prob) {
  let e = 0;
  for (const x of set) e += prob[x] || 0;
  return e;
}

function digitProb(draws) {
  const counts = new Array(10).fill(0);
  let total = 0;
  for (const d of draws) {
    for (const c of d.digits || []) {
      if (c >= 0 && c <= 9) {
        counts[c]++;
        total++;
      }
    }
  }
  const denom = total || 1;
  const prob = {};
  for (let i = 0; i < 10; i++) prob[i] = counts[i] / denom;
  return prob;
}

function digitExpected(nums, prob) {
  let e = 0;
  for (const s of nums) {
    for (const ch of String(s)) {
      const d = parseInt(ch, 10);
      if (!isNaN(d)) e += prob[d] || 0;
    }
  }
  return e;
}

// Dự đoán bằng mô phỏng: chạy `n` lần, mỗi lần sinh 1 bộ số theo phân phối của
// mô hình, đánh giá "kỳ vọng trúng" dựa trên tần suất lịch sử, rồi chọn bộ tốt nhất.
export function predictSimulated(gameId, draws, modelId, params, modelStat = {}, n = 100) {
  const game = GAMES[gameId];
  const p = { ...DEFAULT_PARAMS[modelId], ...(params || {}) };
  const adaptiveWeights = modelStat.adaptiveWeights || DEFAULT_ADAPTIVE_WEIGHTS;
  const drawCount = draws ? draws.length : 0;
  const N = Math.max(1, Math.min(Math.round(n) || 100, SIM_MAX));

  if (game.type === 'digit3') {
    const dScores = digitScores(modelId, draws || [], p, adaptiveWeights);
    const dprob = digitProb(draws || []);
    let best = null;
    let bestE = -1;
    for (let i = 0; i < N; i++) {
      const cand = generateDigitNumbers(dScores, game.sets, game.digitsPerSet);
      const e = digitExpected(cand, dprob);
      if (e > bestE) {
        bestE = e;
        best = cand;
      }
    }
    const totalDigits = game.sets * game.digitsPerSet;
    return {
      gameId,
      gameType: 'digit3',
      model: modelId,
      modelName: MODEL_META[modelId].name,
      numbers: best || generateDigitNumbers(dScores, game.sets, game.digitsPerSet),
      special: [],
      confidence: confidenceFor(modelId, drawCount, modelStat.hitRate),
      expectedHits: Math.round(bestE * 100) / 100,
      expectedMax: totalDigits,
      accuracy: totalDigits ? bestE / totalDigits : 0,
      sims: N,
      createdAt: new Date().toISOString(),
    };
  }

  // standard
  const mainSets = (draws || []).map((d) => d.main || []);
  const scores = poolScores(modelId, mainSets, game.mainMin, game.mainMax, p, adaptiveWeights);
  const prob = frequencyProb(mainSets, game.mainMin, game.mainMax);
  const sampleScores = modelId === 'random' ? randomScores(game.mainMin, game.mainMax) : scores;
  let best = null;
  let bestE = -1;
  for (let i = 0; i < N; i++) {
    const cand = weightedSampleSet(sampleScores, game.mainCount, game.mainMin, game.mainMax);
    const e = expectedHits(cand, prob);
    if (e > bestE) {
      bestE = e;
      best = cand;
    }
  }

  let special = [];
  if (game.special) {
    const specSets = (draws || []).map((d) => d.special || []).filter((s) => s.length > 0);
    const sScores = poolScores(modelId, specSets, game.special.min, game.special.max, p, adaptiveWeights);
    const sProb = frequencyProb(specSets, game.special.min, game.special.max);
    const sSample = modelId === 'random' ? randomScores(game.special.min, game.special.max) : sScores;
    let sBest = null;
    let sBestE = -1;
    for (let i = 0; i < N; i++) {
      const c = weightedSampleSet(sSample, game.special.count, game.special.min, game.special.max);
      const e = expectedHits(c, sProb);
      if (e > sBestE) {
        sBestE = e;
        sBest = c;
      }
    }
    special = sBest || [];
  }

  return {
    gameId,
    gameType: 'standard',
    model: modelId,
    modelName: MODEL_META[modelId].name,
    numbers: best,
    special,
    confidence: confidenceFor(modelId, drawCount, modelStat.hitRate),
    expectedHits: Math.round(bestE * 100) / 100,
    expectedMax: game.mainCount,
    accuracy: game.mainCount ? bestE / game.mainCount : 0,
    sims: N,
    createdAt: new Date().toISOString(),
  };
}

// API chính
// draws: mảng kỳ quay đã chuẩn hóa (cũ -> mới)
// modelStat: { hitRate, adaptiveWeights } (tùy chọn) cho mô hình adaptive
export function predict(gameId, draws, modelId, params, modelStat = {}) {
  const game = GAMES[gameId];
  const p = { ...DEFAULT_PARAMS[modelId], ...(params || {}) };
  const adaptiveWeights = modelStat.adaptiveWeights || DEFAULT_ADAPTIVE_WEIGHTS;
  const drawCount = draws ? draws.length : 0;

  if (game.type === 'digit3') {
    const scores = digitScores(modelId, draws || [], p, adaptiveWeights);
    const numbers = generateDigitNumbers(scores, game.sets, game.digitsPerSet);
    return {
      gameId,
      gameType: 'digit3',
      model: modelId,
      modelName: MODEL_META[modelId].name,
      numbers,
      special: [],
      confidence: confidenceFor(modelId, drawCount, modelStat.hitRate),
      createdAt: new Date().toISOString(),
    };
  }

  // standard
  const mainSets = (draws || []).map((d) => d.main || []);
  const mainScores = poolScores(modelId, mainSets, game.mainMin, game.mainMax, p, adaptiveWeights);
  const numbers = pickTopUnique(mainScores, game.mainCount, game.mainMin, game.mainMax);

  let special = [];
  if (game.special) {
    const specSets = (draws || [])
      .map((d) => d.special || [])
      .filter((s) => s.length > 0);
    const specScores = poolScores(
      modelId,
      specSets,
      game.special.min,
      game.special.max,
      p,
      adaptiveWeights
    );
    special = pickTopUnique(specScores, game.special.count, game.special.min, game.special.max);
  }

  return {
    gameId,
    gameType: 'standard',
    model: modelId,
    modelName: MODEL_META[modelId].name,
    numbers,
    special,
    confidence: confidenceFor(modelId, drawCount, modelStat.hitRate),
    createdAt: new Date().toISOString(),
  };
}
