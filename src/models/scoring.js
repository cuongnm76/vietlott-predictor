// Các hàm tính điểm (score) dùng chung cho mọi mô hình.
// "sets" là danh sách các kỳ quay, mỗi kỳ là mảng số trong [min..max].

export function range(min, max) {
  const a = [];
  for (let i = min; i <= max; i++) a.push(i);
  return a;
}

// Chọn `count` số có điểm cao nhất, đảm bảo không trùng, có jitter để phá hòa.
export function pickTopUnique(scores, count, min, max) {
  const items = [];
  for (let n = min; n <= max; n++) {
    const base = scores[n] || 0;
    items.push({ n, s: base + Math.random() * 1e-6 });
  }
  items.sort((a, b) => b.s - a.s);
  const picked = items.slice(0, count).map((x) => x.n);
  picked.sort((a, b) => a - b);
  return picked;
}

// Điểm ngẫu nhiên đều
export function randomScores(min, max) {
  const s = {};
  for (let n = min; n <= max; n++) s[n] = Math.random();
  return s;
}

// Điểm theo tần suất, có trọng số hồi quy theo độ mới và lọc minOccurrences.
export function frequencyScores(sets, min, max, params = {}) {
  const weightFactor = params.weightFactor ?? 1.0;
  const minOccurrences = params.minOccurrences ?? 1;
  const decay = params.decayFactor ?? 1.0; // 1 = không suy giảm
  const counts = {};
  const total = sets.length;
  for (let i = 0; i < total; i++) {
    // số kỳ càng mới trọng số càng cao (nếu decay < 1)
    const recencyW = decay >= 1 ? 1 : Math.pow(decay, total - 1 - i);
    for (const n of sets[i]) {
      if (n < min || n > max) continue;
      counts[n] = (counts[n] || 0) + recencyW;
    }
  }
  const s = {};
  for (let n = min; n <= max; n++) {
    const c = counts[n] || 0;
    if (c >= minOccurrences) {
      s[n] = Math.pow(c, weightFactor);
    } else {
      // vẫn giữ điểm rất thấp để có thể "lấp đầy" khi thiếu
      s[n] = c * 0.001;
    }
  }
  return s;
}

// Điểm theo chuỗi Markov bậc `order` với làm mượt Laplace.
// Dự đoán số có xác suất xuất hiện cao ở kỳ kế tiếp dựa trên `order` kỳ gần nhất.
export function markovScores(sets, min, max, params = {}) {
  const order = Math.max(1, Math.round(params.order ?? 1));
  const smoothing = params.smoothing ?? 0.5;
  const total = sets.length;
  if (total < order + 1) {
    // không đủ dữ liệu -> rơi về tần suất đơn giản
    return frequencyScores(sets, min, max, {});
  }
  // Đếm chuyển tiếp: với mỗi số a ở "ngữ cảnh" (hợp của `order` kỳ trước),
  // đếm số b xuất hiện ở kỳ kế tiếp.
  // trans[a][b] = count
  const trans = {};
  for (let t = order; t < total; t++) {
    const context = new Set();
    for (let k = 1; k <= order; k++) {
      for (const a of sets[t - k]) context.add(a);
    }
    for (const a of context) {
      if (!trans[a]) trans[a] = {};
      for (const b of sets[t]) {
        trans[a][b] = (trans[a][b] || 0) + 1;
      }
    }
  }
  // Ngữ cảnh hiện tại = `order` kỳ gần nhất
  const current = new Set();
  for (let k = 1; k <= order; k++) {
    const idx = total - k;
    if (idx >= 0) for (const a of sets[idx]) current.add(a);
  }
  const s = {};
  for (let b = min; b <= max; b++) {
    let score = 0;
    for (const a of current) {
      const row = trans[a];
      if (!row) {
        score += smoothing / (max - min + 1);
        continue;
      }
      let rowTotal = 0;
      for (const key in row) rowTotal += row[key];
      const num = (row[b] || 0) + smoothing;
      const den = rowTotal + smoothing * (max - min + 1);
      score += num / den;
    }
    s[b] = score;
  }
  return s;
}

// Chuẩn hóa điểm về [0,1] để dễ kết hợp
export function normalizeScores(scores, min, max) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let n = min; n <= max; n++) {
    const v = scores[n] || 0;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const out = {};
  const span = hi - lo || 1;
  for (let n = min; n <= max; n++) {
    out[n] = ((scores[n] || 0) - lo) / span;
  }
  return out;
}

// Bảng tần suất xuất hiện (dùng cho biểu đồ NumberFrequency)
export function frequencyTable(sets, min, max) {
  const counts = {};
  for (let n = min; n <= max; n++) counts[n] = 0;
  for (const set of sets) {
    for (const n of set) {
      if (n >= min && n <= max) counts[n] += 1;
    }
  }
  return counts;
}
