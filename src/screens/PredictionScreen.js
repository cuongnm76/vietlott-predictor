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
  const { theme, settings, makeAllPredictions, savePredictions, drawsByGame, modelStats } = useApp();
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: game.name });
  }, [navigation, game]);

  const drawCount = (drawsByGame[gameId] || []).length;

  const generate = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 30));
    // Vẫn mô phỏng tất cả mô hình + lưu ngầm để AI học, nhưng chỉ hiển thị bộ tốt nhất
    const list = makeAllPredictions(gameId);
    const sorted = [...list].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
    setResult(sorted[0]);
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
        title={saving ? 'Đang tạo…' : '🎲 Tạo dự đoán mới'}
        onPress={generate}
        loading={saving}
      />

      {result ? (
        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Pill label={result.modelName} color={game.color} />
            <View style={{ alignItems: 'flex-end' }}>
              <AppText muted size={11}>
                Độ tin cậy
              </AppText>
              <AppText weight="800" size={18} color={confidenceColor(result.confidence, theme)}>
                {pct(result.confidence)}
              </AppText>
            </View>
          </View>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <NumberRow
              numbers={result.numbers}
              special={result.special}
              digit3={game.type === 'digit3'}
              size={44}
            />
          </View>
          {game.special ? (
            <AppText muted size={11} style={{ textAlign: 'center', marginTop: 4 }}>
              🟧 {game.special.label}
            </AppText>
          ) : null}
          <AppText muted size={11} style={{ textAlign: 'center', marginTop: 12 }}>
            ✓ Đã tự động lưu vào Lịch sử
          </AppText>
        </Card>
      ) : (
        <AppText muted size={12} style={{ marginTop: 14, textAlign: 'center' }}>
          Bấm nút trên để tạo dự đoán. Kết quả tốt nhất sẽ hiển thị và tự động lưu vào Lịch sử.
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
