import React from 'react';
import { View, Text } from 'react-native';
import { useApp } from '../context/AppContext';

// Quả bóng số. hit=true -> tô màu trúng, special -> màu khác.
export function NumberBall({ value, size = 42, color, hit, special, dim }) {
  const { theme } = useApp();
  const bg = hit
    ? theme.success
    : special
    ? theme.warning
    : color || theme.ball;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: dim ? bg + '33' : bg,
        alignItems: 'center',
        justifyContent: 'center',
        margin: 4,
        borderWidth: hit ? 2 : 0,
        borderColor: theme.text,
      }}
    >
      <Text
        style={{
          color: dim ? theme.text : theme.ballText,
          fontWeight: '800',
          fontSize: size * 0.4,
        }}
      >
        {String(value)}
      </Text>
    </View>
  );
}

// Hiển thị 1 bộ số (giải standard hoặc digit3)
export function NumberRow({ numbers = [], special = [], hits = null, size = 42, digit3 = false }) {
  const hitSet = hits ? new Set(hits) : null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
      {numbers.map((n, i) =>
        digit3 ? (
          <Digit3Box key={i} value={n} hit={hitSet ? hitSet.has(String(n)) : false} />
        ) : (
          <NumberBall key={i} value={n} size={size} hit={hitSet ? hitSet.has(n) : false} />
        )
      )}
      {special && special.length > 0 && !digit3 && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ marginHorizontal: 4, color: '#94A3B8', fontWeight: '800' }}>•</Text>
          {special.map((n, i) => (
            <NumberBall key={'s' + i} value={n} size={size} special />
          ))}
        </View>
      )}
    </View>
  );
}

function Digit3Box({ value, hit }) {
  const { theme } = useApp();
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: hit ? theme.success : theme.warning,
        margin: 4,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 22, letterSpacing: 4 }}>
        {String(value)}
      </Text>
    </View>
  );
}
