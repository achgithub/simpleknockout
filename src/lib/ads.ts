import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

export async function initAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.initialize();
  } catch { /* ignore on devices where AdMob isn't available */ }
}
