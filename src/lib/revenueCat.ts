import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { REVENUECAT_API_KEY_IOS, RC_ENTITLEMENT_NO_ADS, RC_ENTITLEMENT_PRO } from './config';

export interface Entitlements {
  noAds: boolean;
  pro:   boolean;
}

const FREE: Entitlements = { noAds: false, pro: false };
let _current: Entitlements = FREE;
const _listeners = new Set<(e: Entitlements) => void>();

export function subscribeEntitlements(fn: (e: Entitlements) => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getEntitlements(): Entitlements {
  return _current;
}

function parse(info: unknown): Entitlements {
  try {
    const active = (info as any)?.entitlements?.active ?? {};
    const noAds = RC_ENTITLEMENT_NO_ADS in active || RC_ENTITLEMENT_PRO in active;
    const pro   = RC_ENTITLEMENT_PRO in active;
    return { noAds, pro };
  } catch {
    return FREE;
  }
}

export async function initRevenueCat(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
    await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      _current = parse(customerInfo);
      _listeners.forEach((fn) => fn(_current));
    });
    const { customerInfo } = await Purchases.getCustomerInfo();
    _current = parse(customerInfo);
    _listeners.forEach((fn) => fn(_current));
  } catch {
    // Placeholder key or simulator — stays on free tier
  }
}
