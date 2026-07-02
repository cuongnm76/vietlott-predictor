// Tải dữ liệu lịch sử từ GitHub và lưu cục bộ để dùng offline
import { DATA_BASE_URL, GAMES, GAME_LIST, STORAGE_KEYS } from '../constants';
import { getJSON, setJSON, getString, setString } from '../storage/storage';
import { parseGameData } from './parser';
import { getMinhChinhResult } from './minhchinh';

async function fetchText(url) {
  const res = await fetch(url, { headers: { Accept: 'text/plain' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

// Cập nhật dữ liệu cho 1 giải theo kiểu TĂNG DẦN: chỉ thêm những kỳ còn thiếu,
// giữ nguyên dữ liệu đã có (kể cả kỳ lấy từ minhchinh.com). Trả về số kỳ mới thêm.
export async function updateGame(gameId) {
  const game = GAMES[gameId];
  const url = `${DATA_BASE_URL}/${game.file}`;
  const text = await fetchText(url);
  const fresh = parseGameData(gameId, text);
  if (fresh.length === 0) throw new Error('Không phân tích được dữ liệu');
  const existing = (await getJSON(STORAGE_KEYS.draws(gameId), [])) || [];
  const byKey = new Map();
  for (const d of existing) byKey.set(drawKey(d), d);
  let added = 0;
  for (const d of fresh) {
    const k = drawKey(d);
    if (!byKey.has(k)) {
      byKey.set(k, d);
      added++;
    } else if (d.all && !byKey.get(k).all) {
      // nâng cấp bản ghi 3D cũ (chỉ có Đặc biệt) lên bản đầy đủ mọi giải
      byKey.set(k, d);
    }
  }
  const merged = [...byKey.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  await setJSON(STORAGE_KEYS.draws(gameId), merged);
  return added;
}

// Cập nhật toàn bộ các giải. onProgress(gameName, status)
export async function updateAllGames(onProgress) {
  const results = {};
  for (const game of GAME_LIST) {
    try {
      onProgress && onProgress(game.name, 'loading');
      const count = await updateGame(game.id);
      results[game.id] = { ok: true, count };
      onProgress && onProgress(game.name, 'done', count);
    } catch (e) {
      results[game.id] = { ok: false, error: e?.message || 'Lỗi' };
      onProgress && onProgress(game.name, 'error', e?.message);
    }
  }
  const anyOk = Object.values(results).some((r) => r.ok);
  if (anyOk) {
    await setString(STORAGE_KEYS.lastUpdate, new Date().toISOString());
  }
  return results;
}

export async function getDraws(gameId) {
  return (await getJSON(STORAGE_KEYS.draws(gameId), [])) || [];
}

// Công cụ quét kết quả thực tế trên mạng theo ngày quay thưởng.
// Tải dữ liệu mới nhất của giải, lưu cache, rồi:
//  - tìm kỳ trùng đúng ngày đã chọn (found)
//  - nếu không có, tìm kỳ có ngày GẦN NHẤT với ngày đã chọn (nearest)
// Trả về { found, nearest, exactMatch, total, latestDate, earliestDate }
export async function fetchResultByDate(gameId, dateISO) {
  const game = GAMES[gameId];
  const url = `${DATA_BASE_URL}/${game.file}`;
  const text = await fetchText(url);
  const draws = parseGameData(gameId, text);
  if (draws.length > 0) {
    await setJSON(STORAGE_KEYS.draws(gameId), draws);
    await setString(STORAGE_KEYS.lastUpdate, new Date().toISOString());
  }
  const target = new Date(dateISO + 'T00:00:00').getTime();
  let found = null;
  let nearest = null;
  let bestDiff = Infinity;
  for (const d of draws) {
    if (d.date === dateISO) found = d;
    const t = new Date(d.date + 'T00:00:00').getTime();
    if (!isNaN(t)) {
      const diff = Math.abs(t - target);
      // dùng <= để khi cách đều thì ưu tiên kỳ MỚI HƠN (draws đã xếp tăng dần)
      if (diff <= bestDiff) {
        bestDiff = diff;
        nearest = d;
      }
    }
  }
  return {
    found,
    nearest,
    exactMatch: !!found,
    total: draws.length,
    latestDate: draws.length ? draws[draws.length - 1].date : null,
    earliestDate: draws.length ? draws[0].date : null,
  };
}

// Khóa nhận dạng 1 kỳ theo nội dung (ngày + bộ số) -> Lotto 2 kỳ/ngày vẫn giữ cả hai
function drawKey(d) {
  return d.date + '|' + ((d.main && d.main.join('-')) || (d.special && d.special.join('-')) || '');
}

// Thêm/cập nhật 1 kỳ vào dữ liệu cục bộ (không ghi đè kỳ khác cùng ngày)
async function mergeDraw(gameId, draw) {
  const draws = (await getJSON(STORAGE_KEYS.draws(gameId), [])) || [];
  const k = drawKey(draw);
  const idx = draws.findIndex((d) => drawKey(d) === k);
  if (idx >= 0) draws[idx] = draw;
  else draws.push(draw);
  draws.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  await setJSON(STORAGE_KEYS.draws(gameId), draws);
  return draws;
}

// Tìm kết quả theo ngày: ƯU TIÊN minhchinh.com, nếu không có thì thử dữ liệu GitHub.
// Trả về { found, extras, source, latestDate }
//   extras: các kỳ khác cùng ngày (Lotto 5/35 có kỳ 13h ngoài kỳ 21h)
export async function findResultByDate(gameId, dateISO) {
  let latestDate = null;
  // 1) Nguồn ưu tiên: minhchinh.com
  try {
    const mc = await getMinhChinhResult(gameId, dateISO);
    if (mc) {
      latestDate = mc.latestDate || latestDate;
      if (mc.found) {
        const extras = mc.extras || [];
        await mergeDraw(gameId, mc.found);
        for (const ex of extras) await mergeDraw(gameId, ex);
        await setString(STORAGE_KEYS.lastUpdate, new Date().toISOString());
        return { found: mc.found, extras, source: 'minhchinh.com', latestDate };
      }
    }
  } catch (e) {
    // bỏ qua, chuyển sang nguồn dự phòng
  }
  // 2) Dự phòng: dữ liệu GitHub (vietlott-data)
  try {
    const gh = await fetchResultByDate(gameId, dateISO);
    if (!latestDate) latestDate = gh.latestDate || null;
    if (gh.found) {
      // lấy các kỳ khác cùng ngày (Lotto 5/35: kỳ 13h) từ dữ liệu đã lưu
      const draws = (await getJSON(STORAGE_KEYS.draws(gameId), [])) || [];
      const k0 = drawKey(gh.found);
      const extras = draws.filter((d) => d.date === dateISO && drawKey(d) !== k0);
      return { found: gh.found, extras, source: 'vietlott-data', latestDate };
    }
    return { found: null, extras: [], source: null, latestDate };
  } catch (e) {
    return { found: null, extras: [], source: null, latestDate };
  }
}

export async function getLastUpdate() {
  return await getString(STORAGE_KEYS.lastUpdate, null);
}

export async function hasAnyData() {
  for (const game of GAME_LIST) {
    const d = await getJSON(STORAGE_KEYS.draws(game.id), []);
    if (d && d.length > 0) return true;
  }
  return false;
}
