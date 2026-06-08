import { useMemo } from 'react';
import { getEntitlements, type Entitlements } from '@/lib/revenueCat';

export function useEntitlements(): Entitlements {
  return useMemo(() => getEntitlements(), []);
}
