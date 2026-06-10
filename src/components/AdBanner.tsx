import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdPluginEvents, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';
import { AD_UNIT_IDS } from '@/lib/config';
import { useEntitlements } from '@/hooks/useEntitlements';

const FALLBACK_HEIGHT = 50;

// Renders Google's test banner until AD_UNIT_IDS.banner is replaced with a real unit.
// Hidden entirely for users with the no_ads entitlement.
export function AdBanner() {
  const { t } = useTranslation();
  const { noAds } = useEntitlements();
  const native = Capacitor.isNativePlatform();
  const [height, setHeight] = useState(FALLBACK_HEIGHT);

  // Other layouts (e.g. Bracket's full-height swipe view) need to know how
  // much space the banner reserves, so mirror it onto a CSS variable.
  useEffect(() => {
    document.documentElement.style.setProperty('--ad-banner-height', `${height}px`);
  }, [height]);

  useEffect(() => {
    if (noAds || !native) {
      setHeight(0);
      return;
    }

    const sizeListener = AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
      setHeight(info.height > 0 ? info.height : FALLBACK_HEIGHT);
    });
    const failListener = AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
      setHeight(0);
    });

    AdMob.showBanner({
      adId: AD_UNIT_IDS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
    }).catch(() => { /* ad unavailable — continue silently */ });

    return () => {
      void sizeListener.then((l) => l.remove());
      void failListener.then((l) => l.remove());
      void AdMob.removeBanner().catch(() => {});
    };
  }, [noAds, native]);

  if (noAds) return null;

  // Native banner is a system overlay anchored to the bottom safe area, so we
  // just reserve space for it here to keep content from sitting underneath.
  if (native) {
    return <div className="w-full shrink-0" style={{ height }} />;
  }

  return (
    <div className="w-full bg-gray-100 border-t border-gray-200 flex items-center justify-center shrink-0" style={{ height: FALLBACK_HEIGHT }}>
      <span className="text-xs text-gray-400 tracking-wide">{t('adBanner.advertisement')}</span>
    </div>
  );
}
