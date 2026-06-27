import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useApp } from '../context/AppContext';

import HomeScreen from '../screens/HomeScreen';
import PredictionScreen from '../screens/PredictionScreen';
import ResultInputScreen from '../screens/ResultInputScreen';
import HistoryScreen from '../screens/HistoryScreen';
import StatisticsScreen from '../screens/StatisticsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
  const { theme } = useApp();
  const screenOptions = {
    headerStyle: { backgroundColor: theme.card },
    headerTitleStyle: { color: theme.text, fontWeight: '800' },
    headerTintColor: theme.primary,
    contentStyle: { backgroundColor: theme.bg },
  };
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Prediction" component={PredictionScreen} options={{ title: 'Dự đoán' }} />
      <Stack.Screen name="ResultInput" component={ResultInputScreen} options={{ title: 'Nhập kết quả' }} />
    </Stack.Navigator>
  );
}

const ICONS = {
  HomeTab: '🏠',
  History: '📜',
  Statistics: '📊',
  Settings: '⚙️',
};

function tabIcon(name) {
  return ({ focused }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{ICONS[name]}</Text>
  );
}

export default function RootNavigator() {
  const { theme } = useApp();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: tabIcon(route.name),
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        headerStyle: { backgroundColor: theme.card },
        headerTitleStyle: { color: theme.text, fontWeight: '800' },
        headerTintColor: theme.text,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Trang chủ', headerShown: false }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Lịch sử' }} />
      <Tab.Screen name="Statistics" component={StatisticsScreen} options={{ title: 'Thống kê' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Cài đặt' }} />
    </Tab.Navigator>
  );
}
