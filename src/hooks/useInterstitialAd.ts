import { useCallback } from 'react';
import { AdMob } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { AD_UNIT_IDS } from '@/lib/config';
import { useEntitlements } from './useEntitlements';

/**
 * Returns showAd() — call it at natural break points.
 * No-ops on web/simulator or when the user has no_ads entitlement.
 */
export function useInterstitialAd() {
  const { noAds } = useEntitlements();

  const showAd = useCallback(async () => {
    if (noAds || !Capacitor.isNativePlatform()) return;
    try {
      await AdMob.prepareInterstitial({ adId: AD_UNIT_IDS.interstitial });
      await AdMob.showInterstitial();
    } catch { /* ad unavailable — continue silently */ }
  }, [noAds]);

  return { showAd };
}
