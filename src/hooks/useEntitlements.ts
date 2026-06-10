import { useEffect, useState } from 'react';
import { getEntitlements, subscribeEntitlements, type Entitlements } from '@/lib/revenueCat';

export function useEntitlements(): Entitlements {
  const [e, setE] = useState<Entitlements>(getEntitlements);
  useEffect(() => subscribeEntitlements(setE), []);
  return e;
}
