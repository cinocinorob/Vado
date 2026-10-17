/** Se la presentazione iniziale è già stata vista. */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vado.benvenuto.v1';

export async function welcomeSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, '1');
}
