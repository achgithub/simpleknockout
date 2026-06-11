import { useCallback } from 'react';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import { AD_UNIT_IDS } from '@/lib/config';
import { useEntitlements } from './useEntitlements';

/**
 * Returns showRewardedAd() — present a rewarded video the user must watch to
 * unlock an action (e.g. sharing the bracket image).
 *
 * Resolves to `true` when the action may proceed:
 *   • the user watched the video and earned the reward, OR
 *   • ads are disabled (no_ads entitlement / web / simulator), OR
 *   • the ad couldn't load or show (don't punish the user for ad-infra failures).
 *
 * Resolves to `false` only when the user actively closed the ad early without
 * earning the reward — i.e. they declined to unlock the action.
 */
export function useRewardedAd() {
  const { noAds } = useEntitlements();

  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    if (noAds || !Capacitor.isNativePlatform()) return true;

    const handles: PluginListenerHandle[] = [];
    try {
      await AdMob.prepareRewardVideoAd({ adId: AD_UNIT_IDS.rewarded });

      // The reward fires before the ad is dismissed; we resolve on dismissal so
      // the share sheet is only presented once the ad has fully gone away.
      let earned = false;
      const outcome = new Promise<'rewarded' | 'dismissed' | 'failed'>((resolve) => {
        void AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; }).then((h) => handles.push(h));
        void AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve(earned ? 'rewarded' : 'dismissed')).then((h) => handles.push(h));
        void AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => resolve('failed')).then((h) => handles.push(h));
      });

      await AdMob.showRewardVideoAd();
      const result = await outcome;
      return result !== 'dismissed';
    } catch {
      // Couldn't load/show the ad — allow the action rather than blocking it.
      return true;
    } finally {
      await Promise.all(handles.map((h) => h.remove()));
    }
  }, [noAds]);

  return { showRewardedAd };
}
