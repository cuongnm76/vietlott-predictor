import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';

export function Card({ children, style }) {
  const { theme } = useApp();
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          marginBottom: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AppText({ children, style, muted, size = 15, weight = '400', color }) {
  const { theme } = useApp();
  return (
    <Text
      style={[
        { color: color || (muted ? theme.textMuted : theme.text), fontSize: size, fontWeight: weight },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }) {
  const { theme } = useApp();
  const bg =
    variant === 'primary'
      ? theme.primary
      : variant === 'danger'
      ? theme.danger
      : variant === 'success'
      ? theme.success
      : 'transparent';
  const isGhost = variant === 'ghost' || variant === 'outline';
  const txtColor = isGhost ? theme.primary : theme.primaryText;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={disabled || loading ? undefined : onPress}
      style={[
        {
          backgroundColor: isGhost ? 'transparent' : bg,
          borderColor: isGhost ? theme.border : bg,
          borderWidth: isGhost ? 1.5 : 0,
          opacity: disabled ? 0.5 : 1,
          paddingVertical: 13,
          paddingHorizontal: 16,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={txtColor} />
      ) : (
        <>
          {icon ? <Text style={{ fontSize: 16 }}>{icon}</Text> : null}
          <Text style={{ color: txtColor, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function Pill({ label, color, textColor }) {
  const { theme } = useApp();
  return (
    <View
      style={{
        backgroundColor: (color || theme.primary) + '22',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: textColor || color || theme.primary, fontWeight: '700', fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({ children, right }) {
  const { theme } = useApp();
  return (
    <View style={styles.sectionRow}>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{children}</Text>
      {right}
    </View>
  );
}

export function Divider() {
  const { theme } = useApp();
  return <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />;
}

export function EmptyState({ icon = '📭', title, subtitle }) {
  const { theme } = useApp();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Text style={{ fontSize: 44, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 30 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});
