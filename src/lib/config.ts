// ── RevenueCat ────────────────────────────────────────────────────────────────
// Replace with your iOS public API key from app.revenuecat.com
export const REVENUECAT_API_KEY_IOS = 'appl_REPLACE_ME';

export const RC_ENTITLEMENT_NO_ADS = 'no_ads';
export const RC_ENTITLEMENT_PRO    = 'pro';

// ── AdMob ────────────────────────────────────────────────────────────────────
// Test App ID — replace with real ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX before release
export const ADMOB_APP_ID_IOS = 'ca-app-pub-3940256099942544~1458002511';

// Google test interstitial/banner unit IDs — replace before release
export const AD_UNIT_IDS = {
  interstitial: 'ca-app-pub-3940256099942544/4411468910', // iOS test
  rewarded: 'ca-app-pub-3940256099942544/1712485313', // iOS test (rewarded video)
  banner: 'ca-app-pub-3940256099942544/2435281174', // iOS test (adaptive banner)
} as const;
