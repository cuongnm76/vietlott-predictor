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
    if (!out.find((o) => o.date === date)) out.push({ date, id: 'mc', main, special });
  }
  return out;
}

// Phân tích giải Đặc biệt cho Max 3D / Max 3D Pro (2 số 3 chữ số đầu tiên)
export function parse3DSpecial(text, game) {
  const idx = text.search(/Đặc biệt/i);
  if (idx < 0) return null;
  const region = text.slice(idx, idx + 140);
  const triples = region.match(/\b\d{3}\b/g) || [];
  if (triples.length < game.sets) return null;
  const pair = triples.slice(0, game.sets);
  const digits = pair.join('').split('').map((c) => parseInt(c, 10));
  return { special: pair, digits };
}

// Lấy kết quả 1 giải theo ngày. Trả về { found, latestDate }.
export async function getMinhChinhResult(gameId, dateISO) {
  const game = GAMES[gameId];
  const [yyyy, mm, dd] = dateISO.split('-');

  if (game.type === 'digit3') {
    const html = await fetchHtml(dateUrl(gameId, dd, mm, yyyy));
    const text = stripTags(html);
    const parsed = parse3DSpecial(text, game);
    if (!parsed) return { found: null, latestDate: null };
    return {
      found: { date: dateISO, id: 'mc', special: parsed.special, digits: parsed.digits },
      latestDate: null,
    };
  }

  // giải dạng số: đọc bảng 15 kỳ trên trang trực tiếp
  const html = await fetchHtml(liveUrl(gameId));
  const text = stripTags(html);
  const rows = parseStandardTable(text, game);
  const found = rows.find((r) => r.date === dateISO) || null;
  const latestDate = rows.length
    ? rows.map((r) => r.date).sort().slice(-1)[0]
    : null;
  return { found, latestDate };
}
