// Công cụ quét kết quả từ minhchinh.com (nguồn ưu tiên).
//  - Power/Mega/Lotto: đọc bảng "15 kỳ gần nhất" trên trang trực tiếp.
//  - Max 3D / Max 3D Pro: tải trang kết quả THEO NGÀY rồi đọc giải Đặc biệt (2 số 3 chữ số).
// Phân tích trên HTML đã loại thẻ; có kiểm tra phạm vi để loại nhiễu.
import { GAMES } from '../constants';

const LIVE_PATH = {
  power655: 'truc-tiep-xo-so-tu-chon-power-655',
  mega645: 'truc-tiep-xo-so-tu-chon-mega-645',
  lotto535: 'truc-tiep-xo-so-tu-chon-lotto-535',
  max3d: 'truc-tiep-xo-so-tu-chon-max-3d',
  max3dpro: 'truc-tiep-xo-so-tu-chon-max3d-pro',
};

// slug dùng cho URL kết quả theo ngày: xs-<slug>-ket-qua-<slug>-ngay-DD-MM-YYYY.html
const SLUG = {
  power655: 'power-655',
  mega645: 'mega-645',
  lotto535: 'lotto-535',
  max3d: 'max-3d',
  max3dpro: 'max3d-pro',
};

const liveUrl = (id) => `https://www.minhchinh.com/${LIVE_PATH[id]}.html`;
const dateUrl = (id, dd, mm, yyyy) =>
  `https://www.minhchinh.com/xs-${SLUG[id]}-ket-qua-${SLUG[id]}-ngay-${dd}-${mm}-${yyyy}.html`;

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (Android) VietlottPredictor',
    },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

function stripTags(html) {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Phân tích bảng "15 kỳ gần nhất" cho giải dạng số
export function parseStandardTable(text, game) {
  let s = text.search(/gần nhất/i);
  let region = s >= 0 ? text.slice(s) : text;
  const stop = region.search(/Thống kê (bộ số|tần suất)/i);
  if (stop > 0) region = region.slice(0, stop);

  const out = [];
  const isLotto = game.id === 'lotto535';
  const dateRe = isLotto
    ? /(\d{2})\/(\d{2})\/(\d{2})(?:\s*\d{1,2}h)?/g
    : /(\d{2})\/(\d{2})\/(\d{4})/g;
  let m;
  while ((m = dateRe.exec(region))) {
    const dd = m[1];
    const mm = m[2];
    const yyyy = m[3].length === 2 ? '20' + m[3] : m[3];
    const after = region.slice(m.index + m[0].length, m.index + m[0].length + 40);
    const cut = after.split(',')[0]; // bỏ phần giá trị Jackpot (có dấu phẩy)
    const digits = (cut.match(/\d/g) || []).join('');
    if (digits.length < game.mainCount * 2) continue;
    const main = [];
    for (let i = 0; i < game.mainCount * 2; i += 2) main.push(parseInt(digits.slice(i, i + 2), 10));
    if (main.some((n) => isNaN(n) || n < game.mainMin || n > game.mainMax)) continue;
    let special = [];
    if (game.special) {
      const sp = parseInt(digits.slice(game.mainCount * 2, game.mainCount * 2 + 2), 10);
      if (!isNaN(sp) && sp >= game.special.min && sp <= game.special.max) special = [sp];
    }
    const date = `${yyyy}-${mm}-${dd}`;
    // dedupe theo ngày + bộ số -> Lotto 5/35 (2 kỳ/ngày) giữ cả hai kỳ vì số khác nhau
    const key = date + '|' + main.join('-');
    if (!out.find((o) => o.date + '|' + o.main.join('-') === key)) {
      out.push({ date, id: 'mc', main, special });
    }
  }
  return out;
}

// Cấu trúc giải của Max 3D / Max 3D Pro: Đặc biệt(2) Nhất(4) Nhì(6) Ba(8) = 20 bộ
const PRIZE_SPECS_3D = [
  { key: 'special', label: 'Đặc biệt', count: 2 },
  { key: 'first', label: 'Giải nhất', count: 4 },
  { key: 'second', label: 'Giải nhì', count: 6 },
  { key: 'third', label: 'Giải ba', count: 8 },
];

// Phân tích TOÀN BỘ kết quả Max 3D / Max 3D Pro (mọi giải, 20 bộ số 3 chữ số).
// Max 3D: cột kết quả nằm SAU "giá trị: số_lượng" -> bỏ số lượng.
// Max 3D Pro: cột kết quả nằm NGAY SAU nhãn giải.
export function parse3DFull(text, game) {
  const isPro = game.id === 'max3dpro';
  const prizes = {};
  const all = [];
  for (const spec of PRIZE_SPECS_3D) {
    const li = text.indexOf(spec.label);
    if (li < 0) continue;
    let region;
    if (isPro) {
      region = text.slice(li + spec.label.length, li + spec.label.length + 70);
    } else {
      const colon = text.indexOf(':', li);
      const base = colon >= 0 ? colon + 1 : li + spec.label.length;
      region = text.slice(base, base + 80).replace(/^\s*\d+/, ''); // bỏ số lượng người trúng
    }
    const triples = (region.match(/\b\d{3}\b/g) || []).slice(0, spec.count);
    if (triples.length) {
      prizes[spec.key] = triples;
      all.push(...triples);
    }
  }
  const special = prizes.special || [];
  if (special.length < game.sets) return null;
  const digits = all.join('').split('').map((c) => parseInt(c, 10));
  return { special: special.slice(0, game.sets), all, digits, prizes };
}

// Lấy kết quả 1 giải theo ngày. Trả về { found, latestDate }.
export async function getMinhChinhResult(gameId, dateISO) {
  const game = GAMES[gameId];
  const [yyyy, mm, dd] = dateISO.split('-');

  if (game.type === 'digit3') {
    const html = await fetchHtml(dateUrl(gameId, dd, mm, yyyy));
    const text = stripTags(html);
    const parsed = parse3DFull(text, game);
    if (!parsed) return { found: null, extras: [], latestDate: null };
    return {
      found: {
        date: dateISO,
        id: 'mc',
        special: parsed.special, // cặp Đặc biệt (dùng để so dự đoán)
        all: parsed.all, // toàn bộ 20 bộ số của mọi giải
        digits: parsed.digits, // mọi chữ số (cho thống kê tần suất)
        prizes: parsed.prizes, // {special, first, second, third}
      },
      extras: [],
      latestDate: null,
    };
  }

  // giải dạng số: đọc bảng 15 kỳ trên trang trực tiếp
  const html = await fetchHtml(liveUrl(gameId));
  const text = stripTags(html);
  const rows = parseStandardTable(text, game);
  const matches = rows.filter((r) => r.date === dateISO);
  const found = matches[0] || null; // Lotto 5/35: kỳ 21h (liệt kê trước)
  const extras = matches.slice(1); // Lotto 5/35: kỳ 13h (lưu kèm)
  const latestDate = rows.length ? rows.map((r) => r.date).sort().slice(-1)[0] : null;
  return { found, extras, latestDate };
}
