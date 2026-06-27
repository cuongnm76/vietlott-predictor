import React, { useState, useLayoutEffect } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Text, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../context/AppContext';
import { GAMES } from '../constants';
import { Card, AppText, Button, SectionTitle, Divider, Pill } from '../components/ui';
import { NumberRow } from '../components/NumberBall';
import { formatDateVN, toISODate } from '../utils';

function Stepper({ value, onChange, min, max, theme }) {
  const set = (v) => {
    let n = parseInt(v, 10);
    if (isNaN(n)) n = min;
    n = Math.max(min, Math.min(max, n));
    onChange(n);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', margin: 4 }}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - 1))}
        style={{ width: 30, height: 38, borderRadius: 8, backgroundColor: theme.cardAlt, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>−</Text>
      </TouchableOpacity>
      <TextInput
        value={String(value)}
        onChangeText={set}
        keyboardType="number-pad"
        style={{
          width: 44,
          height: 38,
          textAlign: 'center',
          color: theme.text,
          fontWeight: '800',
          fontSize: 16,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          marginHorizontal: 2,
          borderRadius: 8,
        }}
      />
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + 1))}
        style={{ width: 30, height: 38, borderRadius: 8, backgroundColor: theme.cardAlt, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ResultInputScreen({ route, navigation }) {
  const { gameId } = route.params;
  const game = GAMES[gameId];
  const { theme, inputResult, predictions, searchResultOnline } = useApp();

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [searching, setSearching] = useState(false);
  const [main, setMain] = useState(
    game.type === 'standard' ? Array.from({ length: game.mainCount }, (_, i) => i + game.mainMin) : []
  );
  const [special, setSpecial] = useState(game.special ? [game.special.min] : []);
  const [d3, setD3] = useState(game.type === 'digit3' ? Array.from({ length: game.sets }, () => '') : []);
  const [comparison, setComparison] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Nhập kết quả • ' + game.name });
  }, [navigation, game]);

  const onDateChange = (event, selected) => {
    setShowPicker(Platform.OS === 'ios');
    if (selected) setDate(selected);
  };

  const buildActual = () => {
    const iso = toISODate(date);
    if (game.type === 'digit3') {
      const pair = d3.map((s) => s.padStart(3, '0'));
      if (pair.some((s) => s.length !== 3 || !/^\d{3}$/.test(s))) {
        Alert.alert('Thiếu dữ liệu', 'Nhập đủ 2 số, mỗi số gồm 3 chữ số (0-9).');
        return null;
      }
      const digits = pair.join('').split('').map((c) => parseInt(c, 10));
      return { date: iso, id: 'manual', special: pair, digits };
    }
    // standard
    const uniq = new Set(main);
    if (uniq.size !== main.length) {
      Alert.alert('Số trùng', 'Các số chính không được trùng nhau.');
      return null;
    }
    return { date: iso, id: 'manual', main: [...main].sort((a, b) => a - b), special };
  };

  const onSave = async () => {
    const actual = buildActual();
    if (!actual) return;
    const { evaluatedCount } = await inputResult(gameId, actual);
    // hiển thị so sánh
    const related = predictions.filter((p) => p.gameId === gameId);
    setComparison({ actual, evaluatedCount, related });
    Alert.alert(
      'Đã lưu kết quả',
      evaluatedCount > 0
        ? `Đã so sánh & cập nhật ${evaluatedCount} dự đoán. AI đã tinh chỉnh tham số mô hình.`
        : 'Đã lưu. Chưa có dự đoán nào của giải này để so sánh.'
    );
  };

  // Tự tìm kết quả trên mạng theo ngày đã chọn
  const onSearchOnline = async () => {
    setSearching(true);
    try {
      const iso = toISODate(date);
      const found = await searchResultOnline(gameId, iso);
      if (!found) {
        Alert.alert(
          'Không tìm thấy kết quả',
          `Không có kết quả quay cho ngày ${formatDateVN(date)}. Có thể hôm đó không quay thưởng hoặc dữ liệu chưa cập nhật. Hãy chọn đúng ngày quay, hoặc nhập thủ công bên dưới.`
        );
        return;
      }
      // điền vào ô nhập để bạn xem
      if (game.type === 'digit3') setD3((found.special || []).map((s) => String(s)));
      else {
        setMain(found.main);
        setSpecial(found.special || []);
      }
      // lưu + so sánh + AI tinh chỉnh ngay
      const { evaluatedCount } = await inputResult(gameId, found);
      const related = predictions.filter((p) => p.gameId === gameId);
      setComparison({ actual: found, evaluatedCount, related });
      Alert.alert(
        'Đã tìm thấy & lưu',
        `Kết quả ngày ${formatDateVN(found.date)} đã được tải về và lưu. ` +
          (evaluatedCount > 0
            ? `Đã so sánh ${evaluatedCount} dự đoán; AI đã tinh chỉnh tham số mô hình.`
            : 'Chưa có dự đoán nào để so sánh.')
      );
    } catch (e) {
      Alert.alert(
        'Lỗi mạng',
        'Không tải được dữ liệu từ Internet. Kiểm tra kết nối rồi thử lại, hoặc nhập thủ công.'
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionTitle>Ngày quay thưởng</SectionTitle>
      <TouchableOpacity onPress={() => setShowPicker(true)}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText weight="700" size={16}>
              📅 {formatDateVN(date)}
            </AppText>
            <AppText muted>Chạm để chọn</AppText>
          </View>
        </Card>
      </TouchableOpacity>
      {showPicker ? (
        <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} maximumDate={new Date()} />
      ) : null}

      <Button
        title={searching ? 'Đang tìm trên mạng…' : '🔎 Tự tìm kết quả trên mạng'}
        onPress={onSearchOnline}
        loading={searching}
        style={{ marginTop: 4 }}
      />
      <AppText muted size={11} style={{ textAlign: 'center', marginTop: 8 }}>
        Tự tải kết quả quay ngày {formatDateVN(date)} từ Internet, lưu và so sánh ngay.
        Hoặc nhập thủ công bên dưới.
      </AppText>

      <SectionTitle>Nhập kết quả thực tế</SectionTitle>
      <Card>
        {game.type === 'digit3' ? (
          <View>
            <AppText muted size={12} style={{ marginBottom: 8 }}>
              Nhập 2 số giải Đặc biệt (mỗi số 3 chữ số)
            </AppText>
            {d3.map((v, i) => (
              <TextInput
                key={i}
                value={v}
                onChangeText={(t) => {
                  const nv = [...d3];
                  nv[i] = t.replace(/[^0-9]/g, '').slice(0, 3);
                  setD3(nv);
                }}
                keyboardType="number-pad"
                placeholder={`Số ${i + 1} (vd: 123)`}
                placeholderTextColor={theme.textMuted}
                maxLength={3}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  color: theme.text,
                  fontSize: 22,
                  fontWeight: '800',
                  letterSpacing: 6,
                  textAlign: 'center',
                  paddingVertical: 12,
                  marginBottom: 10,
                  backgroundColor: theme.card,
                }}
              />
            ))}
          </View>
        ) : (
          <View>
            <AppText muted size={12} style={{ marginBottom: 8 }}>
              {game.mainCount} số chính ({game.mainMin}–{game.mainMax})
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {main.map((v, i) => (
                <Stepper
                  key={i}
                  value={v}
                  min={game.mainMin}
                  max={game.mainMax}
                  theme={theme}
                  onChange={(nv) => {
                    const arr = [...main];
                    arr[i] = nv;
                    setMain(arr);
                  }}
                />
              ))}
            </View>
            {game.special ? (
              <View style={{ marginTop: 12 }}>
                <AppText muted size={12} style={{ marginBottom: 8 }}>
                  {game.special.label} ({game.special.min}–{game.special.max})
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {special.map((v, i) => (
                    <Stepper
                      key={i}
                      value={v}
                      min={game.special.min}
                      max={game.special.max}
                      theme={theme}
                      onChange={(nv) => {
                        const arr = [...special];
                        arr[i] = nv;
                        setSpecial(arr);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )}
      </Card>

      <Button title="💾 Lưu thủ công & so sánh" variant="success" onPress={onSave} />

      {comparison ? (
        <Card style={{ marginTop: 16 }}>
          <SectionTitle>Kết quả ngày {formatDateVN(comparison.actual.date)}</SectionTitle>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <NumberRow
              numbers={comparison.actual.main || comparison.actual.special}
              special={comparison.actual.main ? comparison.actual.special : []}
              digit3={game.type === 'digit3'}
            />
          </View>
          <Divider />
          <AppText weight="700" style={{ marginBottom: 8 }}>
            So sánh dự đoán ({comparison.related.length})
          </AppText>
          {comparison.related.length === 0 ? (
            <AppText muted size={13}>
              Chưa có dự đoán nào cho giải này.
            </AppText>
          ) : (
            comparison.related.slice(0, 10).map((p) => (
              <View key={p.id} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Pill label={p.modelName} color={game.color} />
                  {p.result ? (
                    <AppText weight="800" color={p.result.hits > 0 ? theme.success : theme.textMuted}>
                      Trúng {p.result.hits}/{p.result.possible}
                    </AppText>
                  ) : (
                    <AppText muted size={12}>
                      chưa đánh giá
                    </AppText>
                  )}
                </View>
                <View style={{ marginTop: 6 }}>
                  <NumberRow
                    numbers={p.numbers}
                    special={p.special}
                    digit3={game.type === 'digit3'}
                    size={34}
                    hits={
                      game.type === 'digit3'
                        ? comparison.actual.special
                        : comparison.actual.main
                    }
                  />
                </View>
              </View>
            ))
          )}
        </Card>
      ) : null}
    </ScrollView>
  );
}
