import React, { useState, useLayoutEffect } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { GAMES, MODEL_META } from '../constants';
import { Card, AppText, Button, Pill, SectionTitle, Divider } from '../components/ui';
import { NumberRow } from '../components/NumberBall';
import { pct } from '../utils';

function confidenceColor(c, theme) {
  if (c >= 0.55) return theme.success;
  if (c >= 0.35) return theme.warning;
  return theme.danger;
}

export default function PredictionScreen({ route, navigation }) {
  const { gameId } = route.params;
  const game = GAMES[gameId];
  const { theme, makeAllPredictions, savePredictions, drawsByGame, modelStats } = useApp();
  const [results, setResults] = useState(null);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: game.name });
  }, [navigation, game]);

  const drawCount = (drawsByGame[gameId] || []).length;

  const generate = async () => {
    setSaving(true);
    const list = makeAllPredictions(gameId);
    setResults(list);
    await savePredictions(list);
    setSaving(false);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Card style={{ borderLeftWidth: 5, borderLeftColor: game.color }}>
        <AppText weight="800" size={18}>
          {game.name}
        </AppText>
        <AppText muted size={12} style={{ marginTop: 2 }}>
          {game.desc} • {drawCount} kỳ dữ liệu
        </AppText>
        {drawCount === 0 ? (
          <View style={{ backgroundColor: theme.warning + '22', borderRadius: 10, padding: 10, marginTop: 10 }}>
            <AppText size={12} color={theme.warning}>
              Chưa có dữ liệu lịch sử. Hãy bấm "Cập nhật dữ liệu" ở Trang chủ để các mô hình dự đoán chính xác hơn.
            </AppText>
          </View>
        ) : null}
      </Card>

      <Button
        title={saving ? 'Đang tạo & lưu…' : '🎲 Tạo dự đoán mới (tất cả mô hình)'}
        onPress={generate}
        loading={saving}
      />

      {results ? (
        <>
          <View style={{ backgroundColor: theme.success + '18', borderRadius: 10, padding: 10, marginTop: 14 }}>
            <AppText size={12} color={theme.success}>
              ✓ Đã tự động lưu {results.length} bộ số (mỗi mô hình một bộ) vào Lịch sử.
            </AppText>
          </View>

          <SectionTitle right={null} >Bộ số theo từng mô hình</SectionTitle>

          {results.map((p) => {
            const tuned = modelStats[gameId]?.[p.model]?.params;
            return (
              <Card key={p.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Pill label={p.modelName} color={game.color} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <AppText muted size={11}>
                      Độ tin cậy
                    </AppText>
                    <AppText weight="800" size={16} color={confidenceColor(p.confidence, theme)}>
                      {pct(p.confidence)}
                    </AppText>
                  </View>
                </View>
                <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                  <NumberRow
                    numbers={p.numbers}
                    special={p.special}
                    digit3={game.type === 'digit3'}
                    size={40}
                  />
                </View>
                {game.special ? (
                  <AppText muted size={11} style={{ textAlign: 'center', marginTop: 4 }}>
                    🟧 {game.special.label}
                  </AppText>
                ) : null}
                {tuned && (p.model === 'frequency' || p.model === 'markov' || p.model === 'adaptive') ? (
                  <AppText muted size={10} style={{ textAlign: 'center', marginTop: 6 }}>
                    ⚙️ Tham số đã được AI tinh chỉnh
                  </AppText>
                ) : null}
              </Card>
            );
          })}

          <Divider />
        </>
      ) : (
        <AppText muted size={12} style={{ marginTop: 14, textAlign: 'center' }}>
          Bấm nút trên để sinh bộ số cho cả 4 mô hình. Mỗi lần tạo sẽ tự động lưu để đối chiếu với kết quả sau này.
        </AppText>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Button
          title="📜 Lịch sử"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('History')}
        />
        <Button
          title="✍️ Nhập kết quả"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('ResultInput', { gameId })}
        />
      </View>
    </ScrollView>
  );
}
