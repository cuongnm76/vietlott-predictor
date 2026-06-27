import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';
import { MODEL_IDS, MODEL_META, PARAM_RANGES, SIM_RANGE } from '../constants';
import { Card, AppText, Button, SectionTitle, Divider } from '../components/ui';

const THEME_OPTIONS = [
  { id: 'system', label: 'Tự động', icon: '🌓' },
  { id: 'light', label: 'Sáng', icon: '☀️' },
  { id: 'dark', label: 'Tối', icon: '🌙' },
];

export default function SettingsScreen() {
  const { theme, settings, updateSettings, updateParam, resetParams, resetLearning } = useApp();
  const [paramModel, setParamModel] = useState('adaptive');
  const ranges = PARAM_RANGES[paramModel] || {};

  const onReset = () => {
    Alert.alert('Khôi phục mặc định', 'Đặt lại toàn bộ tham số về giá trị mặc định?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đặt lại', onPress: resetParams },
    ]);
  };

  const onResetLearning = () => {
    Alert.alert(
      'Xóa dữ liệu học AI',
      'Xóa toàn bộ thống kê và tham số mà AI đã tự tinh chỉnh? Các mô hình sẽ học lại từ đầu (dự đoán đã lưu vẫn giữ nguyên).',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: resetLearning },
      ]
    );
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionTitle>Giao diện</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {THEME_OPTIONS.map((opt) => {
            const active = settings.themeMode === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => updateSettings({ themeMode: opt.id })}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: active ? theme.primary : theme.cardAlt,
                }}
              >
                <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
                <Text style={{ color: active ? theme.primaryText : theme.text, fontWeight: '700', marginTop: 4 }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <SectionTitle>Mô hình mặc định</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MODEL_IDS.map((m) => {
            const active = settings.defaultModel === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => updateSettings({ defaultModel: m })}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: active ? theme.primary : theme.cardAlt,
                }}
              >
                <Text style={{ color: active ? theme.primaryText : theme.text, fontWeight: '700', fontSize: 13 }}>
                  {MODEL_META[m].name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <SectionTitle>Mô phỏng dự đoán</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
          <AppText weight="700" size={14}>
            Số lần mô phỏng (n)
          </AppText>
          <AppText weight="800" color={theme.primary}>
            {settings.simulations || SIM_RANGE.default}
          </AppText>
        </View>
        <Slider
          minimumValue={SIM_RANGE.min}
          maximumValue={SIM_RANGE.max}
          step={SIM_RANGE.step}
          value={settings.simulations || SIM_RANGE.default}
          onSlidingComplete={(v) => updateSettings({ simulations: Math.round(v) })}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.primary}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText muted size={11}>
            {SIM_RANGE.min}
          </AppText>
          <AppText muted size={11}>
            {SIM_RANGE.max} (tối đa)
          </AppText>
        </View>
        <AppText muted size={12} style={{ marginTop: 8 }}>
          Mỗi lần "Tạo dự đoán", từng mô hình sẽ mô phỏng n bộ số rồi chọn bộ có kỳ vọng trúng cao nhất. n càng lớn càng ổn định nhưng chậm hơn một chút; thường n = 100–300 là đủ (kết quả gần như hội tụ trước khi đạt 1000).
        </AppText>
      </Card>

      <SectionTitle right={<Button title="Đặt lại" variant="outline" onPress={onReset} style={{ paddingVertical: 6, paddingHorizontal: 12 }} />}>
        Tham số mô hình
      </SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          {MODEL_IDS.map((m) => {
            const active = paramModel === m;
            const hasParams = Object.keys(PARAM_RANGES[m] || {}).length > 0;
            return (
              <TouchableOpacity
                key={m}
                disabled={!hasParams}
                onPress={() => setParamModel(m)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  opacity: hasParams ? 1 : 0.4,
                  backgroundColor: active ? theme.primary : theme.cardAlt,
                }}
              >
                <Text style={{ color: active ? theme.primaryText : theme.text, fontWeight: '700', fontSize: 12 }}>
                  {MODEL_META[m].name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Divider />
        {Object.keys(ranges).length === 0 ? (
          <AppText muted size={13}>
            Mô hình này không có tham số điều chỉnh.
          </AppText>
        ) : (
          Object.entries(ranges).map(([key, r]) => {
            const value = settings.params[paramModel]?.[key] ?? r.min;
            return (
              <View key={key} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <AppText weight="700" size={14}>
                    {r.label}
                  </AppText>
                  <AppText weight="800" color={theme.primary}>
                    {Number.isInteger(r.step) ? value : Number(value).toFixed(2)}
                  </AppText>
                </View>
                <Slider
                  minimumValue={r.min}
                  maximumValue={r.max}
                  step={r.step}
                  value={value}
                  onSlidingComplete={(v) => updateParam(paramModel, key, Math.round(v / r.step) * r.step)}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.primary}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText muted size={11}>
                    {r.min}
                  </AppText>
                  <AppText muted size={11}>
                    {r.max}
                  </AppText>
                </View>
              </View>
            );
          })
        )}
        <View style={{ backgroundColor: theme.success + '18', borderRadius: 10, padding: 10, marginTop: 4 }}>
          <AppText size={12} color={theme.success}>
            🤖 AI tự học: sau mỗi lần lưu kết quả, AI vừa điều chỉnh trọng số mô hình Thích ứng, vừa tự tinh chỉnh tham số của các mô hình (Tần suất, Markov, Thích ứng) để đạt độ chính xác cao nhất. Khi đó tham số do AI học sẽ được ưu tiên hơn giá trị bạn đặt ở đây.
          </AppText>
        </View>
        <Button
          title="🧹 Xóa dữ liệu học của AI"
          variant="outline"
          onPress={onResetLearning}
          style={{ marginTop: 10 }}
        />
      </Card>

      <SectionTitle>Thông tin ứng dụng</SectionTitle>
      <Card>
        <Row label="Tên" value="Vietlott Predictor" theme={theme} />
        <Row label="Phiên bản" value="1.0.0" theme={theme} />
        <Row label="Nguồn dữ liệu" value="github.com/vietvudanh/vietlott-data" theme={theme} />
        <Row label="Lưu trữ" value="Cục bộ (offline)" theme={theme} />
        <Divider />
        <AppText muted size={11}>
          Ứng dụng chỉ mang tính tham khảo/giải trí dựa trên thống kê. Kết quả xổ số là ngẫu nhiên; không có mô hình nào đảm bảo trúng thưởng. Hãy chơi có trách nhiệm.
        </AppText>
      </Card>
    </ScrollView>
  );
}

function Row({ label, value, theme }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: theme.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>
        {value}
      </Text>
    </View>
  );
}
