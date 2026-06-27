// Lớp bọc AsyncStorage cho lưu trữ cục bộ (offline)
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getJSON(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('storage.getJSON lỗi', key, e?.message);
    return fallback;
  }
}

export async function setJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('storage.setJSON lỗi', key, e?.message);
    return false;
  }
}

export async function removeKey(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn('storage.removeKey lỗi', key, e?.message);
  }
}

export async function getString(key, fallback = null) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export async function setString(key, value) {
  try {
    await AsyncStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
