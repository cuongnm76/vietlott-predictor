// Cấu hình chung cho ứng dụng Vietlott Predictor

// Nguồn dữ liệu lịch sử trên GitHub (raw)
export const DATA_BASE_URL =
  'https://raw.githubusercontent.com/vietvudanh/vietlott-data/master/data';

// Định nghĩa 4 (5) loại giải thưởng được hỗ trợ
// type:
//   'standard' -> chọn k số trong [min..max], có thể kèm số đặc biệt
//   'digit3'   -> mỗi bộ gồm 3 chữ số (0-9), dự đoán "sets" bộ
export const GAMES = {
  power655: {
    id: 'power655',
    name: 'Power 6/55',
    short: '6/55',
    file: 'power655.jsonl',
    type: 'standard',
    mainCount: 6,
    mainMin: 1,
    mainMax: 55,
    // file có 7 số: 6 số chính + 1 số phụ (phần tử cuối)
    hasBonusInData: true,
    special: null,
    color: '#E11D48',
    desc: '6 số từ 1 đến 55',
  },
  mega645: {
    id: 'mega645',
    name: 'Mega 6/45',
    short: '6/45',
    file: 'power645.jsonl',
    type: 'standard',
    mainCount: 6,
    mainMin: 1,
    mainMax: 45,
    hasBonusInData: false,
    special: null,
    color: '#2563EB',
    desc: '6 số từ 1 đến 45',
  },
  loto535: {
    id: 'loto535',
    name: 'Loto 5/35',
    short: '5/35',
    file: 'power535.jsonl',
    type: 'standard',
    mainCount: 5,
    mainMin: 1,
    mainMax: 35,
    hasBonusInData: false,
    // 5 số chính (1-35) + 1 số đặc biệt (1-12) là phần tử cuối trong result
    special: { count: 1, min: 1, max: 12, label: 'Số đặc biệt' },
    color: '#16A34A',
    desc: '5 số (1-35) + 1 số đặc biệt (1-12)',
  },
  max3d: {
    id: 'max3d',
    name: 'Max 3D',
    short: '3D',
    file: '3d.jsonl',
    type: 'digit3',
    sets: 2,
    digitsPerSet: 3,
    color: '#D97706',
    desc: '2 cặp 3 chữ số (0-9)',
  },
  max3dpro: {
    id: 'max3dpro',
    name: 'Max 3D Pro',
    short: '3D Pro',
    file: '3d_pro.jsonl',
    type: 'digit3',
    sets: 2,
    digitsPerSet: 3,
    color: '#7C3AED',
    desc: '2 cặp 3 chữ số (0-9)',
  },
};

export const GAME_LIST = Object.values(GAMES);

export const MODEL_IDS = ['random', 'frequency', 'markov', 'bayesian', 'gap', 'adaptive'];

export const MODEL_META = {
  random: {
    id: 'random',
    name: 'Ngẫu nhiên',
    desc: 'Chọn ngẫu nhiên, không dựa trên dữ liệu lịch sử.',
    baseConfidence: 0.1,
  },
  frequency: {
    id: 'frequency',
    name: 'Tần suất',
    desc: 'Ưu tiên các số xuất hiện thường xuyên nhất.',
    baseConfidence: 0.5,
  },
  markov: {
    id: 'markov',
    name: 'Markov Chain',
    desc: 'Dự báo theo xác suất chuyển tiếp giữa các kỳ.',
    baseConfidence: 0.4,
  },
  bayesian: {
    id: 'bayesian',
    name: 'Bayesian',
    desc: 'Hậu nghiệm Dirichlet với suy giảm theo thời gian (half-life) — ước lượng xác suất hiện đại cho dữ liệu ngẫu nhiên.',
    baseConfidence: 0.5,
  },
  gap: {
    id: 'gap',
    name: 'Chu kỳ (Gap)',
    desc: 'Phân tích khoảng cách xuất hiện — ưu tiên số "đến hạn" lâu chưa ra so với chu kỳ trung bình.',
    baseConfidence: 0.4,
  },
  adaptive: {
    id: 'adaptive',
    name: 'Thích ứng (AI)',
    desc: 'Ensemble học trực tuyến: kết hợp mọi mô hình với trọng số tự học từ kết quả thực tế.',
    baseConfidence: 0.6,
  },
};

// Tham số mặc định + khoảng giá trị (dùng cho slider trong Settings)
export const DEFAULT_PARAMS = {
  random: {},
  frequency: { weightFactor: 1.0, minOccurrences: 2 },
  markov: { order: 1, smoothing: 0.5 },
  bayesian: { alpha: 0.5, halfLife: 30 },
  gap: { gapPower: 1.0, mixFreq: 0.3 },
  adaptive: { learningRate: 0.3, decayFactor: 0.9, windowSize: 50 },
};

export const PARAM_RANGES = {
  frequency: {
    weightFactor: { min: 0.5, max: 2.0, step: 0.1, label: 'Hệ số trọng số' },
    minOccurrences: { min: 1, max: 10, step: 1, label: 'Số lần tối thiểu' },
  },
  markov: {
    order: { min: 1, max: 5, step: 1, label: 'Bậc (order)' },
    smoothing: { min: 0.1, max: 1.0, step: 0.1, label: 'Làm mượt (smoothing)' },
  },
  bayesian: {
    alpha: { min: 0.1, max: 2.0, step: 0.1, label: 'Tiên nghiệm (alpha)' },
    halfLife: { min: 10, max: 100, step: 5, label: 'Bán rã dữ liệu (kỳ)' },
  },
  gap: {
    gapPower: { min: 0.5, max: 2.0, step: 0.1, label: 'Độ nhạy chu kỳ' },
    mixFreq: { min: 0, max: 1.0, step: 0.05, label: 'Pha trộn tần suất' },
  },
  adaptive: {
    learningRate: { min: 0.1, max: 1.0, step: 0.1, label: 'Tốc độ học' },
    decayFactor: { min: 0.5, max: 1.0, step: 0.05, label: 'Hệ số suy giảm' },
    windowSize: { min: 10, max: 100, step: 5, label: 'Cửa sổ dữ liệu' },
  },
};

// Số lần mô phỏng Monte Carlo cho mỗi dự đoán (mặc định 100, tối đa 1000)
export const SIM_RANGE = { min: 10, max: 1000, step: 10, default: 100 };

// Khóa lưu trữ AsyncStorage
export const STORAGE_KEYS = {
  history: (gameId) => `vp:history:${gameId}`,
  draws: (gameId) => `vp:draws:${gameId}`,
  lastUpdate: 'vp:lastUpdate',
  settings: 'vp:settings',
  modelStats: 'vp:modelStats',
  predictions: 'vp:predictions', // danh sách dự đoán đã lưu (mọi giải)
};
