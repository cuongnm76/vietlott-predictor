// Bộ điều phối dự đoán cho 4 mô hình, hỗ trợ cả giải dạng số và dạng 3 chữ số.
// (predict + evalMainHits)
import { GAMES, MODEL_META, DEFAULT_PARAMS } from '../constants';
import {
  randomScores,
  frequencyScores,
  markovScores,
  bayesianScores,
  gapScores,
  normalizeScores,
  pickTopUnique,
} from './scoring';

// Trọng số khởi tạo của AI ensemble (5 thành phần) — sẽ tự học theo kết quả
export const DEFAULT_ADAPTIVE_WEIGHTS = {
  frequency: 0.3,
  markov: 0.15,
  bayesian: 0.25,
  gap: 0.2,
  random: 0.1,
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---- Điểm cho 1 "pool" số (giải dạng standard) ----
function poolScores(modelId, sets, min, max, params, adaptiveWeights) {
  if (modelId === 'random') return randomScores(min, max);
  if (modelId === 'frequency') return frequencyScores(sets, min, max, params);
  if (modelId === 'markov') return markovScores(sets, min, max, params);
  if (modelId === 'bayesian') return bayesianScores(sets, min, max, params);
  if (modelId === 'gap') return gapScores(sets, min, max, params);
  // adaptive: AI ensemble kết hợp 5 thành phần với trọng số tự học
  const w = { ...DEFAULT_ADAPTIVE_WEIGHTS, ...(adaptiveWeights || {}) };
  const windowSize = Math.round(params.windowSize ?? 50);
  const windowed = sets.slice(-windowSize);
  const comp = {
    frequency: normalizeScores(
      frequencyScores(windowed, min, max, {
        weightFactor: 1.2,
        minOccurrences: 1,
        decayFactor: params.decayFactor ?? 0.9,
      }),
      min,
      max
    ),
    markov: normalizeScores(markovScores(windowed, min, max, { order: 1, smoothing: 0.5 }), min, max),
    bayesian: normalizeScores(bayesianScores(sets, min, max, { alpha: 0.5, halfLife: 30 }), min, max),
    gap: normalizeScores(gapScores(sets, min, max, { gapPower: 1.0, mixFreq: 0.3 }), min, max),
    random: normalizeScores(randomScores(min, max), min, max),
  };
  let total = 0;
  for (const k of Object.keys(comp)) total += w[k] || 0;
  if (!total) total = 1;
  const out = {};
  for (let n = min; n <= max; n++) {
    let v = 0;
    for (const k of Object.keys(comp)) v += (w[k] || 0) * comp[k][n];
    out[n] = v / total;
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
    case 'bayesian':
      return clamp(0.4 + dataBoost, 0.4, 0.6);
    case 'gap':
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

// ===== Max 3D / Max 3D Pro: thống kê SỐ 3 CHỮ SỐ trong TOÀN BỘ kỳ quay =====
// Đếm số lần mỗi số 3 chữ số xuất hiện ở mọi giải (Đặc biệt/Nhất/Nhì/Ba).
function number3DFreq(draws, decay) {
  const counts = {};
  const total = draws.length;
  let totalDraws = 0;
  for (let i = 0; i < total; i++) {
    const d = draws[i];
    const nums = d.all && d.all.length ? d.all : d.special || [];
    if (!nums.length) continue;
    totalDraws++;
    const w = decay && decay < 1 ? Math.pow(decay, total - 1 - i) : 1;
    for (const s of nums) {
      const k = String(s).padStart(3, '0');
      if (/^\d{3}$/.test(k)) counts[k] = (counts[k] || 0) + w;
    }
  }
  return { counts, totalDraws };
}

function randomNumber3() {
  return String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

function sampleAnyPair(sets) {
  const s = new Set();
  while (s.size < sets) s.add(randomNumber3());
  return [...s];
}

// Chọn `sets` số cao điểm nhất (khả năng xuất hiện cao nhất), không trùng.
function topNumbers(counts, sets) {
  const keys = Object.keys(counts);
  keys.sort((a, b) => counts[b] - counts[a] || (Math.random() - 0.5));
  const picked = keys.slice(0, sets);
  const set = new Set(picked);
  while (set.size < sets) set.add(randomNumber3());
  return [...set];
}

// Lấy mẫu 1 số theo trọng số tần suất
function sampleNumberPair(counts, sets) {
  const entries = Object.entries(counts);
  let sum = 0;
  for (const [, w] of entries) sum += w;
  if (sum <= 0) return sampleAnyPair(sets);
  const picked = new Set();
  let guard = 0;
  while (picked.size < sets && guard < 200) {
    guard++;
    let r = Math.random() * sum;
    let pick = entries[entries.length - 1][0];
    for (const [k, w] of entries) {
      r -= w;
      if (r <= 0) {
        pick = k;
        break;
      }
    }
    picked.add(pick);
  }
  while (picked.size < sets) picked.add(randomNumber3());
  return [...picked];
}

// Hệ số suy giảm theo độ mới cho từng mô hình 3D
function decay3D(modelId, params) {
  if (modelId === 'markov') return params.decayFactor ?? 0.85;
  if (modelId === 'adaptive') return params.decayFactor ?? 0.9;
  if (modelId === 'bayesian') {
    const hl = Math.max(1, params.halfLife ?? 30);
    return Math.pow(0.5, 1 / hl); // suy giảm mũ tương đương half-life
  }
  return 1; // frequency/gap: dùng toàn bộ lịch sử
}

// Điểm "đến hạn" cho số 3 chữ số: kỳ càng lâu chưa xuất hiện càng cao điểm
function number3DGapCounts(draws, params = {}) {
  const gapPower = params.gapPower ?? 1.0;
  const lastSeen = {};
  const counts = {};
  let t = 0;
  for (const d of draws) {
    const nums = d.all && d.all.length ? d.all : d.special || [];
    if (!nums.length) continue;
    t++;
    for (const s of nums) {
      const k = String(s).padStart(3, '0');
      if (!/^\d{3}$/.test(k)) continue;
      lastSeen[k] = t;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  const out = {};
  for (const k of Object.keys(counts)) {
    const c = counts[k];
    const avgGap = c > 0 ? t / c : t;
    const gap = t - (lastSeen[k] || 0);
    out[k] = Math.pow((gap + 1) / (avgGap + 1), gapPower);
  }
  return out;
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
    // Mô phỏng n lần, mỗi lần sinh 1 cặp số; ĐẾM PHIẾU từng số 3 chữ số qua n lần.
    // Kết quả đề xuất = các số có TỶ LỆ XUẤT HIỆN CAO NHẤT trong n lần mô phỏng.
    const sampleStat =
      modelId === 'random'
        ? { counts: {} }
        : modelId === 'gap'
        ? { counts: number3DGapCounts(draws || [], p) }
        : number3DFreq(draws || [], decay3D(modelId, p));
    const votes = {};
    for (let i = 0; i < N; i++) {
      const cand =
        modelId === 'random' ? sampleAnyPair(game.sets) : sampleNumberPair(sampleStat.counts, game.sets);
      for (const k of cand) votes[k] = (votes[k] || 0) + 1;
    }
    const ranked = Object.keys(votes).sort((a, b) => votes[b] - votes[a] || (Math.random() - 0.5));
    const best = ranked.slice(0, game.sets);
    while (best.length < game.sets) best.push(randomNumber3());
    const consensus = best.reduce((s, k) => s + (votes[k] || 0), 0) / (best.length * N);
    return {
      gameId,
      gameType: 'digit3',
      model: modelId,
      modelName: MODEL_META[modelId].name,
      numbers: best, // các số có tỷ lệ xuất hiện cao nhất qua n lần mô phỏng
      special: [],
      confidence: confidenceFor(modelId, drawCount, modelStat.hitRate),
      consensus: Math.round(consensus * 1000) / 1000,
      accuracy: consensus,
      sims: N,
      createdAt: new Date().toISOString(),
    };
  }

  // standard: mô phỏng n lần, ĐẾM PHIẾU từng số qua n lần; kết quả đề xuất =
  // các số có TỶ LỆ XUẤT HIỆN CAO NHẤT trong n lần mô phỏng.
  const mainSets = (draws || []).map((d) => d.main || []);
  const scores = poolScores(modelId, mainSets, game.mainMin, game.mainMax, p, adaptiveWeights);
  const sampleScores = modelId === 'random' ? randomScores(game.mainMin, game.mainMax) : scores;
  const votes = {};
  for (let i = 0; i < N; i++) {
    const cand = weightedSampleSet(sampleScores, game.mainCount, game.mainMin, game.mainMax);
    for (const x of cand) votes[x] = (votes[x] || 0) + 1;
  }
  const items = [];
  for (let x = game.mainMin; x <= game.mainMax; x++) {
    items.push({ x, v: (votes[x] || 0) + Math.random() * 1e-6 });
  }
  items.sort((a, b) => b.v - a.v);
  const best = items.slice(0, game.mainCount).map((it) => it.x).sort((a, b) => a - b);
  const consensus = best.reduce((s, x) => s + (votes[x] || 0), 0) / (game.mainCount * N);

  let special = [];
  let sConsensus = null;
  if (game.special) {
    const specSets = (draws || []).map((d) => d.special || []).filter((s) => s.length > 0);
    const sScores = poolScores(modelId, specSets, game.special.min, game.special.max, p, adaptiveWeights);
    const sSample = modelId === 'random' ? randomScores(game.special.min, game.special.max) : sScores;
    const sVotes = {};
    for (let i = 0; i < N; i++) {
      const c = weightedSampleSet(sSample, game.special.count, game.special.min, game.special.max);
      for (const x of c) sVotes[x] = (sVotes[x] || 0) + 1;
    }
    const sItems = [];
    for (let x = game.special.min; x <= game.special.max; x++) {
      sItems.push({ x, v: (sVotes[x] || 0) + Math.random() * 1e-6 });
    }
    sItems.sort((a, b) => b.v - a.v);
    special = sItems.slice(0, game.special.count).map((it) => it.x).sort((a, b) => a - b);
    sConsensus = special.reduce((s, x) => s + (sVotes[x] || 0), 0) / (game.special.count * N);
  }

  return {
    gameId,
    gameType: 'standard',
    model: modelId,
    modelName: MODEL_META[modelId].name,
    numbers: best,
    special,
    confidence: confidenceFor(modelId, drawCount, modelStat.hitRate),
    consensus: Math.round(consensus * 1000) / 1000,
    specialConsensus: sConsensus == null ? null : Math.round(sConsensus * 1000) / 1000,
    accuracy: consensus,
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
    let numbers;
    if (modelId === 'random') {
      numbers = sampleAnyPair(game.sets);
    } else if (modelId === 'gap') {
      numbers = topNumbers(number3DGapCounts(draws || [], p), game.sets);
    } else {
      const { counts } = number3DFreq(draws || [], decay3D(modelId, p));
      numbers = topNumbers(counts, game.sets);
    }
    return {
      gameId,
      gameType: 'digit3',
      model: modelId,
      modelName: MODEL_META[modelId].name,
      numbers, // cặp số có khả năng xuất hiện cao nhất trong cả kỳ quay
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
