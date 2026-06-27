import React, { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { GAMES, GAME_LIST, MODEL_META, MODEL_IDS } from '../constants';
import { Card, AppText, Pill, SectionTitle, EmptyState } from '../components/ui';
import { BarChart, LineChart, FrequencyHeatmap } from '../components/Charts';
import { summarizeStats, recommendModel } from '../models/learning';
import { frequencyTable } from '../models/scoring';
import { pct } from '../utils';

const MODEL_COLORS = {
  random: '#94A3B8',
  frequency: '#2563EB',
  markov: '#D97706',
  adaptive: '#16A34A',
};

export default function StatisticsScreen() {
  const { theme, modelStats, drawsByGame } = useApp();
  const [gameId, setGameId] = useState('power655');
  const game = GAMES[gameId];

  const summary = useMemo(() => summarizeStats(modelStats, gameId), [modelStats, gameId]);
  const rec = useMemo(() => recommendModel(modelStats, gameId), [modelStats, gameId]);
  const draws = drawsByGame[gameId] || [];

  const perfData = MODEL_IDS.map((m) => ({
    label: MODEL_META[m].name.split(' ')[0],
    value: Math.round(summary[m].hitRate * 100),
    color: MODEL_COLORS[m],
  }));

  const adaptiveHistory = (modelStats[gameId]?.adaptive?.history || []).map((h) => h.rate);

  const freqCounts = useMemo(() => {
    if (game.type === 'digit3') {
      const c = {};
      for (let d = 0; d <= 9; d++) c[d] = 0;
      draws.forEach((dr) => (dr.digits || []).forEach((d) => (c[d] = (c[d] || 0) + 1)));
      return c;
    }
    return frequencyTable(draws.map((d) => d.main || []), game.mainMin, game.mainMax);
  }, [draws, game]);

  const totalEval = MODEL_IDS.reduce((s, m) => s + summary[m].count, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: theme.border }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8, alignItems: 'center' }}
      >
        {GAME_LIST.map((g) => {
          const active = gameId === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => setGameId(g.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active ? g.color : theme.card,
                borderWidth: 1,
                borderColor: active ? g.color : theme.border,
              }}
            >
              <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '700', fontSize: 13 }}>
                {g.short}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Thống kê chung */}
        <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Stat label="Kỳ dữ liệu" value={draws.length} theme={theme} />
          <Stat label="Lượt đánh giá" value={totalEval} theme={theme} />
          <Stat label="Mô hình tốt nhất" value={MODEL_META[rec.model].name.split(' ')[0]} theme={theme} small />
        </Card>

        <SectionTitle>Hiệu suất mô hình (% trúng)</SectionTitle>
        <Card>
          {totalEval === 0 ? (
            <EmptyState icon="📈" title="Chưa có dữ liệu đánh giá" subtitle="Lưu dự đoán rồi nhập kết quả thực tế để xem hiệu suất." />
          ) : (
            <BarChart data={perfData} valueFormatter={(v) => v + '%'} maxValue={100} />
          )}
        </Card>

        <SectionTitle>Xu hướng độ chính xác (AI)</SectionTitle>
        <Card>
          <AppText muted size={12} style={{ marginBottom: 8 }}>
            Tỉ lệ trúng từng lần của mô hình Thích ứng theo thời gian
          </AppText>
          <LineChart values={adaptiveHistory} color={MODEL_COLORS.adaptive} yMax={1} />
        </Card>

        <SectionTitle>Tần suất xuất hiện số</SectionTitle>
        <Card>
          <FrequencyHeatmap
            counts={freqCounts}
            min={game.type === 'digit3' ? 0 : game.mainMin}
            max={game.type === 'digit3' ? 9 : game.mainMax}
            columns={game.type === 'digit3' ? 5 : 9}
          />
        </Card>

        <SectionTitle>So sánh & khuyến nghị</SectionTitle>
        <Card>
          {MODEL_IDS.map((m) => (
            <View
              key={m}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: MODEL_COLORS[m] }} />
                <AppText weight="700">{MODEL_META[m].name}</AppText>
                {rec.model === m && totalEval > 0 ? <Pill label="⭐ Khuyến nghị" color={theme.success} /> : null}
              </View>
              <AppText weight="800" color={MODEL_COLORS[m]}>
                {pct(summary[m].hitRate)}
              </AppText>
            </View>
          ))}
          {totalEval > 0 ? (
            <View style={{ backgroundColor: theme.success + '22', borderRadius: 10, padding: 12, marginTop: 8 }}>
              <AppText size={13} color={theme.success}>
                💡 Nên dùng mô hình <Text style={{ fontWeight: '800' }}>{MODEL_META[rec.model].name}</Text> cho {game.name} (tỉ lệ trúng {pct(rec.hitRate)}).
              </AppText>
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, theme, small }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: theme.text, fontSize: small ? 15 : 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}
