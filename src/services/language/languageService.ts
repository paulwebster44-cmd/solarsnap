/**
 * languageService.ts
 *
 * Persists the user's language preference using expo-secure-store so their
 * choice survives app restarts. On first launch (no saved preference) the
 * app uses the device OS language via i18next's lng default.
 */

import * as SecureStore from 'expo-secure-store';
import i18next from '../../i18n';

const LANG_KEY = 'solarsnap_language';

/**
 * Reads the saved language preference and applies it.
 * Call once on app startup — after i18next is initialised but before the
 * first render. No-ops silently if nothing has been saved yet.
 */
export async function loadSavedLanguage(): Promise<void> {
  const saved = await SecureStore.getItemAsync(LANG_KEY);
  if (saved && saved !== i18next.language) {
    await i18next.changeLanguage(saved);
  }
}

/**
 * Saves the chosen language code and switches the app language immediately.
 */
export async function saveLanguage(code: string): Promise<void> {
  await SecureStore.setItemAsync(LANG_KEY, code);
  await i18next.changeLanguage(code);
}

/**
 * Clears the saved preference — the app will revert to the device language
 * on next startup.
 */
export async function clearSavedLanguage(): Promise<void> {
  await SecureStore.deleteItemAsync(LANG_KEY);
}
