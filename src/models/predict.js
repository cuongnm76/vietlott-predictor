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
