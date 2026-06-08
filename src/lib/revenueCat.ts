// PLACEHOLDER — integrate RevenueCat Capacitor SDK here.
// https://www.revenuecat.com/docs/capacitor
//
// Steps when ready:
//  1. npm install @revenuecat/purchases-capacitor
//  2. Replace stub below with Purchases.configure({ apiKey: YOUR_KEY })
//  3. Define entitlement IDs and map them to features below

export interface Entitlements {
  unlimited: boolean;   // unlimited tournaments
  export: boolean;      // DB export
  telegram: boolean;    // Telegram posting
}

const FREE_ENTITLEMENTS: Entitlements = {
  unlimited: false,
  export:    true,
  telegram:  false,
};

const PRO_ENTITLEMENTS: Entitlements = {
  unlimited: true,
  export:    true,
  telegram:  true,
};

let _override: Entitlements | null = null;

// Call during app init when RevenueCat is wired up.
export function setEntitlements(e: Entitlements): void {
  _override = e;
}

export function getEntitlements(): Entitlements {
  // Until RevenueCat is configured, return pro so nothing is gated during dev.
  return _override ?? PRO_ENTITLEMENTS;
}

export { FREE_ENTITLEMENTS, PRO_ENTITLEMENTS };
