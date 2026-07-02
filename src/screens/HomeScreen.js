import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, RefreshControl } from 'react-native';
import { useApp } from '../context/AppContext';
import { GAME_LIST } from '../constants';
import { Card, AppText, Button, Pill, SectionTitle } from '../components/ui';
import { timeAgoVN } from '../utils';

export default function HomeScreen({ navigation }) {
  const { theme, drawsByGame, lastUpdate, refreshData } = useApp();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // {name, state}
  const [error, setError] = useState(null);

  const runUpdate = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const results = await refreshData((name, state, info) => setStatus({ name, state, info }));
      const failed = Object.values(results).filter((r) => !r.ok);
      if (failed.length === Object.keys(results).length) {
        setError('Cập nhật thất bại. Kiểm tra kết nối mạng rồi thử lại.');
      } else if (failed.length > 0) {
        setError(`Một số giải chưa cập nhật được (${failed.length}). Dữ liệu còn lại đã được lưu.`);
      }
    } catch (e) {
      setError('Lỗi: ' + (e?.message || 'không xác định'));
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={runUpdate} tintColor={theme.primary} />}
    >
      <AppText size={26} weight="800" style={{ marginBottom: 2 }}>
        Vietlott Predictor
      </AppText>
      <AppText muted size={13} style={{ marginBottom: 16 }}>
        Dự đoán xổ số bằng mô hình thống kê & AI tự học
      </AppText>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View>
            <AppText weight="700" size={15}>
              Dữ liệu lịch sử
            </AppText>
            <AppText muted size={12}>
              Cập nhật: {timeAgoVN(lastUpdate)}
            </AppText>
          </View>
          <Text style={{ fontSize: 30 }}>📊</Text>
        </View>
        <Button
          title={loading ? 'Đang cập nhật…' : 'Cập nhật dữ liệu'}
          icon="🔄"
          onPress={runUpdate}
          loading={loading}
        />
        {status ? (
          <AppText muted size={12} style={{ marginTop: 8 }}>
            {status.state === 'error' ? '⚠️ ' : '⏳ '} {status.name}
            {status.state === 'done' ? ` ✓ (+${status.info} kỳ mới)` : '…'}
          </AppText>
        ) : null}
        {error ? (
          <View style={{ backgroundColor: theme.danger + '22', borderRadius: 10, padding: 10, marginTop: 10 }}>
            <AppText size={12} color={theme.danger}>
              {error}
            </AppText>
          </View>
        ) : null}
      </Card>

      <SectionTitle>Chọn loại giải</SectionTitle>

      {GAME_LIST.map((g) => {
        const count = (drawsByGame[g.id] || []).length;
        return (
          <TouchableOpacity
            key={g.id}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Prediction', { gameId: g.id })}
          >
            <Card style={{ borderLeftWidth: 5, borderLeftColor: g.color }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="800" size={17}>
                    {g.name}
                  </AppText>
                  <AppText muted size={12} style={{ marginTop: 2 }}>
                    {g.desc}
                  </AppText>
                  <View style={{ marginTop: 8 }}>
                    <Pill
                      label={count > 0 ? `${count} kỳ dữ liệu` : 'Chưa có dữ liệu'}
                      color={count > 0 ? g.color : theme.textMuted}
                    />
                  </View>
                </View>
                <Text style={{ fontSize: 22, color: theme.textMuted }}>›</Text>
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
