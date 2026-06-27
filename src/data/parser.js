// Phân tích dữ liệu .jsonl từ kho vietlott-data và chuẩn hóa
import { GAMES } from '../constants';

// Tách từng dòng JSON
export function parseJsonl(text) {
  if (!text) return [];
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch (e) {
      // bỏ qua dòng hỏng
    }
  }
  return out;
}

function findSpecialPairKey(resultObj) {
  const keys = Object.keys(resultObj || {});
  // "Giải Đặc biệt" -> chứa "biệt" hoặc "Đặc"
  return (
    keys.find((k) => k.toLowerCase().includes('đặc') || k.includes('biệt')) ||
    keys[0]
  );
}

// Chuẩn hóa 1 bản ghi về dạng dùng chung
export function normalizeDraw(game, rec) {
  if (!rec) return null;
  const date = rec.date || rec.draw_date || '';
  const id = rec.id != null ? String(rec.id) : '';

  if (game.type === 'digit3') {
    const result = rec.result || {};
    const pairKey = findSpecialPairKey(result);
    let pair = Array.isArray(result[pairKey]) ? result[pairKey] : [];
    pair = pair.map((s) => String(s).padStart(3, '0')).slice(0, game.sets);
    // Gom mọi chữ số từ tất cả giải để phân tích tần suất
    const digits = [];
    Object.values(result).forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((s) => {
          String(s)
            .split('')
            .forEach((c) => {
              const d = parseInt(c, 10);
              if (!isNaN(d)) digits.push(d);
            });
        });
      }
    });
    if (pair.length === 0) return null;
    return { date, id, special: pair, digits };
  }

  // standard
  const result = Array.isArray(rec.result) ? rec.result : [];
  if (result.length < game.mainCount) return null;
  const main = result.slice(0, game.mainCount).map((n) => parseInt(n, 10));
  let special = [];
  if (game.special) {
    special = result
      .slice(game.mainCount, game.mainCount + game.special.count)
      .map((n) => parseInt(n, 10));
  }
  if (main.some((n) => isNaN(n))) return null;
  return { date, id, main, special };
}

// Phân tích toàn bộ file của 1 giải
export function parseGameData(gameId, text) {
  const game = GAMES[gameId];
  if (!game) return [];
  const records = parseJsonl(text);
  const draws = [];
  for (const rec of records) {
    const d = normalizeDraw(game, rec);
    if (d) draws.push(d);
  }
  // Sắp xếp theo ngày tăng dần (cũ -> mới) để mô hình Markov dùng đúng thứ tự
  draws.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return draws;
}
