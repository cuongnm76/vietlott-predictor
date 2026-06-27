import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { useApp } from '../context/AppContext';

function useWidth(initial = 320) {
  const [w, setW] = useState(initial);
  const onLayout = (e) => {
    const nw = e.nativeEvent.layout.width;
    if (nw && Math.abs(nw - w) > 1) setW(nw);
  };
  return [w, onLayout];
}

// Biểu đồ cột: data = [{label, value, color}]
export function BarChart({ data = [], height = 180, maxValue, valueFormatter }) {
  const { theme } = useApp();
  const [width, onLayout] = useWidth();
  const pad = { top: 16, bottom: 28, left: 8, right: 8 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const n = data.length || 1;
  const gap = 10;
  const barW = Math.max((innerW - gap * (n - 1)) / n, 4);

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((g, i) => (
          <Line
            key={i}
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + innerH * (1 - g)}
            y2={pad.top + innerH * (1 - g)}
            stroke={theme.chartGrid}
            strokeWidth={1}
          />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = pad.left + i * (barW + gap);
          const y = pad.top + innerH - h;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={Math.max(h, 1)} rx={4} fill={d.color || theme.primary} />
              <SvgText
                x={x + barW / 2}
                y={y - 4}
                fontSize="10"
                fontWeight="700"
                fill={theme.text}
                textAnchor="middle"
              >
                {valueFormatter ? valueFormatter(d.value) : d.value}
              </SvgText>
              <SvgText
                x={x + barW / 2}
                y={height - 8}
                fontSize="10"
                fill={theme.textMuted}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

// Biểu đồ đường: values = number[] (0..1), labels tùy chọn
export function LineChart({ values = [], height = 180, color, yMax = 1, labelEvery = 0 }) {
  const { theme } = useApp();
  const [width, onLayout] = useWidth();
  const pad = { top: 14, bottom: 22, left: 10, right: 10 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const stroke = color || theme.primary;

  if (values.length === 0) {
    return (
      <View onLayout={onLayout} style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.textMuted }}>Chưa có dữ liệu</Text>
      </View>
    );
  }

  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + innerH * (1 - Math.min(v / yMax, 1));
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((g, i) => (
          <Line
            key={i}
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + innerH * (1 - g)}
            y2={pad.top + innerH * (1 - g)}
            stroke={theme.chartGrid}
            strokeWidth={1}
          />
        ))}
        <Polyline points={points} fill="none" stroke={stroke} strokeWidth={2.5} />
        {values.map((v, i) => {
          const x = pad.left + i * stepX;
          const y = pad.top + innerH * (1 - Math.min(v / yMax, 1));
          return <Circle key={i} cx={x} cy={y} r={2.5} fill={stroke} />;
        })}
      </Svg>
    </View>
  );
}

// Bản đồ nhiệt tần suất số (lưới)
export function FrequencyHeatmap({ counts = {}, min = 1, max = 45, columns = 9 }) {
  const { theme } = useApp();
  const nums = [];
  for (let n = min; n <= max; n++) nums.push(n);
  const values = nums.map((n) => counts[n] || 0);
  const maxV = Math.max(...values, 1);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {nums.map((n) => {
        const v = counts[n] || 0;
        const intensity = v / maxV;
        return (
          <View
            key={n}
            style={{
              width: `${100 / columns}%`,
              aspectRatio: 1.4,
              padding: 2,
            }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: 8,
                backgroundColor:
                  theme.primary + Math.round(20 + intensity * 220).toString(16).padStart(2, '0'),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: intensity > 0.5 ? '#fff' : theme.text, fontWeight: '700', fontSize: 12 }}>
                {n}
              </Text>
              <Text style={{ color: intensity > 0.5 ? '#fff' : theme.textMuted, fontSize: 9 }}>{v}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
