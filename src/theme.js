// Bảng màu sáng/tối

export const lightTheme = {
  mode: 'light',
  bg: '#F4F6FB',
  card: '#FFFFFF',
  cardAlt: '#EEF2F8',
  text: '#0B1220',
  textMuted: '#5B6473',
  border: '#E2E8F0',
  primary: '#2563EB',
  primaryText: '#FFFFFF',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#E11D48',
  ball: '#2563EB',
  ballText: '#FFFFFF',
  chartGrid: '#E2E8F0',
  shadow: '#000000',
};

export const darkTheme = {
  mode: 'dark',
  bg: '#0B1220',
  card: '#151D2E',
  cardAlt: '#1E2940',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#26334D',
  primary: '#3B82F6',
  primaryText: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#FB7185',
  ball: '#3B82F6',
  ballText: '#FFFFFF',
  chartGrid: '#26334D',
  shadow: '#000000',
};

export function getTheme(mode, systemScheme) {
  const resolved = mode === 'system' ? systemScheme || 'light' : mode;
  return resolved === 'dark' ? darkTheme : lightTheme;
}
