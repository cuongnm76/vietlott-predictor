import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { GAMES, GAME_LIST } from '../constants';
import { Card, AppText, Pill, EmptyState } from '../components/ui';
import { NumberRow } from '../components/NumberBall';
import { formatDateTimeVN, formatDateVN, pct } from '../utils';

export default function HistoryScreen() {
  const { theme, predictions, deletePrediction } = useApp();
  const [filter, setFilter] = useState('all');

  const list = predictions.filter((p) => filter === 'all' || p.gameId === filter);

  const confirmDelete = (id) => {
    Alert.alert('Xóa dự đoán', 'Bạn có chắc muốn xóa dự đoán này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => deletePrediction(id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: theme.border }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8, alignItems: 'center' }}
      >
        {[{ id: 'all', name: 'Tất cả', color: theme.primary }, ...GAME_LIST].map((g) => {
          const active = filter === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => setFilter(g.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active ? (g.color || theme.primary) : theme.card,
                borderWidth: 1,
                borderColor: active ? (g.color || theme.primary) : theme.border,
              }}
            >
              <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '700', fontSize: 13 }}>
                {g.short || g.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {list.length === 0 ? (
          <EmptyState
            icon="📜"
            title="Chưa có dự đoán nào"
            subtitle="Vào một loại giải ở Trang chủ, tạo dự đoán và bấm Lưu để xem tại đây."
          />
        ) : (
          list.map((p) => {
            const game = GAMES[p.gameId];
            return (
              <Card key={p.id} style={{ borderLeftWidth: 4, borderLeftColor: game.color }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Pill label={game.short} color={game.color} />
                    <Pill label={p.modelName} color={theme.textMuted} />
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(p.id)}>
                    <Text style={{ fontSize: 18 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <NumberRow
                  numbers={p.numbers}
                  special={p.special}
                  digit3={p.gameType === 'digit3'}
                  size={36}
                  hits={p.result ? (p.gameType === 'digit3' ? p.result.special : p.result.numbers) : null}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <AppText muted size={11}>
                    {formatDateTimeVN(p.createdAt)} • tin cậy {pct(p.confidence)}
                  </AppText>
                  {p.result ? (
                    <AppText
                      weight="800"
                      size={13}
                      color={p.result.hits > 0 ? theme.success : theme.textMuted}
                    >
                      ✓ Trúng {p.result.hits}/{p.result.possible}
                    </AppText>
                  ) : (
                    <AppText muted size={11}>
                      chưa có kết quả
                    </AppText>
                  )}
                </View>
                {p.result ? (
                  <AppText muted size={11} style={{ marginTop: 4 }}>
                    KQ ngày {formatDateVN(p.result.date)}
                  </AppText>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
