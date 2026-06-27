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

// Tải dữ liệu cho 1 giải
export async function updateGame(gameId) {
  const game = GAMES[gameId];
  const url = `${DATA_BASE_URL}/${game.file}`;
  const text = await fetchText(url);
  const draws = parseGameData(gameId, text);
  if (draws.length === 0) throw new Error('Không phân tích được dữ liệu');
  await setJSON(STORAGE_KEYS.draws(gameId), draws);
  return draws.length;
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

// Thêm/cập nhật 1 kỳ vào dữ liệu cục bộ
async function mergeDraw(gameId, draw) {
  const draws = (await getJSON(STORAGE_KEYS.draws(gameId), [])) || [];
  const idx = draws.findIndex((d) => d.date === draw.date);
  if (idx >= 0) draws[idx] = draw;
  else draws.push(draw);
  draws.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  await setJSON(STORAGE_KEYS.draws(gameId), draws);
  return draws;
}

// Tìm kết quả theo ngày: ƯU TIÊN minhchinh.com, nếu không có thì thử dữ liệu GitHub.
// Trả về { found, source, latestDate }
export async function findResultByDate(gameId, dateISO) {
  let latestDate = null;
  // 1) Nguồn ưu tiên: minhchinh.com
  try {
    const mc = await getMinhChinhResult(gameId, dateISO);
    if (mc) {
      latestDate = mc.latestDate || latestDate;
      if (mc.found) {
        await mergeDraw(gameId, mc.found);
        await setString(STORAGE_KEYS.lastUpdate, new Date().toISOString());
        return { found: mc.found, source: 'minhchinh.com', latestDate };
      }
    }
  } catch (e) {
    // bỏ qua, chuyển sang nguồn dự phòng
  }
  // 2) Dự phòng: dữ liệu GitHub (vietlott-data)
  try {
    const gh = await fetchResultByDate(gameId, dateISO);
    if (!latestDate) latestDate = gh.latestDate || null;
    if (gh.found) return { found: gh.found, source: 'vietlott-data', latestDate };
    return { found: null, source: null, latestDate };
  } catch (e) {
    return { found: null, source: null, latestDate };
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
