import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Appearance } from 'react-native';
import { DEFAULT_PARAMS, STORAGE_KEYS, GAMES, MODEL_IDS, SIM_RANGE } from '../constants';
import { getTheme } from '../theme';
import { getJSON, setJSON, getString } from '../storage/storage';
import { updateAllGames, getDraws, getLastUpdate, fetchResultByDate } from '../data/dataService';
import { predict, predictSimulated } from '../models/predict';
import { recordResult, emptyStats } from '../models/learning';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const DEFAULT_SETTINGS = {
  themeMode: 'system', // 'system' | 'light' | 'dark'
  defaultModel: 'adaptive',
  simulations: SIM_RANGE.default, // số lần mô phỏng mỗi dự đoán
  params: JSON.parse(JSON.stringify(DEFAULT_PARAMS)),
};

let _pid = 0;
function newId() {
  _pid += 1;
  return `${Date.now()}_${_pid}`;
}

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [predictions, setPredictions] = useState([]);
  const [modelStats, setModelStats] = useState(emptyStats());
  const [drawsByGame, setDrawsByGame] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());

  // Tải dữ liệu lưu trữ khi khởi động
  useEffect(() => {
    (async () => {
      const s = await getJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
      const merged = {
        ...DEFAULT_SETTINGS,
        ...s,
        params: { ...DEFAULT_PARAMS, ...(s?.params || {}) },
      };
      setSettings(merged);
      setPredictions((await getJSON(STORAGE_KEYS.predictions, [])) || []);
      setModelStats((await getJSON(STORAGE_KEYS.modelStats, {})) || {});
      const draws = {};
      for (const id of Object.keys(GAMES)) {
        draws[id] = await getDraws(id);
      }
      setDrawsByGame(draws);
      setLastUpdate(await getLastUpdate());
      setReady(true);
    })();
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    return () => sub.remove();
  }, []);

  const theme = useMemo(
    () => getTheme(settings.themeMode, systemScheme),
    [settings.themeMode, systemScheme]
  );

  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    await setJSON(STORAGE_KEYS.settings, next);
  }, []);

  const updateSettings = useCallback(
    (patch) => persistSettings({ ...settings, ...patch }),
    [settings, persistSettings]
  );

  const updateParam = useCallback(
    (modelId, key, value) => {
      const next = {
        ...settings,
        params: {
          ...settings.params,
          [modelId]: { ...settings.params[modelId], [key]: value },
        },
      };
      persistSettings(next);
    },
    [settings, persistSettings]
  );

  const resetParams = useCallback(() => {
    persistSettings({ ...settings, params: JSON.parse(JSON.stringify(DEFAULT_PARAMS)) });
  }, [settings, persistSettings]);

  // Xóa toàn bộ dữ liệu học của AI (thống kê + tham số đã tinh chỉnh)
  const resetLearning = useCallback(async () => {
    setModelStats({});
    await setJSON(STORAGE_KEYS.modelStats, {});
  }, []);

  // Cập nhật dữ liệu từ GitHub
  const refreshData = useCallback(async (onProgress) => {
    const results = await updateAllGames(onProgress);
    const draws = {};
    for (const id of Object.keys(GAMES)) draws[id] = await getDraws(id);
    setDrawsByGame(draws);
    setLastUpdate(await getLastUpdate());
    return results;
  }, []);

  // Tham số dùng để dự đoán = tham số cài đặt + tham số AI đã tinh chỉnh (ưu tiên)
  const paramsFor = useCallback(
    (gameId, model) => {
      const tuned = modelStats[gameId]?.[model]?.params || {};
      return { ...settings.params[model], ...tuned };
    },
    [settings, modelStats]
  );

  // Tạo 1 dự đoán cho 1 mô hình (chưa lưu)
  const makePrediction = useCallback(
    (gameId, modelId) => {
      const model = modelId || settings.defaultModel;
      const draws = drawsByGame[gameId] || [];
      const stat = modelStats[gameId]?.[model] || {};
      const pred = predict(gameId, draws, model, paramsFor(gameId, model), stat);
      pred.id = newId();
      return pred;
    },
    [drawsByGame, settings, modelStats, paramsFor]
  );

  // Tạo dự đoán cho TẤT CẢ 4 mô hình cùng lúc, mỗi mô hình mô phỏng n lần
  const makeAllPredictions = useCallback(
    (gameId) => {
      const draws = drawsByGame[gameId] || [];
      const batch = Date.now();
      const n = settings.simulations || SIM_RANGE.default;
      return MODEL_IDS.map((model) => {
        const stat = modelStats[gameId]?.[model] || {};
        const pred = predictSimulated(gameId, draws, model, paramsFor(gameId, model), stat, n);
        pred.id = newId();
        pred.batch = batch;
        return pred;
      });
    },
    [drawsByGame, modelStats, paramsFor, settings.simulations]
  );

  // Lưu nhiều dự đoán cùng lúc
  const savePredictions = useCallback(
    async (list) => {
      const items = list.map((p) => ({ ...p, id: p.id || newId(), saved: true }));
      const next = [...items, ...predictions];
      setPredictions(next);
      await setJSON(STORAGE_KEYS.predictions, next);
      return items;
    },
    [predictions]
  );

  const savePrediction = useCallback(
    async (pred) => {
      const item = { ...pred, id: pred.id || newId(), saved: true };
      const next = [item, ...predictions];
      setPredictions(next);
      await setJSON(STORAGE_KEYS.predictions, next);
      return item;
    },
    [predictions]
  );

  const deletePrediction = useCallback(
    async (id) => {
      const next = predictions.filter((p) => p.id !== id);
      setPredictions(next);
      await setJSON(STORAGE_KEYS.predictions, next);
    },
    [predictions]
  );

  // Nhập kết quả thực tế: lưu vào dữ liệu, đánh giá dự đoán, AI tự học
  const inputResult = useCallback(
    async (gameId, actualDraw) => {
      // 1) thêm vào dữ liệu lịch sử (để mô hình học)
      const draws = [...(drawsByGame[gameId] || [])];
      const existsIdx = draws.findIndex((d) => d.date === actualDraw.date);
      if (existsIdx >= 0) draws[existsIdx] = actualDraw;
      else draws.push(actualDraw);
      draws.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const nextDraws = { ...drawsByGame, [gameId]: draws };
      setDrawsByGame(nextDraws);
      await setJSON(STORAGE_KEYS.draws(gameId), draws);

      // 2) đánh giá các dự đoán đã lưu của giải này chưa có kết quả
      const targets = predictions.filter(
        (p) => p.gameId === gameId && !p.result
      );
      const history = draws.filter((d) => d.date < actualDraw.date);
      const lr = settings.params.adaptive?.learningRate ?? 0.3;
      const statsCopy = JSON.parse(JSON.stringify(modelStats));
      const { stats, evaluated } = recordResult(
        statsCopy,
        gameId,
        targets,
        actualDraw,
        history,
        settings.params,
        lr
      );
      setModelStats(stats);
      await setJSON(STORAGE_KEYS.modelStats, stats);

      // 3) gắn kết quả vào từng dự đoán
      const evalMap = {};
      evaluated.forEach((e) => (evalMap[e.id] = e));
      const nextPreds = predictions.map((p) =>
        evalMap[p.id]
          ? {
              ...p,
              result: {
                date: actualDraw.date,
                numbers: actualDraw.main || actualDraw.special,
                special: actualDraw.special,
                hits: evalMap[p.id].hits,
                possible: evalMap[p.id].possible,
              },
            }
          : p
      );
      setPredictions(nextPreds);
      await setJSON(STORAGE_KEYS.predictions, nextPreds);

      return { evaluatedCount: evaluated.length };
    },
    [drawsByGame, predictions, modelStats, settings]
  );

  // Tự tìm kết quả thực tế trên mạng theo ngày. Trả về kỳ quay tìm được (hoặc null).
  const searchResultOnline = useCallback(
    async (gameId, dateISO) => {
      const { found } = await fetchResultByDate(gameId, dateISO);
      // làm mới cache draws trong bộ nhớ
      const draws = await getDraws(gameId);
      setDrawsByGame((prev) => ({ ...prev, [gameId]: draws }));
      setLastUpdate(await getLastUpdate());
      return found;
    },
    []
  );

  const value = {
    ready,
    theme,
    settings,
    predictions,
    modelStats,
    drawsByGame,
    lastUpdate,
    updateSettings,
    updateParam,
    resetParams,
    resetLearning,
    refreshData,
    makePrediction,
    makeAllPredictions,
    savePrediction,
    savePredictions,
    deletePrediction,
    inputResult,
    searchResultOnline,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
