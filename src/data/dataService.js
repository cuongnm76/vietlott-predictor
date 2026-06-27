// Tải dữ liệu lịch sử từ GitHub và lưu cục bộ để dùng offline
import { DATA_BASE_URL, GAMES, GAME_LIST, STORAGE_KEYS } from '../constants';
import { getJSON, setJSON, getString, setString } from '../storage/storage';
import { parseGameData } from './parser';

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

// Tự tìm kết quả thực tế trên mạng theo ngày quay thưởng.
// Tải dữ liệu mới nhất của giải, lưu cache, rồi tìm kỳ có ngày trùng khớp.
// Trả về { found: <kỳ quay|null>, total, updated }
export async function fetchResultByDate(gameId, dateISO) {
  const game = GAMES[gameId];
  const url = `${DATA_BASE_URL}/${game.file}`;
  const text = await fetchText(url);
  const draws = parseGameData(gameId, text);
  if (draws.length > 0) {
    await setJSON(STORAGE_KEYS.draws(gameId), draws);
    await setString(STORAGE_KEYS.lastUpdate, new Date().toISOString());
  }
  const found = draws.find((d) => d.date === dateISO) || null;
  return { found, total: draws.length, updated: draws.length > 0 };
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
